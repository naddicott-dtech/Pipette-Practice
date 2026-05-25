import { useEffect, useRef } from 'react';
import { useStreakStore } from '../store';
import { StreakStep } from '../sim/types';

/**
 * Input → state wiring for the streak sim.
 *
 *   GET_LOOP   click / Space over the loop holder picks up the loop.
 *   STREAK     hold (mouse or Space) over the plate lowers the loop and
 *              starts a stroke; release lifts it. 'R' rotates the plate a
 *              quarter turn counter-clockwise (ignored mid-stroke).
 *
 * Non-rendering.
 */
export function StreakInputController() {
  // Guards key auto-repeat so a held Space lowers once, not every repeat.
  const spaceDown = useRef(false);

  useEffect(() => {
    function pressDown() {
      const state = useStreakStore.getState();
      if (
        state.step === StreakStep.GET_LOOP &&
        state.hoverTarget?.kind === 'loop-holder'
      ) {
        state.pickUpLoop();
      } else if (state.step === StreakStep.STREAK) {
        state.lowerLoop();
      }
    }
    function pressUp() {
      const state = useStreakStore.getState();
      if (state.step === StreakStep.STREAK) state.raiseLoop();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space') {
        if (spaceDown.current) return;
        spaceDown.current = true;
        e.preventDefault();
        pressDown();
      } else if (e.code === 'KeyR') {
        useStreakStore.getState().rotatePlateCCW();
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') {
        spaceDown.current = false;
        pressUp();
      }
    }
    function onBlur() {
      if (spaceDown.current) {
        spaceDown.current = false;
        pressUp();
      }
    }
    function onMouseDown(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      // Don't hijack clicks on overlay controls (back link, rotate button…).
      if (target?.closest('a, button, input, [role="button"]')) return;
      pressDown();
    }
    function onMouseUp() {
      pressUp();
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  return null;
}
