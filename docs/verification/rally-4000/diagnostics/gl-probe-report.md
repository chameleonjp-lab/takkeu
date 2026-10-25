# Isolated draw-submission diagnosis

The test-only probe uses the real `createView`, exact deterministic 30-ball replay, and two frozen states: maximum active hit rings (30 at simTime 0.85) and a stable middle frame (none at simTime 15.0167). Geometry updates continue in every mode. The scene/roots are captured only inside a dedicated fixture; no diagnostic controls enter production.

Four standard/low × peak/middle cases passed. Changing only the four rally materials' `forceSinglePass` flag produced **zero changed RGBA channels** in every comparison at 1280×720. Full PNGs, measurements, and the complete reporter are retained beside this report.

| Quality/frame | Actual GL draws, two-pass → single | Submitted vertices, two-pass → single | Uploaded bytes/frame, unchanged | Render-submission median ms, two-pass → single |
|---|---:|---:|---:|---:|
| Standard peak | 38 → 34 | 163302 → 144180 | 653004 | 2.70 → 2.55 |
| Standard middle | 40 → 36 | 149994 → 136650 | 499284 | 4.30 → 3.10 |
| Low peak | 38 → 34 | 143238 → 133788 | 382188 | 3.40 → 2.80 |
| Low middle | 40 → 36 | 136314 → 129762 | 309108 | 3.35 → 2.45 |

Transparent `DoubleSide` materials use two submissions by default. The actual GL counters confirm four redundant submissions across four new batches; upload bytes remain identical. The separate CPU replay benchmark found sub-millisecond geometry update cost. These observations justify the narrow single-pass optimization; they do not attribute the complete real-loop 4000 frame-time difference to it.

**Timing limit:** The extension was present, but every timer-query result remained unavailable inside the synchronous loop. `gl.finish()` returned without an observed wait. Consequently `gpuMs` is `null` throughout; the table measures JavaScript/render submission time, including native calls, and is not a GPU elapsed-time measurement. Hidden-root and zero-scissor controls are retained but cannot establish an overdraw cost from these timings. The real-loop 60-second performance matrix remains the acceptance measurement.

The production-default regression guard does not override material flags: it subtracts hidden-new-root GL submissions from the full scene on the same 30-ball middle frame. It failed RED with **8 instead of 4** before the fix. Its subsequent GREEN result is logged separately. All expected failures remain in the raw reporters and logs.
