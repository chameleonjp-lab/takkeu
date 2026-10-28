# Independent adversarial release review — 2026-10-28

Reviewed the uncommitted emergency release change on `fix/manual-pages-db-gate`, based on `15df010f950b1ca8a1f803d523e3a9aee086396a`. Review scope: Pages/CI workflows, `scripts/release/`, release guard tests, offline contract construction, and the migration application plan. This reviewer changed only this report. No production query, SQL write, publishing action, remote workflow change, branch change, or game-source edit was performed by this reviewer.

The workflow has useful independent safeguards: owner-only affirmative manual dispatch bound to a complete SHA, validation of current main and successful push CI, reusable CI and root/Pages distribution checks, a same-run Pages artifact, serialization, and repeated checks after entering the deployment environment. Database commands use a read-only transaction, verified TLS, bounded execution, and sanitized failures. Existing `github-pages` environment branch restriction is not reviewer approval: required reviewers were absent in the supplied incident evidence.

## Findings raised

These findings describe the code first inspected. The implementer is addressing them concurrently; their final status must be based on a subsequent verification, not this initial report.

### Important / P1 — writable credentials can pass the least-privilege gate

Location: [`catalog.sql`](../../scripts/release/catalog.sql), original lines 10–13 and 23.

The reader check inspects table-level write grants only in `public` and `private`, and checks EXECUTE against a fixed subset of write function names. It omits column-level INSERT/UPDATE privileges, migration-history writes, and existing public writer entry points `submit_score` and `submit_score_unverified`. Application-role snapshots also omit column grants.

Reproduced using a disposable PGlite database with a real `release_reader` role that initially passed the gate. Each of the following grants independently leaves `least_privilege = true` and the compared contract unchanged:

```sql
grant update(score) on public.score_runs to release_reader;
grant update on supabase_migrations.schema_migrations to release_reader;
grant execute on function public.submit_score(text,text,integer,text) to release_reader;
grant execute on function public.submit_score_unverified(text,text,integer,text) to release_reader;
```

Granting `UPDATE(score)` on `score_runs` or `SELECT(best_score)` on `game_scores` to `anon` is likewise invisible to the application-role contract. In production the captured `game_scores_select_public` policy permits anon SELECT; a column-level SELECT grant is therefore meaningful even without table-level SELECT permission. RLS remains a separate defense for tables without a matching policy.

The gate transaction itself remains read-only. The defect is accepting credentials with capabilities outside the required reader contract, and claiming an exact permission match while omitting effective column permissions. Extend reader privilege checks to all relevant schemas, effective column and sequence privileges, schema/database creation capabilities, and reachable mutating functions; capture effective column permissions for application roles. Add local database tests for those grants.

### Important / P1 — missing runtime table dependencies are invisible

Location: [`catalog.sql`](../../scripts/release/catalog.sql), original line 24; [`releaseContract.mjs`](../../tests/helpers/releaseContract.mjs).

The initial contract contains eight tables but omits `private.takkeu_progress_v1`, `private.takkeu_progress_signals_v1`, and `private.takkeu_guest_plays_v1`. The captured application functions use these dependencies. For example, `finish_takkeu_play_v2` queries `takkeu_progress_v1`, while `report_takkeu_progress_v1` writes the progress and signal tables.

Reproduced after loading the actual local migration and dependencies in disposable PGlite: obtain the catalog with the limited reader, reset to the local owner, drop `private.takkeu_progress_v1`, and obtain the catalog again. `verifyDatabase(after, before)` accepts the changed database. PL/pgSQL's stored source remains present even though its referenced relation is gone, so checking the function body cannot substitute for checking its tables. The finish/progress path can consequently fail after an approved release.

Add these runtime tables with exact columns, constraints, indexes, RLS, policies, ownership, grants, and triggers to the reviewed baseline/contract. Verify the complete observation with a native PostgreSQL replica as well as mutation tests.

### Important / P2 — malformed or incomplete CI evidence can be accepted

Location: [`guards.mjs`](../../scripts/release/guards.mjs), original lines 19–23.

The initial CI parser checked numeric bounds with coercing comparisons and sorted run IDs without validating them. Direct local calls accepted a missing `total_count`, a nonnumeric `total_count`, `total_count = 2` with one returned run, a run without an ID, and a successful row followed by a pending row with a garbled ID. The last case selected the successful row after a `NaN` sort comparison.

Validate integer count/IDs, complete response length, uniqueness, and required evidence fields before selecting the newest run. The implementer reported adding safe-integer/count/ID validation after receiving this reproduction; independently rerun the negative cases before marking it resolved.

## Verification and limitations

- Initial `node --test tests/release/*.test.mjs` exited successfully and reported three passing file-level tests. The missing CI validation cases above were additional direct reproductions, so that green result did not establish the requested malformed-output coverage.
- Database reproductions used in-memory PGlite with actual migration SQL, a read-only catalog transaction, and a limited role. They tested catalog semantics, not a network connection or TLS to Supabase. Native PostgreSQL/catalog and executable YAML-path tests were still being added by the implementer during this pass.
- Inspected the full deploy/CI workflow and confirmed that the proposed workflow has no push deploy trigger and that publishing requires successful predecessor jobs. The final YAML and runbook need reinspection after concurrent edits.
- No production deployment or successful production DB contract check was attempted. Supplied incident evidence says release run `40604783819` is cancelled, the live version remains `628439f...`, and production lacks the hall migration. These observations were not independently refreshed by this reviewer.
- The local change cannot prevent rerunning an older workflow definition until the fix is merged. Main/DB observations and the GitHub Pages deployment API are also separate operations rather than an atomic lock. Release instructions must preserve these operational limits and distinguish actual reviewer protection from the owner dispatch checkbox.

## Declined to judge

- Approval, timing, runner choice, and execution of a production migration: explicitly outside the authorized work; reviewed only the written application/recovery plan.
- Actual GitHub environment protection and production schema changes after supplied evidence: this review used local files and supplied observations only.
- Live gameplay, real-device/audio/accessibility acceptance, and post-publication behavior: no gameplay source changes or production publication were authorized.

## Assessment at the initial review checkpoint

**Ready to merge: with fixes.** The workflow design substantially narrows publishing authority, but an exact fail-closed release claim requires closing the reproduced database and CI evidence gaps and running the final native/YAML regression checks. This report is not production migration or deployment approval.


## Implementer follow-through (not a second independent review)

All three findings were reproduced and addressed. CI metadata now requires safe integer counts/IDs, full response length, unique IDs and valid per-run fields. The catalog includes progress/guest dependencies and column ACLs; the reader rejects table/column/history/sequence/MAINTAIN/CREATE privileges, other-role membership (including NOINHERIT), and any reachable non-system VOLATILE non-trigger function. Native PostgreSQL17 verifies a complete least-privilege snapshot and rejects each negative grant/dependency/timeout case (22 cases total). The exact 11-table/22-function contract matches the no-data production-schema replica after the local migration. Ten executable release tests cover graph and gate conditions; actionlint passes.

Evidence: `evidence/native-db-gates.json`, `evidence/release-guards-final.log`, `evidence/review-ci-malformed-red.log`. The reviewer did not independently rerun the final implementation. Production remains unapplied and no public release was attempted. Existing PUBLIC-executable volatile functions are an explicit blocker to provisioning a genuinely least-privilege production reader until separately reviewed; no grant changes were made to production.
