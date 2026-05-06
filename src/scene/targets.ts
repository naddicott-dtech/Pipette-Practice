import { WORKFLOW } from '../sim/config';
import type { Vec3 } from '../sim/types';

export interface Target {
  position: Vec3;
  radius: number;
}

export interface IndexedTarget extends Target {
  index: number;
}

export const TIP_RACK: Target = {
  position: [-5, 0, 2],
  radius: 1.5,
};

// 250 mL beaker behind the tip rack (top-left zone in the OVERVIEW
// camera). -Z is "back" of the table from the player's POV.
export const TRASH: Target = {
  position: [-5, 0, -2.5],
  radius: 0.9,
};

const SAMPLE_BASE_X = -3;
const SAMPLE_SPACING = 0.8;
const SAMPLE_Z = 2.5;

export const SAMPLE_TUBES: IndexedTarget[] = Array.from(
  { length: WORKFLOW.WELL_COUNT },
  (_, i) => ({
    index: i,
    position: [SAMPLE_BASE_X + i * SAMPLE_SPACING, 0, SAMPLE_Z],
    // Hover radius (0.6) overlaps adjacent tubes' radii by design — findHover
    // breaks ties by closer Manhattan distance, so the cursor still resolves
    // to the correct tube. The tubes' visual cylinders remain ~0.2 wide; this
    // is hit-target-only.
    radius: 0.6,
  }),
);

// Wells line up along Z on the right edge of the buffer chamber (chamber
// centered at GEL_ORIGIN x=3, half-width 4 → right edge at world x=7).
// Cathode (-) sits at the well end; anode (+) sits at world x=-1 so DNA
// migrates leftward during RUN_GEL. Real gel boxes have wells on one
// short edge — this matches that layout from the player's overview POV.
const WELL_X = 6;
const WELL_SPACING = 1.2;
const WELL_Y = 0.05;

export const WELLS: IndexedTarget[] = Array.from(
  { length: WORKFLOW.WELL_COUNT },
  (_, i) => ({
    index: i,
    position: [
      WELL_X,
      WELL_Y,
      (i - (WORKFLOW.WELL_COUNT - 1) / 2) * WELL_SPACING,
    ],
    radius: 0.6,
  }),
);

export const TABLE = {
  size: [15, 0.2, 10] as const,
  position: [0, -0.15, 0] as Vec3,
};
