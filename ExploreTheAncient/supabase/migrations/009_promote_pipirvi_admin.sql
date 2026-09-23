create or replace function public.protect_profile_admin_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_admin is distinct from old.is_admin
    and coalesce((select auth.role()), '') <> 'service_role'
    and session_user not in ('postgres', 'supabase_admin')
  then
    raise exception 'Only a trusted administrator can change administrator access.';
  end if;
  return new;
end;
$$;

-- Usernames are case-insensitively unique in this project.
update public.profiles
set is_admin = true,
    updated_at = now()
where lower(username) = lower('pipirvi');
