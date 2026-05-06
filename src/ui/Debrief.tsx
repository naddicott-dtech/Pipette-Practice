import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertTriangle, XCircle, RotateCcw, X } from 'lucide-react';
import { useStore, WorkflowStep } from '../store';
import { selectRuleState } from '../store';
import { verdictForLane, type VerdictCode } from '../sim/verdict';
import { VERDICT_COPY } from '../sim/failures';

/**
 * End-of-run debrief. Renders when step === COMPLETE. One row per
 * lane: lane number, DNA source label, verdict badge + body. Keeps
 * the gel chamber visible above so students can correlate verdicts
 * to bands.
 *
 * Drives off the same RuleState the rules layer reads — verdicts are
 * a derived view of state.warnings + state.dnaInWells. No new state.
 */

const SEVERITY_PALETTE: Record<VerdictCode, {
  badge: string;
  border: string;
  icon: React.ReactNode;
}> = {
  clean: {
    badge: 'bg-emerald-900/60 text-emerald-200 border-emerald-500/40',
    border: 'border-emerald-500/30',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-300" />,
  },
  faint: {
    badge: 'bg-amber-900/60 text-amber-200 border-amber-500/40',
    border: 'border-amber-500/30',
    icon: <AlertTriangle className="w-4 h-4 text-amber-300" />,
  },
  overdraw: {
    badge: 'bg-amber-900/60 text-amber-200 border-amber-500/40',
    border: 'border-amber-500/30',
    icon: <AlertTriangle className="w-4 h-4 text-amber-300" />,
  },
  'loose-tip': {
    badge: 'bg-amber-900/60 text-amber-200 border-amber-500/40',
    border: 'border-amber-500/30',
    icon: <AlertTriangle className="w-4 h-4 text-amber-300" />,
  },
  muddled: {
    badge: 'bg-rose-900/60 text-rose-200 border-rose-500/40',
    border: 'border-rose-500/30',
    icon: <XCircle className="w-4 h-4 text-rose-300" />,
  },
  mislabeled: {
    badge: 'bg-rose-900/60 text-rose-200 border-rose-500/40',
    border: 'border-rose-500/30',
    icon: <XCircle className="w-4 h-4 text-rose-300" />,
  },
  missing: {
    badge: 'bg-rose-900/60 text-rose-200 border-rose-500/40',
    border: 'border-rose-500/30',
    icon: <XCircle className="w-4 h-4 text-rose-300" />,
  },
};

export function Debrief() {
  const step = useStore((s) => s.step);
  const dnaInWells = useStore((s) => s.dnaInWells);
  const wellSources = useStore((s) => s.wellSources);
  const reset = useStore((s) => s.reset);

  // Local dismiss flag — once closed, stays closed until the next run
  // completes. The hidden flag is keyed off the COMPLETE entry so a
  // fresh COMPLETE re-opens the modal without touching the store.
  const [dismissed, setDismissed] = useState(false);
  const wasComplete = useRef(false);
  useEffect(() => {
    const isComplete = step === WorkflowStep.COMPLETE;
    if (isComplete && !wasComplete.current) {
      // Just entered COMPLETE — surface the modal.
      setDismissed(false);
    }
    if (!isComplete && wasComplete.current) {
      // Left COMPLETE (e.g., reset) — let next entry surface again.
      setDismissed(false);
    }
    wasComplete.current = isComplete;
  }, [step]);

  const visible = step === WorkflowStep.COMPLETE && !dismissed;

  // Snapshot the rule state once when rendering — verdicts shouldn't
  // re-compute on every store mutation post-COMPLETE.
  const ruleState = selectRuleState(useStore.getState());

  return (
    <div className="absolute inset-x-0 bottom-6 pointer-events-none flex justify-center px-6 z-40">
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            className="bg-neutral-950/85 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl max-w-2xl w-full p-5 pointer-events-auto"
          >
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-lg font-bold text-white">Run complete</h2>
              <button
                onClick={(e) => {
                  setDismissed(true);
                  e.currentTarget.blur();
                }}
                aria-label="Close debrief"
                className="text-neutral-400 hover:text-white transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <ul className="space-y-2 mb-4">
              {dnaInWells.map((dna, laneIndex) => {
                const verdict = verdictForLane(laneIndex, ruleState);
                const palette = SEVERITY_PALETTE[verdict];
                const copy = VERDICT_COPY[verdict];
                const sample = wellSources[laneIndex];
                return (
                  <li
                    key={laneIndex}
                    className={`bg-black/30 rounded-xl p-3 border ${palette.border} flex gap-3 items-start`}
                  >
                    <div className="shrink-0 mt-0.5">{palette.icon}</div>
                    <div className="grow">
                      <div className="flex items-baseline gap-3 flex-wrap">
                        <span className="text-sm font-mono text-white">
                          Lane {laneIndex + 1}
                        </span>
                        <span className="text-xs font-mono text-violet-300 tabular-nums">
                          {sample !== null
                            ? `DNA ${sample + 1}`
                            : dna > 0
                              ? 'unknown sample'
                              : 'empty'}
                        </span>
                        <span
                          className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${palette.badge}`}
                        >
                          {copy.label}
                        </span>
                      </div>
                      <p className="text-[12px] text-neutral-300 mt-1 leading-snug">
                        {copy.body}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="flex justify-end gap-2">
              <button
                onClick={(e) => {
                  setDismissed(true);
                  e.currentTarget.blur();
                }}
                className="bg-white/10 hover:bg-white/20 text-neutral-200 px-4 py-2 rounded-lg text-sm transition-colors"
              >
                Close
              </button>
              <button
                onClick={(e) => {
                  reset();
                  // Drop focus so Space doesn't re-trigger the
                  // button — the controller owns Space mid-workflow.
                  e.currentTarget.blur();
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Run again
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
