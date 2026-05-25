import { describe, it, expect } from 'vitest';
import { PLATE, POOL, LOOP_HOLDER, LOOP, CAMERA } from './config';

describe('streak config invariants', () => {
  it('has positive radii', () => {
    expect(PLATE.radius).toBeGreaterThan(0);
    expect(POOL.radius).toBeGreaterThan(0);
    expect(LOOP_HOLDER.radius).toBeGreaterThan(0);
  });

  it('keeps the pre-seeded pool fully inside the plate', () => {
    const dx = POOL.position[0] - PLATE.position[0];
    const dz = POOL.position[2] - PLATE.position[2];
    const distFromCenter = Math.hypot(dx, dz);
    expect(distFromCenter + POOL.radius).toBeLessThan(PLATE.radius);
  });

  it('sits the pool on the agar surface', () => {
    expect(POOL.position[1]).toBe(PLATE.surfaceY);
  });

  it('defines well-formed camera presets', () => {
    for (const preset of [CAMERA.OVERVIEW, CAMERA.STREAK_VIEW]) {
      expect(preset.position).toHaveLength(3);
      expect(preset.lookAt).toHaveLength(3);
      expect(preset.fov).toBeGreaterThan(0);
    }
    expect(CAMERA.TRANSITION_MS).toBeGreaterThan(0);
  });

  it('defines a thin tilted loop', () => {
    expect(LOOP.HANDLE_LENGTH).toBeGreaterThan(0);
    expect(LOOP.TILT_X).toBeGreaterThan(0);
    expect(LOOP.RING_TUBE).toBeLessThan(LOOP.RING_RADIUS);
  });
});
