import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { COLLECTIONS, GLAZES, PIECES, type Collection, type GlazeId } from '../../../shared/catalog';
import { BASE, photo, still, useShop } from '../ctx';
import { useActiveSection, useCredits, useRise } from '../ui/hooks';

const SECTIONS = ['top', 'collections', 'letter', 'how', 'faenza', 'faq'];
const LEAD: Record<Collection, string> = { tavola: 'tazza', fiori: 'vasetto', fuoco: 'chawan' };
const CUP = PIECES.find(p => p.id === 'tazza')!;
const GALLERY: (string | [string, string])[] = ['brocca', ['albarello', 'crespina'], 'giardino', ['bianco', 'tornio']];
const SHAPE = ['tall', 'pair', 'wide', 'pair'];
const STAGE_PHOTO: Record<string, string> = { letter: 'mazzini', how: 'forno', faenza: 'mic', faq: 'piazza' };

export function Home() {
  const { t, lang, money, products } = useShop();
  const credits = useCredits();
  const alt = (name: string) => credits.find(c => c.name === name)?.alt[lang] ?? '';
  const active = useActiveSection(SECTIONS);
  const [picked, setCupGlaze] = useState<GlazeId | null>(null);
  const [tab, setTab] = useState<Collection>('tavola');
  useRise();

  const inCollection = PIECES.filter(p => p.collection === tab);
  const lead = PIECES.find(p => p.id === LEAD[tab])!;
  const priceOf = (id: string) => products?.find(p => p.id === id)?.price ?? PIECES.find(p => p.id === id)!.price;
  const cupStock = products?.find(p => p.id === 'tazza')?.stock;
  const soldOut = (g: GlazeId) => cupStock?.[g] === 0;
  // open on a coloured glaze that is in stock
  const cupGlaze: GlazeId = picked ?? (['turchese', 'cobalto', 'miele', 'latte'] as GlazeId[]).find(g => !soldOut(g)) ?? 'turchese';

  return (
    <div className="split home">
      <div className="stage">
        <div className="stage-frame">
          <img className={`piece ${active === 'top' ? 'on' : ''}`} src={still(`tazza-${cupGlaze}`, 1600)} alt={`${CUP.name[lang]}, ${GLAZES[cupGlaze].name[lang]}`} />
          <img className={`piece ${active === 'collections' ? 'on' : ''}`} src={still(`${lead.id}-${lead.glazes[0]}`, 1600)} alt={`${lead.name[lang]}, ${GLAZES[lead.glazes[0]].name[lang]}`} loading="lazy" />
          {Object.entries(STAGE_PHOTO).map(([sec, name]) => (
            <img key={sec} className={active === sec ? 'on' : ''} src={photo(name)} alt={alt(name)} loading="lazy" />
          ))}
          {STAGE_PHOTO[active] && <p className="stage-cap">{alt(STAGE_PHOTO[active])}</p>}
        </div>
      </div>

      <div className="col">
        <section id="top" className="hero" aria-labelledby="hero-word">
          <div className="hero-line">
            <p>{t('hero.line')}</p>
            <div className="hero-act">
              <Link to="/shop" className="btn">{t('hero.cta')}</Link>
              <span className="muted num">{CUP.name[lang]} · {money(priceOf('tazza'))}</span>
            </div>
            <span className="tiles-label" id="try">{t('hero.try')}</span>
            <div className="tiles" role="group" aria-labelledby="try">
              {CUP.glazes.map(g => (
                <button key={g} type="button" className="tile" style={{ '--c': GLAZES[g].color } as React.CSSProperties}
                  aria-pressed={g === cupGlaze} onClick={() => setCupGlaze(g)} title={GLAZES[g].name[lang]}>
                  <span className="sr">{GLAZES[g].name[lang]}</span>
                </button>
              ))}
            </div>
            <p className="glaze-note" style={{ marginTop: 18 }} aria-live="polite">
              <strong>{GLAZES[cupGlaze].name[lang]}</strong> — {GLAZES[cupGlaze].note[lang]}{soldOut(cupGlaze) ? ` · ${t('shop.soldout')}` : ''}
            </p>
          </div>
          <h1 className="hero-word" id="hero-word">smalto</h1>
        </section>

        <section id="collections" aria-labelledby="show-title">
          <figure className="inline-pic piece"><img src={still(`${lead.id}-${lead.glazes[0]}`)} alt={lead.name[lang]} loading="lazy" /></figure>
          <div className="tabs" role="tablist" aria-label={t('nav.collections')}>
            {(Object.keys(COLLECTIONS) as Collection[]).map(c => (
              <button key={c} type="button" role="tab" id={`tab-${c}`} aria-controls="tabpanel" aria-selected={c === tab} onClick={() => setTab(c)}>{COLLECTIONS[c].name[lang]}</button>
            ))}
          </div>
          <div role="tabpanel" id="tabpanel" aria-labelledby={`tab-${tab}`} className="rise">
            <h2 className="show-title" id="show-title">{COLLECTIONS[tab].name[lang]}</h2>
            <p className="show-desc">{COLLECTIONS[tab].note[lang]}. {t('show.count', { n: inCollection.length })}.</p>
            <ul className="show-list">
              {inCollection.map(p => (
                <li key={p.id}><Link to={`/p/${p.id}`}>{p.name[lang]}</Link><span className="num muted">{money(priceOf(p.id))}</span></li>
              ))}
            </ul>
            <div className="cells">
              <Link to={`/shop?collection=${tab}`}>{t('show.see', { name: COLLECTIONS[tab].name[lang] })}</Link>
              <Link to="/shop">{t('show.all')}</Link>
            </div>
          </div>
        </section>

        <section id="letter" aria-label={t('letter.sign')}>
          <figure className="inline-pic"><img src={photo('mazzini', 800)} alt={alt('mazzini')} loading="lazy" /><figcaption>{alt('mazzini')}</figcaption></figure>
          <div className="letter rise">
            <svg className="letter-mark" viewBox="0 0 44 44" aria-hidden="true">
              <circle cx="22" cy="22" r="20" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M13 29c3 3 15 3 18 0M15 14h14l-2 13H17z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
            <p>{t('letter.p1')}</p>
            <p>{t('letter.p2')}</p>
            <p><mark>{t('letter.p3')}</mark></p>
            <p>{t('letter.p4')}</p>
            <p className="sign">{t('letter.sign')}<small>{t('letter.role')}</small></p>
          </div>
        </section>

        <section id="how" className="how" aria-labelledby="how-title">
          <h2 id="how-title" className="rise">{t('how.title')}</h2>
          <p className="rise">{t('how.lead')}</p>
          <div className="slip rise">
            {([
              ['how.day1', [['how.throw', 'how.throwT'], ['how.trim', 'how.trimT']]],
              ['how.day2', [['how.dry', 'how.dryT']]],
              ['how.day6', [['how.bisque', 'how.bisqueT']]],
              ['how.day7', [['how.dip', 'how.dipT']]],
              ['how.day8', [['how.glost', 'how.glostT'], ['how.cool', 'how.coolT']]],
            ] as const).map(([day, rows]) => (
              <div key={day}>
                <h3>{t(day)}</h3>
                {rows.map(([what, when]) => (
                  <div className="row" key={what}><span>{t(what)}</span><span className="dots" aria-hidden="true" /><span>{t(when)}</span></div>
                ))}
              </div>
            ))}
            <div className="done"><span>{t('how.done')}</span><span>{t('how.doneT')}</span></div>
          </div>
          <WheelClip caption={alt('wheel')} />
        </section>

        <section id="faenza" aria-labelledby="gal-title">
          <figure className="inline-pic"><img src={photo('mic', 800)} alt={alt('mic')} loading="lazy" /><figcaption>{alt('mic')}</figcaption></figure>
          <div className="gal-head rise">
            <h2 id="gal-title">{t('gal.title')}</h2>
            <span className="muted num">{t('gal.count', { n: 6 })}</span>
          </div>
          <div className="gal" tabIndex={0} role="region" aria-label={t('gal.title')}>
            {GALLERY.map((g, i) => Array.isArray(g) ? (
              <figure key={i} className="pair">{g.map(n => <img key={n} src={photo(n, 800)} alt={alt(n)} loading="lazy" />)}</figure>
            ) : (
              <figure key={i} className={SHAPE[i]}><img src={photo(g, 800)} alt={alt(g)} loading="lazy" /></figure>
            ))}
          </div>
          <ol className="gal-caps">
            {GALLERY.flat().map(n => <li key={n}>{alt(n)}</li>)}
          </ol>
        </section>

        <section id="faq" className="faq" aria-labelledby="faq-title">
          <figure className="inline-pic"><img src={photo('piazza', 800)} alt={alt('piazza')} loading="lazy" /><figcaption>{alt('piazza')}</figcaption></figure>
          <h2 id="faq-title" className="rise">{t('faq.title')}</h2>
          <ul className="facts rise">
            <li>{t('faq.f1')}</li><li>{t('faq.f2')}</li><li>{t('faq.f3')}</li>
          </ul>
          {([1, 2, 3, 4, 5, 6] as const).map(n => (
            <details key={n}>
              <summary>{t(`faq.q${n}`)}</summary>
              <p>{t(`faq.a${n}`)}</p>
            </details>
          ))}
          <div className="faq-act">
            <Link to="/shop" className="btn">{t('hero.cta')}</Link>
            <Link to="/admin">{t('demo.admin')}</Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function WheelClip({ caption }: { caption: string }) {
  const { t } = useShop();
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const v = video.current!;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // play only while on screen
    const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) void v.play().catch(() => {}); else v.pause(); });
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return (
    <figure className="wheel rise">
      <video ref={video} src={`${BASE}photos/wheel.webm`} poster={`${BASE}photos/wheel-poster.webp`} muted loop playsInline preload="metadata"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} aria-label={caption} />
      <figcaption>
        <span>{caption}</span>
        <button type="button" className="link" onClick={() => { const v = video.current!; if (v.paused) void v.play(); else v.pause(); }}>
          {playing ? t('clip.pause') : t('clip.play')}
        </button>
      </figcaption>
    </figure>
  );
}
