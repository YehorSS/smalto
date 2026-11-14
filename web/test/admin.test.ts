import { describe, expect, it } from 'vitest';
import { bars, nextActions, skuLabel } from '../src/admin/logic';

describe('admin helpers', () => {
  it('offers only the moves the server allows', () => {
    expect(nextActions('paid')).toEqual(['packed', 'cancelled']);
    expect(nextActions('packed')).toEqual(['shipped', 'cancelled']);
    expect(nextActions('shipped')).toEqual([]);
    expect(nextActions('cancelled')).toEqual([]);
  });

  it('scales bars to the busiest day and keeps empty days visible', () => {
    const b = bars([{ date: '2026-11-08', orders: 0, revenue: 0 }, { date: '2026-11-09', orders: 2, revenue: 5000 }, { date: '2026-11-10', orders: 4, revenue: 10000 }]);
    expect(b.map(x => x.h)).toEqual([0, 0.5, 1]);
  });

  it('copes with a week without orders', () => {
    expect(bars([{ date: '2026-11-08', orders: 0, revenue: 0 }]).map(x => x.h)).toEqual([0]);
  });

  it('names a sku in the reader language', () => {
    expect(skuLabel('tazza-turchese', 'it')).toBe('Tazza · Turchese');
    expect(skuLabel('nope-x', 'en')).toBe('nope-x');
  });
});
