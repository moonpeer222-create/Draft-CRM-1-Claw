-- Enable Realtime on core tables for live collaborative editing
-- Run this in Supabase SQL Editor or via CLI

-- Enable realtime for tables if not already present
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'cases') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cases;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'documents') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'payments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
  END IF;
END $$;


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
