import { Link, useLocation } from 'react-router';
import { useShop } from '../ctx';

export function Header() {
  const { t, lang, setLang, theme, toggleTheme, cart, setCartOpen } = useShop();
  const home = useLocation().pathname === '/';
  const count = cart.reduce((s, l) => s + l.qty, 0);
  const sec = (id: string) => (home ? `#${id}` : `/#${id}`);
  return (
    <header className={`top ${home ? 'top-home' : ''}`}>
      {!home && <Link to="/" className="mark" aria-label={t('nav.home')}>smalto</Link>}
      <nav aria-label="Main">
        <Link to="/shop">{t('nav.shop')}</Link>
        <Link to={sec('collections')} className="wide-only">{t('nav.collections')}</Link>
        <Link to={sec('how')} className="wide-only">{t('nav.how')}</Link>
        <Link to={sec('faq')} className="wide-only">{t('nav.questions')}</Link>
        <button type="button" className="link quiet" onClick={() => setLang(lang === 'en' ? 'it' : 'en')} lang={lang === 'en' ? 'it' : 'en'}>{t('nav.lang')}</button>
        <button type="button" className="link quiet" onClick={toggleTheme} aria-pressed={theme === 'dark'}>{theme === 'dark' ? t('nav.themeLight') : t('nav.themeDark')}</button>
        <button type="button" className="btn btn-small" onClick={() => setCartOpen(true)} aria-haspopup="dialog">{t('nav.cart', { n: count })}</button>
      </nav>
    </header>
  );
}
