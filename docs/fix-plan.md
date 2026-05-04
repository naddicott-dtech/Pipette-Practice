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

## Chunk C — Centralize workflow rules

**Why third:** with B's clean inputs, we can collapse logic that today
lives in three places (`Pipette.tsx`, `UIOverlay.tsx`, sometimes the
store). This is where the failure pedagogy gets implemented properly.

**Outline**

- New `src/sim/rules.ts` exports pure, fully-typed functions:
  - `tryPickUpTip(state, hover, lowered) → Result`
  - `tryDrawSample(state, hover, plungerPath) → Result`
  - `tryEjectIntoWell(state, hover, plungerPath, depth) → Result`
  - `tryDiscardTip(state, hover, lowered) → Result`
  - Each `Result = { nextState, events: Array<Event> }` where
    `Event = { kind: 'STEP_ADVANCED' | 'FAIL' | 'WARN'; code? }`.
- `plungerPath` is a small ring buffer of recent plunger positions so
  rules can detect "went past hard stop while drawing" (failure D) and
  "stopped at soft stop while ejecting" (failure E).
- Components call rules; they do not encode them.
- Workflow state machine becomes explicit:
  - `GET_TIP → DRAW_SAMPLE(n) → LOAD_WELL(n) → DISCARD_TIP → if n<4: GET_TIP else RUN_GEL`.
- Failures and warnings render with specific copy mapped from the code.

**Failure mode wiring (the point of the sim)**

| Code               | Trigger                                                              | Outcome              |
|---|---|---|
| NO_TIP             | hover=sample, hasTip=false, lowered=true                             | restart              |
| PUNCTURE           | hover=well, loweredDepth ≥ PUNCTURE                                  | restart              |
| NOT_LOW_ENOUGH     | hover=well, plunger crossed SOFT_STOP, loweredDepth < FULL           | restart              |
| HARD_STOP_TO_DRAW  | hover=sample, plunger reached HARD_STOP while drawing                | restart, tube empty  |
| SOFT_STOP_TO_EJECT | hover=well, plunger stopped within SOFT_STOP_TOLERANCE on eject      | warn, half DNA       |
| NO_FRESH_TIP       | drawing from sample tube N+1 without DISCARD_TIP between N and N+1   | warn, lane muddled   |

**Tests**

- One describe block per rule, exhaustive happy path + each failure +
  each warning. This is the single largest test file — and the one
  that pays the most.
- Property test: starting from initial state, applying any sequence
  of valid `Try*` calls eventually reaches RUN_GEL or a known failure.

**Acceptance**

- All six failure/warning modes reachable from real play.
- Restart cleanly resets everything.
- Store remains thin; rules are pure and testable without React.

---

## Chunk D — Real RUN_GEL state, multi-well, polish

**Outline**

- `RUN_GEL` becomes a real state with its own update loop.
  `Band` stops using `setInterval`; one `useFrame` reads
  `state.runStartedAt` and animates all bands by elapsed time.
- Power-supply button transitions `RUN_GEL` → `COMPLETE` after a fixed
  duration (e.g. 4 s wall-clock).
- Debrief screen on `COMPLETE`: per-lane verdict
  ("clean", "faint — soft-stop eject", "muddled — reused tip",
  "missing — leaked into buffer").
- Trash bin object for tip discard.
- README cleanup: drop the AI-Studio Gemini boilerplate.
- `vite.config.ts`: drop `process.env.GEMINI_API_KEY` define if no
  longer needed.

**Tests**

- Animation math (`bandPositionAt(elapsedMs, sizeKb)`) tested as a
  pure function.
- Debrief mapping (`verdictForLane(state, i) → Verdict`) tested with
  table of states.

---

## Conventions for this refactor

- **Pure functions go in `src/sim/`**, importing only from `src/sim/`.
- **Scene helpers in `src/scene/`**, may import three.
- **Components stay thin**: render + connect store + call rules.
- **Every new rule lands with a unit test in the same chunk's commit.**
- **No `setInterval` in the render tree.** Use `useFrame` or a single
  RAF driven from a hook.
- **No magic numbers** in component bodies after Chunk A.

