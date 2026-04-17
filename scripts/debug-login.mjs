import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const content = readFileSync('.env.local', 'utf-8');
const env = {};
for (const line of content.split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].trim();
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto('http://localhost:5173/admin/login');
console.log('Before login URL:', page.url());

await page.fill('input[type=email]', env.E2E_ADMIN_EMAIL);
await page.fill('input[type=password]', env.E2E_ADMIN_PASS);

const emailVal = await page.inputValue('input[type=email]');
const passVal = await page.inputValue('input[type=password]');
console.log('Filled email:', emailVal);
console.log('Filled password length:', passVal.length);

await page.click('button:has-text("Sign In")');

try {
  await page.waitForURL(/\/admin\/?$/, { timeout: 15000 });
  console.log('After login URL:', page.url());

  await page.goto('http://localhost:5173/admin/cases');
  console.log('After goto cases URL:', page.url());

  const btn = page.locator('text=/Create Case|New Case|نیا کیس/i').first();
  const visible = await btn.isVisible().catch(() => false);
  console.log('Create Case visible:', visible);
} catch (e) {
  console.error('Error:', e.message);
  console.log('Current URL:', page.url());
}

await browser.close();
