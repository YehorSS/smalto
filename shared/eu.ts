export const EU = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];

export const FREE_FROM = 12000;
export const VAT = 0.22;

/** Shipping in cents for an EU country and a subtotal in cents. */
export function shippingCents(country: string, subtotal: number): number {
  if (subtotal >= FREE_FROM) return 0;
  return country === 'IT' ? 800 : 1500;
}

/** VAT already inside a VAT-included amount. */
export const vatIncluded = (total: number) => Math.round(total - total / (1 + VAT));
