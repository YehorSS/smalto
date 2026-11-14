import { describe, expect, it } from 'vitest';
import { DICT, t } from '../src/i18n';

const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();

describe('i18n', () => {
  it('has the same keys in English and Italian', () => {
    expect(Object.keys(DICT.it).sort()).toEqual(Object.keys(DICT.en).sort());
  });

  it('has the same placeholders in both', () => {
    for (const k of Object.keys(DICT.en) as (keyof typeof DICT.en)[]) expect(holes(DICT.it[k]), k).toEqual(holes(DICT.en[k]));
  });

  it('fills placeholders', () => {
    expect(t('en', 'cart.toFree', { amount: '€32' })).toContain('€32');
  });
});
