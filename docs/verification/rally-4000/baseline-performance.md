# Baseline performance results

Baseline production commit: `aff31169fd6feaad7bad35f22fe3de26429296cf`. Chromium/SwiftShader, 1280×720, device ratio 1; real app loop, 30 active balls throughout every recorded condition. Sixteen original measurements and one clean control completed successfully. All Linux targets were unmet. Actual device/Safari performance is unverified.

The first original standard 1500 repeat 1 overlapped the baseline full-unit retry and paused for `slow-frame`. Its complete raw report is retained. The following canonical comparison table uses its clean control rerun instead. Other 15 rows remain from the original matrix. No frame guard or pause rule changed and no test automatically resumed gameplay.

| Quality | Initial score | Repeat | Running p95 ms | Running <=25ms | Simulated seconds / 60s wall | Final phase | Max calls | Max particles | Linux target |
|---|---:|---:|---:|---:|---:|---|---:|---:|---|
| standard | 1500 | 1 | 233.3 | 11.98% | 44.99 | running | 36 | 1440 | NOT met |
| standard | 1500 | 2 | 450.0 | 13.53% | 31.80 | running | 32 | 1440 | NOT met |
| standard | 2000 | 1 | 266.7 | 11.46% | 40.11 | running | 36 | 1440 | NOT met |
| standard | 2000 | 2 | 633.3 | 5.88% | 21.25 | running | 36 | 1440 | NOT met |
| standard | 3000 | 1 | 599.9 | 10.96% | 25.70 | running | 36 | 1440 | NOT met |
| standard | 3000 | 2 | 366.6 | 10.00% | 30.78 | running | 36 | 1440 | NOT met |
| standard | 4000 | 1 | 266.6 | 11.59% | 40.65 | running | 36 | 1440 | NOT met |
| standard | 4000 | 2 | 249.9 | 11.51% | 40.59 | running | 36 | 1440 | NOT met |
| low | 1500 | 1 | 316.6 | 11.08% | 34.97 | running | 32 | 720 | NOT met |
| low | 1500 | 2 | 333.3 | 10.95% | 34.99 | running | 32 | 720 | NOT met |
| low | 2000 | 1 | 266.6 | 15.70% | 39.92 | running | 36 | 720 | NOT met |
| low | 2000 | 2 | 266.7 | 12.34% | 40.10 | running | 36 | 720 | NOT met |
| low | 3000 | 1 | 250.1 | 10.31% | 40.17 | running | 36 | 720 | NOT met |
| low | 3000 | 2 | 300.0 | 13.45% | 34.70 | running | 36 | 720 | NOT met |
| low | 4000 | 1 | 266.7 | 11.79% | 39.97 | running | 36 | 720 | NOT met |
| low | 4000 | 2 | 283.3 | 14.32% | 38.84 | running | 36 | 720 | NOT met |

All canonical rows held 30 active balls. Max GPU resources were 53 geometries, 4 textures, 16 programs, with legacy particle capacity 1536. These are the existing renderer's resources before new effects.

Full frame samples and reporters are retained under `baseline/chromium/` and `baseline/chromium-clean-repeat1/`; each contains `summary.json`, full reporter JSON compressed, and individual measurement JSON compressed. All test/setup failures remain in `logs/`. Before/after comparison is pending the post-change matrix.
