# Independent measurement-method review (Stage 1 screening)

Reviewer: separate `measurement_review` agent; read-only inspection of product code and measurement inputs. No browser, test, build, large hash scan, or artifact extraction was run. This is a method review, not the final implementation/evidence review.

Inspected `tests/helpers/investigatePerformance.mjs` (runner SHA256 reported by v2: `d87054d18adf0acbc479e9e266cdb8bb7217a33d3ef0690cc5e8a9daaead730f`), the investigation plan, app/audio/render lifecycle code, v2 summary and five small compressed measurement bodies. Measurements were still progressing; values below identify the exact first-repeat rows inspected and are not the completed matrix verdict.

## Important findings

### M01 — Audio-disable hypothesis is contradicted by code and measurement

`src/audio/audio.ts` `reset(nextRunId)` increments generation, changes runId, clears event histories and disconnects voices. It **does not set `enabled=false`**. `suspend()` and `dispose()` do, but `show()` calls `reset()`, not either of those methods.

The v2 row named `D06-original-silent-1` has `audible:false`, yet its source-node count increases by **2,038** and total created nodes by **6,484** during measurement. Initial source count is384; therefore the claim that the ordinary fixture is silent is false for this observed run. The `no-audio` control correctly has zero new source/nodes. Preserve the misleading historical row name but explain it; do not label the original benchmark as silent or its added `unlockAudio()` as a necessary correction. Verify the original spec's native-node counters before changing its audio setup.

Status: reported immediately; product code unchanged. Hypothesis is negative for inspected code and row. Audible perception/human listening remains unverified; native allocation proves processing occurred, not listening quality.

### M02 — D03 changes CPU generation, uploads and rendered workload together

`freeze-effects` skips `rallyEffects.update` after one early post-reset frame. This suppresses attribute updates and freezes early queued-ball geometry, including the absence of later hit rings. It is independent of D02's hiding switch, but is **not a pure CPU-generation ablation**.

First-repeat normal versus freeze: median uploaded bytes489,460→117,588; p95 triangles46,972→45,242. Thus a frame-interval difference includes transfer and geometry differences. The direct measured normal `effects` duration remains valid evidence of that CPU scope. A pure generation-cost check needs identical frozen input, an equivalent pre-generated buffer, unchanged draw topology, and equal uploads, with equality checked explicitly.

Status: parent accepted classification as a combined freeze control and plans a separate frozen-input/equal-upload comparison. v2 cannot establish CPU-only causality.

### M03 — GPU results are incomplete and selected by the eight-pending limit

The runner caps pending queries at8, stops issuing while that cap is reached, and ends without draining them. The inspected PR row has31 valid GPU results plus8 pending across105 RAF samples; many rendered frames were never queried. The queried subset depends on queue progress, and the last8 results are systematically absent. A non-disjoint valid query is not a whole-run GPU median.

Record query attempts, issued, valid, disjoint, not issued, timeout and remaining counts; after the measured interval, pause the real loop and drain asynchronously without adding drained intervals to the performance sample. Unavailable values stay null. Scope GPU statistics to the actual sampled frames even after draining.

Status: parent plans explicit issuance accounting and post-measurement drain in v3. Existing raw records remain useful but incomplete screening evidence.

### M04 — Warmup mutates best-score state and thereby the measured workload

Warmup runs real autoplay for3 wall seconds. `createApp.rememberBest()` updates the in-memory best score. Calling `stage3.show()` again replaces simulation state and changes runId, but does not reset preferences.bestScore. On the new run's first events, the effects controller is constructed with the retained warmup best. The resulting best-record effect/sound can occur during the measurement, and its threshold depends on how much simulated time the warmup achieved.

Control bestAtStart identically across subjects using test-only setup (for example, suppress best accumulation only during warmup), and record the effective bestAtStart. Preserve normal loop/physics; record initial simTime and first-frame timing rather than silently changing the loop's clock rules.

Status: parent plans test-only warmup suppression and explicit bestAtStart evidence. v2 is screening, not the formal paired comparison.

### M05 — D05 reports zero background time without timing the cache path

The normal background path calls `time('background', work)`; the cache lookup/replay path does not. Its reported background0 does not measure a zero-cost cached update. Replay still calls line/rect methods and performs buffer writes. Wrap both paths with the same timing boundary.

The cache records only line/rect/setOpacity calls, omitting stars' `particleCount++`. The inspected D05 first sample and final resource report8 particles while stars remain drawn; normal reports248. Resource-count differences in this control therefore cannot establish reduced visible content or actual particle-resource count. Restore the cached particle-count delta or explicitly mark these counters invalid for D05.

Status: parent plans equal timing boundaries and particle-count delta replay in v3.

### M06 — CPU quota delta includes startup and warmup

`beforeCPU` is read before Vite/browser creation; `afterCPU` after measurement. This delta includes module loading, shader preparation, warmup and collection. It is a whole-case observation, not measurement-window throttling. Keep it, but add immediately-before/after-measurement snapshots before attributing a performance difference to quota behavior. Even a measured throttle delta alone is correlation, not a causal quota experiment.

Status: parent plans measurement-window snapshots. No quota-causality conclusion is supported by v2.

## Other corrections before formal acceptance use

- Source provenance currently reads `HEAD:src`, not working source bytes. Good for these fixed clean baseline trees, insufficient for an uncommitted candidate. Save actual source/test manifests before/after each comparison group and assert stability; capture runner content/hash once at process start and assert it did not change rather than hashing possibly changed disk content after a run.
- The absolute-target expression should explicitly require initial phase running and exactly30 initial balls, and a separate execution-valid field should include errors/blocked requests. Currently these are fields but not all are target requirements. The recorded10s rows properly do not pass the60s target.
- `simulation` measures `stepSimulation` only. It excludes repeated snapshots, test autoplay targeting, loop bookkeeping, event dispatch/audio, UI/layout, and diagnostic bookkeeping. `rainbow` excludes ball-shell color work. Label these boundaries; do not add overlapping `rainbow` into `presentation`, or `background` into `effects`, to estimate a total.
- D04's geometry-color check sees preparation-created color arrays, so it can freeze white preparation colors before any late-stage rainbow computation. It remains a diagnostic stop control, but is not matched-color CPU-only evidence. Matched frozen inputs avoid that ambiguity.
- No-profile rows currently have empty cpuFrames and correctly produce null cost percentiles (not0). Preserve this distinction. Missing cost keys in a profiled row map to0 only where the associated operation is demonstrably absent.
- The p50 helper is nearest-rank, selecting the lower middle for even counts. Label it p50 or document that definition; do not silently mix it with an arithmetic two-middle median in later summary comparisons.
- The runner records triangles/lines/points but does not yet record actual submitted element counts or unique active vertices. Triangle count×3 is element submission count, not unique vertices for an indexed geometry. Keep these quantities separate for an indexed candidate.
- `audible:true` ignores the boolean returned by unlock. If retained for a dedicated test, record that result plus source counts. A flag alone cannot prove an active graph.
- Full/light/off all retain native AudioContext allocation hooks. D07 isolates per-frame collection under a common hook cost, not every cost of the observer. If audio graph instrumentation itself becomes a candidate cause, use a separate hook-disabled condition.

## What the current method does correctly

- Diagnostic source transformations exist only in the standalone test runner; no product API/export is required.
- D02 leaves effect generation running and hides only named roots at draw time. Its CPU-generation timing remains measurable; GPU uploads/submissions also disappear, so it is a rendering-path control, not a pure fragment-cost estimate.
- GL queries are asynchronous, extension-checked, disjoint-checked, and unavailable GPU times are not replaced with0.
- Renderer submission time and GPU time have separate data fields. GPU polling overhead is outside the renderer-submission field and should remain described as such.
- Each browser is closed before the next case, external origins are blocked, no automatic resume or physics guard override is present, and all sample intervals/phase/ball data are retained for full/light.
- The original absolute target is not weakened, and short diagnostic rows cannot meet it.

## Review verdict

**Suitable as explicitly limited screening; not yet suitable for pure CPU causality or final performance acceptance.** M01 requires a factual correction, not an audio product fix. M02–M06 require the controls/metadata described above before stronger causal claims. Retain all v2 data and failed setup logs. This review does not approve a production optimization or imply final functional, safety, device, or CI acceptance.
