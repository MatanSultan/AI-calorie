-- Reassert ownership policies for the meal flow and add indexes used by
-- dashboard, history, and finalize queries.

update public.meal_items
set estimated_quantity = coalesce(nullif(estimated_quantity, ''), '1 serving')
where estimated_quantity is null or estimated_quantity = '';

alter table if exists public.meal_items
  alter column estimated_quantity set not null;

create index if not exists idx_meal_entries_user_status_time
  on public.meal_entries(user_id, status, occurred_at desc);

create index if not exists idx_meal_items_meal_user
  on public.meal_items(meal_entry_id, user_id);

create index if not exists idx_meal_images_meal_user
  on public.meal_images(meal_entry_id, user_id);

create index if not exists idx_meal_conversations_meal_user
  on public.meal_conversations(meal_entry_id, user_id);

create index if not exists idx_meal_messages_meal_user_time
  on public.meal_messages(meal_entry_id, user_id, created_at);

drop policy if exists "meal_entries_all_own" on public.meal_entries;
create policy "meal_entries_all_own"
on public.meal_entries
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "meal_items_all_own" on public.meal_items;
create policy "meal_items_all_own"
on public.meal_items
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "meal_images_all_own" on public.meal_images;
create policy "meal_images_all_own"
on public.meal_images
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "meal_conversations_all_own" on public.meal_conversations;
create policy "meal_conversations_all_own"
on public.meal_conversations
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "meal_messages_all_own" on public.meal_messages;
create policy "meal_messages_all_own"
on public.meal_messages
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('meal-images', 'meal-images', true)
on conflict (id) do nothing;

drop policy if exists "Meal images are readable" on storage.objects;
create policy "Meal images are readable"
on storage.objects
for select
using (bucket_id = 'meal-images');

drop policy if exists "Users can upload own meal images" on storage.objects;
create policy "Users can upload own meal images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'meal-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can modify own meal images" on storage.objects;
create policy "Users can modify own meal images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'meal-images'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'meal-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can delete own meal images" on storage.objects;
create policy "Users can delete own meal images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'meal-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);
