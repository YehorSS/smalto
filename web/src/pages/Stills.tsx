import { useSearchParams } from 'react-router';
import { parseSku } from '../../../shared/catalog';
import { Viewer } from '../three/Viewer';

/** Tool page: one piece, fixed angle, transparent ground. tools/stills.mjs screenshots it. */
export default function Stills() {
  const [q] = useSearchParams();
  const p = parseSku(q.get('sku') ?? '');
  if (!p) return <p>unknown sku</p>;
  document.documentElement.style.background = document.body.style.background = 'transparent';
  const ready = () => { (window as unknown as { __ready: boolean }).__ready = true; };
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: q.get('bg') ?? 'transparent' }}>
      <Viewer piece={p.piece} glaze={p.glaze} frozen onReady={ready} />
    </div>
  );
}
