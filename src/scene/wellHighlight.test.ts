import { describe, it, expect } from 'vitest';
import { wellHighlight } from './wellHighlight';
import { WorkflowStep, type HoverTarget } from '../sim/types';

const NO_HOVER: HoverTarget = null;
const HOVER_WELL_2: HoverTarget = { kind: 'well', index: 2 };
const HOVER_TIP: HoverTarget = { kind: 'tip-rack' };

describe('wellHighlight', () => {
  it('marks the active well during LOAD_WELL', () => {
    const r = wellHighlight(1, 1, NO_HOVER, WorkflowStep.LOAD_WELL, 0);
    expect(r.active).toBe(true);
  });

  it('does NOT mark active outside LOAD_WELL', () => {
    expect(wellHighlight(1, 1, NO_HOVER, WorkflowStep.GET_TIP, 0).active).toBe(false);
    expect(wellHighlight(1, 1, NO_HOVER, WorkflowStep.DRAW_SAMPLE, 0).active).toBe(false);
    expect(wellHighlight(1, 1, NO_HOVER, WorkflowStep.RUN_GEL, 0).active).toBe(false);
  });

  it('marks hover only during LOAD_WELL when hover.kind matches', () => {
    expect(wellHighlight(2, 1, HOVER_WELL_2, WorkflowStep.LOAD_WELL, 0).hover).toBe(true);
    expect(wellHighlight(0, 1, HOVER_WELL_2, WorkflowStep.LOAD_WELL, 0).hover).toBe(false);
    expect(wellHighlight(2, 1, HOVER_WELL_2, WorkflowStep.DRAW_SAMPLE, 0).hover).toBe(false);
    expect(wellHighlight(2, 1, HOVER_TIP, WorkflowStep.LOAD_WELL, 0).hover).toBe(false);
  });

  it('hover and active can both fire on the same well', () => {
    const r = wellHighlight(2, 2, HOVER_WELL_2, WorkflowStep.LOAD_WELL, 0);
    expect(r.active).toBe(true);
    expect(r.hover).toBe(true);
  });

  it('loaded reflects dna > 0', () => {
    expect(wellHighlight(0, 0, NO_HOVER, WorkflowStep.LOAD_WELL, 0).loaded).toBe(false);
    expect(wellHighlight(0, 0, NO_HOVER, WorkflowStep.LOAD_WELL, 0.01).loaded).toBe(true);
    expect(wellHighlight(0, 0, NO_HOVER, WorkflowStep.LOAD_WELL, 1).loaded).toBe(true);
  });
});
