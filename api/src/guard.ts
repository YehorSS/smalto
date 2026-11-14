import type { Context } from 'hono';
import { cors } from 'hono/cors';

export const ORIGINS = ['https://yehorss.github.io', 'http://localhost:5190'];

export const corsGuard = cors({
  origin: o => (ORIGINS.includes(o) ? o : null),
  allowMethods: ['GET', 'POST', 'PATCH'],
  allowHeaders: ['content-type', 'authorization'],
  maxAge: 600,
});

export type ErrorCode = 'invalid' | 'declined' | 'out_of_stock' | 'too_many' | 'not_found' | 'forbidden' | 'unauthorized' | 'bad_transition';

export function fail(c: Context, status: 400 | 401 | 402 | 403 | 404 | 409 | 429, error: ErrorCode, message: string, extra: object = {}) {
  return c.json({ error, message, ...extra }, status);
}

export const clientIp = (c: Context) => c.req.header('cf-connecting-ip') ?? 'local';

/** Fixed-window counter; true while the caller is under the limit. */
export async function limit(db: D1Database, key: string, max: number, windowSec: number, now = Date.now()): Promise<boolean> {
  const win = Math.floor(now / 1000 / windowSec) * windowSec;
  const row = await db
    .prepare('INSERT INTO hits (key, window_start, count) VALUES (?, ?, 1) ON CONFLICT(key, window_start) DO UPDATE SET count = count + 1 RETURNING count')
    .bind(key, win)
    .first<{ count: number }>();
  return (row?.count ?? 0) <= max;
}
