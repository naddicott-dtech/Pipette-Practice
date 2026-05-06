import { describe, it, expect } from 'vitest';
import {
  OVERVIEW_PRESET,
  RUN_PRESET,
  actionPresetFor,
  lockTargetPosition,
} from './cameraPresets';
import { TIP_RACK, TRASH, SAMPLE_TUBES, WELLS } from './targets';

describe('lockTargetPosition', () => {
  it('returns tip-rack world position', () => {
    expect(lockTargetPosition({ kind: 'tip-rack' })).toEqual(TIP_RACK.position);
  });

  it('returns trash world position', () => {
    expect(lockTargetPosition({ kind: 'trash' })).toEqual(TRASH.position);
  });

  it('returns the indexed sample tube position', () => {
    SAMPLE_TUBES.forEach((tube) => {
      expect(lockTargetPosition({ kind: 'sample', index: tube.index })).toEqual(tube.position);
    });
  });

  it('returns the indexed well position', () => {
    WELLS.forEach((well) => {
      expect(lockTargetPosition({ kind: 'well', index: well.index })).toEqual(well.position);
    });
  });
});

describe('actionPresetFor', () => {
  it('places lookAt exactly on the target', () => {
    const preset = actionPresetFor({ kind: 'tip-rack' });
    expect(preset.lookAt).toEqual(TIP_RACK.position);
  });

  it('offsets the camera +x +y +z from the target', () => {
    const target = SAMPLE_TUBES[1];
    const preset = actionPresetFor({ kind: 'sample', index: 1 });
    expect(preset.position[0]).toBeGreaterThan(target.position[0]);
    expect(preset.position[1]).toBeGreaterThan(target.position[1]);
    expect(preset.position[2]).toBeGreaterThan(target.position[2]);
  });

  it('uses a tighter fov than overview', () => {
    const preset = actionPresetFor({ kind: 'tip-rack' });
    expect(preset.fov).toBeLessThan(OVERVIEW_PRESET.fov);
  });

  it('produces distinct presets for different wells', () => {
    const a = actionPresetFor({ kind: 'well', index: 0 });
    const b = actionPresetFor({ kind: 'well', index: 3 });
    expect(a.lookAt).not.toEqual(b.lookAt);
    expect(a.position).not.toEqual(b.position);
  });

  it('the well preset places the camera outside the chamber right wall', () => {
    // The chamber spans world x ∈ [-1, 7] (centered at GEL_ORIGIN.x=3,
    // width 8). Wells are at world x=6. Their ACTION camera must sit
    // past the chamber's right wall (x > 7) so the player sees the
    // descent through the wall — not from "inside" the chamber.
    for (const well of WELLS) {
      const preset = actionPresetFor({ kind: 'well', index: well.index });
      expect(preset.position[0]).toBeGreaterThan(7);
    }
  });

  it('the well preset is more side-on than the default ACTION preset', () => {
    // The well preset trades the default's +Z corner offset for a
    // larger +X offset so the descent stays in frame. Verifies the
    // per-kind branch lands the right offset for wells.
    const wellPreset = actionPresetFor({ kind: 'well', index: 0 });
    const samplePreset = actionPresetFor({ kind: 'sample', index: 0 });
    const wellDx = wellPreset.position[0] - WELLS[0].position[0];
    const sampleDx = samplePreset.position[0] - SAMPLE_TUBES[0].position[0];
    expect(wellDx).toBeGreaterThan(sampleDx);
  });
});

describe('OVERVIEW and RUN presets', () => {
  it('overview frames the scene origin', () => {
    expect(OVERVIEW_PRESET.lookAt).toEqual([0, 0, 0]);
    expect(OVERVIEW_PRESET.position[1]).toBeGreaterThan(0); // camera up high
  });

  it('run frames the gel area, not the origin', () => {
    expect(RUN_PRESET.lookAt[0]).toBeGreaterThan(0); // gel is at x ≈ 3
  });
});
