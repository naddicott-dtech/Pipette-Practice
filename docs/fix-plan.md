# Fix plan — Pipette Practice

Owner: Claude (with human review per chunk).
Audience: AI agents and humans picking this back up later.
Status: Chunk A drafted in detail; Chunks B–D outlined.

This document is the durable handoff for the multi-step refactor that
takes the simulation from "vibe-coded, doesn't quite work" to a
playable 3–5 minute high-school lab simulation.

See [`CLAUDE.md`](../CLAUDE.md) for the seven golden rules this plan
honors.

---

## Goals (from product owner)

- **Audience:** HS students with no prior pipetting experience.
- **Length:** 3–5 minutes per playthrough, simple controls.
- **Pedagogical outcome:** fewer punctured gels and DNA pools floating
  too high in the buffer, in real lab work later.
- **Failure modes are the point.** All six must be reachable and have
  clear feedback:
  - **A. NO_TIP** — touching DNA without a tip (cross-contamination).
  - **B. PUNCTURE** — pressing the pipette through the bottom of a
    well.
  - **C. NOT_LOW_ENOUGH** — ejecting before the tip is inside the
    well; DNA floats away in the buffer.
  - **D. HARD_STOP_TO_DRAW** — pulling plunger to hard stop while in
    the sample tube; tube empties, run is bricked, restart.
  - **E. SOFT_STOP_TO_EJECT** — pressing only to soft stop on
    delivery; warning, not a hard fail. Well gets less DNA, band is
    faint.
  - **F. NO_FRESH_TIP** — reusing a tip on a second sample tube; cross
    contamination warning, lane shows muddled bands.
- **Success looks like:** four wells loaded sequentially (1 → 2 → 3 →
  4), then "Run Gel" produces visible dark bands per lane.
- **Hand-waved away:** stain step. Bands are instantly visible after
  the run.

## Non-goals

- Photorealism. Schematic 3D is fine.
- Free-orbit camera. Two fixed views, swapped automatically.
- Multi-DNA staining mechanic.

## Scene model going forward

- **One tip rack** with disposable tips.
- **Four sample tubes** in a rack, labeled 1–4. Each holds one DNA
  sample.
- **Four wells** in the gel slab, labeled 1–4. Pairing is positional:
  tube N → well N.
- **One gel box** with power-supply button.
- **Workflow per cycle (×4):** get fresh tip → draw from tube N →
  load well N → eject tip into trash. After cycle 4, run gel.

---

## Chunk A — Configuration & target extraction (no behavior change)

**Why first:** every later chunk is easier when magic numbers and
positions live in named constants. This chunk also seeds the
test-coverage culture before we touch behavior.

**Acceptance criteria**

- All numeric thresholds used by simulation logic come from
  `src/sim/config.ts`.
- All world-space positions and proximity radii come from
  `src/scene/targets.ts`.
- Existing app behavior is byte-identical at runtime (smoke test:
  `npm run dev`, walk through GET_TIP → INTAKE_SAMPLE → LOAD_WELL →
  RUN_GEL).
- `npm run lint` and `npm test` pass.
- New tests guard the constants/targets shape (well count, ordering,
  threshold ordering).

**Files added**

- `src/sim/config.ts`
- `src/sim/types.ts`
- `src/scene/targets.ts`
- `src/sim/config.test.ts`
- `src/scene/targets.test.ts`

**Files edited (mechanical replace of literals → imports)**

- `src/store.ts` — `dnaInWells` length comes from `WELL_COUNT`.
- `src/components/Pipette.tsx` — proximity radii, lower heights,
  positions.
- `src/components/UIOverlay.tsx` — plunger thresholds, microliter
  conversion.
- `src/components/GelBox.tsx` — well count, well X positions.
- `src/components/LabObjects.tsx` — tip rack and sample-tube rack
  positions.

**Concrete contents**

```ts
// src/sim/config.ts
export const PLUNGER = {
  REST: 0,
  SOFT_STOP: 0.7,
  HARD_STOP: 1.0,
  SOFT_STOP_TOLERANCE: 0.05, // green-zone half-width around SOFT_STOP
} as const;

export const VOLUME = {
  EMPTY_EPS: 0.05,
  FULL: 1.0,
  MAX_UL: 20,
} as const;

export const PIPETTE = {
  Y_HOVER: 3.5,
  Y_LOWERED_TIPS: 0.8,
  Y_LOWERED_SAMPLE: 0.8,
  Y_LOWERED_WELL: 0.4,
  Y_PUNCTURE: 0.05,
  FOLLOW_LERP: 0.15,
  // Hold-to-lower depth ramp:
  LOWER_HOLD_FULL_MS: 300,    // reach correct depth
  LOWER_HOLD_PUNCTURE_MS: 600, // past this = puncture (only over a well)
} as const;

export const WORKFLOW = {
  WELL_COUNT: 4,
  WELL_SUCCESS_THRESHOLD: 0.5,  // band rendered if dnaInWells[i] >= this
  EJECT_RATE_PER_PLUNGER_UNIT: 2,
} as const;

export const CAMERA = {
  OVERVIEW: { position: [8, 8, 12] as const, fov: 35, lookAt: [0, 0, 0] as const },
  CLOSEUP:  { position: [2, 2, 6]  as const, fov: 28, lookAt: [0, 0, 0] as const },
  TRANSITION_MS: 450,
} as const;
```

```ts
// src/sim/types.ts
export type Vec3 = readonly [number, number, number];

export type HoverTarget =
  | { kind: 'tip-rack' }
  | { kind: 'sample';  index: number }
  | { kind: 'well';    index: number }
  | { kind: 'trash' }
  | null;

export type FailureCode =
  | 'NO_TIP'
  | 'PUNCTURE'
  | 'NOT_LOW_ENOUGH'   // replaces OVERFLOW; clearer name
  | 'HARD_STOP_TO_DRAW';

export type WarningCode =
  | 'SOFT_STOP_TO_EJECT'
  | 'NO_FRESH_TIP';
```

```ts
// src/scene/targets.ts
import { WORKFLOW } from '../sim/config';

export const TIP_RACK = {
  position: [-5, 0, 2] as const,
  radius: 1.5,
};

export const TRASH = {
  position: [-5, 0, -2] as const,
  radius: 1.0,
};

export const SAMPLE_TUBES = Array.from({ length: WORKFLOW.WELL_COUNT }, (_, i) => ({
  index: i,
  // laid out left-to-right just behind the gel
  position: [-2 + i * 1.0, 0, 2] as const,
  radius: 0.45,
}));

const WELL_BASE_X = 3;
const WELL_SPACING = 1.2;
const WELL_Z = 0.5; // computed from gel position [3, 0, -1] + offset 1.5

export const WELLS = Array.from({ length: WORKFLOW.WELL_COUNT }, (_, i) => ({
  index: i,
  position: [WELL_BASE_X + (i - (WORKFLOW.WELL_COUNT - 1) / 2) * WELL_SPACING, 0.05, WELL_Z] as const,
  radius: 0.6,
}));
```

**Tests added**

```ts
// src/sim/config.test.ts
import { PLUNGER, VOLUME, WORKFLOW, PIPETTE } from './config';

describe('config invariants', () => {
  it('plunger thresholds are ordered REST < SOFT < HARD', () => {
    expect(PLUNGER.REST).toBeLessThan(PLUNGER.SOFT_STOP);
    expect(PLUNGER.SOFT_STOP).toBeLessThan(PLUNGER.HARD_STOP);
  });
  it('soft-stop tolerance fits inside [REST, HARD_STOP]', () => {
    expect(PLUNGER.SOFT_STOP - PLUNGER.SOFT_STOP_TOLERANCE).toBeGreaterThan(PLUNGER.REST);
    expect(PLUNGER.SOFT_STOP + PLUNGER.SOFT_STOP_TOLERANCE).toBeLessThan(PLUNGER.HARD_STOP);
  });
  it('volume bounds are sane', () => {
    expect(VOLUME.EMPTY_EPS).toBeGreaterThan(0);
    expect(VOLUME.EMPTY_EPS).toBeLessThan(VOLUME.FULL);
  });
  it('puncture height is below well-lowered height', () => {
    expect(PIPETTE.Y_PUNCTURE).toBeLessThan(PIPETTE.Y_LOWERED_WELL);
  });
  it('hold timings are ordered', () => {
    expect(PIPETTE.LOWER_HOLD_FULL_MS).toBeLessThan(PIPETTE.LOWER_HOLD_PUNCTURE_MS);
  });
  it('well count is positive', () => {
    expect(WORKFLOW.WELL_COUNT).toBeGreaterThan(0);
  });
});
```

```ts
// src/scene/targets.test.ts
import { WELLS, SAMPLE_TUBES, TIP_RACK } from './targets';
import { WORKFLOW } from '../sim/config';

describe('scene targets', () => {
  it('renders WELL_COUNT wells', () => {
    expect(WELLS).toHaveLength(WORKFLOW.WELL_COUNT);
  });
  it('renders WELL_COUNT sample tubes (one per well)', () => {
    expect(SAMPLE_TUBES).toHaveLength(WORKFLOW.WELL_COUNT);
  });
  it('wells are sorted by x and non-overlapping', () => {
    for (let i = 1; i < WELLS.length; i++) {
      const dx = WELLS[i].position[0] - WELLS[i - 1].position[0];
      expect(dx).toBeGreaterThan(WELLS[i].radius + WELLS[i - 1].radius);
    }
  });
  it('tip rack and wells do not overlap horizontally', () => {
    const minWellX = Math.min(...WELLS.map(w => w.position[0]));
    expect(TIP_RACK.position[0] + TIP_RACK.radius).toBeLessThan(minWellX);
  });
});
```

**Step-by-step execution**

1. Add `src/sim/config.ts`, `src/sim/types.ts`, `src/scene/targets.ts`
   and the two test files. Run `npm run lint && npm test`. Tests pass
   on the new files, existing tests untouched.
2. Refactor `src/store.ts`: `dnaInWells: Array(WORKFLOW.WELL_COUNT).fill(0)`.
   Update reset in the same way. Tests still pass.
3. Refactor `Pipette.tsx`: replace numeric literals with named imports.
   No logic change. Smoke-test in browser.
4. Refactor `UIOverlay.tsx`, `GelBox.tsx`, `LabObjects.tsx` similarly.
   The `LabObjects` sample tube becomes a loop over `SAMPLE_TUBES` —
   that is *one* observable change (now four tubes rendered instead of
   one). It needs sign-off because it is a visual change. If
   pre-approval not granted, leave `LabObjects` rendering only
   `SAMPLE_TUBES[0]` for this chunk and expand in B.
5. Run `npm run lint && npm test && npm run build`. Manual smoke. Commit
   with message
   `refactor: extract sim config and scene targets (no behavior change)`.

**Estimated size:** 1 commit, ~250 LoC added (mostly the new files and
tests), ~30 LoC edited.

---

## Chunk B — Coordinate system + camera (the playability fix)

**Why second:** A is mechanical; B is the real bug. Until the cursor
maps to world space, no amount of rule cleanup will feel right. This
chunk also introduces the dual-camera rig and makes PUNCTURE reachable
for the first time.

### Acceptance criteria

- Cursor controls pipette over actual world objects: pointing at the
  tip rack moves the pipette over the tip rack, etc. No screen-space
  approximations.
- `OrbitControls` is gone. Camera is locked to two presets and animates
  between them automatically.
- Hold Space → pipette descends smoothly toward the appropriate target;
  release → returns to hover height.
- Holding Space *too long* over a well triggers `PUNCTURE` (this
  failure was unreachable before).
- All Chunk A tests still pass; new chunk adds ≥ 15 unit tests for
  pure helpers.
- Existing happy path (GET_TIP → INTAKE_SAMPLE → LOAD_WELL → RUN_GEL,
  single tube/well) still works end-to-end. Multi-well + new failure
  pedagogy stay deferred to C/D.

### Files added

- `src/sim/geometry.ts` — pure `projectScreenToPlane(camera, ndc, planeY)`.
- `src/sim/hover.ts` — pure `findHover(point, targets) → HoverTarget`.
- `src/sim/depth.ts` — pure `depthFromHoldMs(ms) → { depth, isPuncture }`.
- `src/sim/geometry.test.ts`, `src/sim/hover.test.ts`, `src/sim/depth.test.ts`.
- `src/scene/usePointerWorld.ts` — frame hook returning the world
  point under the cursor.
- `src/scene/CameraRig.tsx` — declarative camera that animates between
  `CAMERA.OVERVIEW` and `CAMERA.CLOSEUP`.
- `src/scene/Cursor.tsx` — ground-plane ring at the world pointer.
- `src/scene/InteractionDriver.tsx` — non-rendering component that runs
  hover + lower-depth + simple state transitions each frame.

### Files edited

- `src/store.ts` — add `pointer: { x, z } | null`, `hoverTarget: HoverTarget`,
  `loweredDepth: number`. Keep legacy flags (`isNearTips`, `isNearSample`,
  `activeWellIndex`) but compute them from `hoverTarget` so existing
  consumers in C-deferred code keep working.
- `src/components/Pipette.tsx` — slim down. Reads `pointer`,
  `hoverTarget`, `loweredDepth` from store. Lerps to world position.
  Removes inline interaction detection and the dead ground-ring at
  line 153 (replaced by `<Cursor>` in the scene).
- `src/components/UIOverlay.tsx` — `showPlunger` derived from
  `hoverTarget` rather than legacy flags.
- `src/components/GelBox.tsx` — alignment guide reads `activeWellIndex`
  (now driven by hover) instead of hardcoding `well.id === 0`.
- `src/App.tsx` — replace `OrbitControls` + `<PerspectiveCamera>` with
  `<CameraRig>`. Mount `<Cursor>` and `<InteractionDriver>`.

### Module specifications

```ts
// src/sim/geometry.ts
import * as THREE from 'three';

/**
 * Project a normalized device coordinate (-1..1 on x,y) onto the y=planeY
 * world plane through the given camera. Returns null if the ray is parallel
 * to the plane (rare, only at extreme angles).
 *
 * Pure: stateless. Camera position/rotation/projection drive the answer.
 */
export function projectScreenToPlane(
  camera: THREE.Camera,
  ndc: { x: number; y: number },
  planeY: number,
): { x: number; z: number } | null;
```

```ts
// src/sim/hover.ts
import type { HoverTarget } from './types';
import type { IndexedTarget, Target } from '../scene/targets';

export interface TargetSet {
  tipRack: Target;
  trash: Target;
  sampleTubes: IndexedTarget[];
  wells: IndexedTarget[];
}

/**
 * Given a world point on the table plane and the set of interactable
 * targets, return the closest target whose Manhattan distance is within
 * its radius. Wells beat tubes beat tip-rack only on exact ties (which
 * shouldn't occur given the layout). Returns null if the point is not
 * over any target.
 */
export function findHover(
  point: { x: number; z: number },
  targets: TargetSet,
): HoverTarget;
```

```ts
// src/sim/depth.ts
import { PIPETTE } from './config';

export interface LowerState {
  depth: number;        // 0..1, lerp factor for Y position
  isPuncture: boolean;  // true once held past PUNCTURE threshold
}

/**
 * Map a Space-key hold duration to a lowering depth and a puncture flag.
 *  - 0 ms          → depth 0, no puncture
 *  - LOWER_HOLD_FULL_MS    → depth 1, no puncture
 *  - LOWER_HOLD_PUNCTURE_MS+ → depth 1, isPuncture true
 *  - between FULL and PUNCTURE → depth 1 (already at floor), no puncture yet
 */
export function depthFromHoldMs(holdMs: number): LowerState;

/** Linear interpolation helper for Y from depth and target. */
export function loweredY(hoverY: number, targetY: number, depth: number): number;
```

```ts
// src/scene/usePointerWorld.ts
import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { projectScreenToPlane } from '../sim/geometry';

/**
 * Returns a ref whose .current is the world point on y=0 under the cursor,
 * or null if off-plane. Updated each frame before render. The ref pattern
 * avoids re-renders on every mouse move.
 */
export function usePointerWorld(): React.MutableRefObject<{ x: number; z: number } | null>;
```

```ts
// src/scene/CameraRig.tsx
/**
 * Mounts a single PerspectiveCamera and animates its position/fov between
 * CAMERA.OVERVIEW and CAMERA.CLOSEUP based on store state:
 *   blend = clamp(loweredDepth + (hoverTarget?.kind === 'well' ? 0.4 : 0), 0, 1)
 * Uses useFrame + THREE.MathUtils.damp for smooth, framerate-independent motion.
 * No OrbitControls.
 */
export function CameraRig(): JSX.Element;
```

```ts
// src/scene/Cursor.tsx
/**
 * A ground-plane ring rendered at the current world pointer.
 * Color reflects readiness: red when no tip needed/held, green when
 * over a valid target for the current step. Read-only — visual feedback
 * for "where am I aiming". Replaces the dead ring at Pipette.tsx:153.
 */
export function Cursor(): JSX.Element | null;
```

```ts
// src/scene/InteractionDriver.tsx
/**
 * Non-rendering component. Runs each frame:
 *  1. Read pointerWorld from usePointerWorld.
 *  2. Compute hoverTarget = findHover(pointerWorld, targetSet).
 *  3. Update store.pointer, store.hoverTarget. Mirror to legacy flags
 *     for components not yet migrated.
 *  4. Track Space-hold timestamps; compute loweredDepth via depthFromHoldMs.
 *  5. If hover.kind === 'well' && isPuncture → setFailure(PUNCTURE).
 *  6. If hover.kind === 'tip-rack' && step === GET_TIP && depth >= 1 →
 *     advance step (existing transition, just relocated).
 *
 * All other rules stay where they are; full migration is Chunk C.
 */
export function InteractionDriver(): null;
```

### Store delta

```ts
// add to SimulationState
pointer: { x: number; z: number } | null;
hoverTarget: HoverTarget;       // from src/sim/types
loweredDepth: number;            // 0..1

// new actions
setPointer(p: { x: number; z: number } | null): void;
setHoverTarget(t: HoverTarget): void;
setLoweredDepth(d: number): void;
```

The legacy `isNearTips`, `isNearSample`, `activeWellIndex`, `isLowered`
remain in the store but are *derived* by InteractionDriver from the new
fields each frame so older consumers keep working. C deletes them.

### Step-by-step execution

Four commits, each leaves the build green and ships independently if we
need to bail:

1. **B1 — Pure helpers + tests.** Add `geometry.ts`, `hover.ts`,
   `depth.ts` and their test files. No integration, no consumers. Tests
   alone justify the commit. ~15 new unit tests.

2. **B2 — Pointer hook + camera rig + cursor.** Add
   `usePointerWorld`, `CameraRig`, `Cursor`. In `App.tsx`, replace
   `OrbitControls` and `<PerspectiveCamera>` with `<CameraRig>` and
   mount `<Cursor>`. Pipette continues to follow `state.mouse` for now —
   we are *adding* a parallel pipeline. After this commit the camera
   is locked and the ground cursor follows the mouse correctly, but
   the pipette still uses the old screen-space math.

3. **B3 — Switch Pipette to world pointer + add InteractionDriver.**
   Add store fields, `InteractionDriver`. Pipette reads `pointer` and
   `loweredDepth` from store and lerps. Inline interaction detection
   and dead ground-ring removed from `Pipette.tsx`. Existing legacy
   flags continue to populate via mirroring. This is the *playability*
   commit.

4. **B4 — Wire PUNCTURE + cleanup.** InteractionDriver fires
   `setFailure(PUNCTURE)` when over a well past
   `LOWER_HOLD_PUNCTURE_MS`. UIOverlay copy already covers PUNCTURE.
   Smoke-test the full cycle. Update `GelBox` alignment guide to read
   `activeWellIndex`.

### Tests

- `geometry.test.ts` — table tests for `projectScreenToPlane`:
  ndc=(0,0) at known camera position projects to expected world point;
  off-axis ndc projects symmetrically; horizon-grazing ndc returns null.
  Uses a stub `THREE.PerspectiveCamera` with known position/lookAt.
- `hover.test.ts` — exhaustive: point at tip-rack center → tip-rack;
  point at well[2] center → well index 2; point on the edge → still
  detected; point in dead zone between targets → null; point past
  table extents → null.
- `depth.test.ts` — boundary cases: 0 ms → {0, false}, 150 ms → {0.5,
  false}, 300 ms → {1, false}, 599 ms → {1, false}, 600 ms →
  {1, true}, 1500 ms → {1, true}.
- Property test (optional): `loweredY` is monotone in `depth`.

### Risks and how we handle them

- **Frame ordering.** `usePointerWorld` writes a ref; `Pipette.tsx`
  reads it via store. To avoid one-frame lag we update the store
  inside `InteractionDriver`'s `useFrame` *before* `Pipette` reads it.
  React-three-fiber preserves call order of `useFrame`, so we mount
  `InteractionDriver` before `Pipette` in `App.tsx`.
- **PerspectiveCamera + makeDefault swap is finicky.** We avoid the
  swap by using one camera and animating its position/fov.
- **Window blur while Space is held.** Add a `blur` listener that
  treats it as keyup — otherwise depth gets stuck at 1 and PUNCTURE
  fires when the user comes back.
- **Mobile/touch.** Out of scope per warning banner; no work here.
- **Performance.** One raycast per frame is cheap. No `setInterval`s
  introduced. `Cursor` re-renders only when its position prop actually
  changes (use ref + frame-mutated mesh, not React state).

### What's deliberately NOT in B

- Multi-well sequential loading (Chunk D).
- Per-tube hover triggering INTAKE for the right tube (Chunk C — the
  full rules layer handles this).
- Failure modes other than PUNCTURE (Chunk C).
- Trash bin / discard tip / NO_FRESH_TIP (Chunks C/D).
- README cleanup, removing Gemini env (Chunk D).

### Estimated size

4 commits, ~600 LoC added (mostly new files + tests), ~80 LoC removed
from `Pipette.tsx`, ~30 LoC edited in `App.tsx` / `UIOverlay.tsx` /
`GelBox.tsx`. Test count goes from 25 → ~45.

---

## Chunk C — "Lock-and-act" production redesign

**Why this is bigger than the old C plan.** The QA pass on the
post-Chunk-B Pages deploy
([`docs/qa-notes/2026-05-05.md`](qa-notes/2026-05-05.md)) plus the
product owner's playthrough independently arrived at the same
conclusion: the current "hold Space + drag a rotated slider + keep a
moving cursor on a 30 px target" input model is too combinatorial for
3–5 minutes of HS-student onboarding. Three of the failures the sim
is built to teach are functionally unreachable. Multi-well loading is
unimplemented. The plunger UI vanishes the moment the player presses
Space. We are replacing the input model.

**What we keep.** The soft-stop / hard-stop pedagogy. A real
micropipette has two distinct plunger detents and the difference
between them is the technique we are teaching. The QA report's
Alternative C ("drop the soft-stop concept entirely") is
*explicitly rejected* by the product owner. The redesign must make
soft vs. hard *easier to feel*, not eliminate it.

**The redesign in one paragraph.** Player moves the cursor freely in
OVERVIEW. When the cursor enters a valid hover zone for the current
step, an on-screen prompt appears: *"Click or press Space to begin
[Pick Up Tip / Draw Sample / Load Well / Discard Tip]."* When the
player clicks or presses Space, the pipette anchors at the target,
the camera transitions to an ACTION view (a near-side angle on the
locked pipette + target, ~5° isometric tilt), and a contextual
plunger control appears above the pipette. The plunger is operated by
holding Space (or click-and-hold the on-screen depressor): the plunger
visibly depresses with a perceptible "click" at the soft stop (visual
notch + audio cue + pacing pause). For *Draw*, releasing at the click
is success; pushing past it is `HARD_STOP_TO_DRAW`. For *Dispense*,
releasing at the click is `SOFT_STOP_TO_EJECT` (warning, partial
delivery, faint band); pushing past it is success. After the action
animates to completion, the camera returns to OVERVIEW, the workflow
advances, and the next prompt appears. Players load four wells from
four samples in sequence, then run the gel.

### Acceptance criteria

- **Production-ready**, not MVP. Limited scope but feature-complete.
  No "stubbed" or "deferred to D" interactions inside C's surface.
- All six failure/warning modes reachable from real input:
  `NO_TIP`, `HARD_STOP_TO_DRAW`, `SOFT_STOP_TO_EJECT`, `EMPTY_EJECT`,
  `NO_FRESH_TIP`, `WRONG_TUBE`. (`PUNCTURE` and `NOT_LOW_ENOUGH` are
  *removed* — they were depth-mechanic artifacts that the new input
  model can't produce.)
- Multi-well loop works: four samples, four wells, fresh-tip discipline,
  ending in a gel run with four lanes.
- Soft-stop pedagogy preserved and *teachable*: visible click + audio
  cue + brief pacing resistance at 70% plunger depth. Players can
  feel the difference between "stop at the click" and "push through".
- Trash bin is a visible mesh, hover-targetable, and consumes
  `tryDiscardTip`.
- All controls are mouse-only OR mouse-and-Space — no rotated sliders,
  no float-equality gates.
- Failure modal copy is per-mode (title + body + optional hint), not
  one generic header.
- Bands separate over a real time window during `RUN_GEL`; `setInterval`
  is gone.
- Lint clean. `npm test` covers every rule path. Existing tests pass.

### Architecture

```
input    →  PointerWorld (free cursor) | KeyHold + Click (commit + plunger)
sim      →  rules.ts (pure)
            - tryLockOnto(state, hover) → Result
            - tryAct(state, lockedTarget, plungerCurve) → Result
            - tryCancel(state) → Result
            - reset / tick
            failures.ts (pure copy map)
            plunger.ts (pure: hold ms → plunger depth + soft-stop pass count)
state    →  store (thin):
            interactionPhase: 'free' | 'committing' | 'locked' | 'acting' | 'finishing'
            lockedTarget: HoverTarget
            activeStep: 0..3 (which sample/well pair is current)
            plungerCurve: { startMs, currentMs, peakDepth, crossedSoftStop: boolean }
            failure: FailureCode | null
            warnings: WarningCode[] (for end-of-run debrief)
scene    →  CameraRig (3 presets now: OVERVIEW / ACTION / RUN)
            InteractionDriver (lock / cancel transitions; no rules)
            PlungerController (hold-and-release; emits plungerCurve to store)
            Cursor / Pipette / LabObjects / GelBox / TrashBin
ui       →  UIOverlay (prompts, plunger HUD, failure modal, debrief)
```

**Crucial split:** rules are pure functions on `(state, input) → Result`.
The driver / controllers only translate user input into rule calls.
This is what `src/sim/rules.test.ts` was scaffolded for in PR #6.

### Files to add

| Path | Purpose |
|---|---|
| `src/sim/rules.ts` | Pure rule functions, `Result = { nextState, events }` |
| `src/sim/plunger.ts` | `plungerDepthFromHoldMs(ms, profile)` and `plungerOutcome(curve, action) → 'soft' \| 'hard' \| 'aborted'` |
| `src/sim/failures.ts` | `FAILURE_COPY: Record<FailureCode, { title, body, hint? }>` |
| `src/sim/plunger.test.ts` | Boundary tests for the plunger curve |
| `src/sim/rules.test.ts` | Already scaffolded (PR #6); replace `it.todo` with real tests |
| `src/scene/PlungerController.tsx` | Captures Space-hold + click-hold, writes `plungerCurve` to store |
| `src/scene/TrashBin.tsx` | Visible mesh at `TRASH.position`; hover handled via existing target |
| `src/ui/Prompt.tsx` | The "Click or press Space to..." overlay |
| `src/ui/PlungerHUD.tsx` | Replaces the rotated slider; live readout of plunger depth, soft-stop indicator |
| `src/ui/FailureModal.tsx` | Extracted from UIOverlay, reads `FAILURE_COPY` |
| `src/ui/Debrief.tsx` | End-of-run lane-by-lane verdict (clean / faint / muddled / missing) |
| `src/audio/click.ts` | Tiny WebAudio helper for the soft-stop click (no asset file; synthesized) |

### Files to modify

| Path | Change |
|---|---|
| `src/store.ts` | Add `interactionPhase`, `lockedTarget`, `activeStep`, `plungerCurve`, `warnings`, `runStartedAt`. Remove `isLowered`, `loweredDepth`, `plungerPos` (replaced). |
| `src/scene/CameraRig.tsx` | Add `ACTION` and `RUN` presets; transition based on `interactionPhase` not `loweredDepth`. |
| `src/scene/InteractionDriver.tsx` | Becomes thinner — only handles lock/cancel transitions. Plunger logic moves to `PlungerController`. PUNCTURE wiring removed. |
| `src/components/Pipette.tsx` | Position lerps to `lockedTarget` when `interactionPhase !== 'free'`; otherwise follows pointer. Plunger animation reads `plungerCurve.currentDepth`. |
| `src/components/UIOverlay.tsx` | Loses the rotated slider entirely. Renders `<Prompt>`, `<PlungerHUD>`, `<FailureModal>`, `<Debrief>`. Volume readout moves to bottom HUD. |
| `src/components/LabObjects.tsx` | Active sample tube ring tracks `activeStep`; used tubes ghost out (lower opacity + dashed outline). Adds `<TrashBin>`. |
| `src/components/GelBox.tsx` | `Band` migrates via `useFrame` reading `runStartedAt`; lane verdicts (`clean`/`faint`/`muddled`/`missing`) drive band color/intensity. |
| `src/sim/types.ts` | Add `FailureCode = 'NO_TIP' \| 'HARD_STOP_TO_DRAW' \| 'EMPTY_EJECT'`; `WarningCode = 'SOFT_STOP_TO_EJECT' \| 'NO_FRESH_TIP' \| 'WRONG_TUBE'`; remove `PUNCTURE` / `NOT_LOW_ENOUGH`. |
| `src/sim/depth.ts` | Deleted. The hold-to-lower depth ramp was a Chunk B mechanic the redesign replaces. |
| `src/sim/config.ts` | Add `LOCK = { COMMIT_HOLD_MS: 0 }` (commit is instant on click/Space — no auto-lock). Add `PLUNGER.HOLD_TO_SOFT_MS: 600`, `PLUNGER.HOLD_TO_HARD_MS: 1100`, `PLUNGER.SOFT_STOP_RESISTANCE_MS: 150` (pacing pause). Remove `LOWER_HOLD_*`. |

### State machine (the authoritative source going forward)

```
       cursor moves freely; pipette follows pointer
                            │
        cursor enters valid hover zone for current step
                            │
                  ┌─────────▼─────────┐
                  │ interactionPhase  │
                  │ = 'free'          │
                  └─────────┬─────────┘
                            │ (Click OR Space-press)
                            ▼
                       LOCK_COMMIT
                            │ (camera transitions to ACTION view)
                            ▼
                  ┌─────────▼─────────┐
                  │ 'locked'          │ ← prompt: "Hold Space to [act]"
                  └─────────┬─────────┘
                            │ (Space-press OR click-and-hold on plunger HUD)
                            ▼
                  ┌─────────▼─────────┐
                  │ 'acting'          │ ← plungerCurve advances
                  └─────────┬─────────┘
                            │ (Space-release OR mouse-up)
                            ▼
                       RULE_FIRES (rules.ts)
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
            success      warning        failure
              │             │             │
              │             │             ▼
              │             │       failureModal
              │             │             │
              ▼             ▼             ▼ (Try Again)
       'finishing'    'finishing'      reset()
              │             │
              └──────┬──────┘
                     │ (animation completes)
                     ▼
              activeStep++? RUN_GEL? GET_TIP again?
                     │
                     ▼
                  'free'
```

Cancel from `locked` (Esc or click outside) returns to `free` without
firing a rule.

### Plunger mechanic detail (the thing the user wants to *feel*)

When the pipette is locked and the player presses-and-holds (Space or
mouse), the plunger depresses on a curve like:

```
         depth
          1.0  ┤
               │            ╭───
               │           ╱
   SOFT_STOP   │ ╶╶╶╶╶╶╶╮╮╶╯       ← brief pacing pause (~150 ms)
          0.7  │       ╱            simulating soft-stop resistance
               │      ╱             + visual notch + audio click
               │     ╱
          0.0  ┤────╯
               └─────────────────── time held (ms)
                  0    600    1100
```

- **0 → 600 ms:** linear ramp from 0 to 0.7 (soft stop).
- **600 ms exactly:** brief pause (~150 ms) — plunger holds at 0.7, the
  notch on the pipette body lights, click sound plays. This is what
  the player learns to recognize as "the soft stop".
- **750 → 1100 ms:** linear ramp from 0.7 to 1.0 (hard stop).
- **>1100 ms:** clamps at 1.0.

On release, `plungerOutcome(curve)` returns:
- `'aborted'` if peakDepth < 0.5 → no liquid moved, no rule fires
- `'soft'` if peakDepth ≥ 0.5 and crossedSoftStop ≥ 1
- `'hard'` if peakDepth ≥ 0.95

Rules then map outcome × action to result:

| Action  | Outcome  | Result |
|---|---|---|
| Draw    | aborted  | nothing |
| Draw    | soft     | success — full intake |
| Draw    | hard     | `HARD_STOP_TO_DRAW` failure |
| Eject   | aborted  | nothing |
| Eject   | soft     | `SOFT_STOP_TO_EJECT` warning — half delivery, faint band |
| Eject   | hard     | success — full delivery |
| Pickup  | (any tap)| success on any non-aborted press |
| Discard | (any tap)| success on any non-aborted press |

Pickup and discard don't have a soft/hard distinction — a single press
of the plunger ejects the tip. (Consistent with real-life pipettes
where a separate eject button on the side handles tips, but we simplify
to "the plunger does everything" for clarity.)

### Failure / warning copy table (per-mode, lives in `failures.ts`)

| Code | Title | Body | Hint (on second consecutive same failure) |
|---|---|---|---|
| `NO_TIP` | "No tip on the pipette" | "You tried to touch the sample without a fresh tip — that's a cross-contamination hazard. Pick up a tip first." | "Watch for the gold ring on the tip rack. Click or press Space when your cursor is over it." |
| `HARD_STOP_TO_DRAW` | "Drew past the soft stop" | "Pressing past the soft stop while drawing pushes air into the sample. Stop at the click — you'll feel and hear it." | "Hold Space until you hear the click, then release. Don't keep pressing." |
| `SOFT_STOP_TO_EJECT` (warning) | "Stopped at the soft stop" | "You only ejected the main volume; some sample stayed in the tip. The lane will look faint." | "Press past the click to deliver everything." |
| `EMPTY_EJECT` | "Ejected with an empty tip" | "Your tip was empty when you pressed the plunger. Draw the sample to the soft stop first." | "Look at the volume readout — if it says 'Empty', go back to the sample tube." |
| `NO_FRESH_TIP` (warning) | "Reused a tip on a new sample" | "Each sample needs a fresh tip — otherwise samples mix and lanes show muddled bands." | "After loading a well, discard the tip in the trash before picking up a new one." |
| `WRONG_TUBE` (warning) | "Drew from the wrong sample" | "DNA 1 goes into well 1, DNA 2 into well 2, and so on. The lane you load will be mislabeled." | "Watch the highlighted tube — that's the one matching the next well." |

Body copy and hints can be tweaked freely; the table is the contract
between the UI and the rules.

### Camera presets (revised in C)

| Preset | Position | LookAt | FOV | When |
|---|---|---|---|---|
| `OVERVIEW` | (8, 8, 12) | (0, 0, 0) | 35 | `interactionPhase === 'free'` |
| `ACTION` | per-target side angle (~5° iso tilt, 4 units away) | locked target position | 30 | `'committing' / 'locked' / 'acting' / 'finishing'` |
| `RUN` | (4, 6, 14) | (3, 0, -1) | 32 | `step === 'RUN_GEL' / 'COMPLETE'` (frames the gel) |

`ACTION` is computed from the target: `position = target + (1.5, 1.0, 4)` rotated
slightly so the player sees the pipette body and target in profile. Side view,
~5° isometric — exactly what the product owner asked for.

### Multi-well loop

`activeStep` (0..3) drives:
- which sample tube is highlighted (purple ring + bright opacity)
- which well is highlighted (cyan ring)
- which tubes/wells are *ghosted* (used: dashed outline, 0.4 opacity)
- the prompt copy: "Pick up a fresh tip for **DNA 3** → Well 3"

Loop:
```
GET_TIP(n)        →  tip rack must be hovered. Pickup commits.
DRAW_SAMPLE(n)    →  tube[n] must be hovered (else WRONG_TUBE warning if
                     hovering tube[m] m≠n; locking still allowed for
                     pedagogy, but warning fires on success).
LOAD_WELL(n)      →  well[n] must be hovered.
DISCARD_TIP       →  trash must be hovered.
if n+1 < 4: activeStep = n+1, step = GET_TIP
else:        step = RUN_GEL
```

### `RUN_GEL` and `COMPLETE`

- "Start Power Supply" button transitions step to `RUN_GEL`, sets
  `runStartedAt = performance.now()`, switches to `RUN` camera preset.
- A single `useFrame` reads `runStartedAt` and animates all bands
  by elapsed time (no per-band `setInterval`).
- After ~5 s, step becomes `COMPLETE`. Bands stop where they ended.
- `<Debrief>` modal opens: per-lane verdict driven by warnings.
  Verdicts: `clean` (no warnings on that lane), `faint`
  (`SOFT_STOP_TO_EJECT`), `muddled` (`NO_FRESH_TIP` from prior step
  contaminated this lane), `missing` (no DNA loaded).
- "Run again" button calls `reset()` and returns to OVERVIEW.

### Step-by-step execution (proposed PR sequencing)

Six commits, each leaves the build green. Each is its own PR for
review-ability — six small reviewable PRs vs. one giant unreviewable
one. After each PR ships, the live deploy updates and the product
owner can sanity-check.

| # | Commit | Adds / changes | Behavior change? |
|---|---|---|---|
| C1 | Pure rules + plunger + failures + tests | `rules.ts`, `plunger.ts`, `failures.ts`, all `.test.ts`. Replace all `it.todo`s in `rules.test.ts`. | None — pure logic, not yet wired. |
| C2 | Store + state-machine refactor | Adds new fields, removes old. `interactionPhase`, `lockedTarget`, `activeStep`, `plungerCurve`, `warnings`, `runStartedAt`. Reset/init paths updated. | None visible — driver still uses old API; new fields default to "free". |
| C3 | Lock-and-act input + camera | `PlungerController`, `Prompt`, `PlungerHUD`, new `ACTION` camera preset. Slider gone. `InteractionDriver` rewritten to commit/cancel only. PUNCTURE / depth code deleted. | Major — playable with new mechanic. Single-well still. |
| C4 | Multi-well loop + active highlights | `activeStep` consumed by `LabObjects` and `GelBox`. Tubes ghost, rings track. `WRONG_TUBE` and `NO_FRESH_TIP` warnings fire. | Multi-well sequential workflow works. |
| C5 | Trash + discard step | `TrashBin` mesh; `DISCARD_TIP` step in workflow. | Closes the loop. |
| C6 | RUN animation + Debrief | `Band` via `useFrame`; `runStartedAt`; `Debrief` modal; warnings → verdicts. README/title cleanup also lands here. | Production-ready end-to-end. |

### Tests required

- `plunger.test.ts`: depth at boundary times (0/600/750/1100/1500 ms),
  `plungerOutcome` for each (action × outcome) combination.
- `rules.test.ts`: every cell of the rule table above. Happy-path
  full sequence (4 wells loaded → RUN_GEL). Each failure / warning
  with minimal preconditions.
- `failures.test.ts`: every `FailureCode` and `WarningCode` has a
  `FAILURE_COPY` entry with non-empty `title` and `body`.
- Integration / property test: starting from initial state, applying
  any sequence of valid input events terminates in `RUN_GEL` or
  `COMPLETE` with `failure: null` (i.e. the rules don't deadlock).

Test count goal: 76 (today) → ≥ 110 by end of C.

### Out of scope for C (deferred to D)

- Tutorial overlay on first load
- Per-step retry (vs. full reset)
- Larger / color-distinct bands beyond the verdict-driven palette
- Three.js deprecation warnings
- Source maps for prod debugging
- Camera orbit / zoom controls
- Touch / mobile support
- README content (vs. just the title fix already applied)
- Settings panel (volume, hint frequency, etc.)

### Decisions confirmed by product owner before drafting

1. **Lock trigger is explicit** (click OR Space). No auto-lock-on-hover.
   The on-screen prompt makes it discoverable.
2. **Soft-stop pedagogy stays.** The redesign improves how the
   stops *feel*; it does not remove the concept.
3. **"Production-ready, not MVP"** — every feature in C ships
   complete; nothing is stubbed.
4. **Camera is fixed (3 choreographed presets), not user-controllable.**

### Open design questions for product owner before C1 starts

- **Audio.** Is a synthesized click at the soft stop OK, or do you
  want a sourced sound (e.g. real micropipette click)? Synthesized is
  zero-asset; sourced needs a license check.
- **Cancel mechanic.** Esc is universal, but a visible "Cancel" button
  next to the plunger HUD is more obvious for HS students. Both?
- **Hint scaffolding.** Should hints appear (a) on second consecutive
  same failure (current proposal), (b) on every failure, (c) only
  after a "Show hint?" toggle?
- **Debrief tone.** End-of-run debrief — celebratory ("Great work!
  4/4 lanes clean") or neutral ("Lane 1: clean. Lane 2: faint.
  Lane 3: muddled. Lane 4: clean.")? The neutral version is more
  honest about the failures; the celebratory version is more
  classroom-friendly.

---

## Chunk D — Polish (post-Chunk-C)

Polishes that don't block production but improve the experience.
Reordered post-redesign because some of the original D items are now
folded into C.

**Outline**

- Tutorial overlay on first load (storage flag to skip on return).
- Per-step retry button distinct from full reset.
- Three.js deprecation warnings cleanup (`THREE.Clock` → `Timer`,
  `PCFSoftShadowMap` → `PCFShadowMap` or update three.js).
- Source maps shipped for prod (so real student errors are debuggable).
- Settings panel: audio toggle, hint frequency.
- README rewrite (no more AI Studio boilerplate).
- `vite.config.ts`: drop `process.env.GEMINI_API_KEY` define if
  no longer needed.
- Polarity labels with arrows + "Smaller →" caption.
- Optional: limited camera orbit (±15° azimuth) for "look around" without
  losing choreography.

**Tests**

- Tutorial dismissal persists across reloads.
- Settings persistence.

---

## Conventions for this refactor

- **Pure functions go in `src/sim/`**, importing only from `src/sim/`.
- **Scene helpers in `src/scene/`**, may import three.
- **Components stay thin**: render + connect store + call rules.
- **Every new rule lands with a unit test in the same chunk's commit.**
- **No `setInterval` in the render tree.** Use `useFrame` or a single
  RAF driven from a hook.
- **No magic numbers** in component bodies after Chunk A.

