import React from 'react';
import { useStore, WorkflowStep } from '../store';

/**
 * "Lab notebook" — small panel in the bottom-left corner that records
 * per-well sample + volume after each load. Visible from the moment
 * the player completes their first DISCARD_TIP onward (a successfully
 * loaded well is the trigger). Always visible during RUN_GEL and
 * COMPLETE so the player can match bands on the gel back to the
 * sample that produced them.
 *
 * Doubles as a diagnostic for the 2026-05-08 "wells 3 & 4 show no
 * bands" report: an "empty" entry tells the player a load they thought
 * succeeded didn't reach that well.
 */
export function LabNotebook() {
  const dnaInWells = useStore((s) => s.dnaInWells);
  const wellSources = useStore((s) => s.wellSources);
  const step = useStore((s) => s.step);

  const anyLoaded = dnaInWells.some((v) => v > 0);
  // Show during the run + completion + while LOAD_WELL is active so
  // the player gets feedback on what's already landed.
  const visible =
    anyLoaded ||
    step === WorkflowStep.RUN_GEL ||
    step === WorkflowStep.COMPLETE;

  if (!visible) return null;

  return (
    <div className="absolute bottom-6 left-6 pointer-events-none">
      <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl text-[12px] font-mono text-neutral-200 min-w-[180px]">
        <div className="text-[10px] uppercase tracking-widest text-neutral-400 mb-2">
          Lab Notebook
        </div>
        <ul className="space-y-1 tabular-nums">
          {dnaInWells.map((dna, i) => {
            const src = wellSources[i];
            const wellNum = i + 1;
            if (dna <= 0 || src === null) {
              return (
                <li key={i} className="flex justify-between gap-3 text-neutral-500">
                  <span>Well {wellNum}</span>
                  <span>empty</span>
                </li>
              );
            }
            return (
              <li key={i} className="flex justify-between gap-3">
                <span className="text-white">Well {wellNum}</span>
                <span>
                  <span className="text-violet-300">DNA {src + 1}</span>
                  <span className="text-neutral-400 ml-2">
                    {(dna * 100).toFixed(0)}%
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
