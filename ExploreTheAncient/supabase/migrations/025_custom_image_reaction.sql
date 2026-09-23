-- Permit the custom Kilian image reaction alongside the standard emoji set.
alter table public.visit_reactions
drop constraint if exists visit_reactions_emoji_check;

alter table public.visit_reactions
add constraint visit_reactions_emoji_check
check (
  emoji in (
    '👍', '❤️', '🔥', '😮', '😂', '👏', '🏛️', '🗺️',
    'kilian'
  )
);

notify pgrst, 'reload schema';
