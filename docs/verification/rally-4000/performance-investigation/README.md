# PR #27 performance investigation — 2026-10-26

大画面の手動低画質で比較性能の改善を確認した。4000ラリー・30球・1280×720/DPR1、同じfull計測の3組でp95を25.05–33.27%短縮。中央値199.9→133.4ms、ゲーム進行50.586→55.557秒/実時間60秒。標準画質のp95は200→200msで改善せず、絶対目標25ms/95%/59秒は未達。iPhone実機は未確認。総合性能問題は未解決でありDraftを維持する。

[Stage 1 原因と確度](causes.md) / [Stage 2 修正・不採用・全反復結果](stage2-report.md) / [Stage 3 回帰・安全性・最終測定](stage3-report.md) / [実機手順](iphone-procedure.md)。これは新しい計測系列であり、過去の異なる計測方式の値を改善率へ流用していない。以下の原因調査本文・元ログは履歴として残す。

A: main/merged PR26 `aff31169fd6feaad7bad35f22fe3de26429296cf`, source tree `52b45edfb0b8947223b8947437ef6fa9ee79cf5f`.
B: PR27 head `059bcba8a5dc1aa2ab0a9c3b8d972be1c0b3c674`, source tree `47bd0f370ad169de00c77b37bb74429b63020d44`, tests tree `097b10b95f55aded9d77af6dd4ed6b85925b9684`. Runtime source/tests/package/config match historical `d30aa196`; documentation differs. PR27 is open Draft. Production files in A/B are unchanged.

[Environment and file hashes](environment.json), [plan/ledger](plan.md), [independent method review](measurement-review.md), [corrected diagnostic summary](stage1-summary.json). Node24.19.0/npm11.9.0/Three0.186.1/Playwright1.64.1; Chromium156.0.8078.4, headless ANGLE SwiftShader, 1280×720, DPR1/2. Cgroup4 CPUs quota, effective CPUs0–4, memory16GiB. Profiled diagnostics retain GL renderer/extensions. Formal profile:false cases retain launch configuration, browser, actual drawing size and CPU counters, but their GL metadata and GPU times are null; they do not independently re-query the renderer. No iPhone is attached.

## Methods and limits

All browsers ran serially; no concurrent unit/build/browser/large file operations during accepted measurements. Small read-only reviews ran concurrently. Startup and 3s active-stage resource warmup precede each measured interval. The corrected runner resets the test scenario, initial best to starting score and the real loop clock atomically; it does not change dt, collision, step budget, guards, or auto-resume. Both A and B use the same runner. Scores advance under the existing real physics/autoplayer; these are starting-score workloads. Best controller state is logged; an old-run controller may remain until first events, and normal runId guards apply. No external request is allowed; all runs use the test ranking stub.

The full collector retains every RAF interval, running phase/score/simTime/30-ball status, resources, native audio graph counts and available heap. Light omits detailed resources/audio/heap; off records intervals and endpoints only and cannot establish continuous-running/30-ball acceptance. Timing includes JS/native wall time and possible scheduling delay; it is not per-thread CPU cycles. Simulation scope is `stepSimulation`, rainbow scope is the presentation vertex update (ball color work remains in presentation), background is nested in effects, so these columns must not be added together. Render submission is CPU wall time around `renderer.render`, not GPU completion.

v2 screening has the documented method defects in the independent review; all 28 records remain. v3 corrects best/clock initialization, GPU query coverage/drain, background replay timing/particle counts, and measurement-bracket cgroup counters. It also removes unnecessary audio unlock. `reset()` never disabled audio: the misleading historical `D06-original-silent` name is retained only for traceability; actual sources were generated. **The silence hypothesis is rejected.**

A mechanical v3 summary-key bug duplicated `valid` and named another key `inframes`. Raw query arrays are intact. `stage1-summary.json` recomputes query counts and conventional medians from those arrays; original files are preserved. No unavailable timing is treated as zero. The current runner corrects the key. v3 profiled runs issued one query per rendered frame and drained all; all obtained queries are non-disjoint. Non-profiled controls have GPU/costs null.

D02 hides only new roots after their updates continue. D03 live freeze stops generation **and transfers**, and freezes early geometry; it is a composite control, not CPU-only evidence. The separate frozen probe compares identical 30-ball input, triangle stream, draw count and upload bytes with generation on/off. Exact RGBA match normal/frozen, standard and low; all96 asynchronous queries valid. It measures fixed-scene work, not live progression or a formal target result.

## Observed causes and candidate priority

Numbers below are short diagnostic observations, not 60s acceptance results. `stage1-summary.json` is authoritative for all values and raw files retain every sample. Frames are not independent repetitions.

| Processing | A main | B PR27 | Difference/control | Confidence | Candidate |
|---|---:|---:|---|---|---|
| Live4000 standard,12s p95 |166.7ms|200.0ms|sim10.40→9.97s; v2 reverse-order repeats also slower B|Strong: repeated direction, exact causal size still uncertain|Re-test >=3 long pairs|
| New effect generation, frozen standard |absent|0.80ms median|same uploads653004B/34draws/46972triangles; freeze CPU submission2.25→1.40ms, GPU87.21→93.35ms|Confirmed CPU cost; negative for explaining major GPU/frame delay|Avoid speculative broad CPU changes|
| New rendering, frozen standard |not exact main|87.21ms GPU full|hide new roots81.68ms; low90.54→84.81ms; ranges overlap|Strong incremental rendering cost; existing scene dominates|Test indexed batches, without reducing effects|
| New dynamic data, peak frozen |no new batches|535416B new attributes/frame|whole scene653004B vs117588B hidden|Confirmed redundant corner storage, causal latency benefit unknown|4 vertices/6 immutable indices; retain only if measured benefit|
| Existing rainbow CPU |~0.5ms typical|~0.5ms typical|live freeze did not consistently improve p95|Negative as main delay cause|No production rainbow changes now|
| Star/halo CPU |absent|~0.4ms typical|static replay did not consistently improve p95|Negative as main delay cause|No reduced update frequency or shader rewrite now|
| Audio generation |native sources present|native sources present|no-audio p95 not consistently better; corrected B200→200ms|Negative as primary cause; audio quality unmeasured|No audio rewrite/removal|
| Collector |same method|full/light/off p95 200/200/183.3ms|v2 repeats do not confirm consistent gain; typical collection <1ms, some scheduling outliers|Small overhead confirmed; frame impact uncertain|Use same full method for formal comparison; no product credit|
| Resolution |not isolated here|standard DPR1→2:1280×720→1885×1060|GPU93.61→143.40ms; p95 200→299.9ms; lowDPR2 remains1280×720,183.4ms|Confirmed resolution dependence in software renderer|Preserve existing quality settings; no automatic downscale initially|
| CPU quota |~48.5 CPU s/12s|~48.8 CPU s/12s|~8s summed throttling, almost every quota period; 4-core affinity drops throttle to.094/.027s yet p95 216.7/183.4ms|Throttling confirmed; rejected as sufficient explanation/fix|Retain original5-core affinity for all formal comparisons|
| iPhone Safari |unknown|unknown|no physical device|Unknown|Provide physical-device procedure; no Linux extrapolation|

The v2 DPR2 standard second run paused with zero simulation advance; its idle RAF p95 is **not** an improvement. It remains a failure record. Absolute reference target remains25ms/95%/59simSeconds/continuous30balls; no threshold is relaxed. Short diagnostics cannot pass the60s target.

## Stage 1 checkpoint history

958 unit tests pass on unchanged B after restoring the SQL migration to the sparse checkout. First attempt957pass/1failure was missing sparse-checkout SQL input; both complete logs remain. Indexed-representation guard is RED on current production as expected. A1064-case pre-change triangle-stream/color reference was captured before any production edit.

At this checkpoint the next candidate was indexed BufferGeometry. Its1064 expanded triangle/RGBA cases matched and transfers decreased, but16 long trials did not establish a latency benefit. It was reverted at94a90b1; [complete verdict](indexed-verdict.md). The retained production change is solely the large-viewport LOW pixel budget inquality.ts; seeStage2. No physics/input/audio/effect-generation algorithm was changed.
