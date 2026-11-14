import { describe, expect, it } from 'vitest';
import { GLAZES, PIECES } from '../../shared/catalog';
import { FORMS, profile } from '../src/three/forms';

describe('lathe profiles', () => {
  it('has a profile for every form in the catalogue', () => {
    for (const p of PIECES) expect(FORMS[p.form], p.form).toBeDefined();
  });

  for (const p of PIECES) {
    it(`${p.id}: starts and ends on the axis, fits its size`, () => {
      const pts = profile(p.form, p.size);
      expect(pts[0].x).toBe(0);
      expect(pts[pts.length - 1].x).toBe(0);
      const maxY = Math.max(...pts.map(v => v.y));
      const maxX = Math.max(...pts.map(v => v.x));
      expect(maxY).toBeLessThanOrEqual(p.size.h + 1e-6);
      expect(maxY).toBeGreaterThan(p.size.h * 0.75);
      expect(maxX).toBeCloseTo(p.size.d / 2, 0);
      expect(pts.every(v => v.x >= 0 && v.y >= 0 && Number.isFinite(v.x + v.y))).toBe(true);
    });

    it(`${p.id}: inner wall stays inside the outer wall`, () => {
      const pts = profile(p.form, p.size);
      const lip = pts.reduce((best, v, i) => (v.y > pts[best].y ? i : best), 0);
      const outer = pts.slice(0, lip + 1), inner = pts.slice(lip);
      const rOuterAt = (y: number) => {
        let r = 0;
        for (let i = 1; i < outer.length; i++) {
          const a = outer[i - 1], b = outer[i];
          if ((a.y - y) * (b.y - y) <= 0 && a.y !== b.y) r = Math.max(r, a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
        }
        return r;
      };
      for (const v of inner) if (v.y > 1) expect(v.x, `y=${v.y}`).toBeLessThanOrEqual(rOuterAt(v.y) + 1e-6);
    });
  }

  it('has material values for every glaze', () => {
    for (const g of Object.values(GLAZES)) {
      expect(g.color).toMatch(/^#[0-9a-f]{6}$/);
      expect(g.roughness).toBeGreaterThan(0);
      expect(g.roughness).toBeLessThan(1);
    }
  });
});
