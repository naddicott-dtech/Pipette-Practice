/**
 * Pure resolver: given the workflow / interaction state, what should the
 * on-screen prompt say? Extracted from the Prompt component so the copy
 * decision tree is testable and isolated from rendering.
 */

import type { HoverTarget, InteractionPhase, WorkflowStep as WS } from './types';
import { WorkflowStep } from './types';

export interface PromptInput {
  step: WS;
  interactionPhase: InteractionPhase;
  hoverTarget: HoverTarget;
  /** 0..WELL_COUNT-1; the lane the player is currently working on. */
  activeStep: number;
}

export interface PromptCopy {
  /** Primary one-line instruction. */
  text: string;
  /** Optional secondary hint, shown smaller below `text`. */
  detail?: string;
  /** Tone hint for the UI: 'instruct' | 'progress' | 'silent'. */
  tone: 'instruct' | 'progress' | 'silent';
}

const SILENT: PromptCopy = { text: '', tone: 'silent' };

function laneLabel(index: number): string {
  // Display is 1-indexed; "DNA 1" / "Well 1" reads better than "0".
  return String(index + 1);
}

export function resolvePrompt(input: PromptInput): PromptCopy {
  const { step, interactionPhase, hoverTarget, activeStep } = input;

  // Run / complete phases short-circuit; the action is a button, not a lock.
  if (step === WorkflowStep.RUN_GEL && interactionPhase === 'free') {
    return {
      text: 'Press Start Power Supply to run the gel.',
      tone: 'instruct',
    };
  }
  if (step === WorkflowStep.COMPLETE) {
    return {
      text: 'Run complete. Review the results below.',
      tone: 'progress',
    };
  }

  switch (interactionPhase) {
    case 'free':
      return resolveFree(step, hoverTarget, activeStep);
    case 'committing':
      return { text: 'Locking on…', tone: 'progress' };
    case 'locked':
      return resolveLocked(step);
    case 'acting':
      return resolveActing(step);
    case 'finishing':
      return SILENT;
  }
}

function resolveFree(step: WS, hover: HoverTarget, activeStep: number): PromptCopy {
  switch (step) {
    case WorkflowStep.GET_TIP:
      return hover?.kind === 'tip-rack'
        ? { text: 'Click or press Space to pick up a fresh tip.', tone: 'instruct' }
        : { text: 'Move your cursor over the tip rack.', tone: 'instruct' };

    case WorkflowStep.DRAW_SAMPLE:
      if (hover?.kind === 'sample') {
        const tubeLabel = `DNA ${laneLabel(hover.index)}`;
        const isActive = hover.index === activeStep;
        return {
          text: `Click or press Space to draw from ${tubeLabel}.`,
          detail: isActive
            ? undefined
            : `(${tubeLabel} doesn't match your active sample — this will warn.)`,
          tone: 'instruct',
        };
      }
      return {
        text: `Move your cursor over DNA ${laneLabel(activeStep)}.`,
        tone: 'instruct',
      };

    case WorkflowStep.LOAD_WELL:
      if (hover?.kind === 'well') {
        const wellLabel = `Well ${laneLabel(hover.index)}`;
        const isActive = hover.index === activeStep;
        return {
          text: `Click or press Space to load ${wellLabel}.`,
          detail: isActive
            ? undefined
            : `(${wellLabel} doesn't match your active sample — this will warn.)`,
          tone: 'instruct',
        };
      }
      return {
        text: `Move your cursor over Well ${laneLabel(activeStep)}.`,
        tone: 'instruct',
      };

    case WorkflowStep.DISCARD_TIP:
      return hover?.kind === 'trash'
        ? { text: 'Click or press Space to discard the tip.', tone: 'instruct' }
        : { text: 'Move your cursor over the trash.', tone: 'instruct' };

    case WorkflowStep.RUN_GEL:
    case WorkflowStep.COMPLETE:
      return SILENT;
  }
}

function resolveLocked(step: WS): PromptCopy {
  switch (step) {
    case WorkflowStep.GET_TIP:
      return { text: 'Hold Space to pick up the tip.', tone: 'instruct' };
    case WorkflowStep.DRAW_SAMPLE:
      return {
        text: 'Hold Space to draw.',
        detail: 'Release when you feel and hear the click.',
        tone: 'instruct',
      };
    case WorkflowStep.LOAD_WELL:
      return {
        text: 'Hold Space to dispense.',
        detail: 'Press past the click for full delivery.',
        tone: 'instruct',
      };
    case WorkflowStep.DISCARD_TIP:
      return { text: 'Hold Space to discard the tip.', tone: 'instruct' };
    case WorkflowStep.RUN_GEL:
    case WorkflowStep.COMPLETE:
      return SILENT;
  }
}

function resolveActing(step: WS): PromptCopy {
  switch (step) {
    case WorkflowStep.DRAW_SAMPLE:
      return {
        text: 'Drawing…',
        detail: 'Release at the click.',
        tone: 'progress',
      };
    case WorkflowStep.LOAD_WELL:
      return {
        text: 'Dispensing…',
        detail: 'Press past the click.',
        tone: 'progress',
      };
    case WorkflowStep.GET_TIP:
    case WorkflowStep.DISCARD_TIP:
      return { text: 'Pressing…', tone: 'progress' };
    case WorkflowStep.RUN_GEL:
    case WorkflowStep.COMPLETE:
      return SILENT;
  }
}
