# Pages / DB release safety implementation plan

> Execute inline using executing-plans and test-driven-development; independent whole-change review before Draft PR.

**Goal:** Prepare a manual, explicitly approved release of current main only, fail closed when the production DB contract is unverified.
**Architecture:** Remove the Pages push trigger; keep normal CI. Manual owner dispatch binds approval to a full SHA. Repeat main/CI checks, run distribution verification, then read production catalogs in a read-only transaction with a least-privilege connection. Deploy the same run's artifact only after all gates succeed; recheck DB/main/CI after any environment wait.
**Stack:** Existing Node 24 / Vitest / Playwright, GitHub Actions, PostgreSQL catalogs / psql.
**Spec:** User emergency request dated 2026-10-28 (Stages A–D). Autonomous implementation and Draft PR are explicitly authorized; production SQL, publishing, rollback, merge and direct main push are forbidden.

## Constraints

- No game source, physics or rendering changes. Keep score_max=100000000 and old pending contracts.
- Production queries: BEGIN READ ONLY + bounded timeout, catalog SELECTs and one games configuration row only; no write RPC calls.
- No new high-privilege secrets or paid services. Absent read-only credentials => release failure.
- Existing github-pages environment has branch main restriction but no required reviewers (observed 2026-10-28). Do not describe YAML as configured reviewer protection.
- Main stays unchanged until the user reviews and merges the new Draft PR. Cancelling an existing release is separate from preparing this change.

## Review focus

- Other workflows or old-run reruns can bypass a PR until it is merged; document this operational limit.
- Main moving during approval or validation must fail on the final recheck. The tiny GitHub API/deploy boundary is not an atomic lock on main; protect main during release.
- Missing/partial/mismatched DB objects, ACLs, trigger bodies and history must fail; successful existence checks alone are insufficient.
- Wrong/privileged DB credentials, command timeouts, malformed output and unavailable GitHub API must fail without leaking secrets.
- Restoration preserves ranking data, browser pending and previous successful Pages artifacts.

## Task 1: Evidence and incident containment
- [x] Refresh PR/main/runs/Pages/DB; verify target identifiers; cancel only the specified unpublished run; confirm completed/cancelled and live release SHA.
- [x] Save timestamped audit, default ACLs, dependency definitions, migration history, ranking categories and recovery scope.

## Task 2: Manual release gates
Files: `.github/workflows/deploy.yml`, `scripts/release/*`, `tests/unit/release-guards.test.ts`.
- [x] Write and run failing tests for dispatch/approval/SHA/CI/fail-closed DB guards and workflow execution paths.
- [x] Implement owner-confirmed manual-only workflow; keep `ci.yml` automatic. Single concurrency group, same-run artifact, main and DB checks immediately before deploy.
- [x] Validate with executable condition/API/psql fixtures, YAML/actionlint and existing CI.

## Task 3: Read-only DB contract verification
Files: `scripts/release/db-contract.*`, catalog SQL, reviewed expected contract, DB tests.
- [x] Test missing history/RPC/table, changed body/args/SECURITY DEFINER/search_path, grants/RLS/constraints/triggers and timeout/privilege failures.
- [x] Compare required production baseline and migration contracts against catalogs, using no mutation RPCs. Require least-privilege SSL connection and read-only transaction; use psql environment variables, never URL in command/log.
- [x] Run against disposable PostgreSQL and read-only production observation; record negative production result.

## Task 4: Migration and regression validation
Files: DB test additions and `docs/incident-2026-10-28/db-apply-plan.md`.
- [x] Audit SQL and production schema mismatch, test transaction failure/retry and new/old rule contracts using local databases.
- [x] Run existing native PostgreSQL concurrency, unit, type and root/Pages distribution checks. Preserve source files unchanged.
- [x] Document object counts, impact, separate approvals, transactional apply/preflight and postcommit recovery.

## Task 5: Independent review and Draft PR
- [x] Independent adversarial review of the final changes; reproduce and fix material findings, rerun affected checks.
- [x] Save evidence/report, update release runbook, commit on new branch and submit separate Draft PR; no merge/publish.
