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

/**
 * Incubation + colony growth. After streaking, the player incubates: over
 * DURATION_MS we time-lapse discrete colonies emerging from the density
 * field. A colony's size is roughly constant (biology) — density controls
 * *how many* colonies seed, not how big each grows. So dilute zones resolve
 * into a few separated single colonies (the goal) while dense zones pack
 * many overlapping colonies into a confluent lawn (uncountable). Grading
 * keys off how many well-separated isolated colonies appear.
 */
export const INCUBATION = {
  /** Time-lapse length for colonies to grow from nothing to full size. */
  DURATION_MS: 6000,
} as const;

export const GROWTH = {
  /**
   * Anything you streaked can grow. Tied to MARK_MIN_DEPOSIT — "if it left a
   * mark, a cell can grow there" — so the diluted streak network isn't a
   * visible-but-sterile dead band. The seeding curve (below) makes faint
   * tails sparse, not empty.
   */
  MIN_VIABLE: STREAK_FIELD.MARK_MIN_DEPOSIT,
  /**
   * Expected colony seeds per cell: λ = SEED_BASELINE + SEED_RATE·density^SEED_EXP,
   * clamped to MAX_PER_CELL. The sub-linear exponent compresses the wide
   * density range (pool D≈1 vs diluted tails D≈0.005) so dense zones saturate
   * into a confluent lawn while dilute zones scatter separated single colonies.
   * SEED_BASELINE is a small "luck floor": a lucky lone ancestor can drop off
   * the loop anywhere a streak was laid, so every marked cell has a nonzero
   * chance — coverage is always rewarded. Per-cell mulberry32 keeps it
   * deterministic/testable.
   */
  SEED_BASELINE: 0.03,
  SEED_RATE: 2.5,
  SEED_EXP: 0.5,
  MAX_PER_CELL: 3,
  /** Final colony radius (world units); near-constant regardless of density. */
  COLONY_RADIUS: 0.07,
  /** Fractional radius variation per colony (deterministic jitter). */
  RADIUS_JITTER: 0.3,
  /** Buffer + perf cap on total colonies; a hit thins evenly (stride), not by row. */
  MAX_COLONIES: 2500,
  /** Two colony centers closer than this count as touching (not isolated). */
  ISOLATION_DIST: 0.16,
  /** Field density at/above which a cell counts as heavy/confluent growth. */
  CONFLUENT_D: 0.3,
  /** How many confluent cells constitute a real lawn zone (gradient evidence). */
  CONFLUENT_MIN_CELLS: 30,
  /** Isolated-colony counts for the ballpark grade. */
  GOOD_ISO: 6,
  GREAT_ISO: 18,
} as const;

/**
 * Technique analysis — grades *how* the plate was streaked, not just what
 * grew. The colony outcome can look great by accident (e.g. a "starburst" of
 * lines all re-dipped from the inoculum still scatters isolated colonies), so
 * these path-derived checks catch sloppy technique and cap the headline grade.
 * Thresholds are heuristic and tuned against scripted runs; tweak freely.
 */
export const TECHNIQUE = {
  /** Multiplier on POOL.radius for "the loop is back in the inoculum". */
  POOL_TOUCH_FACTOR: 1.1,
  /**
   * Re-dipping flaw at/above this many inoculum re-entries. Proper serial
   * dilution dips the pool once (zone 1) then never returns; a starburst dips
   * on every line. Tolerant of an enthusiastic multi-stroke zone 1.
   */
  REDIP_MAX_ENTRIES: 6,
  /** Min streaked cells (outside the pool) before quadrant/coverage flaws apply. */
  MIN_STREAKED: 30,
  /**
   * Over-crossing is measured geometrically, not by density: the dilution model
   * self-limits a cell's density to ~0.02 at equilibrium, so re-streaking never
   * builds a "heavy" cell. Instead, a cell whose path-point hit count reaches
   * OVERLAP_HITS has been crossed ~3-4 times — the player re-covered streaked
   * agar. (A single pass leaves ~1-2 points per cell; a good zone-to-zone link
   * crosses the prior streak only a few times, staying under this.)
   */
  OVERLAP_HITS: 6,
  /** Over-crossing flaw when this fraction of stroke points land in re-crossed cells. */
  OVERSMEAR_RATIO: 0.3,
  /** Coarse occupancy grid for the "use the whole plate" check. */
  COVERAGE_BINS: 8,
  /** Underuse flaw when occupied in-disc bins fall below this fraction. */
  WHOLE_PLATE_MIN: 0.25,
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
