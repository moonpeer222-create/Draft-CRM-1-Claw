import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5173';
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

const CUSTOMER_EMAIL = process.env.E2E_CUSTOMER_EMAIL || 'customer@example.com';
const CUSTOMER_PASS = process.env.E2E_CUSTOMER_PASS || 'CustomerPass123!';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { (window as any).__skip_sw__ = true; });
  await page.evaluate(async () => {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) await reg.unregister();
    }
  });
});

test('customer debug 2', async ({ page }) => {
  const { data: cust } = await supabase!.from('profiles').select('id').eq('email', CUSTOMER_EMAIL).single();
  const caseNumber = `E2E-CUST-${Date.now()}`;
  await supabase!.from('cases').insert({
    case_number: caseNumber,
    client_id: cust!.id,
    organization_id: '00000000-0000-0000-0000-000000000001',
    status: 'new_case',
    priority: 'medium',
    destination_country: 'Saudi Arabia',
    visa_type: 'Worker',
    metadata: {
      customerName: 'E2E Debug2',
      phone: '03001234567',
      email: CUSTOMER_EMAIL,
      totalFee: 100000,
      paidAmount: 0,
      payments: [],
      documents: [],
      notes: [],
      timeline: [],
    },
  });

  await page.goto(`${BASE_URL}/customer/login`);
  await page.fill('input[type="email"]', CUSTOMER_EMAIL);
  await page.fill('input[type="password"]', CUSTOMER_PASS);
  await page.getByRole('button', { name: /^\s*(Sign In|Login|لاگ ان)\s*$/i }).click();
  await page.waitForURL(/\/customer\/?$/, { timeout: 15000 });

  await page.locator('nav >> text=Payments').first().click();
  await page.waitForURL(/\/customer\/payments/, { timeout: 15000 });

  await page.getByRole('button', { name: /I've Made the Payment|میں نے ادائیگی کر دی ہے/i }).click();
  await page.getByText(/EasyPaisa/i).first().click();
  await page.locator('input[type="number"]').first().fill('5000');
  await page.locator('input[type="text"]').first().fill(`REF-${Date.now()}`);
  await page.locator('input[type="date"]').first().fill(new Date().toISOString().split('T')[0]);
  await page.getByRole('button', { name: /Submit for Verification|تصدیق کے لیے جمع کریں/i }).click();
  await expect(page.getByText(/submitted|success|کامیابی/i)).toBeVisible({ timeout: 15000 });

  await page.locator('nav >> text=Dashboard').first().click();
  await page.waitForURL(/\/customer\/?$/, { timeout: 15000 });
  await page.locator('nav >> text=Payments').first().click();
  await page.waitForURL(/\/customer\/payments/, { timeout: 15000 });
  await page.waitForTimeout(1000);

  const html = await page.content();
  console.log('PAGE HTML SNIPPET:', html.includes('PKR 5,000'), html.includes('No payments recorded yet'), html.includes('Payment History'));
  await page.screenshot({ path: 'tmp-customer-debug2.png', fullPage: true });
});
