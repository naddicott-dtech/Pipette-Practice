import { describe, it } from 'vitest';

/**
 * Test scaffold for Chunk C — the rules layer.
 *
 * These `it.todo` markers come straight from the failure-mode table in
 * docs/fix-plan.md. They run in the test suite as "planned" entries:
 * they don't fail CI, but they do show up in the report so future work
 * has a definitive checklist.
 *
 * When implementing Chunk C: replace each `it.todo` with `it`, write the
 * body, import the rule, and assert against `Result = { nextState, events }`.
 *
 * The rule signatures (per fix-plan.md):
 *   tryPickUpTip(state, hover, lowered) → Result
 *   tryDrawSample(state, hover, plungerPath) → Result
 *   tryEjectIntoWell(state, hover, plungerPath, depth) → Result
 *   tryDiscardTip(state, hover, lowered) → Result
 */

describe('rules.tryPickUpTip', () => {
  it.todo('picks up a tip when over the tip rack and lowered');
  it.todo('does nothing when not lowered');
  it.todo('does nothing when not over the tip rack');
  it.todo('advances workflow GET_TIP → DRAW_SAMPLE on successful pickup');
  it.todo('does not pick up a second tip without discarding the first');
});

describe('rules.tryDrawSample', () => {
  it.todo('draws sample when over the right tube, plunger crosses SOFT_STOP');
  it.todo('NO_FRESH_TIP warning when drawing from a different tube without discarding tip');
  it.todo('HARD_STOP_TO_DRAW failure when plunger reaches HARD_STOP while submerged');
  it.todo('does nothing when over wrong tube for the active workflow well');
  it.todo('NO_TIP failure when lowering into sample tube without a tip');
  it.todo('advances workflow DRAW_SAMPLE(n) → LOAD_WELL(n) when liquid is full');
});

describe('rules.tryEjectIntoWell', () => {
  it.todo('ejects DNA when fully lowered and plunger crosses HARD_STOP');
  it.todo('NOT_LOW_ENOUGH failure when ejecting before reaching full depth');
  it.todo('SOFT_STOP_TO_EJECT warning when plunger stops within SOFT_STOP tolerance');
  it.todo('partial DNA delivered on SOFT_STOP_TO_EJECT (faint band)');
  it.todo('PUNCTURE failure already wired in InteractionDriver — no duplicate test here');
  it.todo('advances workflow LOAD_WELL(n) → DISCARD_TIP after successful eject');
});

describe('rules.tryDiscardTip', () => {
  it.todo('discards tip when over the trash and lowered');
  it.todo('clears liquidInTip on discard');
  it.todo('advances workflow DISCARD_TIP → if n<COUNT: GET_TIP else RUN_GEL');
});

describe('rules — integration / property tests', () => {
  it.todo('full happy path: 4 wells loaded, transitions to RUN_GEL');
  it.todo('any failure resets workflow to GET_TIP via reset()');
  it.todo('warnings accumulate without resetting workflow');
});
