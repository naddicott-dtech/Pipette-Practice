import { describe, it, expect } from 'vitest';
import { findStreakHover } from './hover';
import { STREAK_TARGETS } from './targets';
import { LOOP_HOLDER, PLATE } from './config';

describe('findStreakHover', () => {
  it('resolves the loop holder at its center', () => {
    const [x, , z] = LOOP_HOLDER.position;
    expect(findStreakHover({ x, z }, STREAK_TARGETS)).toEqual({ kind: 'loop-holder' });
  });

  it('resolves the plate at its center', () => {
    const [x, , z] = PLATE.position;
    expect(findStreakHover({ x, z }, STREAK_TARGETS)).toEqual({ kind: 'plate' });
  });

  it('returns null in the dead zone between targets', () => {
    // Midway between holder (-5) and plate edge (-3), outside both radii.
    expect(findStreakHover({ x: -4, z: -3 }, STREAK_TARGETS)).toBeNull();
  });

  it('returns null well beyond the plate', () => {
    expect(findStreakHover({ x: 20, z: 20 }, STREAK_TARGETS)).toBeNull();
  });

  it('detects a point just inside the plate radius', () => {
    expect(
      findStreakHover({ x: PLATE.radius - 0.05, z: 0 }, STREAK_TARGETS),
    ).toEqual({ kind: 'plate' });
  });
});
