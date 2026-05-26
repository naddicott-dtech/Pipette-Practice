import { describe, it, expect } from 'vitest';
import { createField, seedPool, type StreakField } from './streakField';
import {
  generateColonies,
  growthRadius,
  classifyStreak,
  gradeStreak,
  ceilingForFlaws,
  type Colony,
} from './growth';
import { GROWTH, POOL, STREAK_FIELD, PLATE_ROTATION } from './config';
import type { Stroke } from './path';

function uniformField(density: number, res = 32, half = 3): StreakField {
  const f = createField(res, half);
  f.data.fill(density);
  return f;
}

describe('generateColonies', () => {
  it('grows nothing from an empty field', () => {
    expect(generateColonies(createField())).toEqual([]);
  });

  it('grows nothing below the viability threshold', () => {
    const f = uniformField(GROWTH.MIN_VIABLE / 2);
    expect(generateColonies(f)).toEqual([]);
  });

  it('localizes colonies to the seeded pool region', () => {
    const f = createField();
    seedPool(f, POOL.position[0], POOL.position[2], POOL.radius, STREAK_FIELD.POOL_DENSITY);
    const colonies = generateColonies(f);
    expect(colonies.length).toBeGreaterThan(0);
    // Every colony sits within a cell of the pool disc.
    const margin = POOL.radius + (2 * f.half) / f.res;
    for (const c of colonies) {
      const dist = Math.hypot(c.x - POOL.position[0], c.z - POOL.position[2]);
      expect(dist).toBeLessThanOrEqual(margin);
    }
  });

  it('is deterministic for a given field', () => {
    const a = generateColonies(uniformField(0.3));
    const b = generateColonies(uniformField(0.3));
    expect(b).toEqual(a);
  });

  it('grows more colonies as density rises', () => {
    // Densities within the streak range (the steep curve saturates by ~0.04).
    const low = generateColonies(uniformField(0.005)).length;
    const high = generateColonies(uniformField(0.02)).length;
    expect(high).toBeGreaterThan(low);
  });

  it('still grows a sparse scatter on a faint streak (luck floor / coverage)', () => {
    // Density well below the OLD cliff (0.008) but above MIN_VIABLE — this is
    // the diluted-tail band that used to grow nothing. It must now grow some.
    const faint = generateColonies(uniformField(0.003));
    expect(faint.length).toBeGreaterThan(0);
    // ...but far fewer than a dense field (a scatter, not a lawn).
    const dense = generateColonies(uniformField(0.6));
    expect(faint.length).toBeLessThan(dense.length);
  });

  it('respects the MAX_COLONIES cap', () => {
    const colonies = generateColonies(uniformField(STREAK_FIELD.DMAX, 96));
    expect(colonies.length).toBeLessThanOrEqual(GROWTH.MAX_COLONIES);
  });

  it('clamps per-cell seeding to MAX_PER_CELL', () => {
    // A small saturated field so the MAX_COLONIES cap can't mask the per-cell
    // clamp: every cell is at DMAX, where lambda would otherwise exceed the cap.
    const res = 8;
    const colonies = generateColonies(uniformField(STREAK_FIELD.DMAX, res));
    expect(colonies.length).toBeLessThanOrEqual(res * res * GROWTH.MAX_PER_CELL);
    expect(colonies.length).toBeGreaterThan(res * res); // more than one per cell
  });
});

describe('growthRadius', () => {
  it('is zero at or before t=0 and full at or after t=1', () => {
    expect(growthRadius(0.5, 0)).toBe(0);
    expect(growthRadius(0.5, -1)).toBe(0);
    expect(growthRadius(0.5, 1)).toBeCloseTo(0.5, 10);
    expect(growthRadius(0.5, 2)).toBeCloseTo(0.5, 10);
  });

  it('increases monotonically over [0,1]', () => {
    let prev = -1;
    for (let t = 0; t <= 1.0001; t += 0.1) {
      const r = growthRadius(1, t);
      expect(r).toBeGreaterThanOrEqual(prev);
      prev = r;
    }
  });
});

describe('classifyStreak', () => {
  const confluentField = () => uniformField(GROWTH.CONFLUENT_D); // every cell ≥ CONFLUENT_D
  const emptyField = () => createField();
  const spaced = (n: number): Colony[] => {
    const gap = GROWTH.ISOLATION_DIST * 3;
    const out: Colony[] = [];
    for (let i = 0; i < n; i++) out.push({ x: i * gap, z: 0, r: GROWTH.COLONY_RADIUS });
    return out;
  };

  it('grades a confluent zone + plenty of isolated colonies as great', () => {
    const colonies = spaced(GROWTH.GREAT_ISO + 2);
    const v = classifyStreak(colonies, confluentField());
    expect(v.isolatedCount).toBe(colonies.length);
    expect(v.hasConfluent).toBe(true);
    expect(v.grade).toBe('great');
  });

  it('grades isolated colonies WITHOUT a confluent zone as good, not great', () => {
    // Full gradient requires a heavy zone too; plenty of singles alone is "good".
    const v = classifyStreak(spaced(GROWTH.GREAT_ISO + 2), emptyField());
    expect(v.hasConfluent).toBe(false);
    expect(v.grade).toBe('good');
  });

  it('grades a few isolated colonies as good', () => {
    const v = classifyStreak(spaced(GROWTH.GOOD_ISO), confluentField());
    expect(v.grade).toBe('good');
  });

  it('grades a pure confluent lawn (no isolated colonies) as ok', () => {
    const colonies: Colony[] = [];
    const tiny = GROWTH.ISOLATION_DIST / 4;
    for (let i = 0; i < 50; i++) {
      colonies.push({ x: (i % 7) * tiny, z: Math.floor(i / 7) * tiny, r: GROWTH.COLONY_RADIUS });
    }
    const v = classifyStreak(colonies, confluentField());
    expect(v.isolatedCount).toBe(0);
    expect(v.grade).toBe('ok');
  });

  it('grades near-empty growth as ok', () => {
    expect(classifyStreak([], emptyField()).grade).toBe('ok');
    expect(classifyStreak([{ x: 0, z: 0, r: GROWTH.COLONY_RADIUS }], emptyField()).grade).toBe('ok');
  });
});

describe('ceilingForFlaws', () => {
  it('lowers the grade ceiling one tier per flaw', () => {
    expect(ceilingForFlaws(0)).toBe('great');
    expect(ceilingForFlaws(1)).toBe('good');
    expect(ceilingForFlaws(2)).toBe('ok');
    expect(ceilingForFlaws(4)).toBe('ok');
  });
});

describe('gradeStreak — technique caps the outcome grade', () => {
  const PX = POOL.position[0];
  const PZ = POOL.position[2];

  // A great colony OUTCOME: spaced isolated colonies + a confluent field.
  const greatColonies = (): Colony[] => {
    const gap = GROWTH.ISOLATION_DIST * 3;
    const out: Colony[] = [];
    for (let i = 0; i < GROWTH.GREAT_ISO + 2; i++) {
      out.push({ x: i * gap, z: 0, r: GROWTH.COLONY_RADIUS });
    }
    return out;
  };
  // Realistic plate: a confluent inoculum pool (so the outcome can be "great")
  // plus a wide *dilute* streak band (below HEAVY_D, so no smear flaw).
  const realisticField = (): StreakField => {
    const f = createField();
    seedPool(f, PX, PZ, POOL.radius, STREAK_FIELD.POOL_DENSITY);
    const { res } = f;
    for (let row = 10; row < res - 10; row++) {
      for (let col = 10; col < res - 10; col++) {
        f.data[row * res + col] = Math.max(f.data[row * res + col], 0.02);
      }
    }
    return f;
  };
  const line = (ax: number, az: number, bx: number, bz: number, n = 40): Stroke => {
    const points = [];
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      points.push({ x: ax + (bx - ax) * t, z: az + (bz - az) * t, deposit: 0.02 });
    }
    return { points };
  };

  it('keeps a great outcome great when technique is clean', () => {
    // One pool dip, three rotations, spread streaks → no flaws.
    const strokes = [line(PX, PZ, 2, 2)];
    const a = gradeStreak(greatColonies(), realisticField(), strokes, 3 * PLATE_ROTATION.STEP);
    expect(a.flaws).toHaveLength(0);
    expect(a.outcomeGrade).toBe('great');
    expect(a.grade).toBe('great');
  });

  it('caps a great outcome to ok for a re-dipping, no-rotation starburst', () => {
    const strokes = [
      line(PX, PZ, 2.5, 0),
      line(PX, PZ, 2.5, 1.5),
      line(PX, PZ, 0, 2.5),
      line(PX, PZ, -2.5, 1.5),
      line(PX, PZ, 2.5, -1.5),
      line(PX, PZ, 1.5, 2.5),
    ];
    const a = gradeStreak(greatColonies(), realisticField(), strokes, 0);
    expect(a.outcomeGrade).toBe('great');
    expect(a.flaws.map((f) => f.id)).toEqual(
      expect.arrayContaining(['redipping', 'noQuadrants']),
    );
    expect(a.grade).toBe('ok'); // 2+ flaws → ok ceiling
  });

  it('exposes the rotation count for affirmation copy', () => {
    const a = gradeStreak(greatColonies(), realisticField(), [line(PX, PZ, 2, 2)], 3 * PLATE_ROTATION.STEP);
    expect(a.rotations).toBe(3);
  });
});
