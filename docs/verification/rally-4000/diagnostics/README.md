# Renderer CPU diagnostic

This is a diagnostic benchmark, not a CI test or a browser performance acceptance case. It does not replace the 60-second real-loop before/after matrix.

From the project root with Node 24:

```sh
node --import ./docs/verification/rally-4000/diagnostics/register-typescript-imports.mjs ./docs/verification/rally-4000/diagnostics/profile-rally-renderer.mjs
```

The loader resolves the project's extensionless TypeScript imports; Node strips their types. `tests/helpers/rallyPerformanceReplay.ts` constructs the same initial 30 plans, 120Hz simulation and autoplayer as the existing app harness. The profile stores 1,800 drawing states over 30 simulated seconds. It times 600 selected `renderer.update` calls per repeat, three repeats, after 100 warmups per quality/variant. It excludes replay construction, controller copies, statistics inspection, WebGL submission and GPU work.

Variants use the identical replay: full state, test-only removal of hit rings, and test-only coalescing of equal-time/equal-position hit facts. Production code is unchanged by these variants. Update-range byte counts are requested active buffer ranges, not driver/GPU transfer timings.

Results are in `../logs/render-cpu-profile.json` and `.log`; runtime, input/source hashes, sample counts and provenance are in `render-cpu-profile-metadata.json`. The exact original executed `/tmp` script is retained as `profile-renderer-original.ts.txt`; `profile-rally-renderer.mjs` is the portable equivalent. The metadata was collected after the run without rerunning its timings.

The replay retained all 30 balls, lost none, and advanced score 4000→4570. Median full-update CPU cost was 0.533ms mean / 0.767ms p95 in standard quality and 0.238ms / 0.339ms in low. Removing hit rings saved about 0.055ms mean in standard; coalescing coincident hits showed no material CPU gain. These measurements do not explain or dismiss the observed 33ms frame-interval regression. The separately coordinated WebGL probe investigates submission, double-sided transparent passes, GPU completion and pixel equivalence.
