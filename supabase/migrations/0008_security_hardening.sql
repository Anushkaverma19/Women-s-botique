-- 0008_security_hardening.sql
-- Remediations for VULN-06 (Deadlock Prevention) and VULN-09 (Payment Replay Protection)

-- 1. VULN-09: Partial Unique Index on razorpay_payment_id
-- Prevents double-spending / replay attacks by ensuring a single Razorpay payment_id
-- can never be attached or credited to more than one order row.
create unique index if not exists orders_razorpay_payment_id_unique_idx
  on public.orders (razorpay_payment_id)
  where razorpay_payment_id is not null;

-- 2. VULN-06: Deadlock Elimination (Canonical Order Row Locking)
-- Recreate create_razorpay_order to order p_items by variant_id ASC before FOR UPDATE locks.
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

  -- VULN-06 FIX: Order variant rows deterministically (variant_id ASC)
  -- to eliminate AB-BA cyclic lock waits (deadlock hazard 40P01) under high concurrency.
  for v_item in
    select value from jsonb_array_elements(p_items)
    order by (value ->> 'variant_id')::text asc
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

  -- Reserve stock and record line items (also processed in canonical variant order)
  for v_item in
    select value from jsonb_array_elements(p_items)
    order by (value ->> 'variant_id')::text asc
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

  return v_order;
end;
$$;

-- Ensure execution permissions
revoke all on function public.create_razorpay_order from public, anon;
grant execute on function public.create_razorpay_order to authenticated, service_role;
