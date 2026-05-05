/**
 * Tiny WebAudio click for the soft-stop crossing during a plunger press.
 * Synthesized — no asset files. Safe to call repeatedly; defends against
 * AudioContext failure (autoplay policy on first user gesture, etc.).
 *
 * Driver pattern: PlungerController detects the soft-stop crossing on its
 * frame tick (peakDepth crossed PLUNGER.SOFT_STOP this frame) and calls
 * `playSoftStopClick()` exactly once per press.
 */

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const Ctor =
      (window as Window & { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
        .AudioContext ??
      (window as Window & { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

export function playSoftStopClick(): void {
  const audioCtx = getContext();
  if (!audioCtx) return;
  try {
    // Some browsers suspend the context until a user gesture; resume is
    // a no-op if it's already running.
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => undefined);
    }

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    // Short, soft pop: 800 Hz square wave, 50 ms exponential decay,
    // peak gain 0.08 to stay quiet under whatever else is on the page.
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, now);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.start(now);
    osc.stop(now + 0.06);
  } catch {
    // Audio failures must not crash the app. Silent fallback.
  }
}

/**
 * Disposes the shared AudioContext. Useful in tests so leaked contexts
 * don't keep the process alive. Production code never needs to call this.
 */
export function _resetAudioForTests(): void {
  if (ctx) {
    try {
      ctx.close().catch(() => undefined);
    } catch {
      /* ignore */
    }
    ctx = null;
  }
}
