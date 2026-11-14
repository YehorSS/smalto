import {
  BufferAttribute, CanvasTexture, CatmullRomCurve3, Color, Group, LatheGeometry, Mesh, MeshPhysicalMaterial,
  RepeatWrapping, SRGBColorSpace, TubeGeometry, Vector3, type BufferGeometry,
} from 'three';
import { GLAZES, type GlazeId, type Piece } from '../../../shared/catalog';
import { FORMS, lidProfile, profile } from './forms';

const CLAY = new Color('#c4a27c');
const ASH = new Color('#8d7a5c');

/** How each vertex takes the glaze: bare clay at the foot, thin at the rim, pooled on the floor, ash on wood-fired pieces. */
interface Zones { clay: Float32Array; edge: Float32Array; pool: Float32Array; ash: Float32Array }

function hash(x: number, y: number, z: number) {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

function zones(geo: BufferGeometry, h: number, footY: number, rough: boolean, inner: (i: number) => boolean): Zones {
  const pos = geo.getAttribute('position');
  const n = pos.count;
  const z: Zones = { clay: new Float32Array(n), edge: new Float32Array(n), pool: new Float32Array(n), ash: new Float32Array(n) };
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i), zz = pos.getZ(i);
    const ang = Math.atan2(zz, x);
    // glaze stops a little above the foot, in a slightly wavy line where the piece was dipped
    const dipLine = footY * 2.2 + Math.sin(ang * 3) * h * 0.012 + Math.sin(ang * 7 + 1) * h * 0.006;
    z.clay[i] = inner(i) ? 0 : Math.max(0, Math.min(1, (dipLine + 1.2 - y) / 2.4));
    const t = y / h;
    z.edge[i] = Math.max(0, Math.min(1, (t - 0.9) / 0.1)) ** 1.5;
    z.pool[i] = inner(i) ? Math.max(0, 1 - t * 2.5) : 0;
    z.ash[i] = rough && !inner(i) && z.clay[i] < 0.5 ? Math.max(0, hash(Math.round(x * 0.4), Math.round(y * 0.4), Math.round(zz * 0.4)) - 0.86) * 5 * Math.max(0, 1 - Math.abs(Math.sin(ang - 0.6)) * 1.4) : 0;
  }
  return z;
}

function paint(z: Zones, glaze: GlazeId, out: Float32Array) {
  const g = GLAZES[glaze], base = new Color(g.color), edge = new Color(g.edge), pool = base.clone().multiplyScalar(0.72);
  const c = new Color();
  for (let i = 0; i < z.clay.length; i++) {
    c.copy(base).lerp(edge, z.edge[i] * 0.85).lerp(pool, z.pool[i]).lerp(ASH, Math.min(1, z.ash[i]));
    c.lerp(CLAY, z.clay[i]);
    out[i * 3] = c.r; out[i * 3 + 1] = c.g; out[i * 3 + 2] = c.b;
  }
}

const speckles = new Map<GlazeId, CanvasTexture>();
/** White ground with iron specks, multiplied over the glaze colour. */
function speckle(id: GlazeId): CanvasTexture {
  const have = speckles.get(id);
  if (have) return have;
  const s = 512, cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, s, s);
  const n = Math.round(GLAZES[id].speckle * 1400);
  let seed = id.length * 977;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    const r = 0.4 + rnd() ** 3 * 2.2;
    ctx.fillStyle = `rgba(60,38,24,${0.25 + rnd() * 0.5})`;
    ctx.beginPath();
    ctx.arc(rnd() * s, rnd() * s, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new CanvasTexture(cv);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(6, 3);
  speckles.set(id, tex);
  return tex;
}

function roughen(geo: BufferGeometry, amount: number) {
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 1) continue;
    const ang = Math.atan2(z, x);
    // throwing rings plus a slow wobble round the piece
    const k = 1 + (Math.sin(y * 0.55) * 0.35 + Math.sin(ang * 2 + y * 0.03) * 0.65) * amount / r;
    pos.setXYZ(i, x * k, y, z * k);
  }
  geo.computeVertexNormals();
}

export interface Built {
  group: Group;
  material: MeshPhysicalMaterial;
  /** blends from one glaze to another, k in 0..1 */
  setGlaze(from: GlazeId, to: GlazeId, k: number): void;
  dispose(): void;
  height: number;
  width: number;
}

export function buildPiece(piece: Piece, glaze: GlazeId): Built {
  const form = FORMS[piece.form];
  const group = new Group();
  const material = new MeshPhysicalMaterial({ vertexColors: true, roughness: GLAZES[glaze].roughness, clearcoat: 0.55, clearcoatRoughness: 0.18, map: speckle(glaze) });
  const parts: { geo: BufferGeometry; z: Zones; a: Float32Array; b: Float32Array }[] = [];
  const H = piece.size.h * (form.body ?? 1);

  const add = (geo: BufferGeometry, z: Zones) => {
    const n = geo.getAttribute('position').count;
    const colors = new Float32Array(n * 3);
    geo.setAttribute('color', new BufferAttribute(colors, 3));
    parts.push({ geo, z, a: new Float32Array(n * 3), b: new Float32Array(n * 3) });
    group.add(new Mesh(geo, material));
  };

  const prof = profile(piece.form, piece.size);
  const lip = prof.reduce((best, v, i) => (v.y > prof[best].y ? i : best), 0);
  const body = new LatheGeometry(prof, 112);
  if (form.rough) roughen(body, 1.1);
  // LatheGeometry lays out profile points in order for each segment; points past the rim are the inside
  const per = prof.length;
  add(body, zones(body, H, 3, !!form.rough, i => i % per > lip));

  if (form.lid) {
    const lid = new LatheGeometry(lidProfile(piece.size), 96);
    if (form.rough) roughen(lid, 0.6);
    add(lid, zones(lid, piece.size.h, -99, !!form.rough, () => false));
  }

  if (form.handle) {
    const R = piece.size.d / 2;
    const y0 = H * 0.78, y1 = H * 0.24, reach = Math.max(22, R * 0.55);
    const curve = new CatmullRomCurve3([
      new Vector3(R * 0.96, y0, 0), new Vector3(R + reach * 0.75, y0 + 4, 0), new Vector3(R + reach, (y0 + y1) / 2 + 6, 0),
      new Vector3(R + reach * 0.6, y1 + 4, 0), new Vector3(R * 0.95, y1, 0),
    ]);
    const handle = new TubeGeometry(curve, 48, Math.max(4.5, piece.size.d * 0.045), 14, false);
    handle.scale(1, 1, 0.62);
    add(handle, zones(handle, H, -99, false, () => false));
  }

  const setGlaze = (from: GlazeId, to: GlazeId, k: number) => {
    for (const p of parts) {
      paint(p.z, from, p.a);
      if (to !== from) paint(p.z, to, p.b);
      const col = p.geo.getAttribute('color') as BufferAttribute;
      const arr = col.array as Float32Array;
      for (let i = 0; i < arr.length; i++) arr[i] = to === from ? p.a[i] : p.a[i] + (p.b[i] - p.a[i]) * k;
      col.needsUpdate = true;
    }
    const g = k < 0.5 ? from : to;
    material.map = speckle(g);
    material.roughness = GLAZES[from].roughness + (GLAZES[to].roughness - GLAZES[from].roughness) * k;
    material.needsUpdate = true;
  };
  setGlaze(glaze, glaze, 1);

  return {
    group, material, setGlaze,
    height: piece.size.h, width: piece.size.d,
    dispose() { parts.forEach(p => p.geo.dispose()); material.dispose(); },
  };
}
