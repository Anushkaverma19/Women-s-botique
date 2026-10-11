-- MEHRAÉ Razorpay integration
--
-- Razorpay payments are asynchronous: the browser opens Razorpay's own
-- checkout, the user pays there (UPI/NetBanking), and *our* server only
-- finds out the outcome afterwards - either via the client-side success
-- callback (fast path, verified with Razorpay's checkout signature scheme)
-- or via the webhook (durable path, verified with Razorpay's webhook
-- signature scheme, and the only source of truth if the browser never
-- comes back). This is fundamentally different from the existing
-- place_order() RPC in 0003_functions.sql, which assumes the caller already
-- knows whether payment succeeded *before* calling it, and does
-- stock-check + order-creation + payment-confirmation as one atomic step.
--
-- Razorpay needs two separate atomic steps instead:
--   1. create_razorpay_order(): called when the user clicks "Pay". Locks
--      and decrements stock immediately (same FOR UPDATE pattern as
--      place_order) and creates a 'pending' order - this is what actually
--      prevents overselling while the user is on Razorpay's payment page.
--      Returns the order so the caller can create a matching Razorpay
--      order for that exact, server-computed total.
--   2. finalize_razorpay_order() / fail_razorpay_order(): called once the
--      outcome is known (from the verified callback or the webhook).
--      Finalize marks the order paid and clears the cart. Fail releases
--      the reserved stock back and marks the order cancelled. Both are
--      idempotent (guarded by `where payment_status = 'pending'`) because
--      Razorpay explicitly documents that webhooks can be delivered more
--      than once, and because both the callback path and the webhook path
--      may call the same function for the same order.
--
-- Known limitation (documented, not fixed here): an order that is reserved
-- but never confirmed or failed (e.g. the user closes the tab on
-- Razorpay's page and no webhook ever fires) leaves stock decremented
-- indefinitely. A scheduled job calling release_stale_razorpay_orders()
-- below is the intended mitigation, but wiring up that schedule (e.g.
-- Vercel Cron or `pg_cron`) is an infra step outside this migration.

alter table public.orders
  add column if not exists razorpay_order_id text unique,
  add column if not exists razorpay_payment_id text;

create index if not exists orders_razorpay_order_id_idx
  on public.orders (razorpay_order_id);

-- ---------------------------------------------------------------------------
-- create_razorpay_order: reserve stock + create a 'pending' order.
-- Mirrors place_order's pricing/locking logic exactly, minus the
-- payment-outcome branch (Razorpay hasn't been contacted yet at this point).
-- ---------------------------------------------------------------------------
create or replace function public.create_razorpay_order(
  p_user_id uuid,
  p_items jsonb,
  p_coupon_code text,
  p_shipping numeric,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_shipping_address text,
  p_shipping_city text,
  p_shipping_state text,
  p_shipping_postal_code text,
  p_shipping_country text
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_variant public.product_variants%rowtype;
  v_product public.products%rowtype;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_total numeric := 0;
  v_order public.orders%rowtype;
  v_order_number text;
  v_line_total numeric;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART' using errcode = 'P0001';
  end if;

  -- Lock every variant row FOR UPDATE up front so two concurrent checkouts
  -- for the same SKU cannot both pass the stock check (prevents oversell) -
  -- identical reasoning and pattern to place_order().
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_variant
    from public.product_variants
    where id = (v_item ->> 'variant_id')::uuid
    for update;

    if not found or v_variant.active = false then
      raise exception 'VARIANT_UNAVAILABLE' using errcode = 'P0001';
    end if;

    if v_variant.stock_quantity < (v_item ->> 'quantity')::int then
      raise exception 'INSUFFICIENT_STOCK:%', v_variant.sku using errcode = 'P0001';
    end if;

    v_line_total := v_variant.price * (v_item ->> 'quantity')::int;
    v_subtotal := v_subtotal + v_line_total;
  end loop;

  if p_coupon_code is not null and length(trim(p_coupon_code)) > 0 then
    select discount_amount into v_discount
    from public.validate_coupon(p_coupon_code, v_subtotal);
  end if;

  v_total := v_subtotal - coalesce(v_discount, 0) + coalesce(p_shipping, 0);

  v_order_number := 'MEH-' || to_char(now(), 'YYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.orders (
    order_number, user_id, status, subtotal, discount, shipping, total,
    coupon_code, payment_status, customer_name, customer_email, customer_phone,
    shipping_address, shipping_city, shipping_state, shipping_postal_code, shipping_country
  ) values (
    v_order_number, p_user_id, 'pending', v_subtotal, coalesce(v_discount, 0),
    coalesce(p_shipping, 0), v_total, nullif(upper(p_coupon_code), ''), 'pending',
    p_customer_name, p_customer_email, p_customer_phone,
    p_shipping_address, p_shipping_city, p_shipping_state, p_shipping_postal_code, p_shipping_country
  ) returning * into v_order;

  -- Reserve stock now, not at confirmation time - this is what actually
  -- protects inventory while the user is away on Razorpay's payment page.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_variant from public.product_variants
    where id = (v_item ->> 'variant_id')::uuid for update;

    select * into v_product from public.products where id = v_variant.product_id;

    update public.product_variants
      set stock_quantity = stock_quantity - (v_item ->> 'quantity')::int
      where id = v_variant.id;

    insert into public.order_items (
      order_id, product_id, variant_id, product_name, sku, size, color,
      quantity, unit_price, total_price, image_url
    ) values (
      v_order.id, v_variant.product_id, v_variant.id, v_product.name, v_variant.sku,
      v_variant.size, v_variant.color, (v_item ->> 'quantity')::int, v_variant.price,
      v_variant.price * (v_item ->> 'quantity')::int,
      (select image_url from public.product_images
       where product_id = v_variant.product_id order by sort_order asc limit 1)
    );
  end loop;

  -- Deliberately NOT clearing the cart here: payment hasn't been confirmed
  -- yet. The cart is only cleared by finalize_razorpay_order below, so an
  -- abandoned/failed payment leaves the user's cart intact to retry.
  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- finalize_razorpay_order: called after payment is verified (either the
-- signed checkout callback or the webhook). Idempotent: a second call for
-- an already-paid order is a safe no-op, guarded by the WHERE clause rather
-- than an IF/exception, so duplicate webhook delivery never errors.
-- ---------------------------------------------------------------------------
create or replace function public.finalize_razorpay_order(
  p_razorpay_order_id text,
  p_razorpay_payment_id text
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  update public.orders
  set payment_status = 'paid',
      status = 'confirmed',
      razorpay_payment_id = p_razorpay_payment_id
  where razorpay_order_id = p_razorpay_order_id
    and payment_status = 'pending'
  returning * into v_order;

  if found then
    delete from public.cart_items
    where cart_id in (select id from public.carts where user_id = v_order.user_id);
    return v_order;
  end if;

  -- Either already finalized (idempotent re-delivery) or the order doesn't
  -- exist - return the current row either way so the caller can tell those
  -- two cases apart, rather than raising on a legitimate duplicate webhook.
  select * into v_order from public.orders where razorpay_order_id = p_razorpay_order_id;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;
  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- fail_razorpay_order: releases reserved stock back and marks the order
-- cancelled. Idempotent for the same reason as finalize above.
-- ---------------------------------------------------------------------------
create or replace function public.fail_razorpay_order(
  p_razorpay_order_id text
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item public.order_items%rowtype;
begin
  update public.orders
  set payment_status = 'failed',
      status = 'cancelled'
  where razorpay_order_id = p_razorpay_order_id
    and payment_status = 'pending'
  returning * into v_order;

  if not found then
    select * into v_order from public.orders where razorpay_order_id = p_razorpay_order_id;
    if not found then
      raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
    end if;
    return v_order; -- already failed/paid - no-op, same idempotency reasoning as finalize.
  end if;

  for v_item in select * from public.order_items where order_id = v_order.id
  loop
    update public.product_variants
      set stock_quantity = stock_quantity + v_item.quantity
      where id = v_item.variant_id;
  end loop;

  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- release_stale_razorpay_orders: mitigation for reserved-but-abandoned
-- checkouts (see migration header). Not scheduled by this migration - call
-- it from a scheduled job (Vercel Cron / pg_cron) on whatever cadence fits.
-- Reuses fail_razorpay_order so the restock + idempotency logic isn't
-- duplicated.
-- ---------------------------------------------------------------------------
create or replace function public.release_stale_razorpay_orders(
  p_older_than_minutes int default 30
)
returns setof public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stale record;
begin
  for v_stale in
    select razorpay_order_id from public.orders
    where payment_status = 'pending'
      and razorpay_order_id is not null
      and created_at < now() - (p_older_than_minutes || ' minutes')::interval
  loop
    return next public.fail_razorpay_order(v_stale.razorpay_order_id);
  end loop;
end;
$$;

-- Only trusted server code calls these - never the browser directly:
--   - create_razorpay_order runs on behalf of a verified user session, same
--     trust model as place_order (caller passes auth.uid() as p_user_id).
--   - finalize/fail/release run from the webhook handler and the verified
--     checkout-callback Server Action, both of which use the service-role
--     admin client (no user session exists in a webhook request at all) -
--     so these are granted to service_role only, not authenticated.
revoke all on function public.create_razorpay_order from public, anon;
grant execute on function public.create_razorpay_order to authenticated, service_role;

revoke all on function public.finalize_razorpay_order from public, anon, authenticated;
grant execute on function public.finalize_razorpay_order to service_role;

revoke all on function public.fail_razorpay_order from public, anon, authenticated;
grant execute on function public.fail_razorpay_order to service_role;

revoke all on function public.release_stale_razorpay_orders from public, anon, authenticated;
grant execute on function public.release_stale_razorpay_orders to service_role;