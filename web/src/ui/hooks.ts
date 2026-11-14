import { useEffect, useState } from 'react';
import { BASE } from '../ctx';

export interface Credit { name: string; w: number; h: number; alt: { en: string; it: string }; creator: string; license: string; licenseUrl?: string; page: string; video?: boolean }

let cache: Promise<Credit[]> | null = null;
/** The found pictures with their captions and authors. */
export function useCredits(): Credit[] {
  const [list, setList] = useState<Credit[]>([]);
  useEffect(() => {
    cache ??= fetch(`${BASE}photos/credits.json`).then(r => r.json()).catch(() => []);
    let live = true;
    cache.then(l => { if (live) setList(l); });
    return () => { live = false; };
  }, []);
  return list;
}

/** Adds .in to every .rise element once it scrolls into view. */
export function useRise(deps: unknown[] = []) {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.rise:not(.in)');
    if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
    const io = new IntersectionObserver(entries => {
      for (const en of entries) if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach(e => io.observe(e));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Which of the given section ids sits across the middle of the screen. */
export function useActiveSection(ids: string[]): string {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const io = new IntersectionObserver(entries => {
      for (const en of entries) if (en.isIntersecting) setActive(en.target.id);
    }, { rootMargin: '-45% 0px -45% 0px' });
    ids.forEach(id => { const el = document.getElementById(id); if (el) io.observe(el); });
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join()]);
  return active;
}
