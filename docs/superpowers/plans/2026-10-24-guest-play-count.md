# Guest Play Count Implementation Plan

> Use superpowers:executing-plans. The user requested implementation and publishing; proceed through verified manual merge and Pages deployment.

**Goal:** 匿名プレイを重複なく回数のみ集計し、公開ページへ反映する。
**Spec:** `docs/superpowers/specs/2026-10-24-guest-play-count.md`。
**Architecture:** 専用private表とRPC、既存statsへのtakkeu分岐、独立したフロント送信待ちキュー。
**Tech Stack:** TypeScript / Postgres / Supabase / Vitest / Playwright / GitHub Pages。

## Constraints / Review Focus
- 名前なしのラリー値・プレイヤー行・ランキング行を作らない。
- ACK喪失や複数開始の再送で回数を二重登録しない。
- 通信・保存の障害でゲームを妨げない。
- 他ゲームと名前ありの連携を維持する。
- 検証済みmain SHAと公開SHAを照合する。

### Task 1: Count endpoint and persistent queue
- [x] `tests/unit/ranking.test.ts`で開始・再送・複数キュー・保存不可・異常応答をREDで確認。
- [x] `src/ranking/client.ts`へstartGuest、`guestPlays.ts`へrecord/retry、controllerの匿名分岐から起動。onlineで再送。
- [x] Supabase CLIでmigration作成。専用表・RPC・共通statsのtakkeu分岐を追加し、DB rollback検査とadvisorsを確認。

### Task 2: UI and regression verification
- [x] 名前なし開始・終了・再プレイ・503応答喪失・オフライン復帰のブラウザ検査を追加/更新。
- [ ] UI説明・manifest/schema・テスト用API差し替えを更新。名前あり回帰、型、全unit、影響browser、必須CIを通す。
- [x] DB・画像・ログの証拠を保存し、独立レビューを行う。

### Task 3: Publish and verify
- [ ] PRを作成し、必須CI成功後に手動マージ。既存Pages releaseの配備成功を確認。
- [ ] 公開release.jsonとmain SHA、匿名開始の集計+1、再プレイで+1、スコア非送信を確認し結果を報告する。
