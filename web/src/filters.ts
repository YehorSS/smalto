import { COLLECTIONS, GLAZES, PIECES, type Collection, type GlazeId, type Piece } from '../../shared/catalog';
import type { ApiProduct } from './api';

export type Sort = 'featured' | 'price-asc' | 'price-desc';
export interface Filters { collection?: Collection; glaze: GlazeId[]; min?: number; max?: number; instock: boolean; sort: Sort }

export const DEFAULT_FILTERS: Filters = { glaze: [], instock: false, sort: 'featured' };
const SORTS: Sort[] = ['featured', 'price-asc', 'price-desc'];

const euros = (v: string | null) => {
  if (v === null || !/^\d{1,4}$/.test(v)) return undefined;
  return Number(v);
};

export function parseFilters(search: string): Filters {
  const q = new URLSearchParams(search);
  const f: Filters = { ...DEFAULT_FILTERS, glaze: [] };
  const c = q.get('collection');
  if (c && c in COLLECTIONS) f.collection = c as Collection;
  f.glaze = (q.get('glaze') ?? '').split(',').filter((g): g is GlazeId => g in GLAZES);
  const min = euros(q.get('min')), max = euros(q.get('max'));
  if (min !== undefined) f.min = min;
  if (max !== undefined) f.max = max;
  f.instock = q.get('instock') === '1';
  const s = q.get('sort') as Sort;
  if (SORTS.includes(s)) f.sort = s;
  return f;
}

export function writeFilters(f: Filters): string {
  const q = new URLSearchParams();
  if (f.collection) q.set('collection', f.collection);
  if (f.glaze.length) q.set('glaze', f.glaze.join(','));
  if (f.min !== undefined) q.set('min', String(f.min));
  if (f.max !== undefined) q.set('max', String(f.max));
  if (f.instock) q.set('instock', '1');
  if (f.sort !== 'featured') q.set('sort', f.sort);
  const s = q.toString();
  return s ? `?${s.replace(/%2C/g, ',')}` : '';
}

export type Listed = Piece & { live: ApiProduct };

/** Pieces that pass the filters, with live price and stock; prices compared in euros. */
export function applyFilters(live: ApiProduct[], f: Filters): Listed[] {
  const list = PIECES.flatMap(p => {
    const l = live.find(x => x.id === p.id);
    return l ? [{ ...p, price: l.price, live: l }] : [];
  }).filter(p => {
    if (f.collection && p.collection !== f.collection) return false;
    if (f.glaze.length && !p.glazes.some(g => f.glaze.includes(g))) return false;
    if (f.min !== undefined && p.price < f.min * 100) return false;
    if (f.max !== undefined && p.price > f.max * 100) return false;
    if (f.instock && !p.glazes.some(g => (p.live.stock[g] ?? 0) > 0)) return false;
    return true;
  });
  if (f.sort === 'price-asc') list.sort((a, b) => a.price - b.price);
  if (f.sort === 'price-desc') list.sort((a, b) => b.price - a.price);
  return list;
}
