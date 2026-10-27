#!/usr/bin/env python3
"""Refresh documentation-only integrity and changed-file snapshots."""
from __future__ import annotations

import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASELINE = "aff31169fd6feaad7bad35f22fe3de26429296cf"
DESTINATION = ROOT / "docs/verification/rally-4000/protected-integrity.json"
INVENTORY = ROOT / "docs/rally-4000/changed-files.md"


def git(*arguments: str) -> bytes:
    return subprocess.check_output(["git", *arguments], cwd=ROOT)


def digest(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def comparison(path: str, group: str) -> dict:
    before = git("show", f"{BASELINE}:{path}")
    working = ROOT / path
    after = working.read_bytes() if working.is_file() else None
    return {
        "path": path,
        "group": group,
        "baselineSHA256": digest(before),
        "workingSHA256": digest(after) if after is not None else None,
        "bytewiseEqual": after == before,
    }


protected = {
    "src/ui/resultComments.ts": "PR26 result comments",
    "src/ui/resultEffects.ts": "PR26 result electricity",
    "src/ui/result.css": "PR26 result styling",
    "src/ui/screens.ts": "PR26 result markup/layout/integration",
    "src/ranking/resultPosition.ts": "PR26 acknowledged result position",
    "src/ranking/client.ts": "ranking network protocol",
    "src/ranking/controller.ts": "ranking queue/submission lifecycle",
    "src/ranking/config.ts": "ranking/share endpoints and configuration",
    "src/render/camera.ts": "camera/projection",
    "src/app/controls.ts": "input control integration",
    "src/app/loop.ts": "fixed-step loop",
    "src/app/lifecycle.ts": "pause/context lifecycle",
}
for prefix, group in (("src/game", "gameplay physics/progression"), ("src/input", "direct input mapping/timeline")):
    for path in git("ls-tree", "-r", "--name-only", BASELINE, "--", prefix).decode().splitlines():
        if path not in {"src/game/simulation.ts", "src/game/types.ts"}:
            protected[path] = group
rows = [comparison(path, group) for path, group in sorted(protected.items())]

simulation_before = git("show", f"{BASELINE}:src/game/simulation.ts")
simulation_expected = simulation_before.replace(
    b"contact?: Pick<GameEvent, 'smashReturn' | 'rallyScore'>",
    b"contact?: Pick<GameEvent, 'smashReturn' | 'rallyScore' | 'lossCount'>",
).replace(
    b"      ball.phase = 'lost'; emit('ball-lost', time, ball.id);",
    b"      ball.phase = 'lost';\n      emit('ball-lost', time, ball.id, undefined, sampleReturn(ball.plan, ball.from, time), undefined, { lossCount: state.lostBallCount + 1 });",
)
types_before = git("show", f"{BASELINE}:src/game/types.ts")
types_expected = types_before.replace(
    b"  smashReturn?: boolean; rallyScore?: number;\n",
    b"  smashReturn?: boolean; rallyScore?: number;\n  /** Confirmed cumulative loss count; position is copied at the exact loss time. */\n  lossCount?: number;\n",
)
exceptions = []
for path, expected, description in (
    ("src/game/simulation.ts", simulation_expected, "Only add optional lossCount event payload support and emit copied sampleReturn position plus cumulative lossCount at the existing loss boundary."),
    ("src/game/types.ts", types_expected, "Only add the optional GameEvent.lossCount fact and its explanatory comment."),
):
    row = comparison(path, "explicit event-fact exception")
    row.update({
        "allowedChange": description,
        "expectedAfterOnlyAllowedChangeSHA256": digest(expected),
        "matchesOnlyAllowedChange": (ROOT / path).read_bytes() == expected,
        "diff": git("diff", BASELINE, "--", path).decode(),
    })
    exceptions.append(row)

generated_at = datetime.now(timezone.utc).isoformat()
report = {
    "schema": "rally-4000-protected-integrity-v1",
    "generatedAtUTC": generated_at,
    "baselineCommit": BASELINE,
    "comparison": "baseline git blob bytes against current working-tree bytes, including uncommitted changes",
    "workingHead": git("rev-parse", "HEAD").decode().strip(),
    "workingBranch": git("branch", "--show-current").decode().strip(),
    "allStrictProtectedFilesBytewiseEqual": all(row["bytewiseEqual"] for row in rows),
    "allEventExceptionsMatchOnlyAllowedChanges": all(row["matchesOnlyAllowedChange"] for row in exceptions),
    "strictProtectedFiles": rows,
    "explicitExceptions": exceptions,
    "limitations": [
        "A working-tree snapshot, not a future guarantee; rerun after final changes.",
        "Byte equality and exact event-fact transformations do not establish visual, audio, performance, or hardware acceptance.",
        "Presentation-only reduced-motion edits in src/render/presentation.ts, celebrations.ts and particles.ts are intentionally outside strict gameplay byte equality and require their own behavior tests.",
        "No production ranking request, database mutation, deployment or external message is performed by this checker.",
    ],
}
DESTINATION.parent.mkdir(parents=True, exist_ok=True)
DESTINATION.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")

INVENTORY.parent.mkdir(parents=True, exist_ok=True)
INVENTORY.touch(exist_ok=True)
changed = {}
parts = git("diff", "--name-status", "-z", "--no-renames", "main", "--").split(b"\0")
for index in range(0, len(parts) - 1, 2):
    changed[parts[index + 1].decode()] = parts[index].decode()
for path in git("ls-files", "--others", "--exclude-standard", "-z").split(b"\0"):
    if path:
        changed[path.decode()] = "U"
groups = {"アプリ実装": [], "テスト・検証基盤": [], "設計・記録・証拠": []}
for path, status in sorted(changed.items()):
    if path.startswith(("src/", "public/")) or path == "index.html":
        group = "アプリ実装"
    elif path.startswith("docs/") or path.lower().endswith(".md"):
        group = "設計・記録・証拠"
    else:
        group = "テスト・検証基盤"
    groups[group].append((status, path))
lines = [
    "# 変更ファイル一覧（作業ツリー時点）", "",
    f"生成時刻: `{generated_at}`。比較先: ローカル `main` = `{git('rev-parse', 'main').decode().strip()}`。", "",
    "`git diff --name-status --no-renames main` の追跡済み変更に、`git ls-files --others --exclude-standard` の未追跡ファイルを加えた実測一覧。コミット済みブランチ変更と未コミット変更の両方を含む。`M`=変更、`A`=追加、`D`=削除、`U`=未追跡。証拠取得や最終修正の後に再生成する。", "",
    "再生成: `python docs/rally-4000/refresh-report-index.py`。同時に `docs/verification/rally-4000/protected-integrity.json` を更新する。", "",
    f"合計 **{len(changed)}** ファイル。実装・検証基盤・記録を別々に列挙し、件数を要件達成数として扱わない。", "",
]
for group, files in groups.items():
    lines += [f"## {group}（{len(files)}）", "", "| 状態 | ファイル |", "| --- | --- |"]
    for status, path in files:
        lines.append(f"| {status} | `{path}` |")
    lines.append("")
INVENTORY.write_text("\n".join(lines))
print(json.dumps({
    "strictProtectedFiles": len(rows),
    "allStrictProtectedFilesBytewiseEqual": report["allStrictProtectedFilesBytewiseEqual"],
    "allEventExceptionsMatchOnlyAllowedChanges": report["allEventExceptionsMatchOnlyAllowedChanges"],
    "changedFiles": len(changed),
    "groups": {group: len(files) for group, files in groups.items()},
}, ensure_ascii=False))
