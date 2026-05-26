import { FlaskConical } from 'lucide-react';
import { useStreakStore } from '../store';
import { StreakStep } from '../sim/types';

/**
 * "Incubate" control. Once the player has streaked the plate, this grows
 * the colonies and runs the incubation time-lapse. Only shown while
 * streaking; disabled mid-rotation and while the loop is down. Sits to the
 * right of the Rotate control.
 */
export function IncubateControl() {
  const step = useStreakStore((s) => s.step);
  const rotating = useStreakStore((s) => s.rotating);
  const phase = useStreakStore((s) => s.interactionPhase);

  if (step !== StreakStep.STREAK) return null;

  const disabled = rotating || phase === 'acting';

  return (
    <div className="absolute bottom-6 left-1/2 translate-x-[calc(-50%+9rem)] pointer-events-auto">
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          useStreakStore.getState().startIncubation();
          e.currentTarget.blur();
        }}
        className={
          'flex items-center gap-2 rounded-xl px-4 py-2.5 backdrop-blur-md border shadow-lg text-sm font-semibold transition ' +
          (disabled
            ? 'bg-neutral-800/60 border-white/10 text-neutral-500 cursor-not-allowed'
            : 'bg-sky-900/70 border-sky-400/40 text-sky-50 hover:bg-sky-800/70')
        }
      >
        <FlaskConical size={16} />
        Incubate
      </button>
    </div>
  );
}
