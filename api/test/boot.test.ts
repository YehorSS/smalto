import { env, exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

describe('first start', () => {
  it('fills an empty database on the first request, so a fresh deploy works without the owner', async () => {
    await env.DB.exec('DELETE FROM order_lines; DELETE FROM orders; DELETE FROM sessions; DELETE FROM users; DELETE FROM stock; DELETE FROM products; DELETE FROM hits;');
    const r = await exports.default.fetch('http://x/api/products', { headers: { 'cf-connecting-ip': '10.7.0.1' } });
    expect((await r.json<unknown[]>()).length).toBe(12);
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM orders').first<{ n: number }>();
    expect(n!.n).toBeGreaterThanOrEqual(25);
    const login = await exports.default.fetch('http://x/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '10.7.0.2' }, body: JSON.stringify({ login: 'demo', password: 'demo' }) });
    expect(login.status).toBe(200);
  });
});
