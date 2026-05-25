import { describe, it, expect, beforeEach } from 'vitest';
import { useStreakStore, StreakStep } from './store';

describe('Streak store', () => {
  beforeEach(() => {
    useStreakStore.getState().reset();
  });

  it('starts at GET_LOOP with no loop in hand', () => {
    const s = useStreakStore.getState();
    expect(s.step).toBe(StreakStep.GET_LOOP);
    expect(s.hasLoop).toBe(false);
    expect(s.interactionPhase).toBe('free');
    expect(s.lockedTarget).toBeNull();
  });

  it('pickUpLoop grabs the loop and advances to STREAK', () => {
    useStreakStore.getState().pickUpLoop();
    const s = useStreakStore.getState();
    expect(s.hasLoop).toBe(true);
    expect(s.step).toBe(StreakStep.STREAK);
    expect(s.interactionPhase).toBe('free');
  });

  it('reset restores the initial state', () => {
    const s = useStreakStore.getState();
    s.pickUpLoop();
    s.setPointer({ x: 1, z: 2 });
    s.setHoverTarget({ kind: 'plate' });
    s.reset();
    const after = useStreakStore.getState();
    expect(after.step).toBe(StreakStep.GET_LOOP);
    expect(after.hasLoop).toBe(false);
    expect(after.pointer).toBeNull();
    expect(after.hoverTarget).toBeNull();
  });
});
