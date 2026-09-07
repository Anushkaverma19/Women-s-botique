-- MEHRAÉ Row Level Security
--
-- Principle: the anon/authenticated Postgres roles (used by the publishable
-- key) can only ever see what these policies allow. Privileged writes
-- (admin catalogue edits, checkout/inventory mutation) are performed via
-- SECURITY DEFINER functions or the service-role client from trusted server
-- code - never directly by the browser.

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.coupons enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Helper: is the current auth.uid() an admin? Defined with SECURITY DEFINER
-- so it can read profiles without recursing into the profiles RLS policy
-- that itself calls this function.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- profiles: users see/update only their own row; admins see all.
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = 'customer');
-- Note: customers can never set their own role to admin via this policy
-- because the with-check pins role to 'customer'. Promotion to admin is a
-- privileged, service-role-only operation (see README "Admin Setup").

-- ---------------------------------------------------------------------------
-- categories / products / images / variants: public read of active catalogue,
-- writes restricted to admins.
-- ---------------------------------------------------------------------------
drop policy if exists "categories_public_read" on public.categories;
create policy "categories_public_read" on public.categories for select using (true);

drop policy if exists "categories_admin_write" on public.categories;
create policy "categories_admin_write" on public.categories for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "products_public_read" on public.products;
create policy "products_public_read" on public.products for select
  using (active = true or public.is_admin());

drop policy if exists "products_admin_write" on public.products;
create policy "products_admin_write" on public.products for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "product_images_public_read" on public.product_images;
create policy "product_images_public_read" on public.product_images for select using (true);

drop policy if exists "product_images_admin_write" on public.product_images;
create policy "product_images_admin_write" on public.product_images for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "product_variants_public_read" on public.product_variants;
create policy "product_variants_public_read" on public.product_variants for select
  using (active = true or public.is_admin());

drop policy if exists "product_variants_admin_write" on public.product_variants;
create policy "product_variants_admin_write" on public.product_variants for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- coupons: no public read of the coupon table (prevents scraping every
-- active code); validation happens through a SECURITY DEFINER RPC instead.
-- ---------------------------------------------------------------------------
drop policy if exists "coupons_admin_all" on public.coupons;
create policy "coupons_admin_all" on public.coupons for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- carts / cart_items: strictly owner-only.
-- ---------------------------------------------------------------------------
drop policy if exists "carts_owner_all" on public.carts;
create policy "carts_owner_all" on public.carts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "cart_items_owner_all" on public.cart_items;
create policy "cart_items_owner_all" on public.cart_items for all
  using (
    exists (
      select 1 from public.carts
      where carts.id = cart_items.cart_id and carts.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.carts
      where carts.id = cart_items.cart_id and carts.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- orders / order_items: owner read-only from the client; admins can read and
-- update status. Inserts happen exclusively through the checkout RPC
-- (SECURITY DEFINER), so there is deliberately no public insert policy here.
-- ---------------------------------------------------------------------------
drop policy if exists "orders_owner_or_admin_select" on public.orders;
create policy "orders_owner_or_admin_select"
  on public.orders for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "orders_admin_update" on public.orders;
create policy "orders_admin_update"
  on public.orders for update
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "order_items_owner_or_admin_select" on public.order_items;
create policy "order_items_owner_or_admin_select"
  on public.order_items for select
  using (
    public.is_admin() or exists (
      select 1 from public.orders
      where orders.id = order_items.order_id and orders.user_id = auth.uid()
    )
  );
