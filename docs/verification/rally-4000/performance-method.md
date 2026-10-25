# Repeatable before/after performance method

The unchanged `tests/performance/rally-4000.spec.ts` uses the existing test-owned `stage3.html`/`appHarness.ts` real app loop and `browserTest.ts` fixtures. It blocks every request outside the localhost test server. The regular app slow-frame guard, simulation fixed-step limit, pause behavior, and renderer stay active. There is no virtual clock, automatic resume, or modified performance target. The required before/after matrix is measured in Chromium in the same environment; WebKit browser compatibility is separate and its performance matrix is optional/unmeasured unless explicitly recorded.

This is a sustained-stage fixture: the renderer derives permanent effects from snapshot score, while threshold-arrival bursts and dedicated boundary audio require confirmed hit events and belong to separate evidence. The test fixture does not invent a threshold arrival when setting its initial score.

The four score labels are starting scores. Real physics/autoplay continues scoring during the 60-second wall-time measurement and may cross later thresholds naturally; per-frame/final scores and simulation times remain in the raw data. This real-loop test is distinct from the frozen-state GL diagnostic used to isolate rendering costs at identical geometry.

Each browser has 16 serial cases: initial scores 1500/2000/3000/4000 × standard/low × two repeats. Each begins with 30 balls and collects at least 60,000 ms of actual RAF time. The whole-run and running-only frame metrics, simulation duration, per-frame phase/pause cause, draw calls, particle/resources, audio graph counts, and available Chromium heap samples are retained. Unavailable heap data remains `null`. The declared Linux target requires continuous running, >=59 simulated seconds, p95 <=25 ms, and >=95% of running intervals <=25 ms. The collector additionally requires 30 active balls in every sample for `required30BallLinuxTarget`. A Playwright `passed` result means measurement execution succeeded; it does not mean either target passed. Actual target hardware remains unverified.

Heap samples include the retained measurement arrays and normal garbage-collection timing; no forced GC is used. Initial/final/peak heap values are observations, not a standalone memory-leak verdict. GPU resource counts and fixed-pool/disposal tests provide separate evidence about renderer bounds.

The baseline lives at `/workspace/takkeu-baseline`, detached at `aff31169fd6feaad7bad35f22fe3de26429296cf`, with only the identical performance spec and a `node_modules` symlink added as untracked files. Production files there remain unchanged. The main worktree is `/workspace/takkeu-work`. Keep performance suites serial and avoid concurrent browser/rendering work during measurement. Implementation agents and the shared host may still affect scheduling; that limit applies to both sides.

The existing Chromium performance configuration uses a 1280×720 Desktop Chrome viewport at device ratio 1 and headless SwiftShader (`--enable-unsafe-swiftshader --use-angle=swiftshader`). Standard and low therefore share the desktop drawing size; quality-dependent densities still differ. This reference does not measure a physical iPhone GPU or Safari.

Run these commands from the selected worktree with an exec sandbox that permits localhost networking (`sandbox_permissions=with_additional_permissions`, `additional_permissions.network.enabled=true`). The default restricted sandbox prevents Vite binding and can also cause the release-unit fixture subprocess to fail with EPERM.

```bash
PLAYWRIGHT_BROWSERS_PATH=/workspace/pw-browsers npx playwright test --config=playwright.performance.config.ts tests/performance/rally-4000.spec.ts --project=chromium > /workspace/takkeu-work/docs/verification/rally-4000/logs/after-performance-chromium.log 2>&1
node tests/helpers/collectRallyPerformance.mjs artifacts/performance-results.json docs/verification/rally-4000/after/chromium
```

Collect the first browser before starting the next: the default reporter/output paths are reused. The collector retains the full reporter JSON compressed, every measurement JSON compressed, every failure, and a summary with separate execution/target fields. For baseline collection, invoke the collector from the main worktree with absolute reporter and destination paths.

WebKit binaries are installed under `/workspace/pw-browsers`. Required Debian libraries were downloaded and extracted only into `/workspace/pw-deps`, then linked into the downloaded browser bundles' `sys/lib` directories. The system package database and installed libraries were not changed. The Playwright host validator still cannot locate local `libGLESv2` with its `ldconfig` check, so set `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1` for WebKit. An actual browser launch, page render, and `webgl2` context smoke test passed with this local setup; the flag does not change gameplay or frame guards. Save the WebKit reporter before the next run too:

```bash
PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 PLAYWRIGHT_BROWSERS_PATH=/workspace/pw-browsers npx playwright test --config=playwright.performance.config.ts tests/performance/rally-4000.spec.ts --project=webkit > /workspace/takkeu-work/docs/verification/rally-4000/logs/after-performance-webkit.log 2>&1
node tests/helpers/collectRallyPerformance.mjs artifacts/performance-results.json docs/verification/rally-4000/after/webkit
```

No target-device acceptance is inferred from the iPhone 13 Playwright viewport preset.

Before comparison, verify that production code in the baseline remains unchanged and both worktrees still contain the identical performance spec. Compare corresponding score/quality/repeat/browser rows; do not exclude slow-frame pauses or substitute idle RAF timing for running-play performance.

After both sides are collected, create the comparison (the optional fourth input replaces first-case comparison data with the clean control rerun while retaining the original attempt in the report):

```bash
node tests/helpers/compareRallyPerformance.mjs docs/verification/rally-4000/baseline/chromium/summary.json docs/verification/rally-4000/after/chromium/summary.json docs/verification/rally-4000/performance-comparison.json docs/verification/rally-4000/baseline/chromium-clean-repeat1/summary.json
```

The final full matrix ran on canonical runtime C `d30aa196f2faccd88fab36de4b94bb585c21b464`, source tree `47bd0f370ad169de00c77b37bb74429b63020d44`, with the same formal CLI/spec/config. Its archive is `after-single-pass/chromium/`; the initial `after/chromium/` matrix remains intact. Baseline-to-final and initial-to-final comparisons are `performance-comparison-single-pass.json` and `performance-optimization-comparison.json`. The final measurement did not validate a latency improvement, and all 16 target verdicts are FAILED.

The raw `particleCapacity` counter mixes legacy point slots and rally quad slots. Report those as 1536 and 10240 separately; the fixed rally position/RGBA arrays occupy 1,720,320 bytes. Do not interpret 11776 as physical particles or GPU VRAM bytes.
