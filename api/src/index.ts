import { Hono } from 'hono';
import type { Env } from './seed';
import { resetDemo } from './demo';
import { corsGuard } from './guard';
import { pub } from './public';
import { orders } from './orders';
import { auth } from './auth';
import { admin } from './admin';

export const app = new Hono<{ Bindings: Env }>();

app.use('/api/*', corsGuard);

// a fresh deploy has an empty database: fill it once, so the shop and demo login work before the first nightly reset
let ready = false;
app.use('/api/*', async (c, next) => {
  if (!ready) {
    if (!(await c.env.DB.prepare('SELECT 1 FROM products LIMIT 1').first())) await resetDemo(c.env.DB, Date.now(), Math.random);
    ready = true;
  }
  await next();
});
app.get('/api/health', c => c.json({ ok: true }));
app.route('/api', pub);
app.route('/api/orders', orders);
app.route('/api/auth', auth);
app.route('/api/admin', admin);
app.notFound(c => c.json({ error: 'not_found', message: 'Not found' }, 404));

export default {
  fetch: app.fetch,
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(resetDemo(env.DB, Date.now(), Math.random));
  },
} satisfies ExportedHandler<Env>;
