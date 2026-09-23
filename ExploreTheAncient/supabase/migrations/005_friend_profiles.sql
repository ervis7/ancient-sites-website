create or replace function public.get_friend_profile(target_friend_id uuid)
returns table (
  friend_id uuid,
  full_name text,
  username text,
  avatar_url text,
  bio text,
  profile_location text,
  website text,
  place_id uuid,
  place_name text,
  place_location text,
  place_description text,
  place_image_url text,
  visit_date date,
  visit_photo text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    profile.id,
    profile.full_name,
    profile.username,
    profile.avatar_url,
    profile.bio,
    profile.location,
    profile.website,
    place.id,
    place.name,
    place.location,
    place.description,
    place.image_url,
    place.visit_date,
    place.visit_photo
  from public.friend_requests request
  join public.profiles profile on profile.id = target_friend_id
  left join public.places place
    on place.user_id = profile.id
    and place.visited = true
    and place.visit_date is not null
  where request.status = 'accepted'
    and auth.uid() in (request.sender_id, request.receiver_id)
    and target_friend_id = case
      when request.sender_id = auth.uid() then request.receiver_id
      else request.sender_id
    end
  order by place.visit_date desc nulls last;
$$;

revoke execute on function public.get_friend_profile(uuid) from public, anon;
grant execute on function public.get_friend_profile(uuid) to authenticated;
