import React, { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore, selectRuleState, WorkflowStep } from '../store';
import {
  tryLockOnto,
  tryCancel,
  tryAct,
  tryTapPickup,
  tryTapDiscard,
  tryStopDescent,
  tickRun,
  advanceFromFinishing,
  type Result,
} from '../sim/rules';
import { startCurve, tickCurve, emptyCurve } from '../sim/plunger';
import { PLUNGER, WORKFLOW } from '../sim/config';
import { playSoftStopClick } from '../audio/click';

/**
 * Owns all input → state-machine wiring for the lock-and-act mechanic.
 *
 * Routing per (phase, step):
 *   free                   Space-down/click → tryLockOnto
 *   committing             ignore (camera tween in progress)
 *   descending (LOAD_WELL) Space-down → tryStopDescent;
 *                          frame loop auto-fires PUNCTURE at AUTO_PUNCTURE_MS
 *   locked  + GET_TIP      triple-tap; window timeout with count=1 fires
 *                          forgiving LOOSE_TIP pickup, count=2 resets
 *   locked  + DISCARD_TIP  single-tap eject (tryTapDiscard)
 *   locked  + DRAW_SAMPLE  Space-down starts plunger curve; release → tryAct
 *   locked  + LOAD_WELL    same, post-descent
 *   finishing              wait FINISHING_ANIMATION_MS, advance
 */
export function PlungerController() {
  const spaceDown = useRef(false);
  const clickedThisPress = useRef(false);
  const finishingEnteredAt = useRef<number | null>(null);
  // Wall-clock ms when 'descending' began.
  const descentStartedAt = useRef<number | null>(null);
  // Wall-clock ms of the most recent tap during locked GET_TIP. Drives the
  // tap-window timeout — null when no tap has landed in the current lock.
  const lastTapAt = useRef<number | null>(null);

  useEffect(() => {
    function commitOrPress() {
      const state = useStore.getState();
      const phase = state.interactionPhase;
      const step = state.step;
      const now = performance.now();

      if (phase === 'free') {
        applyResult(state, tryLockOnto(selectRuleState(state), state.hoverTarget));
        return;
      }
      if (phase === 'descending') {
        applyResult(state, tryStopDescent(selectRuleState(state), state.descentMs));
        return;
      }
      if (phase === 'locked') {
        if (step === WorkflowStep.GET_TIP) {
          const newCount = state.tapCount + 1;
          state.setTapCount(newCount);
          lastTapAt.current = now;
          if (newCount >= WORKFLOW.TAP_TARGET_COUNT) {
            applyResult(
              state,
              tryTapPickup(selectRuleState({ ...state, tapCount: newCount }), true),
            );
            lastTapAt.current = null;
          }
          return;
        }
        if (step === WorkflowStep.DISCARD_TIP) {
          applyResult(state, tryTapDiscard(selectRuleState(state)));
          return;
        }
        // DRAW_SAMPLE / LOAD_WELL — start the plunger press.
        state.setPlungerCurve(startCurve(now));
        state.setInteractionPhase('acting');
      }
      // committing / acting / finishing: ignore.
    }

    function release() {
      const state = useStore.getState();
      if (state.interactionPhase !== 'acting') return;
      applyResult(state, tryAct(selectRuleState(state), state.plungerCurve));
    }

    function cancel() {
      const state = useStore.getState();
      const phase = state.interactionPhase;
      if (
        phase === 'committing' ||
        phase === 'descending' ||
        phase === 'locked' ||
        phase === 'acting'
      ) {
        applyResult(state, tryCancel(selectRuleState(state)));
        state.setPlungerCurve(emptyCurve());
        lastTapAt.current = null;
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space') {
        if (spaceDown.current) return;
        spaceDown.current = true;
        e.preventDefault();
        commitOrPress();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        cancel();
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') {
        if (!spaceDown.current) return;
        spaceDown.current = false;
        release();
      }
    }
    function onBlur() {
      if (spaceDown.current) {
        spaceDown.current = false;
        release();
      }
    }
    function onMouseDown(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.closest('button, input, [role="button"]')) return;
      if (useStore.getState().interactionPhase === 'free') commitOrPress();
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, []);

  useFrame(() => {
    const state = useStore.getState();
    const phase = state.interactionPhase;

    if (phase !== 'acting') clickedThisPress.current = false;
    if (phase !== 'descending' && descentStartedAt.current !== null) {
      descentStartedAt.current = null;
    }
    if (
      (phase !== 'locked' || state.step !== WorkflowStep.GET_TIP) &&
      lastTapAt.current !== null
    ) {
      lastTapAt.current = null;
    }

    if (phase === 'acting') {
      const now = performance.now();
      const prevCurve = state.plungerCurve;
      const ticked = tickCurve(prevCurve, now);

      if (
        !clickedThisPress.current &&
        ticked.peakDepth >= PLUNGER.SOFT_STOP &&
        prevCurve.peakDepth < PLUNGER.SOFT_STOP
      ) {
        clickedThisPress.current = true;
        playSoftStopClick();
      }

      if (
        ticked.currentMs !== prevCurve.currentMs ||
        ticked.peakDepth !== prevCurve.peakDepth
      ) {
        state.setPlungerCurve(ticked);
      }
    }

    if (phase === 'descending') {
      const now = performance.now();
      if (descentStartedAt.current === null) descentStartedAt.current = now;
      const elapsed = now - descentStartedAt.current;
      if (elapsed !== state.descentMs) state.setDescentMs(elapsed);

      if (elapsed >= WORKFLOW.DESCENT.AUTO_PUNCTURE_MS) {
        applyResult(state, tryStopDescent(selectRuleState(state), elapsed));
      }
    }

    if (
      phase === 'locked' &&
      state.step === WorkflowStep.GET_TIP &&
      lastTapAt.current !== null &&
      state.tapCount > 0 &&
      state.tapCount < WORKFLOW.TAP_TARGET_COUNT
    ) {
      const now = performance.now();
      if (now - lastTapAt.current >= WORKFLOW.TAP_WINDOW_MS) {
        if (state.tapCount === 1) {
          applyResult(state, tryTapPickup(selectRuleState(state), false));
        } else {
          state.setTapCount(0);
        }
        lastTapAt.current = null;
      }
    }

    if (phase === 'finishing') {
      if (finishingEnteredAt.current === null) {
        finishingEnteredAt.current = performance.now();
      } else if (
        performance.now() - finishingEnteredAt.current >=
        WORKFLOW.FINISHING_ANIMATION_MS
      ) {
        finishingEnteredAt.current = null;
        applyResult(state, advanceFromFinishing(selectRuleState(state)));
        state.setPlungerCurve(emptyCurve());
      }
    } else if (finishingEnteredAt.current !== null) {
      finishingEnteredAt.current = null;
    }

    // RUN_GEL → COMPLETE: keep ticking the run while we're in RUN_GEL.
    // tickRun is a no-op below RUN_DURATION_MS and idempotent above it,
    // so calling it every frame is safe.
    if (state.step === WorkflowStep.RUN_GEL && state.runStartedAt !== null) {
      const elapsed = performance.now() - state.runStartedAt;
      const result = tickRun(selectRuleState(state), elapsed);
      if (Object.keys(result.nextState).length > 0) {
        applyResult(state, result);
      }
    }
  });

  return null;
}

function applyResult(
  state: ReturnType<typeof useStore.getState>,
  result: Result,
): void {
  state.applyRulePatch(result.nextState);
}
