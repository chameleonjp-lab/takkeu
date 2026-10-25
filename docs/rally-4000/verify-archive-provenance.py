#!/usr/bin/env python3
"""Check that a CI-evidence follow-up changes documentation only.

The canonical commit must already have completed the formal checks. This is
an equality check, not a replacement for tests or a claim about skipped CI.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
EXTRA_INPUTS = {
    "docs/rally-4000/verify-archive-provenance.py",
    "docs/rally-4000/refresh-report-index.py",
}


def git(*args: str) -> bytes:
    return subprocess.check_output(["git", *args], cwd=ROOT)


def is_input(path: str) -> bool:
    return not path.startswith("docs/") or path in EXTRA_INPUTS


def manifest(revision: str) -> dict[str, dict[str, str]]:
    result = {}
    for entry in git("ls-tree", "-rz", revision).split(b"\0"):
        if not entry:
            continue
        metadata, encoded_path = entry.split(b"\t", 1)
        path = encoded_path.decode()
        if is_input(path):
            mode, kind, object_id = metadata.decode().split()
            result[path] = {"mode": mode, "kind": kind, "gitObject": object_id}
    return result


def digest(value: object) -> str:
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(encoded).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("canonical", help="Exact commit whose full CI passed")
    parser.add_argument("--output", type=Path, help="Optional evidence JSON destination")
    args = parser.parse_args()
    canonical = git("rev-parse", "--verify", args.canonical + "^{commit}").decode().strip()
    before, head = manifest(canonical), manifest("HEAD")
    mismatches = []
    for path, row in before.items():
        target = ROOT / path
        if not target.exists() and not target.is_symlink():
            mismatches.append({"path": path, "reason": "missing working input"})
            continue
        current = os.readlink(target).encode() if target.is_symlink() else target.read_bytes()
        expected = git("show", f"{canonical}:{path}")
        mode = "120000" if target.is_symlink() else "100755" if target.stat().st_mode & 0o111 else "100644"
        if current != expected or mode != row["mode"]:
            mismatches.append({"path": path, "reason": "working bytes or mode differ"})
    untracked = [p.decode() for p in git("ls-files", "--others", "--exclude-standard", "-z").split(b"\0") if p]
    unexpected_inputs = [p for p in untracked if is_input(p)]
    changed = [p.decode() for p in git("diff", "--name-only", "-z", canonical, "--").split(b"\0") if p]
    candidate_paths = sorted(set(changed + untracked))
    non_document_changes = [p for p in candidate_paths if is_input(p)]
    ok = before == head and not mismatches and not unexpected_inputs and not non_document_changes
    report = {
        "schema": "rally-4000-documentation-archive-provenance-v1",
        "canonicalCommit": canonical,
        "executionInputsMatch": ok,
        "inputCount": len(before),
        "canonicalInputManifestSHA256": digest(before),
        "headInputManifestSHA256": digest(head),
        "inputManifest": before,
        "workingInputMismatches": mismatches,
        "unexpectedUntrackedInputs": unexpected_inputs,
        "nonDocumentationChanges": non_document_changes,
        "documentationChangesSinceCanonical": candidate_paths,
        "scope": "All tracked paths outside docs/, plus the two documentation integrity checkers; modes and bytes checked against the canonical commit.",
        "ciInterpretation": "The archive HEAD may intentionally skip CI. A matching execution-input manifest does not make skipped CI passed. Original CI artifacts retain the canonical commit identity.",
        "selfReference": "No final archive commit ID is embedded here. Record that ID in PR metadata or the final response; rerun this checker read-only after committing.",
    }
    if args.output:
        destination = args.output if args.output.is_absolute() else ROOT / args.output
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"canonicalCommit": canonical, "checkedHead": git("rev-parse", "HEAD").decode().strip(), "executionInputsMatch": ok, "inputCount": len(before), "documentationPaths": len(candidate_paths)}, ensure_ascii=False))
    if not ok:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
