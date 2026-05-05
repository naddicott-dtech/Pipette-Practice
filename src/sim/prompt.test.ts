import { describe, it, expect } from 'vitest';
import { resolvePrompt, type PromptInput } from './prompt';
import { WorkflowStep, type HoverTarget } from './types';

function input(overrides: Partial<PromptInput>): PromptInput {
  return {
    step: WorkflowStep.GET_TIP,
    interactionPhase: 'free',
    hoverTarget: null,
    activeStep: 0,
    ...overrides,
  };
}

describe('resolvePrompt — free phase', () => {
  it('GET_TIP no-hover prompts user to move toward tip rack', () => {
    const r = resolvePrompt(input({ step: WorkflowStep.GET_TIP }));
    expect(r.text).toMatch(/tip rack/i);
    expect(r.tone).toBe('instruct');
  });

  it('GET_TIP with tip-rack hover prompts to commit', () => {
    const r = resolvePrompt(
      input({ step: WorkflowStep.GET_TIP, hoverTarget: { kind: 'tip-rack' } }),
    );
    expect(r.text).toMatch(/click or press space/i);
    expect(r.text).toMatch(/tip/i);
  });

  it('DRAW_SAMPLE pointing at the active tube has no warning detail', () => {
    const hover: HoverTarget = { kind: 'sample', index: 0 };
    const r = resolvePrompt(
      input({ step: WorkflowStep.DRAW_SAMPLE, hoverTarget: hover, activeStep: 0 }),
    );
    expect(r.text).toMatch(/DNA 1/);
    expect(r.detail).toBeUndefined();
  });

  it('DRAW_SAMPLE pointing at a non-active tube includes a warning detail', () => {
    const hover: HoverTarget = { kind: 'sample', index: 2 };
    const r = resolvePrompt(
      input({ step: WorkflowStep.DRAW_SAMPLE, hoverTarget: hover, activeStep: 0 }),
    );
    expect(r.text).toMatch(/DNA 3/);
    expect(r.detail).toMatch(/doesn't match/i);
  });

  it('LOAD_WELL pointing at the wrong well includes a warning detail', () => {
    const hover: HoverTarget = { kind: 'well', index: 2 };
    const r = resolvePrompt(
      input({ step: WorkflowStep.LOAD_WELL, hoverTarget: hover, activeStep: 1 }),
    );
    expect(r.text).toMatch(/Well 3/);
    expect(r.detail).toMatch(/doesn't match/i);
  });

  it('DISCARD_TIP guidance flows through both no-hover and hover-trash branches', () => {
    const noHover = resolvePrompt(input({ step: WorkflowStep.DISCARD_TIP }));
    const onTrash = resolvePrompt(
      input({ step: WorkflowStep.DISCARD_TIP, hoverTarget: { kind: 'trash' } }),
    );
    expect(noHover.text).toMatch(/trash/i);
    expect(onTrash.text).toMatch(/click or press space/i);
  });

  it('RUN_GEL prompts the user to start the run', () => {
    const r = resolvePrompt(input({ step: WorkflowStep.RUN_GEL }));
    expect(r.text).toMatch(/start power supply/i);
  });

  it('COMPLETE shows a results message', () => {
    const r = resolvePrompt(input({ step: WorkflowStep.COMPLETE }));
    expect(r.text).toMatch(/complete/i);
  });
});

describe('resolvePrompt — non-free phases', () => {
  it('committing shows a transient locking message', () => {
    const r = resolvePrompt(input({ interactionPhase: 'committing' }));
    expect(r.text).toMatch(/locking/i);
    expect(r.tone).toBe('progress');
  });

  it('locked DRAW_SAMPLE tells the user to release at the click', () => {
    const r = resolvePrompt(
      input({ step: WorkflowStep.DRAW_SAMPLE, interactionPhase: 'locked' }),
    );
    expect(r.text).toMatch(/hold space/i);
    expect(r.detail).toMatch(/click/i);
  });

  it('locked LOAD_WELL tells the user to press past the click', () => {
    const r = resolvePrompt(
      input({ step: WorkflowStep.LOAD_WELL, interactionPhase: 'locked' }),
    );
    expect(r.text).toMatch(/hold space/i);
    expect(r.detail).toMatch(/past the click/i);
  });

  it('acting DRAW_SAMPLE shows a progress tone', () => {
    const r = resolvePrompt(
      input({ step: WorkflowStep.DRAW_SAMPLE, interactionPhase: 'acting' }),
    );
    expect(r.tone).toBe('progress');
  });

  it('finishing returns silent', () => {
    const r = resolvePrompt(input({ interactionPhase: 'finishing' }));
    expect(r.text).toBe('');
    expect(r.tone).toBe('silent');
  });

  it('locked GET_TIP tells the user to hold for pickup', () => {
    const r = resolvePrompt(
      input({ step: WorkflowStep.GET_TIP, interactionPhase: 'locked' }),
    );
    expect(r.text).toMatch(/hold space/i);
    expect(r.text).toMatch(/tip/i);
  });

  it('locked DISCARD_TIP tells the user to hold for discard', () => {
    const r = resolvePrompt(
      input({ step: WorkflowStep.DISCARD_TIP, interactionPhase: 'locked' }),
    );
    expect(r.text).toMatch(/hold space/i);
    expect(r.text).toMatch(/discard/i);
  });

  it('acting LOAD_WELL tells the user to press past the click', () => {
    const r = resolvePrompt(
      input({ step: WorkflowStep.LOAD_WELL, interactionPhase: 'acting' }),
    );
    expect(r.text).toMatch(/dispens/i);
    expect(r.detail).toMatch(/past the click/i);
    expect(r.tone).toBe('progress');
  });

  it('acting GET_TIP and DISCARD_TIP show a generic "Pressing…"', () => {
    expect(
      resolvePrompt(input({ step: WorkflowStep.GET_TIP, interactionPhase: 'acting' })).text,
    ).toMatch(/pressing/i);
    expect(
      resolvePrompt(input({ step: WorkflowStep.DISCARD_TIP, interactionPhase: 'acting' })).text,
    ).toMatch(/pressing/i);
  });

  it('LOAD_WELL pointing at the active well has no warning detail', () => {
    const r = resolvePrompt(
      input({
        step: WorkflowStep.LOAD_WELL,
        hoverTarget: { kind: 'well', index: 2 },
        activeStep: 2,
      }),
    );
    expect(r.text).toMatch(/Well 3/);
    expect(r.detail).toBeUndefined();
  });
});

