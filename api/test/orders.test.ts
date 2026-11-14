import { env, exports } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { seed } from '../src/seed';
import { totals } from '../src/orders';

beforeEach(async () => { await env.DB.exec('DELETE FROM order_lines; DELETE FROM orders; DELETE FROM hits;'); await seed(env.DB); });

let ipSeq = 0;
const nextYear = String((new Date().getUTCFullYear() + 1) % 100).padStart(2, '0');
const good = () => ({
  items: [{ sku: 'tazza-latte', qty: 2 }],
  customer: { name: 'Giulia Rossi', email: 'giulia@example.com', street: 'Corso Mazzini 12', city: 'Faenza', postcode: '48018', country: 'IT' },
  card: { number: '4242 4242 4242 4242', expiry: `12/${nextYear}`, cvc: '123' },
  website: '',
});
const post = (body: unknown, ip = `10.2.0.${++ipSeq}`) =>
  exports.default.fetch('http://x/api/orders', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip }, body: JSON.stringify(body) });
const qty = async (sku: string) => (await env.DB.prepare('SELECT qty FROM stock WHERE sku = ?').bind(sku).first<{ qty: number }>())!.qty;
const orderCount = async () => (await env.DB.prepare('SELECT COUNT(*) AS n FROM orders').first<{ n: number }>())!.n;

describe('totals', () => {
  it('charges Italian and EU shipping, free from 120 euro', () => {
    expect(totals([{ sku: 'a', qty: 1, unitPrice: 2800 }], 'IT')).toEqual({ subtotal: 2800, shipping: 800, total: 3600 });
    expect(totals([{ sku: 'a', qty: 1, unitPrice: 2800 }], 'DE')).toEqual({ subtotal: 2800, shipping: 1500, total: 4300 });
    expect(totals([{ sku: 'a', qty: 1, unitPrice: 11999 }], 'IT').shipping).toBe(800);
    expect(totals([{ sku: 'a', qty: 1, unitPrice: 12000 }], 'IT').shipping).toBe(0);
  });
});

describe('POST /api/orders', () => {
  it('places an order, takes stock and keeps only the last four digits', async () => {
    const before = await qty('tazza-latte');
    const r = await post(good());
    expect(r.status).toBe(201);
    const body = await r.json<{ code: string; subtotal: number; shipping: number; total: number }>();
    expect(body.code).toMatch(/^SM-[A-HJ-NP-Z2-9]{4}$/);
    expect(body).toMatchObject({ subtotal: 5600, shipping: 800, total: 6400 });
    expect(await qty('tazza-latte')).toBe(before - 2);
    const row = await env.DB.prepare('SELECT card_last4, status FROM orders WHERE code = ?').bind(body.code).first();
    expect(row).toEqual({ card_last4: '4242', status: 'paid' });
  });

  it('ignores prices and shipping sent by the client', async () => {
    const b = { ...good(), items: [{ sku: 'tazza-latte', qty: 1, price: 1 }], shipping: 0, total: 1 };
    const body = await (await post(b)).json<{ total: number }>();
    expect(body.total).toBe(3600);
  });

  it('declines the declined test card and stores nothing', async () => {
    const before = await qty('tazza-latte');
    const r = await post({ ...good(), card: { ...good().card, number: '4000000000000002' } });
    expect(r.status).toBe(402);
    expect((await r.json<{ error: string }>()).error).toBe('declined');
    expect(await orderCount()).toBe(0);
    expect(await qty('tazza-latte')).toBe(before);
  });

  it('refuses unknown cards, past expiry and bad CVC', async () => {
    for (const card of [
      { ...good().card, number: '5555555555554444' },
      { ...good().card, expiry: '01/20' },
      { ...good().card, expiry: '13/40' },
      { ...good().card, cvc: '12' },
    ]) {
      const r = await post({ ...good(), card });
      expect(r.status).toBe(400);
      expect((await r.json<{ field: string }>()).field).toBe('card');
    }
  });

  it('checks every customer field', async () => {
    const cases: [string, object][] = [
      ['name', { name: 'G' }], ['name', { name: 'x'.repeat(81) }],
      ['email', { email: 'giulia@' }], ['country', { country: 'US' }],
      ['postcode', { postcode: '12' }], ['street', { street: '' }], ['city', { city: '' }],
    ];
    for (const [field, patch] of cases) {
      const r = await post({ ...good(), customer: { ...good().customer, ...patch } });
      expect(r.status, field).toBe(400);
      expect((await r.json<{ field: string }>()).field).toBe(field);
    }
  });

  it('checks the lines', async () => {
    const eleven = ['tazza-latte', 'mug-latte', 'ciotola-latte', 'piattino-latte', 'piatto-latte', 'vasetto-turchese', 'vaso-latte', 'brocca-latte', 'chawan-miele', 'barattolo-miele', 'vassoio-latte'];
    for (const items of [
      [], [{ sku: 'tazza-latte', qty: 0 }], [{ sku: 'tazza-latte', qty: 11 }], [{ sku: 'tazza-oro', qty: 1 }],
      eleven.map(sku => ({ sku, qty: 1 })),
      [{ sku: 'tazza-latte', qty: 6 }, { sku: 'tazza-latte', qty: 6 }],
      'tazza',
    ]) {
      const r = await post({ ...good(), items });
      expect(r.status, JSON.stringify(items)).toBe(400);
      expect((await r.json<{ field: string }>()).field).toBe('items');
    }
  });

  it('merges repeated lines of the same piece', async () => {
    const r = await post({ ...good(), items: [{ sku: 'tazza-latte', qty: 1 }, { sku: 'tazza-latte', qty: 2 }] });
    expect(r.status).toBe(201);
    expect((await r.json<{ lines: unknown[] }>()).lines).toEqual([{ sku: 'tazza-latte', qty: 3, unitPrice: 2800 }]);
  });

  it('answers a filled honeypot like an order but stores nothing', async () => {
    const r = await post({ ...good(), website: 'http://spam' });
    expect(r.status).toBe(201);
    expect(await orderCount()).toBe(0);
  });

  it('sells the last piece once when two buyers race', async () => {
    await env.DB.prepare("UPDATE stock SET qty = 1 WHERE sku = 'tazza-latte'").run();
    const one = { ...good(), items: [{ sku: 'tazza-latte', qty: 1 }] };
    const rs = await Promise.all([post(one), post(one)]);
    expect(rs.map(r => r.status).sort()).toEqual([201, 409]);
    const lost = await rs.find(r => r.status === 409)!.json<{ error: string; stock: Record<string, number> }>();
    expect(lost).toMatchObject({ error: 'out_of_stock', stock: { 'tazza-latte': 0 } });
    expect(await qty('tazza-latte')).toBe(0);
    expect(await orderCount()).toBe(1);
  });

  it('refuses more than there is, and touches no other line', async () => {
    await env.DB.prepare("UPDATE stock SET qty = 1 WHERE sku = 'tazza-latte'").run();
    const mugBefore = await qty('mug-latte');
    const r = await post({ ...good(), items: [{ sku: 'mug-latte', qty: 1 }, { sku: 'tazza-latte', qty: 2 }] });
    expect(r.status).toBe(409);
    expect(await qty('mug-latte')).toBe(mugBefore);
    expect(await qty('tazza-latte')).toBe(1);
    expect(await orderCount()).toBe(0);
  });

  it('refuses a body that is not JSON', async () => {
    const r = await exports.default.fetch('http://x/api/orders', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '10.3.3.3' }, body: '{nope' });
    expect(r.status).toBe(400);
  });

  it('limits one address to five orders a minute', async () => {
    const statuses = [];
    const small = { ...good(), items: [{ sku: 'mug-latte', qty: 1 }] };
    for (let i = 0; i < 6; i++) statuses.push((await post(small, '10.9.9.9')).status);
    expect(statuses).toEqual([201, 201, 201, 201, 201, 429]);
  });
});
