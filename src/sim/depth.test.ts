import { describe, it, expect } from 'vitest';
import { depthFromHoldMs, loweredY } from './depth';
import { PIPETTE } from './config';

describe('depthFromHoldMs', () => {
  it('returns zero depth at zero ms', () => {
    expect(depthFromHoldMs(0)).toEqual({ depth: 0, isPuncture: false });
  });

  it('treats negative input defensively', () => {
    expect(depthFromHoldMs(-100)).toEqual({ depth: 0, isPuncture: false });
  });

  it('reaches half depth halfway through the FULL window', () => {
    const half = PIPETTE.LOWER_HOLD_FULL_MS / 2;
    const r = depthFromHoldMs(half);
    expect(r.depth).toBeCloseTo(0.5, 5);
    expect(r.isPuncture).toBe(false);
  });

  it('reaches full depth exactly at FULL ms', () => {
    expect(depthFromHoldMs(PIPETTE.LOWER_HOLD_FULL_MS)).toEqual({
      depth: 1,
      isPuncture: false,
    });
  });

  it('stays at depth 1 in the safe zone before puncture', () => {
    const safe = PIPETTE.LOWER_HOLD_PUNCTURE_MS - 1;
    expect(depthFromHoldMs(safe)).toEqual({ depth: 1, isPuncture: false });
  });

  it('punctures exactly at PUNCTURE ms', () => {
    expect(depthFromHoldMs(PIPETTE.LOWER_HOLD_PUNCTURE_MS)).toEqual({
      depth: 1,
      isPuncture: true,
    });
  });

  it('stays punctured after PUNCTURE ms', () => {
    expect(depthFromHoldMs(PIPETTE.LOWER_HOLD_PUNCTURE_MS + 5_000)).toEqual({
      depth: 1,
      isPuncture: true,
    });
  });
});

describe('loweredY', () => {
  it('returns hover Y at depth 0', () => {
    expect(loweredY(3.5, 0.4, 0)).toBe(3.5);
  });

  it('returns target Y at depth 1', () => {
    expect(loweredY(3.5, 0.4, 1)).toBeCloseTo(0.4, 9);
  });

  it('interpolates linearly at midpoint', () => {
    expect(loweredY(3.5, 0.5, 0.5)).toBeCloseTo(2.0, 5);
  });

  it('clamps depth above 1', () => {
    expect(loweredY(3.5, 0.4, 2)).toBeCloseTo(0.4, 9);
  });

  it('clamps depth below 0', () => {
    expect(loweredY(3.5, 0.4, -1)).toBe(3.5);
  });

  it('is monotone in depth (within bounds)', () => {
    const samples = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1];
    const ys = samples.map((d) => loweredY(3.5, 0.4, d));
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i]).toBeLessThanOrEqual(ys[i - 1]);
    }
  });
});
