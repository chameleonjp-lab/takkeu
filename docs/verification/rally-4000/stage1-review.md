# Independent stage 1 review

Reviewed 2026-10-25 against PR26 merge `aff31169fd6feaad7bad35f22fe3de26429296cf`, the rally-4000 design/plan, architecture audit, PR26 preservation audit, and the current uncommitted source/tests. Scope: event state, loss event facts, app/finish integration, notices, and the 0–1000 renderer. Audio work and 1250–4000/loss rendering belong to subsequent stages and are not accepted by this review.

## Verdict

**Spec compliance: changes requested for two stage 1 visual behaviors below.** The event/state, initial-best capture, notice timing/priority, finish integration, and PR26 protection are otherwise consistent with the documented requirements.

**Implementation quality: sound bounded architecture, with targeted corrections required.** The controller is separate from gameplay progression and RNG; the renderer reuses fixed GPU batches and disposes them; the HUD does not intercept input. Existing tests establish state and geometry contracts, but active-effect names alone do not establish the required motion. Actual image/motion, browser lifecycle, performance, and flash-safety acceptance remain pending.

## Remaining findings

1. **P2 — The 700 background halo does not expand and contract.** `src/render/rallyEffects.ts:162` passes a constant radius of `1.55` to `ring()`. Changing the phase of a complete uniformly colored ellipse changes tessellation positions around the same outline; it does not produce the user's requested slow expansion/contraction. Add a small continuous simulation-time radius modulation, with a fixed distinguishable reduced-motion representation. Verify changing radius/bounds across an appropriate time interval rather than only checking `single-halo` is active.

2. **P2 — The 900–999 corner buildup never increases brightness.** `src/render/rallyEffects.ts:113` uses score progress only for ring/streak radii. Ring alpha stays `.35`, streak alpha stays `.4`, and their colors/widths are fixed, so the requested progressive brightening toward 1000 is absent. Modulate bounded intensity/opacity or glow strength with score progress and assert the RGBA/intensity increase between 900 and 999. Preserve removal at 1000 and reduced-motion behavior.

## Corrected during review

- The original 100 arrival skipped far-half perimeter segments, so its light could not complete the requested exterior lap. The current implementation removes that clipping, and the strengthened renderer regression checks coverage around the full exterior. `logs/render-stage1-review-green.log` records 20 passing tests after the correction.
- The original notice integration used frozen gameplay time and hid every in-play UI cue immediately on game over. Current app code passes the drawing snapshot and finishing flag; the notice accepts this flag and expires gold rays on drawing time. `logs/ui-finish-green.log` records 7 passing tests including this regression.
- New batches now have explicit degenerate-geometry preparation and cleanup, and `GameView.resources()` reports the new effect statistics and capacity. Preparation remains behind the existing loading lifecycle.

## Contracts checked

- **PR26:** `git diff aff31169... -- src/ui/resultComments.ts src/ui/resultEffects.ts src/ui/result.css src/ui/screens.ts src/ranking/resultPosition.ts` is empty. The existing 44 result comments and 2000+ final comment remain unchanged. In-play normal notices call the same pure `resultComment()` function. Ranking still calls `resultPosition.show(activePlay)` before `ranking.finish(..., 'game_over')` on the first gameover frame; submission is not delayed until presentation finishes.
- **Confirmed events and deduplication:** score/loss watermarks reject old facts before advancing the presentation clock. Distinct hits/losses in a batch keep copied positions, and foreign runs are ignored. The only simulation change adds exact sampled loss position and cumulative loss count to the existing event; score, loss timing, RNG and phase decisions are untouched.
- **Initial best:** `beginRun()` saves the previous run, resets the session, then creates the controller with the saved best. New hits are consumed before the frame's `rememberBest()`. Nonzero initial best crosses once; zero does not create a first-run record. Suppressing best text under a major notice is consistent with the supplied priority rule because record state, ring and audio fact remain available.
- **Pause/restore/reset/finish:** visual age uses simulation time. Drawing the same paused snapshot does not enqueue or restart an arrival. Retry/home replace controller state by run. Context restoration reconstructs the view from retained state. Finish extends only the cloned drawing clock and keeps the existing five-second cap and frozen ball references; ranking receives the real finalized snapshot score.
- **Resource bounds:** four geometries, four materials, six owned nodes, and 10,240 quad capacity are fixed. Draw/upload ranges use active vertices; quality changes density. Histories are bounded and no growing event-ID set is retained. Disposal is idempotent. The controller retains some expired facts until another confirmed event, but render/UI age checks suppress them and the arrays remain capped.
- **Visible regions:** table effects attach to `tableRig`, while background effects use a scene-space root. Background threads/crossings/halo are placed in front of the opponent wall and above the floor, and depth testing remains enabled. This is a reasonable source-level placement; it does not prove adequate visible area, foreground readability, or motion quality through the real camera and opaque court. Required screenshots and temporal sequences must establish those separately.

## Evidence inspected

No tests were rerun for this independent review. Read the existing full logs: `integration-green.log` (3 files / 19 tests), `state-green.log` (8 files / 82 tests), and `render-stage1-green.log` (18 renderer tests). Also inspected the subsequent renderer/UI correction logs cited above, successful `stage1-typecheck-final.log`, and `stage1-unit-retry.json` (99 suites / 868 tests passed, zero failed). That full-suite run precedes the last focused corrections; it is not evidence that all later changes were included.

The state tests cover threshold boundaries, watermark replay, copied positions, initial best, rolling loss window, simultaneous events, bounded history, and post-4000 continuation. Renderer tests cover stage presence, confirmed hit positions/lifetimes, exact arrival expiry, fixed resources, pause equality, quality reduction, disposal, reduced motion, preparation, and the corrected full lap. The two remaining findings show why required motion/brightness needs geometry/color assertions and observed temporal evidence in addition to stage-presence assertions.
