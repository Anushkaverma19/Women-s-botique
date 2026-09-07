-- MEHRAÉ admin setup helper.
--
-- There is deliberately NO way to become an admin from the browser or from
-- any authenticated-role RPC - promotion is only possible with the
-- service-role key (Supabase SQL editor, or a trusted server script), which
-- the person deploying the project controls. See README.md "Admin Setup".

create or replace function public.promote_to_admin(p_email text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  update public.profiles
    set role = 'admin'
    where email = p_email
    returning * into v_profile;

  if not found then
    raise exception 'NO_PROFILE_FOR_EMAIL:%', p_email using errcode = 'P0001';
  end if;

  return v_profile;
end;
$$;

-- Intentionally only grantable to service_role: an authenticated user must
-- never be able to call this on themselves.
revoke all on function public.promote_to_admin from public, anon, authenticated;
grant execute on function public.promote_to_admin to service_role;

-- Usage (run in the Supabase SQL editor, which uses your project's admin
-- privileges - or via a one-off script using SUPABASE_SECRET_KEY):
--
--   select public.promote_to_admin('you@example.com');
--
-- The person must already have signed up through the app once, since this
-- function promotes an existing profile row rather than creating a user.
