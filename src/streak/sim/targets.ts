import type { Vec3 } from '../../sim/types';
import { PLATE, LOOP_HOLDER } from './config';

export interface StreakTarget {
  position: Vec3;
  radius: number;
}

export interface StreakTargetSet {
  loopHolder: StreakTarget;
  plate: StreakTarget;
}

export const STREAK_TARGETS: StreakTargetSet = {
  loopHolder: { position: LOOP_HOLDER.position, radius: LOOP_HOLDER.radius },
  plate: { position: PLATE.position, radius: PLATE.radius },
};
