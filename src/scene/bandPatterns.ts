/**
 * Per-lane DNA band signatures. Imported by GelBox to render each
 * lane's bands; the run-duration constant lives in src/sim/config.ts
 * (RUN_DURATION_MS) so the rules layer can use it without crossing
 * the sim → scene layer boundary.
 *
 * Each entry is an array of relative migration distances. A band's
 * final on-screen position equals `entry[i]` (units along -X) once the
 * run finishes. During the run, `pos = t * entry[i]` where
 * `t = clamp((now - runStartedAt) / RUN_DURATION_MS, 0, 1)`.
 *
 * Pedagogy: lane 1 is a "ladder" reference (5 evenly-stepped bands),
 * lanes 2 and 4 are the SAME sample so a successful run produces
 * identical patterns there — a duplicate-control teaching point — and
 * lane 3 is a distinct sample.
 *
 * Lanes 2 and 4 share a literal const reference so future tweaks can't
 * silently drift them apart. `bandPatterns.test.ts` enforces that.
 */

const SAMPLE_A: readonly number[] = [0.5, 0.9, 1.5];

export const BAND_PATTERNS: ReadonlyArray<readonly number[]> = [
  /* Lane 1 — ladder */ [0.3, 0.6, 1.0, 1.4, 1.9],
  /* Lane 2 — sample A */ SAMPLE_A,
  /* Lane 3 — sample B */ [0.4, 0.7, 1.6],
  /* Lane 4 — sample A duplicate */ SAMPLE_A,
];
