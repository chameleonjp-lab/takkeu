# Flat-batch single-pass pixel equivalence

The production optimization changes only `forceSinglePass:true` on the four new transparent, double-sided rally batch materials. The geometry, colors, opacity, position, time, particle budgets and shader formulas are unchanged. Three's default transparent double-sided path submits a back-face pass followed by a front-face pass; the option submits the double-sided geometry once.

Reproduce the comparison with:

```sh
RALLY_SINGLE_PASS_AB=1 PLAYWRIGHT_BROWSERS_PATH=/workspace/pw-browsers PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 npx playwright test --config=playwright.rally-pixels.config.ts
```

The existing six browser cases remain six cases per engine. The opt-in screenshot helper explicitly sets the actual rendered materials to `false`, redraws the frozen state, captures the full viewport, then sets them to `true` and repeats. The hook is confined to the test-only fixture and executes before Three selects the rendering path. It does not add a production debug option. Both standard and low quality are checked at every captured state.

Each case JSON records the simulation time, score, run ID, actual material names, resource/draw-call values, decoded RGB(A) hashes, changed-pixel count and largest channel difference. Every channel must be exactly equal; there is no tolerance or image-distance threshold. Snapshot and effect-state equality is also asserted. The optimized PNG is retained for every comparison. If a comparison fails, its control PNG is retained as well. The original full-camera evidence is also saved through the normal capture path after restoring the production material default.

The coverage includes all 23 thresholds before/arrival/during/after; moving electricity, stars and rings; all four 4000 phases; reduced motion; each loss threshold and the finishing clock; portrait/landscape/enlarged text; best-score updates and 2600 notifications. The gold-aura case continues its existing independent paired-color regression. `run.json` retains exact source copies and SHA256 values; `summary.json` is generated only after the full run ends.

Final result: **832/832 exact comparisons**, comprising208 camera states×2 qualities×2 engines. Every changed-pixel count and maximum channel delta is0. The six Chromium cases passed in the initial run. The initial WebKit threshold case exceeded its ordinary240s capture budget; its later motion case was deliberately interrupted, and four cases did not run. Complete logs, traces and partial comparisons remain. All six WebKit cases then passed with the approved A/B-only4×capture budget. Ordinary CI budgets and all pixel/state/performance thresholds are unchanged. This is successful12-case coverage across those runs, not one clean12-case run. Full formal accounting is in `summary.json` and `budget-attempts.json`.

Three0.186.1 can retain the FrontSide shader after the test-only false→true toggle because its two-pass path restores `material.side` without a version invalidation. The four current unlit MeshBasic materials have no map/normal/env/skinning branches that use the side macros. A separate direct bridge nonetheless checks actual fresh production-default materials: set override=null before `restore()`, capture their first default path, then compare explicitfalse and false→true. All16 cases (2000transition,4000peak/middle and loss100finishing×2qualities×2engines) have exactly equal pixels and unchanged state. All48 PNGs, versioned renderer/basic-shader excerpts, source hashes and results are retained under `fresh-default/`.

Reproduce that supplemental check without editing canonical runtime/tests:

```sh
PLAYWRIGHT_BROWSERS_PATH=/workspace/pw-browsers PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 node docs/verification/rally-4000/diagnostics/single-pass/fresh-default-check.mjs
```

This is a finite set of exact pixel comparisons plus a one-property rendering-path change. It is not a new capture of all 5,040 dense safety frames, a human visual acceptance, a hardware-performance result, or a replacement for the original safety analyzer. The original dense videos, exact source copies, failed attempts and all primary safety flags remain available.
