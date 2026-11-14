import { Hono } from 'hono';
import type { Env } from './seed';
import { clientIp, fail, limit } from './guard';
import { newCode } from './codes';
import { parseSku } from '../../shared/catalog';
import { EU, shippingCents } from '../../shared/eu';

export interface Line { sku: string; qty: number; unitPrice: number }
export interface Customer { name: string; email: string; street: string; city: string; postcode: string; country: string }

const OK_CARD = '4242424242424242';
const DECLINED_CARD = '4000000000000002';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const POSTCODE_RE = /^[A-Za-z0-9 -]{3,10}$/;

export function totals(lines: Line[], country: string) {
  const subtotal = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const shipping = shippingCents(country, subtotal);
  return { subtotal, shipping, total: subtotal + shipping };
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

function checkCustomer(raw: unknown): Customer | string {
  const b = (raw ?? {}) as Record<string, unknown>;
  const c = { name: str(b.name), email: str(b.email).toLowerCase(), street: str(b.street), city: str(b.city), postcode: str(b.postcode).toUpperCase(), country: str(b.country).toUpperCase() };
  if (c.name.length < 2 || c.name.length > 80) return 'name';
  if (c.email.length > 120 || !EMAIL_RE.test(c.email)) return 'email';
  if (c.street.length < 2 || c.street.length > 120) return 'street';
  if (c.city.length < 2 || c.city.length > 60) return 'city';
  if (!POSTCODE_RE.test(c.postcode)) return 'postcode';
  if (!EU.includes(c.country)) return 'country';
  return c;
}

/** Merged sku → qty, or null when the lines are not acceptable. */
function checkItems(raw: unknown): Map<string, number> | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const m = new Map<string, number>();
  for (const it of raw) {
    const sku = str((it as { sku?: unknown })?.sku);
    const qty = (it as { qty?: unknown })?.qty;
    if (!parseSku(sku) || !Number.isInteger(qty) || (qty as number) < 1) return null;
    m.set(sku, (m.get(sku) ?? 0) + (qty as number));
  }
  if (m.size > 10 || [...m.values()].some(q => q > 10)) return null;
  return m;
}

type CardResult = 'ok' | 'declined' | 'invalid';

function checkCard(raw: unknown, now: Date): CardResult {
  const b = (raw ?? {}) as Record<string, unknown>;
  const number = str(b.number).replace(/[\s-]/g, '');
  const exp = /^(\d{2})\s*\/\s*(\d{2})$/.exec(str(b.expiry));
  if (!exp || !/^\d{3}$/.test(str(b.cvc))) return 'invalid';
  const month = Number(exp[1]), year = 2000 + Number(exp[2]);
  if (month < 1 || month > 12) return 'invalid';
  if (year * 12 + month < now.getUTCFullYear() * 12 + now.getUTCMonth() + 1) return 'invalid';
  if (number === OK_CARD) return 'ok';
  if (number === DECLINED_CARD) return 'declined';
  return 'invalid';
}

export const orders = new Hono<{ Bindings: Env }>();

orders.post('/', async c => {
  const db = c.env.DB;
  if (!(await limit(db, `order:${clientIp(c)}`, 5, 60))) return fail(c, 429, 'too_many', 'Too many orders from here, wait a minute');
  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!body || typeof body !== 'object') return fail(c, 400, 'invalid', 'Send the order as JSON', { field: 'body' });

  const items = checkItems(body.items);
  if (!items) return fail(c, 400, 'invalid', 'Check the pieces in the cart', { field: 'items' });
  const customer = checkCustomer(body.customer);
  if (typeof customer === 'string') return fail(c, 400, 'invalid', 'Check this field', { field: customer });
  const card = checkCard(body.card, new Date());
  if (card === 'invalid') return fail(c, 400, 'invalid', 'Use one of the test cards', { field: 'card' });
  if (card === 'declined') return fail(c, 402, 'declined', 'The card was declined (test card). Nothing was charged.');

  // prices come from the database only
  const skus = [...items.keys()];
  const marks = skus.map(() => '?').join(',');
  const { results: priced } = await db.prepare(`SELECT s.sku, p.price FROM stock s JOIN products p ON p.id = s.product_id WHERE s.sku IN (${marks})`).bind(...skus).all<{ sku: string; price: number }>();
  const lines: Line[] = skus.map(sku => ({ sku, qty: items.get(sku)!, unitPrice: priced.find(p => p.sku === sku)!.price }));
  const sums = totals(lines, customer.country);

  if (str(body.website)) return c.json({ code: newCode('SM'), lines, ...sums }, 201); // honeypot: looks fine, stores nothing

  for (let attempt = 0; attempt < 3; attempt++) {
    const code = newCode('SM');
    try {
      // one transaction: if any stock would go below zero the CHECK fails and nothing is written
      await db.batch([
        db.prepare('INSERT INTO orders (code, created_at, status, name, email, street, city, postcode, country, card_last4, subtotal, shipping, total) VALUES (?, ?, \'paid\', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(code, Date.now(), customer.name, customer.email, customer.street, customer.city, customer.postcode, customer.country, OK_CARD.slice(-4), sums.subtotal, sums.shipping, sums.total),
        ...lines.map(l => db.prepare('INSERT INTO order_lines (order_code, sku, qty, unit_price) VALUES (?, ?, ?, ?)').bind(code, l.sku, l.qty, l.unitPrice)),
        ...lines.map(l => db.prepare('UPDATE stock SET qty = qty - ? WHERE sku = ?').bind(l.qty, l.sku)),
      ]);
      return c.json({ code, lines, ...sums }, 201);
    } catch (e) {
      const msg = String(e);
      if (/CHECK/i.test(msg)) {
        const { results } = await db.prepare(`SELECT sku, qty FROM stock WHERE sku IN (${marks})`).bind(...skus).all<{ sku: string; qty: number }>();
        return fail(c, 409, 'out_of_stock', 'Someone just bought the last of these', { stock: Object.fromEntries(results.map(r => [r.sku, r.qty])) });
      }
      if (!/UNIQUE|PRIMARY/i.test(msg)) throw e; // code collision: try another code
    }
  }
  throw new Error('could not pick a free order code');
});
