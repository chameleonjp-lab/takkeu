# Independent whole-branch review

Reviewed source HEAD `efed2fedbeed56ca8873395616c8178e03d52806` against base `3e7ceba208200db931af645fdae1ccb271f4a7b7`, plus the then-current uncommitted browser-test/evidence changes. Read the plan and work ledger. This is a source review with targeted, read-only Node reproductions; no browser or performance suite was run, and no source/test file was modified. Existing 250-unit-test success is reported by the implementation ledger, not independently rerun here.

## Findings

### Important — release followed by same-time recontact can erase a valid drag-end hit

Location: `src/game/simulation.ts:196` and `src/game/simulation.ts:202` (deferral at `src/game/simulation.ts:92`).

Advancing to a release sample defers contact at that exact boundary. The release branch only updates `target`; it does not settle the overlap. A subsequent `place` at the same timestamp therefore teleports the paddle away before the preceding drag's valid endpoint contact is processed. The exact same drag/release scores without recontact and fails to score with recontact. This violates accepted input order and can cost a rally despite a valid contact before the new placement.

Confirmed reproduction using `tests/helpers/scenarios.ts`: create `scenario(0, 1.99)` with `incoming(1, 2, {x:0,y:.5}, 1.99, 2)` and initial paddle `{x:-.7,y:.5}`. Set `t=1.994`; project that ball at `t` with `projectBall(sampleReturn(..., t), config)` and choose the tangent paddle target `{x:projected.x-config.paddleRadius-projected.radius,y:projected.y}`. The target is `(-0.1700741743205548, 0.5057733831029845)`.

- Samples `move@1.99(target), release@1.994(target)` emit exactly one `player-hit@1.994`.
- Appending `place@1.994({x:.7,y:.85})` emits no hit at all.

Settle the prior accepted movement/release endpoint in sequence before a later same-time placement can replace it, while retaining the intended bounce-before-placement ordering. Add the regression with both the single-ball case and another ball sharing the boundary.

### Important — actual controller connection retimes delivered-late input instead of rejecting its committed timestamp

Location: `src/app/controls.ts:13`, `src/app/controls.ts:15`, and `src/app/loop.ts:42`; the intended rejection is in `src/input/timeline.ts:9`.

`beforeInput` flushes using the DOM event timestamp, but `advance` clamps an old timestamp to `lastSimulation`. `toSimTime` then also clamps the negative timestamp difference to zero. Thus a sample from an already-committed interval is converted into a current-time sample before it reaches the timeline, bypassing the newly added stale-sample rejection. A delayed old movement can move the paddle through the current ball and score at a time unrelated to the original input. This also makes outcome depend on delivery order when a delayed sample arrives after more recent input.

Confirmed read-only reproduction: create the real session, timeline, and loop, start, `resetClock(0)`, then `frame(100)`. The committed simulation time is `0.09999999999999999`. Calling `flushInput(5)` followed by `toSimTime(5)` returns `0.10000000000000002`, so a 5 ms event is eligible for the next tick instead of being identified as committed. The current late-input unit test checks only that the clock does not rewind; it never enqueues the delayed event through controls.

Preserve sufficient wall/simulation timing information to distinguish committed old input from the current uncommitted remainder, and verify this through `createControls`, including delayed move, release, and recontact. If current-time retiming is intentionally the product policy, document it explicitly: it is not the committed-timestamp rejection described in the implementation plan and current timeline tests.

### Minor — a zero-duration swept hit places its firework at the drag endpoint

Location: `src/game/simulation.ts:105` (consumed by `src/render/particles.ts:42`).

Same-timestamp move/release preserves the swept path and correctly finds a hit fraction, but that fraction is discarded when constructing the action. When processing the hit, `dt === 0` forces `at=1`, so the effect position is the final paddle target rather than the paddle centre at contact. This becomes a visible misplaced racket firework at score 520 and above.

Confirmed reproduction: `scenario(519,1.99)` with the same incoming ball as above, paddle clamped from `(-.7,.5)`, then `move@1.99({x:.7,y:.5}), release@1.99({x:.7,y:.5})`. The projected ball centre is `(0.004511738686628075,0.5095208872933317)`, radius `0.05244193209871892`, but the resulting `racket-firework` origin is `(.7,.5,1.95)`—well outside visible contact. Retain the sweep fraction or computed contact paddle centre in the queued hit action.

## Other reviewed behavior and limits

No additional concrete source defect was identified in secondary-pointer cancellation, normal capture release, ownership retention while another finger remains down, two-touch timing/displacement checks, resize coalescing, idempotent pause, explicit recovery/resume, camera-ray mapping, or the pause dialog's focus/scroll structure. Physical configuration, shared viewpoint, height-dependent reach, and `projectBall` remain unchanged. The uncommitted 12-to-25 ms browser waits and primary-pointer fixture corrections are consistent with the recorded diagnosis; this review does not establish that the corrected browser suite passes.

Short viewport/200% text behavior, actual touch scrolling, WebKit capture ordering, browser performance, device audio, VoiceOver, and flashing-safety acceptance still require their respective recorded runtime evidence. Source inspection alone is not evidence of those outcomes.

## Follow-up review — 2026-10-23

Re-reviewed the uncommitted fixes to `src/game/simulation.ts` and `src/app/loop.ts`, together with the four added unit regression cases. The original findings above are preserved as review history. **All three findings are resolved in the reviewed working tree. No further correctness defect was found in these fixes.**

- Release now executes a zero-time overlap settlement before the next same-time placement. Independent replay of the original tangent fixture emits one hit at `1.994`; the two-ball variant emits hits for IDs 1 and 2 at `1.994`, before the new paddle placement.
- Hit actions retain their sweep fraction. Independent replay of the score-519 zero-duration sweep emits the racket firework at `(-0.16766715854264003, .5, 1.95)`. Its distance from the projected ball centre equals paddle radius plus projected ball radius within `1e-10`.
- `toSimTime` now rejects timestamps older than the current uncommitted remainder instead of retiming them. Independently verified after `frame(20)`: committed simulation time is `0.016666666666666666`; timestamp 10 ms is rejected (`NaN`), delayed timestamp 18 ms retains `0.018000000000000002`, and current timestamp 20 ms retains `0.02`. After resetting the resumed clock at 1000 ms, 999 ms is rejected and 1000/1001 ms map correctly.

Also executed an independent in-memory jsdom reproduction through the actual `createControls` → `createLoop` → timeline → session connection, without modifying any source or test file. It verified that a committed late move cannot change the paddle; a delayed move still inside the uncommitted remainder is preserved; stale release/recontact does not introduce movement; a subsequent fresh down/up works; and a pre-resume down is rejected while a fresh post-resume down/up works. Rejected releases still clear pointer ownership, allowing a fresh contact, which is consistent with stopping input without inventing a movement path.

The implementer reports focused 28/28 and full unit 254/254 success. Those suites were not rerun by this reviewer; the independent Node/jsdom assertions described above passed. No browser/performance run was performed during this follow-up. Runtime acceptance and final commit identification remain with the implementation/evidence workflow.

## Additional fixed-boundary review — 2026-10-23

### Important — `beforeInput` can commit the current event's exact boundary before enqueueing it

Location: `src/app/controls.ts:13` and `src/app/loop.ts:27` / `src/app/loop.ts:50`.

The three earlier fixes remain effective, but a separate exact-boundary case was confirmed through actual controls and loop. If the DOM event timestamp falls exactly on the next fixed boundary, its own `beforeInput` call advances and commits that entire tick using the old paddle, before `onTarget` enqueues the event. A bounce/contact or loss at that endpoint therefore wins over the input even though the endpoint was uncommitted when the handler started. The simulation's intended boundary order is consequently bypassed in the actual app connection.

Independent read-only reproduction: start at `1.44 - config.fixedDt`, with the normal two-second incoming flight arriving at time 2 and bouncing at `1.44`. Place the old paddle at the projected bounce position `(0.1460582218725413, 0.5841266719118804)`. Reset the loop wall clock at zero. Before any RAF, dispatch a primary `pointerdown` whose timestamp is `config.fixedDt * 1000` and whose mapped target is `(.7,.85)`.

- Passing `place@1.44` into the domain tick directly emits only `table-bounce@1.44`, keeps score 0, and moves the paddle away.
- Sending the same input through real controls/loop emits `table-bounce@1.44` then `player-hit@1.44`, raises score to 1, and leaves the old paddle until the next tick. This all happens during `beforeInput`, before the first RAF.

This is more than the unavoidable case where a RAF had already committed the timestamp before the event was delivered: the handler itself creates the conflicting commitment. It is worth fixing rather than declaring all exact-boundary events post-commit by definition.

Minimal approach: make input-triggered flushing endpoint-exclusive while leaving ordinary `frame()` advancement inclusive. Consume all complete ticks strictly before the event timestamp, but retain the final full tick in the accumulator when its endpoint equals the event timestamp. The existing timestamp mapping then returns the event's proper boundary; enqueue it and let the next inclusive frame advance process bounce → ordered input → overlap/loss within that still-uncommitted tick. This keeps the input out of earlier simulation time, preserves the existing step budget, and introduces at most the already permitted wait for the next simulation/render opportunity.

An in-memory prototype of that change (no file writes) adds an optional preserve-endpoint flag to `advance`, breaks the loop when that flag is set and `accumulator <= fixedDt + 1e-10`, and enables the flag only for `flushInput`. The independent controls/jsdom reproduction then produces score 0, the new paddle target, and only the bounce, matching the domain result. This is a focused feasibility check, not a substitute for implementation regression coverage.

If a RAF really has already committed boundary `t` before input delivery, do not rewind it. Document that an event accepted exactly at the committed boundary takes effect at the start of the next uncommitted interval, while timestamps strictly before that boundary remain rejected. Regression coverage should distinguish handler-before-RAF and RAF-before-handler, include same-time down/move/up/recontact, and preserve the delayed-uncommitted-input checks above. No product source or tests were edited by this reviewer.

## Fixed-boundary fix follow-up — 2026-10-23

Reviewed the actual uncommitted `src/app/loop.ts` change and new `tests/unit/input-boundary.test.ts` in the isolated `/workspace/takkeu-boundary` worktree. **The fixed-boundary finding is resolved in that reviewed worktree.** At review time the main `/workspace/takkeu` browser run still used its earlier source; this result does not describe that older browser-tested source or establish integration into it.

The implementation enables `preserveInputEndpoint` only for input-triggered advancement. Normal RAF advancement stays inclusive. The two new controls-level regression cases test both old-position-only overlap and new-position-only overlap at the bounce boundary; their assertions check that the handler emits no premature event and the subsequent frame uses the intended paddle position.

Independently executed read-only Node/jsdom checks against the worktree's actual modules:

- Handler-before-RAF, old position overlaps: score 0 and bounce only after moving away at the boundary.
- Handler-before-RAF, new position overlaps: bounce followed by one hit, score 1.
- RAF-before-handler, both placement directions: no prior event is reversed; accepted input applies at the next uncommitted interval start, and only one hit is emitted.
- Actual down → move → boundary release → same-time recontact: the earlier tangent hit remains exactly at `1.994` and the final paddle is the new placement.

All independent assertions passed. No additional defect was found in the change. Preserve the documented distinction between an uncommitted endpoint and a boundary already committed by RAF, and carry the regression file with the loop change when integrating. The implementer reports 12 focused tests passing; this reviewer did not rerun the suite or any browser/performance check. Only this review document was written.

## Independent CI-condition review — d47753586136db8c4c20dd3a87bb89e912fb9f31

Scope: reviewed `01768ab..d477535` changes to `.github/workflows/ci.yml`, `tests/browser/quality.spec.ts`, and `tests/browser/extended.spec.ts`; inspected retained CI logs, raw trace archives, local rerun logs, the viewport comparison, and performance records. This is an independent technical assessment, not an approval on the user's behalf. No product/test source was edited and no GPU workload was executed. The only executed Playwright commands were six `--list --reporter=list` discovery commands.

**Assessment:** splitting the functional tests across fresh engine/suite jobs is justified. The bounded 360-second completion allowance for these three clock-controlled functional tests has concrete supporting evidence and does not change their gameplay assertions or the separately stated real-time performance criterion. It must still be disclosed as an increased wall-clock watchdog, not described as unchanged verification conditions or as a performance fix. No new critical/important code or CI-gate defect was identified in this change. The documentation/attribution corrections below remain necessary for accurate reporting.

### Evidence supporting the change

1. The original failures are retained, not converted into historical passes. The `01768ab` Chromium job log records 41 passes, three test timeouts (180/180/240 seconds), then workflow cancellation at the 20-minute job limit. Earlier `2c3d95d` JSON records Chromium 42 passed / 2 failed and WebKit 44 passed / 0 failed. These are materially different outcomes and should remain attributed to their exact revisions/environments.
2. Independently inspected the raw `139f972` trace ZIPs, rather than relying solely on summaries. The cadence test has screenshot API calls lasting about 48.0, 59.0, and 63.9 seconds. The 555 test has a screenshot API call lasting about 46.4 seconds; its test trace reaches the final home-navigation/resource assertion before context cleanup. These observations show that end-to-end functional test completion and capture/cleanup can consume a substantial wall-time budget after substantial or complete domain progress.
3. The retained local `01768ab` rerun reports both cadence and 450 tests passing in both engines with the previous 180-second settings: Chromium about 2.5/2.3 minutes, WebKit 45.6 seconds/1.0 minute. This supports an environment-sensitive completion problem; it does not prove the CI environment has no product performance limitation.
4. The measured desktop canvas area changes from 26.993% to 100% at 1280×720, approximately 3.70 times as many pixels at the same DPR. This is a workload-size observation. It is not a measured 3.70× execution-cost model or a GPU profile proving the sole cause of the stalls.

The evidence therefore supports additional finite time for functional execution/capture on this setup. It does not establish 360 seconds as a universally sufficient limit, nor justify repeatedly raising it until a run passes. Success at the new settings must be recorded separately from previous-condition failures and from real-time performance acceptance.

### Coverage, failure propagation, and unchanged checks

Independent fresh discovery using the exact workflow grep expression produced:

| Engine | All | Interaction | Load | Duplicates | Omitted | Extra |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Chromium | 44 | 41 | 3 | 0 | 0 | 0 |
| WebKit | 44 | 41 | 3 | 0 | 0 | 0 |

The grep and its inverse partition the complete suite; neither branch excludes the other group's tests from the overall workflow. The four matrix jobs run on separate hosted runners, retain one worker each, and use `fail-fast: false`. Test output piping retains `pipefail`. No retry, skip, reduced viewport/DPR, reduced simulated duration, changed score/resource assertion, or silent error suppression was added. The source diff confirms the only executable test-body changes in this commit are the three `setTimeout` values. `src`, the performance tests, and the performance configuration have no changes from `139f972` through the reviewed HEAD.

The original `verify` job name is now an aggregate with `needs: [core, browser]` and `if: always()`. Both dependency results must equal `success`. A failed, skipped, or cancelled dependency cannot make this script succeed, so the browser work is not bypassed by a green core job. Source inspection cannot establish the repository's remotely configured branch-protection rules, but the workflow restores the intended aggregate check semantics. List discovery establishes selection coverage, not runtime completion; the eventual matrix results still need checking.

### Reporting corrections and remaining limits

- **Minor — stale timeout wording:** the evidence README's line 53 says test conditions/timeouts are maintained, and the quality-file header still refers to the "unchanged 180s limit" / "limits stay put." These can describe earlier revisions only. The current summary must explicitly say cadence/450 changed 180→360 seconds and 555 changed 240→360 seconds, identify this revision, explain the reason, and retain the original failures. The implementer has acknowledged this correction; it was not yet independently verified as a final documentation commit during this review.
- **Minor — distinguish observation from causal inference:** the traces directly establish waits in screenshot, evaluate/clock, and teardown APIs. They do not isolate time inside GPU readback or exclude product-side rendering cost. Replace categorical "GPU readback caused it" wording with the observed API waits and the supported inference of increased full-viewport software-rendering/capture cost. Avoid claiming that all failures occurred only after every assertion: the `01768ab` cadence failure is explicitly at a snapshot evaluation in its loop.
- The three `test.setTimeout(360_000)` calls are unconditional. They change these functional-test completion budgets locally as well as in CI and in both engines. Describing this as a CI-motivated change is accurate; describing the new timeout as applying only on CI is not. It also delays detection of a real hang, an explicit tradeoff of the larger finite watchdog.
- Three 360-second load tests can consume 18 minutes before dependency installation and cleanup overhead. The unchanged 20-minute job cap may still cancel a pathological run. This is a remaining reliability/budget risk, not a false-green path; judge it from the actual matrix result rather than assuming isolation guarantees success.

Finally, independently recalculated the performance verdicts from the retained eight raw records: **0/8 meet the stated continuous-running plus 95%-within-25-ms target**. Chromium low/450 has only 0.1833 game seconds and ends paused for slow-frame, so its apparently favorable 100% running-only interval percentage is not a pass. The other seven records also fail the timing target. The performance report correctly retains these failures and does not claim an old/new controlled comparison or real-device acceptance. A green functional CI result under the new watchdog cannot supersede this outstanding performance result.
