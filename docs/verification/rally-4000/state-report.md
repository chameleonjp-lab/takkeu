# Pure event state and exact loss positions

Implemented in `src/game/rallyEffects.ts`, with tests in `tests/unit/rally-effects.test.ts` and `tests/unit/loss-position.test.ts`. The only existing gameplay edits are the optional `GameEvent.lossCount` fact in `src/game/types.ts` and the `ball-lost` emitter in `src/game/simulation.ts`. `session.ts` delegates to the simulation and needed no change. Loss coordinates are copied from `sampleReturn(ball.plan, ball.from, confirmedTime)` before the ball is discarded. Score, RNG, collision decisions, phase transitions, trajectory plans and input handling are unchanged.

The controller API is `createRallyEffects(runId, bestAtStart)` → `consume(events)`, `state()`, `endTime()`. Exported `RallyEffectsState` contains the score and cumulative loss watermarks, run-start best and first crossing, resolved permanent stages, all recent hit/loss positions, arrival effects and priority/duration-based UI/audio cue facts. Categories are A permanent, B arrival and C confirmed action. Every requested threshold50…4000 is declared, including loop durations and each replacement. The1000 green/blue world persists after arrival and integrates into the1500 tricolor network; the4000 final world persists after arrival;4001+ continues updating the score.

Normal notices use5-rally cadence through49,10 through199 and100 through4000, excluding the four major notices. Major notices last2.5s, normal1.8s and best2s. A nonzero initial best triggers once. Each loss has a.5s spark; the impact count uses a true rolling inclusive2s window rather than a chained pairwise streak. The10/20/30/40 wave,50 net,55/77/88 number halo,90–99 warning arrival,99 gold and100 final facts are separately retained. Warning posts can use persistent `lostBallCount`90–99 independently of the short arrival cue.

## Verification

- `logs/state-red.log`: initial missing-controller and missing loss-fact failures, retained in full.
- `logs/state-green-initial.log`: initial34 focused tests passed.
- `logs/state-red-replay.log`: stronger replay test found that an old score/loss with a changed timestamp could incorrectly prune active facts. Fixed by rejecting duplicate score/loss watermarks before advancing the presentation clock.
- `logs/state-green.log`:8 files,82 tests passed, including53 controller/loss-position tests plus session,100-loss limit, celebrations, deterministic replay, simulation isolation and30-ball return regressions.
- `logs/state-typecheck-initial.log`: full typecheck attempted during parallel development; failures were in the concurrent audio API and renderer test code. No failure in the state/event files. `logs/state-typecheck-final.log` rerun passed after those concurrent changes landed.

Boundaries cover all23 rally thresholds before/at/after, every arrival duration boundary, all permanent replacements, record and first-run behavior, same-frame multi-arrivals and30 hit positions, all100 simultaneous loss positions, inclusive2s rolling loss timing, defensive invalid/foreign events, replay with changed IDs, snapshot isolation, post4000 continuation, pause with no confirmed events, and bounded10000-score history.

## Bounds and limits

No event-ID history, timers, wall clock or RNG is used. Hits retain1.5s (cap512), losses2s (cap100), arrivals their own duration (max23), and cues their own duration (cap512). These defensive caps exceed normal30-ball/default-flight concurrency; deliberately malformed batches beyond those caps retain the newest facts. The best crossing persists once per run. Renderer/UI must test age against `snapshot.simTime`; histories are pruned only on confirmed event consumption and never by wall time. Permanent effects and loop periods do not extend finish time. The100th-loss final cue is2s; existing legacy celebration timing remains independent.

This verifies pure state/event behavior and gameplay regression tests. It does not verify actual visual output, sound, frame performance, browser integration, human listening or hardware behavior.

## Actual zero→4001 physical play

`tests/unit/rally-through-play.test.ts` starts `createSimulationState(7)` and `startSimulation(DEFAULT_CONFIG)` at score0 with the normal initial ball. Every fixed tick supplies only the earliest scheduled return's paddle target. No score, ball, trajectory, progression or RNG state is set. A structured clone with the same runId receives identical paddle input and no presentation-controller consumption; every emitted event, final snapshot and final RNG state match.

The recorded run in `through-play.json` took32,014 fixed ticks (266.783333333 simulated seconds), reached4001 with every confirmed score1…4001 exactly once, remained running, lost0 balls and peaked at30. All23 threshold events occurred once, all8 arrival effects occurred once, and all17 permanent stage effects were observed. The largest single-frame score increase was15, so this exercises multi-hit batching through later stages. A60-step pause at1000+ preserved physics and presentation state; replaying the last confirmed events during pause did not duplicate arrivals or best. Final random states both equal1040620194.

The initial run passed. `logs/through-play-red.log` is an explicitly intentional test-only fault injection: the1000 score event was omitted only from controller delivery, and the evidence test correctly failed for its missing1000 arrival. The unmodified test was restored and `logs/through-play-green.log` passed in4.59s total (about3.94s measured replay time). `logs/through-play-typecheck.log` also passed. The test has a120s timeout but normally adds about4–5s to the suite. These logs verify actual deterministic physical progression, distinct from fixture score rendering evidence. They do not establish human playability or device frame performance.


## Declarative integration correction

The1500 replacement list now also removes `green-blue-world`, so only `tricolor-network` remains in that lightning family alongside other unrelated permanent layers. `logs/state-integration-red.log` captures the failing duplicate-family test before this change; `logs/state-integration-green.log` confirms it passes. The2000 entry is categoryA because its star world persists, with its categoryB2.5s arrival represented separately in `state.arrivals` by controller consumption. This is intentional combinedA+B behavior rather than a second duplicate configuration entry.
