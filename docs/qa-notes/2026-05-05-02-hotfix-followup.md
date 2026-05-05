# QA Testing Notes — Hotfix Follow-Up

**Tester:** Claude (E2E, simulated user)
**Date:** 2026-05-05 (second session of the day)
**Build under test:** post-PR-#8 hotfix on `main` (commit `5f56231` and forward, deployed to https://naddicott-dtech.github.io/Pipette-Practice/)
**Predecessor session:** [`2026-05-05.md`](./2026-05-05.md) — flagged the camera-feedback P0s the hotfix targeted.
**Test type:** Smoke tests against the hotfix's stated fixes, scope limited to verifying P0 remediation.

---

## Headline

The hotfix moved the build from "first step impossible" to **"every step looks like a 3D platformer credits sequence"** — the camera now hunts the cursor and the cursor hunts the camera, producing a feedback loop. Funnier than the prior break, but not the goal. The fix is one block of code in `CameraRig.tsx`.

## Smoke test verdict

| # | Test | State machine | Camera framing | Notes |
|---|---|---|---|---|
| 1 | Tip pickup | ✅ `hasTip=true`, `step=INTAKE_SAMPLE` | ❌ stares into the void | pre-zoom hover on tip-rack confirmed; `lookAt` runaway during hold |
| 2 | Sample intake | ⚠️ blocked | ❌ pipette-shaft close-up | plunger UI vanished mid-zoom (couldn't drag); hover went null |
| 3 | Well eject | ⚠️ blocked | ❌ same shaft close-up | wells should be near closeup-friendly territory; runaway still kicks in |
| 4 | PUNCTURE | not run | — | would need stable hover for 600 ms; same camera bug blocks |
| 5 | Cursor over empty table | n/a | ❌ this IS the bug | with no hover, camera follows the cursor; cursor follows the camera |

Stopped here — running tests 3–5 would just reproduce the same regression in three more flavors.

## Root cause: camera ↔ cursor feedback loop

The hotfix correctly added `closeupLook = hoverTarget.position` when something is hovered. The bug is the *fallback path* introduced alongside it:

```ts
} else if (state.pointer) {
  closeupLook.current.set(state.pointer.x, 0, state.pointer.z);
}
```

This creates a per-frame loop:

1. Cursor moves → `usePointerWorld` raycasts → `state.pointer` updates.
2. `CameraRig` reads `state.pointer`, sets `closeupLook` to that world point.
3. Camera lerps toward that world point. Camera position changes.
4. Next frame: `usePointerWorld` raycasts from the new camera. The same screen-space cursor position now projects to a *different* world point.
5. `state.pointer` updates → step 2 → camera moves further.

Since `loweredDepth` blends in, even a small `loweredDepth` drives the camera toward the cursor's projected point, which immediately shifts under the moved camera, so the camera keeps chasing. Result: when there's no hover (mouse over empty table or in transit), the camera flies around following the cursor's drift.

When a hover *is* active the world point is fixed (the target's world position), so no feedback. The bug is gated to "no hover" + "non-zero `loweredDepth`" — which is exactly the moment between starting to lower and grabbing a target.

## Fix sketch (one block, three lines smaller than current)

```ts
// CameraRig useFrame, replace the if/else-if/else block with just:
if (state.hoverTarget) {
  const h = state.hoverTarget;
  const t =
    h.kind === 'tip-rack' ? TIP_RACK.position
    : h.kind === 'trash' ? TRASH.position
    : h.kind === 'sample' ? SAMPLE_TUBES[h.index].position
    : WELLS[h.index].position;
  closeupLook.current.set(t[0], t[1], t[2]);
}
// no else branch — closeupLook keeps its previous value when there's no hover
```

Reasoning: if the player has never hovered anything this session, `closeupLook` stays at its initial value (origin / OVERVIEW lookAt) — the original buggy-but-stable behavior. If the player has hovered something and moves the cursor away, `closeupLook` retains the *last* target — so the camera completes its lean-in toward something stable rather than chasing the cursor. No path can produce the feedback loop.

This is what I (the tester) sketched in concern #2 of the hotfix review. Today's hotfix tried a more aggressive variant ("lookAt also tracks the cursor") which introduced the loop.

## Other observations

### Hover-radius bump confirmed mistargeting risk

Cursor at screen `(550, 360)` resolved to **DNA 2** instead of DNA 1 — Manhattan distances 0.38 vs. 0.52. With the prior 0.45 radius the cursor would have missed both. With 0.6 you can hit the wrong tube without realizing. Still a net win over 0.45, but the visual hover ring (only on DNA 1, hardcoded in `LabObjects.tsx`) doesn't match the actual hit zone (any tube). Ship a per-tube highlight that follows whichever tube `findHover` resolves to.

### Other hotfix items confirmed in source

- Title fix: ✓ `dist/index.html` shows the new title.
- Float-equality fix on intake transition: ✓ in source. Couldn't exercise it directly because the camera bug blocks intake, but the change is correct.
- Sample-tube radius bump: ✓ in source; see mistargeting note above.

## Visual fidelity (added after first session, not noticed earlier)

These two are in `src/components/Pipette.tsx` and have nothing to do with the hotfix — they're pre-existing P3 polish that became more visible once the camera leans in.

### Liquid in the tip is upside-down

```jsx
<mesh castShadow rotation={[Math.PI, 0, 0]}>     {/* tip cone — flipped, apex DOWN */}
  <coneGeometry args={[0.08, 0.6, 8]} />
</mesh>
{liquidInTip > 0 && (
  <mesh position={[0, 0.1, 0]}>                  {/* liquid cone — NOT flipped, apex UP */}
    <coneGeometry args={[0.07 * liquidInTip, 0.4 * liquidInTip, 8]} />
  </mesh>
)}
```

Default `coneGeometry` has its apex at +Y. The yellow tip applies `rotation={[Math.PI, 0, 0]}` so the apex points down (correct). The purple liquid mesh has no rotation, so its apex points up — like a teardrop balanced on its point inside a downward-pointing cup. Liquid in a real pipette tip fills from the apex upward; the geometry should narrow at the bottom and widen at the top, mirroring the tip's interior wall.

Fix:

```jsx
{liquidInTip > 0 && (
  <mesh
    position={[0, -0.3 + 0.2 * liquidInTip, 0]}
    rotation={[Math.PI, 0, 0]}
  >
    <coneGeometry args={[0.07 * liquidInTip, 0.4 * liquidInTip, 8]} />
    <meshStandardMaterial color="#8b5cf6" emissive="#8b5cf6" emissiveIntensity={0.5} />
  </mesh>
)}
```

The position formula keeps the liquid's apex pinned to the tip's apex at y = -0.3 (within the tip group) regardless of fill volume.

### Disposable tip is too thin relative to the shaft

- Pipette body: `cylinderGeometry args={[0.2, 0.15, 3]}` → bottom radius 0.15.
- Tip top (after flip): radius 0.08.

The tip is half the diameter of the shaft it attaches to. On a real micropipette the tip's wide end is friction-fit onto the shaft and has roughly the same outer diameter, then tapers to a fine point over a length comparable to ⅓ of the shaft. Current model looks like a needle pushed into the end of a pen.

Fix:

```jsx
{hasTip && (
  <group position={[0, -1.55, 0]}>                   {/* shifted +0.15 so apex stays put */}
    <mesh castShadow rotation={[Math.PI, 0, 0]}>
      <coneGeometry args={[0.15, 0.9, 8]} />         {/* base 0.15 = matches shaft; height 0.9 = ⅓ body */}
      <meshStandardMaterial color="#fbbf24" transparent opacity={0.9} />
    </mesh>
    {liquidInTip > 0 && (
      <mesh
        position={[0, -0.45 + 0.3 * liquidInTip, 0]}
        rotation={[Math.PI, 0, 0]}
      >
        <coneGeometry args={[0.13 * liquidInTip, 0.6 * liquidInTip, 8]} />
        <meshStandardMaterial color="#8b5cf6" emissive="#8b5cf6" emissiveIntensity={0.5} />
      </mesh>
    )}
  </group>
)}
```

Tip base 0.15 matches the shaft bottom exactly. Height 0.9 is ~30 % of the body's 3.0. Liquid base 0.13 sits just inside the tip wall. Position offsets keep the tip apex at the same world Y as today, so any depth/puncture math is unchanged.

Bundle 6.5.1 + 6.5.2 into one ~10-line follow-up — both touch the same JSX block.

## Severity summary

| ID | Severity | Title |
|---|---|---|
| H-cam-loop | **P0** | Camera lookAt feedback loop when no hover; cursor and camera chase each other |
| H-tube-highlight | P2 | Hover-radius bump means players can hit wrong tube; visual rings don't match hit zones |
| 6.5.1 | P3 | Liquid mesh apex points up (should point down to match tip interior) |
| 6.5.2 | P3 | Disposable tip half the diameter of the shaft; should match shaft outer diameter |

## Recommendation

Don't ship another hotfix. Roll all four findings into Chunk C:

- **H-cam-loop** is naturally fixed by C3's redesign — the new `CameraRig` has three discrete presets (`OVERVIEW`, `ACTION`, `RUN`) keyed off `interactionPhase`, not a continuous `loweredDepth` blend. There is no per-frame "where to lookAt" decision that depends on the cursor's current world point. The feedback loop cannot occur because the camera target is determined by *which discrete state* the workflow is in, with the lockedTarget's world position frozen at lock time.
- **H-tube-highlight** is folded into C4 (multi-well loop + active highlights). Per-tube ring tracks both the active step (the tube the player should target) and the live hover (the tube the cursor is over). When those differ, prompt copy can warn before lock, and `WRONG_TUBE` warning fires on commit.
- **6.5.1 + 6.5.2** land as a small visual-fidelity commit in C6 (polish) — geometry only, no logic.

The interim live build at `naddicott-dtech.github.io/Pipette-Practice/` is broken in a different but equally unplayable way until C ships. The product owner has been informed.
