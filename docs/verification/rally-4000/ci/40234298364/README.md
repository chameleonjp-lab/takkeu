# CI2: successful run40234298364, commit0cfdc7e

All6 jobs passed for exact commit `0cfdc7e696ca5cf857ec38e9915b9806bd8055d0`, attempt1, push event. This is the source before the wide-field/priority corrections. It does not verify the latest0285168 source, its958 local unit tests, or later safety/performance work.

| Check | Passed | Skipped | Failed/unexpected | Flaky |
|---|---:|---:|---:|---:|
|Unit tests,70 files|946|0|0|0|
|Root/Pages release tests|8|0|0|0|
|Chromium interaction|94|0|0|0|
|Chromium load|3|0|0|0|
|WebKit interaction|94|0|0|0|
|WebKit load|3|0|0|0|

Browser matrix total is194 test executions. All Playwright JSON reports have empty top-level errors, no skipped/flaky/unexpected cases and no retried cases. Core typecheck and root/Pages builds also passed. `summary.json` records job/step conclusions; `test-results-summary.json` records every Playwright case and its execution statuses. Original logs/reports remain available below.

## Complete canonical evidence

`run-metadata.json`, `jobs.json` and `artifacts-metadata.json` are full original GitHub API responses. All6 decoded complete job logs are readable as `job-<id>.log`. The original workflow archive has72 entries. All5 artifact archives, including screenshots, audio, traces and HTML reports, have1,033 entries in total; none were omitted.

Original ZIP bytes are split without recompression into `archives/*.part-NNN`, each at most32MiB. `archive-manifest.json` records every part's SHA256/size, every original archive's SHA256/size, every member's SHA256/CRC32/size, successful ZIP integrity, exact byte reconstruction and exact extraction verification. All5 artifact ZIP SHA256 digests match GitHub metadata. `archive-verification.log` is the complete successful local verification output.

The two interaction ZIPs are134,490,484 and78,587,038 bytes, saved as5 and3 parts respectively. Their large unsplit originals and full extracted trees are retained outside the repository under `/workspace/rally-ci-originals/40234298364`. They are unnecessary for recovery because every byte is in the canonical parts. The smaller archives are also retained as single parts. `selected/` makes formal logs, original JSON reports and revision/version information directly readable without unpacking the binary evidence.

To reconstruct all original ZIPs and verify their contents:

```sh
python3 docs/verification/rally-4000/ci/40234298364/restore.py --extract
```

The default output is `/workspace/rally-ci-restored/40234298364`, outside the repository. `--verify-only` hashes all canonical parts without creating restored ZIPs; `--archive artifact-12613879236.zip` selects one archive.

GitHub CLI retrieved metadata and the original workflow ZIP. The GitHub connector retrieved all original artifact ZIPs and complete decoded individual job logs. Small returned files used the file download tool; large files used their temporary authorized file-download URLs. No signed URL or credential was stored in this evidence. No production source, test assertions, workflow settings or commits were changed by this archival task.
