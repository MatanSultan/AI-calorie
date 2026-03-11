-- Enable extensions
create extension if not exists "pgcrypto";

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  preferred_language text not null default 'he' check (preferred_language in ('he', 'en')),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- Meal entries
create table if not exists public.meal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  status text not null default 'pending_confirmation' check (status in ('draft', 'pending_confirmation', 'confirmed')),
  notes text,
  total_estimated_calories integer not null default 0,
  total_confirmed_calories integer,
  occurred_at timestamptz not null default timezone('utc'::text, now()),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- Meal items
create table if not exists public.meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_entry_id uuid not null references public.meal_entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  estimated_quantity text not null,
  estimated_calories integer not null default 0,
  protein_g numeric(8,2),
  carbs_g numeric(8,2),
  fat_g numeric(8,2),
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  source text not null default 'ai_estimate' check (source in ('ai_estimate', 'user_confirmed')),
  created_at timestamptz not null default timezone('utc'::text, now())
);

-- Meal images
create table if not exists public.meal_images (
  id uuid primary key default gen_random_uuid(),
  meal_entry_id uuid not null unique references public.meal_entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  public_url text,
  mime_type text not null,
  size_bytes bigint not null,
  width integer,
  height integer,
  created_at timestamptz not null default timezone('utc'::text, now())
);

-- Conversation + messages
create table if not exists public.meal_conversations (
  id uuid primary key default gen_random_uuid(),
  meal_entry_id uuid not null unique references public.meal_entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  summary text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.meal_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.meal_conversations(id) on delete cascade,
  meal_entry_id uuid not null references public.meal_entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('system', 'user', 'assistant')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

-- Goals
create table if not exists public.user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  daily_calorie_target integer,
  weight_goal_kg numeric(7,2),
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- Optional analytics cache
create table if not exists public.analytics_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cache_date date not null,
  payload jsonb not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique(user_id, cache_date)
);

create index if not exists idx_meal_entries_user_time on public.meal_entries(user_id, occurred_at desc);
create index if not exists idx_meal_items_entry on public.meal_items(meal_entry_id);
create index if not exists idx_meal_messages_conversation on public.meal_messages(conversation_id, created_at);
create index if not exists idx_analytics_user_date on public.analytics_cache(user_id, cache_date desc);

-- Trigger for updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists meal_entries_set_updated_at on public.meal_entries;
create trigger meal_entries_set_updated_at
before update on public.meal_entries
for each row execute procedure public.set_updated_at();

drop trigger if exists meal_conversations_set_updated_at on public.meal_conversations;
create trigger meal_conversations_set_updated_at
before update on public.meal_conversations
for each row execute procedure public.set_updated_at();

drop trigger if exists user_goals_set_updated_at on public.user_goals;
create trigger user_goals_set_updated_at
before update on public.user_goals
for each row execute procedure public.set_updated_at();

-- Auto profile create on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.meal_entries enable row level security;
alter table public.meal_items enable row level security;
alter table public.meal_images enable row level security;
alter table public.meal_conversations enable row level security;
alter table public.meal_messages enable row level security;
alter table public.user_goals enable row level security;
alter table public.analytics_cache enable row level security;

-- Policies
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

create policy "meal_entries_all_own" on public.meal_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "meal_items_all_own" on public.meal_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "meal_images_all_own" on public.meal_images for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "meal_conversations_all_own" on public.meal_conversations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "meal_messages_all_own" on public.meal_messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_goals_all_own" on public.user_goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "analytics_cache_all_own" on public.analytics_cache for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Storage bucket + policy
insert into storage.buckets (id, name, public)
values ('meal-images', 'meal-images', true)
on conflict (id) do nothing;

create policy "Meal images are readable" on storage.objects
for select using (bucket_id = 'meal-images');

create policy "Users can upload own meal images" on storage.objects
for insert with check (
  bucket_id = 'meal-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can modify own meal images" on storage.objects
for update using (
  bucket_id = 'meal-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can delete own meal images" on storage.objects
for delete using (
  bucket_id = 'meal-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

