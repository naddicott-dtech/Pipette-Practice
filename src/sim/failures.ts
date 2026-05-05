import type { FailureCode, WarningCode } from './types';

export interface FailureCopy {
  /** What technique failed. Headline of the modal or debrief lane. */
  title: string;
  /** Why it matters and what to do differently next time. */
  body: string;
  /** Surfaced after a second consecutive same-code failure. Optional. */
  hint?: string;
}

/**
 * Per-mode copy. The single source of truth for what a player sees when
 * a rule fires. The UI layer (FailureModal, Debrief) reads from this map
 * — no copy lives in JSX ternaries.
 *
 * Maintenance: when adding a new code in types.ts, add an entry here.
 * `failures.test.ts` enforces completeness.
 */
export const FAILURE_COPY: Record<FailureCode | WarningCode, FailureCopy> = {
  NO_TIP: {
    title: 'No tip on the pipette',
    body: "You tried to touch the sample without a fresh tip — that's a cross-contamination hazard. Pick up a tip first.",
    hint: 'Watch for the gold ring on the tip rack. Click or press Space when your cursor is over it.',
  },
  HARD_STOP_TO_DRAW: {
    title: 'Drew past the soft stop',
    body: "Pressing past the soft stop while drawing pushes air into the sample. Stop at the click — you'll feel and hear it.",
    hint: "Hold Space until you hear the click, then release. Don't keep pressing.",
  },
  EMPTY_EJECT: {
    title: 'Ejected with an empty tip',
    body: 'Your tip was empty when you pressed the plunger. Draw the sample to the soft stop first.',
    hint: "Look at the volume readout — if it says 'Empty', go back to the sample tube.",
  },
  SOFT_STOP_TO_EJECT: {
    title: 'Stopped at the soft stop',
    body: 'You only ejected the main volume; some sample stayed in the tip. The lane will look faint.',
    hint: 'Press past the click to deliver everything.',
  },
  NO_FRESH_TIP: {
    title: 'Reused a tip on a new sample',
    body: 'Each sample needs a fresh tip — otherwise samples mix and lanes show muddled bands.',
    hint: 'After loading a well, discard the tip in the trash before picking up a new one.',
  },
  WRONG_TUBE: {
    title: 'Drew from the wrong sample',
    body: 'DNA 1 goes into well 1, DNA 2 into well 2, and so on. The lane you load will be mislabeled.',
    hint: "Watch the highlighted tube — that's the one matching the next well.",
  },
};

/** Failure codes that halt the workflow and require `reset()`. */
export const FAILURE_CODES: FailureCode[] = [
  'NO_TIP',
  'HARD_STOP_TO_DRAW',
  'EMPTY_EJECT',
];

/** Warning codes that allow progress with a degraded lane. */
export const WARNING_CODES: WarningCode[] = [
  'SOFT_STOP_TO_EJECT',
  'NO_FRESH_TIP',
  'WRONG_TUBE',
];
