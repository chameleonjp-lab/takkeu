# Three-way performance results

**P1 performance FAILED. All 16 final measurements executed successfully, but all 16 Linux reference targets remain unmet. The single-pass change reduced actual draw submissions; real-loop latency improvement was not demonstrated.** No no-degradation or target-device acceptance claim is made.

The table compares merged PR26 baseline, initial rally implementation, and the single-pass candidate. Each matrix has four starting scores × standard/low × two repeats, 30 non-lost balls, and at least 60 real seconds. Scoring/physics continues naturally; the raw samples retain changing scores, phase and simulation time. Chromium/SwiftShader uses 1280×720 at device ratio 1. The formal test script/config/fixtures are byte-identical across matrices.

| Metric across 16 canonical conditions | Baseline | Initial implementation | Single-pass candidate |
|---|---:|---:|---:|
| Running p95, ms | 233.3–633.3 | 249.9–300.0 | 266.7–433.3 |
| Running intervals <=25ms, % | 5.88–15.70 | 12.19–16.13 | 11.08–17.23 |
| Simulated seconds per >=60s wall | 21.25–44.99 | 34.45–42.57 | 30.32–39.22 |
| Execution success | 16/16 | 16/16 | 16/16 |
| Linux targets met | 0/16 | 0/16 | 0/16 |
| Continuous running / 30 balls | 16/16 | 16/16 | 16/16 |
| Unexpected pauses | 0 | 0 | 0 |
| Maximum draw calls | 36 | 44 | 40 |
| Maximum geometries | 53 | 57 | 57 |
| Maximum textures | 4 | 4 | 4 |
| Maximum programs | 16 | 16 | 17 |
| Reported active particle count | 1440 | 1688 | 1688 |
| Legacy point-particle capacity | 1536 | 1536 | 1536 |
| New rally quad-slot capacity | 0 | 10240 | 10240 |
| New position/RGBA fixed buffers, bytes | 0 | 1720320 | 1720320 |
| Browser-reported JS heap, MB | 21.7–31.2 | 23.1–35.1 | 23.1–33.1 |

The raw `particleCapacity=11776` field adds 1536 legacy point-particle slots to 10240 rally **quad** slots. These units differ; it is not a physical particle count. Rally quads have six vertices with position+RGBA data, 168 bytes per slot. Actual per-frame quad counts, reported particle counts and observed/derived upload bytes are separate observations. The final matrix peaked at 3188 rally quads (535584 bytes of active attribute ranges), 248 reported rally particles, and 1440 legacy point particles. See `after-single-pass/resource-detail.json`.

| 4000 quality | Baseline median p95 | Initial median p95 | Single-pass median p95 | Candidate vs baseline | Candidate vs initial |
|---|---:|---:|---:|---:|---:|
| standard | 258.25ms | 291.65ms | 300.00ms | +16.17% | +2.86% |
| low | 275.00ms | 291.70ms | 316.70ms | +15.16% | +8.57% |

The 4000 frame-interval result worsened in this matrix despite four fewer draw submissions. This is an unresolved performance result, not evidence of a latency optimization. The isolated probe established redundant submissions and a smaller CPU submission cost, with exact pixels unchanged; it did not retrieve GPU elapsed time. The deferred-query probe retrieved all 96 non-disjoint GPU results: stable standard peak measured 114.01ms full versus 100.56ms with new roots hidden, while single-pass did not show a consistent GPU gain. Graphics work is substantial, but the complete real-loop regression remains unattributed; host variation is not assumed to explain it. See [GPU query diagnosis](diagnostics/gpu-query-report.md).

| Quality | Starting score | Baseline p95 range | Initial p95 range | Single-pass p95 range | Candidate <=25ms | Candidate simulation seconds |
|---|---:|---:|---:|---:|---:|---:|
| standard | 1500 | 233.3–450.0 | 249.9–249.9 | 283.4–333.4 | 11.08–14.02% | 33.79–36.90 |
| standard | 2000 | 266.7–633.3 | 250.0–266.6 | 266.7–433.3 | 11.19–15.30% | 30.32–38.42 |
| standard | 3000 | 366.6–599.9 | 266.7–283.2 | 300.0–400.0 | 12.50–14.39% | 31.10–36.01 |
| standard | 4000 | 249.9–266.6 | 283.3–300.0 | 283.3–316.7 | 11.72–12.74% | 33.31–35.83 |
| low | 1500 | 316.6–333.3 | 250.0–266.7 | 266.7–350.0 | 14.49–15.14% | 34.78–39.22 |
| low | 2000 | 266.6–266.7 | 266.7–283.3 | 283.4–350.0 | 12.37–17.23% | 32.01–36.92 |
| low | 3000 | 250.1–300.0 | 283.3–283.3 | 283.3–350.0 | 13.51–13.74% | 32.68–37.89 |
| low | 4000 | 266.7–283.3 | 283.4–300.0 | 316.7–316.7 | 12.34–14.90% | 32.94–33.86 |

The target requires p95 <=25ms, >=95% of running intervals <=25ms, >=59 simulated seconds, continuous running and 30 balls. All candidate runs stayed running with 30 balls and no unexpected pauses, page errors, blocked external requests or reporter errors; their simulation advanced only the seconds shown above. No slow-frame rule, fixed-step budget or target threshold was changed and no test automatically resumed play.

Final canonical runtime: `d30aa196f2faccd88fab36de4b94bb585c21b464`, source tree `47bd0f370ad169de00c77b37bb74429b63020d44`, tests tree `097b10b95f55aded9d77af6dd4ed6b85925b9684`. HEAD, source/test trees, complete source/runtime manifests, selected fixture/config hashes and formal script matched before/after. No Vite HMR or reload occurred. The initial implementation used `0285168e455b5ec71f4197b1acbf68f29b5d46a5`; its entire matrix is preserved.

All heap samples were coarse and constant within a case; they include instrumentation and GC behavior and do not prove absence of a leak. GPU VRAM bytes and physical-device memory were not measured. Baseline implementation work shared host CPU scheduling; initial and candidate matrices had agreed local quiet windows. The known first baseline unit-overlap attempt remains raw, while its clean control replaces that row in canonical comparison. Actual iPhone/Safari performance remains unverified.

Evidence: [baseline-to-candidate comparison](performance-comparison-single-pass.json), [initial-to-candidate comparison](performance-optimization-comparison.json), [original baseline-to-initial comparison](performance-comparison.json), [isolated draw probe](diagnostics/gl-probe-report.md), [reproduction method](performance-method.md). Full raw reporters/measurements are preserved under `baseline/chromium/`, `baseline/chromium-clean-repeat1/`, `after/chromium/`, and `after-single-pass/chromium/`.

All 49 formal measurement bodies and four full reporters passed byte/hash verification; see `logs/performance-artifact-verification.json`. All 16 final end states, resources, target-failure reasons, and C/harness hashes are gathered in `after-single-pass/condition-verdicts.json`. The historical first GPU probe lacked available query results; the later [deferred GPU query report](diagnostics/gpu-query-report.md) recovered all 96 results without disjoint clocks. These are distinct experiments and both raw datasets remain intact.
