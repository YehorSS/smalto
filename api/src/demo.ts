import { ALL_SKUS, parseSku } from '../../shared/catalog';
import { totals } from './orders';
import { seed, seedStock } from './seed';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DAY = 86_400_000;

const PEOPLE: [string, string, string, string, string][] = [
  ['Giulia Rossi', 'Corso Mazzini 41', 'Faenza', '48018', 'IT'],
  ['Marco Bianchi', 'Via Zanardelli 8', 'Bologna', '40126', 'IT'],
  ['Chiara Ferri', 'Via dei Mille 22', 'Ravenna', '48121', 'IT'],
  ['Luca Moretti', 'Via Po 15', 'Torino', '10124', 'IT'],
  ['Elena Galli', 'Via Tornabuoni 3', 'Firenze', '50123', 'IT'],
  ['Paolo Conti', 'Via Toledo 210', 'Napoli', '80134', 'IT'],
  ['Sara Lombardi', 'Viale Monza 60', 'Milano', '20127', 'IT'],
  ['Anna Weber', 'Lindenstraße 12', 'München', '80331', 'DE'],
  ['Sophie Martin', 'Rue des Martyrs 18', 'Paris', '75009', 'FR'],
  ['Lucía García', 'Calle de Atocha 34', 'Madrid', '28012', 'ES'],
  ['Pieter de Vries', 'Prinsengracht 300', 'Amsterdam', '1016 HV', 'NL'],
  ['Katarzyna Nowak', 'ul. Floriańska 9', 'Kraków', '31-019', 'PL'],
  ['Lena Huber', 'Neubaugasse 25', 'Wien', '1070', 'AT'],
  ['Inês Costa', 'Rua Augusta 102', 'Lisboa', '1100-053', 'PT'],
];

/** Wipes the week, puts the catalogue back, and writes a plausible week of orders. */
export async function resetDemo(db: D1Database, now: number, rand: () => number): Promise<void> {
  await db.batch([db.prepare('DELETE FROM order_lines'), db.prepare('DELETE FROM orders'), db.prepare("DELETE FROM sessions WHERE login = 'demo'")]);
  await seed(db);

  const stock = new Map(ALL_SKUS.map((s, i) => [s, seedStock()[i]]));
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const code = () => `SM-${Array.from({ length: 4 }, () => pick([...ALPHABET])).join('')}`;
  const count = 25 + Math.floor(rand() * 16);
  const stmts: D1PreparedStatement[] = [];
  const used = new Set<string>();

  for (let made = 0, tries = 0; made < count && tries < 400; tries++) {
    const age = rand() * 7 * DAY * 0.98;
    const status = rand() < 0.08 ? 'cancelled' : age < DAY ? 'paid' : age < 3 * DAY ? (rand() < 0.5 ? 'paid' : 'packed') : 'shipped';
    const want = 1 + Math.floor(rand() * 3);
    const lines = new Map<string, number>();
    for (let k = 0; k < want; k++) {
      const s = pick(ALL_SKUS);
      const left = stock.get(s)! - (lines.get(s) ?? 0);
      // demo orders leave the planned sold-out and last-few glazes as they are, so the shop never looks emptied
      if (left > 3) lines.set(s, (lines.get(s) ?? 0) + Math.min(left - 3, 1 + Math.floor(rand() * 2)));
    }
    if (!lines.size) continue;
    let c = code();
    while (used.has(c)) c = code();
    used.add(c);
    // cancelled orders already gave their pieces back
    if (status !== 'cancelled') for (const [s, q] of lines) stock.set(s, stock.get(s)! - q);
    const priced = [...lines].map(([s, q]) => ({ sku: s, qty: q, unitPrice: parseSku(s)!.piece.price }));
    const [name, street, city, postcode, country] = pick(PEOPLE);
    const sums = totals(priced, country);
    const email = `${name.split(' ')[0].toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}@example.com`;
    stmts.push(db.prepare("INSERT INTO orders (code, created_at, status, name, email, street, city, postcode, country, card_last4, subtotal, shipping, total, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '4242', ?, ?, ?, 'demo')")
      .bind(c, Math.round(now - age), status, name, email, street, city, postcode, country, sums.subtotal, sums.shipping, sums.total));
    for (const l of priced) stmts.push(db.prepare('INSERT INTO order_lines (order_code, sku, qty, unit_price) VALUES (?, ?, ?, ?)').bind(c, l.sku, l.qty, l.unitPrice));
    made++;
  }
  for (const [s, q] of stock) stmts.push(db.prepare('UPDATE stock SET qty = ? WHERE sku = ?').bind(q, s));
  await db.batch(stmts);
}
