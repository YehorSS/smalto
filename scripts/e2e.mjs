// End to end against a running shop: order with the test card → visible in the admin as demo → cancel → stock back.
// node scripts/e2e.mjs [shop url] [api url]    (writes one order to that database and cancels it)
import { chromium } from '@playwright/test';

const shop = process.argv[2] ?? 'https://yehorss.github.io/smalto';
const apiBase = process.argv[3] ?? 'https://smalto-demo.yehorss.workers.dev';
const stockOf = async () => (await (await fetch(`${apiBase}/api/products`)).json()).find(p => p.id === 'mug').stock.latte;
const step = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} ${extra}`); if (!ok) process.exitCode = 1; };

const before = await stockOf();
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));

await page.goto(`${shop}/p/mug?glaze=latte`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Add to cart' }).click();
await page.getByRole('link', { name: 'Checkout' }).click();
for (const [id, v] of [['name', 'Test Buyer'], ['email', 'test@example.com'], ['street', 'Via Roma 1'], ['city', 'Faenza'], ['postcode', '48018'], ['number', '4242 4242 4242 4242'], ['expiry', '12/30'], ['cvc', '123']]) await page.fill(`#${id}`, v);
await page.getByRole('button', { name: /^Pay/ }).click();
await page.waitForURL(/\/order\/SM-/, { timeout: 15000 });
const code = page.url().split('/order/')[1];
step('order placed', /^SM-[A-Z0-9]{4}$/.test(code), code);
step('stock taken', (await stockOf()) === before - 1, `${before} → ${await stockOf()}`);

await page.getByRole('link', { name: 'See it in the admin' }).click();
await page.fill('#password', 'demo');
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForSelector('.detail', { timeout: 15000 });
step('order visible in admin', (await page.locator('h2').first().textContent())?.includes(code));
await page.getByRole('button', { name: 'Cancel and restock' }).click();
await page.waitForSelector('.tag-cancelled', { timeout: 10000 });
step('cancelled', true);
step('stock back', (await stockOf()) === before, `${await stockOf()}`);
step('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
