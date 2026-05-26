import { useState, useEffect, useRef, useMemo, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, CheckCircle2, CircleDashed, RotateCcw, X } from 'lucide-react';
import { useStreakStore } from '../store';
import { StreakStep } from '../sim/types';
import { classifyStreak, type StreakGrade } from '../sim/growth';

const GRADE_COPY: Record<
  StreakGrade,
  { label: string; gloss: string; badge: string; icon: ReactNode }
> = {
  great: {
    label: 'Great streaking',
    gloss: 'Confluent growth grading down to well-separated single colonies — pick a clone from the dilute zones.',
    badge: 'bg-emerald-900/60 text-emerald-200 border-emerald-500/40',
    icon: <Sparkles className="w-5 h-5 text-emerald-300" />,
  },
  good: {
    label: 'Good streaking',
    gloss: 'Isolated single colonies grew — enough to pick from, though the dilution gradient is incomplete.',
    badge: 'bg-sky-900/60 text-sky-200 border-sky-500/40',
    icon: <CheckCircle2 className="w-5 h-5 text-sky-300" />,
  },
  ok: {
    label: 'OK streaking',
    gloss: 'Too few separated colonies — dilute across more quadrants so single colonies emerge.',
    badge: 'bg-amber-900/60 text-amber-200 border-amber-500/40',
    icon: <CircleDashed className="w-5 h-5 text-amber-300" />,
  },
};

/**
 * Post-incubation debrief. Renders when step === COMPLETE: a ballpark grade
 * (standard = visible single colonies) plus why isolation matters for a
 * CRISPR lab. Mirrors the pipette sim's Debrief (local dismiss flag re-armed
 * on each fresh COMPLETE entry).
 */
export function StreakDebrief() {
  const step = useStreakStore((s) => s.step);
  const reset = useStreakStore((s) => s.reset);

  const [dismissed, setDismissed] = useState(false);
  const wasComplete = useRef(false);
  useEffect(() => {
    const isComplete = step === StreakStep.COMPLETE;
    if (isComplete !== wasComplete.current) setDismissed(false);
    wasComplete.current = isComplete;
  }, [step]);

  const visible = step === StreakStep.COMPLETE && !dismissed;

  // Grade only while the debrief is open. Colonies are frozen at incubation
  // start, and `step === COMPLETE` is set in the same tick they're frozen, so
  // a fresh snapshot here is current; recomputing keyed on `step` keeps the
  // O(n²) isolation pass out of unrelated renders.
  const verdict = useMemo(() => {
    const s = useStreakStore.getState();
    return classifyStreak(step === StreakStep.COMPLETE ? s.colonies : [], s.field);
  }, [step]);
  const copy = GRADE_COPY[verdict.grade];

  return (
    <div className="absolute inset-x-0 bottom-6 pointer-events-none flex justify-center px-6 z-40">
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            className="bg-neutral-950/85 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl max-w-xl w-full p-5 pointer-events-auto"
          >
            <div className="flex items-start justify-between mb-3 gap-3">
              <div className="flex items-center gap-3">
                <div className="shrink-0">{copy.icon}</div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold text-white">{copy.label}</h2>
                    <span
                      className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${copy.badge}`}
                    >
                      {verdict.isolatedCount} isolated
                    </span>
                  </div>
                  <p className="text-[12px] text-neutral-300 mt-0.5 leading-snug">
                    {copy.gloss}
                  </p>
                </div>
              </div>
              <button
                onClick={(e) => {
                  setDismissed(true);
                  e.currentTarget.blur();
                }}
                aria-label="Close debrief"
                className="text-neutral-400 hover:text-white transition-colors p-1 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-black/30 rounded-xl p-3 border border-white/10 mb-4">
              <p className="text-[12px] font-semibold text-neutral-100 mb-1.5">
                Why isolated colonies matter
              </p>
              <p className="text-[11px] text-neutral-400 mb-2 leading-snug">
                For a Bio-Rad CRISPR lab where colony color indicates editing
                success:
              </p>
              <ul className="space-y-1.5 text-[11px] text-neutral-300 leading-snug">
                <li>
                  <span className="text-neutral-100 font-medium">
                    Isolate edited cells
                  </span>{' '}
                  — separate colonies let you pick clones with successful CRISPR
                  edits (e.g. white vs. blue).
                </li>
                <li>
                  <span className="text-neutral-100 font-medium">
                    Verify purity
                  </span>{' '}
                  — individual colonies prevent mixing edited and unedited cells.
                </li>
                <li>
                  <span className="text-neutral-100 font-medium">
                    Accurate phenotype scoring
                  </span>{' '}
                  — distinct colonies make it easy to count and quantify editing
                  efficiency.
                </li>
              </ul>
            </div>

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
                  e.currentTarget.blur();
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Streak again
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
