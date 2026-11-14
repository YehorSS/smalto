import { describe, expect, it } from 'vitest';
import { applyFilters, DEFAULT_FILTERS, parseFilters, writeFilters } from '../src/filters';
import type { ApiProduct } from '../src/api';
import { PIECES } from '../../shared/catalog';

describe('filters in the URL', () => {
  it('round-trips every field', () => {
    const f = { collection: 'fuoco' as const, glaze: ['miele' as const, 'ferro' as const], min: 30, max: 90, instock: true, sort: 'price-desc' as const };
    expect(parseFilters(writeFilters(f))).toEqual(f);
  });

  it('writes nothing for the defaults', () => {
    expect(writeFilters(DEFAULT_FILTERS)).toBe('');
    expect(parseFilters('')).toEqual(DEFAULT_FILTERS);
  });

  it('ignores junk', () => {
    expect(parseFilters('?collection=moon&glaze=latte,gold&min=-4&max=abc&instock=maybe&sort=random&x=1'))
      .toEqual({ ...DEFAULT_FILTERS, glaze: ['latte'] });
  });
});

describe('applyFilters', () => {
  const live: ApiProduct[] = PIECES.map(p => ({ id: p.id, price: p.price, stock: Object.fromEntries(p.glazes.map(g => [g, p.id === 'vaso' ? 0 : 3])) }));

  it('narrows by collection, glaze and price', () => {
    const r = applyFilters(live, { ...DEFAULT_FILTERS, collection: 'fiori', glaze: ['cobalto'], max: 50 });
    expect(r.map(p => p.id)).toEqual(['vasetto']);
  });

  it('hides sold-out pieces when asked', () => {
    expect(applyFilters(live, { ...DEFAULT_FILTERS, instock: true }).map(p => p.id)).not.toContain('vaso');
    expect(applyFilters(live, DEFAULT_FILTERS).map(p => p.id)).toContain('vaso');
  });

  it('sorts by live price', () => {
    const asc = applyFilters(live, { ...DEFAULT_FILTERS, sort: 'price-asc' }).map(p => p.price);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
  });
});
