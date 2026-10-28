# Shared PUBLIC function privileges: independent Stage C review

Status: **proposal only; no production grants, revokes, role changes, RPC calls, or Edge Function invocations were performed.** Scoped option A below preserves the three application roles' effective access to the eight reviewed functions. It does **not** by itself establish a genuinely non-writable production database credential. PostgreSQL large-object capabilities are a separate blocker. Keep publication and production-credential readiness blocked until that requirement has an independently verified solution.

## Evidence and limits

The production catalog observations are in [function-inventory.json](evidence/function-inventory.json), [permissions.json](evidence/permissions.json), and [production-initial.json](evidence/production-initial.json). Functions were observed at `2026-10-28T10:05:12.956445+00:00`, and permissions at `2026-10-28T10:06:55.327554+00:00`. The original complete function inventory, retained in the workspace rather than published wholesale, has SHA-256 `1c3e2aab1a51798bcf753513c6fac4a4bfd382a5a5480bd3aab5b56a43dc1815` (`production-function-inventory-parsed.json`). This review used its definitions, rather than relying on function names or volatility labels. The curated inventory preserves metadata and body hashes; changes since observation must abort any application of the proposal.

The inventory contains 193 non-system functions. Among its non-system schemas, only `public` grants schema `USAGE` to the pseudo-role `PUBLIC`. There are 16 PUBLIC-executable functions there: eight VOLATILE functions callable as ordinary functions, six STABLE read functions, one IMMUTABLE normalizer, and one event-trigger function. All except the normalizer run as `SECURITY DEFINER` owner `postgres`, which the role observation identifies as `BYPASSRLS`. `PUBLIC` means every database role, including a newly created `NOINHERIT` reader. A per-role `REVOKE` does not subtract privileges inherited through PUBLIC.

Connected GitHub searches for the three write-function names returned no matches, but all 76 accessible repositories were marked `is_code_search_indexed=false`; GitHub's code-search response also reported `incomplete_results=true`. Those responses establish no absence of callers. The review therefore enumerated trees or fetched selected runtime HTML/ranking clients in 58 candidate game repositories, plus the shared lab, Sainome and Hito sources, with connected GitHub read tools. It also fetched five catalog-linked static Codeberg pages as text using GET, without executing scripts, and read metadata/source for the four deployed Supabase Edge Functions. This is source and deployment evidence, not a production traffic inventory or an exhaustive search of forks, stale browser builds, private integrations, scheduled jobs, direct database clients, or other hosts.

## Exact eight-function scope and semantic classification

All signatures below are in schema `public`, owner `postgres`, `SECURITY DEFINER`, and catalog volatility `v`. Defaults do not change a PostgreSQL function's identity. ACL notation is the observed `aclitem` text: an empty grantee before `=X` is PUBLIC; `X` is EXECUTE; none of these grants has a grant option.

| Function identity | Current ACL | Inspected behavior and dependencies |
| --- | --- | --- |
| `check_player_name(p_display_name text)` | `{=X/postgres,postgres=X/postgres,anon=X/postgres}` | **Read only.** Calls `public.normalize_player_name(text)`, validates length, and selects name existence/display name from `players`. The helper is IMMUTABLE and only trims/coalesces text. |
| `get_best_score_ranking_with_metadata(p_game_slug text, p_limit integer)` | `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}` | **Read only.** Selects `game_scores`, `players`, `games`, and a lateral `score_runs.metadata` match. Filters abnormal Takkeu scores and excludes the two Sabasaba modes. No application function calls or data modification. |
| `get_first_try_ranking_with_metadata(p_game_slug text, p_limit integer)` | `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}` | **Read only.** Selects first-score rankings and matching `score_runs.metadata` from the same four tables. Filters abnormal Takkeu scores. No application function calls or data modification. |
| `get_game_ranking(p_game_slug text, p_limit integer)` | `{=X/postgres,postgres=X/postgres,anon=X/postgres}` | **Read only.** Reads active-game score ordering, clamps limit to 1–100, and selects `game_scores`; filters abnormal Takkeu scores. No writes or application function calls. |
| `get_player_score_summary_with_metadata(p_game_slug text, p_normalized_name text)` | `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}` | **Read only.** Reads one player's `game_scores`, `players`, and first/best matching `score_runs.metadata`; excludes the two Sabasaba modes. No application function calls or writes. |
| `record_game_play(p_display_name text, p_game_slug text, p_result_type text, p_client_version text)` | `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}` | **Writes.** General branch inserts `game_play_events`. For `sainome_300_seconds` + result `play`, also upserts `players`, inserts a provisional `retire` event with score 0 and generated play UUID, and inserts/updates `game_scores`/play count. Calls the trimming normalizer in that branch. Checks game existence, rather than active status. |
| `record_play_event(p_display_name text, p_game_slug text, p_result_type text, p_reached_wave integer, p_score integer, p_ranking_score integer, p_client_version text, p_play_id text)` | `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}` | **Writes.** Validates game existence, result type, wave range, and score, then inserts `game_play_events`, ignoring conflicts on `play_id`. It does not itself insert `score_runs` or `game_scores`. |
| `submit_hito_wo_yurusuna_score(p_display_name text, p_score integer, p_clear_wave integer, p_client_version text)` | `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}` | **Writes through a helper and directly.** Calls `public.submit_score(text,text,integer,text)` for fixed slug `hito_wo_yurusuna`, then updates first/best clear-wave fields in `game_scores` and `clear_wave` in the latest matching `score_runs`. |

Thus **five of the eight are read only by their current bodies and three can write**. VOLATILE alone is not evidence of a write. Including all eight in A preserves the existing conservative gate, which rejects every reachable non-system VOLATILE ordinary function, without changing function definitions or weakening that check.

The Hito dependency is material: `submit_score` itself has no PUBLIC EXECUTE, but the PUBLIC-executable wrapper runs as `postgres`, so its owner can call the helper. `submit_score` rejects Takkeu, Sabasaba, and other verified game submissions, then calls `submit_score_unverified`. The latter inserts/updates `players`, `score_runs`, and `game_scores`; its Sainome branch can also update a provisional play event. The wrapper's slug is fixed to Hito. The underlying helper being revoked from the outside caller does not prevent this SECURITY DEFINER path.

The relevant existing score-table triggers are `private.guard_verified_score_write`, `private.guard_sabasaba_score_runs`, and `private.attach_takkeu_final_losses_v1`. Their bodies validate verified-game/session state or attach final-loss metadata; they do not dynamically select arbitrary application functions. Their existence does not make the three writers read only. Trigger execution and their ACLs are outside A8. The local test harness must include the real observed trigger definitions when demonstrating caller behavior.

## Other PUBLIC-executable functions

The following remain outside the exact-eight proposal. All entries in the first six rows have current ACL `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}` and run as definer `postgres`. Their inspected definitions are selects, including the helper closure described below.

| Exact identity | Volatility / actual behavior |
| --- | --- |
| `public.get_disqualified_score_entries(p_game_slug text, p_limit integer)` | STABLE; selects abnormal score entries, status and note fields; bounded limit. |
| `public.get_first_try_ranking(p_game_slug text, p_limit integer)` | STABLE; selects `game_scores`, game ordering, and aggregated `private.game_play_sessions` counts. |
| `public.get_game_play_stats(p_game_slug text)` | STABLE; selects `private.get_game_player_counts_v1(text)` and adds Takkeu guest-play count. |
| `public.get_hito_wo_yurusuna_best_ranking(p_limit integer)` | STABLE; selects fixed-slug Hito best-score/clear-wave ranking. |
| `public.get_hito_wo_yurusuna_first_ranking(p_limit integer)` | STABLE; selects fixed-slug Hito first-score/clear-wave ranking. |
| `public.get_play_count_ranking(p_game_slug text, p_limit integer)` | STABLE; selects `private.get_game_player_counts_v1(text)`. |
| `public.normalize_player_name(input_name text)` | IMMUTABLE INVOKER, owner `postgres`, raw ACL NULL (default owner/PUBLIC EXECUTE). Only `btrim(coalesce(input_name,''))`. |
| `public.rls_auto_enable()` | VOLATILE DEFINER, raw ACL NULL (default owner/PUBLIC EXECUTE), return type `event_trigger`. Its DDL-event body can `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`; PostgreSQL does not permit ordinary/RPC invocation of event-trigger functions. The reader must still have no usable DDL privilege. |

`private.get_game_player_counts_v1(text)` is an INVOKER STABLE select over `private.game_play_sessions` and `public.game_scores`; it aggregates counts and joins normal-status scores. It has no writes or further application-function calls. Although ordinary callers lack its schema/EXECUTE access, the two public definer wrappers above can read through it as their owner. They return aggregates, not session tokens.

`private.attach_takkeu_final_losses_v1()` also has PUBLIC EXECUTE, but PUBLIC has no `private` schema USAGE and its return type is `trigger`, preventing ordinary invocation. PUBLIC-executable extension/auth/storage/realtime functions in the inventory do not become accessible to a fresh unrelated reader merely because the API roles have explicit schema USAGE. Do not grant that reader API-role membership or those schemas. PostgreSQL `pg_catalog` is a separate surface, discussed below.

## Caller evidence and per-game impact

Source citations include an observed blob SHA so a reviewer can retrieve the exact file even if the branch moves. They do not assert that every source path is currently receiving requests.

| Game/service | Observed call and identity evidence | Effect of scoped A8 after explicit role grants |
| --- | --- | --- |
| Sainome, `sainome_300_seconds` browser | [ranking-client.js:449](https://github.com/chameleonjp-lab/sainome/blob/main/js/ranking-client.js#L449), blob `b7794ec376fe242bfc15c2f6c3f4451938ce9ad9`, calls `record_game_play` with `p_result_type='play'`, version `sainome-web-3`. Its request at lines 361–381 uses only `apikey` and omits browser credentials. [supabase-config.js](https://github.com/chameleonjp-lab/sainome/blob/main/js/supabase-config.js), blob `4884aaf8374c1f3c0d21603c49d70e8fbdee5fea`, identifies this project and a publishable client key. | `anon` keeps EXECUTE; provisional retire event, returned play UUID and score/count writes must remain identical locally. Its separate `submit_score` call is outside A8. |
| Saisupi browser | [saisupi-ranking.js:243](https://github.com/chameleonjp-lab/saisupi/blob/main/js/saisupi-ranking.js#L243), blob `95b6fee90f22ab70766cc7b4309bbf910caba33d`, calls `record_game_play` with slug `saisupi`, result `play`, version `saisupi-web-1`. Lines 154–174 use the supplied public key, not a user's session. [saisupi-config.js](https://github.com/chameleonjp-lab/saisupi/blob/main/js/saisupi-config.js), blob `cc04cb814e6de4de0299813753773ff1f5cfd685`, identifies this project and publishable-key configuration. | `anon` keeps EXECUTE; the general play-event branch must still insert/return the same result locally. No new score-writing privilege is needed. |
| Binkarabin browser, including Codeberg hosting | [index.html:89](https://github.com/chameleonjp-lab/binkarabin/blob/main/index.html#L89), blob `e5c876b6074630fd3dcf81ecf4a80978a0e6b8a5`, calls `record_game_play` from `recordPlayOnlyOnce` on retire/home. Line 93 uses this project's public-key REST endpoint, without user-session auth. GET of [the live static page](https://chameleonjp.codeberg.page/binkarabin/) independently found the same call; fetched HTML SHA-256 `90186c970abc81eceb2449d1a65cf4e87b52bad54932412ddb672d8884d6700a`. | `anon` keeps EXECUTE; retire/home events must still insert locally. This is concrete evidence that revoking API-role EXECUTE or blanket-revoking all functions would affect another hosted game. |
| Deployed `sainome-ranking` Edge Function | Connected Supabase read tools returned ACTIVE version 1, bundle SHA-256 `d63034d221421972584cfbfc48de61cdeb3174ab899733854ff8cf9847c7e0cd`. `index.ts:137` calls `record_game_play` for its start action. Lines 65–78 build the RPC request with server-key configuration from `SUPABASE_SECRET_KEYS` or `SUPABASE_SERVICE_ROLE_KEY`; no secret values were requested/read. | Preserve the `service_role` contract explicitly: it currently gets this function's EXECUTE only through PUBLIC. Successful traffic and the current secret selection were not tested. Other helper grants used by this legacy service are outside A8. |
| Semekome, retained ranking client | [ranking-client.ts:97](https://github.com/chameleonjp-lab/semekome/blob/main/src/ranking/ranking-client.ts#L97), blob `d533d3014acb42aafbf2bb7addf33a4804fcf2b8`, calls `get_game_ranking`. Client validation accepts publishable keys or an anon JWT. The endpoint is build-time configuration. [runtime-ranking.ts:9](https://github.com/chameleonjp-lab/semekome/blob/main/src/ranking/runtime-ranking.ts#L9), blob `fcc3683e2a82157df29e7f819bf22ba2625f78e3`, exits before creating the client; [ranking-policy.ts](https://github.com/chameleonjp-lab/semekome/blob/main/src/ranking/ranking-policy.ts), blob `c8a2129b68b7e1c6ce9ed5b0e872464dc3d3649c`, currently returns `true` for suspension. | Retained anon compatibility is preserved. This is a **latent caller**, not evidence of active production requests or of a configured project endpoint. A local ranking-call case covers it without resuming the game. |
| Hito wo yurusuna | Current [index.html:1279](https://github.com/chameleonjp-lab/hito_wo_yurusuna/blob/main/index.html#L1279), blob `5dd8b095d2210b854c4df183e31823ebd47c2b98`, calls `submit_score` directly, then `get_best_score_ranking`, using this project's public key. The fetched Codeberg page likewise contained no literal `submit_hito_wo_yurusuna_score`; HTML SHA-256 `ffde79374d152f9ce8c06fa4eb59b1f7d543c17b57e51301e984317cb8373a64`. | Both observed direct calls are outside A8. The old Hito wrapper still keeps anon/authenticated/service access under A8; do not assume it is unused. |
| Shared lab top/detail pages and Takkeu | The reviewed [lab index](https://github.com/chameleonjp-lab/chameleonjp_lab/blob/main/index.html), blob `c2aa75539860ad84de7cbecaafd1592c73a488f2`, and [ranking page](https://github.com/chameleonjp-lab/chameleonjp_lab/blob/main/ranking.html), blob `1dad307b5cc0e36934c28ae3b21f29295ab351a0`, call `get_first_try_ranking`, `get_best_score_ranking`, play stats/count and abnormal-entry reads. Takkeu's local `src/ranking/client.ts` uses its explicit start/finish/submit/progress/hall APIs. | These observed calls are outside A8. Their definitions and ACLs must not change. |

The other three ACTIVE Edge Functions read were `tomatoku-competition` v1 (`57cbde5a74e44f2fd1000a6eee42f6ba08b931533080d0de26d3fe52ab934990`), `akerun-competition` v6 (`0ad5da19ad2f343e71b69e0ae45e6506eaf3dbdbcdc2a9504637a47a5eb1a079`), and `slime-trial-submit` v1 (`2cc4bf86b5e2c641812e9dc765d8c5dc508bc9a051adb91c0475da586d123fe2`). Their retrieved source contains no literal call to an A8 target. They were not invoked.

No current caller was established for `check_player_name`, either metadata-ranking read, the metadata summary, `record_play_event`, or the old Hito submit wrapper. Older game builds, external sites and database users remain unknown. **No known caller is not proof that a function is unused.** A8 therefore preserves all three known application roles on every target, rather than deleting these functions or restricting their game slugs.

## A: conditional scoped ACL proposal, with exact restore

Recommended only as a separately approved application-RPC isolation step. Re-read and compare exact identities, owner, body hash, ACLs, schema privileges and memberships first. In one transaction, pregrant EXECUTE on these exact eight identities to `anon`, `authenticated`, `service_role`, then revoke EXECUTE from PUBLIC on exactly those identities. Preserve every other grant, function definition, owner, trigger, schema and default ACL. No schema-wide or default-privilege revocation belongs to this proposal.

The following is review text, not an executed command or an automatic production instruction:

```sql
BEGIN;
GRANT EXECUTE ON FUNCTION
  public.check_player_name(text),
  public.get_best_score_ranking_with_metadata(text, integer),
  public.get_first_try_ranking_with_metadata(text, integer),
  public.get_game_ranking(text, integer),
  public.get_player_score_summary_with_metadata(text, text),
  public.record_game_play(text, text, text, text),
  public.record_play_event(text, text, text, integer, integer, integer, text, text),
  public.submit_hito_wo_yurusuna_score(text, integer, integer, text)
TO anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION
  public.check_player_name(text),
  public.get_best_score_ranking_with_metadata(text, integer),
  public.get_first_try_ranking_with_metadata(text, integer),
  public.get_game_ranking(text, integer),
  public.get_player_score_summary_with_metadata(text, text),
  public.record_game_play(text, text, text, text),
  public.record_play_event(text, text, text, integer, integer, integer, text, text),
  public.submit_hito_wo_yurusuna_score(text, integer, integer, text)
FROM PUBLIC;
COMMIT;
```

Every `anon`/`authenticated`/`service_role` target had effective EXECUTE before this proposal; the new explicit grants preserve that effective access. The unrelated reader loses these eight capabilities. Existing direct database users that rely solely on PUBLIC also lose them; such clients have not been exhaustively identified. That residual compatibility risk requires an explicit owner decision. A role-specific deny, `NOINHERIT`, changing `search_path`, or setting `default_transaction_read_only` does not substitute for these revokes.

Rollback must restore the **observed ACL**, including removal of newly introduced explicit grants. With unchanged preconditions and grantor `postgres`, in one transaction:

1. Grant EXECUTE to PUBLIC on the same eight exact identities.
2. Revoke EXECUTE from `authenticated, service_role` on `check_player_name(text)` and `get_game_ranking(text,integer)`. Those two originally had only explicit owner and anon grants.
3. Revoke EXECUTE from `service_role` on the other six exact identities. Their explicit anon/authenticated grants existed before and must remain.
4. Compare canonical `aclexplode` tuples (grantee, grantor, privilege, grant option), owner and function-body hashes to the captured baseline for all eight; confirm unrelated ACLs are unchanged. ACL-array ordering is not a privilege difference.

The exact restore delta for this observed baseline is:

```sql
BEGIN;
GRANT EXECUTE ON FUNCTION
  public.check_player_name(text),
  public.get_best_score_ranking_with_metadata(text, integer),
  public.get_first_try_ranking_with_metadata(text, integer),
  public.get_game_ranking(text, integer),
  public.get_player_score_summary_with_metadata(text, text),
  public.record_game_play(text, text, text, text),
  public.record_play_event(text, text, text, integer, integer, integer, text, text),
  public.submit_hito_wo_yurusuna_score(text, integer, integer, text)
TO PUBLIC;
REVOKE EXECUTE ON FUNCTION
  public.check_player_name(text),
  public.get_game_ranking(text, integer)
FROM authenticated, service_role;
REVOKE EXECUTE ON FUNCTION
  public.get_best_score_ranking_with_metadata(text, integer),
  public.get_first_try_ranking_with_metadata(text, integer),
  public.get_player_score_summary_with_metadata(text, text),
  public.record_game_play(text, text, text, text),
  public.record_play_event(text, text, text, integer, integer, integer, text, text),
  public.submit_hito_wo_yurusuna_score(text, integer, integer, text)
FROM service_role;
COMMIT;
```

Merely granting PUBLIC back would leave eight added service grants and two added authenticated grants behind. Broadly revoking all client grants would erase legitimate pre-existing grants. Abort rollback on concurrent ACL drift and reconcile the recorded delta explicitly.

Local acceptance must execute real copied function bodies under each API role with fixtures and compare accepted results and table effects before/after A8, rather than merely inspecting `has_function_privilege`. Cover Sainome provisional play/counts, Saisupi play, Binkarabin retire/home, retained Semekome ranking, legacy `record_play_event`, and the Hito wrapper/helper chain. Verify the fresh PUBLIC-only reader can no longer execute any of the eight, and verify rollback restores canonical ACLs and caller behavior. These are disposable local-database operations only; production RPC behavior is not to be probed.

## Why A8 does not complete the readonly-credential requirement; B

The original 193-function inventory excludes `pg_catalog`. A new role can still inherit EXECUTE on system functions there. [PostgreSQL 17 large-object documentation](https://www.postgresql.org/docs/17/lo-funcs.html) describes `lo_from_bytea(oid,bytea)` as creating an object and storing data, and `lo_put(oid,bigint,bytea)` as writing data. A role can own a large object it creates even without INSERT grants on application tables.

The upstream [PostgreSQL 17 implementation](https://github.com/postgres/postgres/blob/REL_17_STABLE/src/backend/libpq/be-fsstubs.c#L262) has `lo_create` check transaction readonly state, then call `inv_create`; [inv_create](https://github.com/postgres/postgres/blob/REL_17_STABLE/src/backend/storage/large_object/inv_api.c#L211) creates the object and records the current user as its owner. This is a real persistent-write capability when callable in a writable transaction. [SET TRANSACTION](https://www.postgresql.org/docs/17/sql-set-transaction.html) explicitly permits session transaction defaults to be overridden. `PGOPTIONS=-c default_transaction_read_only=on` protects the audit transaction from accidental writes; it is not an immutable credential boundary. The observed built-in `supabase_read_only_user` also has `BYPASSRLS` and memberships, so its name/default setting is not sufficient either.

The [production system-function ACL observation](evidence/production-largeobject-permissions.json) confirms PUBLIC EXECUTE on eight VOLATILE INVOKER functions: `pg_catalog.lo_creat(integer)`, `lo_create(oid)`, `lo_from_bytea(oid,bytea)`, `lo_put(oid,bigint,bytea)`, `lo_truncate(integer,integer)`, `lo_truncate64(integer,bigint)`, `lo_unlink(oid)`, and `lowrite(integer,bytea)`. No such function was executed in production. The disposable PostgreSQL 17 reproduction is separate evidence in this release-readiness review. A8 does not change those ACLs. Do not label an A8-prepared login `least_privilege=true` or provision it as the final non-writable production secret while large-object writes remain possible. Do not broaden this proposal to shared system-function revokes: that would require its own service/caller audit and owner approval.

Option B must supply an independently enforced readonly boundary: an **already available, verified physical readonly replica**, or an **available provider-enforced fixed readonly service** whose credential cannot be used for unrestricted writer SQL or mutation APIs. Verify project identity, freshness/replay position, complete required catalog visibility, and caller authentication. A replica's schema evidence can lag and cannot silently stand in for current writer state. A fixed service must enforce the allowed queries outside the caller's control; a command wrapper that holds a writable database password in the release job is insufficient.

Neither a suitable existing replica nor such a scoped service has been confirmed available/authenticated at the current billing tier. Do not create a paid replica or service, invent a provider capability, weaken the requirement, or mark B implemented. Keep the gate fail-closed while presenting A8 as a concrete compatibility-preserving proposal and B as a blocked alternative requiring verified availability. The relevant current Supabase guidance is [function privileges](https://supabase.com/docs/guides/database/functions#function-privileges); this review intentionally scopes the proposal more narrowly than its schema-wide examples.
