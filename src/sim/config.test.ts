import { describe, it, expect } from 'vitest';
import { PLUNGER, VOLUME, PIPETTE, WORKFLOW, CAMERA } from './config';

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

  it('puncture height is below well-lowered height', () => {
    expect(PIPETTE.Y_PUNCTURE).toBeLessThan(PIPETTE.Y_LOWERED_WELL);
  });

  it('lowered heights are below hover height', () => {
    expect(PIPETTE.Y_LOWERED_WELL).toBeLessThan(PIPETTE.Y_HOVER);
    expect(PIPETTE.Y_LOWERED_TIPS).toBeLessThan(PIPETTE.Y_HOVER);
    expect(PIPETTE.Y_LOWERED_SAMPLE).toBeLessThan(PIPETTE.Y_HOVER);
  });

  it('hold timings are ordered FULL < PUNCTURE', () => {
    expect(PIPETTE.LOWER_HOLD_FULL_MS).toBeLessThan(PIPETTE.LOWER_HOLD_PUNCTURE_MS);
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
});
