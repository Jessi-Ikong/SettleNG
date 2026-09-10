-- Fix for "Database error saving new user": the trigger function needs an
-- explicit search_path and the auth admin role needs grants on public
-- schema objects it touches, or the insert into public.profiles silently
-- fails when fired from the auth.users insert.

grant usage on schema public to supabase_auth_admin;
grant all on public.profiles to supabase_auth_admin;
grant usage on type public.user_role to supabase_auth_admin;

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'phone',
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'tenant')
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;
