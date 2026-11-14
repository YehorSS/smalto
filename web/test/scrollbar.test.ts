import { describe, expect, it } from 'vitest';
import { scrollForPointer, thumbGeometry } from '../src/ui/scrollbar';

describe('thumbGeometry', () => {
  it('sizes the thumb by how much of the page is on screen', () => {
    expect(thumbGeometry(900, 9000, 0, 600)).toEqual({ size: 60, offset: 0 });
  });
  it('moves the thumb to the bottom at the end of the page', () => {
    const g = thumbGeometry(900, 9000, 8100, 600);
    expect(g.offset + g.size).toBeCloseTo(600, 5);
  });
  it('never makes the thumb smaller than a finger can hold', () => {
    expect(thumbGeometry(900, 900_000, 0, 600).size).toBe(36);
  });
  it('hides the thumb when the page fits the screen', () => {
    expect(thumbGeometry(900, 800, 0, 600).size).toBe(0);
  });
});

describe('scrollForPointer', () => {
  it('maps a point on the track to a scroll position, centring the thumb', () => {
    expect(scrollForPointer(300, { top: 0, height: 600 }, 60, 900, 9000)).toBeCloseTo(4050, 0);
  });
  it('clamps to the ends', () => {
    expect(scrollForPointer(-50, { top: 0, height: 600 }, 60, 900, 9000)).toBe(0);
    expect(scrollForPointer(9999, { top: 0, height: 600 }, 60, 900, 9000)).toBe(8100);
  });
});
