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
 * ACTION offset relative to the locked target. Slight isometric tilt
 * (~5°), camera offset to the +x/+y/+z corner — close enough to read the
 * plunger's depression, far enough to see the tip and target together.
 */
const ACTION_OFFSET: Vec3 = [1.5, 1.0, 4];
const ACTION_FOV = 30;

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
  return {
    position: [tx + ACTION_OFFSET[0], ty + ACTION_OFFSET[1], tz + ACTION_OFFSET[2]],
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
