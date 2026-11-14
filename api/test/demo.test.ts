import { env, exports } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { seed, seedStock } from '../src/seed';
import { resetDemo } from '../src/demo';
import { ALL_SKUS, PIECES } from '../../shared/catalog';

/** Small seeded generator so a reset can be repeated exactly. */
const rng = (s: number) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const NOW = Date.parse('2026-11-14T03:00:00Z');
const WEEK = 7 * 86_400_000;

beforeAll(async () => { await seed(env.DB); });

const orders = async () => (await env.DB.prepare('SELECT code, created_at, status FROM orders ORDER BY code').all<{ code: string; created_at: number; status: string }>()).results;

describe('nightly reset', () => {
  it('fills the last week with 25–40 orders and keeps stock honest', async () => {
    await env.DB.prepare("UPDATE products SET price = 1 WHERE id = 'mug'").run();
    await resetDemo(env.DB, NOW, rng(7));
    const list = await orders();
    expect(list.length).toBeGreaterThanOrEqual(25);
    expect(list.length).toBeLessThanOrEqual(40);
    for (const o of list) {
      expect(o.created_at).toBeGreaterThan(NOW - WEEK);
      expect(o.created_at).toBeLessThanOrEqual(NOW);
    }
    expect(new Set(list.map(o => o.status)).size).toBeGreaterThanOrEqual(3);
    const mug = await env.DB.prepare("SELECT price FROM products WHERE id = 'mug'").first<{ price: number }>();
    expect(mug?.price).toBe(PIECES.find(p => p.id === 'mug')!.price);

    // stock now + everything sold in live orders = the seed stock, piece by piece
    const start = seedStock();
    const { results: stock } = await env.DB.prepare('SELECT sku, qty FROM stock').all<{ sku: string; qty: number }>();
    const { results: sold } = await env.DB.prepare("SELECT ol.sku, SUM(ol.qty) AS n FROM order_lines ol JOIN orders o ON o.code = ol.order_code WHERE o.status != 'cancelled' GROUP BY ol.sku").all<{ sku: string; n: number }>();
    ALL_SKUS.forEach((sku, i) => {
      const now = stock.find(s => s.sku === sku)!.qty;
      expect(now).toBeGreaterThanOrEqual(0);
      expect(now + (sold.find(s => s.sku === sku)?.n ?? 0)).toBe(start[i]);
    });
  });

  it('gives the same week for the same seed, and removes earlier orders', async () => {
    await resetDemo(env.DB, NOW, rng(11));
    const a = await orders();
    await resetDemo(env.DB, NOW, rng(11));
    expect(await orders()).toEqual(a);
  });

  it('can be run by the owner only', async () => {
    const tok = async (login: string, password: string) => (await (await exports.default.fetch('http://x/api/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': `10.5.0.${login.length}` }, body: JSON.stringify({ login, password }),
    })).json<{ token: string }>()).token;
    const reset = (t: string) => exports.default.fetch('http://x/api/admin/reset', { method: 'POST', headers: { authorization: `Bearer ${t}` } });
    expect((await reset(await tok('demo', 'demo'))).status).toBe(403);
    expect((await reset(await tok('owner', 'owner-test-pass'))).status).toBe(200);
  });
});
