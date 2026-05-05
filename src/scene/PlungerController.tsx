import React, { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore, selectRuleState } from '../store';
import {
  tryLockOnto,
  tryCancel,
  tryAct,
  advanceFromFinishing,
  type Result,
} from '../sim/rules';
import { startCurve, tickCurve, emptyCurve } from '../sim/plunger';
import { PLUNGER, WORKFLOW } from '../sim/config';
import { playSoftStopClick } from '../audio/click';

/**
 * Owns all input → state-machine wiring for the lock-and-act mechanic.
 * Listens for Space (commit + plunger), Esc (cancel), and mouse-down on
 * the canvas (alternate commit). Per-frame, advances the plunger curve
 * during 'acting' and progresses 'finishing' → 'free' after the
 * finishing animation window elapses.
 *
 * Diverges slightly from the plan's prose: the plan described
 * commit/cancel as InteractionDriver's responsibility and plunger as
 * PlungerController's. Putting both in one component avoids dual
 * keyboard listeners and gets us a single source of truth for the
 * Space key — the rest of the app sees only the resulting store
 * patches.
 */
export function PlungerController() {
  // The Space key's current physical state, so we don't double-fire on
  // OS auto-repeat keydowns.
  const spaceDown = useRef(false);
  // Tracks the soft-stop crossing within a single press, so the audio
  // click fires exactly once. Cleared whenever phase leaves 'acting'.
  const clickedThisPress = useRef(false);
  // performance.now() when phase entered 'finishing'; used to time the
  // animation window before calling advanceFromFinishing.
  const finishingEnteredAt = useRef<number | null>(null);

  // ─── Keyboard + mouse ───────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space') {
        if (spaceDown.current) return; // ignore OS auto-repeat
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
      // Window lost focus — treat as Space-up so we don't get stuck in
      // 'acting' with a half-pressed plunger.
      if (spaceDown.current) {
        spaceDown.current = false;
        release();
      }
    }
    function onMouseDown(e: MouseEvent) {
      // Skip clicks landing on interactive UI elements (modal buttons,
      // future PlungerHUD button, etc.). Prompt is pointer-events-none
      // so it wouldn't receive mousedown anyway.
      const target = e.target as HTMLElement | null;
      if (target?.closest('button, input, [role="button"]')) return;
      commitOrPress();
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

  // ─── Frame loop ──────────────────────────────────────────────────────
  useFrame(() => {
    const state = useStore.getState();
    const phase = state.interactionPhase;

    // Reset the soft-stop click latch whenever we leave the 'acting'
    // phase. This way the next press fires exactly one click.
    if (phase !== 'acting') clickedThisPress.current = false;

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

      // Only push when something changed — avoids waking subscribers.
      if (
        ticked.currentMs !== prevCurve.currentMs ||
        ticked.peakDepth !== prevCurve.peakDepth
      ) {
        state.setPlungerCurve(ticked);
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
        // No-op on failures (modal blocks until reset). Otherwise advances
        // the workflow per the canonical transition table.
        const result = advanceFromFinishing(selectRuleState(state));
        applyResult(state, result);
        // Curve resets for the next lock-and-act cycle. The HUD has
        // already been hidden (phase moved off 'finishing' inside
        // applyResult) — clearing the curve avoids a stale peak flash
        // when the player next reaches 'locked'.
        state.setPlungerCurve(emptyCurve());
      }
    } else if (finishingEnteredAt.current !== null) {
      // Phase changed away from finishing without us advancing it
      // (e.g. via reset() from the failure modal). Clear tracker.
      finishingEnteredAt.current = null;
    }
  });

  return null;
}

// ─── Input handlers — read store directly, dispatch via rules ───────────

function commitOrPress() {
  const state = useStore.getState();
  if (state.interactionPhase === 'free') {
    const result = tryLockOnto(selectRuleState(state), state.hoverTarget);
    applyResult(state, result);
  } else if (state.interactionPhase === 'locked') {
    state.setPlungerCurve(startCurve(performance.now()));
    state.setInteractionPhase('acting');
  }
  // committing / acting / finishing: ignore further commit-like input.
}

function release() {
  const state = useStore.getState();
  if (state.interactionPhase !== 'acting') return;
  const result = tryAct(selectRuleState(state), state.plungerCurve);
  applyResult(state, result);
  // Curve stays put through 'finishing' so the HUD can show the peak.
}

function cancel() {
  const state = useStore.getState();
  if (
    state.interactionPhase === 'committing' ||
    state.interactionPhase === 'locked' ||
    state.interactionPhase === 'acting'
  ) {
    const result = tryCancel(selectRuleState(state));
    applyResult(state, result);
    state.setPlungerCurve(emptyCurve());
  }
}

function applyResult(
  state: ReturnType<typeof useStore.getState>,
  result: Result,
): void {
  state.applyRulePatch(result.nextState);
  // Hook for future side-effects keyed off events (warning sound cues, etc.).
  // for (const ev of result.events) { ... }
}
