# Before/after performance results

All 16 after-change measurements executed successfully. **The Linux performance target was unmet in all 16 conditions before and after.** Actual iPhone/Safari performance remains unverified.

The matrix uses Chromium/SwiftShader in the same container, 1280×720 at device ratio 1, four starting scores, standard/low quality, 30 non-lost balls throughout, 60 real seconds, and two repeats. All canonical before/after runs stayed in `running`; there were no after-change pauses, page errors, blocked external requests, or reporter errors. The original first baseline attempt paused for `slow-frame` while a unit retry overlapped it; its complete raw data remains archived and a clean control replaces that row only in the comparison.

The frozen after source was `0285168e455b5ec71f4197b1acbf68f29b5d46a5`, source tree `8c18959dd3e5741e99a2117a639117474500147b`. Full source and fixture/config/spec hashes matched before and after the matrix; no Vite HMR or reload occurred. The performance spec remains byte-identical to the baseline.

| Metric across canonical conditions | Before | After |
|---|---:|---:|
| Running p95 frame interval, ms | 233.3–633.3 | 249.9–300.0 |
| Running intervals <=25ms | 5.88–15.70% | 12.19–16.13% |
| Simulated seconds per >=60s wall | 21.25–44.99 | 34.45–42.57 |
| Required Linux targets met | 0/16 | 0/16 |
| Maximum draw calls | 36 | 44 |
| Maximum geometries | 53 | 57 |
| Maximum textures | 4 | 4 |
| Maximum programs | 16 | 16 |
| Maximum active particles | 1440 | 1688 |
| Raw reported capacity (mixed units) | 1536 | 11776 |
| Browser-reported JS heap, MB | 21.7–31.2 | 23.1–35.1 |

The Linux target requires p95 <=25ms, >=95% of running intervals <=25ms, >=59 simulated seconds, continuous running, and 30 balls throughout. Keeping the phase running does not establish real-time play: these runs advanced only the simulated seconds shown above. No slow-frame or fixed-step budget was relaxed and no test automatically resumed play.

| Quality | Initial score | Before p95, ms (two repeats) | After p95, ms (two repeats) | Before <=25ms | After <=25ms | After simulated seconds |
|---|---:|---:|---:|---:|---:|---:|
| standard | 1500 | 233.3–450.0 | 249.9–249.9 | 11.98–13.53% | 12.95–15.07% | 42.56–42.57 |
| standard | 2000 | 266.7–633.3 | 250.0–266.6 | 5.88–11.46% | 12.37–15.45% | 39.95–40.11 |
| standard | 3000 | 366.6–599.9 | 266.7–283.2 | 10.00–10.96% | 13.82–16.13% | 38.30–38.67 |
| standard | 4000 | 249.9–266.6 | 283.3–300.0 | 11.51–11.59% | 12.19–14.38% | 34.45–37.12 |
| low | 1500 | 316.6–333.3 | 250.0–266.7 | 10.95–11.08% | 13.62–15.25% | 39.47–40.17 |
| low | 2000 | 266.6–266.7 | 266.7–283.3 | 12.34–15.70% | 13.90–14.41% | 36.97–37.51 |
| low | 3000 | 250.1–300.0 | 283.3–283.3 | 10.31–13.45% | 12.76–15.85% | 35.95–36.97 |
| low | 4000 | 266.7–283.3 | 283.4–300.0 | 11.79–14.32% | 12.98–15.18% | 35.07–35.81 |

After standard quality peaked at 1,688 active particles and low quality at 844; baseline peaks were 1,440 and 720. The raw capacity field mixes 1,536 legacy point-particle slots with 10,240 rally quad slots; 11,776 is not a physical particle count. Active counts, quad capacity and byte ranges are separate observations. Native audio graph peaks were 283→284 nodes, 101→101 sources, and 16→16 shapers; these are probe allocation counts, not logical voice counts. Full per-frame resource, phase, audio, and memory samples remain in the measurement JSON.

The browser returned coarse heap samples that stayed constant within each case. They include instrumentation/normal GC behavior and cannot establish a memory-leak verdict. GPU VRAM bytes and physical-device memory were not measured; Three.js geometry/texture/program counts provide resource observations instead.

Baseline implementation work shared CPU scheduling, while the after matrix ran during an agreed quiet window. The clean control removes the known unit-overlap attempt from the canonical comparison, but remaining host-load variation prevents attributing latency differences to the new effects alone. The resource-count increase is directly observed. Standard/low share desktop drawing size at device ratio 1; their densities differ. This sustained-stage fixture does not synthesize threshold-arrival bursts or dedicated boundary audio; those have separate browser/audio evidence.

Reproduction commands and limits: [performance-method.md](performance-method.md). Complete condition rows and deltas: [performance-comparison.json](performance-comparison.json). Full reporters and per-frame measurement JSON are compressed under `baseline/chromium/`, `baseline/chromium-clean-repeat1/`, and `after/chromium/`; all original/control failures and setup attempts remain in `logs/`.
