import { useEffect, useRef } from 'react';
import { useStreakStore } from '../store';
import { StreakStep } from '../sim/types';

/**
 * Minimal input → state wiring for Slice 1: a click or Space-press while
 * pointing at the loop holder during GET_LOOP picks up the loop. The
 * full hold-to-lower / drag streaking mechanic lands in Slice 2 and will
 * extend this controller. Non-rendering.
 */
export function StreakInputController() {
  // Guards key auto-repeat so a held Space fires commit once, not every
  // repeat event (matters once Slice 2 makes Space a hold-to-lower action).
  const spaceDown = useRef(false);

  useEffect(() => {
    function commit() {
      const state = useStreakStore.getState();
      if (
        state.step === StreakStep.GET_LOOP &&
        state.hoverTarget?.kind === 'loop-holder'
      ) {
        state.pickUpLoop();
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space') {
        if (spaceDown.current) return;
        spaceDown.current = true;
        e.preventDefault();
        commit();
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') spaceDown.current = false;
    }
    function onBlur() {
      spaceDown.current = false;
    }
    function onMouseDown(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      // Don't hijack clicks on overlay controls (e.g. the back-to-sims link).
      if (target?.closest('a, button, input, [role="button"]')) return;
      commit();
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

  return null;
}
