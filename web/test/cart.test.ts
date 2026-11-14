import { describe, expect, it } from 'vitest';
import { cartReducer, freeShippingLeft, reconcileCart, subtotal, type Line } from '../src/cart';
import type { ApiProduct } from '../src/api';

const products: ApiProduct[] = [
  { id: 'tazza', price: 2800, stock: { latte: 6, turchese: 0, cobalto: 9, miele: 2 } },
  { id: 'mug', price: 3200, stock: { latte: 12, ramina: 4, cobalto: 1 } },
];

describe('cartReducer', () => {
  it('adds and merges the same piece', () => {
    let s: Line[] = [];
    s = cartReducer(s, { type: 'add', sku: 'tazza-latte' });
    s = cartReducer(s, { type: 'add', sku: 'tazza-latte', qty: 2 });
    expect(s).toEqual([{ sku: 'tazza-latte', qty: 3 }]);
  });

  it('keeps a quantity between 1 and 10', () => {
    let s = cartReducer([], { type: 'add', sku: 'mug-latte', qty: 25 });
    expect(s[0].qty).toBe(10);
    s = cartReducer(s, { type: 'set', sku: 'mug-latte', qty: 0 });
    expect(s[0].qty).toBe(1);
    s = cartReducer(s, { type: 'set', sku: 'mug-latte', qty: 4.7 });
    expect(s[0].qty).toBe(4);
  });

  it('holds at most ten different pieces', () => {
    let s: Line[] = Array.from({ length: 10 }, (_, i) => ({ sku: `x-${i}`, qty: 1 }));
    s = cartReducer(s, { type: 'add', sku: 'tazza-latte' });
    expect(s).toHaveLength(10);
    expect(s.find(l => l.sku === 'tazza-latte')).toBeUndefined();
  });

  it('removes and clears', () => {
    const s = cartReducer([{ sku: 'a-b', qty: 1 }, { sku: 'c-d', qty: 2 }], { type: 'remove', sku: 'a-b' });
    expect(s).toEqual([{ sku: 'c-d', qty: 2 }]);
    expect(cartReducer(s, { type: 'clear' })).toEqual([]);
  });
});

describe('reconcileCart', () => {
  it('drops pieces that no longer exist and trims what is short', () => {
    const r = reconcileCart([
      { sku: 'tazza-latte', qty: 2 },
      { sku: 'tazza-oro', qty: 1 },
      { sku: 'brocca-latte', qty: 1 },
      { sku: 'mug-cobalto', qty: 3 },
      { sku: 'tazza-turchese', qty: 1 },
    ], products);
    expect(r.lines).toEqual([{ sku: 'tazza-latte', qty: 2 }, { sku: 'mug-cobalto', qty: 1 }]);
    expect(r.issues).toEqual([
      { sku: 'tazza-oro', kind: 'gone', available: 0 },
      { sku: 'brocca-latte', kind: 'gone', available: 0 },
      { sku: 'mug-cobalto', kind: 'short', available: 1 },
      { sku: 'tazza-turchese', kind: 'short', available: 0 },
    ]);
  });

  it('leaves a healthy cart alone', () => {
    const lines = [{ sku: 'mug-latte', qty: 2 }];
    expect(reconcileCart(lines, products)).toEqual({ lines, issues: [] });
  });
});

describe('money', () => {
  it('adds up the cart from live prices', () => {
    expect(subtotal([{ sku: 'tazza-latte', qty: 2 }, { sku: 'mug-latte', qty: 1 }, { sku: 'gone-x', qty: 1 }], products)).toBe(8800);
  });

  it('says how far free shipping is', () => {
    expect(freeShippingLeft(8800)).toBe(3200);
    expect(freeShippingLeft(12000)).toBe(0);
    expect(freeShippingLeft(15000)).toBe(0);
  });
});
