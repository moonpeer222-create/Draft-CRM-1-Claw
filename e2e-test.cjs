const { createClient } = require('@supabase/supabase-js');

const url = 'https://nsglpnxboaxkrgtmlsps.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zZ2xwbnhib2F4a3JndG1sc3BzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5NDg0NTAsImV4cCI6MjA5MTUyNDQ1MH0.E8dQi419Wty0cxnADc5cl_8Xo_3O_hIyS1Zhsa5W5vg';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zZ2xwbnhib2F4a3JndG1sc3BzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk0ODQ1MCwiZXhwIjoyMDkxNTI0NDUwfQ.q2GQy2OhtS2-92YTiEaV5o8PCSJ89Xcozh0YRGsrqjg';

const adminClient = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

let passed = 0;
let failed = 0;
const testUsers = [];
let org1Id = null;
let org2Id = null;
let user1Session = null;

function log(name, ok, details = '') {
  if (ok) { passed++; console.log(`✅ ${name}${details ? ' | ' + details : ''}`); }
  else { failed++; console.log(`❌ ${name}${details ? ' | ' + details : ''}`); }
}

async function runTests() {
  console.log('\n========== TEST 1: BASIC CONNECTIVITY ==========\n');
  
  const { error: authErr } = await adminClient.auth.getSession();
  log('Auth endpoint reachable', !authErr, authErr?.message);
  
  for (const t of ['organizations', 'profiles', 'cases', 'documents', 'audit_logs']) {
    const { error } = await adminClient.from(t).select('*').limit(1);
    log(`Table "${t}" exists`, !error || error.code !== '42P01', error?.message);
  }

  console.log('\n========== TEST 2: AUTH SIGNUP + TRIGGER ==========\n');
  
  // Use admin API to create confirmed user so we bypass SMTP issues
  const email1 = `test${Date.now()}@example.com`;
  const { data: adminUser1, error: adminErr1 } = await adminClient.auth.admin.createUser({
    email: email1,
    password: 'testpass123',
    email_confirm: true
  });
  
  log('User creation via admin API', !adminErr1 && !!adminUser1?.user, adminErr1?.message);
  const user1 = adminUser1?.user;
  if (user1) testUsers.push(user1.id);
  
  if (user1) {
    const { data: profile, error: profErr } = await adminClient
      .from('profiles')
      .select('*, organizations(*)')
      .eq('id', user1.id)
      .single();
    log('Profile auto-created by trigger', !!profile && !profErr, profErr?.message);
    log('Profile has organization_id', !!profile?.organization_id, profile?.organization_id);
    log('Profile role is admin', profile?.role === 'admin', profile?.role);
    org1Id = profile?.organization_id || null;
  }

  console.log('\n========== TEST 3: SIGN IN + SESSION ==========\n');
  
  if (user1) {
    const anonClient1 = createClient(url, anonKey);
    const { data: signinData, error: signinErr } = await anonClient1.auth.signInWithPassword({
      email: email1,
      password: 'testpass123'
    });
    log('Sign in with password succeeds', !signinErr && !!signinData?.session, signinErr?.message);
    log('Session token received', !!signinData?.session?.access_token, '');
    user1Session = signinData?.session || null;
  }

  console.log('\n========== TEST 4: RLS ISOLATION ==========\n');
  
  const email2 = `test${Date.now() + 1}@example.com`;
  const { data: adminUser2, error: adminErr2 } = await adminClient.auth.admin.createUser({
    email: email2,
    password: 'testpass123',
    email_confirm: true
  });
  const user2 = adminUser2?.user;
  if (user2) testUsers.push(user2.id);
  
  log('Second user created', !adminErr2 && !!user2, adminErr2?.message);
  
  if (user2) {
    const { data: p2 } = await adminClient.from('profiles').select('organization_id').eq('id', user2.id).single();
    org2Id = p2?.organization_id || null;
  }
  
  if (user1 && user2) {
    log('Users have different orgs', org1Id !== org2Id, `Org1: ${org1Id}, Org2: ${org2Id}`);
    
    if (user1Session) {
      const client1 = createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      await client1.auth.setSession({ access_token: user1Session.access_token, refresh_token: user1Session.refresh_token });
      
      // Insert case for user1's org
      const { data: caseData, error: caseErr } = await client1
        .from('cases')
        .insert({
          organization_id: org1Id,
          case_number: 'CASE-001'
        })
        .select()
        .single();
      log('User1 can insert case in own org', !caseErr && !!caseData, caseErr?.message);
      
      if (caseData?.id) {
        const { data: readCase } = await client1.from('cases').select('*').eq('id', caseData.id).single();
        log('User1 can read own case', !!readCase, '');
      }
      
      const { data: allCases, error: allCasesErr } = await client1.from('cases').select('*');
      const onlyOwnOrg = !allCasesErr && Array.isArray(allCases) && allCases.every(c => c.organization_id === org1Id);
      log('RLS: User1 only sees own org cases', onlyOwnOrg, `Seen ${allCases?.length} cases`);
      
      const { error: crossErr } = await client1
        .from('cases')
        .insert({ organization_id: org2Id, case_number: 'CASE-HACK' });
      log('RLS: User1 cannot insert into user2 org', !!crossErr, crossErr?.message || 'No error (BAD)');
    }
  }

  console.log('\n========== TEST 5: DATA CRUD (Documents / Audit Logs) ==========\n');
  
  if (user1Session && org1Id) {
    const client1 = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    await client1.auth.setSession({ access_token: user1Session.access_token, refresh_token: user1Session.refresh_token });
    
    const { data: docData, error: docErr } = await client1
      .from('documents')
      .insert({
        organization_id: org1Id,
        file_name: 'passport.pdf',
        file_path: '/docs/passport.pdf'
      })
      .select()
      .single();
    log('Insert document', !docErr && !!docData, docErr?.message);
    
    const { data: logs, error: logErr } = await client1.from('audit_logs').select('*');
    log('Read audit logs', !logErr, logErr?.message);
  }

  console.log('\n========== TEST 6: ANON SIGNUP (SMTP CHECK) ==========\n');
  
  const anonClientTest = createClient(url, anonKey);
  const testEmail = `testsmtp${Date.now()}@example.com`;
  const { data: smtpSignup, error: smtpErr } = await anonClientTest.auth.signUp({
    email: testEmail,
    password: 'testpass123'
  });
  
  if (!smtpErr && smtpSignup?.user) {
    log('Anon signup (no SMTP issues)', true, '');
    if (smtpSignup.user.id) testUsers.push(smtpSignup.user.id);
  } else if (smtpErr?.message?.includes('confirmation email')) {
    log('Anon signup: SMTP/email not configured', true, 'WARNING: ' + smtpErr.message);
    if (smtpSignup?.user?.id) testUsers.push(smtpSignup.user.id);
  } else {
    log('Anon signup', false, smtpErr?.message);
  }

  console.log('\n========== TEST 7: CLEANUP ==========\n');
  
  for (const uid of testUsers) {
    const { error } = await adminClient.auth.admin.deleteUser(uid);
    log(`Deleted test user ${uid.slice(0, 8)}`, !error, error?.message);
  }
  
  console.log('\n========================================');
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');
  
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(e => {
  console.error('Test runner crashed:', e.message);
  process.exit(1);
});
