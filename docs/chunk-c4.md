# Chunk C4 — GelBox dual-ring + zero-legacy store

Per the fix-plan table (line 1085) and the Chunk C "Contracts" section
(line 779), C4 closes out the multi-well loop visuals and is the last
chunk that retires legacy store mirrors. This chunk:

1. Brings GelBox in line with the SampleTubeRack ring pattern that landed
   in C3 (active = purple, hover = cyan), driven by `activeStep` and
   `hoverTarget` rather than the legacy `activeWellIndex`.
2. Adds a "past lane" ghost so wells that already have DNA dim out once
   the player has moved past them, mirroring the ghosting pattern on
   used sample tubes.
3. Removes `activeWellIndex` from the store, its setter, and the
   `InteractionDriver` mirror code that maintained it. The store now
   has zero legacy fields, hitting the C4 milestone called out at line
   783–785.
4. Switches GelBox from `useStore()` (whole-store subscription) to
   per-slice selectors, with each `Well` subscribing only to the data
   it needs. Avoids re-rendering all four wells whenever any unrelated
   store field changes — important because the band animation runs at
   20 Hz during the run.

## What's in this chunk

| File | Change |
|---|---|
| `src/scene/wellHighlight.ts` (new) | Pure `wellHighlight(id, activeStep, hoverTarget, step, dna)` returning `{ active, hover, loaded }`. Mirrors the inline predicate SampleTubeRack uses. |
| `src/scene/wellHighlight.test.ts` (new) | Branch coverage: active fires only during LOAD_WELL, hover requires matching kind+index+step, loaded keys off `dna > 0`, both rings can fire on the same well. |
| `src/components/GelBox.tsx` | Full rewrite. Buffer + slab unchanged; each well now a `Well` subcomponent with active ring (purple), hover ring (cyan, slightly larger so it doesn't z-fight), DNA fill scaled by delivered volume, lane label visible during LOAD_WELL, and "past lane" ghost on the well body. Band animation kept on its existing setInterval — replaced in C6. |
| `src/store.ts` | `activeWellIndex` field, `setActiveWellIndex` setter, INITIAL key all removed. |
| `src/scene/InteractionDriver.tsx` | The activeWellIndex mirror block deleted; doc comment updated. The driver is now hover-detection-only with no legacy fields. |

## What's NOT in this chunk (deferred to C5/C6 per the plan)

- Band animation via `useFrame` (C6 — `Bands separate over a real time
  window during RUN_GEL` acceptance criterion)
- Run-debrief modal (C6)
- Per-lane verdict rendering (C6 — depends on `warnings`)
- Tutorial overlay, retry-from-failure-without-reset (Chunk D)

## Acceptance against the C4 row of the plan

> "C4: Multi-well loop + active highlights + live-hover ring.
> `activeStep` consumed by `SampleTubeRack` and `GelBox`. Tubes ghost.
> Two ring styles per target: active (driven by `activeStep`) +
> live-hover (driven by `findHover`). `WRONG_TUBE` and `NO_FRESH_TIP`
> warnings fire."

- `activeStep` is now consumed by `Well` (via selector). ✅
- Tubes already ghost (C3); wells now ghost on past lanes too. ✅
- Two ring styles per well, matching tubes. ✅
- `WRONG_TUBE` and `NO_FRESH_TIP` already fire from the rules (since
  C3); C4 didn't need to touch them. ✅
- Live build: `lint` clean, `npm test` (192 tests, 11 files) all green,
  `npm run build` clean.

## Zero-legacy store invariant

After this chunk lands, every field on `SimulationState` is either
referenced by `RuleState` (and projected by `selectRuleState`) or is
infrastructural (cursor / hover / runStartedAt). No deprecated
mirrors, no @deprecated JSDoc tags. The `selectRuleState` projection
is a direct 1:1 read.
