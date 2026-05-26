# CLAUDE.md

Guidance for AI agents (and humans) working on this repo.

## Golden Rules

1. **Architecture is portable, tools are not.**
   Learn patterns, not tool-specific implementations. For a game: capture → state → render → update is stable even if Unity swaps for Godot. Here: input → store → 3D scene → frame update should stay legible regardless of whether we're on react-three-fiber, Three.js directly, or something else later.

2. **Principles-based guidance scales better than rules.**
   AI can apply judgment. Give it intent ("don't swallow errors", "separate concerns") not exhaustive rules. This lets Claude maintain code across many files without rigid instructions.

3. **If the agent builds it, the agent can maintain it.**
   Involve AI in construction with conversation artifacts. Claude can debug 6 months later if it built it. Keep handoff files and refinement logs.

4. **Script → LLM handoff.**
   Heavy lifting (data crunching, asset loading) in scripts. LLM works from summaries. Script does O(n) once; LLM does O(1) from summary.

5. **RLM pattern (REPL + recursion).**
   For complex tasks: keep data outside context, operate programmatically, use sub-agents for focused sub-tasks. Prevents context-rot on large codebases.

6. **Separation of concerns.**
   Each module does one thing. Easier to understand, test, modify. Apply this to systems (input, physics, rendering, UI, workflow state).

7. **Adaptive thresholds.**
   Don't hardcode. Adjust behavior based on scale (small game = simple, large = strategic).

## Project shape (current)

Vite + React 19 + react-three-fiber. The app is a **multi-sim launcher**
(`src/AppRouter.tsx` + `src/ChooseSim.tsx`, hash-routed) hosting two
independent high-school lab simulations:

### 1. Electrophoresis / micropipetting sim (the original)

- Zustand store drives `GET_TIP → INTAKE_SAMPLE → LOAD_WELL → RUN_GEL →
  COMPLETE` via a "lock-and-act" input model.
- Layout: `src/store.ts`, `src/sim/` (pure rules/geometry), `src/scene/`
  (r3f drivers + camera), `src/components/`, `src/ui/`, `src/store.test.ts`.
- Design rationale + roadmap: [`docs/fix-plan.md`](docs/fix-plan.md) — the
  authoritative source for this sim (the older file enumerations elsewhere may
  lag the lock-and-act redesign).

### 2. Streak-plating sim (`src/streak/`, route `#/streak`)

- Quadrant streak-plating onto agar → incubation → colony growth → a debrief
  that grades both the colony **outcome** and the streaking **technique**.
  Workflow: `GET_LOOP → STREAK → INCUBATE → COMPLETE`.
- **Read [`docs/streak-handoff.md`](docs/streak-handoff.md) first** — it has the
  architecture, the two core models (dilution field + colony growth), the
  technique-grading rubric, the config knobs, dev hooks, and tuning notes.
- Layout: `src/streak/sim/` (pure models + config + tests),
  `src/streak/scene/` (r3f drivers + meshes), `src/streak/ui/StreakDebrief.tsx`,
  `src/streak/store.ts`.

## Commands

- `npm run dev` — Vite dev server on :3000
- `npm run lint` — `tsc --noEmit`
- `npm test` — Vitest run
- `npm run build` — production build (each sim is route-code-split)

## Roadmaps

- Gel sim: [`docs/fix-plan.md`](docs/fix-plan.md) (multi-chunk refactor +
  decision log).
- Streak sim: [`docs/streak-handoff.md`](docs/streak-handoff.md) (architecture +
  what's done + deferred ideas + tuning notes).

Read the relevant one before non-trivial changes; update it when you finish a
slice/chunk or change direction.

## Working agreements for agents

- Prefer fixing root causes over patching symptoms. If a coordinate system is wrong, fix the coordinate system; don't add fudge factors.
- Keep interaction detection (world-space) and rendering (scene graph) decoupled from input capture (mouse/keys) and workflow state (zustand).
- New 3D interaction logic should use raycasting against an explicit ground/well plane, not screen-space heuristics.
- Don't introduce per-band `setInterval`s or other ad-hoc timers when `useFrame` will do.
- Add a unit test for any new state transition or pure-model change, in the
  matching `*.test.ts` (gel: `src/store.test.ts` / `src/sim/*.test.ts`; streak:
  `src/streak/store.test.ts` / `src/streak/sim/*.test.ts`).
- Keep simulation *models* pure and framework-free (the `sim/` folders).
  r3f components/drivers translate input → store → scene; they don't hold rules.
