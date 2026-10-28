# Hall migration: pre-apply review and approval plan

Status: **unapplied; production application is not authorized by this document.** All writes used for this review were in disposable local databases. No production score, session, moderation, schema, migration-history, or permission writes were performed by the reviewer.

Reviewed payload: [`20261027032043_takkeu_hall_of_fame.sql`](../../supabase/migrations/20261027032043_takkeu_hall_of_fame.sql), SHA-256 `b6a9828852e3b87840348814559353dec8b0286d6d6642dee7952b4fe9ef009b`. A change to that payload requires a fresh review and expected-contract snapshot.

## Production evidence

Read-only catalog observations on 2026-10-28 at 00:02:39, 00:04:03, 00:04:58, and 00:06:29 UTC were saved under `/workspace/incident-evidence/` as `connector-initial.json`, `production-catalog.json`, `production-dependencies.json`, and `production-extra.json`. Each SQL result reported `transaction_read_only = on`.

- Migration history has no `20261027032043` entry. The hall v1/v2 RPCs, new hall/counter tables, and new session columns are absent.
- Takkeu uses `submission_mode = shared`, `score_order = desc`, and bounds `0..100000000`. These values must stay unchanged.
- Existing Takkeu aggregate categories were 3068 `normal`, 1 `hidden`, and 3 `provisional_bot`. These are a point-in-time observation, not fixed future totals; normal play can add rows while this plan is awaiting approval.
- The production definitions of `start_game_play_v1`, `normalize_player_name`, `finish_game_play_v1`, and `submit_score_idempotent_v1` match the definitions loaded by the hall test helper after whitespace and a final semicolon are normalized. The current final-loss function and attachment trigger were also inspected.
- Production adds shared verified-game guards that the small hall fixture omits. Their inspected branches pass through Takkeu while it is a shared game; they enforce separate verified-game contracts for other slugs. Existing indexes, RLS, ACLs, and constraints must be preserved.

These observations establish the reviewed starting point. They must be refreshed immediately before an approved apply; they do not authorize applying against a changed or partially migrated database.

## Exact schema and data change

| Change | Count | Objects or effect |
| --- | ---: | --- |
| New public tables | 2 | `takkeu_hall_of_fame`, `takkeu_hall_of_fame_3500` |
| New private tables | 2 | `takkeu_hall_counter_v1`, `takkeu_hall_counter_3500_v1` |
| Added session columns | 2 | Nullable text `takkeu_rules_version`; non-null boolean `takkeu_clear_verified`, default `false` |
| New public functions | 8 | `start_takkeu_clear_play_v1/v2`, `finish_takkeu_clear_play_v1/v2`, `register_takkeu_hall_v1/v2`, `get_takkeu_hall_v1/v2` |
| New private functions | 2 | `enforce_takkeu_3500_result_v1`, `enforce_takkeu_3500_score_v1` |
| New user triggers | 2 | Result guard on `private.game_play_sessions`; score guard on `public.score_runs` |
| New constraints excluding NOT NULL | 21 | Each hall: 1 PK, 2 UNIQUE, 2 FK, 2 CHECK; each counter: 1 PK, 2 CHECK; existing sessions: 1 CHECK |
| New indexes | 8 | Each hall has 3 unique indexes; each counter has 1 PK index |
| New counter rows | 2 | One `singleton = true, next_number = 1` row per ledger |
| New hall rows at apply | 0 | No historical registration or score backfill |
| New sequences | 0 | Transactional counter rows allocate registration numbers |

The four new tables enable RLS and have no row policies. The table declarations add 14 NOT NULL attributes, including PK attributes; the new session boolean adds one more. PostgreSQL 18, including the PGlite test engine, represents NOT NULL constraints in `pg_constraint`; the 21 count deliberately excludes `contype = 'n'` to match PostgreSQL 17 accounting. Foreign-key internal triggers are not included in the two user-trigger count.

Existing session rows acquire logical values `NULL` and `false` in the two new columns. Existing scores, first/best scores, play counts, timestamps, metadata, rankings, and moderation categories are not updated. Shared functions are called by the new wrappers but are not replaced by this migration. The two hall ledgers have independent numbering; neither renumbers or backfills the other.

The new hall foreign keys retain the referenced player name and first-clear session. A later administrative purge of a referenced session or player must account for those references; the migration provides no cascading deletion or archival process.

## Security and compatibility findings

1. **Application must be atomic.** The SQL file contains no transaction wrapper and is intentionally non-idempotent. Existing columns, functions, tables, or triggers cause errors. A runner that commits statements or chunks separately can leave a successful prefix, including functions before their final revokes or triggers. Execute the complete reviewed payload and assertions in one transaction. A single PostgreSQL multi-statement execution can be atomic implicitly, but this plan requires an explicit transaction contract from the chosen runner.
2. **Object ownership and default grants matter.** All ten new functions use `SECURITY DEFINER` and an empty `search_path`; they depend on a trusted owner that can access private tables and bypass their RLS. Public execution is revoked, then the eight API functions explicitly grant EXECUTE to `anon`, `authenticated`, and `service_role`. The two trigger functions revoke execution from PUBLIC, `anon`, and `authenticated`. Both client roles lose all direct privileges on all four new tables.
3. **RLS does not constrain a privileged service role.** The migration does not revoke `service_role` table grants. Observed `postgres` public-table defaults grant `service_role` `Dxtm` (TRUNCATE, REFERENCES, TRIGGER, MAINTAIN), while the observed `supabase_admin` defaults grant it ALL table privileges. Applying as those owners produces different ACLs. TRUNCATE bypasses RLS, and ALL plus a bypass-RLS role permits direct row changes. Explicitly approve the apply owner and exact resulting service-role ACL; do not accept an unexpected ALL grant because the anon tests passed. Keep service-role credentials outside clients. Private-table defaults and effective privileges must also be checked for the actual owner.
4. **Public guest APIs are intentional trust boundaries.** These wrappers preserve the existing name-based session identity. They do not authenticate a unique human. Registration means one stable number per normalized name, not one per person. `takkeu_clear_verified` means the server accepted the versioned finish contract; wall-time limits and client loss reports are not independent proof of gameplay.
5. **The guards are scoped.** The 3500 session guard selects the new rules/client version; legacy sessions and historical scores above 3500 remain valid. The score guard applies to Takkeu rows with a non-null play ID. It is not a universal constraint on arbitrary privileged inserts with a null play ID, nor on other games. Supported public Takkeu submissions must continue through the guarded, idempotent RPC; direct table access remains revoked. A generic finish cannot grant hall eligibility without the verified clear wrapper.
6. **Moderation and retries remain intact.** Registration requires the matching finished session, submitted score, submission ID, version, name, and `normal` aggregate status. Getters join current moderation status and clamp their requested limit to 1..100. Hidden entries retain their numbers. Session locks, shared aggregate locks, and a per-ledger counter lock serialize registration. Repeating a clear for the same normalized name returns its existing number.
7. **Old pending results keep their original contract.** Legacy results use `finish_game_play_v1` or `finish_takkeu_play_v2`, preserving an absent loss count as NULL. `goal-3000-v1` uses hall/finish v1 and `takkeu-web-clear-1`; `goal-3500-v1` uses v2 and `takkeu-web-clear-3500-1`. The existing pending storage key and shared score maximum remain unchanged. The hall client tests cover both old contracts and scores above 3500.

No supported-public-RPC defect requiring a migration edit was confirmed in this review. The approval conditions above and the validation limits below remain relevant.

## Disposable verification

Executed locally:

```text
npm exec -- vitest run tests/unit/takkeu-db-preapply.test.ts tests/unit/takkeu-hall-sql.test.ts tests/unit/takkeu-3500-sql.test.ts tests/unit/hall-ranking.test.ts
4 test files passed; 16 tests passed
npm run typecheck
exit 0
```

[`takkeu-db-preapply.test.ts`](../../tests/unit/takkeu-db-preapply.test.ts) verifies the exact object inventory, unchanged legacy table values including a 4001 score and moderation category, rollback after a late transaction error, rollback after a late pre-existing-function collision, and rejection of duplicate application without altering a committed schema. It also proves that rolling back hall registration restores its counter while preserving an earlier committed score, and that retry then receives number 1 with a stable receipt.

The existing tests cover start/finish/registration validation, duplicate receipt behavior, same-name registration, distinct-name order, moderation filtering, client-role denial of direct access, old/new ledger separation, and legacy first/best-score preservation. The independently run native PostgreSQL concurrency artifact, `artifacts/goal-3500/postgres-concurrency.json`, records PostgreSQL 17.11, different backend PIDs, concurrent same-name clears receiving number 1, distinct names receiving 2 and 3, a stable retry receipt, and `nextNumber = 4`. Initial connection-refused log lines were readiness polling; the completed artifact contains the assertions' successful result.

The PGlite fixture is deliberately smaller than production: it omits several columns/defaults/FKs/checks, partial unique indexes, production default ACLs, unrelated verified-game tables and triggers, and full progress telemetry. Passing it alone does not establish production ACL parity or safety for every other game. The read-only production contract check and the native disposable test are separate evidence; neither substitutes for the other. A real PostgREST/schema-cache/client run after approval remains distinct from these local SQL tests and must not create test scores in production.

Supabase's current changelog and function/RLS documentation were consulted. The upcoming public-table Data API default change does not require granting direct hall-table access: this design uses explicitly granted RPCs. Relevant guidance: [database functions](https://supabase.com/docs/guides/database/functions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Data API exposure change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).

## Proposed application procedure after explicit approval

1. Reconfirm the target project, exact migration hash, apply owner, dependency function definitions/signatures, RLS, default/effective ACLs, required columns/constraints/indexes/triggers, game configuration, and absence of every new object plus the migration-history row. Fail on any partial state or drift and investigate it separately.
2. Confirm a recoverable backup and who owns recovery, without enabling a paid feature or changing the database plan. Record existing score/category counts for comparison, allowing for live traffic rather than treating the earlier counts as immutable.
3. Use an approved runner that guarantees one transaction for this file, verification assertions, and its migration-history record. The repository also has multiple date-only `20261027_*` migration files for dependencies already present in production. Do not use a blanket `supabase db push` to replay unrelated staged files. Target only version `20261027032043` and its reviewed payload.
4. Use bounded local transaction timeouts, for example `lock_timeout = '5s'` and `statement_timeout = '120s'`, with the final values approved for observed table sizes. The session ALTER requires ACCESS EXCLUSIVE and validates its new CHECK over existing sessions for all games. FK creation also locks referenced tables, and trigger creation locks the shared score-runs table. Lock waiting or failure must abort the transaction; do not keep an idle transaction open or retry automatically during traffic.
5. Within the same transaction, require all expected objects, 21 non-NOT-NULL constraints, 8 indexes, 4 RLS-enabled new tables, exact owner/ACL/search-path/function definitions, and 2 initialized counter rows. Assert both hall tables are empty and shared scoring/moderation configuration is unchanged. A newly initialized counter is 1 only before real registrations; subsequent health checks must validate counter/ledger consistency instead of requiring 1.
6. On any failed statement or assertion, roll back and close the connection. Re-read the catalog to verify zero migration objects/history change. Do not add `IF NOT EXISTS`, drop collisions, or manually finish a partial prefix as an unreviewed retry.
7. Commit only after all transaction assertions pass. Save the completed migration ID and fresh read-only catalog evidence. Confirm PostgREST exposes the exact new RPC signatures and explicit roles before allowing the matching Pages deployment. Read-only hall getters may be checked; start/finish/submit/register smoke tests remain disposable-local tests.

## Transaction rollback versus recovery after commit

Before COMMIT, a PostgreSQL rollback removes the new tables, counter rows, indexes, functions, triggers, constraints, grants, and added columns as one unit. The disposable failure/collision tests verify this behavior. A failed hall registration transaction similarly restores its counter and entry together; it cannot undo a score submitted in an earlier committed request.

After COMMIT, `ROLLBACK` cannot undo the migration. Reverting static Pages content also does not undo database changes. The preferred first containment for a client regression is a separately approved client rollback while preserving the additive API contracts and both ledgers so cached clients and queued results can retry.

For a database defect, preserve both hall tables, counters, first-play references, new-rule sessions, and matching score submissions before proposing recovery. Review a specific forward repair or narrowly scoped permission change. Dropping columns/tables/functions or removing the history entry after new writes would destroy eligibility evidence and stable registration numbers; a down migration, TRUNCATE, CASCADE, renumbering, or historical backfill is not authorized by this plan. A full database restore also risks losing unrelated games' writes since the backup and needs its own explicit recovery decision.

## Approval checklist

- [ ] Exact target project, migration ID/hash, apply owner, and the complete 4-table/2-column/10-function/2-trigger change are explicitly approved.
- [ ] Fresh read-only preflight proves a clean, compatible baseline and no partial apply; proposed owner/default grants produce the reviewed service-role permissions.
- [ ] Disposable SQL, rollback, collision, duplicate/retry, compatibility, and native concurrency evidence is accepted; production-fixture limitations are understood.
- [ ] Lock window/timeouts, backup/recovery owner, and atomic apply/history mechanism are specified; no paid capability is enabled implicitly.
- [ ] Existing scores, first/best values, rankings, moderation categories, and historical numbers remain unchanged; no backfill or renumbering is approved.
- [ ] Post-apply read-only contract checks and manual Pages deployment are separate, explicit gates. Approval of the database change alone does not publish the site.

Until these conditions and explicit application approval are met, keep the production database unchanged and the matching public deployment blocked.
