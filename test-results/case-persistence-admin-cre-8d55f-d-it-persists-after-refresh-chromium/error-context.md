# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: case-persistence.spec.ts >> admin creates a case and it persists after refresh
- Location: e2e\case-persistence.spec.ts:178:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('input[type="email"]')

```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { createClient } from '@supabase/supabase-js';
  3   | 
  4   | test.beforeEach(async ({ page }) => {
  5   |   await page.addInitScript(() => {
  6   |     (window as any).__skip_sw__ = true;
  7   |   });
  8   |   await page.evaluate(async () => {
  9   |     if ('serviceWorker' in navigator) {
  10  |       const regs = await navigator.serviceWorker.getRegistrations();
  11  |       for (const reg of regs) {
  12  |         await reg.unregister();
  13  |       }
  14  |     }
  15  |   });
  16  | });
  17  | 
  18  | const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5173';
  19  | 
  20  | // ── Supabase admin client for test setup/teardown ──
  21  | const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  22  | const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  23  | const supabase = supabaseUrl && supabaseServiceKey
  24  |   ? createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  25  |   : null;
  26  | 
  27  | // ── E2E Credentials ──
  28  | const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@example.com';
  29  | const ADMIN_PASS = process.env.E2E_ADMIN_PASS || 'AdminPass123!';
  30  | const CUSTOMER_EMAIL = process.env.E2E_CUSTOMER_EMAIL || 'customer@example.com';
  31  | const CUSTOMER_PASS = process.env.E2E_CUSTOMER_PASS || 'CustomerPass123!';
  32  | const OPERATOR_EMAIL = process.env.E2E_OPERATOR_EMAIL || 'operator@example.com';
  33  | const OPERATOR_PASS = process.env.E2E_OPERATOR_PASS || 'OperatorPass123!';
  34  | 
  35  | // Agent uses 6-digit TOTP code — we compute it here so no email/password needed
  36  | function computeAgentCode(agentId: string, timeWindow: number): string {
  37  |   const seed = `EMERALD-${agentId}-VISA-TOTP-SEED`;
  38  |   const payload = `${seed}:${timeWindow}:EMERALD-VISA-CRM-2024-SECURE-KEY`;
  39  |   let hash = 5381;
  40  |   for (let i = 0; i < payload.length; i++) {
  41  |     hash = ((hash << 5) + hash) + payload.charCodeAt(i);
  42  |     hash = hash & 0x7FFFFFFF;
  43  |   }
  44  |   return String(hash % 1000000).padStart(6, '0');
  45  | }
  46  | 
  47  | async function getAgentCode(): Promise<string> {
  48  |   const window = Math.floor(Date.now() / (6 * 60 * 60 * 1000));
  49  |   return computeAgentCode('AGENT-1', window);
  50  | }
  51  | 
  52  | // ── Shared login helper ──
  53  | async function login(page: any, portal: 'admin' | 'agent' | 'customer' | 'operator') {
  54  |   if (portal === 'admin') {
  55  |     await page.goto(`${BASE_URL}/admin/login`);
> 56  |     await page.fill('input[type="email"]', ADMIN_EMAIL);
      |                ^ Error: page.fill: Test timeout of 30000ms exceeded.
  57  |     await page.fill('input[type="password"]', ADMIN_PASS);
  58  |     await page.getByRole('button', { name: /^\s*(Sign In|Login|لاگ ان)\s*$/i }).click();
  59  |     await page.waitForURL(/\/admin\/?$/, { timeout: 15000 });
  60  |   }
  61  |   else if (portal === 'agent') {
  62  |     const code = await getAgentCode();
  63  |     await page.goto(`${BASE_URL}/agent/login`);
  64  |     const inputs = page.locator('input[maxlength="1"]');
  65  |     await expect(inputs).toHaveCount(6);
  66  |     for (let i = 0; i < 6; i++) {
  67  |       await inputs.nth(i).fill(code[i]);
  68  |     }
  69  |     await page.getByRole('button', { name: /Verify|Access|تصدیق/i }).first().click();
  70  |     await page.waitForURL(/\/agent\/?$/, { timeout: 15000 });
  71  |   }
  72  |   else if (portal === 'customer') {
  73  |     await page.goto(`${BASE_URL}/customer/login`);
  74  |     await page.fill('input[type="email"]', CUSTOMER_EMAIL);
  75  |     await page.fill('input[type="password"]', CUSTOMER_PASS);
  76  |     await page.getByRole('button', { name: /^\s*(Sign In|Login|لاگ ان)\s*$/i }).click();
  77  |     await page.waitForURL(/\/customer\/?$/, { timeout: 15000 });
  78  |   }
  79  |   else if (portal === 'operator') {
  80  |     await page.goto(`${BASE_URL}/operator/login`);
  81  |     await page.fill('input[type="email"]', OPERATOR_EMAIL);
  82  |     await page.fill('input[type="password"]', OPERATOR_PASS);
  83  |     await page.locator('button', { hasText: /Login|Sign In|لاگ ان/i }).first().click();
  84  |     await page.waitForURL(/\/operator\/?$/, { timeout: 15000 });
  85  |   }
  86  | }
  87  | 
  88  | // ── Create a case via Supabase REST so customer has something to pay for ──
  89  | async function seedCustomerCase(customerName: string): Promise<string | null> {
  90  |   if (!supabase) return null;
  91  |   const { data: cust } = await supabase
  92  |     .from('profiles')
  93  |     .select('id')
  94  |     .eq('email', CUSTOMER_EMAIL)
  95  |     .single();
  96  |   if (!cust) return null;
  97  | 
  98  |   // Delete any existing cases for this customer so the test only sees the seeded one
  99  |   await supabase.from('cases').delete().eq('client_id', cust.id);
  100 | 
  101 |   const caseNumber = `E2E-${Date.now()}`;
  102 |   const { data, error } = await supabase.from('cases').insert({
  103 |     case_number: caseNumber,
  104 |     client_id: cust.id,
  105 |     organization_id: '00000000-0000-0000-0000-000000000001',
  106 |     status: 'new_case',
  107 |     priority: 'medium',
  108 |     destination_country: 'Saudi Arabia',
  109 |     visa_type: 'Worker',
  110 |     metadata: {
  111 |       customerName,
  112 |       phone: '03001234567',
  113 |       email: CUSTOMER_EMAIL,
  114 |       totalFee: 100000,
  115 |       paidAmount: 0,
  116 |       payments: [],
  117 |       documents: [],
  118 |       notes: [],
  119 |       timeline: [],
  120 |     },
  121 |   }).select('id').single();
  122 |   if (error) {
  123 |     console.error('seedCustomerCase error:', error);
  124 |     return null;
  125 |   }
  126 |   return caseNumber;
  127 | }
  128 | 
  129 | // ── Seed a case for operator tests ──
  130 | async function seedOperatorCase(customerName: string): Promise<string | null> {
  131 |   if (!supabase) return null;
  132 |   const caseNumber = `E2E-OP-${Date.now()}`;
  133 |   const { error } = await supabase.from('cases').insert({
  134 |     case_number: caseNumber,
  135 |     client_id: '0330893b-e56b-48f1-91b4-3395399550de',
  136 |     organization_id: '00000000-0000-0000-0000-000000000001',
  137 |     status: 'new_case',
  138 |     priority: 'medium',
  139 |     destination_country: 'Saudi Arabia',
  140 |     visa_type: 'Worker',
  141 |     metadata: {
  142 |       customerName,
  143 |       phone: '03001234567',
  144 |       totalFee: 50000,
  145 |       paidAmount: 0,
  146 |       payments: [],
  147 |       documents: [],
  148 |       notes: [],
  149 |       timeline: [],
  150 |     },
  151 |   });
  152 |   if (error) {
  153 |     console.error('seedOperatorCase error:', error);
  154 |     return null;
  155 |   }
  156 |   return caseNumber;
```