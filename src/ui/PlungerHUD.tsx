import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore, WorkflowStep } from '../store';
import { PLUNGER, VOLUME } from '../sim/config';

/**
 * Visual readout of the plunger's current depth. Grows from the top
 * (REST) down to peakDepth (HARD_STOP at the bottom), with a notch at
 * the soft stop. Zone-colored by the active action so the player can
 * see at a glance whether they're heading the right way:
 *
 *   DRAW (DRAW_SAMPLE):
 *     blue → green at the soft stop → red if past
 *   DISPENSE (LOAD_WELL):
 *     amber → green at hard-stop threshold
 *   PICKUP / DISCARD:
 *     neutral; no soft/hard distinction
 *
 * Mounted next to the on-screen plunger (right side). Hidden when the
 * player is in `free` or `committing` phase — the plunger isn't engaged.
 */
export function PlungerHUD() {
  const interactionPhase = useStore((s) => s.interactionPhase);
  const step = useStore((s) => s.step);
  const peakDepth = useStore((s) => s.plungerCurve.peakDepth);
  const liquidInTip = useStore((s) => s.liquidInTip);

  // Only show during plunger-driven steps. GET_TIP/DISCARD_TIP are
  // tap-driven (no plunger curve) so the HUD would just sit at 0%.
  const plungerStep =
    step === WorkflowStep.DRAW_SAMPLE || step === WorkflowStep.LOAD_WELL;
  const visible =
    plungerStep &&
    (interactionPhase === 'locked' ||
      interactionPhase === 'acting' ||
      interactionPhase === 'finishing');

  const target = targetForStep(step);

  return (
    <div className="absolute right-6 bottom-6 pointer-events-none flex flex-col items-end gap-2">
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ x: 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 60, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl w-44"
          >
            {/* Header */}
            <div className="flex items-baseline justify-between text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-2">
              <span>Plunger</span>
              <span className="text-white tabular-nums">
                {(peakDepth * 100).toFixed(0)}%
              </span>
            </div>

            {/* The bar */}
            <PlungerBar peakDepth={peakDepth} target={target} />

            {/* Volume readout (replaces the world-space "Empty" label
                that drifted in earlier QA sessions) */}
            <div className="mt-3 text-[11px] text-neutral-300 flex items-baseline justify-between">
              <span className="text-neutral-500 uppercase tracking-wide text-[9px]">
                Volume
              </span>
              <span className="tabular-nums">
                {liquidInTip > 0
                  ? `${(liquidInTip * VOLUME.MAX_UL).toFixed(1)} μL`
                  : 'Empty'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface PlungerBarProps {
  peakDepth: number;
  target: 'soft' | 'hard' | 'any';
}

const BAR_HEIGHT_PX = 140;

function PlungerBar({ peakDepth, target }: PlungerBarProps) {
  const fillHeightPx = peakDepth * BAR_HEIGHT_PX;
  const softStopPx = PLUNGER.SOFT_STOP * BAR_HEIGHT_PX;
  const fillColor = zoneColor(peakDepth, target);

  return (
    <div
      className="relative bg-neutral-900/80 rounded-md border border-white/10 overflow-hidden"
      style={{ height: BAR_HEIGHT_PX }}
    >
      {/* The fill (animates) */}
      <motion.div
        className="absolute inset-x-0 top-0"
        style={{ background: fillColor }}
        animate={{ height: fillHeightPx }}
        transition={{ duration: 0.1, ease: 'linear' }}
      />

      {/* Soft-stop notch */}
      <div
        className="absolute inset-x-0 h-px bg-white/60 shadow-[0_0_4px_rgba(255,255,255,0.5)]"
        style={{ top: softStopPx }}
      />
      <div
        className="absolute right-1 text-[8px] font-mono uppercase tracking-widest text-white/70 -translate-y-1/2"
        style={{ top: softStopPx }}
      >
        soft stop
      </div>

      {/* Endpoint labels */}
      <div className="absolute left-1 top-0.5 text-[8px] font-mono uppercase tracking-widest text-white/40">
        rest
      </div>
      <div className="absolute left-1 bottom-0.5 text-[8px] font-mono uppercase tracking-widest text-white/40">
        hard
      </div>
    </div>
  );
}

function targetForStep(step: WorkflowStep): 'soft' | 'hard' | 'any' {
  switch (step) {
    case WorkflowStep.DRAW_SAMPLE:
      return 'soft';
    case WorkflowStep.LOAD_WELL:
      return 'hard';
    case WorkflowStep.GET_TIP:
    case WorkflowStep.DISCARD_TIP:
    case WorkflowStep.RUN_GEL:
    case WorkflowStep.COMPLETE:
      return 'any';
  }
}

/**
 * Color-coded fill based on how close peakDepth is to the target zone
 * for the current action.
 *
 *   target='soft'  blue (heading)  → green (in zone)         → red (overshoot)
 *   target='hard'  amber (heading) → green (above HARD)       → green (still fine)
 *   target='any'   constant cyan
 *
 * Uses CSS gradient strings so the fill can transition without
 * recomputing the layout.
 */
function zoneColor(peakDepth: number, target: 'soft' | 'hard' | 'any'): string {
  const softLo = PLUNGER.SOFT_STOP - PLUNGER.SOFT_STOP_TOLERANCE;
  const softHi = PLUNGER.SOFT_STOP + PLUNGER.SOFT_STOP_TOLERANCE;
  const hardThreshold = PLUNGER.HARD_OUTCOME_THRESHOLD;

  if (target === 'any') return '#06b6d4'; // cyan

  if (target === 'soft') {
    if (peakDepth < softLo) return '#3b82f6'; // blue
    if (peakDepth <= softHi) return '#22c55e'; // green
    return '#ef4444'; // red — overshoot toward HARD_STOP_TO_DRAW
  }

  // target === 'hard'
  if (peakDepth >= hardThreshold) return '#22c55e'; // green — full delivery
  if (peakDepth >= softLo) return '#f59e0b'; // amber — partial only
  return '#a16207'; // dimmer amber while still climbing
}
