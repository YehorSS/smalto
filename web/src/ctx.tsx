import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Lang } from '../../shared/catalog';
import { api, type ApiProduct } from './api';
import { useCartState, type CartAction, type Line } from './cart';
import { detectLang, t as translate, money as fmt, type Key } from './i18n';

export type Theme = 'light' | 'dark';

function initialTheme(): Theme {
  try {
    const s = localStorage.getItem('sm-theme');
    if (s === 'light' || s === 'dark') return s;
  } catch { /* storage off */ }
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

interface Shop {
  lang: Lang;
  setLang(l: Lang): void;
  theme: Theme;
  toggleTheme(): void;
  t(key: Key, vars?: Record<string, string | number>): string;
  money(cents: number): string;
  products: ApiProduct[] | null;
  productsError: boolean;
  reload(): void;
  cart: Line[];
  dispatch(a: CartAction): void;
  cartOpen: boolean;
  setCartOpen(v: boolean): void;
}

const ShopCtx = createContext<Shop | null>(null);
export const useShop = () => useContext(ShopCtx)!;

export function ShopProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [products, setProducts] = useState<ApiProduct[] | null>(null);
  const [productsError, setError] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const { lines, dispatch } = useCartState();

  const reload = useCallback(() => {
    setError(false);
    api.products().then(setProducts, () => setError(true));
  }, []);
  useEffect(reload, [reload]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = translate(lang, 'meta.title');
  }, [lang]);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  const value = useMemo<Shop>(() => ({
    lang,
    setLang: l => { setLangState(l); try { localStorage.setItem('sm-lang', l); } catch { /* storage off */ } },
    theme,
    toggleTheme: () => setTheme(cur => {
      const next = cur === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('sm-theme', next); } catch { /* storage off */ }
      return next;
    }),
    t: (key, vars) => translate(lang, key, vars),
    money: cents => fmt(lang, cents),
    products, productsError, reload,
    cart: lines, dispatch, cartOpen, setCartOpen,
  }), [lang, theme, products, productsError, reload, lines, dispatch, cartOpen]);

  return <ShopCtx.Provider value={value}>{children}</ShopCtx.Provider>;
}

export const BASE = import.meta.env.BASE_URL;
export const still = (sku: string, w: 800 | 1600 = 800) => `${BASE}stills/${sku}-${w}.webp`;
export const photo = (name: string, w: 800 | 1600 = 1600) => `${BASE}photos/${name}-${w}.webp`;
