import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { GLAZES, parseSku } from '../../../shared/catalog';
import { freeShippingLeft, MAX_QTY, subtotal } from '../cart';
import { still, useShop } from '../ctx';

export function CartDrawer() {
  const { t, lang, money, cart, dispatch, cartOpen, setCartOpen, products } = useShop();
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    if (!cartOpen) return;
    opener.current = document.activeElement;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCartOpen(false);
      if (e.key !== 'Tab' || !panel.current) return;
      // keep Tab inside the open drawer
      const f = panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select');
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('locked');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('locked');
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [cartOpen, setCartOpen]);

  const live = products ?? [];
  const sub = subtotal(cart, live);
  const left = freeShippingLeft(sub);

  return (
    <div className={`drawer-wrap ${cartOpen ? 'open' : ''}`} aria-hidden={!cartOpen} inert={!cartOpen}>
      <div className="scrim" onClick={() => setCartOpen(false)} />
      <div className="drawer" role="dialog" aria-modal="true" aria-label={t('cart.title')} tabIndex={-1} ref={panel}>
        <div className="drawer-head">
          <h2 className="h-sm">{t('cart.title')}</h2>
          <button type="button" className="link" onClick={() => setCartOpen(false)}>{t('cart.close')}</button>
        </div>
        {cart.length === 0 ? (
          <p className="drawer-empty">{t('cart.empty')}</p>
        ) : (
          <>
            <ul className="lines">
              {cart.map(l => {
                const p = parseSku(l.sku);
                if (!p) return null;
                const price = live.find(x => x.id === p.piece.id)?.price ?? p.piece.price;
                return (
                  <li key={l.sku} className="line">
                    <img src={still(l.sku)} alt="" width={72} height={72} loading="lazy" />
                    <div>
                      <Link to={`/p/${p.piece.id}?glaze=${p.glaze}`} onClick={() => setCartOpen(false)} className="line-name">{p.piece.name[lang]}</Link>
                      <span className="muted">{GLAZES[p.glaze].name[lang]}</span>
                      <div className="line-ctl">
                        <label className="sr" htmlFor={`q-${l.sku}`}>{t('p.qty')}</label>
                        <select id={`q-${l.sku}`} value={l.qty} onChange={e => dispatch({ type: 'set', sku: l.sku, qty: Number(e.target.value) })}>
                          {Array.from({ length: MAX_QTY }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
                        </select>
                        <button type="button" className="link quiet" onClick={() => dispatch({ type: 'remove', sku: l.sku })}>{t('cart.remove')}</button>
                      </div>
                    </div>
                    <span className="num">{money(price * l.qty)}</span>
                  </li>
                );
              })}
            </ul>
            <div className="drawer-foot">
              <div className="sum-row"><span>{t('cart.sub')}</span><span className="num">{money(sub)}</span></div>
              <p className="muted ship-note">{left ? t('cart.toFree', { amount: money(left) }) : t('cart.free')}</p>
              <div className="ship-bar" aria-hidden="true"><span style={{ transform: `scaleX(${Math.min(1, sub / 12000)})` }} /></div>
              <Link to="/checkout" className="btn btn-block" onClick={() => setCartOpen(false)}>{t('cart.checkout')}</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
