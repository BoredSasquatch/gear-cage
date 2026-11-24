-- Gear Cage update 3: equipment photos.
-- Run once in Supabase: SQL Editor > New query > paste everything > Run. Safe to run again.

alter table public.items add column if not exists photo_path text;   -- e.g. "<item id>/photo" (photo.jpg and photo-t.jpg)
alter table public.items add column if not exists photo_v bigint;    -- changes when a photo is replaced, so phones fetch the new one

-- Storage for photos. Photos can be viewed by anyone who has a photo's exact web address
-- (addresses contain random item IDs, so they can't be guessed). Only signed-in crew can add, replace or remove them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('item-photos', 'item-photos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "gear cage photos read" on storage.objects;
create policy "gear cage photos read" on storage.objects for select using (bucket_id = 'item-photos' and public.is_member());
drop policy if exists "gear cage photos add" on storage.objects;
create policy "gear cage photos add" on storage.objects for insert with check (bucket_id = 'item-photos' and public.is_member());
drop policy if exists "gear cage photos replace" on storage.objects;
create policy "gear cage photos replace" on storage.objects for update using (bucket_id = 'item-photos' and public.is_member());
drop policy if exists "gear cage photos remove" on storage.objects;
create policy "gear cage photos remove" on storage.objects for delete using (bucket_id = 'item-photos' and public.is_member());
