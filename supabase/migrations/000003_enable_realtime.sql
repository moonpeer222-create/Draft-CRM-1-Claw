-- Enable Realtime on core tables for live collaborative editing
-- Run this in Supabase SQL Editor or via CLI

-- Enable realtime for cases table
alter publication supabase_realtime add table public.cases;

-- Enable realtime for documents table
alter publication supabase_realtime add table public.documents;

-- Enable realtime for payments table  
alter publication supabase_realtime add table public.payments;

-- Enable realtime for notes table (if exists)
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'notes' and table_schema = 'public') then
    alter publication supabase_realtime add table public.notes;
  end if;
end $$;

-- Verify
select 
  schemaname,
  tablename,
  pubname
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public';
