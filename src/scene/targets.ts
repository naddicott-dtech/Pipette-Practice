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

export const TRASH: Target = {
  position: [-5, 0, -2],
  radius: 1.0,
};

const SAMPLE_BASE_X = -3;
const SAMPLE_SPACING = 0.8;
const SAMPLE_Z = 2.5;

export const SAMPLE_TUBES: IndexedTarget[] = Array.from(
  { length: WORKFLOW.WELL_COUNT },
  (_, i) => ({
    index: i,
    position: [SAMPLE_BASE_X + i * SAMPLE_SPACING, 0, SAMPLE_Z],
    radius: 0.45,
  }),
);

const GEL_CENTER_X = 3;
const WELL_SPACING = 1.2;
const WELL_Z = 0.5;

export const WELLS: IndexedTarget[] = Array.from(
  { length: WORKFLOW.WELL_COUNT },
  (_, i) => ({
    index: i,
    position: [
      GEL_CENTER_X + (i - (WORKFLOW.WELL_COUNT - 1) / 2) * WELL_SPACING,
      0.05,
      WELL_Z,
    ],
    radius: 0.6,
  }),
);

export const TABLE = {
  size: [15, 0.2, 10] as const,
  position: [0, -0.15, 0] as Vec3,
};
