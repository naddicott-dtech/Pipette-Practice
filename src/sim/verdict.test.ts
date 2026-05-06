import { describe, it, expect } from 'vitest';
import { verdictForLane, verdictsForRun } from './verdict';
import { initialRuleState } from './rules';
import type { RuleState, WarningRecord } from './types';

function state(overrides: Partial<RuleState> = {}): RuleState {
  return { ...initialRuleState(), ...overrides };
}

const FULL = [1, 1, 1, 1];

describe('verdictForLane', () => {
  it("returns 'missing' when the lane has no DNA", () => {
    const s = state({ dnaInWells: [1, 0, 1, 1] });
    expect(verdictForLane(1, s)).toBe('missing');
  });

  it("returns 'clean' for a loaded lane with no warnings", () => {
    const s = state({ dnaInWells: FULL });
    expect(verdictForLane(0, s)).toBe('clean');
  });

  it("returns 'faint' when SOFT_STOP_TO_EJECT recorded for the lane", () => {
    const s = state({
      dnaInWells: FULL,
      warnings: [{ code: 'SOFT_STOP_TO_EJECT', lane: 2 }],
    });
    expect(verdictForLane(2, s)).toBe('faint');
  });

  it("returns 'overdraw' when OVERDRAW recorded for the lane", () => {
    const s = state({
      dnaInWells: FULL,
      warnings: [{ code: 'OVERDRAW', lane: 0 }],
    });
    expect(verdictForLane(0, s)).toBe('overdraw');
  });

  it("returns 'muddled' when NO_FRESH_TIP recorded for the lane", () => {
    const s = state({
      dnaInWells: FULL,
      warnings: [{ code: 'NO_FRESH_TIP', lane: 1 }],
    });
    expect(verdictForLane(1, s)).toBe('muddled');
  });

  it("returns 'mislabeled' when WRONG_TUBE recorded for the lane", () => {
    const s = state({
      dnaInWells: FULL,
      warnings: [{ code: 'WRONG_TUBE', lane: 3 }],
    });
    expect(verdictForLane(3, s)).toBe('mislabeled');
  });

  it("returns 'loose-tip' when LOOSE_TIP recorded for the lane", () => {
    const s = state({
      dnaInWells: FULL,
      warnings: [{ code: 'LOOSE_TIP', lane: 0 }],
    });
    expect(verdictForLane(0, s)).toBe('loose-tip');
  });

  it('does not pick up warnings recorded against a different lane', () => {
    const s = state({
      dnaInWells: FULL,
      warnings: [{ code: 'SOFT_STOP_TO_EJECT', lane: 0 }],
    });
    expect(verdictForLane(2, s)).toBe('clean');
  });

  it('picks the most severe verdict on a tie (mislabeled > faint)', () => {
    const warnings: WarningRecord[] = [
      { code: 'SOFT_STOP_TO_EJECT', lane: 0 },
      { code: 'WRONG_TUBE', lane: 0 },
    ];
    const s = state({ dnaInWells: FULL, warnings });
    expect(verdictForLane(0, s)).toBe('mislabeled');
  });

  it('picks the most severe verdict on a tie (muddled > overdraw)', () => {
    const warnings: WarningRecord[] = [
      { code: 'OVERDRAW', lane: 1 },
      { code: 'NO_FRESH_TIP', lane: 1 },
    ];
    const s = state({ dnaInWells: FULL, warnings });
    expect(verdictForLane(1, s)).toBe('muddled');
  });

  it("'missing' beats every other verdict (dna === 0 is decisive)", () => {
    // Even with warnings recorded, no DNA means no band — verdict is missing.
    const s = state({
      dnaInWells: [1, 0, 1, 1],
      warnings: [{ code: 'WRONG_TUBE', lane: 1 }],
    });
    expect(verdictForLane(1, s)).toBe('missing');
  });
});

describe('verdictsForRun', () => {
  it('produces one verdict per well in array order', () => {
    const s = state({
      dnaInWells: [1, 1, 0, 1],
      warnings: [
        { code: 'OVERDRAW', lane: 0 },
        { code: 'WRONG_TUBE', lane: 3 },
      ],
    });
    expect(verdictsForRun(s)).toEqual([
      'overdraw',
      'clean',
      'missing',
      'mislabeled',
    ]);
  });
});
