import { Hono } from 'hono';
import type { Env } from './seed';
import { fail } from './guard';
import { requireRole, type AuthVars } from './auth';

type Status = 'paid' | 'packed' | 'shipped' | 'cancelled';
const NEXT: Record<Status, Status[]> = { paid: ['packed', 'cancelled'], packed: ['shipped', 'cancelled'], shipped: [], cancelled: [] };
const STATUSES = Object.keys(NEXT) as Status[];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86_400_000;

interface OrderRow { code: string; created_at: number; status: Status; name: string; email: string; street: string; city: string; postcode: string; country: string; subtotal: number; shipping: number; total: number }

export const admin = new Hono<{ Bindings: Env; Variables: AuthVars }>();
admin.use('*', requireRole('owner', 'demo'));

async function withItems(db: D1Database, rows: OrderRow[]) {
  if (!rows.length) return [];
  const marks = rows.map(() => '?').join(',');
  const { results } = await db.prepare(`SELECT order_code, sku, qty, unit_price FROM order_lines WHERE order_code IN (${marks}) ORDER BY rowid`)
    .bind(...rows.map(r => r.code)).all<{ order_code: string; sku: string; qty: number; unit_price: number }>();
  return rows.map(r => ({ ...r, items: results.filter(l => l.order_code === r.code).map(l => ({ sku: l.sku, qty: l.qty, unitPrice: l.unit_price })) }));
}

admin.get('/orders', async c => {
  const { q = '', status = '', from = '', to = '' } = c.req.query();
  const where: string[] = [], args: (string | number)[] = [];
  if (q.trim()) {
    const like = `%${q.trim().toLowerCase()}%`;
    where.push('(lower(code) LIKE ? OR lower(name) LIKE ? OR lower(email) LIKE ?)');
    args.push(like, like, like);
  }
  if (STATUSES.includes(status as Status)) { where.push('status = ?'); args.push(status); }
  if (DATE_RE.test(from)) { where.push('created_at >= ?'); args.push(Date.parse(`${from}T00:00:00Z`)); }
  if (DATE_RE.test(to)) { where.push('created_at < ?'); args.push(Date.parse(`${to}T00:00:00Z`) + DAY); }
  const sql = `SELECT code, created_at, status, name, email, street, city, postcode, country, subtotal, shipping, total FROM orders ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT 200`;
  const { results } = await c.env.DB.prepare(sql).bind(...args).all<OrderRow>();
  return c.json(await withItems(c.env.DB, results));
});

admin.get('/orders/:code', async c => {
  const row = await c.env.DB.prepare('SELECT code, created_at, status, name, email, street, city, postcode, country, subtotal, shipping, total FROM orders WHERE code = ?').bind(c.req.param('code')).first<OrderRow>();
  if (!row) return fail(c, 404, 'not_found', 'No such order');
  return c.json((await withItems(c.env.DB, [row]))[0]);
});

admin.patch('/orders/:code', async c => {
  const db = c.env.DB, code = c.req.param('code');
  const body = await c.req.json<{ status?: unknown }>().catch(() => ({} as { status?: unknown }));
  const to = body.status as Status;
  if (!STATUSES.includes(to)) return fail(c, 400, 'invalid', 'Unknown status', { field: 'status' });
  const row = await db.prepare('SELECT status FROM orders WHERE code = ?').bind(code).first<{ status: Status }>();
  if (!row) return fail(c, 404, 'not_found', 'No such order');
  if (!NEXT[row.status].includes(to)) return fail(c, 409, 'bad_transition', `A ${row.status} order cannot become ${to}`);

  if (to !== 'cancelled') {
    const r = await db.prepare('UPDATE orders SET status = ? WHERE code = ? AND status = ?').bind(to, code, row.status).run();
    if (!r.meta.changes) return fail(c, 409, 'bad_transition', 'The order changed meanwhile, reload it');
    return c.json({ code, status: to });
  }
  // one transaction; the 'cancelling' mark makes the restock happen for exactly one of two racing cancels
  const [mark] = await db.batch([
    db.prepare("UPDATE orders SET status = 'cancelling' WHERE code = ? AND status IN ('paid', 'packed')").bind(code),
    db.prepare(`UPDATE stock SET qty = qty + (SELECT ol.qty FROM order_lines ol WHERE ol.order_code = ?1 AND ol.sku = stock.sku)
                WHERE sku IN (SELECT sku FROM order_lines WHERE order_code = ?1)
                  AND EXISTS (SELECT 1 FROM orders WHERE code = ?1 AND status = 'cancelling')`).bind(code),
    db.prepare("UPDATE orders SET status = 'cancelled' WHERE code = ? AND status = 'cancelling'").bind(code),
  ]);
  if (!mark.meta.changes) return fail(c, 409, 'bad_transition', 'The order changed meanwhile, reload it');
  return c.json({ code, status: to });
});

admin.get('/stock', async c => {
  const { results } = await c.env.DB.prepare('SELECT s.sku, s.product_id, s.glaze, s.qty, p.price FROM stock s JOIN products p ON p.id = s.product_id ORDER BY p.rowid, s.rowid').all();
  return c.json(results);
});

admin.patch('/stock/:sku', async c => {
  const body = await c.req.json<{ qty?: unknown }>().catch(() => ({} as { qty?: unknown }));
  const qty = body.qty;
  if (typeof qty !== 'number' || !Number.isInteger(qty) || qty < 0 || qty > 999) return fail(c, 400, 'invalid', 'Stock is a whole number 0–999', { field: 'qty' });
  const r = await c.env.DB.prepare('UPDATE stock SET qty = ? WHERE sku = ?').bind(qty, c.req.param('sku')).run();
  if (!r.meta.changes) return fail(c, 404, 'not_found', 'No such piece');
  return c.json({ sku: c.req.param('sku'), qty });
});

admin.patch('/products/:id', requireRole('owner'), async c => {
  const body = await c.req.json<{ price?: unknown }>().catch(() => ({} as { price?: unknown }));
  const price = body.price;
  if (typeof price !== 'number' || !Number.isInteger(price) || price < 100 || price > 100_000) return fail(c, 400, 'invalid', 'Price in cents, 1–1000 euro', { field: 'price' });
  const r = await c.env.DB.prepare('UPDATE products SET price = ? WHERE id = ?').bind(price, c.req.param('id')).run();
  if (!r.meta.changes) return fail(c, 404, 'not_found', 'No such piece');
  return c.json({ id: c.req.param('id'), price });
});

admin.get('/summary', async c => {
  const days = Math.min(30, Math.max(1, Number(c.req.query('days')) || 7));
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const since = today - (days - 1) * DAY;
  const db = c.env.DB;
  const [perDay, toPack, low, top] = await db.batch([
    db.prepare("SELECT CAST((created_at - ?1) / 86400000 AS INTEGER) AS d, COUNT(*) AS orders, SUM(total) AS revenue FROM orders WHERE created_at >= ?1 AND status != 'cancelled' GROUP BY d").bind(since),
    db.prepare("SELECT COUNT(*) AS n FROM orders WHERE status = 'paid'"),
    db.prepare('SELECT sku, qty FROM stock WHERE qty <= 2 ORDER BY qty, sku'),
    db.prepare(`SELECT s.product_id, SUM(ol.qty) AS qty FROM order_lines ol JOIN orders o ON o.code = ol.order_code JOIN stock s ON s.sku = ol.sku
                WHERE o.created_at >= ? AND o.status != 'cancelled' GROUP BY s.product_id ORDER BY qty DESC, s.product_id LIMIT 5`).bind(since),
  ]) as [D1Result<{ d: number; orders: number; revenue: number }>, D1Result<{ n: number }>, D1Result<{ sku: string; qty: number }>, D1Result<{ product_id: string; qty: number }>];
  return c.json({
    days: Array.from({ length: days }, (_, i) => {
      const hit = perDay.results.find(r => r.d === i);
      return { date: new Date(since + i * DAY).toISOString().slice(0, 10), orders: hit?.orders ?? 0, revenue: hit?.revenue ?? 0 };
    }),
    toPack: toPack.results[0]?.n ?? 0,
    lowStock: low.results,
    top: top.results,
  });
});
