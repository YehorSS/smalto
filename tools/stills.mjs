// Renders every piece in every glaze from the same 3D code the product page uses.
// Start the dev server first (npm run dev -w web), then: node tools/stills.mjs [sku ...] [--bg=#hex --out=dir]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';
import { ALL_SKUS } from '../shared/catalog.ts';

const require = createRequire('D:/ResidenzaFaro/package.json');
const { chromium } = require('@playwright/test');

const args = process.argv.slice(2);
const opt = k => args.find(a => a.startsWith(`--${k}=`))?.split('=')[1];
const skus = args.filter(a => !a.startsWith('--'));
const out = opt('out') ?? 'web/public/stills';
const bg = opt('bg');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1600 }, reducedMotion: 'reduce' });
page.on('pageerror', e => console.error('page error:', e.message));
for (const sku of skus.length ? skus : ALL_SKUS) {
  const q = new URLSearchParams({ sku, ...(bg ? { bg } : {}) });
  await page.goto(`http://localhost:5190/smalto/__stills?${q}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });
  await page.waitForTimeout(150);
  const png = await page.screenshot({ omitBackground: !bg, type: 'png' });
  await sharp(png).webp({ quality: 82, alphaQuality: 90 }).toFile(`${out}/${sku}-1600.webp`);
  await sharp(png).resize(800).webp({ quality: 80, alphaQuality: 90 }).toFile(`${out}/${sku}-800.webp`);
  console.log(sku);
}
await browser.close();
