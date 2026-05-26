import { describe, it, expect } from 'vitest';
import {
  PLATE,
  POOL,
  LOOP_HOLDER,
  LOOP,
  CAMERA,
  STREAK_FIELD,
  PATH,
  PLATE_ROTATION,
  INCUBATION,
  GROWTH,
  TECHNIQUE,
} from './config';

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

  it('defines a thin tilted loop that lifts off the agar', () => {
    expect(LOOP.HANDLE_LENGTH).toBeGreaterThan(0);
    expect(LOOP.TILT_X).toBeGreaterThan(0);
    expect(LOOP.RING_TUBE).toBeLessThan(LOOP.RING_RADIUS);
    expect(LOOP.HOVER_LIFT).toBeGreaterThan(0);
  });

  it('starts the pool in the top-left corner of the top-down view', () => {
    expect(POOL.position[0]).toBeLessThan(0);
    expect(POOL.position[2]).toBeLessThan(0);
  });

  it('defines a well-formed dilution field', () => {
    expect(STREAK_FIELD.RESOLUTION).toBeGreaterThan(0);
    expect(STREAK_FIELD.HALF).toBe(PLATE.radius);
    expect(STREAK_FIELD.ALPHA).toBeGreaterThan(0);
    expect(STREAK_FIELD.ALPHA).toBeLessThan(1);
    expect(STREAK_FIELD.BETA).toBeGreaterThan(0);
    expect(STREAK_FIELD.BETA).toBeLessThan(1);
    expect(STREAK_FIELD.PICKUP_EXP).toBeGreaterThan(0);
    expect(STREAK_FIELD.PICKUP_EXP).toBeLessThan(1);
    expect(STREAK_FIELD.CARRIED_MAX).toBeGreaterThan(0);
    expect(STREAK_FIELD.DMAX).toBeGreaterThan(0);
    expect(STREAK_FIELD.STEP_DIST).toBeGreaterThan(0);
  });

  it('defines bounded stroke recording', () => {
    expect(PATH.MIN_SPACING).toBeGreaterThan(0);
    expect(PATH.MAX_POINTS_PER_STROKE).toBeGreaterThan(0);
    expect(PATH.MAX_STROKES).toBeGreaterThan(0);
  });

  it('defines a positive incubation duration', () => {
    expect(INCUBATION.DURATION_MS).toBeGreaterThan(0);
  });

  it('defines sane colony-growth constants', () => {
    expect(GROWTH.MIN_VIABLE).toBeGreaterThan(0);
    // Anything that left a visible mark can grow (no sterile dead band).
    expect(GROWTH.MIN_VIABLE).toBeLessThanOrEqual(STREAK_FIELD.MARK_MIN_DEPOSIT);
    expect(GROWTH.SEED_BASELINE).toBeGreaterThan(0);
    expect(GROWTH.SEED_RATE).toBeGreaterThan(0);
    expect(GROWTH.SEED_EXP).toBeGreaterThan(0);
    expect(GROWTH.MAX_PER_CELL).toBeGreaterThan(0);
    expect(GROWTH.COLONY_RADIUS).toBeGreaterThan(0);
    expect(GROWTH.RADIUS_JITTER).toBeGreaterThanOrEqual(0);
    expect(GROWTH.MAX_COLONIES).toBeGreaterThan(0);
    expect(GROWTH.ISOLATION_DIST).toBeGreaterThan(0);
    expect(GROWTH.CONFLUENT_D).toBeGreaterThan(0);
    expect(GROWTH.CONFLUENT_D).toBeLessThanOrEqual(STREAK_FIELD.DMAX);
    expect(GROWTH.CONFLUENT_MIN_CELLS).toBeGreaterThan(0);
    expect(GROWTH.GOOD_ISO).toBeGreaterThan(0);
    expect(GROWTH.GREAT_ISO).toBeGreaterThanOrEqual(GROWTH.GOOD_ISO);
  });

  it('rotates a quarter turn counter-clockwise', () => {
    // Positive rotation.y is CCW from the top-down streak camera.
    expect(PLATE_ROTATION.STEP).toBe(Math.PI / 2);
    expect(PLATE_ROTATION.TRANSITION_MS).toBeGreaterThan(0);
  });

  it('defines sane technique-analysis constants', () => {
    expect(TECHNIQUE.POOL_TOUCH_FACTOR).toBeGreaterThanOrEqual(1);
    expect(TECHNIQUE.REDIP_MAX_ENTRIES).toBeGreaterThan(1);
    expect(TECHNIQUE.MIN_STREAKED).toBeGreaterThan(0);
    // Over-crossing is a path-revisit count, not a density (the field self-limits).
    expect(TECHNIQUE.OVERLAP_HITS).toBeGreaterThan(2);
    expect(TECHNIQUE.OVERSMEAR_RATIO).toBeGreaterThan(0);
    expect(TECHNIQUE.OVERSMEAR_RATIO).toBeLessThanOrEqual(1);
    expect(TECHNIQUE.COVERAGE_BINS).toBeGreaterThanOrEqual(2);
    expect(TECHNIQUE.WHOLE_PLATE_MIN).toBeGreaterThan(0);
    expect(TECHNIQUE.WHOLE_PLATE_MIN).toBeLessThanOrEqual(1);
    expect(TECHNIQUE.LINK_RADIUS).toBeGreaterThan(0);
    expect(TECHNIQUE.MAX_UNLINKED).toBeGreaterThanOrEqual(1);
  });
});
