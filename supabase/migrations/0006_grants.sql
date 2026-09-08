-- MEHRAÉ - explicit Data API grants
--
-- Supabase changed its platform default on 2026-05-30: new projects no
-- longer automatically grant SELECT/INSERT/UPDATE/DELETE on public-schema
-- tables to the anon/authenticated/service_role Postgres roles used by the
-- Data API (PostgREST/supabase-js). Without these explicit grants, every
-- query from the app - even one that RLS would otherwise allow - fails at
-- the privilege-check layer with `42501: permission denied for table ...`,
-- before RLS is ever evaluated.
--
-- Grants below are scoped per-table to exactly what the application code
-- needs (see lib/supabase/server.ts callers), matching the intent of the
-- RLS policies in 0002_rls.sql - RLS still governs which ROWS are visible;
-- this migration only governs which OPERATIONS are reachable at all.
--
-- Safe to re-run and safe on projects that still have the old implicit
-- grants (grant is idempotent/additive, never revokes or deletes data).

-- Public read-only catalogue data.
grant select on public.categories to anon, authenticated;
grant select on public.products to anon, authenticated;
grant select on public.product_images to anon, authenticated;
grant select on public.product_variants to anon, authenticated;

-- Customer-owned data - RLS restricts every row to the owning user.
grant select, insert, update, delete on public.carts to authenticated;
grant select, insert, update, delete on public.cart_items to authenticated;

-- Orders are created exclusively via the place_order() RPC (SECURITY
-- DEFINER, granted separately in 0003_functions.sql), so authenticated
-- only needs read access here; admin status updates go through the
-- service-role client, which is unaffected by grants.
grant select on public.orders to authenticated;
grant select on public.order_items to authenticated;

-- Profiles - customers read/update their own row (RLS-enforced; the
-- update policy also pins role to 'customer', see 0002_rls.sql).
grant select, update on public.profiles to authenticated;

-- Newsletter signup is intentionally insert-only and open to anonymous
-- visitors, matching the "newsletter_public_insert" RLS policy.
grant insert on public.newsletter_subscribers to anon, authenticated;

-- service_role (used by lib/supabase/admin.ts) bypasses RLS entirely and
-- needs full access to every table for admin catalogue/order management.
grant select, insert, update, delete on
  public.categories, public.products, public.product_images, public.product_variants,
  public.coupons, public.carts, public.cart_items, public.orders, public.order_items,
  public.profiles, public.newsletter_subscribers
  to service_role;

-- Note: public.coupons intentionally has NO grant to anon/authenticated -
-- coupon codes are validated exclusively through the validate_coupon() RPC
-- (SECURITY DEFINER, already granted in 0003_functions.sql), so the table
-- itself is never queried directly by the client, by design.
