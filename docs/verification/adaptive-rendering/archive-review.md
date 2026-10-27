# Final archive review addendum

**Local archive/restoration gate: closed. Readiness: Draft only; not ready or authorized to merge or deploy.**

This is the same independent reviewer's final addendum to `source-review.md` / archived `final-whole-branch-review.md`. The frozen pre-archive report is unchanged, SHA-256 `bac9436ae6f7780a33d0aa838733753edee5d6fa8beeb3ff234b7c860ec2a8c4`. This addendum lives outside the content-addressed archive to avoid self-reference. It closes Important item 4 of that report; it does not close the other Important findings.

The reviewed product remains `b0b6760610c17dc5a1f19efebf42049a31df1150`, compared with initial PR27 source `6ec38720b4f720c71bf48c5aef3cdc5732fdd578`. This review made no repository, index, HEAD, source, test, fixture, runner or frozen-evidence changes.

## Archive identity and independent checks

The reviewed bundle is `docs/verification/adaptive-rendering/evidence/`.

| Item | Verified value |
| --- | --- |
| Manifest | 10,854,900 bytes; SHA-256 `b7be8ecae0d850e4af0e27c12085a8593f1c8c5e99a6dd138e857d2442c6c5a6` |
| Concatenated archive | 3,634,514,451 bytes; SHA-256 `b345e28c6bf7f9ab11371e83a5cbe60258788d80123ac65f7dac504af3f7c9c0` |
| Parts | 434 sequential parts, each at most 8 MiB |
| Frozen source inputs | 5,991 files, 5,974,288,092 bytes |
| Restored ordinary files | 5,930 |
| CI artifacts / exact restored members | 61 / 12,888 |
| Total restored payload | 18,818 files, 6,644,483,018 bytes |
| New unique CAS objects | 6,630, totaling 4,232,923,325 bytes |
| Payload references | 10,458 new-object references, 92 old-file references, 8,268 old-member references |
| Referenced historical CI archives | 5, pinned through initial source 6ec |

I independently streamed and hashed every one of the 434 parts, checked each recorded size and SHA-256, and recalculated the concatenated archive size and SHA-256. All matched. I then independently streamed and hashed **every restored ordinary file and CI member** in `/workspace/takkeu-restored-evidence`, checked its manifest size/hash and reference metadata, and verified the exact restored file set with no extra/missing files or symlink payloads. All 18,818 matched. This was a separate read-only calculation, not acceptance of the verifier's success flag alone.

I compared the frozen source input file set and each size with the manifest, checked its total size/count against `evidence-input-freeze.json`, and checked that these inputs have no writable permission bits. All matched. Three `runners/__pycache__/*.pyc` cache files are intentionally outside this input set, consistent with `restore_evidence.py:43-44`; they are not claimed as archived evidence. The frozen review's manifest entry has the exact hash above. Both accepted flash evidence and rejected initial-clock-mismatch evidence are present, as are the failed baseline performance run and replacement pair.

I reviewed `restore_evidence.py` and the completed `restore-verification.log`. The public verifier and restored `runners/evidence-cas.py` are byte-identical, SHA-256 `c62a9317a90762519c94a4ed2de9c4d079b6446113bd218432c31259fe3edd8b`. Its checks cover part/archive hashes (lines 83-87), exact and nonduplicate CAS member names and object hashes (88-95), pinned historical file/ZIP checks (74-79, 100-107), and every resolved payload's size/hash (109-118). The completed full restoration reports 5,930 ordinary files, 12,888 CI members and five external archives verified. The independent full payload rehash corroborates the restored output.

The archive preserves exact CI **member bytes**, not the original 61 ZIP containers. This is explicitly represented by `originalZIPContainersRetained: false` and the verifier's opening documentation. I checked all 61 provider receipts for the recorded digest, expected/actual byte counts and ingestion/CRC verification fields; the earlier source review also checked raw CI logs, checkout/tree proofs and sampled original ZIPs. Exact original-container reproduction is not asserted. External historical dependencies are pinned and hash-checked; the bundle is not a standalone copy of every historical dependency. Successful restoration used the recorded references/cache, not a new unauthenticated source of equivalent-looking files.

## Strengths

- The archive binds the actual reviewed raw results, runners, failure records and frozen independent review. Accepted and rejected observations remain distinguishable.
- All payload hashes were checked after restoration, including reused historical bytes. Deduplication did not weaken the recorded per-file checks.
- CI source identity remains explicit: b0b push and the saved PR merge checkout `e7424bcdce86a7995c97b9b1dbb0f3f43785d696` have tree `89b634281d2fb056c115de1a865925fc178f1c22`; those results do not silently become tests against newer main.

## Findings

### Critical

None found within the reviewed source/evidence/archive scope.

### Important

1. **Absolute performance targets remain unmet.** The completed review independently recalculated 55 executions: final-source functional 44/44, all-source functional 54/55, absolute targets 0/55. The paused baseline outlier is retained and excluded with its whole pair from valid paired medians. Relative improvements do not establish smooth performance, pure CPU savings or physical-iPhone performance.
2. **Screening warnings remain.** Fresh canonical comparisons flag 9 baseline conditions versus 1 final condition; final 1000-low remains flagged. Corrected supplemental actual-physics standard and low both remain flagged (2 versus 2). All 720 corrected frame pairs matched the ten required equality keys. The original seven historical warnings are not unconditionally resolved, because some old/current baseline RGB differs for an unisolated reason. These limits in `safety.md` and the frozen review remain binding; this archive audit adds no safety or formal conformance clearance.
3. **Latest-main integration remains unverified.** Main independently advanced from `aff31169fd6feaad7bad35f22fe3de26429296cf` through `532025df5e40ce94556c0b90ede85f707933bc7f` and then to `628439f5907601c9b34ee2ba01f70c918b6e8d18`. I read the saved `docs/verification/adaptive-rendering/publication-before-remote-update.json`, observed at `2026-10-26T23:41:59.257343+00:00`: main is 628439f; PR27 remains open, Draft and unmerged at b0b, with `mergeable:false` and a null merge SHA while its base metadata still reports aff3116. Existing green merge CI used the older base. Treat the saved API result as an observed publication-time integration warning, not an identified code conflict or a new integration test. No source rebase, merge or conflict resolution was performed as part of this review. Current-main integration needs fresh validation before any later merge.

The previous fourth Important gate, full archive restoration, is **closed for the exact local manifest and bundle identified above**. Remote publication is a separate operation and is not certified by this local audit.

### Minor

The frozen report's historical diagnostic CLI revision-guard limitation remains deferred. Final reproduction documentation identifies the compatible archived runners; old entrypoints must not be represented as working against final source merely because they remain tracked. No new archive defect was found.

## Declined to judge

- Remote upload completion, remote branch/ref contents, final publication commit or remote checkout restoration; these had not been independently verified in this audit.
- Integration with latest observed main 628439f (or any subsequent revision), the cause of any latest reported nonmergeable state, or authorization to merge/deploy.
- Physical iPhone, HDR, human perception, formal flash-safety/WCAG conformance, unlimited-duration memory behavior, or live ranking/database effects. The frozen review's limits remain unchanged.
- Exact regeneration of provider ZIP container bytes, historical artifacts unrelated to claims used here, or future availability of the pinned external host. Exact restored member/file bytes were verified.

## Assessment

**The final local evidence archive is complete and restorable at the recorded hashes. The archive/restoration review gate is closed.** The production change and its candid evidence are suitable for the authorized Draft-only handoff, subject to completing and verifying publication. Keep the PR Draft. Performance targets, retained screening warnings and current-main integration remain unresolved; no merge, deployment or safety clearance is granted.
