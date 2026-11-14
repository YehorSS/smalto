import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { GLAZES, parseSku } from '../../../shared/catalog';
import { EU, shippingCents, vatIncluded } from '../../../shared/eu';
import { api, ApiError, type Card, type Customer } from '../api';
import { reconcileCart, subtotal, type CartIssue } from '../cart';
import { still, useShop } from '../ctx';
import type { Key } from '../i18n';

type Field = keyof Customer | 'card';
const BLANK: Customer & Card = { name: '', email: '', street: '', city: '', postcode: '', country: 'IT', number: '', expiry: '', cvc: '' };

export function Checkout() {
  const { t, lang, money, cart, dispatch, products, reload } = useShop();
  const nav = useNavigate();
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState<Partial<Record<Field, boolean>>>({});
  const [alert, setAlert] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const live = products ?? [];
  const sub = subtotal(cart, live);
  const ship = shippingCents(form.country, sub);
  const countries = useMemo(() => {
    const names = new Intl.DisplayNames([lang], { type: 'region' });
    return EU.map(c => ({ c, name: names.of(c) ?? c })).sort((a, b) => a.name.localeCompare(b.name, lang));
  }, [lang]);

  const issueText = (i: CartIssue) => {
    const name = parseSku(i.sku)?.piece.name[lang] ?? i.sku;
    if (i.kind === 'gone') return t('cart.gone', { name });
    return i.available ? t('cart.short', { name, n: i.available }) : t('cart.soldout', { name });
  };

  /** Brings the cart in line with fresh stock; true when nothing had to change. */
  const recheck = async () => {
    const fresh = await api.products();
    reload();
    const r = reconcileCart(cart, fresh);
    if (r.issues.length) { dispatch({ type: 'replace', lines: r.lines }); setAlert(r.issues.map(issueText)); }
    return r.issues.length === 0;
  };

  const up = (k: keyof typeof BLANK) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [k]: e.target.value }));
    const field: Field = k === 'number' || k === 'expiry' || k === 'cvc' ? 'card' : k;
    if (errors[field]) setErrors(er => ({ ...er, [field]: false }));
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setAlert([]); setErrors({});
    const website = (new FormData(e.currentTarget).get('website') as string) ?? '';
    try {
      if (!(await recheck())) return;
      const { name, email, street, city, postcode, country, number, expiry, cvc } = form;
      const placed = await api.order({ items: cart, customer: { name, email, street, city, postcode, country }, card: { number, expiry, cvc }, website });
      dispatch({ type: 'clear' });
      reload();
      nav(`/order/${placed.code}`, { state: placed });
    } catch (err) {
      if (!(err instanceof ApiError)) { setAlert([t('co.failed')]); return; }
      if (err.status === 400 && typeof err.extra.field === 'string') {
        const f = err.extra.field as Field | 'items';
        if (f === 'items') { setAlert([t('co.err.items')]); await recheck().catch(() => {}); }
        else { setErrors({ [f]: true }); document.getElementById(f === 'card' ? 'number' : f)?.focus(); }
      } else if (err.status === 402) setAlert([t('co.declined')]);
      else if (err.status === 409) { setAlert([t('co.stock')]); await recheck().catch(() => {}); }
      else if (err.status === 429) setAlert([t('co.busy')]);
      else setAlert([err.status === 0 ? err.message : t('co.failed')]);
    } finally {
      setBusy(false);
    }
  };

  if (!cart.length) {
    return (
      <div className="co">
        <div>
          <h1>{t('co.title')}</h1>
          {alert.map(a => <p key={a} className="alert" role="alert">{a}</p>)}
          <p>{t('co.empty')}</p>
          <p style={{ marginTop: 24 }}><Link to="/shop" className="btn">{t('hero.cta')}</Link></p>
        </div>
      </div>
    );
  }

  const input = (k: keyof typeof BLANK, label: Key, extra: React.InputHTMLAttributes<HTMLInputElement> = {}, full = false) => {
    const field: Field = k === 'number' || k === 'expiry' || k === 'cvc' ? 'card' : k;
    const bad = !!errors[field];
    return (
      <div className={`field ${full ? 'full' : ''}`}>
        <label htmlFor={k}>{t(label)}</label>
        <input id={k} name={k} value={form[k]} onChange={up(k)} required aria-invalid={bad} aria-describedby={bad ? `${field}-err` : undefined} {...extra} />
        {bad && k !== 'expiry' && k !== 'cvc' && <span className="err" id={`${field}-err`}>{t(`co.err.${field}` as Key)}</span>}
      </div>
    );
  };

  return (
    <form className="co" onSubmit={submit} noValidate>
      <div>
        <h1>{t('co.title')}</h1>
        <div aria-live="assertive">{alert.map(a => <p key={a} className="alert" role="alert">{a}</p>)}</div>

        <fieldset>
          <legend>{t('co.contact')}</legend>
          {input('name', 'co.name', { autoComplete: 'name', maxLength: 80 })}
          {input('email', 'co.email', { type: 'email', autoComplete: 'email', maxLength: 120 })}
        </fieldset>

        <fieldset>
          <legend>{t('co.address')}</legend>
          {input('street', 'co.street', { autoComplete: 'street-address', maxLength: 120 }, true)}
          {input('city', 'co.city', { autoComplete: 'address-level2', maxLength: 60 })}
          {input('postcode', 'co.postcode', { autoComplete: 'postal-code', maxLength: 10 })}
          <div className="field full">
            <label htmlFor="country">{t('co.country')}</label>
            <select id="country" value={form.country} onChange={up('country')} autoComplete="country" aria-describedby="eu-only">
              {countries.map(({ c, name }) => <option key={c} value={c}>{name}</option>)}
            </select>
            <span className="muted" id="eu-only" style={{ fontSize: 'var(--step-small)' }}>{t('co.euOnly')}</span>
          </div>
        </fieldset>

        <fieldset>
          <legend>{t('co.payment')}</legend>
          <p className="note test-box">{t('co.testBox')}</p>
          {input('number', 'co.card', { inputMode: 'numeric', autoComplete: 'cc-number', placeholder: '4242 4242 4242 4242', maxLength: 23 }, true)}
          {input('expiry', 'co.expiry', { inputMode: 'numeric', autoComplete: 'cc-exp', placeholder: 'MM/YY', maxLength: 7 })}
          {input('cvc', 'co.cvc', { inputMode: 'numeric', autoComplete: 'cc-csc', placeholder: '123', maxLength: 3 })}
        </fieldset>
        {/* bots fill every field; people never see this one */}
        <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }}>
          <label>Website <input name="website" tabIndex={-1} autoComplete="off" /></label>
        </div>
      </div>

      <aside className="summary" aria-label={t('co.summary')}>
        <h2>{t('co.summary')}</h2>
        <ul className="lines" style={{ padding: 0 }}>
          {cart.map(l => {
            const p = parseSku(l.sku);
            if (!p) return null;
            const price = live.find(x => x.id === p.piece.id)?.price ?? p.piece.price;
            return (
              <li key={l.sku} className="line">
                <img src={still(l.sku)} alt="" width={56} height={56} />
                <div><span className="line-name">{p.piece.name[lang]} × {l.qty}</span><span className="muted">{GLAZES[p.glaze].name[lang]}</span></div>
                <span className="num">{money(price * l.qty)}</span>
              </li>
            );
          })}
        </ul>
        <div className="totals">
          <div><span>{t('cart.sub')}</span><span className="num">{money(sub)}</span></div>
          <div><span>{t('co.shipping')}</span><span className="num">{ship ? money(ship) : t('cart.free')}</span></div>
          <div className="grand"><span>{t('co.total')}</span><span className="num">{money(sub + ship)}</span></div>
          <p className="muted" style={{ fontSize: 'var(--step-small)' }}>{t('co.vat', { amount: money(vatIncluded(sub + ship)) })}</p>
        </div>
        <button type="submit" className="btn btn-block" style={{ marginTop: 20 }} disabled={busy}>
          {busy ? t('co.paying') : t('co.pay', { amount: money(sub + ship) })}
        </button>
      </aside>
    </form>
  );
}
