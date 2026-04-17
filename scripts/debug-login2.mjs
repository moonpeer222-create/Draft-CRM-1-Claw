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

// Listen to console logs
page.on('console', msg => console.log('PAGE CONSOLE:', msg.type(), msg.text()));

await page.goto('http://localhost:5173/admin/login');
console.log('After goto URL:', page.url());

await page.fill('input[type=email]', env.E2E_ADMIN_EMAIL);
await page.fill('input[type=password]', env.E2E_ADMIN_PASS);

console.log('Email value:', await page.inputValue('input[type=email]'));

await page.click('button:has-text("Sign In")');
console.log('After click URL:', page.url());

// Wait a bit for any navigation
await page.waitForTimeout(2000);
console.log('After 2s URL:', page.url());

// Check localStorage for supabase auth token
const localStorageData = await page.evaluate(() => {
  const items = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    items[key] = localStorage.getItem(key);
  }
  return items;
});
console.log('localStorage keys:', Object.keys(localStorageData));

// Now goto cases
await page.goto('http://localhost:5173/admin/cases');
await page.waitForTimeout(2000);
console.log('After goto cases URL:', page.url());

const screenshotPath = 'scripts/debug-login2-screenshot.png';
await page.screenshot({ path: screenshotPath, fullPage: true });
console.log('Screenshot saved to', screenshotPath);

await browser.close();
