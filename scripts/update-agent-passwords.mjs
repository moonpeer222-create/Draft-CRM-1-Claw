/**
 * One-time script to update all agent auth passwords to the deterministic
 * value derived from their agent_id. Run after deploying the agent auth fix.
 *
 * Usage: node scripts/update-agent-passwords.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env.local');
let envContent = '';
try {
  envContent = readFileSync(envPath, 'utf-8');
} catch {
  console.error('❌ .env.local not found.');
  process.exit(1);
}

const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (match) env[match[1]] = match[2].trim();
}

const url = env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false }
});

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

async function main() {
  console.log('🔍 Fetching agents with agent_id...');
  const { data: agents, error } = await supabase
    .from('profiles')
    .select('id, email, agent_id, full_name')
    .eq('role', 'agent')
    .not('agent_id', 'is', null);

  if (error) {
    console.error('❌ Failed to fetch agents:', error.message);
    process.exit(1);
  }

  if (!agents || agents.length === 0) {
    console.log('ℹ️  No agents with agent_id found.');
    return;
  }

  for (const agent of agents) {
    const password = getAgentPassword(agent.agent_id);
    console.log(`\n📝 ${agent.email} (${agent.agent_id})`);
    const { error: updateError } = await supabase.auth.admin.updateUserById(agent.id, {
      password,
    });
    if (updateError) {
      console.error('   ❌ Failed to update password:', updateError.message);
    } else {
      console.log('   ✅ Password updated');
    }
  }

  console.log('\n🎉 Done!');
}

main().catch(err => {
  console.error('💥 Unexpected error:', err);
  process.exit(1);
});
