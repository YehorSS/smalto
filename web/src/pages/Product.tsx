import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { COLLECTIONS, GLAZES, PIECES, sku, type GlazeId } from '../../../shared/catalog';
import { MAX_QTY } from '../cart';
import { still, useShop } from '../ctx';
import { Viewer } from '../three/Viewer';
import { useRise } from '../ui/hooks';

export default function Product() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const { t, lang, money, products, dispatch, setCartOpen, cart } = useShop();
  const piece = PIECES.find(p => p.id === id);
  const live = products?.find(p => p.id === id);
  const asked = params.get('glaze') as GlazeId;
  const glaze: GlazeId = piece?.glazes.includes(asked) ? asked : (piece?.glazes.find(g => (live?.stock[g] ?? 1) > 0) ?? piece?.glazes[0] ?? 'latte');
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  useRise([id]);

  if (!piece) {
    return <div className="shop"><p>{t('p.notFound')}</p><p style={{ marginTop: 16 }}><Link to="/shop">{t('p.back')}</Link></p></div>;
  }
  const stock = live?.stock[glaze];
  const inCart = cart.find(l => l.sku === sku(piece.id, glaze))?.qty ?? 0;
  // before stock arrives, allow adding; checkout checks it against the server anyway
  const canAdd = Math.min(MAX_QTY, stock ?? (products ? 0 : MAX_QTY)) - inCart;
  const price = live?.price ?? piece.price;
  const related = PIECES.filter(p => p.collection === piece.collection && p.id !== piece.id);
  const label = `${piece.name[lang]}, ${GLAZES[glaze].name[lang]}`;

  const pick = (g: GlazeId) => { setParams({ glaze: g }, { replace: true }); setQty(1); setAdded(false); };
  const add = () => {
    dispatch({ type: 'add', sku: sku(piece.id, glaze), qty });
    setAdded(true);
    setCartOpen(true);
  };

  return (
    <div className="split prod">
      <div className="stage">
        <div className="stage-frame">
          <Viewer piece={piece} glaze={glaze} label={label} />
          <span className="viewer-hint" aria-hidden="true">{t('p.drag')}</span>
        </div>
      </div>
      <div className="col">
        <section className="prod-head">
          <p className="muted"><Link to={`/shop?collection=${piece.collection}`}>{COLLECTIONS[piece.collection].name[lang]}</Link></p>
          <h1>{piece.name[lang]}</h1>
          <p className="prod-price num">{money(price)}</p>
          <p className="prod-blurb">{piece.blurb[lang]}</p>

          <fieldset className="glaze-pick">
            <legend>{t('p.glaze')}</legend>
            <div className="tiles" style={{ marginTop: 0 }}>
              {piece.glazes.map(g => (
                <button key={g} type="button" className="tile" style={{ '--c': GLAZES[g].color } as React.CSSProperties} aria-pressed={g === glaze}
                  onClick={() => pick(g)} title={GLAZES[g].name[lang]}>
                  <span className="sr">{GLAZES[g].name[lang]}{live?.stock[g] === 0 ? `, ${t('shop.soldout')}` : ''}</span>
                </button>
              ))}
            </div>
            <p className="glaze-name">{GLAZES[glaze].name[lang]}</p>
            <p className="glaze-note">{GLAZES[glaze].note[lang]}</p>
            <p className={`stock ${stock !== undefined && stock > 0 && stock <= 3 ? 'low' : ''}`} aria-live="polite">
              {stock === undefined ? ' ' : stock === 0 ? t('p.soldout') : stock <= 3 ? t('p.left', { n: stock }) : t('p.inStock')}
            </p>
          </fieldset>

          <div className="buy">
            <label className="sr" htmlFor="qty">{t('p.qty')}</label>
            <select id="qty" value={qty} onChange={e => setQty(Number(e.target.value))} disabled={canAdd <= 0}>
              {Array.from({ length: Math.max(1, canAdd) }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
            </select>
            <button type="button" className="btn" onClick={add} disabled={canAdd <= 0}>{added ? t('p.added') : t('p.add')}</button>
          </div>
        </section>

        <section className="rise">
          <dl className="specs">
            <dt>{t('p.size')}</dt><dd>{t('p.sizeV', { h: piece.size.h, d: piece.size.d })}</dd>
            {piece.capacityMl && <><dt>{t('p.capacity')}</dt><dd>{t('p.capacityV', { ml: piece.capacityMl })}</dd></>}
            <dt>{t('p.care')}</dt><dd>{piece.care === 'dishwasher' ? t('p.dishwasher') : t('p.hand')}</dd>
          </dl>
          <p className="muted" style={{ marginTop: 20, fontSize: 'var(--step-small)' }}>{t('p.vary')}</p>
        </section>

        <section className="rise">
          <h2 className="h-sm">{t('p.related', { name: COLLECTIONS[piece.collection].name[lang] })}</h2>
          <div className="related">
            {related.map(r => (
              <Link key={r.id} to={`/p/${r.id}`} className="item">
                <div className="item-pic"><img src={still(`${r.id}-${r.glazes[0]}`)} alt="" loading="lazy" width={800} height={800} /></div>
                <div className="item-row"><span>{r.name[lang]}</span><span className="num">{money(products?.find(p => p.id === r.id)?.price ?? r.price)}</span></div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
