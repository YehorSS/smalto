import { useEffect, useRef, useState } from 'react';
import {
  ACESFilmicToneMapping, CanvasTexture, DirectionalLight, Mesh, MeshBasicMaterial, PerspectiveCamera, PlaneGeometry,
  PMREMGenerator, Scene, SRGBColorSpace, WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { GlazeId, Piece } from '../../../shared/catalog';
import { buildPiece } from './piece';
import { still } from '../ctx';

const FADE_MS = 400;
/** how far above the piece the camera looks from: plates are seen from above, vases from the side */
const ELEVATION: Partial<Record<Piece['form'], number>> = { plate: 0.95, sideplate: 0.95, dish: 0.85, bowl: 0.55, teabowl: 0.45, candle: 0.45 };

function shadowTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,0.42)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.12)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new CanvasTexture(cv);
}

export interface ViewerProps {
  piece: Piece;
  glaze: GlazeId;
  /** render once at a fixed angle (for stills); no motion, no input */
  frozen?: boolean;
  onReady?: () => void;
  label?: string;
}

export function Viewer({ piece, glaze, frozen, onReady, label }: ViewerProps) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ glaze(g: GlazeId): void } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = host.current!;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: !!frozen });
    } catch {
      setFailed(true);
      return;
    }
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    renderer.setPixelRatio(Math.min(devicePixelRatio, frozen ? 1 : 2));
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.82;
    el.appendChild(renderer.domElement);

    const scene = new Scene();
    const pmrem = new PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    const key = new DirectionalLight('#fff4e6', 1.4);
    key.position.set(-2, 3, 2.5);
    scene.add(key);

    const built = buildPiece(piece, glaze);
    const size = Math.max(piece.size.h, piece.size.d * (piece.form === 'mug' || piece.form === 'pitcher' ? 1.25 : 1));
    const s = 1 / size;
    built.group.scale.setScalar(s);
    built.group.position.y = -piece.size.h * s / 2;
    if (piece.form === 'mug' || piece.form === 'pitcher') built.group.position.x = -piece.size.d * s * 0.12;
    scene.add(built.group);

    const shadowTex = shadowTexture();
    const shadow = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.setScalar(piece.size.d * s * 1.5);
    shadow.position.y = built.group.position.y + 0.001;
    scene.add(shadow);

    const camera = new PerspectiveCamera(28, 1, 0.01, 20);
    const elev = ELEVATION[piece.form] ?? 0.32;
    const dist = 2.5;
    camera.position.set(0, Math.sin(elev) * dist, Math.cos(elev) * dist);
    camera.lookAt(0, piece.form === 'plate' || piece.form === 'sideplate' || piece.form === 'dish' ? -0.05 : 0, 0);

    let w = 0, h = 0;
    const fit = () => {
      w = el.clientWidth; h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // keep the whole piece in frame on narrow and wide stages alike
      camera.zoom = Math.min(1, camera.aspect / 0.8);
      camera.updateProjectionMatrix();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);

    let angle = -0.5, target = angle, vel = 0;
    let fade: { from: GlazeId; to: GlazeId; t0: number } | null = null;
    let cur = glaze;
    let raf = 0, last = performance.now(), visible = true, dragging = false, lastX = 0;

    const draw = () => {
      built.group.rotation.y = angle;
      renderer.render(scene, camera);
    };
    const frame = (now: number) => {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!dragging) {
        if (!reduced) target += dt * 0.25;
        target += vel; vel *= 0.92;
      }
      angle += (target - angle) * Math.min(1, dt * 8);
      if (fade) {
        const k = Math.min(1, (now - fade.t0) / (reduced ? 1 : FADE_MS));
        built.setGlaze(fade.from, fade.to, k * k * (3 - 2 * k));
        if (k >= 1) fade = null;
      }
      draw();
      const moving = !reduced || dragging || Math.abs(vel) > 1e-4 || Math.abs(target - angle) > 1e-3 || fade;
      if (visible && !document.hidden && moving) raf = requestAnimationFrame(frame);
    };
    const kick = () => { if (!raf && !frozen) { last = performance.now(); raf = requestAnimationFrame(frame); } };

    api.current = {
      glaze(g) {
        if (g === cur) return;
        fade = { from: cur, to: g, t0: performance.now() };
        cur = g;
        if (frozen) { built.setGlaze(g, g, 1); draw(); } else kick();
      },
    };

    const canvas = renderer.domElement;
    if (!frozen) {
      canvas.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; vel = 0; canvas.setPointerCapture(e.pointerId); kick(); });
      canvas.addEventListener('pointermove', e => {
        if (!dragging) return;
        const d = (e.clientX - lastX) / Math.max(200, w) * Math.PI * 1.6;
        lastX = e.clientX; target += d; vel = d * 0.6;
      });
      const up = () => { dragging = false; kick(); };
      canvas.addEventListener('pointerup', up);
      canvas.addEventListener('pointercancel', up);
    }
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); cancelAnimationFrame(raf); setFailed(true); });

    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) kick(); });
    io.observe(el);
    const onVis = () => { if (!document.hidden) kick(); };
    document.addEventListener('visibilitychange', onVis);

    draw();
    if (frozen) requestAnimationFrame(() => { draw(); onReady?.(); }); else { kick(); onReady?.(); }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      built.dispose(); shadowTex.dispose(); env.dispose(); pmrem.dispose(); renderer.dispose();
      canvas.remove();
      api.current = null;
    };
    // the piece is rebuilt only when the piece changes; glaze changes crossfade below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [piece.id, frozen]);

  useEffect(() => { api.current?.glaze(glaze); }, [glaze]);

  if (failed) return <img className="piece" src={still(`${piece.id}-${glaze}`, 1600)} alt={label ?? ''} />;
  return <div className="viewer" ref={host} role="img" aria-label={label} />;
}
