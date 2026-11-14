import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { COLLECTIONS, GLAZES, type Collection, type GlazeId } from '../../../shared/catalog';
import { applyFilters, DEFAULT_FILTERS, parseFilters, writeFilters, type Filters, type Listed, type Sort } from '../filters';
import { still, useShop } from '../ctx';
import { useRise } from '../ui/hooks';

export function Shop() {
  const { t, lang, products, productsError, reload } = useShop();
  const [params, setParams] = useSearchParams();
  const f = parseFilters(params.toString());
  const set = (patch: Partial<Filters>) => setParams(new URLSearchParams(writeFilters({ ...f, ...patch })), { replace: true });
  const list = products ? applyFilters(products, f) : [];
  useRise([products, params.toString()]);

  const toggleGlaze = (g: GlazeId) => set({ glaze: f.glaze.includes(g) ? f.glaze.filter(x => x !== g) : [...f.glaze, g] });
  const euros = (v: string) => (v === '' ? undefined : Math.max(0, Math.min(9999, Math.floor(Number(v)) || 0)));

  return (
    <div className="shop">
      <div className="shop-head">
        <h1>{t('shop.title')}</h1>
        {products && <span className="muted num" aria-live="polite">{t('shop.found', { n: list.length })}</span>}
      </div>

      <form className="filters" aria-label={t('shop.filters')} onSubmit={e => e.preventDefault()}>
        <fieldset>
          <legend>{t('shop.collection')}</legend>
          <button type="button" className="chip" aria-pressed={!f.collection} onClick={() => set({ collection: undefined })}>{t('shop.any')}</button>
          {(Object.keys(COLLECTIONS) as Collection[]).map(c => (
            <button key={c} type="button" className="chip" aria-pressed={f.collection === c} onClick={() => set({ collection: c })}>{COLLECTIONS[c].name[lang]}</button>
          ))}
        </fieldset>
        <fieldset>
          <legend>{t('shop.glaze')}</legend>
          {(Object.keys(GLAZES) as GlazeId[]).map(g => (
            <button key={g} type="button" className="chip" aria-pressed={f.glaze.includes(g)} onClick={() => toggleGlaze(g)}>
              <i style={{ '--c': GLAZES[g].color } as React.CSSProperties} />{GLAZES[g].name[lang]}
            </button>
          ))}
        </fieldset>
        <fieldset>
          <legend>{t('shop.price')}</legend>
          <label className="sr" htmlFor="pmin">{t('shop.min')}</label>
          <input id="pmin" className="price-in" inputMode="numeric" placeholder={t('shop.min')} defaultValue={f.min ?? ''} key={`min${f.min}`}
            onBlur={e => set({ min: euros(e.target.value) })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
          <span aria-hidden="true">–</span>
          <label className="sr" htmlFor="pmax">{t('shop.max')}</label>
          <input id="pmax" className="price-in" inputMode="numeric" placeholder={t('shop.max')} defaultValue={f.max ?? ''} key={`max${f.max}`}
            onBlur={e => set({ max: euros(e.target.value) })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
        </fieldset>
        <label className="check"><input type="checkbox" checked={f.instock} onChange={e => set({ instock: e.target.checked })} />{t('shop.instock')}</label>
        <div className="field">
          <label htmlFor="sort" className="lbl">{t('shop.sort')}</label>
          <select id="sort" value={f.sort} onChange={e => set({ sort: e.target.value as Sort })}>
            <option value="featured">{t('shop.featured')}</option>
            <option value="price-asc">{t('shop.priceAsc')}</option>
            <option value="price-desc">{t('shop.priceDesc')}</option>
          </select>
        </div>
      </form>

      {productsError && (
        <div className="empty note"><span>{t('shop.offline')}</span><button type="button" className="btn btn-small" onClick={reload}>{t('shop.retry')}</button></div>
      )}
      {!products && !productsError && <p className="muted">{t('shop.loading')}</p>}
      {products && list.length === 0 && (
        <div className="empty"><span>{t('shop.none')}</span><button type="button" className="btn btn-ghost btn-small" onClick={() => setParams(new URLSearchParams(writeFilters(DEFAULT_FILTERS)))}>{t('shop.reset')}</button></div>
      )}

      <div className="grid">
        {list.map(p => <Card key={p.id} p={p} prefer={f.glaze} />)}
      </div>
    </div>
  );
}

export function Card({ p, prefer = [] }: { p: Listed; prefer?: GlazeId[] }) {
  const { t, lang, money } = useShop();
  const inStock = (g: GlazeId) => (p.live.stock[g] ?? 0) > 0;
  const first = p.glazes.find(g => prefer.includes(g) && inStock(g)) ?? p.glazes.find(inStock) ?? p.glazes[0];
  const [glaze, setGlaze] = useState<GlazeId>(first);
  const allGone = !p.glazes.some(inStock);
  return (
    <article className="rise">
      <Link to={`/p/${p.id}?glaze=${glaze}`} className="item">
        <div className="item-pic">
          {p.glazes.map(g => (
            <img key={g} src={still(`${p.id}-${g}`)} alt={g === glaze ? `${p.name[lang]}, ${GLAZES[g].name[lang]}` : ''} loading="lazy" width={800} height={800}
              style={{ opacity: g === glaze ? 1 : 0 }} />
          ))}
          {allGone && <span className="item-tag">{t('shop.soldout')}</span>}
        </div>
        <div className="item-row"><span>{p.name[lang]}</span><span className="num">{money(p.price)}</span></div>
      </Link>
      <div className="item-sub">
        <span>{GLAZES[glaze].name[lang]}{inStock(glaze) ? '' : ` · ${t('shop.soldout')}`}</span>
        <div className="dots-row" role="group" aria-label={t('p.glaze')}>
          {p.glazes.map(g => (
            <button key={g} type="button" style={{ '--c': GLAZES[g].color } as React.CSSProperties} aria-pressed={g === glaze}
              aria-label={GLAZES[g].name[lang]} onMouseEnter={() => setGlaze(g)} onFocus={() => setGlaze(g)} onClick={() => setGlaze(g)} />
          ))}
        </div>
      </div>
    </article>
  );
}
