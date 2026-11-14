import { Hono } from 'hono';
import type { Env } from './seed';
import { clientIp, fail, limit } from './guard';

export const pub = new Hono<{ Bindings: Env }>();

pub.get('/products', async c => {
  if (!(await limit(c.env.DB, `cat:${clientIp(c)}`, 60, 60))) return fail(c, 429, 'too_many', 'Too many requests, wait a minute');
  const [{ results: products }, { results: stock }] = await c.env.DB.batch([
    c.env.DB.prepare('SELECT id, price FROM products ORDER BY rowid'),
    c.env.DB.prepare('SELECT product_id, glaze, qty FROM stock'),
  ]) as [D1Result<{ id: string; price: number }>, D1Result<{ product_id: string; glaze: string; qty: number }>];
  return c.json(products.map(p => ({
    ...p,
    stock: Object.fromEntries(stock.filter(s => s.product_id === p.id).map(s => [s.glaze, s.qty])),
  })));
});
