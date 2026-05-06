import { describe, it, expect } from 'vitest';
import {
  plungerDepthFromHoldMs,
  plungerOutcome,
  emptyCurve,
  startCurve,
  tickCurve,
  type PlungerCurve,
} from './plunger';
import { PLUNGER } from './config';

const SOFT_PAUSE_END_MS = PLUNGER.HOLD_TO_SOFT_MS + PLUNGER.SOFT_STOP_RESISTANCE_MS;

describe('plungerDepthFromHoldMs — boundary points', () => {
  it('rests at 0 for non-positive holdMs', () => {
    expect(plungerDepthFromHoldMs(0)).toBe(PLUNGER.REST);
    expect(plungerDepthFromHoldMs(-50)).toBe(PLUNGER.REST);
  });

  it('reaches half soft-stop at the linear midpoint', () => {
    const half = PLUNGER.HOLD_TO_SOFT_MS / 2;
    expect(plungerDepthFromHoldMs(half)).toBeCloseTo(PLUNGER.SOFT_STOP / 2, 5);
  });

  it('reaches soft-stop exactly at HOLD_TO_SOFT_MS', () => {
    expect(plungerDepthFromHoldMs(PLUNGER.HOLD_TO_SOFT_MS)).toBeCloseTo(PLUNGER.SOFT_STOP, 5);
  });

  it('holds at soft-stop through the resistance window', () => {
    const mid = PLUNGER.HOLD_TO_SOFT_MS + PLUNGER.SOFT_STOP_RESISTANCE_MS / 2;
    expect(plungerDepthFromHoldMs(mid)).toBeCloseTo(PLUNGER.SOFT_STOP, 5);
  });

  it('begins climbing again right after the resistance window', () => {
    expect(plungerDepthFromHoldMs(SOFT_PAUSE_END_MS)).toBeCloseTo(PLUNGER.SOFT_STOP, 5);
    const span = PLUNGER.HOLD_TO_HARD_MS - SOFT_PAUSE_END_MS;
    const aQuarterPast = SOFT_PAUSE_END_MS + span / 4;
    const expected = PLUNGER.SOFT_STOP + 0.25 * (PLUNGER.HARD_STOP - PLUNGER.SOFT_STOP);
    expect(plungerDepthFromHoldMs(aQuarterPast)).toBeCloseTo(expected, 5);
  });

  it('reaches hard-stop exactly at HOLD_TO_HARD_MS', () => {
    expect(plungerDepthFromHoldMs(PLUNGER.HOLD_TO_HARD_MS)).toBeCloseTo(PLUNGER.HARD_STOP, 5);
  });

  it('clamps at hard-stop beyond HOLD_TO_HARD_MS', () => {
    expect(plungerDepthFromHoldMs(PLUNGER.HOLD_TO_HARD_MS + 5_000)).toBe(PLUNGER.HARD_STOP);
  });

  it('is monotone non-decreasing across a sweep', () => {
    const samples = [0, 100, 300, 599, 600, 700, 750, 900, 1099, 1100, 1500];
    let prev = -1;
    for (const ms of samples) {
      const d = plungerDepthFromHoldMs(ms);
      expect(d).toBeGreaterThanOrEqual(prev);
      prev = d;
    }
  });
});

describe('plungerOutcome', () => {
  function curveAt(peakDepth: number): PlungerCurve {
    return { startMs: 0, currentMs: 100, peakDepth };
  }

  it('returns "aborted" only for the smallest taps (below SHORT)', () => {
    expect(plungerOutcome(curveAt(0))).toBe('aborted');
    expect(plungerOutcome(curveAt(PLUNGER.SHORT_OUTCOME_THRESHOLD - 0.01))).toBe('aborted');
  });

  it('returns "short" between SHORT and SOFT thresholds', () => {
    expect(plungerOutcome(curveAt(PLUNGER.SHORT_OUTCOME_THRESHOLD))).toBe('short');
    expect(plungerOutcome(curveAt(0.3))).toBe('short');
    expect(plungerOutcome(curveAt(PLUNGER.SOFT_STOP - PLUNGER.SOFT_STOP_TOLERANCE - 0.01))).toBe('short');
  });

  it('returns "soft" within the soft-stop tolerance band', () => {
    expect(plungerOutcome(curveAt(PLUNGER.SOFT_STOP - PLUNGER.SOFT_STOP_TOLERANCE))).toBe('soft');
    expect(plungerOutcome(curveAt(PLUNGER.SOFT_STOP))).toBe('soft');
    expect(plungerOutcome(curveAt(PLUNGER.SOFT_STOP + PLUNGER.SOFT_STOP_TOLERANCE - 0.001))).toBe('soft');
  });

  it('returns "overshoot" between (SOFT + tolerance) and HARD_OUTCOME', () => {
    // 2026-05-08: PlungerHUD's red zone for DRAW used to be silent in
    // this band. Now it surfaces as OVERDRAW for DRAW / partial for LOAD.
    const hi = PLUNGER.SOFT_STOP + PLUNGER.SOFT_STOP_TOLERANCE;
    expect(plungerOutcome(curveAt(hi))).toBe('overshoot');
    expect(plungerOutcome(curveAt(hi + 0.05))).toBe('overshoot');
    expect(plungerOutcome(curveAt(PLUNGER.HARD_OUTCOME_THRESHOLD - 0.001))).toBe('overshoot');
  });

  it('returns "hard" once peakDepth crosses HARD_OUTCOME_THRESHOLD', () => {
    expect(plungerOutcome(curveAt(PLUNGER.HARD_OUTCOME_THRESHOLD))).toBe('hard');
    expect(plungerOutcome(curveAt(PLUNGER.HARD_STOP))).toBe('hard');
  });
});

describe('curve lifecycle (emptyCurve, startCurve, tickCurve)', () => {
  it('emptyCurve has null startMs and zero values', () => {
    const c = emptyCurve();
    expect(c.startMs).toBeNull();
    expect(c.currentMs).toBe(0);
    expect(c.peakDepth).toBe(0);
  });

  it('startCurve captures the start time', () => {
    const c = startCurve(1234);
    expect(c.startMs).toBe(1234);
    expect(c.currentMs).toBe(0);
    expect(c.peakDepth).toBe(0);
  });

  it('tickCurve on an empty curve is a no-op', () => {
    const c = emptyCurve();
    expect(tickCurve(c, 999)).toEqual(c);
  });

  it('tickCurve advances currentMs and peakDepth monotonically', () => {
    const c0 = startCurve(0);
    const c1 = tickCurve(c0, 300);
    expect(c1.currentMs).toBe(300);
    expect(c1.peakDepth).toBeCloseTo(plungerDepthFromHoldMs(300), 5);
    const c2 = tickCurve(c1, 600);
    expect(c2.peakDepth).toBeCloseTo(PLUNGER.SOFT_STOP, 5);
    expect(c2.peakDepth).toBeGreaterThanOrEqual(c1.peakDepth);
  });

  it('tickCurve never reduces peakDepth even if time goes backwards (defensive)', () => {
    const c0 = startCurve(0);
    const c1 = tickCurve(c0, 1100);
    const c2 = tickCurve(c1, 100);
    expect(c2.peakDepth).toBe(c1.peakDepth);
  });

  it('a release after a full press classifies as "hard"', () => {
    let c = startCurve(0);
    c = tickCurve(c, PLUNGER.HOLD_TO_HARD_MS);
    expect(plungerOutcome(c)).toBe('hard');
  });

  it('a release at the soft-stop pause classifies as "soft"', () => {
    let c = startCurve(0);
    c = tickCurve(c, PLUNGER.HOLD_TO_SOFT_MS);
    expect(plungerOutcome(c)).toBe('soft');
  });

  it('a quick tap classifies as "aborted"', () => {
    let c = startCurve(0);
    c = tickCurve(c, 50);
    expect(plungerOutcome(c)).toBe('aborted');
  });

  it('a half-press classifies as "short"', () => {
    let c = startCurve(0);
    c = tickCurve(c, PLUNGER.HOLD_TO_SOFT_MS / 2);
    expect(plungerOutcome(c)).toBe('short');
  });
});
