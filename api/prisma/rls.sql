-- -------------------------------------------------------
-- Row Level Security for chat_sessions and messages
-- Run this ONCE in Supabase SQL Editor after prisma db push:
-- https://supabase.com/dashboard/project/cglrkliewuidvdkfnivf/sql
-- -------------------------------------------------------

-- Enable RLS
alter table public.chat_sessions enable row level security;
alter table public.messages      enable row level security;

-- chat_sessions: users can only access their own sessions
drop policy if exists "users_own_sessions" on public.chat_sessions;
create policy "users_own_sessions"
  on public.chat_sessions for all
  using  (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

-- messages: users can access messages belonging to their sessions
drop policy if exists "users_own_messages" on public.messages;
create policy "users_own_messages"
  on public.messages for all
  using (
    exists (
      select 1 from public.chat_sessions
      where id = messages.session_id
      and auth.uid()::text = user_id
    )
  )
  with check (
    exists (
      select 1 from public.chat_sessions
      where id = messages.session_id
      and auth.uid()::text = user_id
    )
  );
