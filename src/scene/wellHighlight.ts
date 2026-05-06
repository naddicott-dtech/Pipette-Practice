import type { HoverTarget, WorkflowStep as WS } from '../sim/types';
import { WorkflowStep } from '../sim/types';

/**
 * Per-well visual state for GelBox. Mirrors the
 * `isActive / isHovered / isUsed` pattern in SampleTubeRack.
 *
 *   active  — this is the well the workflow expects next
 *   hover   — the cursor is currently over this well
 *   loaded  — DNA has already been deposited (dna > 0)
 *
 * Pure so the GelBox subscriber stays small and testable.
 */
export interface WellHighlight {
  active: boolean;
  hover: boolean;
  loaded: boolean;
}

export function wellHighlight(
  id: number,
  activeStep: number,
  hoverTarget: HoverTarget,
  step: WS,
  dna: number,
): WellHighlight {
  const isLoadStep = step === WorkflowStep.LOAD_WELL;
  return {
    active: isLoadStep && id === activeStep,
    hover:
      isLoadStep &&
      hoverTarget?.kind === 'well' &&
      hoverTarget.index === id,
    loaded: dna > 0,
  };
}
