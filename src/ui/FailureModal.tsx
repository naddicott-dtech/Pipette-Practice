import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle } from 'lucide-react';
import { useStore } from '../store';
import { FAILURE_COPY } from '../sim/failures';

/**
 * Renders the per-mode failure modal. Reads `state.failure` (a
 * `FailureCode | null`) and the matching `FAILURE_COPY` entry. The
 * "Try Again" button calls `reset()` which clears the failure and
 * returns to the initial state.
 */
export function FailureModal() {
  const failure = useStore((s) => s.failure);
  const reset = useStore((s) => s.reset);

  return (
    <AnimatePresence>
      {failure && (
        <motion.div
          key={failure}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-red-950/40 backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="bg-neutral-900 border-2 border-red-500 p-8 rounded-2xl max-w-md text-center shadow-2xl"
          >
            <AlertTriangle className="w-14 h-14 text-red-500 mx-auto mb-4" />

            <h2 className="text-xl font-bold mb-1 text-white">
              {FAILURE_COPY[failure].title}
            </h2>
            <p className="text-sm text-neutral-300 mb-2 leading-snug">
              {FAILURE_COPY[failure].body}
            </p>
            {FAILURE_COPY[failure].hint && (
              <p className="text-xs text-amber-300/90 italic mb-6 leading-snug">
                Try this: {FAILURE_COPY[failure].hint}
              </p>
            )}

            <button
              onClick={(e) => {
                reset();
                // Drop focus so Space doesn't re-click "Try Again"
                // mid-workflow — Space is owned by PlungerController.
                e.currentTarget.blur();
              }}
              className="bg-red-600 hover:bg-red-500 px-6 py-2 rounded-lg font-bold transition-transform active:scale-95 text-white"
            >
              Try Again
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
