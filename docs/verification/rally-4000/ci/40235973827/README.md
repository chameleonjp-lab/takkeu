# CI3: successful run40235973827, commit0285168

All6 jobs passed for exact source commit `0285168e455b5ec71f4197b1acbf68f29b5d46a5`, attempt1, push event. This head includes the wide-field/shared-priority corrections. CI success is separate from final flash-screening, performance, human listening and physical-device acceptance.

| Check | Passed | Skipped | Failed/unexpected | Flaky |
|---|---:|---:|---:|---:|
|Unit tests,71 files|958|0|0|0|
|Root/Pages release tests|8|0|0|0|
|Chromium interaction|94|0|0|0|
|Chromium load|3|0|0|0|
|WebKit interaction|94|0|0|0|
|WebKit load|3|0|0|0|

Browser matrix total is194 executions. All5 Playwright JSON reports have empty top-level errors, no skipped/flaky/unexpected cases and no retries. Core typecheck and root/Pages builds also passed. `summary.json` records all job/step conclusions. `test-results-summary.json` records every Playwright case and its execution statuses. The complete original logs and reports are preserved.

## Complete canonical evidence

- `run-metadata.json`, `jobs.json`, `artifacts-metadata.json`: full original GitHub API responses; all6 jobs and all5 artifact archives accounted for.
- `job-<id>.log`: each complete job log copied byte-for-byte from its original combined-job member in the workflow ZIP. The early complete core log retrieved through the connector is retained separately as `job-121297514290.connector.log`.
- `archives/*.part-NNN`: original workflow ZIP and all5 original artifact ZIPs, split without recompression into parts at most32MiB. All5 artifact SHA256 digests match GitHub metadata. The workflow ZIP contains72 entries; the5 artifact ZIPs contain1,031 entries, including every screenshot/audio/trace/report.
- `archive-manifest.json`: original ZIP and part sizes/SHA256, all member sizes/SHA256/CRC32, ZIP integrity, byte-exact concatenation and byte-exact extraction checks.
- `selected/`: original formal logs, JSON reports and revision/version information are readable without restoring the binary evidence.
- `archive-verification.log`: complete successful local archive verification output. `file-manifest.json` inventories all repository evidence files.
- `monitor-120s.log`: read-only status monitoring at120-second intervals, without rapid polling.

Large original ZIPs and full extracted trees are outside the repository at `/workspace/rally-ci-originals/40235973827`. The interaction archives are136,459,033 and77,627,208 bytes and use5 and3 canonical parts. No original content was omitted. All original bytes and members can be recovered from repository parts alone:

```sh
python3 docs/verification/rally-4000/ci/40235973827/restore.py --extract
```

The default output is `/workspace/rally-ci-restored/40235973827`. `--verify-only` verifies the parts without creating ZIPs; `--archive artifact-12614971720.zip` selects the core archive.

GitHub CLI retrieved final metadata and the original workflow ZIP. The GitHub connector downloaded every original artifact ZIP. Small returned files used the file download tool; large files used their authorized temporary file-download URLs. No signed URL or credential was stored. Verification/splitting used low CPU/I/O priority and no recompression. This task changed no production source, test assertion, workflow setting or commit.
