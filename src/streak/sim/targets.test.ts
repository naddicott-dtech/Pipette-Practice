import { describe, it, expect } from 'vitest';
import { STREAK_TARGETS } from './targets';

describe('streak targets', () => {
  it('holder and plate hit zones do not overlap', () => {
    const a = STREAK_TARGETS.loopHolder;
    const b = STREAK_TARGETS.plate;
    const dist = Math.hypot(
      a.position[0] - b.position[0],
      a.position[2] - b.position[2],
    );
    expect(dist).toBeGreaterThan(a.radius + b.radius);
  });

  it('places both targets on the table plane (y = 0)', () => {
    expect(STREAK_TARGETS.loopHolder.position[1]).toBe(0);
    expect(STREAK_TARGETS.plate.position[1]).toBe(0);
  });
});
