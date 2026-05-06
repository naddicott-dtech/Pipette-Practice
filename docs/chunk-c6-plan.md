# Chunk C6 plan — band patterns, run animation, debrief

C5's content (trash + discard) shipped early in the C3 follow-up. C6 is
the last chunk in the original Chunk-C plan: replaces the last
`setInterval` in the codebase, gives each lane a distinct band
signature, and adds the post-run debrief modal that surfaces the
warnings the rules layer has been quietly accumulating since C2.

User feedback as of 2026-05-08:
> "Bands appear out of wells 1 and 2. Add the same effect for wells
> 3 & 4. Have the band pattern for 2 and 4 match (the rest should
> have some variation)."

This pins down a concrete pedagogical model: **lane 2 and lane 4 are
duplicate samples** (same DNA → same bands) and **lanes 1 and 3 are
distinct**. The matching pair teaches "identical samples produce
identical patterns," which is what you'd actually use a duplicate
control for in a real lab.

## C6a — Per-lane band signatures + useFrame migration

**Goal.** Each lane runs its own band pattern. Lane 2 ≡ Lane 4. The
existing 16 setIntervals collapse into a single frame-driven animation
keyed off `runStartedAt`.

### Patterns

Hard-coded in a new `src/scene/bandPatterns.ts`:

| Lane | Pattern (relative migration distance) | Pedagogy |
|---|---|---|
| 1 | `[0.3, 0.6, 1.0, 1.4, 1.9]` (5 bands, evenly stepped) | "ladder" — sets the size scale the student reads other lanes against |
| 2 | `[0.5, 0.9, 1.5]` (3 bands)                            | sample A |
| 3 | `[0.4, 0.7, 1.6]` (3 bands, different positions)       | sample B |
| 4 | `[0.5, 0.9, 1.5]` (≡ lane 2)                            | sample A duplicate |

Numbers are illustrative; we can tweak before the PR. The point of the
file is that lanes 2 and 4 are the *same* literal array — anyone
re-tuning later won't accidentally drift them apart.

### useFrame migration

- New `RunAnimation` (or directly inside `Well`): a single `useFrame`
  reads `runStartedAt` and a `RUN_DURATION_MS` constant, computes
  `t = clamp((now - runStartedAt) / RUN_DURATION_MS, 0, 1)`, and sets
  band positions to `t * pattern[i]`.
- After `t = 1`, the controller flips `step` to `COMPLETE`. The current
  rules-layer transition for COMPLETE doesn't exist yet — this chunk
  adds it.
- Rip out `Band` subcomponent's `useState` + `setInterval` + cleanup.

### Tests

- New `src/scene/bandPatterns.test.ts`: lane 2 array === lane 4 array;
  lanes 1 and 3 differ from both each other and the (2,4) pair; all
  arrays are non-empty.
- `src/sim/rules.test.ts`: a `tickRun(state, elapsedMs)` rule (or
  whatever the controller calls) returns `step: COMPLETE` once
  elapsed ≥ `RUN_DURATION_MS`.

## C6b — Debrief modal + per-lane verdicts

**Goal.** When the run completes, surface a modal with one verdict per
lane. The verdicts are derived from `state.warnings` (which the rules
layer has been recording correctly since C2) plus per-lane DNA volume.

### Verdicts

| Verdict | Trigger |
|---|---|
| `clean` | no warnings on this lane, dna > 0 |
| `faint` | `SOFT_STOP_TO_EJECT` warning on this lane |
| `muddled` | `NO_FRESH_TIP` warning on this lane (cross-contamination from a prior tube) |
| `mislabeled` | `WRONG_TUBE` warning on this lane |
| `missing` | dna === 0 (the rules layer doesn't currently produce this — it would only land via a partial-eject path that left zero behind) |
| `loose-tip` | `LOOSE_TIP` warning recorded against this lane (rare, from a single-tap pickup) |

`LOOSE_TIP` is recorded against `activeStep` at pickup time, not against
a lane that was loaded later — verify in the rules tests this still
maps to a specific lane number that matches the cycle.

### UI

`src/ui/Debrief.tsx`:
- Header: "Run complete"
- Per-lane row: lane number, verdict label + one-line explanation,
  matching color from the warning palette
- Buttons: **Run again** (calls `reset()`); **Close** (just dismisses,
  modal stays available via overview)

Copy lives in `failures.ts` next to the existing `FAILURE_COPY` so the
copy table stays the single source of truth.

### Tests

- `src/sim/verdict.test.ts` (new pure helper):
  `verdictForLane(laneIndex, state) → VerdictCode`. Covers each row
  above with minimal `state` setups.
- Component test deferred (no harness for r3f/r2 yet).

## C6c — Final polish

Small items that don't merit their own chunk:

- **Title / page meta.** `index.html` `<title>` should match the app
  name; double-check the deploy URL still works after any vite
  config touchups.
- **Camera ACTION offset for tip-rack / sample / trash** — currently
  unchanged from the pre-C5 default. They work, but if the player ever
  reports the same "can't see what's happening" issue we hit on
  LOAD_WELL, we know where to look. No code change unless they do.
- **Run-step rules.** Adding the `tickRun` rule (mentioned above)
  closes the last gap in the canonical transition table. The
  `INV-5: every transition is in the canonical table` test mentioned
  in the original plan can finally be written once that's wired.
- **Bundle size.** Production bundle is 1.4 MB (421 KB gzip). Three.js
  alone is most of that. Out of scope for C, queued for any future
  perf chunk.

## Sequencing

1. **C6a — bands + useFrame.** PR-1 lands the visible improvement
   first. Lane 2/4 match, others differ; bands animate smoothly via
   `useFrame`. No debrief yet — run still ends with the existing "Run
   complete. Review the results below." prompt.
2. **C6b — debrief.** PR-2 wires the modal and verdicts, completes the
   feedback loop.
3. **C6c — polish.** PR-3 if anything's left after a hands-on pass.

C6a should be a tight commit (~150 lines of changes, mostly pattern
arrays and the useFrame). C6b is the bigger one — modal layout +
verdict logic + tests.

## Acceptance against the original Chunk C milestone

After C6 ships, every item from the C-level acceptance criteria
(`docs/fix-plan.md` line 684) is satisfied:

- ✅ All six failure/warning modes reachable (true since C3 follow-up;
  six failures + four warnings, two extra warning codes added by the
  follow-up).
- ✅ Multi-well loop (C3+).
- ✅ Soft-stop pedagogy (C3).
- ✅ Trash bin (C3 follow-up — early).
- ✅ Per-mode failure modal copy (C1).
- ⏳ **Bands separate over a real time window during RUN_GEL —
  setInterval-per-band gone** (C6a).
- ⏳ **Debrief verdicts** (C6b — strictly speaking the original
  acceptance criteria don't list "debrief modal," but the plan
  references it as the place where warnings turn into verdicts.
  Worth shipping for the classroom value).

## Out of scope (deferred to D)

- Tutorial overlay
- Per-step retry vs. full reset
- Touch / mobile support
- Camera orbit / zoom controls
- Settings panel
- Code-splitting / bundle reduction
