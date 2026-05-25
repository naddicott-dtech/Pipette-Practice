import { RotateCcw } from 'lucide-react';
import { useStreakStore } from '../store';
import { StreakStep } from '../sim/types';

/**
 * "Rotate the plate" control. Real streaking turns the plate a quarter
 * turn between quadrants so each new streak runs into fresh agar; here it
 * spins the agar beneath the fixed streak zone. Only shown while streaking;
 * disabled mid-rotation and while the loop is down.
 */
export function RotateControl() {
  const step = useStreakStore((s) => s.step);
  const rotating = useStreakStore((s) => s.rotating);
  const phase = useStreakStore((s) => s.interactionPhase);

  if (step !== StreakStep.STREAK) return null;

  const disabled = rotating || phase === 'acting';

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-auto">
      <button
        type="button"
        disabled={disabled}
        onClick={() => useStreakStore.getState().rotatePlateCCW()}
        className={
          'flex items-center gap-2 rounded-xl px-4 py-2.5 backdrop-blur-md border shadow-lg text-sm font-semibold transition ' +
          (disabled
            ? 'bg-neutral-800/60 border-white/10 text-neutral-500 cursor-not-allowed'
            : 'bg-emerald-900/70 border-emerald-400/40 text-emerald-50 hover:bg-emerald-800/70')
        }
      >
        <RotateCcw size={16} />
        Rotate 90°
      </button>
    </div>
  );
}
