/**
 * Y-axis landmark constants for the gel chamber. Shared between GelBox
 * (which renders the meshes) and config-side tests (which assert that
 * descent thresholds line up with these landmarks).
 *
 * Numbers reflect the chamber geometry hard-coded in GelBox.tsx:
 *   - buffer chamber centered at world y=0, height 0.5 → top y=0.25
 *   - gel slab at world y=-0.1, height 0.3 → top y=0.05, bottom y=-0.25
 *   - well box at world y=0.05 (from targets.ts WELLS), height 0.2 →
 *     top y=0.15, bottom y=-0.05
 */
export const SCENE_LANDMARKS = {
  BUFFER_SURFACE_Y: 0.25,
  WELL_RIM_Y: 0.15,
  WELL_FLOOR_Y: -0.05,
  /**
   * Local-Y offset from the pipette body center to the disposable tip's
   * apex. Matches the geometry in src/components/Pipette.tsx: tip group
   * at local y=-1.55 with a length-0.9 cone oriented apex-down →
   * apex at body local y = -1.55 - 0.45 = -2.0.
   */
  PIPETTE_BODY_TO_TIP_APEX: 2.0,
} as const;
