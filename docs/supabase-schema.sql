-- -------------------------------------------------------
-- Prompt AI – Supabase Database Schema
-- Run in: https://supabase.com/dashboard/project/cglrkliewuidvdkfnivf/sql
-- -------------------------------------------------------

-- Chat sessions (one per conversation thread)
create table if not exists public.chat_sessions (
  id          uuid        default gen_random_uuid() primary key,
  user_id     uuid        references auth.users(id) on delete cascade not null,
  title       text        not null default 'New Chat',
  model       text        not null default 'claude-3-5-sonnet',
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

-- Messages within a session
create table if not exists public.messages (
  id          uuid        default gen_random_uuid() primary key,
  session_id  uuid        references public.chat_sessions(id) on delete cascade not null,
  role        text        not null check (role in ('user', 'assistant')),
  content     text        not null,
  metadata    jsonb       not null default '{}',
  created_at  timestamptz default now() not null
);

-- Indexes
create index if not exists chat_sessions_user_id_idx   on public.chat_sessions(user_id);
create index if not exists chat_sessions_updated_at_idx on public.chat_sessions(updated_at desc);
create index if not exists messages_session_id_idx     on public.messages(session_id);
create index if not exists messages_created_at_idx     on public.messages(created_at);

-- Auto-update updated_at on chat_sessions
create or replace function public.update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists chat_sessions_updated_at on public.chat_sessions;
create trigger chat_sessions_updated_at
  before update on public.chat_sessions
  for each row execute function public.update_updated_at();

-- -------------------------------------------------------
-- Row Level Security
-- -------------------------------------------------------
alter table public.chat_sessions enable row level security;
alter table public.messages      enable row level security;

-- Users can only see and modify their own sessions
create policy "users_own_sessions"
  on public.chat_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users can only see messages belonging to their sessions
create policy "users_own_messages"
  on public.messages for all
  using (
    exists (
      select 1 from public.chat_sessions
      where id = messages.session_id and user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.chat_sessions
      where id = messages.session_id and user_id = auth.uid()
    )
  );
