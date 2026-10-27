# Renderer performance investigation

The original full matrix showed a regression at score 4000: standard p95 changed from 266.6/249.9ms to 300.0/283.3ms, and low-quality midpoint p95 increased about 6.1%. The Linux target was already unmet before the change; that does not excuse an additional regression. This investigation preserves those original results and does not change the acceptance thresholds.

## CPU and buffer hypothesis

The test-only replay helper reproduces the app harness's thirty initial plans, fixed 120Hz simulation and autoplayer. It retained thirty balls, lost none, and advanced score 4000→4570 over thirty simulated seconds, storing 1,800 drawing states. The profile times only the new renderer's `update`, not simulation, controller copies, submission, compositing or GPU work.

Across three repeats, median full-update mean/p95 was 0.533/0.767ms in standard quality and 0.238/0.339ms in low. Test-only removal of all hit rings saved about 0.055ms mean in standard; coalescing equal-time/equal-position hit facts showed no material CPU improvement. Peak active hit count was thirty, with at most six identical-time/identical-position hits. This does not support removing or reducing action effects to address a 33ms frame-interval difference.

The maximum active update ranges were 535,584 bytes in standard and 264,768 in low, rather than the complete 1,720,320-byte reserved buffer capacity. The controlled GL probe independently observed unchanged upload sizes between two-pass and single-pass modes, with 653,004 total uploaded bytes in its standard peak case. The buffer range implementation therefore was not uploading all reserved buffers every frame.

Reproduction script, exact original script and metadata are retained in [diagnostics/README.md](diagnostics/README.md), `logs/render-cpu-profile.json`, `logs/render-cpu-profile.log`, and `logs/render-cpu-profile-metadata.json`. These CPU-only timings are not browser/GPU performance acceptance evidence.

## Measured redundant rendering passes

All four new materials were transparent and double-sided. Three.js 0.186.1 defaults `forceSinglePass` to false; its `WebGLRenderer.renderObject` submits the back and front faces separately in that configuration. These unlit flat ribbon/rectangle batches incurred eight actual draws, although the earlier renderer statistics counted only their four meshes. That earlier draw-call cap claim was incomplete.

The controlled browser probe uses the same frozen real replay state and real view. It compares normal → single-pass → single-pass → normal, plus hidden-root and zero-scissor controls. All four standard/low × peak/middle comparisons had exactly zero changed image channels. Upload bytes were identical.

| Condition | Actual scene draws, normal → single | Submitted vertex/index elements, normal → single | Median submission CPU, normal → single |
| --- | --- | --- | --- |
| Standard peak | 38 → 34 | 163,302 → 144,180 | 2.70 → 2.55ms |
| Standard middle | 40 → 36 | 149,994 → 136,650 | 4.30 → 3.10ms |
| Low peak | 38 → 34 | 143,238 → 133,788 | 3.40 → 2.80ms |
| Low middle | 40 → 36 | 136,314 → 129,762 | 3.35 → 2.45ms |

The count includes submitted index elements for other scene objects; it is not a measurement of unique vertex-shader invocations. The new batches themselves use nonindexed vertices. GPU timer queries did not return usable results in this synchronous diagnostic, and `finish` mostly returned zero wait. These data establish redundant draw submission and its observed CPU cost, not the cause of the entire 33ms frame-interval regression.

Raw controlled results: `diagnostics/gl-before-summary.json`, per-condition `gl-*.json`, original images and the full reporter. The source change approved after these measurements adds only `forceSinglePass: true` to the shared constructor of the four new materials. Geometry, density, effect types, conditions, coordinates, durations, priorities, physics and existing materials are unchanged.

## Verification and remaining gates

- The real production-default GL draw-budget regression guard failed before the fix: expected four new draws, observed eight. See `logs/gl-budget-red.log` and `diagnostics/gl-budget-red-results.json`.
- After the one-property change, the existing 93 renderer tests and typecheck pass: `logs/render-single-pass-green.log` and `logs/render-single-pass-typecheck.log`.
- The same real GL guard passes after the change: scene 36 draws minus 32 with the new roots hidden equals four. See `logs/gl-budget-green.log` and the `diagnostics/gl-budget-green*` reporters/data.
- Broad both-engine image equivalence across stages/losses/reduced motion, independent review, and the full sixteen-condition performance retest are separate subsequent evidence. Their outcomes must be read from their reports; they are not claimed by this focused test result.

The original performance matrix remains authoritative historical evidence. The user-required optimization/retest is incomplete until the full follow-up matrix is measured, and target-hardware performance remains unverified.
