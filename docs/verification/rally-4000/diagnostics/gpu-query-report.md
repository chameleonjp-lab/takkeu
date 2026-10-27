# Deferred GPU timer-query diagnosis

All **96/96** timer queries became available after deferring deletion and yielding to RAF. No condition reported a disjoint clock. No readPixels-fence fallback was needed. The docs-only wrapper reused the unchanged canonical C fixture; production source and test/runtime files were not edited. Browser and owned Vite processes are closed.

Values below use the conventional median (the arithmetic mean of the two middle observations for even counts). The original console helper printed an upper-middle value; `gpu-query-summary.json` normalizes all medians from the complete raw samples.

| Quality/state | Normal two-pass GPU ms | Single-pass GPU ms | New roots hidden GPU ms | New roots zero-scissor GPU ms |
|---|---:|---:|---:|---:|
| standard peak | 114.01 | 113.45 | 100.56 | 104.63 |
| standard middle | 116.67 | 115.63 | 112.83 | 131.10 |
| low peak (unstable) | 140.08 | 192.49 | 180.65 | 211.62 |
| low middle | 111.10 | 113.43 | 105.45 | 109.16 |

In the stable standard peak state, hiding the new roots reduced the GPU timeline from 114.01 to 100.56ms while CPU geometry updates continued. The zero-scissor control preserved new upload bytes and draw submissions and measured 104.63ms. This supports measurable new-layer rendering cost in that frozen state, against an approximately 100ms retained-scene graphics floor. The hidden scene is canonical C with new roots hidden, not the exact historical PR26 source.

These controls do not isolate a pure fragment or vertex cost: hiding roots also skips their GPU uploads/submissions, and an empty scissor may permit broader driver optimizations. Standard middle showed overlapping full/hidden ranges and an unstable scissor sample. Low peak changed substantially even between the two identical normal blocks; individual queries ranged roughly 109–319ms for normal and 101–359ms with the new roots hidden. Consequently the mode medians there cannot support a simple causal attribution.

Single-pass did not show a consistent GPU-time improvement across states. It does remove four actual GL submissions, reduces submitted vertices, preserves upload bytes, and produced identical pixels; those narrow findings stand. They do not establish that the real-loop 4000 latency regression is fixed. GPU spans of roughly 100–117ms in the stable controls are much larger than the roughly 2–6ms JavaScript/render-submission medians, establishing graphics work as a substantial component. The remaining difference from approximately 300ms real-loop p95 was not attributed by this probe.

The container reports a four-CPU quota (`cpu.max = 400000 100000`) and effective CPUs `0-4`; cumulative throttling counters were present. No probe-time throttle delta or causal quota experiment was measured. Quota, host conditions, tracing, audio and UI therefore remain unproven explanations and are not used to dismiss the observed regression.

The current review verdict remains **P1 performance FAILED**: all final executions completed, but 0/16 reference targets passed and no no-degradation claim is justified. Physical-device/Safari performance remains unverified. No further density/source/trace changes were made. Full query arrays, availability/disjoint flags, CPU counters, captures and frozen snapshots remain in `gpu-query-results.json`; normalized statistics are in `gpu-query-summary.json`.
