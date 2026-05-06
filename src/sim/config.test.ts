import { describe, it, expect } from 'vitest';
import { PLUNGER, VOLUME, PIPETTE, WORKFLOW, CAMERA } from './config';
import {
  BEAKER_HEIGHT,
  BEAKER_FLOOR_Y,
} from '../scene/Trash';

// Distance from the pipette body center to the tip apex. Body cylinder
// is 3 units tall (centered at group origin); tip group sits at local
// y=-1.55 with a length-0.9 cone oriented apex-down. Apex local
// y = -1.55 - 0.45 = -2.0.
const PIPETTE_BODY_TO_TIP_APEX = 2.0;

describe('config invariants', () => {
  it('plunger thresholds are ordered REST < SOFT_STOP < HARD_STOP', () => {
    expect(PLUNGER.REST).toBeLessThan(PLUNGER.SOFT_STOP);
    expect(PLUNGER.SOFT_STOP).toBeLessThan(PLUNGER.HARD_STOP);
  });

  it('soft-stop tolerance fits between REST and HARD_STOP', () => {
    expect(PLUNGER.SOFT_STOP - PLUNGER.SOFT_STOP_TOLERANCE).toBeGreaterThan(PLUNGER.REST);
    expect(PLUNGER.SOFT_STOP + PLUNGER.SOFT_STOP_TOLERANCE).toBeLessThan(PLUNGER.HARD_STOP);
  });

  it('volume bounds are sane', () => {
    expect(VOLUME.EMPTY_EPS).toBeGreaterThan(0);
    expect(VOLUME.EMPTY_EPS).toBeLessThan(VOLUME.FULL);
    expect(VOLUME.MAX_UL).toBeGreaterThan(0);
  });

  it('lowered heights are below hover height', () => {
    expect(PIPETTE.Y_LOWERED_WELL).toBeLessThan(PIPETTE.Y_HOVER);
    expect(PIPETTE.Y_LOWERED_TIPS).toBeLessThan(PIPETTE.Y_HOVER);
    expect(PIPETTE.Y_LOWERED_SAMPLE).toBeLessThan(PIPETTE.Y_HOVER);
  });

  it('follow lerp is in (0, 1]', () => {
    expect(PIPETTE.FOLLOW_LERP).toBeGreaterThan(0);
    expect(PIPETTE.FOLLOW_LERP).toBeLessThanOrEqual(1);
  });

  it('workflow has at least one well and a reachable success threshold', () => {
    expect(WORKFLOW.WELL_COUNT).toBeGreaterThan(0);
    expect(WORKFLOW.WELL_SUCCESS_THRESHOLD).toBeGreaterThan(0);
    expect(WORKFLOW.WELL_SUCCESS_THRESHOLD).toBeLessThanOrEqual(VOLUME.FULL);
  });

  it('camera presets have positive fov', () => {
    expect(CAMERA.OVERVIEW.fov).toBeGreaterThan(0);
    expect(CAMERA.CLOSEUP.fov).toBeGreaterThan(0);
    expect(CAMERA.TRANSITION_MS).toBeGreaterThan(0);
  });

  it('plunger outcome thresholds are ordered SHORT < SOFT < HARD', () => {
    const softThreshold = PLUNGER.SOFT_STOP - PLUNGER.SOFT_STOP_TOLERANCE;
    expect(PLUNGER.SHORT_OUTCOME_THRESHOLD).toBeGreaterThan(0);
    expect(PLUNGER.SHORT_OUTCOME_THRESHOLD).toBeLessThan(softThreshold);
    expect(softThreshold).toBeLessThan(PLUNGER.HARD_OUTCOME_THRESHOLD);
  });

  it('descent timings are ordered HIGH < GOOD < AUTO', () => {
    expect(WORKFLOW.DESCENT.HIGH_TO_GOOD_MS).toBeGreaterThan(0);
    expect(WORKFLOW.DESCENT.HIGH_TO_GOOD_MS).toBeLessThan(WORKFLOW.DESCENT.GOOD_TO_PUNCTURE_MS);
    expect(WORKFLOW.DESCENT.GOOD_TO_PUNCTURE_MS).toBeLessThan(WORKFLOW.DESCENT.AUTO_PUNCTURE_MS);
  });

  it('tap window and target count are sane', () => {
    expect(WORKFLOW.TAP_TARGET_COUNT).toBeGreaterThan(1);
    expect(WORKFLOW.TAP_WINDOW_MS).toBeGreaterThan(0);
  });

  it('descent y-coordinates run from above buffer to below agar', () => {
    expect(PIPETTE.Y_DESCENT_START).toBeGreaterThan(PIPETTE.Y_DESCENT_PUNCTURE);
  });

  it('Y_LOWERED_TRASH lands the tip apex inside the beaker', () => {
    // Tip apex sits 2.0 below the pipette body center. With body at
    // Y_LOWERED_TRASH the apex must be above the beaker floor (so it
    // doesn't poke through the bottom — the bug from the 2026-05-06
    // regression report) and below the beaker rim.
    const apexY = PIPETTE.Y_LOWERED_TRASH - PIPETTE_BODY_TO_TIP_APEX;
    expect(apexY).toBeGreaterThan(BEAKER_FLOOR_Y);
    expect(apexY).toBeLessThan(BEAKER_FLOOR_Y + BEAKER_HEIGHT);
  });
});
