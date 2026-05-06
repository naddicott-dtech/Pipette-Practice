import type { RuleState, WarningCode, WarningRecord } from './types';

/**
 * End-of-run verdict for a single lane on the gel. Synthesizes the
 * warnings array (per-lane, append-only since C2) plus the well's
 * loaded volume into a single observable outcome the player sees in
 * the debrief modal. Pure function — keyed off RuleState only, no
 * dependency on UI or scene.
 *
 * Verdicts describe the BAND (what shows up on the gel); the related
 * warning codes describe the TECHNIQUE (what the player did). A clean
 * lane has neither.
 */
export type VerdictCode =
  | 'clean'
  | 'faint'
  | 'overdraw'
  | 'muddled'
  | 'mislabeled'
  | 'loose-tip'
  | 'missing';

/**
 * Severity ordering — lower number wins on ties when multiple
 * warnings hit one lane. The most diagnostically important verdict
 * surfaces; the toast already showed each warning live.
 */
const SEVERITY: Record<VerdictCode, number> = {
  missing: 1,
  muddled: 2,
  mislabeled: 3,
  faint: 4,
  overdraw: 5,
  'loose-tip': 6,
  clean: 7,
};

const VERDICT_BY_WARNING: Record<WarningCode, VerdictCode> = {
  NO_FRESH_TIP: 'muddled',
  WRONG_TUBE: 'mislabeled',
  SOFT_STOP_TO_EJECT: 'faint',
  OVERDRAW: 'overdraw',
  LOOSE_TIP: 'loose-tip',
};

export function verdictForLane(
  laneIndex: number,
  state: RuleState,
): VerdictCode {
  if ((state.dnaInWells[laneIndex] ?? 0) === 0) return 'missing';

  const candidates: VerdictCode[] = [];
  for (const w of state.warnings) {
    if (w.lane === laneIndex) {
      candidates.push(VERDICT_BY_WARNING[w.code]);
    }
  }
  if (candidates.length === 0) return 'clean';

  let chosen = candidates[0];
  for (const c of candidates) {
    if (SEVERITY[c] < SEVERITY[chosen]) chosen = c;
  }
  return chosen;
}

/** Test helper: full per-run table of verdicts. */
export function verdictsForRun(state: RuleState): VerdictCode[] {
  return state.dnaInWells.map((_, i) => verdictForLane(i, state));
}

/**
 * Re-export so tests can build minimal warnings arrays without
 * pulling all of types.ts.
 */
export type { WarningRecord };
