import { env, exports } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { seed } from '../src/seed';
import { ALL_SKUS, PIECES } from '../../shared/catalog';

beforeAll(async () => { await seed(env.DB); await seed(env.DB); });

const get = (path: string, origin?: string) => exports.default.fetch(`http://x${path}`, { headers: origin ? { origin } : {} });

describe('catalogue', () => {
  it('seeds once, however often it runs', async () => {
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM products').first<{ n: number }>();
    expect(n?.n).toBe(12);
    const s = await env.DB.prepare('SELECT COUNT(*) AS n FROM stock').first<{ n: number }>();
    expect(s?.n).toBe(ALL_SKUS.length);
  });

  it('has a few sold-out and nearly sold-out glazes', async () => {
    const { results } = await env.DB.prepare('SELECT qty FROM stock').all<{ qty: number }>();
    expect(results.filter(r => r.qty === 0).length).toBeGreaterThanOrEqual(2);
    expect(results.filter(r => r.qty >= 1 && r.qty <= 2).length).toBeGreaterThanOrEqual(2);
  });

  it('lists every piece with price and stock per glaze', async () => {
    const r = await get('/api/products');
    expect(r.status).toBe(200);
    const list = await r.json<{ id: string; price: number; stock: Record<string, number> }[]>();
    expect(list).toHaveLength(12);
    for (const p of PIECES) {
      const row = list.find(x => x.id === p.id)!;
      expect(row.price).toBe(p.price);
      expect(Object.keys(row.stock).sort()).toEqual([...p.glazes].sort());
    }
  });

  it('answers CORS for the shop and not for strangers', async () => {
    expect((await get('/api/products', 'https://yehorss.github.io')).headers.get('access-control-allow-origin')).toBe('https://yehorss.github.io');
    expect((await get('/api/products', 'https://evil.example')).headers.get('access-control-allow-origin')).toBeNull();
  });

  it('refuses negative stock at the database', async () => {
    await expect(env.DB.prepare("UPDATE stock SET qty = -1 WHERE sku = 'tazza-latte'").run()).rejects.toThrow(/CHECK/);
  });
});
