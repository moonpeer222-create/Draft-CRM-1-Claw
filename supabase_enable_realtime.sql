-- ==============================================================================
-- EMERALD CRM: ENABLE SUPABASE REALTIME
-- ==============================================================================

BEGIN;
  -- Ensure the realtime publication exists
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
      CREATE PUBLICATION supabase_realtime;
    END IF;
  END $$;

  -- Add tables to the realtime publication (idempotent)
  -- If you get an error that a table is already part of the publication, 
  -- you can ignore it or run 'alter publication supabase_realtime drop table <tab>;' first.
  
  ALTER PUBLICATION supabase_realtime ADD TABLE public.cases;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.tenants;

COMMIT;

-- INSTRUCTIONS:
-- 1. Run this in the Supabase SQL Editor.
-- 2. This enables the 'postgres_changes' event for these tables.
-- 3. RLS will still ensure that users only receive changes they are authorized to see.
