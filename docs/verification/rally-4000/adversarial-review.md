# Independent whole-branch adversarial review

**Current verdict for production source `d30aa196f2faccd88fab36de4b94bb585c21b464`: the confirmed visual defects are addressed, but important performance finding P1 remains unresolved after the full retest.** All16 final conditions miss the declared Linux target, and the4000 p95 result is16.17% worse than baseline in standard quality and15.16% worse in low. The single-pass correction demonstrably removes redundant submissions and preserves sampled pixels; it has not demonstrated a real-loop latency recovery. No additional source-level correctness defect was confirmed. Formal CI and sampled safety evidence do not establish performance or real-device/human acceptance. Earlier findings and failure metrics are retained chronologically as historical evidence.

Reviewed baseline `aff31169fd6feaad7bad35f22fe3de26429296cf` against branch HEAD `12905cac1e012d7a011e1cbfe55feaebd76cc526` and the stage-3 working tree on 2026-10-25. This is a review of the evidence available at that point, before the pending cosmic-background correction, dense flash captures, final broad browser run and post-change performance matrix. No production source was edited by this reviewer.

## Verdict (initial review; see addressed follow-up below)

**Changes required: one important visual/specification defect.** The implementation has credible event, lifecycle, audio and resource tests, and the strict protected files are intact. The observed 2000+ scene does not yet fulfill the required dark cosmic background transition. Safety and performance acceptance remain pending; passing measurement execution must not be reported as meeting the performance target.

No critical physics, scoring, PR26, ranking-protocol, warning-audio or finish regression was confirmed in the inspected source and available evidence. This is not an all-platform completion verdict.

## Important finding I1 — 2000 cosmic space is a narrow strip, not a background transition

- **Source:** `src/render/rallyEffects.ts:177`–190 (`stars`), especially backdrop rectangle at line 180 and star coordinates at line 183. Related background halos and final arrivals use approximately `y=-.2`, with vertical aspect `.23`–`.28`, at lines 190, 215–217 and 240–275.
- **Binding requirement:** requirements R15 / 2000 row: transition over 2.5 seconds into a dark cosmic space with light points and a large halo, retain tricolor electricity and the 490 rainbow court. The design explicitly requires actual camera-visible stars rather than points hidden by the opaque scene.
- **Actual evidence inspected:** `evidence/chromium/thresholds/2000-after.png`, `evidence/webkit/thresholds/2000-after.png`, `evidence/chromium/thresholds/3500-during.png`, and the `evidence/chromium/motion/4000-{0.10,1.40,2.50,3.50}.png` sequence. On the 390×844 Chromium image, the dark backdrop occupies approximately y=253–322, only 69 px / 8.2% of the viewport. A saturated rainbow wall still occupies the entire upper ~253 px. The WebKit image reproduces the same composition. The star field is technically visible, but appears as a horizontal inset; the supposed large cosmic halos and 4000 assembly are compressed into it.
- **Why tests miss it:** `tests/unit/rally-render.test.ts:257`–274 establishes that many star vertices project inside the viewport and avoid the opaque court. It does not establish background coverage or visual scale. The browser assertions at `tests/browser/rally-effects.spec.ts:18`–44 establish resources, notices, score and point projection, not this composition. Their passing result therefore does not contradict the screenshot defect.
- **Fix direction:** extend the dark background upward over the actual camera-visible far background; distribute stars and suitably sized deep halos over that space. Preserve the 490 unified rainbow table/court/floor materials and camera/input mapping. Adjust the presentation-only background placement rather than changing physics or making decorative meshes ignore depth. Include landscape and portrait compositions in the new image review.
- **Required recheck:** 1999, 2000 arrival/intermediate/after and 4000 four-phase captures in both engines; verify the retained rainbow court/floor and ball/racket visibility. Rerun affected renderer tests and dense flash captures against the corrected source. Earlier captures must not be represented as verification of the corrected layout.

## Foreground priority observation

The 2500/3500 table bands are visually busy. In the inspected `3500-during.png`, `4000-2.50.png` and landscape `layout/844x390-text100.png`, they remain largely around the table perimeter; the representative balls and racket are still identifiable. Materials retain `depthTest:true`, `depthWrite:false` (`rallyEffects.ts:14`), so the renderer has not simply forced these decorations over opaque foreground geometry. This evidence does **not** justify a separate confirmed occlusion defect.

The fixture uses two fixed balls (`tests/helpers/rallyHarness.ts`, `staticBalls`), and its browser assertion only checks whether their centers project inside the camera. It does not establish clear tracking for all 30 moving balls or every side/near-edge return. That wider readability claim remains unconfirmed; inspect real moving foreground evidence, especially at 3500/4000 and on narrow screens, before describing ball/racket priority as exhaustively verified.

## Inspected implementation and confirmed evidence

### Protected behavior

The reviewer independently ran `git show aff31169:<path>` and compared the resulting bytes with the current worktree for every strict file in `protected-integrity.json`: **28/28 identical**. This includes PR26 comments/effects/result CSS/screens/result-position, camera, input mapping, physics/progression and ranking protocol files. This was a fresh comparison rather than reliance on the report's boolean.

The `simulation.ts` diff only copies the actual `sampleReturn` loss position and cumulative loss count into the existing event; `types.ts` adds the optional loss fact. The game score, flight/collision paths and reward calculation are unchanged in the diff. The 0→4001 test really calls fixed-step simulation from zero and supplies paddle targets; it does not set score or rewards. Its twin run checks event/snapshot/RNG equivalence. It is automated numerical play evidence, not human input/video evidence.

### State, timing and finish

Inspected `src/game/rallyEffects.ts` in full: current-run filtering, score/loss watermarks, original event positions and times, rolling two-second loss window, initial nonzero-best capture, bounded arrays, exact B deadlines and A replacement rules. Authoritative production events are ordered; replayed lower scores/loss counts cannot retrigger arrivals. The renderer uses original deadlines and checks run ID; its latest-major/final-loss logic prevents suppressed earlier arrivals from returning after newer cues expire.

`createApp.ts` captures best at reset, consumes confirmed events before rendering, and resets effect state on retry/home. It still finalizes/persists the score and calls the existing ranking finish path at game-over. `finishPresentation.ts` advances only the drawing snapshot, takes the larger existing/new effect deadline, and caps the presentation at five seconds. The loss-100 screenshot and finish tests corroborate drawing after physics stops. Renderer allocation is fixed at four geometries/materials and bounded buffers; reset/disposal paths are present. No gameplay RNG call was introduced.

The legacy chain-based loss shake remains in `game/celebrations.ts`, which is protected/unchanged. The new low-impact cue uses the correctly bounded rolling window. These are distinct facts; do not claim that the old shake's chain semantics were rewritten into rolling-window semantics.

### UI and audio

Inspected notice selection and CSS, including original simTime deadlines, major/best/ordinary priority, pointer transparency, enlarged-label bound and reduced-motion styles. Inspected actual 200% text and landscape warning screenshots: labels are readable and the warning is separate from the notice in those cases. The standalone best notification and all possible foreground paths were not visually established by those overlap screenshots.

Inspected `audio.ts` and added tone definitions: 1000/3000/4000 replace the ordinary milestone phrase; 2000 retains it. Warnings can retire an occupied voice, later fanfares cannot steal an active warning, fanfare gain ducking has a continuity fallback, and voice/tail pools remain bounded. Best/impact dedup and mute/reset/suspend cleanup are present. The distinct impact priority survives same-time game-over; the native ending-impact JSON has nonzero waveform, silence after .25s, disposal, and agreement with the non-ending control in both engines.

The audio summary contains 70 renders per engine, peak <=.322452 and warning residual RMS >.0075, with disposal. These are useful signal/graph measurements. No human listening, speaker balance or actual-device audibility was independently established here.

### Formal logs inspected

- `logs/final-unit.json`: `success:true`, **938 total / 938 passed / 0 failed / 0 pending**; inspected top-level counts and every suite status. `final-unit.log` alone contains only the reporter destination and would not establish the counts.
- `logs/final-typecheck.log`, `logs/final-build.log`: TypeScript and production build completed; the build retains a bundle-size advisory.
- `logs/browser-focused-first.log`: **10/10 passed**, five rally browser cases in Chromium and WebKit. Earlier largest-label failures are retained in `browser-arrival-first.json` (2 unexpected); `browser-arrival-fixed.json` shows both retests passed.
- `logs/flash-analyzer-tests.log`: four synthetic analyzer cases passed. This is analyzer self-test evidence, not a content safety pass.
- Audio summary/ending-impact JSON and `through-play.json` checked against their test/source definitions.

### Images and sequences actually viewed

Viewed all six Chromium `evidence/chromium/review/thresholds-*.jpg` contact sheets, containing all 23 thresholds × before/arrival/during/after. Viewed full-size Chromium 2000-after, 3500-during, the 4000 .10/1.40/2.50/3.50 sequence, loss55 at .25, loss100-finishing, 200% text and landscape warning captures. Viewed the full-size WebKit 2000-after counterpart. The 4000 sequence has visibly distinct convergence/partial assembly/expanded ring/overlapping rings, but their scale and placement share finding I1. Contact-sheet inspection is not a full-duration motion review of every loop.

## Flash methodology review and outstanding acceptance

`rallyFlashAnalysis.py` linearizes sRGB, computes relative luminance, detects opposing extrema, includes saturated-red/UCS transitions, evaluates one-second frequency, and uses integral sums to search every placement of the reference area. This is substantially stronger than merely counting animation toggles. Its known-unsafe full-frame and small-area/low-frequency controls are useful. It correctly states limitations: sampled SDR canvas, not HDR/hardware/accredited certification; CSS and result screen excluded; spatially staggered closing frames may be overcounted.

`captureRallyFlashFrames.mjs` uses actual production rendering at every explicit 1/60 simulation second, with legacy century/repdigit/loss effects deliberately overlapped; it blocks external requests and records source hashes. This is a synthetic conservative scene, not physical traversal. The FFV1 packer's intended RGB round-trip verification is an appropriate retention mechanism.

**At review time no `safety/captures/summary.json` or completed content-analysis corpus was available.** Therefore no content flash pass is issued. A changed backdrop alters large-area luminance transitions, so the I1 correction specifically requires fresh final-source capture/analysis. Even a no-exceedance result must retain the documented limits and must not become an assertion of universal WCAG/device safety.

## Performance methodology review and outstanding acceptance

The performance spec measures actual RAF time and running-only intervals from the normal app loop for at least 60 seconds, retains slow-frame pauses and simulation duration, blocks external requests and begins with 30 balls. The collector's all-sample active-ball check is needed in addition to the spec's initial-ball assertion. A Playwright pass asserts measurement execution, not p95/25ms/continuous-play acceptance. The method makes this distinction explicitly.

The baseline matrix records target failures, including approximately 233–633ms running p95 and 21–45 simulated seconds per minute. The original contaminated first run is retained separately from its clean control. This makes a baseline target success claim impossible. **The post-change matrix and before/after comparison were not yet available**; no regression/no-regression or target-met conclusion is issued. Shared-host scheduling and software rendering constrain interpretation. Actual iPhone17Pro/Safari/VoiceOver performance remains unconfirmed regardless of Linux numbers.

## Exact remaining review limits

1. I1's corrected source and regenerated images were not part of this initial review.
2. Dense final-source content flash captures, their region/time analysis and lossless video round-trip records are pending.
3. Post-change 16-case 30-ball performance, paired comparison, long-run memory interpretation and final broad browser/release/CI outcomes are pending.
4. Visual inspection was exhaustive across threshold contact sheets, but not every full-size image, every phase of the 3s/4s loops, a standalone best scene, or actual 30-ball moving foreground paths. 900→999 and 3750→3999 gradual changes have source/unit support but were not fully observed as continuous progressions here.
5. Human listening, physical iPhone/Android, Safari on actual iPhone17Pro, VoiceOver, HDR and physical input remain unconfirmed. Desktop WebKit screenshots do not resolve these.

The confirmed defect must be corrected and reviewed; pending evidence must be completed or accurately reported as unmet/unconfirmed. Neither the 938 passing units nor the 10 focused browser passes override these limits.

## Scoped follow-up — I1 addressed in `7aa8333`

The reviewer re-inspected the committed `stars()` implementation, added coverage tests and newly generated Chromium screenshots. **I1 is addressed in source and observed Chromium rendering.** The upper background now becomes dark over its full visible height, contains vertically distributed points and a large slow halo, and retains the rainbow table/court/floor. No new source defect was found in this correction. Full cross-engine final evidence, flash screening and post-change performance remain pending at this follow-up.

The implementation at `src/render/rallyEffects.ts:177`–200 extends the backdrop to x ±12 / y 12, adds a short lower alpha gradient ending above the floor seam, stratifies half the stars across the tall portrait background, and adds upper halos. It retains depth testing and does not change court materials or camera/input projection. The added unit cases sample 20 upper-background camera rays in each of portrait/landscape, require at least 18 covered, check the floor against the lower seam, and require stars in all three vertical portrait bands plus substantial upper-halo extent. These assertions test the missed composition requirement rather than merely increasing visible vertex count.

New images actually opened in this follow-up:

- `evidence/chromium/thresholds/2000-after.png`: dark upper background now extends to approximately y=317 of 844, with distributed stars and a large upper halo. The table and the floor retain their rainbow appearance; the two fixture balls/racket remain identifiable.
- `evidence/chromium/motion/4000-2.50.png`: dark upper star space and multiple tall halos persist during the final assembly; table loops and rainbow foreground remain visible.
- `evidence/chromium/layout/844x390-text100.png`: the naturally shallow landscape background is dark, with the warning readable and rainbow court preserved.

The existing `evidence/webkit/thresholds/2000-after.png` was also opened: at this exact check it still contained the **old** narrow-band composition because the final WebKit capture batch was in progress. It is not evidence against the new source, and it is not counted as verification of the fix. The final batch must replace it and its new content must be inspected before claiming observed cross-engine closure.

The reviewer parsed `logs/stage3-final-unit.json`: **941/941 passed, zero failed/pending and no failed suites**. `stage3-final-typecheck.log` completed successfully. A fresh independent comparison again found **28/28 strict protected files byte-identical** to `aff31169`. `logs/browser-focused-final.log` at this check had all six Chromium cases passed and had started WebKit; no final 12-case result is claimed yet.

The root additionally corrected the initially imperceptible 300-score gold rays. This reviewer inspected the CSS change (`#e8bd514d` to `#ffd665e6`), unchanged paired-pixel assertions, and formal red/green logs: the previous code produced zero qualifying pixels in both engines, while `browser-gold-fixed.log` records both cases passing the same ≥80-pixel / ≥3-quadrant requirement. This is credible targeted verification of that separate fix. It does not replace final-source flash evidence or human perception checks.

**Updated acceptance status:** no confirmed code/visual defect remains open from this scoped review. The pending final WebKit content check, dense final-source flash analysis, post-change 30-ball matrix/comparison, broad regression/CI and previously listed real-device/listening limits still apply. The initial I1 description above is retained as the historical failure and must not be read as the current source verdict.

## Safety follow-up — observed failure, fix scope and analyzer limitation

**Acceptance is pending; the earlier captures have a real unresolved-at-capture high-frequency area failure.** The reviewer inspected the saved analyzer JSON, `safety/root-cause-floor.md`, its plotted luminance traces/crop sequence/frequency mask, a targeted row from the geometry reconstruction, and the subsequent production diffs and tests. The initial worst standard capture has max pixel count 22 and high-frequency area 82,788 against 21,824; the bounded/slowed legacy-render correction reduces this to count 11 / area 31,808. Both area results exceed the unchanged criterion independently of the analyzer's additional aggregate-closing-frame rule. They cannot be dismissed using that rule's conservatism.

The root-cause evidence supports a composite cause rather than blaming random motion alone: no-random retains area 27,761 and no-repdigit retains 28,527. At pixel (160,650), frame 27, the reconstruction records four coincident `rally-table-lines` intersections with RGBA approximately [.7,.85,1,.45], additive blending, identical positions/depth, over the gold legacy floor. The plotted/cropped actual pixels show white peaks and multiple qualifying luminance reversals between the .3s palette switches. The reconstruction is finite CPU evidence tied to the captured run; it is consistent with the actual pixels and pre-fix `lossCue` drawing each of the four same-time milestones independently.

The current `celebrations.ts` correction bounds net bolts to 24, their size/width/opacity, replaces 18Hz hard shape changes with smooth deterministic 1.2Hz noise interpolation, and slows shake. The current `rallyEffects.ts` correction coalesces identical-time loss-wave outlines while retaining all facts, shares a .45 total opacity budget among distinct-time waves, and fades them under final-loss priority. These edits directly address the identified visual causes without changing event/scoring/physics/number-palette state. The new wave tests cover equal-time equivalence, retained source facts, aggregate opacity, onset continuity and final priority. `logs/render-loss-wave-budget-green.log` confirms **86/86** renderer tests; the earlier legacy focused log confirms **11/11**. These tests establish the intended correction, not the final rendered flash result. All affected quality/stress cases still need final-source captures and analysis.

### Precisely reproduced conservative analyzer false positive

The unchanged analyzer's `maxGeneralLargeClosingFramesPerSecond` counts a frame whenever the maximum closing area in **any** reference-window position exceeds the area limit, then sums those booleans across one second. It discards which pixels/components/window positions produced the closures. Thus it is an investigation trigger rather than a mathematically equivalent flash-frequency test for a component or fixed visual field.

The reviewer independently ran this small input through the existing `screen()` without changing any threshold or implementation:

```python
def sequence():
    for frame in range(180):
        image = np.zeros((48, 64, 3), dtype=np.uint8)
        for band in range(4):
            t = frame - band * 2
            if t >= 0 and (t // 15) % 2:
                image[band*12:(band+1)*12, :, :] = 255
        yield image
result = screen(sequence(), 60)
```

Each of four disjoint horizontal components flashes at 2Hz, delayed by 0/2/4/6 frames. Result: max per-pixel one-second count **3** (inclusive endpoint convention), high-frequency area **0**, but aggregate large closing-frame count **9**, causing `flagged:true`. Closings at frames 45/47/49/51 have maximum windows at y=0/8/20/32; the aggregate counts their phase offsets as distinct high-frequency events. Full observed metrics and event locations are retained in `safety/adversarial-staggered-screen-counterexample.json`.

The checked W3C source says that flashes are opposing luminance changes, that the frequency alternative allows no more than three flashes within a one-second period, and that the spatial alternative concerns the combined area flashing **concurrently** within a ten-degree field; its listed G19 technique addresses each component. Counting phase-staggered components' separate completion frames globally is not the same measurement. This demonstrates the already documented potential overcount; it does **not** show that a real flagged scene is harmless.

For example, the no-legacy ablation's aggregate-only flag has four large closures at frames 193/229/235/245, with maximizing windows [306,21], [659,123], [80,111], [0,512]. Its high-frequency area is 15,545 (below 21,824), but individual pixels reach count 8. These values require investigation of the underlying masks, component correspondence and transition timing. The changing maximum-window coordinates alone neither prove a normative failure nor prove a false positive.

Keep all existing thresholds and raw metrics, including this conservative trigger. If the final scene is flagged only by it, review the actual event masks and spatiotemporal grouping or obtain an independent established analyzer; report the conservative flag and any adjudication separately. Do not increase an area/frequency limit, silently delete the trigger, or turn the counterexample into an automatic content pass. A more exact algorithm would itself need independently validated fixtures for staggered components, concurrent regions and genuine high-frequency motion. **No final safety pass is issued by this follow-up.**

## Safety follow-up 3 — residual action-cloud overlap and incomplete visual priority

The reviewer parsed `safety/final-worst-standard-v3/4000-standard-legacy100/analysis.json` and opened actual frames 15, 30 and 64. The broad-color correction reduces the aggregate large-closing-frame maximum to **1** and red high-frequency area to **0**, but the general high-frequency area is **21,975 > 21,824**. It remains a failed screen, with no numerical tolerance. Its maximum occurs at frame 64 (1.0667s after arrival), window [0,472]. This statistic describes the preceding inclusive one-second history; looking only at the final frame would miss clouds that expired earlier.

The reviewer independently extracted saved RGB values and reran the unchanged pixel detector at five floor probes, then reconstructed six times at ten rays from the **v3 captured source**, using the existing CPU geometry method. Results are retained in `safety/adversarial-v3-floor-probes.json`, `safety/adversarial-v3-floor-geometry.json` and its execution log. The reconstruction aliases the missing captured `game/config` import to the unchanged production configuration; it is CPU ray evidence, not a new browser capture. Vite emitted a restricted-HMR socket warning, but no browser/GPU rendering was required and the 60 probes completed.

At (64,700), frames 10/15/20 are RGB [255,255,255]. At frame 15 the ray intersects **five new impact-cloud line segments**, each alpha approximately .19, plus a permanent table halo at .25. The pixel has qualifying closures at frames 17/21/23/31/53, giving five in the frame-64 window. At (160,650), the same window contains six closures. At frame 64, those sampled floor rays instead intersect permanent table lines at approximately .26/.163 alpha. Thus the remaining evidence implicates early overlapping action clouds plus ongoing bright-line crossings over the animated floor. No repdigit bolt intersects these finite sampled rays; this review does not assign the entire residual failure to legacy repdigit electricity.

There is also a source-level priority gap. Before the proposed central correction, `createView.ts:69`–71 updates fireworks, legacy celebrations and new effects independently. `rallyEffects.ts:409`–429 draws permanent bright lines at full opacity before computing arrival/final priority; line 456 resets opacity to one before all loss sparks/impacts. Only earlier arrivals and perimeter waves receive the priority fade. Legacy repdigit bolts remain at .9 alpha in `celebrations.ts:108`. As a result, major/final cues suppress some transient competitors but do not lower the other decorative layers that compete with them. This conflicts with the stated foreground → finish → major → best → ordinary temporary → background priority even apart from the 151-pixel excess.

**A central presentation-only priority budget is justified.** It should control the combined brightness of lower-priority permanent lines, repdigit bolts, fireworks and action clouds while retaining all confirmed facts, event positions, original deadlines and nonzero representation of each loss spark, including loss 100. It should use smooth simTime attack/release so pause/context reconstruction cannot restart effects or introduce an opacity jump. Dense simultaneous clouds need an aggregate budget as well as a per-layer multiplier; multiplying every cloud by the same small constant alone does not establish a crowd-size bound.

The dark star backdrop must retain its opacity: dimming its normal-blended rectangle would reveal the bright rainbow wall and undo I1 while potentially increasing large-area contrast. Balls, racket, warnings, score/best logic and the existing loss-number meshes/palettes/durations must be outside this decorative budget. The legacy electric and digit batches are separate, so this separation is implementable. The new world glow batch mixes backdrop and decorative geometry and requires draw-level control rather than indiscriminate whole-material opacity.

The correction should be validated through preserved standalone effects, unchanged source facts/digit appearance, priority overlap tests, finite resource bounds and fresh unchanged-threshold full-scene captures in both qualities. The CPU/pixel evidence supports the scope; it cannot predict that a chosen opacity constant will pass. **Final acceptance remains pending the implemented budget and new captures.**

## Final source/evidence follow-up — `0285168`, before post-change performance

The reviewer inspected the final shared-priority implementation and focused assertions, final actual images, the formal CI logs/report JSON, all14 final safety-analysis records and production-source fingerprints, and independently completed the remaining fixed-field diagnostics. **The previously confirmed implementation defects are addressed. No additional critical/important source defect was confirmed.** This closes the code/observed-composition portion of the review; it does not assert every requested acceptance condition is complete.

### Corrections and images

`presentationPriority` supplies one deterministic simTime opacity factor to legacy electricity, fireworks and new decorative geometry. It attacks smoothly over .2s, restores during the final .3s of a major arrival, and retains final-loss priority through the ending even after cue pruning. The renderer preserves full-strength major/final geometry, leaves the dark cosmic backing unaffected, and retains nonzero loss-spark positions/deadlines. Legacy digit rendering is outside the attenuation path. Tests inspect actual buffer alpha/geometry, unchanged backing, the hundredth spark and original state facts. The separate wave budget prevents same-time outlines from multiplying brightness. Broad floor palette changes now crossfade; visual chroma motion is slower and displayed pulse contrast narrower while logical pulse and gameplay state remain unchanged.

Opened the regenerated **WebKit** `thresholds/2000-after.png`: the upper background is now a full dark star space with a large halo and retained rainbow court/floor. This resolves the previous cross-engine image-check gap for I1. Also opened current Chromium `thresholds/3500-during.png`, `motion/4000-2.50.png`, `losses/100-finishing.png` and final worst-standard-v4 sample15. They retain identifiable representative balls/racket, visible final geometry and loss digits. The synthetic hundred-loss cloud is still visually intense; the numerical screening results below describe its sampled limits. Two-ball threshold images still do not establish every real 30-ball return path or physical-device tracking comfort.

### Final formal CI and protection

Inspected `ci/40235973827/run-metadata.json`, selected original Playwright reports, the unit job log and archive-verification record. The completed successful run is tied to exact head `0285168e455b5ec71f4197b1acbf68f29b5d46a5`, attempt1, with six expected jobs. Original selected reports show94 interaction +3 load cases per engine: **194 browser passes**. Release report shows **8 passes**. Unit log reports **71 files / 958 tests passed**. No skipped/flaky/unexpected/retried case is reported in the extracted formal results. The archive verification records complete ZIP members and split-file reconstruction checks; the reviewer inspected those records rather than independently re-extracting every large artifact.

A fresh byte comparison again confirms **28/28 strict protected files identical to `aff31169`**. Current production display source hashes match all four final capture-run manifests (`final-regular`, `final-worst-standard-v4`, `final-worst-low`, `final-fireworks`), each `sourceStable:true`. Test-only diagnostic/packing work does not change that production source.

### Final sampled flash evidence and resolved aggregate discrepancy

The final primary index contains **14 scenes / 5,040 actual 60Hz SDR canvas frames**: eight regular score/quality combinations, two reduced-motion scenes, two maximal legacy-loss scenes and two legacy/fireworks overlap scenes. Every general high-frequency area is below the unchanged21,824-pixel threshold; red high-frequency area is0 throughout. The largest final general area among these14 records is12,742. Earlier failures at82,788/31,808/21,975 remain retained as failures of earlier versions.

The original conservative analyzer still flags **five scenes solely by its global any-position closing-frame counter**. The reviewer ran the separate, unchanged `rallyFixedFieldAnalysis.py` on all five exact raw sequences. RGB stream hashes and original global counters match for every run. Counts include every qualifying frame, including adjacent frames; no peak grouping/tolerance was introduced:

| Scene | Original global counter | Exact maximum per fixed341×256 field | Red fixed counter |
|---|---:|---:|---:|
|1500 standard|7|2|0|
|1500 low|4|2|0|
|3000 low|4|2|0|
|4000 standard|5|2|0|
|4000 low|5|1|0|

For the remaining nine scenes, a fixed-position count cannot exceed their already <=3 global count. Thus **no fixed-field closing-frame count exceeds3 in the final corpus**. The five global flags are explained by combining different spatial windows under the same closing-mask definition. The primary JSON flags remain `true`; nothing was silently reclassified or weakened. Exact witnesses, self-tests, W3C field citations and scope limits are in `safety/fixed-field-review.md` and `fixed-field-*.json`.

This resolves the specific unexplained aggregate result. It is **not** a standalone normative WCAG certificate: detector closing instants do not completely model flash temporal extent/component identity, and actual display/viewing distance, eye movement, HDR, CSS outside the canvas and physical-device presentation remain outside this screen. The defensible statement is that the final sampled corpus has no measured high-frequency area exceedance and no fixed-field closing-count exceedance, with five retained conservative global flags explained by the additional diagnostic. Do not describe the unmodified primary analyzer as14/14 unflagged or universally safe.

### Remaining acceptance limits

- The post-change16-case30-ball performance matrix/comparison had not yet run at this final source/safety review. No target-met or no-performance-regression claim is issued. Baseline Linux targets were unmet. Subsequent results must distinguish completed measurements from target attainment.
- Human listening, physical iPhone17Pro/Safari/VoiceOver, Android/HDR, speaker balance and physical input experience remain unconfirmed. Desktop Chromium/WebKit and offline waveforms do not replace them.
- Unit/geometry support and sampled images establish conditions/appearance, but this reviewer did not watch every full3s/4s cycle, every actual30-ball return path, or continuous900→999/3750→3999 progressions. Do not promote those limits into claims of exhaustive human visual verification.
- Lossless pack manifests observed so far report exact RGB round trips; some retained raw flagged sets and new overlap sets were still awaiting packing. Their raw pixels and completed analyses exist. Final delivery should preserve/verify their archival manifests without altering the sampled result.

The implementation and documented sampled-evidence interpretation are reviewable. Overall delivery must retain the performance and device/listening limitations above rather than claim unrestricted completion.

## Post-change performance review — important unresolved measurement result

Inspected the completed performance report, all condition summaries/comparison rows, the unchanged measurement spec (`tests/performance/rally-4000.spec.ts:30`–68), collector and comparison helpers, and resource instrumentation (`src/render/createView.ts:86`). No performance suite was rerun by this reviewer during other agents' diagnostic work. The result is **16/16 successful executions but0/16 declared Linux targets met**, both before and after. All canonical samples retain30 active balls and continuous running. This satisfies execution of the requested matrix; it does not satisfy its frame-time/real-time objective.

**Important concern P1: the4000 starting-score conditions deteriorate despite the quieter after-measurement window.** Standard p95 rises from266.6/249.9ms to300.0/283.3ms, a two-repeat midpoint increase from258.25 to291.65ms (**12.9%**). Simulated seconds fall from40.65/40.59 to34.45/37.12, midpoint **11.9% lower**. Low p95 midpoint rises275.0→291.7ms (**6.1%**), with simulated time39.40→35.44s (**10.1% lower**). The4000 resource maxima are36→44 draw calls,53→57 geometries, and1440→1688 standard active particles (720→844 low). This is an observed regression concern, not proof that one specific allocation or shader caused it. It must not be dismissed because the baseline already misses the target or because other conditions improve.

The measurements have practical limits relevant to interpretation:

- The baseline shared host CPU with implementation work, only two repeats exist, and the runs are not interleaved. The reported broad before/after improvements therefore do not establish an optimization, and the4000 deterioration is not a statistically isolated causal estimate. A controlled ablation or repeat is appropriate before assigning a cause.
- These are **starting-score workloads**, not constant-score stage benchmarks. Real automatic play raises scores: the4000 baseline ends4723–4777, versus4657–4690 after. Earlier starting scores can cross later thresholds. Different simulation progress changes which effects/events occur during the wall-time sample. The fixture still meaningfully tests sustained30-ball running; describe it accurately.
- Each sampled RAF collects snapshots, resource objects, audio counters and heap data. The call sites are identical, but the new `resources()` implementation calls `rallyEffects.stats()` three times and each creates an active-effect array. This is a small additional observer cost that is not isolated by the matrix. There is no evidence that it explains the measured slowdown; do not use that speculation to invalidate the result.
- The baseline is an older production tree while the measurement spec is identical. Resource maxima include all scene activity, so the aggregate+8 draw-call observation cannot by itself prove that exactly eight new persistent meshes are the cause. Recorded heap values are coarse and cannot establish leaks.
- The Playwright test only asserts successful collection/no external requests/no page errors/initial30 balls; target failure is intentionally recorded in the attachment and collector. Consumers must read `required30BallLinuxTarget`, not the green test status. The collector checks active30-ball continuity in every sample. No target gate was silently relaxed.

**Verdict:** preserve the raw measurements and classify the Linux objective as failed, with a material4000 performance concern under investigation. The evidence does not support a no-regression claim. Any production correction needs fresh appropriate source validation and a separately labeled controlled performance result; it cannot inherit the0285168 measurements or safety captures automatically. Physical-device performance remains unverified.

The additional best/2600 browser log records2/2 Chromium/WebKit passes, improving the specific UI-evidence coverage without changing the performance or normative flash-safety limits. The14-scene sampled safety result and five retained auxiliary warnings remain as described above.

## Narrow single-pass correction — static review, performance retest pending

Independently inspected the production diff: `src/render/rallyEffects.ts:15` adds only `forceSinglePass:true` to the four new `MeshBasicMaterial` batch materials. Three.js's installed `WebGLRenderer.js:2165` explicitly renders transparent `DoubleSide` materials twice by default, back faces then front faces. These batches contain flat, unlit quads with depth testing retained and depth writes disabled; rectangles have consistent winding and ribbons are constructed toward the fixed player viewpoint. The option removes a redundant submission without reducing particles, effect duration, geometry, colors, event facts or gameplay. It is a justified narrow correction. Normal-blended world backing deserves pixel coverage because changing pass order could otherwise matter for mixed-facing overlapping geometry.

Reviewed the real-GL guard and original failure JSON: expected4 submissions, observed8 before the change. Focused renderer93 tests and typecheck pass after the change. The separate controlled diagnostic compares identical frozen snapshots for standard/low × peak/middle; all four report **zero changed RGBA channels**, four fewer actual GL calls, and unchanged uploaded bytes. The diagnostic reads raw framebuffer pixels, not only screenshots or reported Three.js counts. Its normal/single/single/normal block order provides some scheduling control.

The GL timer result is null and `finish()` wait medians are0; these results establish redundant submissions and sampled pixel equivalence, **not GPU completion latency or the cause of the33.4ms standard4000 p95 increase**. No full-regression recovery is claimed. Actual default-GL GREEN, wider two-engine pixel comparisons and the final real-loop matrix are pending at this review checkpoint. P1 remains open. The existing0285168 dense safety corpus is evidence for its captured source; the changed renderer needs its own equivalence/validation record before claiming that evidence transfers.

### Single-pass shader-cache validity check

The actual production-default GL guard is now GREEN (one Chromium test, `logs/gl-budget-green.log`), confirming four actual submissions. A later test-method review identified a limitation in the toggle comparisons: Three.js's two-pass path changes material side and invalidates the shader for BackSide/FrontSide, then resets DoubleSide without another invalidation. A subsequent test-only `forceSinglePass=false→true` toggle may reuse its FrontSide shader. Consequently the broad toggle comparisons alone do not prove the fresh production-default shader path.

Independent source inspection confirms that these current four materials are unlit MeshBasicMaterial without environment maps, skinning or normal maps. In the installed shader, side-dependent normal code is inactive for this configuration; geometry culling and the one/two-pass branch are still set from the actual material state. This explains why the cache distinction need not change these pixels, but should be supported by fresh-renderer comparisons rather than silently omitted.

The approved supplementary method creates a fresh renderer/material set through the existing `restore()` with the override reset to `null` **before its first render**, then compares the same frozen state/quality with the toggled path. It validly exercises the production constructor default. Record equal snapshot/effect facts and exact full-image pixels; recreating the view also resets event-only legacy render state, so those inputs must be accounted for if present. The planned16 fresh comparisons plus the broad toggle corpus provide finite current-configuration evidence; they are not a guarantee for future lit/mapped materials, different geometry or untested scene states. Fresh-comparison outcomes and the performance rerun remain pending at this checkpoint.

### Fresh-default bridge completed — independently reviewed

Inspected the complete `diagnostics/single-pass/fresh-default-check.mjs` and all16 records in `fresh-default/results.json`. The script sets the override to null before `restore()`, captures the fresh production-default renderer first, then explicit two-pass and the cached false→true path. It compares decoded full-image pixels, checks snapshot/controller/finishing equality and fails on a mismatch, page error or external request. The selected four scene states contain no legacy firework or opponent-hit transient facts, so restoring the view does not silently remove a competing transient in this comparison.

All16 combinations (Chromium/WebKit × standard/low ×2000 transition/4000 convergence/4000 expansion/loss100 finishing) have **zero changed pixels and zero maximum channel delta** for fresh-default versus both other paths. Their three decoded-image hashes agree, all four actual batch names are present, and frozen-state checks pass. The reviewer independently rehashed the five recorded source files, including the renderer and Three.js shader implementation; all still match. The saved record reports `completed:true`, `sourceStable:true`, Three.js0.186.1 and production source tree `47bd0f370ad169de00c77b37bb74429b63020d44`.

**The fresh-default supplement validly closes the identified shader-cache evidence gap for these current materials and sampled states.** Combined with inactive side-dependent normal shader code and the wider toggle comparisons, it supports current-configuration visual equivalence. It does not establish arbitrary future shader/geometry equivalence, recapture the full dense safety corpus, or resolve P1. The final real-loop performance result remains outstanding.

## Final single-pass source, CI and performance review — P1 unresolved

The canonical source is `d30aa196f2faccd88fab36de4b94bb585c21b464`, source tree `47bd0f370ad169de00c77b37bb74429b63020d44`. The reviewer inspected the three-way performance report and comparison records, then independently recomputed the p95 of **all four final4000 raw measurement interval arrays**. Each equals its reported value. Every sample in those four raw records has30 active balls and phase `running`, and each measures at least60,000ms. The complete matrix reports16 successful executions, no unexpected pauses and **zero of16 Linux targets met**. Nothing in the passing execution status changes that failed objective.

|4000 quality|Baseline p95 midpoint|Initial p95 midpoint|Final p95 midpoint|Final vs baseline|Final vs initial|
|---|---:|---:|---:|---:|---:|
|standard|258.25ms|291.65ms|300.00ms|+16.17%|+2.86%|
|low|275.00ms|291.70ms|316.70ms|+15.16%|+8.57%|

Final standard simulated-time midpoint is34.57s versus40.62s baseline; low is33.40s versus39.40s. The draw-call maximum decreases44→40 after the narrow change, but maximum programs increases16→17. These are different resource observations, not interchangeable performance outcomes. Total frame intervals are not recovered by the demonstrated reduction in submissions. Host variation, two repetitions and changing score trajectories still limit causal attribution, but do not justify claiming that P1 is fixed or that no degradation occurred. **P1 stays important and open; the declared Linux objective remains failed.**

Inspected the exact-source CI4 summary and original job logs under `ci/40241944794`: all six jobs succeed, **71 unit files/958 unit tests**, **94 interaction+3 load tests per engine (194 browser total)** and **8 release tests** pass. The extracted reports show no skipped, flaky, unexpected or retried case. The archive-verification log records72 workflow-log members and1,034 artifact members verified; this reviewer read the verification records rather than repeating the large archival extraction. Correctness CI is green while performance acceptance remains failed.

The broad pixel record now reports832 exact comparisons across416 camera states, standard/low and both engines. Its formal history is six successful Chromium cases from the initial attempt plus six successful WebKit cases in the rerun; the initial WebKit capture timeout/interruption is retained. It is not a clean single12-case execution. The previously reviewed16 fresh-default cases bridge the shader-cache limitation. This is finite image equivalence for the current one-property material correction, **not a fresh capture of all5,040 dense safety frames** or normative flash-safety certification. The original five auxiliary safety flags and their fixed-field explanation remain preserved.

### Bounded asynchronous GPU probe

Reviewed `diagnostics/gpu-query-probe.mjs` and `gpu-query-results.json`. The script retains timer queries until later animation frames make them available, checks the disjoint flag, and deletes the queries afterwards. All96 saved queries are available with `disjoint:false`; no page errors or blocked requests are recorded. All four normal/single-pass pixel comparisons remain exact. The readback fallback was not needed because timer results were available.

Recomputing conventional medians (mean of the two middle values for even sample counts) from the saved individual samples gives:

|Frozen scene|Normal GPU elapsed|Single-pass GPU elapsed|
|---|---:|---:|
|standard peak|114.006ms|113.452ms|
|standard middle|116.672ms|115.629ms|
|low peak|140.077ms|192.490ms|
|low middle|111.098ms|113.426ms|

There are eight samples per normal/single-pass mode per scene, with only four each for hidden/scissor controls. The low-peak series is particularly variable, including roughly100–365ms values across modes. The probe's stdout helper selects the upper middle element for even counts; the table above uses the conventional median directly from raw data and preserves the original log. This diagnostic confirms substantial elapsed rendering work, but does **not** show a consistent single-pass GPU speedup or isolate the cause of the full real-loop regression. Frozen-frame elapsed time, RAF interval and CPU submission time measure different work boundaries. The same two finite snapshots, software rendering and temporal host variation prevent a general GPU-performance conclusion. P1 remains unresolved after this probe.

**Final acceptance scope:** confirmed composition/priority defects and redundant draw submissions are corrected; exact-source formal correctness checks pass; sampled image and safety evidence have the stated limits. Performance target failure and measured4000 deterioration remain outstanding. Physical-device performance, human listening and the other explicitly listed device/continuous-play limits remain unconfirmed. This is a reviewable draft with disclosed failed/unconfirmed acceptance items, not unrestricted completion.
