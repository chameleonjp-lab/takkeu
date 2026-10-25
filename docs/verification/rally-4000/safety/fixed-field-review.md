# Additional fixed-field diagnostic — 1500 standard/low

This diagnosis adds `tests/helpers/rallyFixedFieldAnalysis.py`. It does **not** edit or replace `rallyFlashAnalysis.py`, change any threshold, alter captured content, or clear the original flags. Both original 1500 analyses remain `flagged:true`.

## Method and validation

The new script imports the original `channels` and `TurningDetector`, including its red-axis union. For each frame it computes exact closing-mask areas at **every** 341×256 window position in the actual 1024×768 image using integral sums. At each fixed position it records whether area is strictly greater than 21,824 (25%) and sums **every such frame** over the same inclusive 61-sample one-second window. It does not group consecutive frames, take rising edges, merge peaks, change .1 luminance or red thresholds, or apply numerical tolerance. The maximum is taken only after each position's temporal count has been computed.

Four self-tests passed in `fixed-field-self-test.log`: two sufficiently separated 2Hz patches have fixed count <=3 but global count >3; a 6Hz same-position patch remains flagged; four sufficiently large patches inside one reference field remain flagged; integral-area results equal brute-force sums at every position. Tests scale the reference rectangle proportionally for their small synthetic images.

All 360 raw frames from each retained `final-regular/1500-{standard,low}` capture were analyzed. Each result's combined RGB24 SHA256 equals the original analysis hash, and the independently recomputed global counters equal the original global counters. These checks establish that the different diagnostic result is due to retaining spatial identity, not different frames or changed transition detection. The script records the original analyzer's source SHA256. This is CPU-only work; no browser/GPU or production source was changed.

## Results

| Capture | Original global general closing-frame maximum | Maximum at any fixed field | Fixed-field witness | Red fixed/global | Original >3 pixel-frequency area | Original primary flag |
|---|---:|---:|---|---|---:|---|
| 1500 standard | 7 | **2** | [301,0], end frame84, closings48/84 | 0 / 0 | 9,207 < 21,824 | **true, preserved** |
| 1500 low | 4 | **2** | [91,24], end frame122, closings121/122 | 0 / 0 | 7,616 < 21,824 | **true, preserved** |

Low's consecutive closing frames 121 and 122 were counted separately. No temporal grouping was used to reduce its result. Standard's witness one-second interval contains global events48/49/54/80/83/84, but no fixed window anywhere reaches three, let alone four; its overall global maximum7 occurs elsewhere in the sequence. Witness positions are the earliest row-major location attaining the overall fixed maximum, not a claim of unique maximum location.

Results: `fixed-field-1500-standard.json`, `fixed-field-1500-low.json`. Complete execution log: `fixed-field-analysis.log`.

## Interpretation against the cited criterion

Source: [W3C Understanding SC 2.3.1](https://www.w3.org/WAI/WCAG21/Understanding/three-flashes-or-below-threshold.html), also retained locally in `wcag-three-flashes-source.txt`.

The field/area wording is:

> the combined area of flashes occurring concurrently occupies no more than a total of .006 steradians within any 10 degree visual field on the screen (25% of any 10 degree visual field on the screen) at typical viewing distance

Its reference-window note says:

> For general software or web content, using a 341 x 256 pixel rectangle anywhere on the displayed screen area when the content is viewed at 1024 x 768 pixels will provide a good estimate of a 10 degree visual field

The diagnostic establishes a narrow but useful result: **the original auxiliary global count of7/4 cannot occur at any single fixed reference-window position using the same saved closing masks**. Combining per-frame maxima from different locations causes these excess global counts. No further production change is justified solely by treating those spatially mixed totals as a demonstrated >3 fixed-field count.

However, **the fixed-field bound is not by itself sufficient to establish normative SC frequency/area compliance**. It counts detector closing instants, rather than determining each flash's full temporal extent or identifying the same component over time. Multiple transitions may overlap in duration while their recorded closing instants differ. The existing per-pixel high-frequency-area result is an additional necessary piece of this screening method, not a replacement for that semantic analysis. Eye movement, actual visual angle/viewing distance, HDR/display output, subframe behavior and CSS outside the canvas are not covered. The imported detector's hysteresis/axis-union approximations and finite sequence boundaries remain unchanged. This is not an accredited PEAT/Harding analysis or a human/device safety assessment.

Keep the original global flag as a conservative investigation result and report this fixed-field diagnosis beside it. A reviewer may explain that the specific global-count exceedance mixes spatial locations, but must not silently convert the original `flagged:true` into a generic safety pass. Broader acceptance remains limited to explicitly described sampled SDR evidence and any remaining independent review/device requirements. The earlier versions' actual pixel-frequency-area failures are unaffected by this result.

## Reproduction

```sh
python3 tests/helpers/rallyFixedFieldAnalysis.py --self-test
python3 tests/helpers/rallyFixedFieldAnalysis.py \
  docs/verification/rally-4000/safety/final-regular/1500-standard \
  docs/verification/rally-4000/safety/final-regular/1500-low \
  --output-directory docs/verification/rally-4000/safety
```

The second command requires the exact raw PNG frames. If those have been losslessly packed, restore them using the recorded video/part manifests and verify their RGB stream hashes; do not substitute sparse representative images. Existing recordings/results and analyzer flags must be retained.

## Final-corpus addendum

The unchanged diagnostic subsequently analyzed all three additional auxiliary-global-only flags in the final 14-sequence corpus. No diagnostic was needed for the other nine scenes: at every position the fixed-field count is necessarily <= the original global any-position count, which is already <=3 in those scenes.

| Additional capture | Original global maximum | Maximum at any fixed field | Fixed-field witness | Red fixed/global | Pixel hash/global-counter agreement |
|---|---:|---:|---|---|---|
| 4000 standard | 5 | **2** | [0,140], end340, closings307/340 | 0 / 0 | both exact |
| 3000 low | 4 | **2** | [668,502], end80, closings79/80 | 0 / 0 | both exact |
| 4000 low | 5 | **1** | [473,245], end54, closing54 | 0 / 0 | both exact |

Results are `fixed-field-4000-standard.json`, `fixed-field-3000-low.json`, `fixed-field-4000-low.json`; complete log is `fixed-field-additional-analysis.log`. As in the initial diagnostic, consecutive frames79/80 count separately. Original flags are preserved in every JSON. There was no algorithm, threshold or production-code change between the five diagnostic runs.

The final primary index (`final-primary-index.json`) records 14 scenes / 5,040 frames from matching final production display sources. All general high-frequency areas are below21,824; all red high-frequency areas are0. Five scenes retain the auxiliary global flags. Across those five, the exact fixed-field maxima are2,2,2,2,1, explaining the global exceedances as spatial mixing under the existing closing-mask definition. There is **no remaining fixed-field closing-frame exceedance** in this diagnostic. There is also **no claimed universal or accredited safety pass**: the normative, temporal-event, device/HDR and CSS limitations above remain. This addendum resolves the specific unexplained aggregate-count discrepancy, not those broader limits.
