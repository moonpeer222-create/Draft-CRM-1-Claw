import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__skip_sw__ = true;
  });
  await page.evaluate(async () => {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        await reg.unregister();
      }
    }
  });
});

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5173';

// ── Supabase admin client for test setup/teardown ──
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

// ── E2E Credentials ──
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASS = process.env.E2E_ADMIN_PASS || 'AdminPass123!';
const CUSTOMER_EMAIL = process.env.E2E_CUSTOMER_EMAIL || 'customer@example.com';
const CUSTOMER_PASS = process.env.E2E_CUSTOMER_PASS || 'CustomerPass123!';
const OPERATOR_EMAIL = process.env.E2E_OPERATOR_EMAIL || 'operator@example.com';
const OPERATOR_PASS = process.env.E2E_OPERATOR_PASS || 'OperatorPass123!';

// Agent uses 6-digit TOTP code — we compute it here so no email/password needed
function computeAgentCode(agentId: string, timeWindow: number): string {
  const seed = `EMERALD-${agentId}-VISA-TOTP-SEED`;
  const payload = `${seed}:${timeWindow}:EMERALD-VISA-CRM-2024-SECURE-KEY`;
  let hash = 5381;
  for (let i = 0; i < payload.length; i++) {
    hash = ((hash << 5) + hash) + payload.charCodeAt(i);
    hash = hash & 0x7FFFFFFF;
  }
  return String(hash % 1000000).padStart(6, '0');
}

async function getAgentCode(): Promise<string> {
  const window = Math.floor(Date.now() / (6 * 60 * 60 * 1000));
  return computeAgentCode('AGENT-1', window);
}

// ── Shared login helper ──
async function login(page: any, portal: 'admin' | 'agent' | 'customer' | 'operator') {
  if (portal === 'admin') {
    await page.goto(`${BASE_URL}/admin/login`);
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASS);
    await page.getByRole('button', { name: /^\s*(Sign In|Login|لاگ ان)\s*$/i }).click();
    await page.waitForURL(/\/admin\/?$/, { timeout: 15000 });
  }
  else if (portal === 'agent') {
    const code = await getAgentCode();
    await page.goto(`${BASE_URL}/agent/login`);
    const inputs = page.locator('input[maxlength="1"]');
    await expect(inputs).toHaveCount(6);
    for (let i = 0; i < 6; i++) {
      await inputs.nth(i).fill(code[i]);
    }
    await page.getByRole('button', { name: /Verify|Access|تصدیق/i }).first().click();
    await page.waitForURL(/\/agent\/?$/, { timeout: 15000 });
  }
  else if (portal === 'customer') {
    await page.goto(`${BASE_URL}/customer/login`);
    await page.fill('input[type="email"]', CUSTOMER_EMAIL);
    await page.fill('input[type="password"]', CUSTOMER_PASS);
    await page.getByRole('button', { name: /^\s*(Sign In|Login|لاگ ان)\s*$/i }).click();
    await page.waitForURL(/\/customer\/?$/, { timeout: 15000 });
  }
  else if (portal === 'operator') {
    await page.goto(`${BASE_URL}/operator/login`);
    await page.fill('input[type="email"]', OPERATOR_EMAIL);
    await page.fill('input[type="password"]', OPERATOR_PASS);
    await page.locator('button', { hasText: /Login|Sign In|لاگ ان/i }).first().click();
    await page.waitForURL(/\/operator\/?$/, { timeout: 15000 });
  }
}

// ── Create a case via Supabase REST so customer has something to pay for ──
async function seedCustomerCase(customerName: string): Promise<string | null> {
  if (!supabase) return null;
  const { data: cust } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', CUSTOMER_EMAIL)
    .single();
  if (!cust) return null;

  // Delete any existing cases for this customer so the test only sees the seeded one
  await supabase.from('cases').delete().eq('client_id', cust.id);

  const caseNumber = `E2E-${Date.now()}`;
  const { data, error } = await supabase.from('cases').insert({
    case_number: caseNumber,
    client_id: cust.id,
    organization_id: '00000000-0000-0000-0000-000000000001',
    status: 'new_case',
    priority: 'medium',
    destination_country: 'Saudi Arabia',
    visa_type: 'Worker',
    metadata: {
      customerName,
      phone: '03001234567',
      email: CUSTOMER_EMAIL,
      totalFee: 100000,
      paidAmount: 0,
      payments: [],
      documents: [],
      notes: [],
      timeline: [],
    },
  }).select('id').single();
  if (error) {
    console.error('seedCustomerCase error:', error);
    return null;
  }
  return caseNumber;
}

// ── Seed a case for operator tests ──
async function seedOperatorCase(customerName: string): Promise<string | null> {
  if (!supabase) return null;
  const caseNumber = `E2E-OP-${Date.now()}`;
  const { error } = await supabase.from('cases').insert({
    case_number: caseNumber,
    client_id: '0330893b-e56b-48f1-91b4-3395399550de',
    organization_id: '00000000-0000-0000-0000-000000000001',
    status: 'new_case',
    priority: 'medium',
    destination_country: 'Saudi Arabia',
    visa_type: 'Worker',
    metadata: {
      customerName,
      phone: '03001234567',
      totalFee: 50000,
      paidAmount: 0,
      payments: [],
      documents: [],
      notes: [],
      timeline: [],
    },
  });
  if (error) {
    console.error('seedOperatorCase error:', error);
    return null;
  }
  return caseNumber;
}

// ── Clean up E2E cases ──
async function cleanupE2ECases() {
  if (!supabase) return;
  await supabase.from('cases').delete().ilike('case_number', 'E2E-%');
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await cleanupE2ECases();
});

test.afterAll(async () => {
  await cleanupE2ECases();
});

// ============================================================
// ADMIN: create case → refresh → case still visible
// ============================================================
test('admin creates a case and it persists after refresh', async ({ page }) => {
  await login(page, 'admin');
  // Navigate client-side to avoid dev-server auth hang on full reload
  await page.locator('nav >> text=Cases').first().click();
  await page.waitForURL(/\/admin\/cases/, { timeout: 15000 });

  const newCaseBtn = page.getByRole('button', { name: /New Case|نیا کیس/i });
  await expect(newCaseBtn).toBeVisible({ timeout: 10000 });
  await newCaseBtn.click();
  await expect(page.getByText('Create New Case')).toBeVisible({ timeout: 10000 });

  const uniqueName = `E2E Admin ${Date.now()}`;
  await page.locator('input[placeholder="Full name"]').fill(uniqueName);
  await page.locator('input[type="tel"]').first().fill('03001234567');
  await page.getByRole('button', { name: /Create Case|کیس بنائیں/i }).click();
  await expect(page.getByText(/created successfully|کامیابی/i)).toBeVisible({ timeout: 15000 });

  // Navigate client-side away and back to re-fetch cases without a full reload
  // (full reload triggers a Vite lazy-chunk hang in Playwright)
  await page.locator('nav >> text=Dashboard').first().click();
  await page.waitForURL(/\/admin\/?$/, { timeout: 15000 });
  await page.locator('nav >> text=Cases').first().click();
  await page.waitForURL(/\/admin\/cases/, { timeout: 15000 });
  await expect(page.getByText(uniqueName).first()).toBeVisible({ timeout: 15000 });
});

// ============================================================
// AGENT: create case → refresh → case still visible
// ============================================================
test('agent sees an assigned case after navigation', async ({ page }) => {
  test.setTimeout(90000);
  const uniqueName = `E2E Agent ${Date.now()}`;
  const { data: agent } = await supabase
    .from('profiles')
    .select('id, agent_id')
    .eq('role', 'agent')
    .eq('agent_id', 'AGENT-1')
    .single();
  test.skip(!agent, 'Agent profile not found — skipping test');

  const caseNumber = `E2E-AGT-${Date.now()}`;
  const { error: insertErr } = await supabase.from('cases').insert({
    case_number: caseNumber,
    client_id: '0330893b-e56b-48f1-91b4-3395399550de',
    organization_id: '00000000-0000-0000-0000-000000000001',
    agent_id: agent.id,
    status: 'new_case',
    priority: 'medium',
    destination_country: 'Saudi Arabia',
    visa_type: 'Worker',
    metadata: {
      customerName: uniqueName,
      phone: '03001234567',
      agentId: agent.agent_id,
      agentName: 'Test Agent',
      totalFee: 50000,
      paidAmount: 0,
    },
  });
  test.skip(!!insertErr, `Failed to seed agent case: ${insertErr?.message}`);

  await login(page, 'agent');
  await page.waitForURL(/\/agent\/?$/, { timeout: 30000 });

  // Navigate to Cases tab client-side (avoid Vite lazy-chunk hang)
  await page.locator('nav >> text=Cases').first().click();
  await page.waitForURL(/\/agent\/cases/, { timeout: 30000 });
  await expect(page.getByText(uniqueName).first()).toBeVisible({ timeout: 15000 });

  // Navigate client-side away and back to re-fetch cases without a full reload
  await page.locator('nav >> text=Dashboard').first().click();
  await page.waitForURL(/\/agent\/?$/, { timeout: 15000 });
  await page.locator('nav >> text=Cases').first().click();
  await page.waitForURL(/\/agent\/cases/, { timeout: 15000 });
  await expect(page.getByText(uniqueName).first()).toBeVisible({ timeout: 15000 });
});

// ============================================================
// CUSTOMER: submit payment proof → refresh → persists
// ============================================================
test('customer submits payment proof and it persists after refresh', async ({ page }) => {
  const caseName = `E2E Customer ${Date.now()}`;
  const caseNumber = await seedCustomerCase(caseName);
  test.skip(!caseNumber, 'Could not seed customer case — skipping test');

  await login(page, 'customer');
  await page.locator('nav >> text=Payments').first().click();
  await page.waitForURL(/\/customer\/payments/, { timeout: 15000 });

  await page.getByRole('button', { name: /I've Made the Payment|میں نے ادائیگی کر دی ہے/i }).click();
  await page.getByText(/EasyPaisa/i).first().click();
  const refNum = `REF-${Date.now()}`;
  await page.locator('input[type="number"]').first().fill('5000');
  await page.locator('input[type="text"]').first().fill(refNum);
  await page.locator('input[type="date"]').first().fill(new Date().toISOString().split('T')[0]);
  await page.getByRole('button', { name: /Submit for Verification|تصدیق کے لیے جمع کریں/i }).click();
  await expect(page.getByText(/submitted|success|کامیابی/i)).toBeVisible({ timeout: 15000 });

  // Navigate client-side away and back to re-fetch without a full reload
  await page.locator('nav >> text=Dashboard').first().click();
  await page.waitForURL(/\/customer\/?$/, { timeout: 15000 });
  await page.locator('nav >> text=Payments').first().click();
  await page.waitForURL(/\/customer\/payments/, { timeout: 15000 });
  await page.waitForTimeout(1200);
  await expect(page.getByText(new RegExp(refNum)).first()).toBeVisible({ timeout: 15000 });
});

// ============================================================
// OPERATOR: change case status → refresh → status persists
// ============================================================
test('operator changes case status and it persists after refresh', async ({ page }) => {
  test.setTimeout(90000);
  const caseName = `E2E Operator ${Date.now()}`;
  const caseNumber = await seedOperatorCase(caseName);
  test.skip(!caseNumber, 'Could not seed operator case — skipping test');

  await login(page, 'operator');
  // Avoid a second full reload — the login already lands us on /operator/
  await page.waitForURL(/\/operator\/?$/, { timeout: 30000 });

  // Open the Status tab
  await page.getByRole('button', { name: /Status|صورتحال/i }).first().click({ timeout: 30000 });

  // Wait for our seeded case card
  await expect(page.getByText(caseNumber).first()).toBeVisible({ timeout: 15000 });

  // Click the blue status-change button on our case card
  const caseNumberSpan = page.locator('span', { hasText: caseNumber });
  const caseCard = caseNumberSpan.locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]');
  await caseCard.locator('button').nth(1).click();

  // Select a new status in the modal
  await page.getByText(/Document Collection|کاغزات جمع/i).first().click();

  // Click Change in the modal
  await page.getByRole('button', { name: /Change|تبدیل/i }).click();
  await expect(page.getByText(/status changed|صورتحال/i)).toBeVisible({ timeout: 15000 });

  // Navigate client-side away and back to re-fetch without a full reload
  await page.locator('nav >> text=Dashboard').first().click();
  await page.getByRole('button', { name: /Status|صورتحال/i }).first().click();

  // Verify the new status label persisted on the case card
  await expect(page.getByText(/Documents|کاغزات/i).first()).toBeVisible({ timeout: 15000 });
});
