-- Pinned chats.
-- Adds the pinned columns to chat_sessions and carries over any chats that were
-- already pinned from the user's profile. Safe to run more than once.
-- Run in the Supabase SQL editor. The dashboard starts using the columns on its
-- own as soon as they exist, with no deploy needed.

alter table public.chat_sessions
  add column if not exists is_pinned boolean not null default false,
  add column if not exists pinned_at timestamptz;

-- The existing row level security policy already limits updates to the owner.

-- Carry over pins made before this column existed. Order is kept by giving the
-- first pin in each list the newest pinned_at.
update public.chat_sessions s
set is_pinned = true,
    pinned_at = now() - (p.idx * interval '1 second')
from (
  select u.id as user_id, e.value as chat_id, e.ordinality as idx
  from auth.users u,
       jsonb_array_elements_text(coalesce(u.raw_user_meta_data -> 'pinned_chats', '[]'::jsonb)) with ordinality as e(value, ordinality)
) p
where s.id::text = p.chat_id
  and s.user_id::text = p.user_id::text
  and s.is_pinned = false;

create index if not exists chat_sessions_user_pinned_idx
  on public.chat_sessions (user_id, is_pinned);
