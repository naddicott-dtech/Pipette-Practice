import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle } from 'lucide-react';
import { useStore } from '../store';
import { FAILURE_COPY } from '../sim/failures';
import type { WarningRecord } from '../sim/types';

const TOAST_DURATION_MS = 3500;

/**
 * In-play warning surface. Watches `state.warnings.length`; when a new
 * warning lands, displays its copy for ~3.5 s. A new warning during the
 * window replaces the current toast (rather than queueing) — keeps
 * the UX honest if mistakes pile up. Reset / retryCycle shrink the
 * warnings array; the toast clears silently on shrink.
 *
 * Reads warning copy from FAILURE_COPY (same source the FailureModal
 * uses) so titles and bodies stay consistent across surfaces.
 */
export function WarningToast() {
  const warnings = useStore((s) => s.warnings);
  const prevLength = useRef(warnings.length);
  const [active, setActive] = useState<WarningRecord | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (warnings.length > prevLength.current) {
      const latest = warnings[warnings.length - 1];
      setActive(latest);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setActive(null);
      }, TOAST_DURATION_MS);
    } else if (warnings.length < prevLength.current) {
      // Reset / retryCycle wiped warnings; clear any in-flight toast.
      if (timerRef.current) clearTimeout(timerRef.current);
      setActive(null);
    }
    prevLength.current = warnings.length;
  }, [warnings]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="absolute top-24 right-6 pointer-events-none flex flex-col items-end">
      <AnimatePresence>
        {active && (
          <motion.div
            key={`${active.code}-${active.lane}-${prevLength.current}`}
            initial={{ x: 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 60, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-amber-950/85 backdrop-blur-md border border-amber-400/40 rounded-2xl p-4 shadow-xl max-w-sm flex gap-3 items-start"
          >
            <AlertCircle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-amber-100">
                {FAILURE_COPY[active.code].title}
              </div>
              <div className="text-[12px] mt-1 text-amber-100/80 leading-snug">
                {FAILURE_COPY[active.code].body}
              </div>
              <div className="text-[10px] mt-2 text-amber-200/60 uppercase tracking-widest">
                Lane {active.lane + 1}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
