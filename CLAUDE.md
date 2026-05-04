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

- Vite + React 19 + react-three-fiber simulation of micropipetting DNA into an electrophoresis gel.
- Zustand store drives a small workflow state machine: `GET_TIP → INTAKE_SAMPLE → LOAD_WELL → RUN_GEL → COMPLETE`.
- Source layout:
  - `src/store.ts` — workflow state, plunger, liquid, well contents, proximity flags.
  - `src/components/Pipette.tsx` — pipette mesh + cursor tracking + interaction detection.
  - `src/components/LabObjects.tsx` — table, tip rack, sample tube.
  - `src/components/GelBox.tsx` — wells and band animation.
  - `src/components/UIOverlay.tsx` — instructions, plunger slider, failure modal, run button.
  - `src/store.test.ts` — Vitest unit tests for store transitions.

## Commands

- `npm run dev` — Vite dev server on :3000
- `npm run lint` — `tsc --noEmit`
- `npm test` — Vitest run

## Refactor plan

The active multi-chunk refactor and design rationale live in
[`docs/fix-plan.md`](docs/fix-plan.md). Read it before making
non-trivial changes; update it when you finish a chunk or change
direction.

## Working agreements for agents

- Prefer fixing root causes over patching symptoms. If a coordinate system is wrong, fix the coordinate system; don't add fudge factors.
- Keep interaction detection (world-space) and rendering (scene graph) decoupled from input capture (mouse/keys) and workflow state (zustand).
- New 3D interaction logic should use raycasting against an explicit ground/well plane, not screen-space heuristics.
- Don't introduce per-band `setInterval`s or other ad-hoc timers when `useFrame` will do.
- Add a unit test in `src/store.test.ts` for any new state transition.
