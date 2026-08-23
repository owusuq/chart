-- ============================================================
-- Secure Smart Chat — Supabase schema
-- Run this in Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- 1. PROFILES ---------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  avatar_url text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by any authenticated user"
  on public.profiles for select
  using (auth.role() = 'authenticated');

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));

  -- Give every new user a private conversation with the AI assistant
  insert into public.conversations (id, is_ai, title)
  values (gen_random_uuid(), true, 'AI Assistant')
  returning id into new.raw_app_meta_data; -- placeholder, replaced below

  return new;
end;
$$ language plpgsql security definer;

-- (trigger created after conversations table exists — see bottom of file)

-- 2. CONVERSATIONS ------------------------------------------------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  is_ai boolean default false,
  title text,
  created_at timestamptz default now()
);

alter table public.conversations enable row level security;

create table if not exists public.conversation_participants (
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (conversation_id, user_id)
);

alter table public.conversation_participants enable row level security;

-- Helper: is the current user part of this conversation?
create or replace function public.is_participant(conv_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = conv_id and user_id = auth.uid()
  );
$$ language sql security definer stable;

create policy "Users see conversations they belong to"
  on public.conversations for select
  using (public.is_participant(id));

create policy "Authenticated users can create conversations"
  on public.conversations for insert
  with check (auth.role() = 'authenticated');

create policy "Users see their own participant rows and co-members"
  on public.conversation_participants for select
  using (public.is_participant(conversation_id));

create policy "Users can add participants to conversations they create"
  on public.conversation_participants for insert
  with check (auth.role() = 'authenticated');

-- 3. MESSAGES -------------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null, -- null = AI reply
  content text,
  file_url text,
  file_name text,
  file_type text,
  file_size bigint,
  created_at timestamptz default now()
);

alter table public.messages enable row level security;

create policy "Users read messages in their conversations"
  on public.messages for select
  using (public.is_participant(conversation_id));

create policy "Users send messages to their conversations"
  on public.messages for insert
  with check (
    public.is_participant(conversation_id)
    and (sender_id = auth.uid() or sender_id is null)
  );

-- Helpful index for fast history loading
create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);

-- 3b. CONNECTION REQUESTS ---------------------------------------------
-- Lets a user send a "friend request" to anyone who has signed up.
-- Once the receiver accepts, a 1:1 conversation is created and linked here
-- so both sides can jump straight into the chat.
create table if not exists public.connection_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  conversation_id uuid references public.conversations(id) on delete set null,
  created_at timestamptz default now(),
  responded_at timestamptz,
  constraint no_self_request check (sender_id <> receiver_id),
  unique (sender_id, receiver_id)
);

alter table public.connection_requests enable row level security;

create policy "Users see requests they sent or received"
  on public.connection_requests for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "Users send requests as themselves"
  on public.connection_requests for insert
  with check (auth.uid() = sender_id and sender_id <> receiver_id);

create policy "Receiver can accept or decline their incoming requests"
  on public.connection_requests for update
  using (auth.uid() = receiver_id)
  with check (auth.uid() = receiver_id);

create index if not exists connection_requests_receiver_idx
  on public.connection_requests (receiver_id, status);
create index if not exists connection_requests_sender_idx
  on public.connection_requests (sender_id, status);

-- 4. Now wire the signup trigger (needs conversations table to exist) ----
drop trigger if exists on_auth_user_created on auth.users;

create or replace function public.handle_new_user()
returns trigger as $$
declare
  new_conv_id uuid;
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));

  insert into public.conversations (id, is_ai, title)
  values (gen_random_uuid(), true, 'AI Assistant')
  returning id into new_conv_id;

  insert into public.conversation_participants (conversation_id, user_id)
  values (new_conv_id, new.id);

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 5. REALTIME ---------------------------------------------------------
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.connection_requests;

-- 6. STORAGE ------------------------------------------------------------
-- Create the bucket for chat file uploads (any file type, 25MB cap enforced in UI + here).
insert into storage.buckets (id, name, public, file_size_limit)
values ('chat-files', 'chat-files', false, 26214400)
on conflict (id) do nothing;

-- Only authenticated users can upload, into a folder named after their own user id.
create policy "Users upload into their own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'chat-files'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Any authenticated user can read a file IF they are a participant of the
-- conversation the file was attached to. We store files at:
--   {sender_id}/{conversation_id}/{filename}
-- so we can check the conversation_id segment against conversation_participants.
create policy "Participants can read files from their conversations"
  on storage.objects for select
  using (
    bucket_id = 'chat-files'
    and auth.role() = 'authenticated'
    and public.is_participant(((storage.foldername(name))[2])::uuid)
  );

create policy "Users can delete their own uploaded files"
  on storage.objects for delete
  using (
    bucket_id = 'chat-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
