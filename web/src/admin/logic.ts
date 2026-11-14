import { GLAZES, parseSku, type Lang } from '../../../shared/catalog';
import type { Status, Summary } from '../api';

const NEXT: Record<Status, Status[]> = { paid: ['packed', 'cancelled'], packed: ['shipped', 'cancelled'], shipped: [], cancelled: [] };
export const nextActions = (s: Status): Status[] => NEXT[s];

/** Bar heights 0..1 against the best day. */
export function bars(days: Summary['days']) {
  const top = Math.max(0, ...days.map(d => d.revenue));
  return days.map(d => ({ ...d, h: top ? d.revenue / top : 0 }));
}

export function skuLabel(sku: string, lang: Lang): string {
  const p = parseSku(sku);
  return p ? `${p.piece.name[lang]} · ${GLAZES[p.glaze].name[lang]}` : sku;
}
