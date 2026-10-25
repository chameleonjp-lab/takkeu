# Rally 4000 audio verification

## Implementation

- `src/audio/tones.ts`: generated 1000 rising brass fanfare (2.2 s), 3000 suspended bell blessing (2.6 s), and 4000 descending pickup/expanded resolution (2.8 s), using the existing bounded oscillator/shaper synthesis path. No external audio media or simulation random generator is used. These replace the ordinary phrase only at their exact three scores. 2000 and other positive multiples of 100 retain the existing 1.8 s phrase.
- Best crossing success is a 0.6 s rising chime, once per run. `consumeAchievement({kind:'best-record'|'loss-impact', id, runId, time})` consumes confirmed presentation facts, independently from score. The controller owns the nonzero initial-best crossing and rolling loss-window conditions; the audio consumer owns once-only best, current-run/time/id deduplication and silence lifecycle.
- Rolling four-or-more losses within two simulation seconds receive a 0.24 s low sine/triangle impact. Later qualifying losses can produce their own confirmed impacts. Impact voices use the regular bus and remain separate from contact-hit voices, so a confirmed final loss impact survives same-time game-over and finishes naturally; ordinary contact sounds still stop immediately. Warning priority and the voice/headroom bounds also apply to impacts.
- Existing player, opponent, smash-success and smash-warning synthesis stays intact. All sounds share user volume/mute, quality, interruption, suspend/reset/dispose, and conservative peak headroom. Muted, zero-volume or paused achievements are consumed without later replay.
- A separate fanfare gain bus ducks to 20% over 15 ms, holds through the warning plus 25 ms, then returns smoothly over 175 ms. Repeated warnings continue from the current gain. The fallback without `cancelAndHoldAtTime` computes the current envelope level before replacing automation. Reset/mute/suspend clear the automation.
- Warnings have priority over new hits and fanfares. At saturation a warning retires a hit first, or another eligible voice including a fanfare when all voices are fanfares. A later fanfare cannot steal an active warning. Live voices stay at the configured cap (maximum 8), with at most the same number of 8 ms retiring tails. All tails count in the master gain bound.

## Unit/type verification

| Check | Evidence | Outcome |
| --- | --- | --- |
| New dedicated/best/impact/warning behavior before implementation | `logs/audio-red.log` | RED: 12 expected failures |
| Warning preservation, reset automation, fallback continuity | `logs/audio-priority-reset-red.log` | RED: 3 expected failures, 12 passed |
| Focused audio suite | `logs/audio-focused-green.log` | GREEN: 67/67, including 15 new tests |
| Final-loss impact survives same-time game over | `logs/audio-final-loss-red.log`, `logs/audio-final-loss-green.log` | RED: 1 expected failure; GREEN: 68/68 focused tests, including 16 new tests |
| TypeScript | `logs/audio-typecheck.log` | Passed at recorded run |
| Complete unit suite during parallel implementation | `logs/audio-all-unit.log` | 867/869 passed; two non-audio failures below |

The complete run observed `rally-notice.test.ts > finishes the remaining gold rays on the drawing clock after game over` and `release-revision.test.ts > 公開の照合は完全SHA・main選択・checkout・最新mainの全一致だけを許す` failing while other agents were editing/integrating. Both were reported to the root agent. This report does not present that run as a clean full suite.

Legacy tests had to change their explicit contract that a fanfare could suppress every warning at voice limit 1. The replacement assertions require each warning to create its rising warning sound, retain fanfare protection against ordinary contacts where capacity permits, and enforce the existing bounds. Silent graph-count assertions increase from 2 to 3 nodes because of the dedicated gain bus. The pre-update failures are retained in `logs/audio-regression-before-update.log`.

## Native offline waveform verification

The portable `audio/probe.mjs` uses native OfflineAudioContext through the production audio consumer, graph, volume and voice manager. Each engine renders 70 combinations: 44.1/48 kHz; 1000/3000/4000; standard/low/quiet/muted/zero/fallback; warning overlap; saturated fanfares with/without a warning; a control with identical warning retirement and duck automation but disconnected warning sources; isolated warning; and best/impact sounds.

The paired warning residual compares the audible warning render with the same fanfare duck/preemption graph whose warning sources are disconnected. It therefore measures warning energy independently from the intentional reduction of the fanfare. This is waveform evidence, not a human audibility verdict.


Final native verdict: **140/140 renders passed** (70 Chromium + 70 WebKit). Maximum peak was `0.322451234` against the `<0.8` bound. Maximum allocated voices including fading tails was `16`; every run disposed all native nodes. Saturated-warning paired residual RMS was `0.007554–0.007819` (minimum required by probe: `0.001`). All 12 quiet/standard RMS ratios matched `0.2/0.65 = 0.3076923` within `0.00001`; muted/zero-volume renders were exactly zero.

Results and final status are recorded in `audio/summary.json`, `audio/chromium-measurements.json`, `audio/webkit-measurements.json` and `logs/audio-offline-final.log`. Selected 48 kHz mono 16-bit WAVs are retained for each dedicated phrase, warning overlap, saturated warning, best, and impact.

Reproduce with a local Vite server on port 4181, then run:

```sh
PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 \
PLAYWRIGHT_BROWSERS_PATH=/workspace/pw-browsers \
LD_LIBRARY_PATH=/workspace/pw-deps/usr/lib/x86_64-linux-gnu \
node docs/verification/rally-4000/audio/probe.mjs
```

`AUDIO_PROBE_URL` can select another local test server. This environment required workspace-cached browser libraries. Playwright's `ldconfig -p` precheck ignores `LD_LIBRARY_PATH`, so its cache-only validation was bypassed after the actual cached libraries were available; native synthesis still ran. Sandbox/dependency failures are retained separately in `logs/audio-offline-sandbox-failure.log`, `logs/audio-offline-dependency-failure.log`, and `logs/audio-offline-ldconfig-failure.log`. An initial uninstrumented probe was stopped after waiting without progress output; the saved probe adds per-render progress and an offline-suspension timeout.

## Final-loss impact regression

The app dispatches confirmed achievement cues before raw game events. The former `hit` priority caused the loss-100 impact to be immediately disconnected by the following same-time `game-over`. A distinct `impact` voice priority preserves only this short finishing cue alongside fanfares at game-over, while contacts still stop. Impacts remain eligible for ordinary retirement, never replace warnings, use the regular bus, and end/release within 0.24 s.

`audio/ending-impact-probe.mjs` renders only the added ending case and an ordinary-impact control in Chromium and WebKit at 48 kHz. It checks a nonzero impact, bounded peak, silence after 0.25 s, disposal, and sample-by-sample agreement with the ordinary control within `0.000001`. Both engines passed: peak `0.027511094`, impact RMS `0.007480430`, silence after 0.25 s `<0.00001`, and zero nodes after disposal. Maximum sample difference was `6.30e-8` (Chromium) and `1.32e-24` (WebKit). Results are in `audio/ending-impact-summary.json`, `logs/audio-final-loss-native.log`, and two additional `*-ending-impact.wav` files. The original 140-render matrix was not repeated for this narrow priority change. An initial probe page navigated during Vite live reload; that failure is retained in `logs/audio-final-loss-native-navigation-failure.log`; the probe now blocks the Vite live-reload client.

## Separate verdicts

- Implementation and focused automatic verification: confirmed by the files/logs above.
- Native offline signal, headroom and cleanup: use the final summary and log values.
- Human actual listening: **UNCONFIRMED**. Generated WAVs were not played back to or judged by a person in this session. Waveform checks do not establish perceived quality, relative loudness or recognition.
- Real iPhone/Android hardware, speakers/headphones and physical-device interruption behavior: **UNCONFIRMED**. Desktop Linux browser engines are not real-device evidence.
