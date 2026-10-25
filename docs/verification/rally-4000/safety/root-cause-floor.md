# Lower-floor flash diagnosis from saved pixels

The unsafe lower-screen region is a composite of the legacy century floor overlay and moving new additive effects. The controlled no-random capture still exceeds the unchanged spatial threshold. At a concrete failing pixel, four simultaneous loss-wave cues create four identical additive quads and saturate it to white. The evidence does not support changing only `sampleRandomMotion` as a sufficient correction.

## Exact reproduction and pixel measurements

The source is `final-worst-standard/4000-standard-legacy100`:360 actual saved1024×768 PNG frames at60Hz, with source hashes stable during capture. I used the existing unmodified `TurningDetector` and `channels` from `tests/helpers/rallyFlashAnalysis.py`, retaining the.1 linear-luminance hysteresis, opposite-transition pairing, inclusive61-sample1s window and21,824-pixel area threshold. I ran no browser or GPU capture and edited no production source.

The original31,808-pixel result reproduces exactly at frame72, simTime21.2, reference window[x0,y473,width341,height256]. Pixels exceeding three flashes in that window divide as follows:

| Canvas y band | Pixels above3 flashes/second |
|---|---:|
|473–549|3,770|
|550–599|5,564|
|600–649|7,242|
|650–728|15,232|

All coordinates below are the normalized saved1024×768 canvas coordinates. The screenshot and camera projection place y650–740 below the table, on the near-room floor and overlays passing in front of it.

| Pixel | Maximum flashes in inclusive1s | Detected closing frames in the early failing window | Observed luma range |
|---|---:|---|---|
|(160,650)|7|10,17,23,27,33,48,53|.168–1.000|
|(200,650)|6|18,23,33,42,51,54|.154–1.000|
|(64,700)|6|12,18,22,25,40,54|.186–1.000|
|(96,700)|5|15,23,28,40,54|.176–1.000|
|(896,740)|6|13,19,23,29,57,72|.156–1.000|

`root-cause-floor.json` retains all90 grid-point measurements and selected complete360-frame RGB/luminance/closing traces. The whole frame has maximum10 counted flashes at frame72; the full six-second capture previously measured a maximum11. These are hysteresis detector counts, not a claim of a single sinusoidal flicker frequency. The saved luminance plot shows several qualifying peaks between the century palette switches at.3s intervals; a smooth underlying motion or a nominal1.67Hz palette cycle alone does not describe the rendered composite.

## Geometry correlation and a concrete source of white peaks

The captured `celebrations.ts` draws the century environment as24 colored floor stripes at y=-.792, with alpha.9. The ordinary self floor is y=-.8, so the century layer lies in front of it. Its palette switches rainbow/gold every.3s. At frame72 the visible broad lower-floor stripes are this overlay. The ownRandom vertex gradient is underneath it.

I reconstructed the captured source's geometry on the CPU and raycast the actual fixed1024×768 camera at10 diagnostic coordinates across30 selected frames. The capture's runId is inferred as `run-3` from the fresh-page call sequence; the browser agent independently confirmed that sequence for its controlled ablations. No WebGL renderer was constructed. `root-cause-floor-geometry.json` retains ray intersections, world positions, vertex RGBA, depth flags, material blending and draw order.

For pixel(160,650), the underlying floor ray lands near world[-1.166,-.8,1.133]. At frame27, simTime20.45, the ray intersects **four coincident new `rally-table-lines` loss-wave quads**, each RGBA[.7,.85,1,.45] with additive blending. All four are present because the100-simultaneous-loss stress emits wave cues10,20,30 and40 at the same time, and `lossCue` draws each through `lossWave`. Behind them is the legacy gold floor layer with RGBA[1,.66,.03,.9]. The actual captured pixel is RGB[255,255,255], linear luminance1.0. At frame30 it falls to RGB[235,196,63], luminance.575. At frame48, several new tricolor lines/glow pass the same pixel, producing RGB[255,211,255], luminance.751.

At these sampled lower-floor rays, the high peaks coincide with new rally-world/table geometry. No legacy repdigit table bolt is intersected at the cited(160,650) peak frames. This geometric observation has a finite probe/time scope and is not an all-frame proof that legacy bolts contribute nowhere else.

## Controlled ablation evidence

The browser evidence agent captured each variant in a separate fresh browser/page with the same call sequence/runId/seed and unchanged production hashes. All variant captures report `sourceStable:true`; these are diagnostic scenes, not acceptance captures.

| Scene | Max pixel count | Max area above3/second | Large closing frames/second | Result |
|---|---:|---:|---:|---|
|Original fix1|11|31,808|5|Flagged|
|Random presentation phase removed|11|27,761|5|Flagged; spatial limit still exceeded|
|All legacy celebrations removed|8|15,545|4|Flagged by existing closing-frame rule; spatial area below limit|
|Only repdigit edge electricity removed|10|28,527|5|Flagged; peak frame72 at window[0,479]|

The independent pixel checks agree. At(160,650), original/no-random/no-legacy counts are7/7/5. At(64,700) they are6/4/6. Thus randomization contributes at some locations but does not account for the failure alone. Removing legacy celebrations materially reduces the large-area problem while leaving fast new-effect crossings at individual pixels and a remaining aggregate flag. The all-legacy ablation removes century colors, repdigit bolts and old numbers together, so it cannot by itself assign their separate contributions. The additional repdigit-only-off ablation retains28,527high-frequency pixels and5large closing frames/second; it confirms that the remaining repdigit edge electricity is not the sole cause. The browser agent confirmed actual `run-3` for that capture.

The actionable cause established here is overlapping additive loss-wave rendering plus other new-effect crossings over a rapidly changing legacy century background. A correction should address that composite and preserve the original detector/assertions. This report does not claim a verified safe correction; the resulting full scene must be captured and screened again at the unchanged limits.

## Evidence files

- `root-cause-floor.json`: original pixel traces, detector statistics and controlled variant probe comparison.
- `root-cause-floor-luminance.png`: three lower-floor traces with all detected closings and century-switch times.
- `root-cause-floor-context-frame72.png`: actual frame with worst341×256 window and lower-floor probes marked.
- `root-cause-floor-crop-frame72.png` and `root-cause-floor-crop-sequence.png`: actual lower-floor crop and eight-frame temporal strip.
- `root-cause-floor-frequency-mask-frame72.png` and `root-cause-floor-frequency-heatmap-frame72.png`: reproduced detector region/count map.
- `root-cause-floor-geometry.json`: CPU camera/geometry correlation; reconstructed capture state rather than a new rendered frame.
- `diagnostic-no-legacy/summary.json`, `diagnostic-no-random/summary.json` and `diagnostic-no-repdigit/summary.json`: full controlled-variant screening metrics from the browser evidence agent.

This remains60Hz SDR/sRGB canvas screening of a conservative synthetic overlap scene. It does not certify display hardware, HDR or human visual safety. No threshold, assertion, source effect or gameplay behavior was changed by this investigation.
