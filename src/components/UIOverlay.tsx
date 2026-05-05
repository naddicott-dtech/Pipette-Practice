import React, { useState, useEffect } from 'react';
import { useStore, WorkflowStep, FailureMode } from '../store';
import { motion, AnimatePresence } from 'motion/react';
import { Pipette as PipetteIcon, FlaskConical, Droplets, Play, RefreshCcw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { PLUNGER, VOLUME, WORKFLOW } from '../sim/config';

export function UIOverlay() {
  const { 
    step, plungerPos, setPlunger, liquidInTip, setLiquid, 
    hasTip, setStep, failure, setFailure, isBoxOn, setBoxOn,
    reset, dnaInWells, addDnaToWell, activeWellIndex, isLowered
  } = useStore();

  const [isDragging, setIsDragging] = useState(false);

  // Handle Plunger Logic (Intake/Eject)
  // Soft stop is at 0.7
  const handlePlungerChange = (val: number) => {
    // Only allow plunger movement if lowered and in the correct step
    if (!isLowered) return;

    const prev = plungerPos;
    setPlunger(val);

    // INTAKE LOGIC
    if (step === WorkflowStep.INTAKE_SAMPLE && hasTip) {
      const softLow = PLUNGER.SOFT_STOP - PLUNGER.SOFT_STOP_TOLERANCE;
      if (prev >= softLow && val < prev) {
        const intakeAmount = (PLUNGER.SOFT_STOP - val) / PLUNGER.SOFT_STOP;
        setLiquid(Math.min(VOLUME.FULL, liquidInTip + intakeAmount));
        // Tolerate slight float drift on slider release; the input step is
        // 0.01 so anything under 0.02 is "released to rest" in user terms.
        if (val <= PLUNGER.REST + 0.02 && liquidInTip > VOLUME.FULL - 0.2) {
          setStep(WorkflowStep.LOAD_WELL);
        }
      }
    }

    // EJECT LOGIC
    if (step === WorkflowStep.LOAD_WELL && liquidInTip > 0) {
      if (val > prev) {
        const drop = (val - prev) * WORKFLOW.EJECT_RATE_PER_PLUNGER_UNIT;
        setLiquid(Math.max(0, liquidInTip - drop));

        if (activeWellIndex !== null) {
          addDnaToWell(activeWellIndex, drop);
        }

        if (liquidInTip < VOLUME.EMPTY_EPS * 2) {
          setStep(WorkflowStep.RUN_GEL);
        }
      }
    }
  };

  const instructions: Record<WorkflowStep, string> = {
    [WorkflowStep.GET_TIP]: "First, pick up a fresh disposable tip. Hold SPACE to reach down and move over the yellow tips.",
    [WorkflowStep.INTAKE_SAMPLE]: "Move to the DNA tube. Hold SPACE to lower the tip. Drag the plunger to the SOFT STOP (70%), then release slowly to intake.",
    [WorkflowStep.LOAD_WELL]: "Move to the gel. Hover over a well and hold SPACE to lower. Drag past the soft stop to the HARD STOP to eject DNA.",
    [WorkflowStep.RUN_GEL]: "The wells are loaded! Release SPACE and turn on the power supply to start the electrophoresis.",
    [WorkflowStep.COMPLETE]: "Simulation complete. Observe the DNA bands separating by size."
  };

  const { isNearSample, isNearTips } = useStore();
  const showPlunger = (step === WorkflowStep.INTAKE_SAMPLE && isNearSample) || (step === WorkflowStep.LOAD_WELL && activeWellIndex !== null);

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 overflow-hidden">
      {/* Top Header */}
      <div className="flex justify-between items-start pointer-events-auto">
        <div className="bg-black/60 backdrop-blur-md p-4 rounded-xl border border-white/10 max-w-md">
          <h1 className="text-xl font-bold mb-1 flex items-center gap-2">
             <PipetteIcon className="w-5 h-5 text-blue-400" />
             Lab: Gel Electrophoresis
          </h1>
          <p className="text-sm text-neutral-300 antialiased leading-tight">
            {instructions[step]}
          </p>
          {isLowered && (
             <div className="mt-2 text-[10px] font-bold text-green-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> PIPETTE LOWERED (SPACE HELD)
             </div>
          )}
        </div>

        <button 
          onClick={reset}
          className="bg-white/10 hover:bg-white/20 p-3 rounded-full transition-colors"
        >
          <RefreshCcw className="w-5 h-5" />
        </button>
      </div>

      {/* Failure Overlay */}
      <AnimatePresence>
        {failure && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-red-950/40 backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto"
          >
            <div className="bg-neutral-900 border-2 border-red-500 p-8 rounded-2xl max-w-sm text-center shadow-2xl">
              <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Technique Error!</h2>
              <p className="text-neutral-400 mb-6">
                {failure === FailureMode.PUNCTURE && "You punctured the bottom of the gel! The DNA leaked out underneath."}
                {failure === FailureMode.OVERFLOW && "You ejected too high. The DNA floated away into the buffer."}
                {failure === FailureMode.NO_TIP && "You tried to touch the sample without a tip! Cross-contamination hazard."}
              </p>
              <button 
                onClick={reset}
                className="bg-red-600 hover:bg-red-500 px-6 py-2 rounded-lg font-bold transition-transform active:scale-95"
              >
                Try Again
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Controls */}
      <div className="flex justify-center items-end gap-12 pointer-events-auto">
        {/* Plunger Controller */}
        <AnimatePresence>
          {showPlunger && (
            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className={`bg-black/60 backdrop-blur-md p-6 rounded-2xl border ${isLowered ? 'border-green-500/50' : 'border-white/10'} mb-4 w-64 shadow-xl transition-colors`}
            >
              <div className="flex justify-between items-center mb-4">
                 <span className="text-xs font-mono uppercase tracking-widest text-neutral-500">Plunger</span>
                 <div className={`w-3 h-3 rounded-full ${plungerPos >= PLUNGER.SOFT_STOP - PLUNGER.SOFT_STOP_TOLERANCE && plungerPos <= PLUNGER.SOFT_STOP + PLUNGER.SOFT_STOP_TOLERANCE ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-neutral-700'}`} />
              </div>
              
              {!isLowered && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center rounded-2xl text-xs text-white/60 font-bold uppercase text-center p-4">
                  Hold Space to unlock plunger
                </div>
              )}

              <div className="relative h-48 flex justify-center py-4">
                {/* Markers */}
                <div className="absolute left-0 right-0 h-full flex flex-col justify-between text-[10px] text-neutral-500 py-4 px-2">
                   <span>REST</span>
                   <div className="h-px bg-white/20 w-full" />
                   <span className="text-green-400 font-bold opacity-50">SOFT STOP (70%)</span>
                   <div className="h-px bg-white/20 w-full" />
                   <span>HARD STOP</span>
                </div>
                
                {/* Input range vertical (hacked via rotation) */}
                <input 
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  disabled={!isLowered}
                  value={plungerPos}
                  onChange={(e) => handlePlungerChange(parseFloat(e.target.value))}
                  style={{ 
                    appearance: 'none',
                    width: '180px',
                    height: '8px',
                    background: '#1f2937',
                    borderRadius: '4px',
                    transform: 'rotate(-90deg) translateX(0px)',
                    cursor: isLowered ? 'pointer' : 'not-allowed'
                  }}
                  className="accent-blue-500"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Action Button */}
        {step === WorkflowStep.RUN_GEL && (
          <motion.button
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            onClick={() => {
              setBoxOn(true);
              setStep(WorkflowStep.COMPLETE);
            }}
            className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl font-black text-xl flex items-center gap-3 shadow-lg mb-8"
          >
            <Play className="w-6 h-6 fill-current" />
            START POWER SUPPLY
          </motion.button>
        )}

        {step === WorkflowStep.COMPLETE && (
          <div className="bg-green-900/40 p-6 rounded-2xl border border-green-500/30 mb-8 max-w-sm flex gap-4 items-center animate-pulse">
             <CheckCircle2 className="w-12 h-12 text-green-400" />
             <div>
               <h3 className="font-bold text-green-400">Loading Successful!</h3>
               <p className="text-sm">The DNA is separating by size. Smaller fragments move faster toward the positive electrode.</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
