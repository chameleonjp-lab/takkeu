# Independent stage 2 review

Reviewed 2026-10-25: `git diff 3bc1c9a -- src/render/rallyEffects.ts tests/unit/rally-render.test.ts`, the current controller replacement table, stage 2 plan, and the supplied exact user requirements. Audio, loss rendering, full screenshots, performance, and flash-safety evidence remain outside this implementation review. No tests were rerun and no production files were edited by the reviewer.

## Verdict

**Spec compliance: accepted for stage 2 implementation after the scoped follow-up review.** All three original P2 findings below are addressed in actual geometry. Thresholds, replacements, fixed resources, 2000 backdrop placement, and the four 4000 arrival phases are implemented. Actual screenshots, motion/performance and safety acceptance remain separate pending work.

**State/integration: accepted within this diff.** No controller, app, camera, gameplay, ranking or PR26 result-surface changes are introduced by the reviewed stage 2 diff. Permanent replacements match the controller table and 4001+ preserves the final world. Arrival geometry uses confirmed state and simulation time, and retains exact expiration checks.

**Quality: accepted for this implementation stage.** New work continues using four fixed batches and existing preparation/disposal. Follow-up tests inspect electric junctions, three-dimensional position variation, table color channels, camera-projected arrival geometry, and arrival priority fading. No additional concrete code defect was found in this scoped follow-up. Actual camera screenshots and temporal sequences must establish visual quality and foreground readability.

## Original findings — resolved in follow-up

1. **Resolved P2 — Missing 2500 band-following lightning.** `orbitRibbon()` now adds 96 standard / 48 low-quality electric segments, with independent time-dependent radial and vertical waves, traveling color, and an opacity envelope along the band. The source now draws actual electric strokes around the orbit. The added test checks nonplanar strand geometry separately from the original flat ellipse.

2. **Resolved P2 — Missing additional branches at 3250.** `crossing()` now forks two progressively thinner, lower-opacity segments from selected original trail junctions when `score >= 3250`. Branch positions include depth changes. The strengthened test reconstructs segment endpoints and verifies at least eight additional degree-three junctions between 3249 and 3250, beyond merely checking the swarm label.

3. **Resolved P2 — Missing intertwined 3D electricity at 3500.** `tableHalos()` now adds two opposed electric strands around the base halos. Their radius and height vary together around the ellipse, with opposite phases and continuous time evolution. The added test isolates newly appended 3500 geometry and confirms more than `.24` world units of height variation. The original rings remain, and resource ownership/caps are unchanged.

The follow-up also adds tricolor perimeter/net channels at 1500, keeps a visible floor-traveling wave, makes the meteor path horizontal, constrains 4000 expansion/overlap radii to the supported camera, and fades an older arrival over `.35` seconds when a newer major arrives. The arrival fading multiplies only newly appended geometry, leaves event facts intact, resets batch opacity afterward, and does not extend original deadlines. Tests verify all four 4000 phases contain projected visible arrival vertices; the overlap phase has visible vertices from each of its four rings in the unchanged landscape camera. These geometric checks remain distinct from observed screenshot/motion acceptance.

## Checked behavior and evidence limits

- The 1250 meteor uses a four-second cycle; 1500 tricolor strokes have distinct widths, tail lengths and periods. Motion/alpha are computed continuously rather than random frame flashes. The 1750 floor waves use a four-second cycle and are removed at 2500. Side halos use a three-second cycle and are replaced at 3500. Background single halo is replaced at 2750; meteors are replaced by the swarm at 3250; center density increases from 3750 and disappears at 4000.
- The 2000 transition fades the new normal-blended dark backdrop and stars over 2.5 seconds. It places the backdrop in front of the far wall and stars above rays obstructed by the opaque court, with the camera/court materials unchanged. The projection test validates many star vertices in a 1280×720 frame and proves their rays clear the far court edge. This is useful geometric evidence; portrait visibility, backdrop seams/coverage, foreground contrast and perceptual depth still require the planned actual screenshots.
- The 3000 arrival contains a jagged expanding ring plus rainbow waves and expires after 3.5 seconds. The 4000 implementation uses explicit inward, assembly, accelerated expansion, and overlapping fade branches over four seconds, with differing generated geometry. The final world remains after the arrival and at 4001+. These source properties do not prove that the full four-phase sequence is clearly visible through every supported viewport.
- Reduced-motion time is fixed, while stages remain distinct. Standard/low reduce density without skipping stage conditions. Geometry/material/node allocations remain fixed, and active ranges are capped. This does not establish frame-time or device targets.
- Stage 1 follow-up is accepted: 700 halo breathing and 900–999 gradual brightening are now implemented with geometry/color assertions; see the addendum in `stage1-review.md`.

## Logs inspected

- `logs/render-stage2-green.log`: 52 renderer tests passed.
- `logs/render-stage2-shapes-green.log`: 57 renderer tests passed after shape corrections.
- `logs/render-stage2-priority-green.log`: 58 renderer tests passed after arrival-priority correction.
- `logs/render-stage2-typecheck.log`: typecheck completed without diagnostics.
- `logs/render-stage2-suite.log`: 907 tests passed and one `release-revision.test.ts` assertion failed (908 total). This is not a full-suite green result and must remain reported until resolved or isolated with evidence; it was not a failure in the stage 2 renderer tests.
- `logs/render-stage1-exact-green.log`: 22 stage 1 renderer tests passed after the two earlier findings were fixed.

Required browser captures/temporal motion, comparison performance, flash analysis and real-device acceptance were still pending at this review. They must not be inferred from the unit results above.
