import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store';
import { resolvePrompt } from '../sim/prompt';

/**
 * The "what to do next" overlay. Reads workflow + interaction state from
 * the store, runs through the pure `resolvePrompt` decision tree, and
 * renders the resulting copy in a card. Click-through (pointer-events:
 * none) so it doesn't intercept clicks on the 3D scene.
 *
 * Tone classes:
 *   instruct  — primary blue accent; "do this next"
 *   progress  — neutral; "we're doing it"
 *   silent    — collapsed (no card)
 */
export function Prompt() {
  const step = useStore((s) => s.step);
  const interactionPhase = useStore((s) => s.interactionPhase);
  const hoverTarget = useStore((s) => s.hoverTarget);
  const activeStep = useStore((s) => s.activeStep);

  const copy = resolvePrompt({ step, interactionPhase, hoverTarget, activeStep });
  const visible = copy.tone !== 'silent';

  return (
    <div className="absolute left-1/2 top-24 -translate-x-1/2 pointer-events-none flex justify-center">
      <AnimatePresence>
        {visible && (
          <motion.div
            key={`${copy.text}-${copy.detail ?? ''}`}
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className={
              'rounded-xl px-5 py-3 backdrop-blur-md border shadow-lg max-w-md text-center ' +
              (copy.tone === 'instruct'
                ? 'bg-blue-950/70 border-blue-400/40 text-blue-50'
                : 'bg-neutral-900/70 border-white/10 text-neutral-200')
            }
          >
            <div className="text-sm font-semibold tracking-wide">{copy.text}</div>
            {copy.detail && (
              <div className="text-[11px] mt-1 text-neutral-300/80">{copy.detail}</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
