# Result Screen Implementation Plan

> For agentic workers: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 記録を伸ばしたくなる44コメント・数字/電撃演出と全登録順位を1件のDraft PRで提供する。
**Architecture:** コメント純粋関数、SVG演出、個別送信通知、順位用コントローラー、追加SQL RPCに責務を分離する。
**Tech Stack:** TypeScript / DOM / SVG / CSS / PostgreSQL / Vitest / Playwright
**Spec:** docs/superpowers/specs/2026-10-25-result-screen-design.md およびユーザーの確定仕様

## Global Constraints
- 第1〜第5段階順。各段階をテストして次へ進む。
- 色境界300/500/800/1000/1500、コメント2000最上位固定。既存集計/再送/ゲーム/音響/操作/X/TOP30を維持。
- 全データのブラウザ取得禁止。正確な個別送信成功後のみ順位。古い応答を表示しない。
- 正式ログ・失敗ログ・監査結果を保存。実機未検証は明記。mainにmergeしない。

## Review Focus
- 古いキューが失敗/成功しても現在の結果を登録済みにしない → task3の個別通知テスト。
- 再プレイ準備中に旧順位応答が届いても表示しない → task3/task5の遅延テスト。
- 長文コメント/9桁スコア/文字拡大でも画面内 → task4/task5の狭幅検証。
- reduce-motionを途中で切り替えても停止 → task2のライフサイクルテスト。
- 同点複数1位・除外・未初回・異ゲームを正しく集計 → task3のSQL fixtures。

### Task 1: 44コメント
- [x] `tests/unit/result-comments.test.ts` に全44区間の上下境界と2000超のテストを追加、RED確認。
- [x] `src/ui/resultComments.ts` の `resultComment(score:number):string` を実装しscreensから通常見出しとして使用。
- [x] 既存の固定見出しの検証を新仕様へ更新。unit全体を実行しcommit。

### Task 2: 数字と継続電撃
- [x] 色境界、形状変化、背前面、複数色、停止/再開/重複/破棄/reduce motionのREDテスト。
- [x] `src/ui/resultEffects.ts` に演出段階と `createResultEffects(host)`、`update(visible,score)` / `dispose()`。SVG二層・最大5本・30fps。
- [x] `src/ui/result.css` の光沢/虹色/コメント登場を実装。unit全体を実行しcommit。

### Task 3: DB集計と個別結果順位
- [x] 最新DB関数と権限をread-onlyで確認し記録。SQL fixturesと順位クライアント/非同期隔離のREDテスト。
- [x] CLIでmigration生成。takkeu専用RPC追加、同資格・同順位・総登録数を1スナップショットで取得。fixtureは分離DBで実行。
- [x] `client.position(normalizedName)` とcontrollerの個別通知、`resultPosition.ts` を実装。`createApp`/screensへ接続。
- [x] 送信失敗/再送/遅延/除外/30位超/100位超を検証。必要な安全な追加migrationを適用・read-onlyで既存順位と比較。未適用なら明記。commit。

### Task 4: レイアウト
- [x] 画面順序・順位状態・ゲスト非表示・読み上げ・ボタン寸法・狭幅のテスト。
- [x] スコア→コメント→順位→best→全操作→TOP30に整理。短い登場/間隔/背景/モバイル調整。
- [x] unit/対象browserを確認しcommit。

### Task 5: 回帰・正式検証・Draft PR
- [x] 全unit/typecheck/browser/release build/performance/audit。失敗を調査修正しログ保存。
- [x] Chromium/WebKit 402×874/320px、全44文言、主要演出動画または連続スクリーンショット。実機未確認を明記。
- [x] 独立した最終コードレビュー、指摘修正と全体検証、証跡とPR本文作成。
- [ ] 専用ブランチpush、1件Draft PR、mainへはmergeしない。
