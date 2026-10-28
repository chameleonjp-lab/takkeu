# Independent final review addendum — 2026-10-28

Reviewed commit `36a2c75b2d10ff09354158b840c8b09dc6ac4373` in `/workspace/takkeu`. No tracked files were edited and no commit, production connection, production RPC/SQL, network/API mutation, publishing, push or merge was performed. Native checks used disposable local PostgreSQL 17.11 from the already cached image `postgres:17@sha256:b8faeff7712663c2773a190181e1246e37e364b887611c04658c28b44e2408fe`. Temporary copies, generated artifacts and containers were removed.

**Original finding 3 remediation: independently verified.** The gate retains the VOLATILE denial, rejects unknown callable nonvolatile routines and ordinary trigger routines, and requires the `readonly_routines` contract for the seven reviewed PUBLIC routines plus `private.get_game_player_counts_v1(text)`. Source hashes, identities/full arguments, results, language, owner, security context, configuration, volatility, strictness and observed API access are compared. Runtime verification and generated migration pre/post assertions both require the new field. Extra overloads of an allowed name enter that field and fail exact contract equality.

Fresh commands and outcomes:

- `node tests/helpers/checkReleaseDatabase.mjs`, executed from an isolated temporary copy of the committed inputs: **30 cases passed**, exit 0, final `playerRows=0`. The native regression first proves the STABLE definer/private VOLATILE helper can write, then confirms the gate rejects it. The temporary-table ordinary-trigger path, transitive helper drift, readonly default-argument drift, PUBLIC large-object capability and explicitly granted server-file large-object capability were also rejected.
- `node --test --test-isolation=none tests/release/preparation.test.mjs`: **3 passed, 0 failed**, including actual CLI generation in the docs-free sparse layout.
- Inspected the eight readonly function replicas: their bodies contain SELECT/aggregate operations and builtins, with the two public count wrappers calling the fingerprinted private helper. Existing table/function/migration/security comparisons remain required.

## Additional important residual: automatic event-trigger writes

The review found a related path beyond the remediated ordinary-trigger case. At this commit, both routine capability scans exclude return type `event_trigger`, and the contract does not record `pg_event_trigger` registrations. Such functions run automatically on matching DDL without the caller needing schema USAGE or function EXECUTE. A reader with the default database TEMP capability can issue matching temporary-table DDL.

The reviewer extended only a **temporary copy** of the native helper immediately after its positive fixture gate. After the exact migration and fixture-only large-object restrictions, the local setup executed:

```sql
CREATE FUNCTION private.independent_event_writer() RETURNS event_trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  INSERT INTO public.players(normalized_name,display_name)
  VALUES ('EventWriteProbe','EventWriteProbe');
END;
$$;
CREATE EVENT TRIGGER independent_event_write
ON ddl_command_end WHEN TAG IN ('CREATE TABLE')
EXECUTE FUNCTION private.independent_event_writer();

SET ROLE release_reader;
BEGIN READ WRITE;
CREATE TEMP TABLE independent_event_probe(n integer);
COMMIT;
RESET ROLE;
```

The reviewer then counted the committed application row and ran the actual `catalog.sql` under a separate `release_reader` login, followed by `summarizeCatalog()` and `verifyDatabase(snapshot, contract)`. Observed result:

```json
{"independentEventProbe":true,"eventRows":"1","gateAccepted":true,"least_privilege":true,"rejection":null}
```

The probe removed its event trigger/function and test row; the remaining unmodified native cases still completed successfully. This is an injected local drift reproduction, **not evidence of a production event-trigger writer**. No production event trigger was invoked by the reviewer. The implementer accepted the finding and is preparing exact event-trigger registration and handler-contract checks plus a native negative regression. That follow-up is **pending independent verification** at this addendum's cutoff.

Production readiness remains blocked: scoped A8 does not remove PUBLIC large-object write capabilities, and no suitable independently enforced readonly connection has been verified. Fixture-only system revokes are not proposed production SQL. These checks are a bounded catalog/capability contract; they do not establish that a normal primary login can never alter any PostgreSQL internal or session state. This addendum does not authorize production changes or publication, and it does not claim a complete application/browser/build rerun.

## Follow-up: event-trigger remediation independently verified

**GREEN on the revised working tree based on `36a2c75b2d10ff09354158b840c8b09dc6ac4373`.** The event-trigger issue above is resolved in the inspected revision. No further material finding was identified in this focused remediation review.

The catalog now records every event-trigger registration without relying on caller schema USAGE or function EXECUTE. Its exact contract includes registration name, event, tags, enabled state, owner and the associated function's identity, full arguments, result, owner, language, source-body hash, configuration, definer status, volatility and strictness. All registrations are included, including disabled ones. Runtime verification and generated migration pre/post assertions require this field. Existing privilege, ordinary-trigger, nonvolatile-function and large-object checks remain present.

Independent checks completed:

- `node tests/helpers/checkReleaseDatabase.mjs`, run on a temporary copy of the revised inputs: **34 cases passed**, exit 0, final `playerRows=0`, PostgreSQL 17.11. The added malicious event handler has PUBLIC EXECUTE revoked and is in the inaccessible private schema. A reader's temporary-table DDL still invokes it and demonstrates the application write locally; the revised gate rejects the extra registration. Native cases also reject disabled handlers, changed handler configuration and changed handler source.
- An additional native probe in that temporary helper dropped `ensure_rls`. Verification rejected it specifically with `DB contract mismatch: event_triggers`; the exact recreated registration was accepted. This independently covers the missing-registration case as well as the checked-in extra/disabled/body/configuration cases.
- `node --test --test-isolation=none tests/release/preparation.test.mjs`: **3 passed, 0 failed**, including the real docs-free CLI test.
- Projected the saved observation `/workspace/release-readiness-20261028-1004/production-event-triggers.json` through the same normalized source digest, independently asserted its `read_only=true` and project identity, and compared all seven handlers against **both** baseline and expected contracts: exact match. The native positive fixture check independently confirms the cloned seven handlers produce that catalog contract. The saved observation is timestamped `2026-10-28T11:21Z`; the reviewer did not make a production query.

Inspected handler behavior: the definer `ensure_rls` handler limits its dynamic RLS operation to newly created public tables and skips temporary schemas. The extension handlers are invokers with extension-specific tags, and the PostgREST handlers issue schema notifications. This is consistent with the existing capability restrictions and the recorded bounded scope; no broader production privilege change was introduced by this remediation. The generator remains offline and the original migration payload remains pinned.

Reviewed input SHA-256 values, identifying the uncommitted revision independently of later documentation edits:

```text
f65e08e7523199b0094f77b6929e58652ee04d904d6e177227b928d09d05ac88  scripts/release/catalog.sql
f3d26476d3e3f52ff5953e54e867fa8d2fe02081fac3a0363ddcb28a2789ae12  scripts/release/guards.mjs
13cb6f7a3d9c8900c3617c6329468416535128013deb838296dfaeb6e19f5b18  scripts/release/prepare-production.mjs
597261bda3abc657a093e287c9fdc018cc33a28797beb4e15e037eda73508026  scripts/release/production-baseline.json
a48f7ea21a23eeda0a713c3a3ed4a40640669dc2c159e796ab84ce3292268db8  scripts/release/expected-contract.json
a0a854987768d5823d323131c16fe91aa972d43cfba553e702465688cd8e398c  tests/helpers/checkReleaseDatabase.mjs
d66b123a8e4e6621ea957c0f886bc008a7172c97e6dfdd5356d4c14318b624f2  tests/sql/release-production-schema.sql
```

All review mutations remained inside disposable local databases or temporary files outside the repository. The reviewer changed no tracked file and made no production mutation, commit or push. This resolves the reported local gate blind spots and supports the preparation PR; **production credential readiness and publication remain blocked** by the confirmed PUBLIC large-object capabilities and absence of a verified provider-enforced readonly boundary. No production application, settings, secret installation, publication or merge is authorized by this review.
