import { Link, useLocation, useParams } from 'react-router';
import { GLAZES, parseSku } from '../../../shared/catalog';
import type { Placed } from '../api';
import { useShop } from '../ctx';

export function Order() {
  const { code } = useParams();
  const placed = useLocation().state as Placed | null;
  const { t, lang, money } = useShop();
  return (
    <div className="ok">
      <h1>{t('ok.title')}</h1>
      <p className="code">{t('ok.code', { code: code ?? '' })}</p>
      {placed ? (
        <>
          <p>{t('ok.next')}</p>
          <ul className="lines" style={{ padding: 0, marginTop: 28 }}>
            {placed.lines.map(l => {
              const p = parseSku(l.sku);
              return (
                <li key={l.sku} className="line" style={{ gridTemplateColumns: '1fr auto' }}>
                  <span>{p ? `${p.piece.name[lang]}, ${GLAZES[p.glaze].name[lang]}` : l.sku} × {l.qty}</span>
                  <span className="num">{money(l.qty * l.unitPrice)}</span>
                </li>
              );
            })}
          </ul>
          <div className="totals" style={{ maxWidth: 360, marginLeft: 'auto' }}>
            <div><span>{t('co.shipping')}</span><span className="num">{placed.shipping ? money(placed.shipping) : t('cart.free')}</span></div>
            <div className="grand"><span>{t('co.total')}</span><span className="num">{money(placed.total)}</span></div>
          </div>
        </>
      ) : <p>{t('ok.lost')}</p>}
      <div className="ok-act">
        <Link to={`/admin/orders/${code}`} className="btn">{t('ok.admin')}</Link>
        <span className="muted">{t('ok.adminHint')}</span>
        <Link to="/shop">{t('ok.more')}</Link>
      </div>
    </div>
  );
}
