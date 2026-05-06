/**
 * Pure helpers for camera presets. The ACTION preset is computed
 * per-target so the camera always frames the locked object instead of a
 * fixed scene origin (which was the C0 hotfix's pre-existing bug). Pure
 * functions so unit tests can pin the geometry without an r3f harness.
 */

import { CAMERA } from '../sim/config';
import type { LockTarget, Vec3 } from '../sim/types';
import { TIP_RACK, TRASH, SAMPLE_TUBES, WELLS } from './targets';

export interface CameraPreset {
  position: Vec3;
  lookAt: Vec3;
  fov: number;
}

export const OVERVIEW_PRESET: CameraPreset = {
  position: CAMERA.OVERVIEW.position,
  lookAt: CAMERA.OVERVIEW.lookAt,
  fov: CAMERA.OVERVIEW.fov,
};

/**
 * Default ACTION offset (tip rack / sample tubes / trash) — slight
 * isometric tilt, camera offset to the +x/+y/+z corner. Close enough
 * to read the plunger's depression, far enough to see the tip and
 * target together.
 */
const DEFAULT_ACTION_OFFSET: Vec3 = [1.5, 1.0, 4];

/**
 * Wells get an "almost-side" view from +X so the LOAD_WELL descent
 * stays in frame end-to-end. Camera at +3 in X keeps it outside the
 * chamber's right wall (chamber spans world x=-1..7); +1.5 in Y is
 * just above the tip's start position so the apex is visible from the
 * first frame; +1 in Z gives a small angle so the view isn't flat.
 */
const WELL_ACTION_OFFSET: Vec3 = [3, 1.5, 1];

const ACTION_FOV = 30;

function actionOffsetFor(kind: LockTarget['kind']): Vec3 {
  return kind === 'well' ? WELL_ACTION_OFFSET : DEFAULT_ACTION_OFFSET;
}

/** World position for a given lock target. Used as the ACTION lookAt. */
export function lockTargetPosition(target: LockTarget): Vec3 {
  switch (target.kind) {
    case 'tip-rack':
      return TIP_RACK.position;
    case 'trash':
      return TRASH.position;
    case 'sample':
      return SAMPLE_TUBES[target.index].position;
    case 'well':
      return WELLS[target.index].position;
  }
}

export function actionPresetFor(target: LockTarget): CameraPreset {
  const [tx, ty, tz] = lockTargetPosition(target);
  const offset = actionOffsetFor(target.kind);
  return {
    position: [tx + offset[0], ty + offset[1], tz + offset[2]],
    lookAt: [tx, ty, tz],
    fov: ACTION_FOV,
  };
}

/** RUN preset — frames the gel for the electrophoresis animation. */
export const RUN_PRESET: CameraPreset = {
  position: [4, 6, 14],
  lookAt: [3, 0, -1],
  fov: 32,
};
