# Canonical C — complete CI4 evidence

[CI run40241944794](https://github.com/chameleonjp-lab/takkeu/actions/runs/40241944794) passed all6 jobs on attempt1 for exact canonical commit `d30aa196f2faccd88fab36de4b94bb585c21b464`.

- Source tree: `47bd0f370ad169de00c77b37bb74429b63020d44`.
- Tests tree: `097b10b95f55aded9d77af6dd4ed6b85925b9684`.
- Typecheck, unit tests, root/Pages builds, release checks, all4 browser jobs and final verify succeeded.

| Check | Passed | Skipped | Failed/unexpected | Flaky | Retried cases |
|---|---:|---:|---:|---:|---:|
|Unit tests,71 files|958|0|0|Not separately reported|Not separately reported|
|Root/Pages release|8|0|0|0|0|
|Chromium interaction|94|0|0|0|0|
|Chromium load|3|0|0|0|0|
|WebKit interaction|94|0|0|0|0|
|WebKit load|3|0|0|0|0|

The browser matrix passed194 executions. The release matrix passed8. Including958 unit tests, the total is1,160 test executions. All Playwright test attempts have actual status `passed`; every JSON report has zero top-level errors, skipped/flaky/unexpected cases and retries. The Vitest console reports958/958 tests in71/71 files passed, with no skipped/failed tests; it does not provide separate flaky/retry/error JSON fields.

`proof-counts.json` is the normalized count/provenance record for the PR. `summary.json` includes all job and step conclusions. `test-results-summary.json` inventories every Playwright case, its attempt statuses and exceptions. All original formal reports are preserved in `selected/` and in the canonical ZIP parts.

## Exact, complete original evidence

`run-metadata.json`, `jobs.json` and `artifacts-metadata.json` are full original GitHub API responses. All6 complete job logs are directly readable as `job-<id>.log`, copied byte-for-byte from the workflow archive's canonical combined-job members.

The original workflow ZIP contains72 entries. All5 original artifact ZIPs contain1,034 entries in total, including every log, JSON result, screenshot, audio recording, trace and HTML report. Nothing was dropped. Their original ZIP bytes are retained without recompression in `archives/*.part-NNN`, each at most32MiB. The interaction ZIPs are136,247,545 and75,446,472 bytes, stored as5 and3 parts.

`archive-manifest.json` records original ZIP/part byte sizes and SHA256, every ZIP member's size/SHA256/CRC32, ZIP integrity, exact concatenation back to the original bytes, and exact extraction checks. All5 artifact ZIP digests match GitHub's original metadata. `archive-verification.log` preserves the full successful verification output. `file-manifest.json` inventories all repository evidence files.

`selected/` contains the original formal logs, JSON reports and revision/version information for direct reading. Large unsplit original ZIPs and full extracted trees are retained outside the repository at `/workspace/rally-ci-originals/40241944794`; they are not required for recovery. Every original archive and member can be restored from repository parts alone:

```sh
python3 docs/verification/rally-4000/ci/40241944794/restore.py --extract
```

The default output is `/workspace/rally-ci-restored/40241944794`. `--verify-only` checks canonical parts without writing ZIPs; `--archive artifact-12617231515.zip` selects the core artifact.

## Scope and quiet-window provenance

CI validates canonical C's exact runtime/tests. A later documentation-only D commit must use the separate runtime byte/mode equality proof to inherit this evidence. This CI result does not replace local performance-target checks, flash-screening analysis, human listening or physical-device verification.

`monitor-120s.log` preserves small status monitoring. No job-log/artifact download, ZIP/hash work or large I/O occurred during the isolated FULL16 performance run. Full archival began only after the root agent's explicit quiet-lock release at2026-10-25 23:15:17UTC. Retrieval used existing configured GitHub CLI/connector authentication; no credential file was read and no temporary signed URL was retained. This task changed evidence files only, with no source/assertion changes, staging or commits.
