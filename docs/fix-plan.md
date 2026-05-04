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
maps to world space, no amount of rule cleanup will feel right.

**Outline**

- New `src/scene/usePointerWorld.ts` hook: raycast camera+pointer
  against an invisible Y=0 plane, return `{ x, z }` in world units.
- New `src/sim/hover.ts` pure function: given a world point and the
  targets, return a `HoverTarget`. Generous click tolerance is just
  the radius in `targets.ts`.
- `src/scene/CameraRig.tsx`: declarative camera that interpolates
  between `OVERVIEW` and `CLOSEUP` based on `isLowered || pointerOverWell`.
  Replace `OrbitControls`. The orbit removal is the entire reason the
  current build feels off-axis.
- `Pipette.tsx` shrinks: it consumes `pointerWorld` and `hoverTarget`
  from hooks/store, and lerps to them. No more direct mouse math, no
  more inline interaction rules. The dead ground-ring at the
  current `Pipette.tsx:153` gets replaced by a proper indicator that
  reads the live world point.
- Hold-to-lower depth ramp: capture keydown/keyup timestamps, expose
  `loweredDepth: 0..1` to the store. Over a well: `> LOWER_HOLD_FULL_MS`
  is correct, `> LOWER_HOLD_PUNCTURE_MS` triggers PUNCTURE.

**Tests**

- `usePointerWorld` is a pure raycast wrapper; test the geometry helper
  separately (`projectMouseOntoPlane(camera, ndc, planeY)`).
- `hover.ts` is a pure function — exhaustive table tests:
  inside-tip-rack, inside-well-3, on-the-edge, between-targets-with-radius-overlap.
- `loweredDepth` ramp is timing math; test as `depthFromHoldDuration(ms)`.

**Acceptance**

- Clicking near the tip rack actually triggers GET_TIP.
- Pipette never strays off the table when moving the cursor over the
  scene.
- Camera glides between overview and close-up automatically; no orbit.
- Existing failure modes still reachable as before (plus PUNCTURE,
  which now is reachable for the first time).

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

