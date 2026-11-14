import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useNavigate, useParams } from 'react-router';
import { PIECES } from '../../../shared/catalog';
import { api, ApiError, token, type AdminOrder, type Status, type StockRow, type Summary } from '../api';
import { useShop } from '../ctx';
import { dateTime } from '../i18n';
import { bars, nextActions, skuLabel } from './logic';
import './admin.css';

type Me = { login: string; role: 'owner' | 'demo' };

export default function Admin() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  useEffect(() => {
    if (!token.get()) { setMe(null); return; }
    api.me().then(setMe, () => setMe(null));
  }, []);
  if (me === undefined) return <div className="ad-wrap" />;
  if (!me) return <Login onIn={setMe} />;
  return <Shell me={me} onOut={() => setMe(null)} />;
}

function Login({ onIn }: { onIn(m: Me): void }) {
  const { t } = useShop();
  const [login, setLogin] = useState('demo');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const r = await api.login(login, password);
      token.set(r.token);
      onIn({ login: r.login, role: r.role });
    } catch (x) {
      setErr(x instanceof ApiError && x.status === 429 ? t('ad.tooMany') : x instanceof ApiError && x.status === 0 ? x.message : t('ad.wrong'));
    } finally { setBusy(false); }
  };
  return (
    <div className="ad-login">
      <form onSubmit={submit} className="ad-card">
        <h1 className="h-md">{t('ad.title')}</h1>
        <p className="note">{t('ad.hint')}</p>
        <div className="field"><label htmlFor="login">{t('ad.login')}</label><input id="login" value={login} onChange={e => setLogin(e.target.value)} autoComplete="username" required /></div>
        <div className="field"><label htmlFor="password">{t('ad.password')}</label><input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required autoFocus /></div>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn btn-block" disabled={busy}>{t('ad.signin')}</button>
        <Link to="/" className="muted">{t('ad.toShop')}</Link>
      </form>
    </div>
  );
}

function Shell({ me, onOut }: { me: Me; onOut(): void }) {
  const { t, lang, setLang, theme, toggleTheme } = useShop();
  const out = async () => { await api.logout().catch(() => {}); token.set(null); onOut(); };
  return (
    <div className="ad-wrap">
      <header className="ad-top">
        <Link to="/admin" className="mark">smalto <span className="muted">admin</span></Link>
        <nav aria-label="Admin">
          <NavLink to="/admin" end>{t('ad.overview')}</NavLink>
          <NavLink to="/admin/orders">{t('ad.orders')}</NavLink>
          <NavLink to="/admin/stock">{t('ad.stock')}</NavLink>
        </nav>
        <div className="ad-tools">
          <span className="muted">{me.login}</span>
          <button type="button" className="link quiet" onClick={() => setLang(lang === 'en' ? 'it' : 'en')}>{t('nav.lang')}</button>
          <button type="button" className="link quiet" onClick={toggleTheme}>{theme === 'dark' ? t('nav.themeLight') : t('nav.themeDark')}</button>
          <Link to="/">{t('ad.toShop')}</Link>
          <button type="button" className="btn btn-small btn-ghost" onClick={out}>{t('ad.signout')}</button>
        </div>
      </header>
      <main className="ad-main" id="main">
        <Routes>
          <Route index element={<Overview onOut={onOut} />} />
          <Route path="orders" element={<Orders onOut={onOut} />} />
          <Route path="orders/:code" element={<OrderDetail onOut={onOut} />} />
          <Route path="stock" element={<Stock me={me} onOut={onOut} />} />
        </Routes>
        <p className="muted ad-foot">{t('ad.reset')}</p>
      </main>
    </div>
  );
}

/** Loads with the token; a 401 sends the user back to the login. */
function useLoad<T>(load: () => Promise<T>, onOut: () => void, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const run = useCallback(() => {
    setError('');
    load().then(setData, (e: unknown) => {
      if (e instanceof ApiError && e.status === 401) onOut();
      else setError(e instanceof Error ? e.message : String(e));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(run, [run]);
  return { data, error, reload: run, setData };
}

function StatusTag({ s }: { s: Status }) {
  const { t } = useShop();
  return <span className={`tag tag-${s}`}>{t(`ad.st.${s}`)}</span>;
}

function Overview({ onOut }: { onOut(): void }) {
  const { t, lang, money } = useShop();
  const { data, error } = useLoad<Summary>(api.summary, onOut, []);
  if (error) return <p className="alert">{error}</p>;
  if (!data) return <p className="muted">…</p>;
  const week = data.days.reduce((s, d) => ({ orders: s.orders + d.orders, revenue: s.revenue + d.revenue }), { orders: 0, revenue: 0 });
  const day = new Intl.DateTimeFormat(lang === 'it' ? 'it-IT' : 'en-IE', { weekday: 'short', timeZone: 'UTC' });
  return (
    <div className="ad-grid">
      <section className="ad-card wide">
        <div className="ad-head"><h2>{t('ad.week')}</h2>
          <dl className="kpis"><div><dt>{t('ad.revenue')}</dt><dd className="num">{money(week.revenue)}</dd></div><div><dt>{t('ad.ordersN')}</dt><dd className="num">{week.orders}</dd></div></dl>
        </div>
        <svg className="chart" viewBox="0 0 700 220" role="img" aria-label={data.days.map(d => `${d.date}: ${money(d.revenue)}, ${d.orders}`).join('; ')}>
          {bars(data.days).map((b, i) => {
            const h = Math.max(2, b.h * 160), x = 20 + i * 96;
            return (
              <g key={b.date}>
                <rect x={x} y={180 - h} width={64} height={h} className="bar" />
                <text x={x + 32} y={172 - h} textAnchor="middle" className="bar-val">{b.revenue ? money(b.revenue) : ''}</text>
                <text x={x + 32} y={204} textAnchor="middle" className="bar-day">{day.format(new Date(`${b.date}T12:00:00Z`))}</text>
              </g>
            );
          })}
        </svg>
      </section>
      <section className="ad-card">
        <h2>{t('ad.toPack')}</h2>
        <p className="big num">{data.toPack}</p>
        <Link to="/admin/orders?status=paid">{t('ad.orders')} →</Link>
      </section>
      <section className="ad-card">
        <h2>{t('ad.low')}</h2>
        {data.lowStock.length ? <ul className="plain">{data.lowStock.slice(0, 8).map(s => <li key={s.sku}><span>{skuLabel(s.sku, lang)}</span><span className={`num ${s.qty ? '' : 'zero'}`}>{s.qty}</span></li>)}</ul> : <p className="muted">{t('ad.none')}</p>}
      </section>
      <section className="ad-card">
        <h2>{t('ad.top')}</h2>
        {data.top.length ? <ol className="plain">{data.top.map(p => <li key={p.product_id}><span>{PIECES.find(x => x.id === p.product_id)?.name[lang] ?? p.product_id}</span><span className="num">{p.qty}</span></li>)}</ol> : <p className="muted">{t('ad.none')}</p>}
      </section>
    </div>
  );
}

function Orders({ onOut }: { onOut(): void }) {
  const { t, lang, money } = useShop();
  const nav = useNavigate();
  const initial = new URLSearchParams(location.search).get('status') ?? '';
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(initial);
  const [query, setQuery] = useState({ q: '', status: initial });
  useEffect(() => { const id = setTimeout(() => setQuery({ q, status }), 250); return () => clearTimeout(id); }, [q, status]);
  const { data, error } = useLoad<AdminOrder[]>(() => api.orders(query), onOut, [query.q, query.status]);
  return (
    <section className="ad-card wide">
      <div className="ad-head">
        <h2>{t('ad.orders')}</h2>
        <div className="ad-filters">
          <label className="sr" htmlFor="q">{t('ad.search')}</label>
          <input id="q" type="search" placeholder={t('ad.search')} value={q} onChange={e => setQ(e.target.value)} />
          <label className="sr" htmlFor="st">{t('ad.all')}</label>
          <select id="st" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">{t('ad.all')}</option>
            {(['paid', 'packed', 'shipped', 'cancelled'] as Status[]).map(s => <option key={s} value={s}>{t(`ad.st.${s}`)}</option>)}
          </select>
        </div>
      </div>
      {error && <p className="alert">{error}</p>}
      {data && !data.length && <p className="muted">{t('ad.none')}</p>}
      {data && data.length > 0 && (
        <div className="table-scroll">
          <table className="ad-table">
            <thead><tr><th>{t('ad.date')}</th><th>#</th><th>{t('ad.customer')}</th><th>{t('ad.items')}</th><th className="r">{t('ad.total')}</th><th /></tr></thead>
            <tbody>
              {data.map(o => (
                <tr key={o.code} onClick={() => nav(`/admin/orders/${o.code}`)}>
                  <td className="num">{dateTime(lang, o.created_at)}</td>
                  <td><Link to={`/admin/orders/${o.code}`} onClick={e => e.stopPropagation()}>{o.code}</Link></td>
                  <td>{o.name}<span className="muted sub">{o.city}, {o.country}</span></td>
                  <td className="num">{o.items.reduce((s, l) => s + l.qty, 0)}</td>
                  <td className="num r">{money(o.total)}</td>
                  <td><StatusTag s={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function OrderDetail({ onOut }: { onOut(): void }) {
  const { code = '' } = useParams();
  const { t, lang, money } = useShop();
  const { data: o, error, reload, setData } = useLoad<AdminOrder>(() => api.orderOne(code), onOut, [code]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const act = async (s: Status) => {
    setBusy(true); setNote('');
    try {
      await api.setStatus(code, s);
      setData(prev => (prev ? { ...prev, status: s } : prev));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onOut();
      else { setNote(t('ad.changed')); reload(); }
    } finally { setBusy(false); }
  };
  if (error) return <section className="ad-card wide"><p className="alert">{error}</p><Link to="/admin/orders">← {t('ad.back')}</Link></section>;
  if (!o) return <p className="muted">…</p>;
  return (
    <section className="ad-card wide">
      <Link to="/admin/orders">← {t('ad.back')}</Link>
      <div className="ad-head" style={{ marginTop: 16 }}>
        <h2 className="h-md">{o.code}</h2>
        <StatusTag s={o.status} />
      </div>
      <p className="muted">{dateTime(lang, o.created_at)}</p>
      {note && <p className="alert" role="status">{note}</p>}
      <div className="detail">
        <div>
          <h3>{t('ad.items')}</h3>
          <ul className="plain">
            {o.items.map(l => <li key={l.sku}><span>{skuLabel(l.sku, lang)} × {l.qty}</span><span className="num">{money(l.qty * l.unitPrice)}</span></li>)}
            <li><span>{t('co.shipping')}</span><span className="num">{o.shipping ? money(o.shipping) : t('cart.free')}</span></li>
            <li className="strong"><span>{t('ad.total')}</span><span className="num">{money(o.total)}</span></li>
          </ul>
        </div>
        <div>
          <h3>{t('ad.shipTo')}</h3>
          <address>{o.name}<br />{o.street}<br />{o.postcode} {o.city}, {o.country}<br /><a href={`mailto:${o.email}`}>{o.email}</a></address>
        </div>
      </div>
      <div className="actions">
        {nextActions(o.status).map(s => (
          <button key={s} type="button" className={`btn ${s === 'cancelled' ? 'btn-ghost' : ''}`} disabled={busy} onClick={() => act(s)}>{t(`ad.do.${s}` as 'ad.do.packed')}</button>
        ))}
      </div>
    </section>
  );
}

function Stock({ me, onOut }: { me: Me; onOut(): void }) {
  const { t, lang, money } = useShop();
  const { data, error, setData } = useLoad<StockRow[]>(api.stock, onOut, []);
  const [msg, setMsg] = useState<Record<string, string>>({});
  const saveQty = async (sku: string, raw: string) => {
    const qty = Number(raw);
    const row = data?.find(r => r.sku === sku);
    if (!row || qty === row.qty) return;
    if (!Number.isInteger(qty) || qty < 0 || qty > 999) { setMsg(m => ({ ...m, [sku]: t('ad.badQty') })); return; }
    try {
      await api.setStock(sku, qty);
      setData(d => d?.map(r => (r.sku === sku ? { ...r, qty } : r)) ?? d);
      setMsg(m => ({ ...m, [sku]: t('ad.saved') }));
    } catch (e) { if (e instanceof ApiError && e.status === 401) onOut(); else setMsg(m => ({ ...m, [sku]: e instanceof Error ? e.message : '' })); }
  };
  const savePrice = async (id: string, raw: string) => {
    const price = Math.round(Number(raw.replace(',', '.')) * 100);
    try {
      await api.setPrice(id, price);
      setData(d => d?.map(r => (r.product_id === id ? { ...r, price } : r)) ?? d);
      setMsg(m => ({ ...m, [id]: t('ad.saved') }));
    } catch (e) { if (e instanceof ApiError && e.status === 401) onOut(); else setMsg(m => ({ ...m, [id]: e instanceof Error ? e.message : '' })); }
  };
  if (error) return <p className="alert">{error}</p>;
  if (!data) return <p className="muted">…</p>;
  const pieces = [...new Set(data.map(r => r.product_id))];
  return (
    <section className="ad-card wide">
      <div className="ad-head"><h2>{t('ad.stock')}</h2>{me.role !== 'owner' && <span className="muted">{t('ad.ownerOnly')}</span>}</div>
      <div className="table-scroll">
        <table className="ad-table stock">
          <thead><tr><th>{t('ad.piece')}</th><th className="r">{t('ad.price')}</th><th>{t('p.glaze')}</th><th className="r">{t('ad.qty')}</th><th /></tr></thead>
          <tbody>
            {pieces.map(id => data.filter(r => r.product_id === id).map((r, i, rows) => (
              <tr key={r.sku} className={i === 0 ? 'first' : ''}>
                {i === 0 && <th scope="rowgroup" rowSpan={rows.length}>{skuLabel(r.sku, lang).split(' · ')[0]}</th>}
                {i === 0 && (
                  <td rowSpan={rows.length} className="r">
                    {me.role === 'owner' ? (
                      <input className="qty-in price" aria-label={`${t('ad.price')}, ${id}`} defaultValue={(r.price / 100).toFixed(2)} inputMode="decimal"
                        onBlur={e => savePrice(id, e.target.value)} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
                    ) : <span className="num">{money(r.price)}</span>}
                    {msg[id] && <span className="muted sub">{msg[id]}</span>}
                  </td>
                )}
                <td>{skuLabel(r.sku, lang).split(' · ')[1]}</td>
                <td className="r">
                  <input className={`qty-in ${r.qty === 0 ? 'zero' : ''}`} aria-label={`${t('ad.qty')}, ${skuLabel(r.sku, lang)}`} defaultValue={r.qty} inputMode="numeric"
                    onBlur={e => saveQty(r.sku, e.target.value)} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
                </td>
                <td className="muted sub-cell" aria-live="polite">{msg[r.sku]}</td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
