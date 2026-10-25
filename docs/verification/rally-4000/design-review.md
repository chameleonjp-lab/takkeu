# Builder-check design review

Reviewed 2026-10-25 before production implementation, against baseline `aff31169fd6feaad7bad35f22fe3de26429296cf` and the rally-4000 design/implementation plan. This is an implementation-readiness audit, not visual, listening, hardware, or flash-safety acceptance.

## Verdict

The independent presentation-controller design is buildable and appropriately separates effects from progression rewards. Proceed with the corrections and acceptance gaps below recorded; do not treat this design review as proof that the implementation or performance requirements pass.

## Corrections required while building

- The authoritative loss event is emitted in `src/game/simulation.ts`, not `session.ts`. The existing emitter already copies an optional `position`. Copy the actual sampled loss coordinate at that event boundary; changing physics, loss timing, or the plan to manufacture an effect position would breach the protected behavior.
- `createApp` consumes confirmed events in `createLoop.onEvents` while the renderer receives an accumulated frame event batch. Feed the presentation controller once from the confirmed-event boundary and render its state separately. Multiple fixed ticks in one frame must not collapse distinct loss coordinates or score crossings.
- Run identity, deduplication, best-at-start capture, home/retry cleanup, pause, resize, context loss, and restored rendering must reset or preserve presentation state deliberately. Rendering the same snapshot must not enqueue an arrival again.
- `createFinishPresentation` already freezes physics and advances a drawing-only clock, capped at five seconds. Extend its end-time input, preserving the existing snapshot score and immediate ranking lifecycle. Do not delay result submission until effects finish.
- The renderer's current `resources()` reports geometries, textures, programs, draw calls, legacy fireworks activity/capacity. New resources and particles must also be represented in evidence or clearly identified as uninstrumented. Fixed-pool construction and disposal need direct tests.
- Existing `appHarness.show` is a test-only state fixture, and `stageHarness` is a static scene fixture. Fixture scores are useful for effects/performance but cannot establish successful physics progression from 0 to 4000. Keep the distinct deterministic physics test.
- Existing performance tests run the real app loop and preserve slow-frame pause. Keep those guards and report interrupted runs explicitly; browser test execution success is independent of the <=25 ms and continuous-play targets.

## Protected-surface checks to retain

- Production changes must avoid camera/projection, input mapping, collision/scheduler/trajectory/difficulty behavior, score/reward rules, ranking API/schema/data, and the PR26 result files/layout/comments.
- Event-derived effects may not consume gameplay RNG. History and GPU/node/material allocations need fixed bounds through 4001+ and repeated runs.
- Dedicated 1000/3000/4000 audio replaces normal fanfare only at those events; 2000 remains unchanged. Warning priority at voice saturation needs a graph/voice test and a separate waveform/listening verdict.
- Star/background visibility requires screenshots through the real opaque court and camera. Reduced motion must retain distinguishable stages. Quality must reduce density rather than skip required cues.
- WCAG 2.3.1 must include the existing rainbow/gold/number alternations. Temporal image analysis is evidence with stated limits, not a substitute for human observation or device testing.

## Evidence plan check

Baseline is a detached worktree at the exact merged PR26 commit. Baseline typecheck/full unit logs and all performance attempts are retained under this directory. Performance uses the same test-owned real-loop harness, 30 initial balls, 1500/2000/3000/4000, standard/low, 60 real seconds, two repeats per browser. Unknown external requests are aborted and reported. Raw frame intervals, simulation phase/pause reason, resources, audio allocations, supported heap samples, duration, and verdict fields remain in JSON, including failures. Linux reference performance and actual target-device acceptance are separate statuses.

## Outstanding acceptance gaps at review time

All new effects, event/state tests, boundary/replacement captures, temporal sequences, dedicated audio, loss effects, fixed GPU resource caps, flash analysis, human listening, hardware testing, 0-to-4000 physics proof, and post-change comparisons are pending. No merge, deploy, or production score submission is authorized by this review.
