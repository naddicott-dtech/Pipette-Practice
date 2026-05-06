import React from 'react';
import { useStore, WorkflowStep } from '../store';
import { motion } from 'motion/react';
import { Pipette as PipetteIcon, Play, RefreshCcw, CheckCircle2 } from 'lucide-react';
import { Prompt } from '../ui/Prompt';
import { PlungerHUD } from '../ui/PlungerHUD';
import { FailureModal } from '../ui/FailureModal';

/**
 * Glue layer for HTML overlays. The rotated-slider UI from C0–C2 is
 * gone; the new mechanic is keyboard/mouse-driven and the visible UI
 * is split across three components: Prompt (top), PlungerHUD (right),
 * FailureModal (centered when active).
 */
export function UIOverlay() {
  const step = useStore((s) => s.step);
  const setBoxOn = useStore((s) => s.setBoxOn);
  const setRunStartedAt = useStore((s) => s.setRunStartedAt);
  const reset = useStore((s) => s.reset);

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 overflow-hidden">
      {/* Header card — title + reset button. The active "what to do
          next" instruction lives in <Prompt> so it can move with the
          interaction state, not the chrome. */}
      <div className="flex justify-between items-start pointer-events-auto">
        <div className="bg-black/60 backdrop-blur-md p-3 rounded-xl border border-white/10">
          <h1 className="text-base font-bold flex items-center gap-2">
            <PipetteIcon className="w-4 h-4 text-blue-400" />
            Lab: Gel Electrophoresis
          </h1>
        </div>

        <button
          onClick={reset}
          aria-label="Reset run"
          className="bg-white/10 hover:bg-white/20 p-3 rounded-full transition-colors flex items-center gap-2 text-sm"
        >
          <RefreshCcw className="w-4 h-4" />
          <span className="hidden sm:inline">Reset</span>
        </button>
      </div>

      {/* Center HUD overlays. */}
      <Prompt />
      <PlungerHUD />
      <FailureModal />

      {/* Bottom controls — RUN / COMPLETE actions only; lock-and-act
          is keyboard/mouse via PlungerController. */}
      <div className="flex justify-center items-end pointer-events-auto">
        {step === WorkflowStep.RUN_GEL && (
          <motion.button
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            onClick={() => {
              // Don't snap-advance to COMPLETE; let tickRun (in
              // PlungerController) flip the step once the run reaches
              // RUN_DURATION_MS. Bands animate via useFrame keyed off
              // runStartedAt.
              setBoxOn(true);
              setRunStartedAt(performance.now());
            }}
            className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl font-black text-xl flex items-center gap-3 shadow-lg mb-4"
          >
            <Play className="w-6 h-6 fill-current" />
            START POWER SUPPLY
          </motion.button>
        )}

        {step === WorkflowStep.COMPLETE && (
          <div className="bg-green-900/40 p-4 rounded-2xl border border-green-500/30 mb-4 max-w-md flex gap-3 items-center">
            <CheckCircle2 className="w-10 h-10 text-green-400 shrink-0" />
            <div>
              <h3 className="font-bold text-green-400">Loading Successful!</h3>
              <p className="text-sm text-neutral-200">
                The DNA is separating by size. Smaller fragments move faster
                toward the positive electrode.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
