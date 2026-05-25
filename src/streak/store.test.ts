import { describe, it, expect, beforeEach } from 'vitest';
import { useStreakStore, StreakStep } from './store';
import { PATH, PLATE_ROTATION } from './sim/config';
import { sampleDensity } from './sim/streakField';

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

  it('starts with no rotation, no carried load, no strokes, and a seeded field', () => {
    const s = useStreakStore.getState();
    expect(s.plateRotation).toBe(0);
    expect(s.rotating).toBe(false);
    expect(s.carriedLoad).toBe(0);
    expect(s.strokes).toEqual([]);
    // Field is seeded with the top-left pool.
    expect(sampleDensity(s.field, -1.5, -1.5)).toBeGreaterThan(0);
  });

  it('rotatePlateCCW turns a quarter and flags rotating; finishRotation clears it', () => {
    const s = useStreakStore.getState();
    s.rotatePlateCCW();
    expect(useStreakStore.getState().plateRotation).toBeCloseTo(PLATE_ROTATION.STEP, 10);
    expect(useStreakStore.getState().rotating).toBe(true);
    useStreakStore.getState().finishRotation();
    expect(useStreakStore.getState().rotating).toBe(false);
  });

  it('lowerLoop opens a stroke only when streaking over the plate', () => {
    const s = useStreakStore.getState();
    s.lowerLoop(); // wrong step (GET_LOOP) — no-op
    expect(useStreakStore.getState().interactionPhase).toBe('free');

    s.pickUpLoop();
    useStreakStore.getState().lowerLoop(); // STREAK but no plate hover — no-op
    expect(useStreakStore.getState().interactionPhase).toBe('free');

    useStreakStore.getState().setHoverTarget({ kind: 'plate' });
    useStreakStore.getState().lowerLoop();
    expect(useStreakStore.getState().interactionPhase).toBe('acting');
    expect(useStreakStore.getState().strokes).toHaveLength(1);
  });

  it('does not lower while the plate is rotating', () => {
    const s = useStreakStore.getState();
    s.pickUpLoop();
    useStreakStore.getState().setHoverTarget({ kind: 'plate' });
    useStreakStore.getState().rotatePlateCCW();
    useStreakStore.getState().lowerLoop();
    expect(useStreakStore.getState().interactionPhase).toBe('free');
  });

  it('cannot rotate mid-stroke', () => {
    const s = useStreakStore.getState();
    s.pickUpLoop();
    useStreakStore.getState().setHoverTarget({ kind: 'plate' });
    useStreakStore.getState().lowerLoop();
    useStreakStore.getState().rotatePlateCCW();
    expect(useStreakStore.getState().plateRotation).toBe(0);
    expect(useStreakStore.getState().rotating).toBe(false);
  });

  it('appendContact records points on the active stroke; raiseLoop ends it', () => {
    const s = useStreakStore.getState();
    s.pickUpLoop();
    useStreakStore.getState().setHoverTarget({ kind: 'plate' });
    useStreakStore.getState().lowerLoop();
    useStreakStore.getState().appendContact(0.1, 0.2, 0.05);
    expect(useStreakStore.getState().strokes[0].points).toHaveLength(1);
    useStreakStore.getState().raiseLoop();
    expect(useStreakStore.getState().interactionPhase).toBe('free');
  });

  it('bounds the stroke list at PATH.MAX_STROKES', () => {
    const s = useStreakStore.getState();
    s.pickUpLoop();
    s.setHoverTarget({ kind: 'plate' });
    for (let k = 0; k < PATH.MAX_STROKES + 8; k++) {
      useStreakStore.getState().lowerLoop();
      useStreakStore.getState().raiseLoop();
    }
    expect(useStreakStore.getState().strokes.length).toBeLessThanOrEqual(
      PATH.MAX_STROKES,
    );
  });

  it('reset restores the initial state', () => {
    const s = useStreakStore.getState();
    s.pickUpLoop();
    s.setPointer({ x: 1, z: 2 });
    s.setHoverTarget({ kind: 'plate' });
    s.lowerLoop();
    s.appendContact(0.1, 0.1, 0.05);
    s.setCarriedLoad(0.7);
    s.rotatePlateCCW();
    s.reset();
    const after = useStreakStore.getState();
    expect(after.step).toBe(StreakStep.GET_LOOP);
    expect(after.hasLoop).toBe(false);
    expect(after.pointer).toBeNull();
    expect(after.hoverTarget).toBeNull();
    expect(after.plateRotation).toBe(0);
    expect(after.rotating).toBe(false);
    expect(after.carriedLoad).toBe(0);
    expect(after.strokes).toEqual([]);
  });
});
