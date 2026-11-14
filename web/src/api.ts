import type { GlazeId } from '../../shared/catalog';

export const API = import.meta.env.VITE_API ?? (location.hostname === 'localhost' ? 'http://localhost:8787' : 'https://smalto-demo.yehorss.workers.dev');

export interface ApiProduct { id: string; price: number; stock: Partial<Record<GlazeId, number>> }
export interface OrderLine { sku: string; qty: number; unitPrice: number }
export interface Placed { code: string; lines: OrderLine[]; subtotal: number; shipping: number; total: number }
export interface Customer { name: string; email: string; street: string; city: string; postcode: string; country: string }
export interface Card { number: string; expiry: string; cvc: string }
export type Status = 'paid' | 'packed' | 'shipped' | 'cancelled';
export interface AdminOrder extends Customer { code: string; created_at: number; status: Status; subtotal: number; shipping: number; total: number; items: OrderLine[] }
export interface StockRow { sku: string; product_id: string; glaze: GlazeId; qty: number; price: number }
export interface Summary { days: { date: string; orders: number; revenue: number }[]; toPack: number; lowStock: { sku: string; qty: number }[]; top: { product_id: string; qty: number }[] }

/** An error the API explained: its code, message and any extra fields. */
export class ApiError extends Error {
  constructor(readonly status: number, readonly error: string, message: string, readonly extra: Record<string, unknown>) { super(message); }
}

const TOKEN = 'sm-token';
export const token = {
  get: () => { try { return sessionStorage.getItem(TOKEN); } catch { return null; } },
  set: (t: string | null) => { try { if (t) sessionStorage.setItem(TOKEN, t); else sessionStorage.removeItem(TOKEN); } catch { /* private mode */ } },
};

async function call<T>(path: string, init: RequestInit = {}, auth = false): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const t = auth ? token.get() : null;
  if (t) headers.authorization = `Bearer ${t}`;
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, 'network', 'No connection to the shop. Check the internet and try again.', {});
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const { error = 'unknown', message = res.statusText, ...extra } = body as Record<string, unknown>;
    if (res.status === 401 && auth) token.set(null);
    throw new ApiError(res.status, String(error), String(message), extra);
  }
  return body as T;
}

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export const api = {
  products: () => call<ApiProduct[]>('/api/products'),
  order: (b: { items: { sku: string; qty: number }[]; customer: Customer; card: Card; website: string }) => call<Placed>('/api/orders', json('POST', b)),
  login: (login: string, password: string) => call<{ token: string; login: string; role: 'owner' | 'demo' }>('/api/auth/login', json('POST', { login, password })),
  me: () => call<{ login: string; role: 'owner' | 'demo' }>('/api/auth/me', {}, true),
  logout: () => call<void>('/api/auth/logout', { method: 'POST' }, true),
  orders: (q: Record<string, string>) => call<AdminOrder[]>(`/api/admin/orders?${new URLSearchParams(q)}`, {}, true),
  orderOne: (code: string) => call<AdminOrder>(`/api/admin/orders/${encodeURIComponent(code)}`, {}, true),
  setStatus: (code: string, status: Status) => call<{ status: Status }>(`/api/admin/orders/${encodeURIComponent(code)}`, json('PATCH', { status }), true),
  stock: () => call<StockRow[]>('/api/admin/stock', {}, true),
  setStock: (sku: string, qty: number) => call(`/api/admin/stock/${encodeURIComponent(sku)}`, json('PATCH', { qty }), true),
  setPrice: (id: string, price: number) => call(`/api/admin/products/${encodeURIComponent(id)}`, json('PATCH', { price }), true),
  summary: () => call<Summary>('/api/admin/summary?days=7', {}, true),
};
