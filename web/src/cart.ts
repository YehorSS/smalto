import { useEffect, useReducer } from 'react';
import { parseSku } from '../../shared/catalog';
import { FREE_FROM } from '../../shared/eu';
import type { ApiProduct } from './api';

export interface Line { sku: string; qty: number }
export type CartAction =
  | { type: 'add'; sku: string; qty?: number }
  | { type: 'set'; sku: string; qty: number }
  | { type: 'remove'; sku: string }
  | { type: 'replace'; lines: Line[] }
  | { type: 'clear' };

export const MAX_QTY = 10, MAX_LINES = 10;
const clamp = (q: number) => Math.min(MAX_QTY, Math.max(1, Math.floor(q) || 1));

export function cartReducer(state: Line[], a: CartAction): Line[] {
  switch (a.type) {
    case 'add': {
      const have = state.find(l => l.sku === a.sku);
      if (have) return state.map(l => (l.sku === a.sku ? { ...l, qty: clamp(l.qty + (a.qty ?? 1)) } : l));
      if (state.length >= MAX_LINES) return state;
      return [...state, { sku: a.sku, qty: clamp(a.qty ?? 1) }];
    }
    case 'set': return state.map(l => (l.sku === a.sku ? { ...l, qty: clamp(a.qty) } : l));
    case 'remove': return state.filter(l => l.sku !== a.sku);
    case 'replace': return a.lines;
    case 'clear': return [];
  }
}

export interface CartIssue { sku: string; kind: 'gone' | 'short'; available: number }

const available = (sku: string, products: ApiProduct[]): number | null => {
  const parsed = parseSku(sku);
  const live = parsed && products.find(p => p.id === parsed.piece.id);
  const n = live?.stock[parsed!.glaze];
  return typeof n === 'number' ? n : null;
};

/** Holds the cart against live stock: unknown pieces go, short ones shrink to what is left. */
export function reconcileCart(lines: Line[], products: ApiProduct[]): { lines: Line[]; issues: CartIssue[] } {
  const out: Line[] = [], issues: CartIssue[] = [];
  for (const l of lines) {
    const n = available(l.sku, products);
    if (n === null) { issues.push({ sku: l.sku, kind: 'gone', available: 0 }); continue; }
    if (n < l.qty) {
      issues.push({ sku: l.sku, kind: 'short', available: n });
      if (n > 0) out.push({ sku: l.sku, qty: n });
      continue;
    }
    out.push(l);
  }
  return { lines: issues.length ? out : lines, issues };
}

export function subtotal(lines: Line[], products: ApiProduct[]): number {
  return lines.reduce((s, l) => {
    const p = parseSku(l.sku);
    const live = p && products.find(x => x.id === p.piece.id);
    return s + (live ? live.price * l.qty : 0);
  }, 0);
}

export const freeShippingLeft = (sub: number) => Math.max(0, FREE_FROM - sub);

const KEY = 'sm-cart';
function load(): Line[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter(l => typeof l?.sku === 'string' && Number.isInteger(l?.qty)).slice(0, MAX_LINES) : [];
  } catch { return []; }
}

export function useCartState() {
  const [lines, dispatch] = useReducer(cartReducer, undefined, load);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch { /* storage off */ } }, [lines]);
  return { lines, dispatch };
}
