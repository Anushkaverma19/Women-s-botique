-- MEHRAÉ business-logic functions
--
-- These SECURITY DEFINER functions are the ONLY way inventory is deducted
-- and orders are created. They run entirely inside one Postgres transaction
-- (a plpgsql function body is implicitly transactional - any exception
-- rolls back everything it did), so a payment can never partially deduct
-- stock or create a dangling order.

-- ---------------------------------------------------------------------------
-- validate_coupon: server-side coupon validation. Returns the coupon row
-- (or raises) - never trusts a client-calculated discount.
-- ---------------------------------------------------------------------------
create or replace function public.validate_coupon(
  p_code text,
  p_subtotal numeric
)
returns table (
  code text,
  discount_type text,
  discount_value numeric,
  discount_amount numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coupon public.coupons%rowtype;
  v_amount numeric;
begin
  select * into v_coupon from public.coupons
  where upper(coupons.code) = upper(p_code) and active = true
  limit 1;

  if not found then
    raise exception 'INVALID_COUPON' using errcode = 'P0001';
  end if;

  if v_coupon.expires_at is not null and v_coupon.expires_at < now() then
    raise exception 'COUPON_EXPIRED' using errcode = 'P0001';
  end if;

  if p_subtotal < v_coupon.minimum_order_amount then
    raise exception 'MINIMUM_NOT_MET' using errcode = 'P0001';
  end if;

  if v_coupon.discount_type = 'percentage' then
    v_amount := round(p_subtotal * (v_coupon.discount_value / 100.0), 2);
  else
    v_amount := v_coupon.discount_value;
  end if;

  if v_coupon.max_discount is not null and v_amount > v_coupon.max_discount then
    v_amount := v_coupon.max_discount;
  end if;

  if v_amount > p_subtotal then
    v_amount := p_subtotal;
  end if;

  return query select v_coupon.code, v_coupon.discount_type, v_coupon.discount_value, v_amount;
end;
$$;

-- ---------------------------------------------------------------------------
-- place_order: atomic checkout.
--
-- p_items: jsonb array of { "variant_id": uuid, "quantity": int }
-- p_payment_success: simulated payment outcome decided by the caller AFTER
--   this function has already locked+validated inventory and pricing, so a
--   "failed" simulated payment never touches stock or creates a paid order.
--
-- All pricing is recomputed here from product_variants/products - the
-- client-supplied prices are never trusted.
-- ---------------------------------------------------------------------------
create or replace function public.place_order(
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
  p_shipping_country text,
  p_payment_success boolean
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
  -- for the same SKU cannot both pass the stock check (prevents oversell).
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

  -- Simulated payment failure: pricing/inventory were validated above (so
  -- the UI can show an accurate total) but nothing is written.
  if p_payment_success is false then
    raise exception 'PAYMENT_FAILED' using errcode = 'P0001';
  end if;

  v_order_number := 'MEH-' || to_char(now(), 'YYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.orders (
    order_number, user_id, status, subtotal, discount, shipping, total,
    coupon_code, payment_status, customer_name, customer_email, customer_phone,
    shipping_address, shipping_city, shipping_state, shipping_postal_code, shipping_country
  ) values (
    v_order_number, p_user_id, 'confirmed', v_subtotal, coalesce(v_discount, 0),
    coalesce(p_shipping, 0), v_total, nullif(upper(p_coupon_code), ''), 'paid',
    p_customer_name, p_customer_email, p_customer_phone,
    p_shipping_address, p_shipping_city, p_shipping_state, p_shipping_postal_code, p_shipping_country
  ) returning * into v_order;

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

  -- Clear the customer's cart now that the order is confirmed.
  delete from public.cart_items
  where cart_id in (select id from public.carts where user_id = p_user_id);

  return v_order;
end;
$$;

-- Only the customer themselves (via the authenticated role, which is what
-- the server-side Supabase client uses when calling this RPC on the user's
-- behalf) should invoke this - enforced in application code by always
-- passing auth.uid() as p_user_id from a verified session, never a
-- client-supplied user id.
revoke all on function public.place_order from public, anon;
grant execute on function public.place_order to authenticated, service_role;
grant execute on function public.validate_coupon to authenticated, service_role, anon;
