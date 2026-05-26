# Streak-plating sim — handoff

Durable context for the streak-plating simulation (`src/streak/`, route
`#/streak`). Written for an agent (or human) dropping in cold. Pairs with the
golden rules in [`../CLAUDE.md`](../CLAUDE.md).

## What it is

A 3-minute **bell-ringer**: the student streak-plates bacteria onto agar using
the four-quadrant method, incubates, and gets a debrief that grades how they
did. Pedagogical goal is "follow the quadrant technique and match the target
graphic" — **formative, not for a grade** (don't redesign it into a high-stakes
scored activity without revisiting the thresholds).

Workflow state machine (`StreakStep` in `src/streak/sim/types.ts`):

```
GET_LOOP → STREAK → INCUBATE → COMPLETE
```

- **GET_LOOP** — pick up the sterile loop.
- **STREAK** — drag the loop on the agar; rotate the plate (`rotatePlateCCW`)
  between quadrants. Each press→drag→release is one *stroke*.
- **INCUBATE** — `startIncubation()` freezes the field, generates colonies, and
  time-lapses them growing (`INCUBATION.DURATION_MS`).
- **COMPLETE** — `StreakDebrief` shows the grade + technique feedback.

`reset()` restores the initial state and re-seeds the inoculum pool.

## Architecture (separation of concerns)

```
input  →  StreakInputController / StreakContactDriver (pointer, key/click, plate rotation)
store  →  src/streak/store.ts  (zustand: workflow state + recorded data)
models →  src/streak/sim/*.ts  (PURE, framework-free, fully unit-tested)
scene  →  src/streak/scene/*   (r3f meshes + per-frame drivers)
ui     →  src/streak/ui/StreakDebrief.tsx
```

### Store (`src/streak/store.ts`) — the recorded data

- `field: StreakField` — agar-local density grid (96×96, spans `[-3,3]`).
- `strokes: Stroke[]` — recorded loop paths, **agar-local** (plate rotation
  baked out via `worldToAgarLocal`), `{x,z,deposit}` points. Capped at
  `PATH.MAX_STROKES = 16` (oldest dropped).
- `carriedLoad: number` — scalar bacteria on the loop (no history kept).
- `plateRotation: number` — accumulates `+π/2` per rotation, so
  `rotations = round(plateRotation / (π/2))`.
- `colonies: Colony[]` — generated at `startIncubation`, frozen thereafter.
- All of `field` / `strokes` / `plateRotation` / `colonies` **persist through
  INCUBATE and COMPLETE**; only `reset()` clears them. The debrief reads them
  live at COMPLETE.

### Pure models (`src/streak/sim/`)

- **`streakField.ts`** — the dilution model. `applyContact(field,x,z,carried)`:
  the loop picks up `ALPHA·D^PICKUP_EXP` and deposits `BETA·C` per contact;
  dragging from the dense pool into fresh agar bleeds the carried load down
  geometrically. `seedPool` paints the inoculum; `cellIndex` maps coords→grid.
- **`path.ts`** — `Stroke`/`StrokePoint`, distance-based `segmentSteps`
  (points every `STEP_DIST`), `pushPoint` (min-spacing + cap).
- **`transform.ts`** — `worldToAgarLocal(world, rot)` (rotation-invariant
  recording).
- **`growth.ts`** — `generateColonies(field)` (density → discrete colonies),
  `growthRadius` (incubation easing), `classifyStreak` (colony **outcome**
  grade), `gradeStreak` (outcome **capped by** technique), `ceilingForFlaws`.
- **`technique.ts`** — `analyzeTechnique(strokes, plateRotation, field)` →
  metrics + technique **flaws** (the heart of the grading).
- **`config.ts`** — every tunable constant (see knobs below). `hover.ts` /
  `targets.ts` handle loop/plate hover.

### Scene drivers (`src/streak/scene/`)

`StreakSceneRoot` mounts: `PetriDish`, `Loop`/`LoopHolder`, `StreakMarks`
(renders strokes, faded at INCUBATE/COMPLETE), `Colonies` (InstancedMesh sized
to `GROWTH.MAX_COLONIES`), `StreakContactDriver` (applies contacts to the field
while dragging), `IncubationDriver` (advances growth via `useFrame`),
`StreakCameraRig`, `StreakCursor`, `StreakInputController`.

## The two core models (and the key insight)

### 1. Streak deposit self-limits density

`applyContact` reaches equilibrium at **D ≈ 0.024**; in practice streak cells
span only **~0.0004 – 0.04**, while the seeded pool reaches ~1. This single
fact drives two design choices:

- **Colony growth** uses a *steep* seeding curve so the narrow streak band still
  produces a visible gradient (below).
- **Over-crossing** is detected **geometrically** (path re-visits a cell), not
  by density — re-streaking never makes a cell "heavy", so a density threshold
  could never fire outside the pool.

### 2. Colony growth (`generateColonies`)

Per cell with `D ≥ MIN_VIABLE`: `λ = SEED_BASELINE + SEED_RATE·D^SEED_EXP`,
clamped to `MAX_PER_CELL`; seed `floor(λ)` colonies + one more with prob
`frac(λ)` (deterministic per-cell `mulberry32`). The steep curve
(`SEED_EXP 1.9`, `SEED_RATE 2000`) **saturates to a lawn by D≈0.04** (the
freshly-loaded first-streak head), grades through clustered satellites, and
thins to **separated single colonies** in the dilute tails. `SEED_BASELINE` is
a small "luck floor" (a lone ancestor can drop anywhere streaked). Over the cap
`MAX_COLONIES`, colonies are thinned by an even stride (not truncated).

## Grading rubric (this is the product)

The debrief grade is the colony **outcome** *capped by* **technique flaws**.

### Outcome (`classifyStreak`)

- `isolatedCount` — colonies with no neighbor within `ISOLATION_DIST`.
- `hasConfluent` — ≥ `CONFLUENT_MIN_CELLS` cells ≥ `CONFLUENT_D`. **Note: the
  seeded pool alone satisfies this**, so it's nearly always true — outcome is
  effectively driven by `isolatedCount` vs `GREAT_ISO` / `GOOD_ISO`.

### Technique (`analyzeTechnique`) — five flaws, each maps to a debrief tip

| Flaw | Fires when | Teaches |
|---|---|---|
| `redipping` | `poolEntries ≥ REDIP_MAX_ENTRIES` (re-enters the inoculum disc) | don't re-dip the sample (the "starburst") |
| `noQuadrants` | `rotations < 1` with real streaking | rotate between quadrants (the continuous serpentine) |
| `oversmear` | `overlapRatio > OVERSMEAR_RATIO` (path re-covers cells ≥ `OVERLAP_HITS` times) | don't re-cover streaked agar |
| `underuse` | `plateCoverage < WHOLE_PLATE_MIN` (8×8 in-disc bin occupancy) | use the whole plate |
| `unlinked` | `≥ MAX_UNLINKED` strokes start in fresh agar (not near pool or a prior streak, within `LINK_RADIUS`) | cross the previous streak ("crossing the streams") |

### Cap (`gradeStreak` / `ceilingForFlaws`)

`0 flaws → great` allowed, `1 → good` ceiling, `≥2 → ok` ceiling. Final grade =
`min(outcomeGrade, ceiling)`. So a great-looking but sloppy run can't read
"Great". A clean run shows a "Clean serial dilution" affirmation instead.

## Config knobs (`src/streak/sim/config.ts`)

All thresholds are heuristic and **calibrated to scripted dev runs, not large
real-student samples** — recalibrate once you have classroom data. Current
values:

- `GROWTH`: `SEED_BASELINE 0.03`, `SEED_RATE 2000`, `SEED_EXP 1.9`,
  `MAX_PER_CELL 4`, `MAX_COLONIES 2500`, `CONFLUENT_D 0.3`,
  `GOOD_ISO 5`, `GREAT_ISO 12`, `MIN_VIABLE = STREAK_FIELD.MARK_MIN_DEPOSIT`.
- `TECHNIQUE`: `POOL_TOUCH_FACTOR 1.1`, `REDIP_MAX_ENTRIES 6`, `MIN_STREAKED 30`,
  `OVERLAP_HITS 6`, `OVERSMEAR_RATIO 0.3`, `COVERAGE_BINS 8`,
  `WHOLE_PLATE_MIN 0.25`, `LINK_RADIUS 0.35`, `MAX_UNLINKED 2`.
- `STREAK_FIELD` (deposit model — touch with care, it sets the streaking *feel*):
  `ALPHA 0.35`, `PICKUP_EXP 0.6`, `BETA 0.025`, `CARRIED_MAX 1.5`,
  `MARK_MIN_DEPOSIT 0.0004`.

## Verifying changes (dev hooks + Playwright)

DEV-only hooks on `window` (see bottom of `store.ts`):

- `__streakStore` — the zustand store (read/set state, call actions).
- `__devStreak(worldPts)` — drives **one stroke** along a world-space polyline
  (creates a stroke, applies contacts, records points). Carried load persists
  across calls; rotate between calls with
  `__streakStore.getState().rotatePlateCCW()` + `finishRotation()`.
- `__streakAssess()` — returns `{ grade: gradeStreak(...), tech:
  analyzeTechnique(...) }` for the current state. Use after `startIncubation()`.

Scripted-run expectations (the regression table to reproduce when touching
grading — drive via `__devStreak`, then `__streakAssess`):

| Run | Grade | Flaws |
|---|---|---|
| Proper 4-quadrant, linked | great | none |
| Starburst (re-dip every line, no rotation) | ok | redipping, noQuadrants |
| Whole-plate serpentine (one sweep, no rotation) | good | noQuadrants |
| Corner-cram | ok | underuse |
| Repeated over-crossing | ok | redipping, oversmear, (underuse) |
| 4 quadrants, disconnected islands | ok/capped | unlinked |

(Verification scripts live in `/tmp` during a session and are **not committed**
— recreate them from the hooks above. `npm test` covers the pure models.)

## Status — done

- Slices 1–3: streaking input/field, plate rotation, incubation + colony growth
  + debrief. (Merged.)
- Coverage + gradient growth retune (lawn → singles). (Merged.)
- Technique grading: all five flaws + grade cap + debrief feedback. (Merged.)

## Deferred ideas ("slice 4") + bell-ringer take

No formal spec exists; these are the recurring out-of-scope items. For a
3-minute bell-ringer whose job is "follow the quadrant method", the technique
rubric is **complete** — be wary of scope creep past the 3-minute sweet spot.

- **Incubation-time control** (less time → prime singles in the 2nd-to-last
  zone) — conceptually rich; adds a control + waiting. *Low–med.*
- **Per-quadrant zone overlay / labeled scoring** — could aid self-assessment
  vs the target graphic; tips already guide. *Med.*
- **Audio cues** — polish; classrooms often muted. *Low.*
- **Multiple plates / agar types** — scope creep. *Low.*
- **Tie into the gel/pipette sim** (transform → plate workflow) — big lift,
  beyond bell-ringer scope.

Recommendation on record: **ship, collect real classroom data, then recalibrate
thresholds** before building more.

## Known limitations / gotchas

- **Linkage is a start-only check.** `unlinked` flags a stroke whose *start* is
  in fresh agar. A student who starts in fresh agar but sweeps *back through* a
  prior streak mid-stroke would be a false positive. Left as-is deliberately
  (real students tend to start on the previous streak). Fix if it bites: also
  link when any of a stroke's early points hit the prior footprint (~20 min).
- `PATH.MAX_STROKES = 16`: a very long session drops the oldest strokes, which
  can under-count `poolEntries`. Errs toward *not* flagging — acceptable.
- Thresholds are tuned to scripted runs (above). Two real screenshots ≠ a
  distribution; don't retune on one data point.
