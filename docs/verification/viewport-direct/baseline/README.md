# Baseline viewport evidence

Source: detached worktree `/workspace/takkeu-baseline`, commit `3e7ceba208200db931af645fdae1ccb271f4a7b7`. No product source changed. The only untracked item in that worktree is the shared `node_modules` symlink. Vite used port 4180.

All five requested CSS viewports were captured in Chromium and WebKit, at `stage2.show(0, 1.25)` and `stage2.show(555, 1.25)`, with device scale factor 1. There are 20 raw metric records and 60 PNGs (browser viewport, full page, and complete canvas). The capture completed without page errors or capture failures. These are Linux browser engines, not real iPhone/device results.

`manifest.json` records browser versions, exact source SHA and runtime context. Each `*.json.gz` is lossless raw JSON, including snapshot/config, camera matrices, every unique paddle mesh vertex, 400 clamped boundary placements, table corners, actual ball geometry bounds, and 128 seeded incoming/outgoing trajectories sampled at 401 normalized times. `analysis.json` contains derived viewport visibility and static pixel coverage. `*-viewport.png` preserves the initial scroll position; `*-fullpage.png` makes the old layout's overflow visible; `*-canvas.png` records the entire court.

## Baseline dimensions

Both engines produce the same CSS rectangles and independent geometry projections. Sizes below are CSS pixels at score 0. Score 555 keeps the same geometry and size, but the 280×360 HUD wraps and moves the canvas downward.

| Viewport | CSS canvas W×H | Canvas / viewport area | Table front width | Table depth | Paddle face width | First ball width |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 390×844 | 356×248.406 | 26.866% | 318.108 | 139.884 | 44.619 | 11.240 |
| 844×390 | 341.906×246 | 25.553% | 315.026 | 138.529 | 44.186 | 11.131 |
| 1280×720 | 599.859×414.703 | 26.993% | 531.066 | 233.530 | 74.489 | 18.765 |
| 320×568 | 286×199.563 | 31.401% | 255.559 | 112.379 | 35.845 | 9.030 |
| 280×360 | 246×171.641 | 41.888% | 219.802 | 96.655 | 30.830 | 7.767 |

All four table corners, every vertex of the wooden blade/front/back rubber/handle/grip/rim at all sampled clamped placements, and every sampled visible trajectory sphere fit **inside the canvas**. The trajectory measurement samples real configured trajectory and target functions; it does not prove every possible random plan. At score 555 the visible sphere uses the glow's actual 24×16 tessellation. The initial capture used the core tessellation at the same outer radius; `correct-glow-sphere-sampling.mjs` recomputes that metric from the original saved world samples and camera matrices, and the correction log preserves old/new margins. Screenshots and world samples were not changed.

Canvas visibility differs from browser viewport visibility at **280×360**:

- At score 0 the canvas starts at y=210.797 and extends to y=382.438. Only 36.413% of the viewport is visible canvas. The initial paddle is visible, but the complete paddle at its lowest boundary extends 4.364px below the viewport (113 of 400 sampled placements have some vertex outside).
- At score 555 the canvas starts at y=278.797 and extends to y=450.438. Only 19.817% of the viewport is visible canvas. The table front is 48.350px below the viewport; the initial paddle extends 38.539px below it, and the lowest complete paddle extent is 72.364px below it. 299 of 400 boundary placements have some vertex outside.

## Visual inspection and static glow-area measurements

All 20 viewport PNGs were opened and visually inspected, along with the shortest portrait full-page/canvas views. The evidence shows a large empty input pad below the portrait court, substantial outside margins on desktop/landscape, and the shortest portrait overflow described above. The initial red paddle and complete handle are visible at the other viewports. WebKit has minor font/emoji rasterization differences; its court geometry matches Chromium.

At score 555, bright saturated canvas pixels occupy 21.870%, 20.838%, 22.152%, 25.567%, and 18.630% of the Chromium viewport, respectively in table order. WebKit differs by less than 0.06 percentage points. The final small value reflects clipping below the viewport. These are static area measurements, **not flashing-safety acceptance**. `analysis.json` defines the exact bright/saturated, linear-luminance and score-0-to-555 change thresholds and retains pixel counts so the final implementation can use the same measures.

## Baseline unit result and environment failures

`unit.log`: `npm run test:unit` ran once against the baseline: 178 passed, 1 failed across 32 files. The failure was `release-revision.test.ts`; its child Node process was denied with `spawnSync ... EPERM` by the restricted execution environment. `release-revision-diagnosis.log` preserves the underlying error. The same command against the same temporary Git checkout/SHA succeeded with execution network permission (`release-revision-diagnosis-network.log`). The unchanged failed test then passed with that permission (`unit-release-revision-network.log`). No assertion or project dependency was changed.

The first local Vite start failed with `listen EPERM` (`server.log`); the start with execution network permission succeeded (`server-with-network.log`). Browser downloads succeeded (`browser-install.log`) but host libraries were absent. Debian packages were downloaded and extracted below `/tmp/takkeu-browser-libs`, then linked into WebKit's bundled `sys/lib` directories. Host setup attempts and results remain in `host-libs-*.log`. `host-libs-load-proof.log` demonstrates that the actual GLESv2 and WebKit shared libraries load. Chromium and WebKit fixture probes are retained.

## Reproduce and capture the final implementation

The project lockfile and dependency manifest were not modified. Browser binaries live at `/tmp/takkeu-browsers`. Local library packages are outside the repository. WebKit's wrapper replaces `LD_LIBRARY_PATH`, so the extracted shared objects are also symlinked into both bundled WebKit `sys/lib` directories.

Run local servers/browser commands with execution network permission in this environment. The required environment is:

```sh
PLAYWRIGHT_BROWSERS_PATH=/tmp/takkeu-browsers
PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1
LD_LIBRARY_PATH=/tmp/takkeu-browser-libs/root/usr/lib/x86_64-linux-gnu
```

The host-requirements skip is needed because Playwright checks dynamically loaded `libGLESv2.so.2` against the system `ldconfig` database, which cannot see the local library tree. Actual library loads and browser rendering were verified; this does not skip browser tests.

With the final source served on 4173, run from `/workspace/takkeu`:

```sh
PLAYWRIGHT_BROWSERS_PATH=/tmp/takkeu-browsers \
PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 \
LD_LIBRARY_PATH=/tmp/takkeu-browser-libs/root/usr/lib/x86_64-linux-gnu \
node tests/helpers/viewportEvidence.mjs \
  --url=http://127.0.0.1:4173 \
  --source=/workspace/takkeu \
  --output=docs/verification/viewport-direct/after
python3 tests/helpers/viewportEvidenceAnalysis.py docs/verification/viewport-direct/after
```

The reusable capture script performs projection through Three camera matrices without calling the input mapping under test. The camera eye/target and world config come from the served checkout and are retained in each raw record. No real device, VoiceOver, human listening or flashing-safety validation is claimed.
