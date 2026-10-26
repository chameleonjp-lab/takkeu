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
- [ ] Record environment, source/test hashes, browser/GL, quota deltas and drawing size.
- [ ] Run short D01–D08 controls and collector full/light/off comparisons. Capture frame/CPU/GPU/GL/audio/heap/time advancement, unavailable values null.
- [ ] Separate original fixture audio behavior from audible workload; identical new method on both codes.
- [ ] Save cause/confidence/candidate table and commit investigation.

## Stage 2
- [ ] Select one measured cause, add behavioral/geometry regression test, observe failure, implement narrow change.
- [ ] Measure individual effect and reject ineffective/regressing changes.
- [ ] Preserve exact pixels where possible; otherwise predefine tolerance, retain before/after temporal images.
- [ ] Commit each justified fix with measurement evidence.

## Stage 3
- [ ] 4000/30-ball standard and low >=3 paired interleaved >=60s comparisons, retain dispersion and all attempts; main comparison same method.
- [ ] Final 1500/2000/3000/4000 x standard/low x2 >=60s matrix.
- [ ] Typecheck/unit/Chromium/WebKit/release/build, 43-condition/effect/physics/resource regression and flash safety when light rendering changed.
- [ ] Independent adversarial review using exact code/raw data/images/logs; fix material findings and retest.
- [ ] iPhone-only reproduction procedure if hardware unavailable. Evidence compressed and hash-indexed, no duplicate old artifacts.
- [ ] Update Draft PR preserving old evidence, tie CI to final code SHA.

## Ledger
2026-10-26: clean initial source. Sparse baseline unit run 957 pass/1 fail because SQL migration absent from sparse checkout, not product change; add supabase path and rerun, retain first log.
Ruling: use existing full user specification without another design approval. Use writing-plans/executing-plans for staged work; test tooling first, no speculative product edits.
Finding pending measurement: appHarness.show resets audio.enabled=false; original real-loop audio may be silent. Investigate counts before correcting benchmark method.

Stage 1 complete at34d22bb: allD01–D08 screening, corrected GPU coverage, frozen equal-upload control, independent method review, quota-affinity control saved. Silence hypothesis rejected; reset did not disable audio. Four-core affinity reduced throttling but not reliably frame p95; original5-core affinity retained for formal comparison.
Stage 2 candidate: indexed batches. Representation guard RED(index null)→GREEN;1064 expanded position/RGBA/stats cases byte-identical; typecheck and959unit pass. Initial test typecheck error (union attribute) fixed; both logs retained. Latency benefit pending; not yet accepted as performance improvement.
