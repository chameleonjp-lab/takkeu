# Independent final code review: 3000 goal and Hall

**Reviewed source:** `e2e8379ec649d1c4ee6b780142e024f813e90fb4` against PR baseline `75a36404d1a5fce7f842596293fb47908cdc55a3`, including the integration of main `628439f5907601c9b34ee2ba01f70c918b6e8d18`. Review completed 2026-10-27. This is a code review with explicit pending execution gates, not a claim that the full browser/release/CI suite has completed.

**Verdict:** No Critical or Important production defect found within the reviewed change. One reproduced Minor issue, G01, remains at e2e. Suitable to continue the authorized Draft-only verification and handoff. No merge, deployment or production database application is authorized. Final delivery must distinguish the tested source revisions and complete the pending checks below.

I read the goal design and implementation plan, builder and SQL reviews, the scoped source/test/migration/workflow diff, current implementation, raw local results and certificate images. The unrestricted historical diff initially attempted a missing promisor-object fetch; the scoped source diff was available and the implementer supplied `/workspace/goal-3000-review-source.diff`. I made no product, test, fixture, runner, repository/index/HEAD or production-service changes. Reviewer executions were isolated in-memory SQL checks and a read-only JSDOM reproduction; only this report was written.

## Strengths and challenge results

### Exact goal and protected gameplay

`src/game/simulation.ts:105-145` retains the existing action sort by event time, bounce priority and ball ID. A confirmed hit emits its actual rally score, preserves its normal hit/progression bookkeeping, then sets `gameover`/`clear` at exactly 3000 and breaks the action queue. Competing loss-first and clear-first cases retain that ordering. No preference for a clear was inserted into collision sorting. Further input segments and speed refresh are guarded by the running phase (`:224-250`); subsequent steps return the frozen snapshot and no events (`:213`). The terminal tick still commits its original fixed interval, as before; the clear hit performs its existing outgoing/progression bookkeeping before termination. This is not a claim that every internal operation stops at the score increment instruction.

The tests directly cover 2999 plus 30 simultaneous contacts yielding one hit and one clear, 2969 plus all 30 yielding 2999 while still running, and 2970 plus all 30 yielding exactly 3000. They also cover both terminal event orders, reset, ordinary 2999 failure and 120 subsequent unchanged steps. I read the initial competing-event fixture failure and correction rationale; the correction changes event timing in the fixture, not physics priority.

The goal-specific game diff after the main integration is restricted to config/types/simulation. Fixed dt, maxSteps, slow-frame criteria, difficulty, collision, input and maximum-ball logic are unchanged. The prior four optimized render files are byte-identical to b0b. The seven inherited ranking migrations are identical to main 628; the Hall migration is the new SQL change.

`artifacts/goal-3000/through-play.json` records a real fixed-step simulation from zero: 25,684 ticks, 214.033333 simulated seconds, exactly 3,000 player-hit events, no loss, maximum 30 balls and one clear. Its test also compares the same current simulation with and without consuming presentation events, including RNG equality. This is deterministic simulated input, not human/native pointer play, and its 2.435-second wall duration is not real-time browser or GPU performance. The `baselineRandomState` label means the current simulation without presentation consumption, not execution of the old product revision. The shortened through-play expectation is justified by the new terminal goal; it still verifies every score 1..3000 and explicitly excludes later thresholds.

### Hall contract, legacy compatibility and retries

`src/ranking/client.ts:21-26,78-102` separates legacy and goal contracts. Legacy pending scores retain their original `takkeu-web-ranking-1` identity and up-to-100,000,000 range; missing old loss counts use the original finish route rather than invented zero. Goal results require the new rule marker, actual loss count and clear iff score 3000. The ranking manifest keeps the old ranking range, so legacy best scores above 3000 still render. Guest count-only requests deliberately keep the old version and queue. The v2 named-start storage key does not promote an old unresolved start into a new-rule session; that choice is explicit in the ledger. No old score is backfilled into Hall.

`src/ranking/controller.ts:49-67` persists score acknowledgement before Hall registration and retains the same play/submission until Hall acknowledgement or terminal exclusion. A reload after a lost Hall response retries Hall without resubmitting the score. Earlier network failures retain the ordinary idempotent retry path. A permanent rejected record remains diagnostic while later records can continue. `src/ranking/resultHall.ts:15-26` filters play ID, then submission ID and normalized-name ownership. The app sets the current result target before calling finish and clears it on new run/home. Browser and unit cases exercise an old Hall response arriving after a new clear.

The Hall request contains exactly the SQL function's four arguments (`client.ts:121`); the preserved RED exposed the earlier extra `p_game_slug`. Server-returned numbers and timestamps alone populate official certificates. Guest and excluded results have no fabricated number. UI text distinguishes acknowledged score from pending Hall registration, and list content is inserted as text rather than HTML.

### SQL and permissions

`supabase/migrations/20261027032043_takkeu_hall_of_fame.sql:32-86` marks sessions only through the dedicated start and sets verified-clear only after the dedicated finish delegates to existing identity/time-rate/final-loss checks. Generic starts with the new version string cannot be promoted. Registration (`:101-124`) checks rule, verified clear, finished score/loss bounds, the specific accepted score run's play/submission/name/version/score and current moderation status. Aggregate best score alone is insufficient.

The counter row lock precedes lookup/allocation (`:126-131`), and name/number/first-play uniqueness provide structural protection. Same-name retries return the original entry without advancing the counter or rewriting its first date. The bounded list filters current moderation status and exposes no session IDs. RLS and revoked direct client table grants are present (`:19-30`); security-definer RPCs use an empty search path, qualified objects and explicit EXECUTE grants after revoking PUBLIC (`:152-159`). This intentionally preserves the existing public-name/opaque-play-ID API, not account authentication or cryptographic proof of human play.

The original S01 NULL CHECK defect is fixed with `IS NOT DISTINCT FROM` (`:9`), and its RED is preserved. I read `schema-preflight.json`: the saved read-only introspection reports `game_scores.ranking_status` as `is_nullable: NO`, resolving S02 for the recorded schema. I did not issue a production query.

The PostgreSQL 17.11 raw concurrency record shows separate backend PIDs: the same name receives number 1 and the same timestamp; distinct names receive 2 and 3; the counter ends at 4. I read its actual runner, which uses separate transactions/connections and holds locks across a sleep. This proves those two race cases; it does not claim a moderation-update race or an exhaustive concurrency stress test.

I additionally executed isolated PGlite checks, exit 0, without modifying source: anon and authenticated each completed dedicated start/finish/score/Hall calls; Alice and ALICE received separate numbers under existing case-sensitive normalization; generic current-version start → old finish → accepted score was rejected by Hall as `verified_clear_required`; hiding then restoring a name restored its original number; both client roles were denied direct Hall reads and counter writes. These supplement the committed SQL test, not the real separate-backend race evidence. The SQL fixture remains a reduced local schema, not a full production clone.

### Static result, audio and certificate

`src/app/finishPresentation.ts:9` skips animated finish time for clear. `createApp.ts:342-356` renders the phase transition once and then stops ongoing 3D draws, while avoiding immediate suspension of the 3000 fanfare. `audio.ts:116` stops ordinary voices but preserves ending fanfare/impact voices; existing interruption/home/reset paths still stop them. The audio unit and app lifecycle tests cover the final hit/clear delivery and unchanged draw count after waiting. The 44 ordinary result comments remain in their original module and are used for losses; the clear has separate text.

`src/ui/certificate.ts:9-41` generates a 900×1200 PNG only on demand, uses the Hall's original name/date when registered, explicitly formats UTC, fits long text and clears the temporary canvas. Generation completion checks its epoch before installing a URL; changed data/home/dispose revokes the prior URL and makes old generation completion inert (`:57-82,91-96`). The corrected `canShare` exception path preserves a usable PNG/save link. The distinct delayed-share-error issue is G01 below.

I directly viewed the Chromium official certificate, the full WebKit clear-result screenshot and the Chromium long-emoji/excluded-name screenshot. The number 7/name/date are legible, the result shows clear 3000 while retaining a legacy ranking best 4001, and the 20-emoji name fits the certificate. The excluded-name image explicitly lacks a Hall number. These are saved browser images, not a physical-device or accessibility conformance judgment.

## Findings

### Critical

None found.

### Important

No new production defect found. The unfinished verification gates below remain required before representing the final delivery as fully checked.

### Minor — G01: delayed share failure can overwrite a newer result's message

**Location:** `src/ui/certificate.ts:84-87`.

The generation path has an epoch check, but `shareImage()` awaits `navigator.share()` and writes its failure text without checking that the same result/file is still current. Reproduction against unchanged e2e, using Node 24/JSDOM and a deferred mocked share promise: generate and share A; call `controls.set(B)`; reject A's pending share with a non-AbortError. B's initially empty certificate message becomes `共有できませんでした。「画像を保存」か画像の長押しをご利用ください。` from A. A similar late rejection can write after home/dispose. No incorrect PNG, official number or remote submission was observed; impact is stale error text, hence Minor.

**Recommended correction:** capture the current epoch/file before awaiting share, and update the error message only if that ownership is still current. Add a deferred-share rejection case covering a newer result and disposal. Preserve the in-progress e2e verification's source freeze; any later correction needs its own source identity and targeted regression evidence.

## Evidence reviewed and pending execution gates

- e2e final typecheck log is clean; `final-unit.log` records **942/942**. `tested-source-sha.txt` names e2e. At the last source check HEAD remained e2e and the only tracked worktree difference was the plan document.
- `browser-first-results/results.json`: **36 expected, 0 skipped, 0 unexpected, 0 flaky**. Supplemental fallback/ownership green results: **4 expected, 0 skipped, 0 unexpected, 0 flaky**. The earlier `canShare` RED has two actual browser failures and is preserved.
- Full **216-test browser verification was still running** when this report was finalized; its log had progressed through Chromium case 93. No complete full-suite result is asserted. The prior 36+4 are targeted observations, not substitutes for 216.
- Final root/Pages build, release-distribution/debug-exclusion checks and fresh source-linked CI results were not complete evidence supplied to this review. The implementer reports push run `40446563006` and PR run `40446576259` in progress. I do not call either green or infer a tested merge tree.
- Any G01 fix must identify its new source SHA; do not relabel e2e browser/CI evidence as testing changed bytes. Use appropriate fresh checks and retain e2e's completed results as historical evidence.
- The new verification archive, manifest/restoration and final Draft publication were not audited here. Record their exact source/data hashes when completed; do not silently mix these new results into the previous large archive.

## Performance, flash and scope limits

Stopping at 3000 removes later gameplay and continuous post-clear 3D rendering. It does **not** establish improved real-time performance or removal of earlier flash warnings. No new GPU/physical-iPhone performance or canonical flash result was supplied for e2e, and I make none. The existing Linux target and screening thresholds remain unchanged. The prior b0b archive is referenced by manifest SHA-256 `b7be8ecae0d850e4af0e27c12085a8593f1c8c5e99a6dd138e857d2442c6c5a6` and archive SHA-256 `b345e28c6bf7f9ab11371e83a5cbe60258788d80123ac65f7dac504af3f7c9c0`; I did not decode or rehash its multi-gigabyte payload again for this change. Its unresolved pregoal performance/screening limits remain relevant. Byte-identical render files are not a claim of pixel-identical final UI or timing.

## Declined to judge

- Physical iPhone/Safari sound, sharing, native downloads, touch feel, HDR, human flash safety or formal WCAG compliance.
- Full production-schema/trigger equivalence, production migration application, live Hall/ranking behavior or cryptographic authenticity of player claims. No live write or score submission was performed by this review.
- Exhaustive SQL concurrency/moderation races, permanent network/storage failure recovery beyond the inspected contract, and unbounded-duration resource behavior.
- Full browser/release/CI success, final corrected source, archive restoration or remote publication that had not completed at report time.

## Readiness

**Code review complete for e2e, with G01 Minor and no Critical/Important production defect found. Final verification remains pending.** Continue the authorized work, record any corrected source independently, and finish the outstanding checks before making completion claims. Keep PR27 Draft; no merge, deployment or production database application is authorized by this review.
