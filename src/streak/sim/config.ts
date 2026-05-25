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
  // Top-left corner of the top-down view (−x, −z). The first quadrant is
  // streaked out of this drop; rotating the plate moves it out of the way.
  position: [-1.5, PLATE.surfaceY, -1.5] as Vec3,
  radius: 0.4,
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
  /**
   * How far above the agar the loop floats while not streaking (phase
   * 'free'). Holding to streak lowers it to the contact point; releasing
   * lifts it back up by this much.
   */
  HOVER_LIFT: 0.28,
} as const;

/**
 * Dilution-field model for streaking. The agar holds a density grid; the
 * loop carries a scalar load. At each contact step the loop picks up
 * `ALPHA·D^PICKUP_EXP` from the cell and deposits `BETA·C` of its load.
 * Dragging from the dense pool into fresh agar bleeds the load down
 * geometrically, so a streak fades along its length toward isolated colonies.
 */
export const STREAK_FIELD = {
  /** Grid cells per axis across the plate's 2R bounding box. */
  RESOLUTION: 96,
  /** Half-width of the grid = plate radius. */
  HALF: PLATE.radius,
  /** Scale on the per-contact pickup (see PICKUP_EXP). */
  ALPHA: 0.35,
  /**
   * Pickup is `ALPHA · D^PICKUP_EXP`. The sub-linear exponent is a
   * deliberate "cheat": dragging through a *thin* prior-quadrant streak
   * reloads the loop disproportionately more than its faint density would
   * physically give, so the serial dilution stays visible through the
   * third/fourth rotation (matching how the technique actually looks) — at
   * the dense pool (D≈1) it's unchanged.
   */
  PICKUP_EXP: 0.6,
  /**
   * Fraction of the loop's carried load deposited per contact. Low, so the
   * load bleeds off slowly and a streak tracks a long way — dense at the
   * start, tapering to a thin but persistent tail — instead of dying out
   * within a centimeter. The geometric decay is still what drives dilution.
   */
  BETA: 0.025,
  /** Max per-cell density (saturation). */
  DMAX: 1,
  /** Clamp on the loop's carried load (keeps the pickup cheat bounded). */
  CARRIED_MAX: 1.5,
  /** Density painted into the pre-seeded pool. */
  POOL_DENSITY: 1,
  /** World units of travel per contact step (distance-based integration). */
  STEP_DIST: 0.04,
  /** Deposits below this don't bother drawing a visible mark. */
  MARK_MIN_DEPOSIT: 0.0004,
} as const;

/** Stroke-recording bounds (decimation + caps keep buffers bounded). */
export const PATH = {
  MIN_SPACING: 0.03,
  MAX_POINTS_PER_STROKE: 700,
  MAX_STROKES: 16,
} as const;

/**
 * Plate rotation: one counter-clockwise quarter turn per press. Positive
 * rotation.y reads as counter-clockwise from the top-down streak camera.
 */
export const PLATE_ROTATION = {
  STEP: Math.PI / 2,
  TRANSITION_MS: 350,
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
