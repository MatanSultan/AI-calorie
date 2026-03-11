-- Repair common schema drift issues for meal persistence and ensure RLS/storage policies exist.

alter table if exists public.meal_entries
  add column if not exists notes text,
  add column if not exists total_estimated_calories integer default 0,
  add column if not exists total_confirmed_calories integer,
  add column if not exists occurred_at timestamptz default timezone('utc'::text, now()),
  add column if not exists status text default 'pending_confirmation';

update public.meal_entries
set total_estimated_calories = coalesce(total_estimated_calories, 0)
where total_estimated_calories is null;

update public.meal_entries
set status = coalesce(status, 'pending_confirmation')
where status is null;

alter table if exists public.meal_items
  add column if not exists estimated_quantity text,
  add column if not exists protein_g numeric(8,2),
  add column if not exists carbs_g numeric(8,2),
  add column if not exists fat_g numeric(8,2),
  add column if not exists confidence text default 'medium',
  add column if not exists source text default 'ai_estimate';

update public.meal_items
set estimated_quantity = coalesce(nullif(estimated_quantity, ''), '1 serving')
where estimated_quantity is null or estimated_quantity = '';

update public.meal_items
set confidence = coalesce(nullif(confidence, ''), 'medium')
where confidence is null or confidence = '';

update public.meal_items
set source = coalesce(nullif(source, ''), 'ai_estimate')
where source is null or source = '';

alter table if exists public.meal_entries enable row level security;
alter table if exists public.meal_items enable row level security;
alter table if exists public.meal_images enable row level security;
alter table if exists public.meal_conversations enable row level security;
alter table if exists public.meal_messages enable row level security;
alter table if exists public.user_goals enable row level security;
alter table if exists public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "meal_entries_all_own" on public.meal_entries;
create policy "meal_entries_all_own" on public.meal_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "meal_items_all_own" on public.meal_items;
create policy "meal_items_all_own" on public.meal_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "meal_images_all_own" on public.meal_images;
create policy "meal_images_all_own" on public.meal_images for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "meal_conversations_all_own" on public.meal_conversations;
create policy "meal_conversations_all_own" on public.meal_conversations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "meal_messages_all_own" on public.meal_messages;
create policy "meal_messages_all_own" on public.meal_messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_goals_all_own" on public.user_goals;
create policy "user_goals_all_own" on public.user_goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('meal-images', 'meal-images', true)
on conflict (id) do nothing;

drop policy if exists "Meal images are readable" on storage.objects;
create policy "Meal images are readable" on storage.objects
for select using (bucket_id = 'meal-images');

drop policy if exists "Users can upload own meal images" on storage.objects;
create policy "Users can upload own meal images" on storage.objects
for insert with check (
  bucket_id = 'meal-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can modify own meal images" on storage.objects;
create policy "Users can modify own meal images" on storage.objects
for update using (
  bucket_id = 'meal-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can delete own meal images" on storage.objects;
create policy "Users can delete own meal images" on storage.objects
for delete using (
  bucket_id = 'meal-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);
