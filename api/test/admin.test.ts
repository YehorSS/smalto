import { env, exports } from 'cloudflare:workers';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seed } from '../src/seed';

let ipSeq = 0;
const ip = () => `10.4.0.${++ipSeq}`;
const call = (path: string, init: RequestInit & { token?: string } = {}) => {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'cf-connecting-ip': ip() };
  if (init.token) headers.authorization = `Bearer ${init.token}`;
  return exports.default.fetch(`http://x${path}`, { ...init, headers });
};
const login = async (login: string, password: string) =>
  (await call('/api/auth/login', { method: 'POST', body: JSON.stringify({ login, password }) })).json<{ token: string; role: string }>();
const nextYear = String((new Date().getUTCFullYear() + 1) % 100).padStart(2, '0');
const order = async (items = [{ sku: 'mug-latte', qty: 2 }], name = 'Marco Bianchi', email = 'marco@example.com') => {
  const r = await call('/api/orders', { method: 'POST', body: JSON.stringify({
    items, customer: { name, email, street: 'Via Roma 1', city: 'Faenza', postcode: '48018', country: 'IT' },
    card: { number: '4242424242424242', expiry: `12/${nextYear}`, cvc: '123' },
  }) });
  return (await r.json<{ code: string }>()).code;
};
const qty = async (sku: string) => (await env.DB.prepare('SELECT qty FROM stock WHERE sku = ?').bind(sku).first<{ qty: number }>())!.qty;
const patch = (path: string, token: string, body: object) => call(path, { method: 'PATCH', token, body: JSON.stringify(body) });

let demo = '', owner = '';
beforeAll(async () => {
  await seed(env.DB);
  demo = (await login('demo', 'demo')).token;
  owner = (await login('owner', 'owner-test-pass')).token;
});
beforeEach(async () => { await env.DB.exec('DELETE FROM order_lines; DELETE FROM orders;'); await seed(env.DB); });

describe('auth', () => {
  it('gives demo and owner a token that /me accepts', async () => {
    expect(await (await call('/api/auth/me', { token: demo })).json()).toEqual({ login: 'demo', role: 'demo' });
    expect(await (await call('/api/auth/me', { token: owner })).json()).toEqual({ login: 'owner', role: 'owner' });
  });

  it('stores only a hash of the token', async () => {
    const row = await env.DB.prepare('SELECT token_hash FROM sessions WHERE token_hash = ?').bind(demo).first();
    expect(row).toBeNull();
  });

  it('refuses a wrong password, a missing and an unknown token', async () => {
    const r = await call('/api/auth/login', { method: 'POST', body: JSON.stringify({ login: 'demo', password: 'nope' }) });
    expect(r.status).toBe(401);
    expect((await call('/api/admin/orders')).status).toBe(401);
    expect((await call('/api/admin/orders', { token: 'f'.repeat(64) })).status).toBe(401);
  });

  it('refuses an expired session', async () => {
    const t = (await login('demo', 'demo')).token;
    await env.DB.prepare('UPDATE sessions SET expires_at = 1').run();
    expect((await call('/api/admin/orders', { token: t })).status).toBe(401);
    demo = (await login('demo', 'demo')).token;
    owner = (await login('owner', 'owner-test-pass')).token;
  });

  it('pauses an address after five wrong passwords', async () => {
    const statuses = [];
    for (let i = 0; i < 6; i++) {
      const r = await exports.default.fetch('http://x/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '10.8.8.8' }, body: JSON.stringify({ login: 'demo', password: 'x' }) });
      statuses.push(r.status);
    }
    expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);
  });

  it('logs out', async () => {
    const t = (await login('demo', 'demo')).token;
    expect((await call('/api/auth/logout', { method: 'POST', token: t })).status).toBe(204);
    expect((await call('/api/auth/me', { token: t })).status).toBe(401);
  });
});

describe('orders in the admin', () => {
  it('walks paid → packed → shipped and refuses to cancel a shipped order', async () => {
    const code = await order();
    expect((await patch(`/api/admin/orders/${code}`, demo, { status: 'packed' })).status).toBe(200);
    expect((await patch(`/api/admin/orders/${code}`, demo, { status: 'shipped' })).status).toBe(200);
    const r = await patch(`/api/admin/orders/${code}`, demo, { status: 'cancelled' });
    expect(r.status).toBe(409);
    expect((await r.json<{ error: string }>()).error).toBe('bad_transition');
  });

  it('refuses skipping a step and unknown statuses', async () => {
    const code = await order();
    expect((await patch(`/api/admin/orders/${code}`, demo, { status: 'shipped' })).status).toBe(409);
    expect((await patch(`/api/admin/orders/${code}`, demo, { status: 'lost' })).status).toBe(400);
    expect((await patch('/api/admin/orders/SM-ZZZZ', demo, { status: 'packed' })).status).toBe(404);
  });

  it('puts the stock back once when an order is cancelled', async () => {
    const before = await qty('mug-latte');
    const code = await order([{ sku: 'mug-latte', qty: 2 }, { sku: 'tazza-latte', qty: 1 }]);
    const tazza = await qty('tazza-latte');
    await patch(`/api/admin/orders/${code}`, demo, { status: 'packed' });
    const [a, b] = await Promise.all([
      patch(`/api/admin/orders/${code}`, demo, { status: 'cancelled' }),
      patch(`/api/admin/orders/${code}`, demo, { status: 'cancelled' }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(await qty('mug-latte')).toBe(before);
    expect(await qty('tazza-latte')).toBe(tazza + 1);
  });

  it('finds orders by code, name and e-mail, and filters by status', async () => {
    const a = await order(undefined, 'Anna Neri', 'anna@example.com');
    await order(undefined, 'Paolo Verdi', 'paolo@example.com');
    const find = async (q: string) => (await (await call(`/api/admin/orders?q=${encodeURIComponent(q)}`, { token: demo })).json<{ code: string }[]>()).map(o => o.code);
    expect(await find(a)).toEqual([a]);
    expect(await find('anna')).toEqual([a]);
    expect(await find('ANNA@EXAMPLE')).toEqual([a]);
    expect(await find('nobody')).toEqual([]);
    await patch(`/api/admin/orders/${a}`, demo, { status: 'packed' });
    const packed = await (await call('/api/admin/orders?status=packed', { token: demo })).json<{ code: string; items: unknown[] }[]>();
    expect(packed.map(o => o.code)).toEqual([a]);
    expect(packed[0].items).toEqual([{ sku: 'mug-latte', qty: 2, unitPrice: 3200 }]);
  });

  it('shows one order with its lines and address', async () => {
    const code = await order();
    const o = await (await call(`/api/admin/orders/${code}`, { token: demo })).json<Record<string, unknown>>();
    expect(o).toMatchObject({ code, status: 'paid', city: 'Faenza', total: 7200, items: [{ sku: 'mug-latte', qty: 2, unitPrice: 3200 }] });
  });
});

describe('stock and prices', () => {
  it('lets demo set stock within 0–999', async () => {
    expect((await patch('/api/admin/stock/mug-latte', demo, { qty: 5 })).status).toBe(200);
    expect(await qty('mug-latte')).toBe(5);
    for (const bad of [-1, 1000, 2.5, '5']) expect((await patch('/api/admin/stock/mug-latte', demo, { qty: bad })).status).toBe(400);
    expect((await patch('/api/admin/stock/mug-oro', demo, { qty: 1 })).status).toBe(404);
  });

  it('lists stock with prices', async () => {
    const list = await (await call('/api/admin/stock', { token: demo })).json<{ sku: string; qty: number; price: number }[]>();
    expect(list.find(s => s.sku === 'mug-latte')).toMatchObject({ product_id: 'mug', glaze: 'latte', price: 3200 });
  });

  it('keeps prices to the owner', async () => {
    expect((await patch('/api/admin/products/mug', demo, { price: 100 })).status).toBe(403);
    expect((await patch('/api/admin/products/mug', owner, { price: 3500 })).status).toBe(200);
    expect((await patch('/api/admin/products/mug', owner, { price: 0 })).status).toBe(400);
    expect((await patch('/api/admin/products/nope', owner, { price: 3500 })).status).toBe(404);
    const p = await env.DB.prepare("SELECT price FROM products WHERE id = 'mug'").first<{ price: number }>();
    expect(p?.price).toBe(3500);
  });
});

describe('summary', () => {
  it('counts seven days, leaves cancelled orders out of revenue', async () => {
    const a = await order();
    await order([{ sku: 'tazza-latte', qty: 1 }]);
    await patch(`/api/admin/orders/${a}`, demo, { status: 'cancelled' });
    const s = await (await call('/api/admin/summary?days=7', { token: demo })).json<{ days: { date: string; orders: number; revenue: number }[]; toPack: number; lowStock: { sku: string; qty: number }[]; top: { product_id: string; qty: number }[] }>();
    expect(s.days).toHaveLength(7);
    const today = s.days[s.days.length - 1];
    expect(today.date).toBe(new Date().toISOString().slice(0, 10));
    expect(today).toMatchObject({ orders: 1, revenue: 3600 });
    expect(s.toPack).toBe(1);
    expect(s.lowStock.every(x => x.qty <= 2)).toBe(true);
    expect(s.top[0]).toEqual({ product_id: 'tazza', qty: 1 });
  });
});
