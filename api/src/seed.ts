import { PIECES, sku } from '../../shared/catalog';
import { hashPassword } from './password';

export interface Env { DB: D1Database; OWNER_PASSWORD?: string }

// fixed so the shop always shows a couple of sold-out and "last ones" glazes
const PATTERN = [6, 0, 9, 2, 12, 4, 1, 8, 3, 0, 7, 5];

export const seedStock = () => PIECES.flatMap(p => p.glazes).map((_, i) => PATTERN[i % PATTERN.length]);

/** Puts catalogue prices and stock back to the seed values; creates the demo user once. */
export async function seed(db: D1Database): Promise<void> {
  const qty = seedStock();
  let i = 0;
  const stmts: D1PreparedStatement[] = [];
  for (const p of PIECES) {
    stmts.push(db.prepare('INSERT INTO products (id, price) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET price = excluded.price').bind(p.id, p.price));
    for (const g of p.glazes) {
      stmts.push(db.prepare('INSERT INTO stock (sku, product_id, glaze, qty) VALUES (?, ?, ?, ?) ON CONFLICT(sku) DO UPDATE SET qty = excluded.qty').bind(sku(p.id, g), p.id, g, qty[i++]));
    }
  }
  await db.batch(stmts);
  const demo = await db.prepare("SELECT 1 FROM users WHERE login = 'demo'").first();
  if (!demo) {
    const h = await hashPassword('demo');
    await db.prepare("INSERT INTO users (login, hash, salt, role) VALUES ('demo', ?, ?, 'demo')").bind(h.hash, h.salt).run();
  }
}
