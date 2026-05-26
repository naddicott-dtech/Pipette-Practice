import { motion, AnimatePresence } from 'motion/react';
import { useStreakStore } from '../store';
import { StreakStep } from '../sim/types';

interface PromptCopy {
  text: string;
  detail?: string;
  tone: 'instruct' | 'progress';
}

function resolveCopy(step: StreakStep): PromptCopy {
  switch (step) {
    case StreakStep.GET_LOOP:
      return {
        text: 'Pick up the sterile loop',
        detail: 'Point at the loop in its holder and click or press Space.',
        tone: 'instruct',
      };
    case StreakStep.STREAK:
      return {
        text: 'Hold to lower the loop and drag to streak',
        detail: 'Rotate the plate 90° between quadrants to dilute toward single colonies.',
        tone: 'instruct',
      };
    case StreakStep.INCUBATE:
      return {
        text: 'Incubating — colonies are growing…',
        detail: '24 h at 37 °C, sped up.',
        tone: 'progress',
      };
    case StreakStep.COMPLETE:
      return { text: 'Incubation complete', tone: 'progress' };
  }
}

/**
 * "What to do next" overlay for the streak sim. Click-through so it
 * never intercepts scene clicks. Mirrors the pipette sim's Prompt.
 */
export function StreakPrompt() {
  const step = useStreakStore((s) => s.step);
  const copy = resolveCopy(step);

  return (
    <div className="absolute left-1/2 top-24 -translate-x-1/2 pointer-events-none flex justify-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={copy.text}
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -10, opacity: 0 }}
          transition={{ duration: 0.18 }}
          className={
            'rounded-xl px-5 py-3 backdrop-blur-md border shadow-lg max-w-md text-center ' +
            (copy.tone === 'instruct'
              ? 'bg-emerald-950/70 border-emerald-400/40 text-emerald-50'
              : 'bg-neutral-900/70 border-white/10 text-neutral-200')
          }
        >
          <div className="text-sm font-semibold tracking-wide">{copy.text}</div>
          {copy.detail && (
            <div className="text-[11px] mt-1 text-neutral-300/80">{copy.detail}</div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
