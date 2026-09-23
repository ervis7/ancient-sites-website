alter table public.user_place_lists
add column if not exists is_favorites boolean not null default false;

create unique index if not exists user_place_lists_one_favorites_idx
on public.user_place_lists(user_id)
where is_favorites = true;

update public.user_place_lists
set is_favorites = true
where lower(name) = lower('Αγαπημένα')
  and not exists (
    select 1
    from public.user_place_lists existing
    where existing.user_id = user_place_lists.user_id
      and existing.is_favorites = true
  );

create or replace function public.prevent_default_favorites_list_delete()
returns trigger
language plpgsql
as $$
begin
  if old.is_favorites then
    raise exception 'The default favorites list cannot be deleted.';
  end if;
  return old;
end;
$$;

drop trigger if exists prevent_default_favorites_list_delete
on public.user_place_lists;

create trigger prevent_default_favorites_list_delete
before delete on public.user_place_lists
for each row
execute function public.prevent_default_favorites_list_delete();
