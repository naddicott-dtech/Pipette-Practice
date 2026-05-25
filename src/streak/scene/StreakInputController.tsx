import { useEffect } from 'react';
import { useStreakStore } from '../store';
import { StreakStep } from '../sim/types';

/**
 * Minimal input → state wiring for Slice 1: a click or Space-press while
 * pointing at the loop holder during GET_LOOP picks up the loop. The
 * full hold-to-lower / drag streaking mechanic lands in Slice 2 and will
 * extend this controller. Non-rendering.
 */
export function StreakInputController() {
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
        e.preventDefault();
        commit();
      }
    }
    function onMouseDown(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      // Don't hijack clicks on overlay controls (e.g. the back-to-sims link).
      if (target?.closest('a, button, input, [role="button"]')) return;
      commit();
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, []);

  return null;
}
