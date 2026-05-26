import { describe, it, expect } from 'vitest';
import { createField, seedPool, type StreakField } from './streakField';
import { analyzeTechnique } from './technique';
import { POOL, PLATE_ROTATION, TECHNIQUE, STREAK_FIELD } from './config';
import type { Stroke } from './path';

const PX = POOL.position[0];
const PZ = POOL.position[2];

/** A straight stroke of `n` points from (ax,az) to (bx,bz), agar-local. */
function line(ax: number, az: number, bx: number, bz: number, n = 40): Stroke {
  const points = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    points.push({ x: ax + (bx - ax) * t, z: az + (bz - az) * t, deposit: 0.02 });
  }
  return { points };
}

/** Field seeded only with the inoculum pool (no streaks). */
function pooledField(): StreakField {
  const f = createField();
  seedPool(f, PX, PZ, POOL.radius, STREAK_FIELD.POOL_DENSITY);
  return f;
}

/** Paint a band of streak-scale density across the field for coverage/smear tests. */
function paintBand(f: StreakField, density: number, fromCol = 0, toCol?: number) {
  const { res } = f;
  const end = toCol ?? res;
  for (let row = 4; row < res - 4; row++) {
    for (let col = fromCol; col < end; col++) {
      // skip the pool corner so these are "streak" cells
      f.data[row * res + col] = Math.max(f.data[row * res + col], density);
    }
  }
}

describe('analyzeTechnique — pool re-entries (re-dipping)', () => {
  it('counts one entry for a single streak out of the pool', () => {
    const strokes = [line(PX, PZ, 2, 2)];
    const r = analyzeTechnique(strokes, 0, pooledField());
    expect(r.poolEntries).toBe(1);
  });

  it('counts one entry per stroke that starts in the pool (starburst)', () => {
    const strokes = [
      line(PX, PZ, 2.5, 0),
      line(PX, PZ, 2.5, 1.5),
      line(PX, PZ, 0, 2.5),
      line(PX, PZ, -2.5, 1.5),
      line(PX, PZ, 2.5, -1.5),
      line(PX, PZ, 1.5, 2.5),
    ];
    const r = analyzeTechnique(strokes, 0, pooledField());
    expect(r.poolEntries).toBe(strokes.length);
    expect(r.flaws.map((f) => f.id)).toContain('redipping');
  });

  it('does not flag re-dipping for a few zone-1 dips', () => {
    const strokes = [line(PX, PZ, 2, 2), line(PX, PZ, 2.2, 1.5)];
    const r = analyzeTechnique(strokes, 3 * PLATE_ROTATION.STEP, pooledField());
    expect(r.poolEntries).toBeLessThan(TECHNIQUE.REDIP_MAX_ENTRIES);
    expect(r.flaws.map((f) => f.id)).not.toContain('redipping');
  });
});

describe('analyzeTechnique — rotation / quadrants', () => {
  it('derives rotation count from the accumulated plate angle', () => {
    const r = analyzeTechnique([], 3 * PLATE_ROTATION.STEP, pooledField());
    expect(r.rotations).toBe(3);
  });

  it('flags noQuadrants when substantial streaking happened with no rotation', () => {
    const f = pooledField();
    paintBand(f, 0.02);
    const r = analyzeTechnique([line(-2, -2, 2, 2)], 0, f);
    expect(r.streakedCells).toBeGreaterThan(TECHNIQUE.MIN_STREAKED);
    expect(r.flaws.map((x) => x.id)).toContain('noQuadrants');
  });

  it('does not flag noQuadrants once the plate was rotated', () => {
    const f = pooledField();
    paintBand(f, 0.02);
    const r = analyzeTechnique([], 3 * PLATE_ROTATION.STEP, f);
    expect(r.flaws.map((x) => x.id)).not.toContain('noQuadrants');
  });

  it('does not flag noQuadrants on a near-empty plate', () => {
    const r = analyzeTechnique([], 0, pooledField());
    expect(r.streakedCells).toBeLessThan(TECHNIQUE.MIN_STREAKED);
    expect(r.flaws).toHaveLength(0);
  });
});

describe('analyzeTechnique — over-crossing (smear)', () => {
  it('flags oversmear when the path re-covers the same agar repeatedly', () => {
    // Eight passes over the same line → cells far exceed OVERLAP_HITS.
    const strokes = Array.from({ length: 8 }, () => line(0.5, 0.5, 2.5, 0.5));
    const r = analyzeTechnique(strokes, 3 * PLATE_ROTATION.STEP, pooledField());
    expect(r.overlapRatio).toBeGreaterThan(TECHNIQUE.OVERSMEAR_RATIO);
    expect(r.flaws.map((x) => x.id)).toContain('oversmear');
  });

  it('does not flag oversmear for distinct single-pass strokes', () => {
    const strokes = [
      line(0.5, 0.5, 2.5, 0.5),
      line(0.5, 1.0, 2.5, 1.0),
      line(0.5, 1.5, 2.5, 1.5),
    ];
    const r = analyzeTechnique(strokes, 3 * PLATE_ROTATION.STEP, pooledField());
    expect(r.overlapRatio).toBeLessThanOrEqual(TECHNIQUE.OVERSMEAR_RATIO);
    expect(r.flaws.map((x) => x.id)).not.toContain('oversmear');
  });
});

describe('analyzeTechnique — linkage ("crossing the streams")', () => {
  it('flags unlinked when quadrants start in fresh agar', () => {
    // Zone 1 from the pool, then two quadrants that start far from the pool and
    // from each other — disconnected islands. Rotated, so noQuadrants won't fire.
    const strokes = [
      line(PX, PZ, 0.5, -1.5), // zone 1, on the inoculum
      line(1.5, 1.5, 2.6, 1.5), // disconnected (top-right)
      line(-2.2, 1.4, -1.2, 2.0), // disconnected (top-left)
    ];
    const r = analyzeTechnique(strokes, 3 * PLATE_ROTATION.STEP, pooledField());
    expect(r.unlinkedStrokes).toBeGreaterThanOrEqual(TECHNIQUE.MAX_UNLINKED);
    expect(r.flaws.map((f) => f.id)).toContain('unlinked');
  });

  it('does not flag unlinked when each stroke starts on the previous one', () => {
    // A connected chain: pool -> A -> B -> C, each stroke starting where the
    // last ended (crossing the previous streak).
    const strokes = [
      line(PX, PZ, 1.0, -1.0),
      line(1.0, -1.0, 1.5, 0.5),
      line(1.5, 0.5, -0.5, 1.5),
    ];
    const r = analyzeTechnique(strokes, 3 * PLATE_ROTATION.STEP, pooledField());
    expect(r.unlinkedStrokes).toBe(0);
    expect(r.flaws.map((f) => f.id)).not.toContain('unlinked');
  });
});

describe('analyzeTechnique — whole-plate use', () => {
  it('flags underuse when streaks are crammed into one corner', () => {
    const f = pooledField();
    // a small streak patch confined to one region (well inside the disc)
    const { res } = f;
    for (let row = 50; row < 64; row++) {
      for (let col = 50; col < 64; col++) f.data[row * res + col] = 0.02;
    }
    const r = analyzeTechnique([], 3 * PLATE_ROTATION.STEP, f);
    expect(r.streakedCells).toBeGreaterThan(TECHNIQUE.MIN_STREAKED);
    expect(r.plateCoverage).toBeLessThan(TECHNIQUE.WHOLE_PLATE_MIN);
    expect(r.flaws.map((x) => x.id)).toContain('underuse');
  });

  it('does not flag underuse when streaks span the plate', () => {
    const f = pooledField();
    paintBand(f, 0.02);
    const r = analyzeTechnique([], 3 * PLATE_ROTATION.STEP, f);
    expect(r.plateCoverage).toBeGreaterThanOrEqual(TECHNIQUE.WHOLE_PLATE_MIN);
    expect(r.flaws.map((x) => x.id)).not.toContain('underuse');
  });
});
