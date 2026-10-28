# Independent adversarial review — 2026-10-28

Reviewed the uncommitted production-readiness changes on `chore/production-release-readiness`, based on main `754b71bc7aa6ce982a4ceb7221ad14fabd600c95`. This review covered the catalog gate, metadata contracts, offline proposal generator, native PostgreSQL helpers, copied RPC fixtures, CI integration, and the shared PUBLIC privilege audit. The reviewer changed only this report. All SQL executed by the reviewer used disposable local PostgreSQL 17 containers; no production connection, RPC, SQL, settings, secrets, publication, push, merge, or commit was performed.

**Assessment: with fixes.** Two important findings were corrected and independently retested during review. A third important gate blind spot was reproduced and accepted by the implementer; its remediation is pending implementation evidence at this report's review cutoff. Production credential readiness and publication remain blocked independently of these fixes, because the scoped eight-RPC proposal leaves system large-object writes available and no suitable provider-enforced readonly connection has been verified.

## Strengths

- The migration payload remains byte-for-byte pinned to SHA-256 `b6a9828852e3b87840348814559353dec8b0286d6d6642dee7952b4fe9ef009b`. The generator does not connect to a database or start a subprocess. It wraps the reviewed migration and history entry in one transaction, checks the pre/post schema, checks existing business-row fingerprints, and refuses duplicate or partial application.
- The permission apply/restore scripts operate on the exact eight reviewed application RPC identities. They preserve effective access for `anon`, `authenticated`, and `service_role`, compare canonical ACL tuples, and restore the captured original ACL rather than merely adding PUBLIC back. No production system-function revoke, schema-wide revoke, role provisioning, or default-privilege change is added by these proposals.
- The catalog now checks effective access to the eight large-object mutation functions and records column identity/generated attributes. The baseline/expected-contract changes inspected at this cutoff contain those attributes and a refreshed observation timestamp, without weakening existing contract values. Database logging returns the observed flags after verification.
- The native tests exercise actual copied function bodies and check accepted write receipts plus committed table effects within rolled-back caller transactions. They distinguish fixture-only system-function revokes from the production proposal. Existing `checkHallConcurrency.mjs` separately tests concurrent first registrations for the same new name; the new readiness helper's same-name retry uses an already registered first entry.

## Important findings

### 1. CI omitted an input required by the generator — resolved and independently retested

The original `preparePermissionSql()` read `docs/production-readiness-2026-10-28/evidence/function-inventory.json`. [CI](../../.github/workflows/ci.yml:25) excludes `/docs/` in its sparse checkout. Both the new release guard test and the native readiness helper call that function, so the proposed CI change would fail with `ENOENT` despite passing in a full developer checkout.

The implementer moved the eight reviewed targets into [reviewed-public-rpcs.json](../../scripts/release/reviewed-public-rpcs.json) and changed the generator to read that runtime input. The full audit evidence remains in `docs`. A real CLI test copies the required scripts/migration into a temporary checkout without docs and runs the generator there.

Independent verification: `node --test --test-isolation=none tests/release/preparation.test.mjs` completed with **3 passed, 0 failed**, including the isolated no-docs CLI invocation.

### 2. Permission proposals accepted changed function execution settings — resolved and independently retested

The original `permissionAssert()` compared ACL, owner, definer status, volatility and `prosrc` hash, but omitted function settings, strictness, language, result and default argument contract. A source-body hash does not cover these execution properties.

The reviewer loaded the two checked-in schema/RPC fixtures into disposable PostgreSQL 17 and ran:

```sql
ALTER FUNCTION public.check_player_name(text) SET search_path=pg_catalog;
ALTER FUNCTION public.check_player_name(text) RETURNS NULL ON NULL INPUT;
-- Execute the generated scoped permission proposal.
```

The original proposal **committed successfully**, retaining `strict=true` and `{search_path=pg_catalog}` while removing PUBLIC EXECUTE. The reviewed function was non-STRICT with `search_path=public`; NULL-call behavior had changed. This contradicted the proposal's abort-on-RPC-drift protection.

The revised [permission assertion](../../scripts/release/prepare-production.mjs:82) additionally compares full arguments/defaults, result, language, strictness and configuration. The reviewer independently ran the revised readiness helper from a temporary copy: **24 checks passed**, including refusal of changed `search_path`, refusal of late STRICT drift, rollback of earlier ACL changes, caller behavior before/after apply, and exact restore. Expected negative-case SQL errors were present; the helper itself exited successfully. Later implementer additions are outside that 24-check snapshot.

### 3. STABLE functions can still call writers and pass the gate — accepted, remediation pending evidence

At the review cutoff, [catalog.sql](../../scripts/release/catalog.sql:18) rejects reachable ordinary application routines only when `provolatile='v'`. The selected function contract also omits newly introduced nonvolatile wrappers. PostgreSQL's volatility declaration does not enforce a transitive readonly boundary: a STABLE definer can select a VOLATILE helper which performs writes.

The reviewer reproduced a false acceptance in disposable PostgreSQL 17 using the base fixture, the exact generated migration, and **fixture-only** large-object EXECUTE revokes. The following additional routines received no direct application-table grant for the reader:

```sql
CREATE FUNCTION private.adversarial_writer() RETURNS integer
LANGUAGE sql VOLATILE AS $$
  INSERT INTO public.players(normalized_name,display_name)
  VALUES ('StableWriter','StableWriter') RETURNING 1
$$;
REVOKE ALL ON FUNCTION private.adversarial_writer() FROM PUBLIC;

CREATE FUNCTION public.adversarial_stable_wrapper() RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT private.adversarial_writer()
$$;

SET ROLE release_reader;
BEGIN READ WRITE;
SELECT public.adversarial_stable_wrapper();
COMMIT;
RESET ROLE;
```

The call returned `1` and a subsequent owner query confirmed `persisted_rows=1`. The reviewer then executed the actual `catalog.sql` as a separate `release_reader` login and passed the resulting snapshot through `summarizeCatalog()` and `verifyDatabase()` against the reviewed contract. Result:

```json
{"gateAccepted":true,"least_privilege":true}
```

This is an injected local drift case; the review did **not** establish an existing production STABLE writer in the audited current functions. Current production remains blocked by the separate large-object check. Nevertheless, the positive fixture gate cannot establish a genuinely non-writable credential while this blind spot remains.

The implementer accepted the finding and reported the intended remedy: retain the existing VOLATILE rejection, reject additional callable nonvolatile routines, and require exact fingerprints for the seven reviewed PUBLIC STABLE/IMMUTABLE routines plus `private.get_game_player_counts_v1(text)` and their inspected read-only closure. The new `readonly_routines` field must be required in both runtime verification and migration pre/post assertions. A native regression must demonstrate that the wrapper above persists a row when executed locally but is rejected by the gate, and that helper drift is rejected. **No independent GREEN evidence for that change is recorded in this report.** No broader production ACL change is authorized by this recommendation.

## Verification and limits

Reviewer-run evidence comprised the native failing reproductions above, the three preparation tests, and the 24-check native readiness run from an isolated temporary filesystem copy. Every review container was removed; temporary generated SQL/catalog files were deleted. The reviewer did not rerun the entire application/browser/build suite or claim production verification.

The new readiness helper verifies explicit inventory counts, old/new ledgers, legacy scores, a pre-migration pending submission, moderation categories, real RPC calls under all three API roles, ACL restoration and transaction failures. Its caller parity assertion checks write receipts and final `events=4`, `sainome=1`, `hito=17`; read RPC calls must execute successfully, but their complete returned row payloads are not compared. This supports the scoped permission compatibility claim, with that limit.

No new game source or original migration changes were present in the reviewed diff. No deletion or rewrite of existing business data was found in the pinned migration proposal. The generated wrapper checks the five affected existing business datasets; its fingerprint is not a general backup of every shared-database table.

## Considered and declined to judge

- Production migration/permission application and restoration: expressly unapproved; only proposal SQL and disposable local behavior were reviewed.
- Availability, authentication, freshness and complete catalog visibility of a provider-enforced readonly service or physical replica: no verified connection was supplied; readiness remains blocked.
- Exhaustive compatibility for unknown direct database users relying solely on PUBLIC: the caller audit explicitly records this residual risk and requires an owner decision before applying A8.
- Full behavior of other games' verified competition/session flows: the local copied row types support the tested shared-RPC paths; these fixtures are not complete end-to-end simulations of those games.
- Documents still being prepared outside the PUBLIC privilege audit, final backup/recovery operations, GitHub environment configuration and deployment approval: not signed off by this code review.

The preparation branch may proceed toward a draft PR after finding 3 is fixed and required checks pass. This review provides no authorization to apply SQL, provision or install a production credential, change project settings, publish, merge, or push main.


## Implementer completion evidence (not a second independent review)

All three findings were reproduced and addressed. Preparation no longer reads docs; the real sparse-layout CLI test passed. Permission proposals compare full arguments/defaults, result, language, strictness, owner, volatility, config, source and exact ACL, rejecting search_path and late-STRICT drift atomically. The gate fingerprints the seven reviewed reachable nonvolatile routines plus private.get_game_player_counts_v1; unknown nonvolatile routines, helper/default drift and PUBLIC regular triggers are rejected. The implementer additionally reproduced a PUBLIC trigger bound to the reader's own temporary table causing an application write before ROLLBACK; that path now fails closed. There is no claim of an existing production STABLE/trigger writer discovered here.

Native PG17: gate30 cases passed, migration/caller/permissions33 checks passed. Gate RED evidence: evidence/stable-wrapper-gate-red.log and evidence/trigger-writer-red.log; final GREEN: evidence/db-gates.json, evidence/pg17-readiness.json. Source/metadata replica now includes identity and original function defaults; these fixture corrections do not change production or the original hall SQL. This remains a bounded contract/capability check, not a proof that a normal primary LOGIN cannot alter any PostgreSQL internal/session state. Production credential readiness remains blocked by confirmed PUBLIC large-object capabilities; the fixture-only builtin revokes are not proposed production SQL.

## Event-trigger follow-up discovered during final independent verification

The reviewer independently passed native30/preparation3 on HEAD36a2c75, then reproduced an additional false acceptance: a new inaccessible private SECURITY DEFINER event-trigger handler wrote a persistent players row during the reader's own CREATE TEMP TABLE. Event handlers execute automatically regardless of direct schema USAGE/EXECUTE. This was injected local drift; no existing production event writer was identified.

The implementer added all seven actual production event-trigger registrations and exact handler bodies/settings/owners/tags/enabled state to the mandatory runtime and migration pre/post contracts. The disposable schema now mirrors those handlers. New negative cases cover the actual automatic write, disabled registration, existing handler config drift and body drift. Native34 and readiness33 passed, plus guard13. RED evidence: evidence/event-trigger-gate-red.log. Production metadata: evidence/event-triggers.json (READ ONLY, 11:25 UTC). Independent final follow-up is recorded on PR31 after review; the earlier review cutoff above remains unchanged. No production event trigger was changed.
