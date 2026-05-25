import type { Vec3 } from '../../sim/types';

/**
 * World constants for the streak-plating scene. Units match the pipette
 * sim (~3-4 cm per unit); the table top sits at y≈0.
 */

export const PLATE = {
  position: [0, 0, 0] as Vec3,
  /** Hover/visual radius of the agar disc. */
  radius: 3,
  /** World Y of the agar surface (streaks/colonies sit just above this). */
  surfaceY: 0.3,
} as const;

/**
 * Pre-seeded bacterial pool — the 100 µL drop applied to one quadrant
 * before streaking (pipetting itself is hand-waved this slice).
 */
export const POOL = {
  position: [1.6, PLATE.surfaceY, 1.6] as Vec3,
  radius: 0.5,
} as const;

/** Stand holding the sealed sterile loop, off to the side of the plate. */
export const LOOP_HOLDER = {
  position: [-5, 0, 1.5] as Vec3,
  radius: 1.3,
} as const;

export const LOOP = {
  FOLLOW_LERP: 0.1,
  HANDLE_LENGTH: 3.6,
  HANDLE_RADIUS_TOP: 0.04,
  HANDLE_RADIUS_BOTTOM: 0.05,
  RING_RADIUS: 0.32,
  RING_TUBE: 0.07,
  /**
   * Tilt of the loop's plane away from vertical (radians). The handle is
   * coplanar with the ring (the shaft axis is a diameter of the donut, so
   * extending it runs back through the donut), and the whole assembly is
   * tilted so the ring's bottom edge — not the flat face — rests on the
   * agar, the way a real loop is held to streak. ~0 = upright (reads as a
   * line from above); ~π/2 = flat. Loop.tsx pins the bottom edge to the
   * surface under the cursor.
   */
  TILT_X: 0.7,
  /** Resting pose in the holder before pickup (the ring's contact point). */
  REST_POSITION: [-5, 0.5, 1.1] as Vec3,
} as const;

export const CAMERA = {
  /** Angled framing of the bench (plate + loop holder) during GET_LOOP. */
  OVERVIEW: {
    position: [-2, 11, 12] as Vec3,
    lookAt: [-1.5, 0, 0.5] as Vec3,
    fov: 35,
  },
  /** Near-top-down on the plate for streaking (slight tilt avoids a
      degenerate straight-down look vector). */
  STREAK_VIEW: {
    position: [0, 14, 4] as Vec3,
    lookAt: [0, 0, 0] as Vec3,
    fov: 32,
  },
  TRANSITION_MS: 450,
} as const;
