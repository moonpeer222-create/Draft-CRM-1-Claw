-- ============================================================================
-- SUPABASE STORAGE SETUP FOR EMERALD CRM
-- Run this in the Supabase SQL Editor
-- ============================================================================

-- 1. Create the documents bucket (if not exists)
-- You can also do this via Dashboard → Storage → New Bucket
insert into storage.buckets (id, name, public, avif_autodetection)
values ('documents', 'documents', false, false)
on conflict (id) do nothing;

-- 2. Enable RLS on storage.objects
alter table storage.objects enable row level security;

-- 3. Policy: Users can ONLY upload files to paths matching their org_id
-- The path format must be: {organization_id}/{filename}
create policy "Org isolation upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (
      split_part(name, '/', 1) = (
        select organization_id::text
        from public.profiles
        where id = auth.uid()
      )
    )
  );

-- 4. Policy: Users can ONLY read files from their own org path
create policy "Org isolation select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (
      split_part(name, '/', 1) = (
        select organization_id::text
        from public.profiles
        where id = auth.uid()
      )
    )
  );

-- 5. Policy: Users can ONLY delete files from their own org path
create policy "Org isolation delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (
      split_part(name, '/', 1) = (
        select organization_id::text
        from public.profiles
        where id = auth.uid()
      )
    )
  );

-- ============================================================================
-- DONE
-- ============================================================================
