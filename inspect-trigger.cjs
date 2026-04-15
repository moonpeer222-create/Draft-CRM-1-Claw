const { createClient } = require('@supabase/supabase-js');

const url = 'https://nsglpnxboaxkrgtmlsps.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zZ2xwbnhib2F4a3JndG1sc3BzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk0ODQ1MCwiZXhwIjoyMDkxNTI0NDUwfQ.q2GQy2OhtS2-92YTiEaV5o8PCSJ89Xcozh0YRGsrqjg';

const adminClient = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function inspect() {
  // Get trigger function source
  const { data: funcData, error: funcErr } = await adminClient
    .rpc('exec_sql', {
      sql: `select pg_get_functiondef('public.handle_new_user'::regproc) as source`
    });
  
  if (funcErr) {
    console.log('Cannot read function via exec_sql:', funcErr.message);
    console.log('Trying direct catalog query...');
    
    const { data: direct, error: directErr } = await adminClient
      .from('pg_proc')
      .select('prosrc')
      .eq('proname', 'handle_new_user')
      .single();
    
    if (directErr) {
      console.log('Direct query failed:', directErr.message);
    } else {
      console.log('\n=== CURRENT TRIGGER FUNCTION SOURCE ===\n');
      console.log(direct?.prosrc);
    }
  } else {
    console.log('\n=== CURRENT TRIGGER FUNCTION SOURCE ===\n');
    console.log(funcData);
  }
  
  // Check organizations count
  const { data: orgs, error: orgErr } = await adminClient.from('organizations').select('id, name, created_at');
  console.log('\n=== ORGANIZATIONS ===');
  console.log('Count:', orgs?.length, orgErr?.message);
  console.log(orgs);
}

inspect().catch(e => console.error(e.message));
