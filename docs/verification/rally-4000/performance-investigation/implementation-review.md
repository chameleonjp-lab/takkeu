# Independent Stage 1 correction / indexed-candidate review

Reviewed commit `58ab1b0f786bda576c4ed4ca22e6df0e7d6c28f9` against PR27 starting head `059bcba8a5dc1aa2ab0a9c3b8d972be1c0b3c674`. This is an interim code/method/evidence review; final temporal images, Chromium/WebKit regressions, safety evidence, full performance matrix and final CI were not yet available. It is not final acceptance.

The reviewer used only small file reads and arithmetic over existing JSON/gzip records. No browser/test/build was run, no production/test file was edited, and no large artifact scan/extraction was performed during the live paired measurements. This report is the only file written.

## Verdict at this checkpoint

No important production correctness defect was found in the indexed representation. It is appropriate to continue its already-started controlled comparison. **A latency or GPU improvement is not established by the current frozen data**, and the candidate must still satisfy the user's retain/reject rule after the paired measurements.

Stage 1's corrected claims are materially more defensible than v2. The README appropriately rejects the false silent-audio hypothesis, describes D03 as composite, distinguishes CPU submission/GPU/frame intervals, retains the paused DPR2 failure, and does not call short diagnostics acceptance passes.

## Production representation and test adaptation

The complete production diff changes only `src/render/rallyEffects.ts` (24 changed lines); physics, input, score, ranking, audio, effect scheduling, and the equations generating positions/colors are untouched.

- Old rectangle triangle order `[left-bottom, right-bottom, left-top, right-bottom, right-top, left-top]` is exactly represented by four corners with indices `[0,1,2,1,3,2]`.
- Old ribbon endpoints likewise map to the same six submitted positions through the shared four corners.
- Rectangle bottom alpha is assigned to corners0/1; top alpha to2/3. The expanded indices reproduce the old per-triangle alpha sequence including the gradient backing.
- The largest batch has4096 quads, so the maximum corner index is16,383. `Uint16Array` is sufficient for every current batch (well below65,535).
- Draw ranges remain `count*6` **index elements**. Position/color upload ranges use `count*12`/`count*16` scalar components, matching four vertices. Capacity checks and zero-count visibility remain unchanged.
- Index topology is constructed once and is never marked dirty. Existing geometry disposal owns the index as well; update does not replace position/color/index buffers.
- Existing shape assertions now inspect the expanded submitted stream using `triangleAttribute`, rather than incorrectly treating drawRange as unique-vertex count. This preserves their semantic assertions. The new index guard covers topology prefix, storage counts, active upload ranges, stable buffer identity, immutable index version, clear behavior and idempotent disposal.

The saved unit logs report959/959 tests across72 files and the focused indexed guard1/1. This reviewer read those logs; they were not rerun during performance measurement.

The1064-case triangle/color/stats equivalence report explicitly scopes itself to new batches, not full-scene pixels or performance. Its corpus spans standard/low, reduced motion on/off, arrival/loss conditions and seven ages. Code inspection shows it hashes expanded indices rather than raw storage; the before/after digest is reported identical. The reviewer inspected the corpus and report, but did not re-execute the1064-case corpus or independently regenerate the post-change body. Avoid upgrading that scoped evidence into a full rendered-image or flash-safety claim.

## Corrections verified against raw data

### GPU coverage

The corrected live runner allows up to512 pending queries and drains after the measured interval. The drain does **not pause the application** in the current implementation: it stops issuing measured queries and polls while ordinary application rendering/guards continue. This differs from the earlier proposed pause-based drain but does not add drain intervals to the sample. The README does not claim that the app is paused.

For three inspected v3 records:

| Row | Rendered measured frames | Unique queried frame IDs | Valid results | Pending |
| --- | ---: | ---: | ---: | ---: |
| D01 main |140|140, IDs0–139|140|0|
| D01 PR27 |125|125, IDs0–124|125|0|
| D05 static background |121|121, IDs0–120|121|0|

All inspected query results are non-disjoint. Stage1-summary also separately identifies non-profiled rows with null GPU/cost percentiles. Recomputing query counts from raw arrays is a valid correction of the preserved v3 summary-key typo.

### D03 frozen comparison

The standalone frozen probe holds the exact30-ball snapshot/effect state and explicitly marks the same active position/color ranges dirty when generation is skipped. On the inspected before-standard rows, normal and freeze each submit34 draws,46,972 triangles and653,004 bytes; normal/low and freeze/low each submit34 draws,43,748 triangles and382,188 bytes. Both quality files report changed RGBA channels0 between generated/frozen renders,48/48 available non-disjoint timer queries, and no page errors/blocked traffic.

This closes the earlier upload/geometry confound for that fixed-scene CPU comparison. It does not turn the live D03 freeze into a CPU-only control and does not establish a real-loop improvement. The recorded normal/freeze pixel difference is internal to each representation; it is **not** an old-nonindexed versus new-indexed framebuffer comparison.

### Background and best state

The current D05 wrapper times both generation and command replay; cached particle-count deltas are reapplied. The inspected corrected D05 first sample reports248 particles, rather than the erroneous8 in v2. This repairs the identified counter defect without changing production code.

The current runner resets test-only bestScore to the chosen starting score and resets the loop clock together with the post-warmup scenario. Inspected A/B start at simTime0 and bestScore4000. The PR controller may initially expose the preceding run's bestAtStart (0 in the inspected D01 row); the final controller has bestAtStart4000, and the production runId guard excludes old-run rendering. The README explicitly documents this transition. This establishes a new, declared test initialization; historical measurements must not be directly pooled with it.

### Provenance and CPU brackets

Current runner records actual source-file hashes before and after a case plus `sourceStable`; it no longer relies solely on HEAD tree identity for an uncommitted candidate. Comparing the already-stored v3 A/B after-hashes to the initial environment manifests finds no differing source file (56 A files,60 B files). The older v3 summary itself has no `sourceStable` field; its after-hash evidence is supplemented by that initial-manifest equality, not a claim that v3 already emitted the newer flag.

Measurement-bracket cgroup snapshots are separate from whole-case counters. This supports observing in-window throttling; the README appropriately avoids treating it as complete causality. A four-core-affinity comparison is a different scheduling condition, not a production optimization.

## Independently recomputed frozen candidate numbers

These are separate fixed-scene runs, not interleaved before/after repetitions. Conventional medians below use all mode rows; ranges substantially overlap.

| Quality, normal mode | Before | Indexed candidate | Interpretation |
| --- | ---: | ---: | --- |
| Standard upload bytes/frame |653,004|474,532|178,472 fewer bytes;27.33% whole-scene reduction|
| Low upload bytes/frame |382,188|293,988|88,200 fewer bytes;23.08% whole-scene reduction|
| Standard draws / triangles |34 /46,972|34 /46,972|Unchanged submitted topology|
| Low draws / triangles |34 /43,748|34 /43,748|Unchanged submitted topology|
| Standard effect generation median |0.80ms|0.70ms|Small observation; not a repeatability claim|
| Low effect generation median |0.40ms|0.50ms|Opposite direction|
| Standard total view submission median |2.25ms|2.45ms|No demonstrated submission improvement|
| Low total view submission median |1.80ms|1.90ms|No demonstrated submission improvement|
| Standard GPU median |87.2061ms|86.9117ms|Approximately0.34% difference; not established improvement|
| Low GPU median |90.5410ms|90.6822ms|Approximately0.16% worse; not established improvement|

Standard GPU ranges:66.845–116.016ms before and72.003–110.226ms indexed. Low:71.451–112.805ms before and81.517–105.724ms indexed. No before/after GPU speedup conclusion is justified from these samples. The measurable reduction is storage/transfer, not yet player-facing performance.

## Remaining reporting / validation points

1. The running formal comparison must gate its interpretation on sourceStable, initial30/running, continuous30/running, error/blocked arrays, duration and unchanged measurement method. The current runner saves these fields but does not throw on every invalid condition; a downstream verdict must inspect them rather than equate process completion with acceptance.
2. Capture actual test/fixture/config manifests for the final code and comparison harness, in addition to source manifests. Current runner hashes itself only after each case; ensure it remains unchanged for the entire live process, or capture its starting content/hash and compare at the end. This is a provenance requirement, not a reason to interrupt the current unchanged run.
3. Preserve the distinction between unique corners and submitted elements/triangles. `rallyHarness.geometry()` retains the historical field name `vertices` for expanded submitted elements; do not interpret that number as the indexed candidate's unique vertex count.
4. `triangleAttribute` assumes drawRange.start0 and Float32 attributes; these assumptions hold for all current rally batches. If reused beyond them, support a nonzero start or state/assert its narrow contract. No present product failure was identified from this specialization.
5. Full before/after temporal image comparisons and appropriate flash revalidation remain pending. Matching triangle streams plus identical material settings provides a strong basis, but is not a replacement for the required rendered evidence or human/device checks.
6. The final threshold/relative-performance decisions remain open. If the paired runs cannot distinguish benefit from variability, keep the conclusion pending or reject the production candidate according to the user request; do not retain it solely because upload bytes decreased.

No new important correctness fix is requested before the current measurements finish. Performance acceptance, final43-condition verification, iPhone/human checks, and final CI remain outside this interim review.
