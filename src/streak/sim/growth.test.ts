import { describe, it, expect } from 'vitest';
import { createField, seedPool, type StreakField } from './streakField';
import {
  generateColonies,
  growthRadius,
  classifyStreak,
  type Colony,
} from './growth';
import { GROWTH, POOL, STREAK_FIELD } from './config';

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
    const low = generateColonies(uniformField(0.1)).length;
    const high = generateColonies(uniformField(0.6)).length;
    expect(high).toBeGreaterThan(low);
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
  it('grades widely-spaced colonies as great', () => {
    const colonies: Colony[] = [];
    const gap = GROWTH.ISOLATION_DIST * 3;
    for (let i = 0; i < GROWTH.GREAT_MIN + 2; i++) {
      colonies.push({ x: i * gap, z: 0, r: GROWTH.COLONY_RADIUS });
    }
    const v = classifyStreak(colonies);
    expect(v.isolatedCount).toBe(colonies.length);
    expect(v.grade).toBe('great');
  });

  it('grades a packed confluent cluster as ok (no isolated colonies)', () => {
    const colonies: Colony[] = [];
    const tiny = GROWTH.ISOLATION_DIST / 4;
    for (let i = 0; i < 50; i++) {
      colonies.push({ x: (i % 7) * tiny, z: Math.floor(i / 7) * tiny, r: GROWTH.COLONY_RADIUS });
    }
    const v = classifyStreak(colonies);
    expect(v.isolatedCount).toBe(0);
    expect(v.grade).toBe('ok');
  });

  it('grades near-empty growth as ok', () => {
    expect(classifyStreak([]).grade).toBe('ok');
    expect(classifyStreak([{ x: 0, z: 0, r: GROWTH.COLONY_RADIUS }]).grade).toBe('ok');
  });
});
