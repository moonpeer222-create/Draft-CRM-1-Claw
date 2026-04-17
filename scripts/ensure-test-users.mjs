/**
 * Ensure Test Users Script
 * 
 * This script verifies that all E2E test accounts exist in Supabase Auth
 * and have the correct roles/profiles. Run it before E2E tests.
 * 
 * Usage: node scripts/ensure-test-users.mjs
 * Requires: SUPABASE_SERVICE_ROLE_KEY and VITE_SUPABASE_URL in .env.local
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local manually
const envPath = resolve(process.cwd(), '.env.local');
let envContent = '';
try {
  envContent = readFileSync(envPath, 'utf-8');
} catch {
  console.error('❌ .env.local not found. Please create it first.');
  process.exit(1);
}

const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (match) env[match[1]] = match[2].trim();
}

const supabaseUrl = env.VITE_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Deterministic agent password (must match src/app/lib/agentAuth.ts)
function getAgentPassword(agentId) {
  const TOTP_MASTER_SECRET = "EMERALD-VISA-CRM-2024-SECURE-KEY";
  const payload = `AGENT-AUTH-${agentId}-${TOTP_MASTER_SECRET}`;
  let hash = 5381;
  for (let i = 0; i < payload.length; i++) {
    hash = ((hash << 5) + hash) + payload.charCodeAt(i);
    hash = hash & 0x7FFFFFFF;
  }
  const num = hash % 100000000;
  return `Agent${String(num).padStart(8, '0')}!`;
}

const TEST_USERS = [
  { email: env.E2E_ADMIN_EMAIL || 'admin@example.com', password: env.E2E_ADMIN_PASS || 'AdminPass123!', role: 'admin', full_name: 'Test Admin' },
  { email: env.E2E_CUSTOMER_EMAIL || 'customer@example.com', password: env.E2E_CUSTOMER_PASS || 'CustomerPass123!', role: 'customer', full_name: 'Test Customer' },
  { email: env.E2E_OPERATOR_EMAIL || 'operator@example.com', password: env.E2E_OPERATOR_PASS || 'OperatorPass123!', role: 'operator', full_name: 'Test Operator' },
];

const AGENT_USER = {
  email: env.E2E_AGENT_EMAIL || 'agent@example.com',
  password: getAgentPassword('AGENT-1'),
  role: 'agent',
  full_name: 'Test Agent',
  agent_id: 'AGENT-1',
  agent_name: 'Test Agent'
};

async function ensureUser(user) {
  console.log(`\n🔍 Checking: ${user.email} (${user.role})`);
  
  // 1. Check if user exists in Auth
  const { data: existing, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('   ❌ Failed to list users:', listError.message);
    return;
  }
  
  const found = existing.users.find(u => u.email === user.email);
  let userId = found?.id;
  
  // 2. Create user if not found
  if (!found) {
    console.log(`   ⚠️  User not found. Creating...`);
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { full_name: user.full_name }
    });
    
    if (createError) {
      console.error('   ❌ Failed to create user:', createError.message);
      return;
    }
    userId = createData.user.id;
    console.log(`   ✅ Created auth user: ${userId}`);
  } else {
    console.log(`   ✅ Auth user exists: ${userId}`);
    // Update password to expected value (needed when password derivation changes)
    const { error: pwdError } = await supabase.auth.admin.updateUserById(userId, {
      password: user.password,
    });
    if (pwdError) {
      console.error('   ❌ Failed to update password:', pwdError.message);
    } else {
      console.log(`   ✅ Password updated`);
    }
  }
  
  // 3. Ensure profile exists with correct role
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
  
  if (!profile) {
    console.log(`   ⚠️  Profile missing. Creating profile...`);
    const { error: insertError } = await supabase.from('profiles').insert({
      id: userId,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      agent_id: user.agent_id || null,
      agent_name: user.agent_name || null,
      organization_id: null,
      avatar_url: null,
      last_seen: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });
    if (insertError) {
      console.error('   ❌ Failed to create profile:', insertError.message);
    } else {
      console.log(`   ✅ Profile created with role: ${user.role}`);
    }
  } else if (profile.role !== user.role) {
    console.log(`   ⚠️  Profile has wrong role: ${profile.role}. Fixing...`);
    const updates = { role: user.role };
    if (user.agent_id) updates.agent_id = user.agent_id;
    if (user.agent_name) updates.agent_name = user.agent_name;
    const { error: updateError } = await supabase.from('profiles').update(updates).eq('id', userId);
    if (updateError) {
      console.error('   ❌ Failed to update profile:', updateError.message);
    } else {
      console.log(`   ✅ Profile role updated to: ${user.role}`);
    }
  } else {
    console.log(`   ✅ Profile exists with correct role: ${profile.role}`);
    
    // Check agent_id specifically
    if (user.agent_id && profile.agent_id !== user.agent_id) {
      console.log(`   ⚠️  Agent ID mismatch: ${profile.agent_id || 'null'} → ${user.agent_id}. Fixing...`);
      const { error: updateError } = await supabase.from('profiles').update({
        agent_id: user.agent_id,
        agent_name: user.agent_name || user.full_name,
      }).eq('id', userId);
      if (updateError) {
        console.error('   ❌ Failed to update agent_id:', updateError.message);
      } else {
        console.log(`   ✅ Agent ID updated to: ${user.agent_id}`);
      }
    }
  }
}

async function main() {
  console.log('🚀 Ensuring test users exist in Supabase...');
  console.log('URL:', supabaseUrl);
  
  // Ensure admin, customer, operator
  for (const user of TEST_USERS) {
    await ensureUser(user);
  }
  
  // Ensure agent (AGENT-1)
  await ensureUser(AGENT_USER);
  
  console.log('\n🎉 Done! You can now run E2E tests with:');
  console.log('   npx playwright test\n');
}

main().catch(err => {
  console.error('💥 Unexpected error:', err);
  process.exit(1);
});
