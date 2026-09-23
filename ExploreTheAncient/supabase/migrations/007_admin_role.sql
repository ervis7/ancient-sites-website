alter table public.profiles
add column if not exists is_admin boolean not null default false;

-- Promote the requested existing account. Matching both the auth email and
-- profile username avoids accidentally promoting a similarly named account.
update public.profiles profile
set is_admin = true,
    updated_at = now()
from auth.users account
where profile.id = account.id
  and lower(account.email) = lower('txitzipoulos4@gmail.com')
  and lower(profile.username) = lower('Poutsos_Treno');

-- Prevent users from changing their own authorization level through the
-- existing profile update policy/API.
create or replace function public.protect_profile_admin_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_admin is distinct from old.is_admin
    and coalesce((select auth.role()), '') <> 'service_role'
  then
    raise exception 'Only the service role can change administrator access.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_admin_role on public.profiles;
create trigger protect_profile_admin_role
before update on public.profiles
for each row execute function public.protect_profile_admin_role();
