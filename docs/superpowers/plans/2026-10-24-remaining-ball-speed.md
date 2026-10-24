# Remaining Ball Speed Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task-by-task.

**Goal:** 指定の残球加速と待機球非表示を実装し、証拠付きDraft PRを作成する。
**Architecture:** ReturnPlanに独立倍率を保存し、相手打球時にschedulerで確定する。presentationの共通ゲートで待機状態と相手コート領域を判定する。
**Tech Stack:** TypeScript, Three.js, Vitest, Playwright.
**Spec:** `docs/superpowers/specs/2026-10-24-remaining-ball-design.md`

## Global Constraints
- 100以上、1球2 / 2球1.5 / 3球1.25 / 4球以上1。相手打球時固定。既存全球加速・smashは維持。
- 待機は影・発光も非表示。相手側は解放領域だけ。ランキング・共有・画面構成は維持。
- Draft PRまで。mainへmergeしない。

## Review Focus
- 同一tick内で失球・得点・打球が交錯してもイベント順の生存数を使用する。
- 予告後に出発が延期されても予告重複や短縮を起こさない。
- 540を跨いだ飛行中の球の位置と追加倍率を保存する。
- 非表示の待機球も残球・予約に含める。
- リトライで前runの速度と描画を持ち越さない。

### Task 1: Flight timing and departure commitment
**Files:** `src/game/{types,difficulty,flightSpeed,scheduler,simulation}.ts`, `tests/unit/remaining-ball-speed.test.ts`.
**Interfaces:** ReturnPlan/ReturnRequest.remainingBallMultiplier?: number; remainingBallMultiplier(score, count); flightDurationの第5引数は独立倍率。
- [x] 実飛行時間、出発時の残数、飛行途中の失球、重複予約、450/540/555、位置保存・接触・停止/再開/リトライの検査を作成し、未実装による失敗を保存する。
- [x] 打球時再予約と独立倍率を実装し、対象unitと全unit・型検査を成功させる。

### Task 2: Visibility and evidence
**Files:** `src/render/presentation.ts`, `tests/unit/presentation.test.ts`, `tests/unit/waiting-visibility.test.ts`, `tests/helpers/*`, `tests/browser/remaining-ball.spec.ts`.
**Interfaces:** isBallVisibleは飛行状態・発光・解放領域を同時に満たす時だけtrue。
- [x] 待機と領域解放の失敗検査を先に作成する。旧仕様を明示した2つの既存検査は新仕様へ更新する。
- [x] 共通ゲートを修正し、描画インスタンスも検査する。
- [x] iPhone縦WebKit画像、実飛行時間の記録、全既存検査の結果と失敗原因を保存する。

### Task 3: Review and delivery
- [x] 全差分をレビューし、必要な修正を再現テストとともに実施する。
- [x] 型・unit・browser・root/Pages配布を検証する。検証結果・未確認事項を文書化する。
- [x] コミットをpushしDraft PRを作成する。CIの結果を確認し、mergeしない。
