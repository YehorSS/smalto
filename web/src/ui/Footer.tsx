import { Link } from 'react-router';
import { photo, useShop } from '../ctx';
import { useCredits } from './hooks';

export function Footer() {
  const { t, lang } = useShop();
  const credits = useCredits();
  return (
    <footer className="foot">
      <img className="foot-photo" src={photo('xilografia')} alt={credits.find(c => c.name === 'xilografia')?.alt[lang] ?? ''} loading="lazy" width={1600} height={1261} />
      <div className="foot-top">
        <nav aria-label="Footer">
          <Link to="/shop">{t('nav.shop')}</Link>
          <Link to="/#how">{t('nav.how')}</Link>
          <Link to="/#faq">{t('nav.questions')}</Link>
          <Link to="/admin">{t('demo.admin')}</Link>
        </nav>
        <address>
          {t('foot.address')}<br />{t('foot.hours')}<br />ciao@smalto.example
        </address>
      </div>
      <div className="foot-bottom">
        <p className="foot-word" aria-hidden="true">smalto</p>
        <p className="foot-legal">{t('demo.note')} · {t('foot.by')} · <a href="https://yehorss.github.io/">{t('foot.portfolio')}</a></p>
        <details className="credits">
          <summary>{t('foot.credits')}</summary>
          <ul>
            {credits.map(c => (
              <li key={c.name}>{c.alt[lang]}: <a href={c.page}>{c.creator}</a>, {c.licenseUrl ? <a href={c.licenseUrl}>{c.license}</a> : c.license}</li>
            ))}
          </ul>
        </details>
      </div>
    </footer>
  );
}
