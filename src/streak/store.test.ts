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

  it('starts with no colonies and no incubation timer', () => {
    const s = useStreakStore.getState();
    expect(s.colonies).toEqual([]);
    expect(s.incubationStartedAt).toBeNull();
  });

  it('startIncubation grows colonies and advances to INCUBATE only from STREAK', () => {
    const s = useStreakStore.getState();
    s.startIncubation(); // wrong step (GET_LOOP) — no-op
    expect(useStreakStore.getState().step).toBe(StreakStep.GET_LOOP);

    s.pickUpLoop(); // now STREAK; pool is seeded, so colonies should grow
    useStreakStore.getState().startIncubation();
    const after = useStreakStore.getState();
    expect(after.step).toBe(StreakStep.INCUBATE);
    expect(after.colonies.length).toBeGreaterThan(0);
    expect(after.incubationStartedAt).not.toBeNull();
  });

  it('startIncubation is blocked mid-stroke', () => {
    const s = useStreakStore.getState();
    s.pickUpLoop();
    s.setHoverTarget({ kind: 'plate' });
    s.lowerLoop();
    useStreakStore.getState().startIncubation();
    expect(useStreakStore.getState().step).toBe(StreakStep.STREAK);
  });

  it('finishIncubation advances INCUBATE → COMPLETE (and is a no-op otherwise)', () => {
    const s = useStreakStore.getState();
    s.finishIncubation(); // not incubating — no-op
    expect(useStreakStore.getState().step).toBe(StreakStep.GET_LOOP);

    s.pickUpLoop();
    useStreakStore.getState().startIncubation();
    useStreakStore.getState().finishIncubation();
    expect(useStreakStore.getState().step).toBe(StreakStep.COMPLETE);
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
    useStreakStore.getState().finishRotation();
    useStreakStore.getState().startIncubation();
    useStreakStore.getState().reset();
    const after = useStreakStore.getState();
    expect(after.step).toBe(StreakStep.GET_LOOP);
    expect(after.hasLoop).toBe(false);
    expect(after.pointer).toBeNull();
    expect(after.hoverTarget).toBeNull();
    expect(after.plateRotation).toBe(0);
    expect(after.rotating).toBe(false);
    expect(after.carriedLoad).toBe(0);
    expect(after.strokes).toEqual([]);
    expect(after.colonies).toEqual([]);
    expect(after.incubationStartedAt).toBeNull();
  });
});
