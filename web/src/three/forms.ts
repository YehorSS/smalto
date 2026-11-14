import { SplineCurve, Vector2 } from 'three';
import type { FormId } from '../../../shared/catalog';

/** Outer wall as [height fraction, radius fraction] from foot to rim, plus wall and floor thickness in mm. */
export interface Form {
  wall: [number, number][];
  thick: number;
  floor: number;
  /** body height as a share of the piece height (the rest is a lid) */
  body?: number;
  handle?: boolean;
  lid?: boolean;
  /** wood-fired: uneven throwing marks */
  rough?: boolean;
}

export const FORMS: Record<FormId, Form> = {
  cup: { wall: [[0, 0.74], [0.04, 0.8], [0.12, 0.87], [0.5, 0.94], [1, 1]], thick: 3.2, floor: 6 },
  mug: { wall: [[0, 0.84], [0.04, 0.9], [0.5, 0.97], [0.92, 1], [1, 0.99]], thick: 3.6, floor: 7, handle: true },
  bowl: { wall: [[0, 0.34], [0.07, 0.41], [0.28, 0.68], [0.58, 0.89], [0.86, 0.98], [1, 1]], thick: 4, floor: 7 },
  sideplate: { wall: [[0, 0.5], [0.18, 0.56], [0.32, 0.88], [0.7, 0.97], [1, 1]], thick: 4.5, floor: 8 },
  plate: { wall: [[0, 0.52], [0.18, 0.57], [0.3, 0.9], [0.7, 0.98], [1, 1]], thick: 5, floor: 9 },
  budvase: { wall: [[0, 0.62], [0.05, 0.72], [0.28, 1], [0.52, 0.86], [0.74, 0.4], [0.9, 0.34], [1, 0.42]], thick: 3.5, floor: 9 },
  vase: { wall: [[0, 0.56], [0.04, 0.63], [0.34, 1], [0.66, 0.74], [0.84, 0.44], [0.95, 0.45], [1, 0.52]], thick: 5, floor: 12 },
  pitcher: { wall: [[0, 0.62], [0.05, 0.69], [0.38, 1], [0.72, 0.8], [0.88, 0.72], [1, 0.8]], thick: 4.5, floor: 10, handle: true },
  teabowl: { wall: [[0, 0.44], [0.08, 0.5], [0.3, 0.83], [0.7, 0.98], [0.9, 1], [1, 0.95]], thick: 5.5, floor: 9, rough: true },
  jar: { wall: [[0, 0.64], [0.05, 0.71], [0.42, 1], [0.84, 0.86], [0.9, 0.66], [1, 0.66]], thick: 5, floor: 9, body: 0.8, lid: true, rough: true },
  dish: { wall: [[0, 0.6], [0.14, 0.66], [0.5, 0.9], [1, 1]], thick: 6, floor: 10, rough: true },
  candle: { wall: [[0, 0.86], [0.1, 0.97], [0.24, 1], [0.32, 0.62], [0.42, 0.56], [1, 0.54]], thick: 5, floor: 10, rough: true },
};

/** Half cross-section of the body in mm, from the axis under the foot round to the axis on the inner floor. */
export function profile(id: FormId, size: { h: number; d: number }): Vector2[] {
  const f = FORMS[id];
  const H = size.h * (f.body ?? 1), R = size.d / 2, w = f.thick;
  // a smooth wall sampled densely, so glaze edges and silhouettes do not facet
  const knots = f.wall.map(([t, r]) => new Vector2(r * R, t * (H - w * 0.3)));
  const outer = new SplineCurve(knots).getSpacedPoints(Math.max(24, Math.round(H / 2.5)))
    .map(v => new Vector2(Math.min(R, Math.max(0.5, v.x)), Math.max(0, v.y)));
  const top = outer[outer.length - 1];
  const foot = Math.min(4, H * 0.12);
  const footIn = Math.max(1, outer[0].x - Math.min(8, outer[0].x * 0.25));
  const pts: Vector2[] = [
    new Vector2(0, foot * 0.6),
    new Vector2(footIn, foot * 0.6),
    new Vector2(footIn + 1, 0),
    ...outer,
    new Vector2(top.x - w / 2, H), // rounded rim
  ];
  const floorY = Math.min(f.floor, H * 0.6);
  for (let i = outer.length - 1; i >= 0; i--) {
    const o = outer[i];
    if (o.y <= floorY) break;
    pts.push(new Vector2(Math.max(0.5, o.x - w), o.y));
  }
  // a short curve into the inner floor, then across to the axis
  const last = pts[pts.length - 1];
  const rAt = (y: number) => {
    for (let i = 1; i < outer.length; i++) {
      const a = outer[i - 1], b = outer[i];
      if (y <= b.y) return a.x + ((y - a.y) / Math.max(1e-6, b.y - a.y)) * (b.x - a.x);
    }
    return top.x;
  };
  const midY = floorY + (last.y - floorY) * 0.25;
  pts.push(new Vector2(Math.max(0, Math.min(last.x * 0.85, rAt(midY) - w)), midY));
  pts.push(new Vector2(Math.max(0, Math.min(last.x * 0.6, rAt(floorY) - w)), floorY));
  pts.push(new Vector2(0, floorY));
  return pts;
}

/** Lid for the jar: a dome with a knob, sitting on the body's rim. */
export function lidProfile(size: { h: number; d: number }): Vector2[] {
  const f = FORMS.jar, H = size.h * (f.body ?? 1), R = size.d / 2;
  const rim = f.wall[f.wall.length - 1][1] * R;
  const top = size.h - H;
  return [
    new Vector2(0, H - 4), new Vector2(rim - 7, H - 4), new Vector2(rim - 7, H + 1),
    new Vector2(rim + 2, H + 1), new Vector2(rim + 1, H + top * 0.25), new Vector2(rim * 0.55, H + top * 0.62),
    new Vector2(9, H + top * 0.66), new Vector2(11, H + top * 0.9), new Vector2(8, size.h), new Vector2(0, size.h),
  ];
}
