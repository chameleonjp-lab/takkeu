# Final whole-branch review — frozen pre-archive report

Review scope: `/workspace/takkeu-work`, baseline `6ec38720b4f720c71bf48c5aef3cdc5732fdd578` to production HEAD `b0b6760610c17dc5a1f19efebf42049a31df1150`. Main reference: `aff31169fd6feaad7bad35f22fe3de26429296cf`. This is a read-only review using the requesting-code-review reviewer template; no source/index/HEAD mutation, new browser run, build, or test execution was performed. The report itself is outside the checkout.

**Status: source, functional evidence, performance, canonical and corrected supplemental flash evidence audited. This pre-archive report is ready to freeze into the evidence archive. Full archive restoration remains the only unfinished review work and will receive a separate addendum outside the archive. Draft only; no merge or deployment authorized.**

## Requirements applied

The latest user ruling withdraws the original requirement to preserve all 43 effects, their density, and pixel identity. It permits declining adaptive quality if its mechanism adds load. The authoritative current plan is `docs/verification/adaptive-rendering/revised-plan.md`; the old effect-preservation and adaptive specifications are historical. Protected game rules, fixed timestep, max-step/pause criteria, 30-ball simultaneous returns, input/collision, necessary audio/HUD, results and ranking must remain intact.

## Strengths and source findings

- The complete production diff against 6ec is confined to four renderer files. The `src/game` Git tree is exactly `338e82dd682036d1819822784e99d8a0fafed6bc` at both revisions, and `src/audio` is exactly `4a50247edb63cee950f1e75dab6191c6c3f0e2b4`. App, loop, input, storage, quality, view creation, particles, results, ranking, database/migrations, and fixtures have no final diff. This supports the protected-behavior claim much more strongly than a test count alone.
- `src/render/rallyEffects.ts:64-138` uses two fixed batches and no per-stage geometry allocation. Hash collisions probe forward; deduplication at lines 83-92 requires exact time and XYZ equality. Distinct coordinates/times therefore survive, even if their quantized hash collides. The controller caps hits at 512 and losses at 100 (`src/game/rallyEffects.ts:97-102`), so 1024 slots and the 16-bit indices are sufficient. The table reserves `512*12+4` quads, preserving all four final edges under maximal distinct-hit load. World capacity retains 100 six-ray losses.
- Feedback reads immutable facts; it does not consume events or call physics/input/audio. Buffers clear each update, foreign runs and ready state are excluded, expiry uses simulation time, and repeated disposal is guarded. Tests exercise hash collision independence, exact deadlines, pause/retry, final loss, and buffer identity. The prior capacity finding is fixed with a meaningful regression test (`tests/unit/feedback-render-budget.test.ts:58`).
- Ball mesh simplification changes only segment counts (`src/render/balls.ts:9-16`). Three instanced draws, material/depth behavior, physical radius, instance transforms, and the shadow implementation remain. High-score environment/field/floor removal is explicit renderer policy, with earlier-stage behavior retained and existing number notices still drawn (`src/render/celebrations.ts:101-127`, `src/render/presentation.ts:37-42`).
- Test deletions correspond to retired visual geometry. Replacement coverage retains hit/loss coordinates, lifetime, immutable facts, reduced motion, and resource lifecycle. Browser changes alter old shape/count expectations without weakening gameplay, input, release, or performance tests. The compatibility test handles an unshipped `auto` stored value using the original preference loader.
- Adaptive rejection documentation correctly identifies `cpuMs` as elapsed synchronous resize-path time, which can include GPU waiting and OS scheduling. It does not attribute the entire delay to pure CPU work or extrapolate Linux results to iPhone.

## Functional, visibility and input evidence

- Saved local unit JSON reports 914 passed, zero failed/skipped; release JSON reports 8 expected, zero unexpected/skipped/flaky. The initial missing-browser-path launch failures are retained separately and are not counted as product failures or successful tests.
- Both saved final GitHub runs contain six successful jobs. Full job logs show 97 interaction + 3 load tests per browser (200 total), and eight release tests. Push checkout is b0b; PR checkout is `e7424bcdce86a7995c97b9b1dbb0f3f43785d696`. The saved proof gives identical complete Git trees `89b634281d2fb056c115de1a865925fc178f1c22` for those two commits. The PR checkout is a CI merge commit, not an authorized merge into main.
- Release tests explicitly check root and Pages builds, revision identity, debug-query ineffectiveness, unavailable fixture/source/dev-server URLs, and absent `window.stage2/stage3` (`tests/release/distribution.spec.ts:37-69`). The measurement transforms are test-owned and not imported by production.
- `manual-render/comparison.json.gz` contains 72 accepted comparisons from 144 captures, no failed checks, and minimum eligible white core 229 against the unchanged 220-baseline/200-final threshold. The corresponding 4000 overlap PNG pair was visually inspected: decoration is substantially removed, with the two visible balls and paddle retained. This does not prove every ball is distinguishable in all overlap conditions.
- `manual-native/comparison.json.gz` has 1500 frame pairs, zero snapshot/effect/event/coordinate/warning differences, minimum eligible core 230. Eight streams of 375 frames equal 3000 captures, so `nativeFrames:1500` in the preverification summary counts compared pairs. These are production-physics visual replays with an explicit 16ms test clock, not real-time performance measurements. Overlapping baseline silhouettes are explicitly excluded from the white-core criterion; only 31 incoming and 27 outgoing eligible observations per browser/quality remain, and this scope must stay visible in claims.
- Native input uses trusted Playwright mouse dragging and touchscreen taps, checks `isTrusted`, maintains pointer capture, and calculates expected coordinates independently by ray-plane intersection (`artifacts/adaptive-rendering/runners/native-manual-input.spec.ts:11-48`). Eight cases pass; 116 saved coordinate checks have maximum error 0.731555 CSS pixels. Context recovery, rotation and retry are covered. This is browser-native input, not physical finger testing.
- Four resource audits each contain a warm sample, 20 retries, and five view recreations. I recomputed equality of the saved geometry/texture/program/capacity counters: all match within each repeated workload. The earlier unequal-warmup procedure failure is retained. Forced-GC heap samples are Chromium-only; this does not establish zero global leak or physical-device longevity.
- Network mocks/blockers and the unchanged ranking/database source support no live ranking-write requirement. Browser fixture and diagnostic code blocks or intercepts nonlocal traffic; no live score submission was performed by this review.

## Completed performance audit

I independently decompressed every final standalone run and every original-suite attachment, recomputed nearest-rank p50/p95/p99, <=25ms fraction, simulation progress, functional continuity, and acceptance outcomes. All derived primary metrics match the saved report. I also compared all 39 standalone pre/post source maps against the recorded Git commits (232 unique source/input files), and verified every raw-file hash. The actual loaded runner hashes match `performance-revised.mjs` and `performance-phone-revised.mjs`.

There are **55 executions: 39 standalone plus 16 unchanged original-suite runs**. Of these, **44 use final b0b and all 44 remain functional; 11 use baseline 6ec, of which 10 remain functional**. Thus 54/55 are functional and **0/55 meet all absolute performance targets**. These totals do not include the 16 separately identified historical baseline profiling observations reused in the diagnostic matrix.

| Three valid pairs, median | Baseline standard | Final standard | Baseline low | Final low |
|---|---:|---:|---:|---:|
| p50 ms |133.3|66.7|100.0|50.0|
| p95 ms |283.3|133.4|200.0|116.6|
| p99 ms |316.6|166.7|299.9|166.6|
| Fraction <=25ms |0.101810|0.107551|0.106181|0.115996|
| Simulation seconds per 60 wall seconds |38.1647|55.8796|48.1466|57.2091|

Standard uses pairs 1/2/3; low uses pairs 1/2/4. Failed baseline low pair 3 is retained, and both sides of that pair are excluded from continuous-play medians. I independently reproduced its 2049.9ms maximum interval, first slow-frame pause at wall 3642ms, 16.8ms overall p95 and only 0.908236 simulation seconds per 60 wall seconds. Its low p95 is paused RAF and is correctly excluded from gameplay claims. The replacement pair preserves source, runner and protocol.

The 300-second final low run stays running with 30 balls and reaches score 9511; p95 is 100ms and simulation advances at 58.1461 seconds per 60 wall seconds, so it also misses the absolute target. Relative improvement is supported in this Linux software-rendering setup, not a claim of smooth/60fps or mobile-device performance. Quantized `performance.memory` values are insufficient to establish no heap growth; the separate forced-GC resource audit explicitly records modest JS growth.

The 43-policy decision table has the stated counts (8 retained, 2 lightened, 13 simplified, 20 removed). I checked all 76 catalogue raw-file hashes and recomputed each eight-query scene GPU median. Documentation labels these as whole-scene diagnostics rather than isolated per-effect costs, which is correct.

## CI retention and publication-image audit

The official index contains 13 attempts and 78 full job logs. I independently checked every retained log's byte count and SHA256, cross-checked checkout SHAs present in the logs, and joined all completed checkouts to the 14 saved Git-tree proofs. This includes historical failures/cancellations and final b0b push/PR success rather than silently retaining only green runs.

All 61 downloaded-artifact receipts agree with the saved GitHub API digests, expected sizes, local ZIP sizes and completion index (2,712,303,295 provider bytes). The verifier reads each complete ZIP, hashes it, checks provider bytes/digest and `ZipFile.testzip()` before writing a verified receipt. I additionally rehashed and CRC-checked the five smallest provider ZIPs (4,484,393 bytes); I did not independently re-read every 2.7GB ZIP at this stage. Full CAS restoration is still a separate pending gate.

The six planned public before/after PNGs have correct manifest hashes, 402x874 dimensions, and decoded RGB byte equality with their native sample images. Their provenance correctly says the PNG container was re-encoded and claims pixel equality, not original PNG-container identity.

The final safety comparison must distinguish freshly matched A/F samples from original 6ec warning streams. Some current baseline RGB differs from archived baseline RGB despite equal exposed game/effect state, and the cause is unisolated. No unconditional resolution of the original seven warnings is justified. The corrected supplemental actual-physics captures now pass the full per-frame state/event/clock equality check described below.

## Canonical flash audit

All 36 canonical streams are complete: 18 matched A/F pairs, each 360 frames at 60fps, 1024x768, six seconds. I recomputed the six reported temporal/frequency maxima and the flag predicate from every retained 360-row analysis, checked the original 21824-area threshold and 341x256 window, and verified source stability, errors/blocked traffic, exposed snapshot/effect state and drawing-size equality across every pair. I joined all ten reused old-video references to their full part/video/decoded-RGB restoration records and checked the expected 849,346,560 decoded bytes per stream. This row-level audit does not constitute a new independent accredited pixel-screening algorithm or a human visual assessment.

The fresh canonical baseline has nine flagged conditions (the original seven labels plus both 2600 modes); final F has **one retained warning: 1000-low**. There are zero newly flagged matched conditions. For F1000-low, the conservative general-large-closing-frame count is **4 per second**, exceeding the unchanged threshold of 3, even though its high-frequency area is 6432, below 21824. Its red per-pixel count increases from 2 to 3. The analyzer explicitly notes that its closing-frame aggregate can overcount spatially staggered flashes; this is an unresolved screening warning, not proof of formal nonconformance or of safety.

Other individual metrics also increase below the flag threshold: general high-frequency area includes 9207→10395 for 1500-standard, 9152→10328 for 2600-low, 9207→10395 for 2600-standard, 6824→7335 for 3000-low, 9175→9875 for 3000-standard, 6293→6377 for 4000-standard, and increases in both 4000-fireworks cases. The 4000-standard-loss100 maximum general per-pixel count rises 9→10. Reduced flag count must not be described as every metric or every pixel improving.

For the original seven warning cases, current baseline RGB exactly reproduces 1000 standard/low and 1500 standard/low. It does **not** reproduce 3000-low or 4000 standard/low, despite equal exposed game/effect state. The unexplained mismatch prevents unconditional closure of the original seven-warning record. It is appropriate to report the fresh matched sample results and retain the historical warnings separately.

## Rejected and corrected supplemental captures

The requested full physical-frame equality check caught a genuine procedure failure before acceptance. The initial standard A/F supplemental streams differ in 582 frame/key checks, including clock in all 360 frames and the first true snapshot mismatch at frame 8 (`physical-flash-initial-clock-mismatch.json`). Navigation-dependent performance origins left different initialRAF/current-time offsets; subsequent alternating 16/17ms advances could cross different RAF counts. These first four captures and analyses must remain rejected for matched before/after safety inference, with full failure evidence preserved.

The corrected runner changes only test-clock alignment guards and recorded provenance. I inspected its exact diff, then independently checked every corrected capture: `performanceTargetMs=120000`, `initialRAF=now=120016` before sampling, followed by exactly the declared sample times. Both modes have 360 matching frame pairs across all 10 required keys (`snapshot`, `effects`, `newEvents`, `renderingEnabled`, `clock`, `centers`, `css`, `drawingSize`, `warning`, `notice`): **720 frame pairs and 7200 strict key equalities**. Every sample remains running with 30 balls and rendering enabled. All four source maps match the recorded Git commits and the executing runner hash matches `native-physical-flash-aligned.mjs`. The analyzer is byte-identical to baseline 6ec. Capture/analysis/lossless-RGB proof hashes agree.

I independently recomputed all six physical screening maxima and the flag predicate from each 360-row analysis. Both baseline and final standard/low streams remain flagged:

| Supplemental full-browser physical capture | Baseline standard | Final standard | Baseline low | Final low |
|---|---:|---:|---:|---:|
| General high-frequency area |40783|37098|38613|34713|
| Red high-frequency area |6|2|2|1|
| General large-closing frames/sec |7|1|7|1|
| Peak mean luminance |0.527794|0.247093|0.525506|0.245417|

Final general high-frequency areas remain above 21824 in both modes. There are zero newly flagged supplemental modes, but these are **two additional retained final warnings in a distinct scope**, not a safety pass. Canonical canvas-only synthetic overlap and supplemental actual-physics full-browser/CSS captures must remain separate. Accepted final screening comprises 40 streams/14400 frames; rejected initial 1440 frames and the zero-frame localhost-permission launch failure remain separate retained records. The canonical 36 audit is unaffected.

I read final-results.md, safety.md, effects-decisions.md, visibility-input.md, unresolved.md and the archive-method draft. The completed-result documentation accurately preserves the numeric outcomes, excluded failures, coarse heap limitation, retained warnings, original-RGB uncertainty and latest-main integration boundary. The archive-method claims remain conditional on the separate restoration gate.

## Issues

### Critical

None identified in the reviewed production diff or completed evidence.

### Important / evidence gates

1. **Absolute performance targets remain unmet.** All 55 completed executions fail at least one original absolute target (p95 <=25ms, >=95% intervals <=25ms, >=59 simulation seconds/60 wall seconds, continuous 30-ball play). Final b0b improves the repeated comparisons and all 44 final-version runs remain functional, but the Draft must clearly distinguish relative improvement from target achievement. This is a retained release limitation, not evidence of a newly introduced functional regression.
2. **Final flash warnings remain.** Canonical 1000-low exceeds the original conservative large-closing-frame threshold (4 versus 3). Corrected supplemental actual-physics standard and low both exceed the general high-frequency area threshold (37098/34713 versus 21824). Keep these as Important unresolved screening limitations, together with the historical seven warnings and unexplained old-baseline RGB differences. The absence of newly flagged conditions does not establish safe, warning-free or formally conformant behavior.

3. **Latest-main integration is unverified after an independent upstream advance.** `concurrent-main-advance.json` records main advancing from `aff31169fd6feaad7bad35f22fe3de26429296cf` to `532025df5e40ce94556c0b90ede85f707933bc7f` through separate PR28 (21 commits, 13 files). None of its listed files overlaps the four final render changes, but app-frame progress reporting, ranking client/configuration, SQL migrations and tests changed. The saved PR27 response says `mergeable:true/clean` while still reporting base `aff3116` and merge checkout `e7424bc`; that stale observation cannot prove integration with new main 532. Existing CI and performance remain valid for the exact reviewed source and old base only. Keeping b0b frozen and documenting this boundary is appropriate for the authorized Draft-only delivery. Any later integration/merge requires a fresh current-base checkout and validation; no merge/rebase or production ranking operation is authorized by this review.

4. **Final archive restoration is pending.** Source/evidence review is complete, but the final CAS manifest, all parts/objects/external references and restoration logs must still be checked. Freeze this report inside the archive and publish a separate restoration-review addendum to avoid a self-referential archive. Do not claim the final archive verified before that evidence exists.

### Minor

1. **Historical diagnostic entrypoints lack a revision guard.** `scripts/performance/render-audit.mjs:56-57` always dereferences the two removed glow meshes; running it against final b0b will fail. `scripts/performance/adaptive.mjs:59-76` assumes the old four-batch/star-function profiling anchors. Current final evidence uses different runners under `artifacts/adaptive-rendering/runners/`. Mark these tracked scripts as historical, state their supported revision, and document the final reproducible entrypoints/archive locations. The draft `unresolved.md` now explains this limitation, but its line 23 initially named the incompatible `render-final.mjs`; I verified the actual final capture runner SHA `440e07d7e09ed94ee462f29d587c00c914e5eed5d53748329742664cbb59ba85` matches `render-playable.mjs` and requested that documentation correction. The corrected `unresolved.md` now names `render-playable.mjs` and labels `render-final.mjs` historical; the reproducibility-documentation correction is verified. The optional historical CLI guard remains deferred. Preserve historical bytes and never edit an actively loaded measurement runner. This is a tooling/documentation concern, not a production runtime defect.

## Declined to judge

- Preservation of all 43 original visual designs, exact density and original pixels: explicitly withdrawn by the latest user ruling.
- Shipping adaptive quality or certifying its rejected policy: the user permits rejection; final source restores original manual modes. Historical trial limitations remain reportable.
- Physical iPhone Safari speed, actual finger feel, HDR, formal WCAG conformance and human visual/audio comfort: no physical-device or human assessment evidence; Linux browser emulation cannot establish these.
- Absolute absence of memory growth over arbitrary session lengths: available resource audits bound only the measured retry/recreate workloads; the five-minute final run is now audited, but it cannot establish unlimited-session behavior.
- Integration with newly advanced main 532: outside the frozen baseline comparison and unverified; explicitly retained as an Important integration gate before any later merge.
- Live production ranking/database behavior: source preservation and local/mock tests are appropriate here; live submissions/schema changes are explicitly prohibited.
- Original multi-gigabyte historical artifacts unrelated to claims used by this final review: not fully decoded; final evidence archive restoration remains pending. All claimed final flash rows and reference proofs were audited within the scope stated above.

## Assessment

**Ready to merge? No — Draft only; no merge authorized.** The production changes are coherent, aligned with the revised scope, and supported by completed functional/visibility/input and relative-performance evidence. All 44 final-version real-time runs remain functional, but absolute performance targets, canonical and supplemental screening warnings, and latest-main integration remain unresolved.

**Ready for evidence archive freeze? Yes.** No new production fix is required by this review. Freeze this pre-archive report with its retained limitations; completion of the authorized Draft delivery remains conditional on the final archive restoration addendum. No release/merge/safety clearance is implied.
