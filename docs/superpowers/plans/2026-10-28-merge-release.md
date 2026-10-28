# Owner merge → verified Pages release implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline, then an independent whole-branch security review. The user explicitly requests independent review.

**Goal:** The owner's merge of this explicit release PR is the final publishing action; fail closed before deploy on missing evidence.

**Architecture:** CI remains push/PR driven. Pages release consumes only successful main push CI workflow_run evidence, checks the formal merged PR/owner and a committed release marker, builds and verifies the same SHA in its own run, checks a fixed GET-only Supabase contract API before upload and immediately before deployment, then compares every published file to the verified manifest.

**Tech stack:** Node 24, GitHub Actions REST, PostgREST GET RPC, PostgreSQL17.

**Spec:** User request (sections 0–12), recorded with design and acceptance matrix in `docs/production-readiness-2026-10-28/merge-release/design.md`.

## Global constraints

- Never merge, auto-merge, push main, dispatch Pages, create paid infrastructure, or write production test records.
- Individual approval before production migration, role/ACL/policy/API, Secrets or Environment changes.
- Original migration SHA256 b6a9828852e3b87840348814559353dec8b0286d6d6642dee7952b4fe9ef009b unchanged.
- No changes to game difficulty, presentation, rules or old pending compatibility.
- Ready for review only after all production prerequisites are verified.

## Review focus

- Forged/stale workflow_run, PR and CI evidence must fail closed, including reruns.
- Public GET response must contain only opaque digests, freshness and fixed project identity; no source/data/arbitrary selectors.
- Owner NOLOGIN grants must not provide a new login or mutation capability to callers.
- Latest main and contract can change while building; repeat both checks before deploy.
- Postdeploy mismatch must report failure honestly; never erase deployed data or silently roll back shared DB.

## Tasks

### 1. Refresh and design
- [x] Read current main/PR/CI, Pages/environment, public release and production catalog READ ONLY.
- [x] Match production baseline and original SQL SHA256; compare A/B/C using official documentation.
- [ ] Record trust boundaries, comparison of guarantees, approvals and test matrix.

### 2. Fixed GET contract API
Files: `scripts/release/rest-contract.mjs`, `prepare-rest-inspector.mjs`, `check-database-rest.mjs`, `tests/release/rest-contract.test.mjs`, `tests/helpers/checkRestInspector.mjs`.
- [ ] Write HTTP failure/freshness/digest/GET tests and witness RED.
- [ ] Generate a fixed, non-dynamic catalog-only STABLE function; prove INVOKER limitation locally before choosing restricted definer owner.
- [ ] Preserve exact six-field catalog contract; hash on server, compare reviewed expected digests on client.
- [ ] PG17: initial/duplicate/rollback, no mutation or number issuance, owner privileges and schema/function/ACL drift; real local PostgREST GET/POST tests.
- [ ] Generate exact reviewable SQL and SHA256. Request individual API approval only after tests.

### 3. Automatic release and distribution verification
Files: `.github/workflows/deploy.yml`, `scripts/release/merge-authorization.mjs`, `check-github.mjs`, `release-target.json`, `distribution.mjs`, `tests/release/merge-authorization.test.mjs`, `workflow.test.mjs`, `distribution.test.mjs`.
- [ ] Write actual-graph/API-negative tests and witness RED.
- [ ] Restrict workflow_run to successful main push CI in this repository; use CI head_sha explicitly everywhere.
- [ ] Verify formal owner merge to main with matching merge_commit_sha, repository/PR identity, explicit committed marker and changed-file proof. Reject already successful deployment of SHA.
- [ ] Verify Pages settings and main-only Environment without modifying protections.
- [ ] Same-run build/upload; compare manifest at deploy; repeat main/CI/merge/DB checks, then deploy-pages.
- [ ] Postdeploy: canonical URL, release SHA/version, all static bytes and DB GET; bounded retries and clear failure summary.

### 4. Production preparation and approval execution
- [ ] PG17 original migration/readiness/concurrency; confirm backup availability, actual counts, ACL/owner/dependencies/locks.
- [ ] Provide exact migration SQL/hash/counts/impact/recovery; seek explicit approval. Continue other work while pending.
- [ ] Apply only approved objects atomically, with pre/post checks, then reacquire live evidence and REST/OpenAPI. No db push.
- [ ] No new release DB credentials or Secrets should be required with the public publishable key already in code.

### 5. Verification, independent review and Draft PR
- [ ] Type/unit, guards/native PostgreSQL/concurrency, Chromium/WebKit, root/Pages distribution and actionlint.
- [ ] Independent adversarial review, reproduce significant findings RED→GREEN and rerun affected checks.
- [ ] Create Draft PR on latest main; confirm real GitHub PR CI and no Pages deployment triggered.
- [ ] Update evidence/approval status and concrete merge behavior. Ready only if all user completion criteria pass.

## Execution ledger

- Baseline: current main b6440fb8c5c288b66657f332251080f9a4814b54, push CI40683884700 succeeded. Public release628439f5907601c9b34ee2ba01f70c918b6e8d18. Full six-field production baseline matches. Original SQL hash unchanged.
- Baseline type/unit/guards succeeded (972 unit,13 guards); native DB checks running.
- Implementation choice: work in a new dedicated filtered clone/branch; user authorized a new branch, and this preserves the empty original workspace.
- Approval workflow: user explicitly authorizes independent code/testing/PR preparation while production approvals are pending, so no extra design-approval pause.

- Task 1 complete: authenticated six-field baseline, exact original migration SHA, current Pages/main CI/environment/owner properties and grantability acquired. Official A/B/C docs reviewed.
- Task 2 complete locally: generated exact API migration; tests witnessed missing implementation RED, opaque output RED, incoming membership RED, omitted grant-option RED; 30 native checks GREEN including realistic NOSUPERUSER owner, original and API apply, old ownership-transfer failure, real PostgREST writes blocked. Production B remains individually unapproved.
- Task 3 complete locally: real YAML graph negative tests, merge API/CI/SHA/environment/dedup, exact CI manifest, same-run tar and live full-file verification. actionlint GREEN.
- Task 4 pending approval: A SQL/hash unchanged; production baseline fresh and backup information missing. A/B questions sent separately. No production SQL/ACL/role changes, no Secrets/Environment mutations.
- Task 5 in progress: unit972/guard23, old native34/readiness33/concurrency GREEN; independent review two Important and one Minor reproduced/fixed; focused independent12 GREEN. Full browser running. Draft PR and real CI next.
- Ruling: retain documented DB-admin trust boundary (cannot independently attest malicious self-forging endpoint), require explicit B approval; never promote Draft before actual production contract match.
- Ruling: use inline implementation and one independent reviewer as user requested, with actual code/test evidence rather than extra design/plan permission pauses.
- Ruling: Playwright release testMatch excludes Node .test.mjs collection; Node guards stay mandatory separately in CI, preventing incidental imports from acting as verification.
