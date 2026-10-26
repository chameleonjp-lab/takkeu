# PR27 performance investigation and implementation plan

Goal: Preserve all 43 effects and gameplay rules; establish causal costs and measured improvement.
Authority: user's 2026-10-26 request (requirements fixed; no intermediate approval gates).
Architecture: fixed A main and B PR27; test-only Vite transforms for ablation/timing, identical real-loop collector; independently verified production fixes only.
Stack: Node 24.19.0, npm 11.9.0, Three 0.186.1, Playwright 1.64.1.

## Constraints
No physics/input/score/ranking/audio specification changes, no production diagnostics, no live Supabase traffic, no merge/publication. Serialized browser measurements; raw failures retained. Original Linux target unchanged. Human/device/WCAG conclusions separate.

## Review focus
Measurement overhead; independent hiding versus update freeze; changing score trajectories; startup shader/audio readiness; evidence/code provenance and uncertainty.

## Stage 1
- [x] Fix A=aff31169fd6feaad7bad35f22fe3de26429296cf and B=059bcba8a5dc1aa2ab0a9c3b8d972be1c0b3c674; compare canonical d30aa196 source/tests.
- [x] Record environment, source/test hashes, browser/GL, quota deltas and drawing size.
- [x] Run short D01–D08 controls and collector full/light/off comparisons. Capture frame/CPU/GPU/GL/audio/heap/time advancement, unavailable values null.
- [x] Separate original fixture audio behavior from audible workload; identical new method on both codes.
- [x] Save cause/confidence/candidate table and commit investigation.

## Stage 2
- [x] Select one measured cause, add behavioral/geometry regression test, observe failure, implement narrow change.
- [x] Measure individual effect and reject ineffective/regressing changes.
- [x] Preserve exact pixels where possible; otherwise predefine tolerance, retain before/after temporal images.
- [x] Commit each justified fix with measurement evidence.

## Stage 3
- [x] 4000/30-ball standard and low >=3 paired interleaved >=60s comparisons, retain dispersion and all attempts; main comparison same method.
- [ ] Final 1500/2000/3000/4000 x standard/low x2 >=60s matrix.
- [x] Typecheck/unit/Chromium/WebKit/release/build, 43-condition/effect/physics/resource regression and flash safety when light rendering changed.
- [ ] Independent adversarial review using exact code/raw data/images/logs; fix material findings and retest.
- [x] iPhone-only reproduction procedure if hardware unavailable. Evidence compressed and hash-indexed, no duplicate old artifacts.
- [ ] Update Draft PR preserving old evidence, tie CI to final code SHA.

## Ledger
2026-10-26: clean initial source. Sparse baseline unit run 957 pass/1 fail because SQL migration absent from sparse checkout, not product change; add supabase path and rerun, retain first log.
Ruling: use existing full user specification without another design approval. Use writing-plans/executing-plans for staged work; test tooling first, no speculative product edits.
Historical hypothesis (REJECTED by subsequent code and source-count checks): appHarness.show might disable audio. reset() did not disable audio; the original real loop did generate native sources. Misleading old labels are retained only for provenance.

Stage 1 complete at34d22bb: allD01–D08 screening, corrected GPU coverage, frozen equal-upload control, independent method review, quota-affinity control saved. Silence hypothesis rejected; reset did not disable audio. Four-core affinity reduced throttling but not reliably frame p95; original5-core affinity retained for formal comparison.
Stage 2 candidate: indexed batches. Representation guard RED(index null)→GREEN;1064 expanded position/RGBA/stats cases byte-identical; typecheck and959unit pass. Initial test typecheck error (union attribute) fixed; both logs retained. Latency benefit pending; not yet accepted as performance improvement.
Stage 2: 58ab1b0 candidate now running 16 serialized60s cases: two main controls and three before/indexed pairs per quality. sourceStable and per-file actual hashes protect uncommitted/candidate provenance. No other browser/build/unit work in this interval. Candidate frozen GPU medians standard87.206→86.912ms, low90.541→90.682ms are not proof of GPU improvement. Test-only iPhone fixture/procedure and future pixel capture script prepared without executing them during the performance window.
Prepared fallback consideration (not implemented): D08 confirms software fill-resolution dependence; if indexing fails long-pair acceptance, consider a manual low-quality pixel budget on large viewports. Keep phone-sized low-quality drawing unchanged and avoid automatic timing adaptation. Validate actual frame intervals plus small-ball/paddle visibility, input coordinates and effect energy before adoption. Standard performance may remain unresolved and must be reported separately.

2026-10-26 Stage2: indexed candidate failed latency acceptance and was reverted (94a90b1). Large-surface LOW pixel budget (a180f27) passes3 preassigned pairs perquality with18total60s runs including3main controls perquality. LOW p95 median199.9→133.4ms; standard200→200ms. All absolute targets failed. Detailed measurements and failures remain inStage2.
2026-10-26 b697a98: test-only HTTP UUID/error handling and native visual helpers; production bytes unchanged froma180. Independent I01/I02 closed within stated finite scope afterRED/GREEN and nativev1FAILED→v2corrected. CI40260338558 all6jobs/1167tests succeeded on tree-identical merge6ee5216. Final16 matrix is now serialized; native audio probe refresh and archival follow it. No heavy browser/archive operations overlap accepted measurements.
