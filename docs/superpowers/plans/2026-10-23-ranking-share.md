# Ranking and Share Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task-by-task.

**Goal:** 任意の名前で実験場ランキングへ参加でき、結果共有・再プレイ・上位30名表示・自動公開まで行える状態にする。

**Architecture:** 既存のThree.jsゲームへ独立したRESTクライアントと送信待ちキューを接続する。マニフェストを連携設定の正とし、既存の共通RPCで開始と終了を一意に記録する。

**Tech Stack:** TypeScript, Three.js, Vite, Vitest, Playwright, Supabase REST, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-23-ranking-share-design.md`

## Global Constraints
- 名前は任意、指定時1〜20 Unicode code points。整数ラリー数の降順、開始時に1回加算。
- 正式URLは`https://chameleonjp-lab.github.io/takkeu/`。`game_slug=takkeu`、`client_version=takkeu-web-ranking-1`。
- 失敗しても結果・再プレイ・シェアを維持し、送信待ち記録を再プレイで消さない。
- 既存の物理・操作・自己ベスト・設定を維持する。

## Review Focus
- 開始受付後の応答喪失でも、同じ開始IDで1回だけ数える。
- 再プレイ中に古い通信が完了しても、新しい結果表示を上書きしない。
- 保存禁止・オフラインでも名前なしでプレイでき、記録再送を妨げない。
- 悪意のある表示名をHTMLとして解釈せず、同率順位をそのまま表示する。
- PagesのサブパスでもOG画像・シェアURL・マニフェストが正しく配布される。

### Task 1: Ranking contract and queue
**Files:** `ranking-manifest.json`, `src/ranking/config.ts`, `src/ranking/client.ts`, `src/ranking/controller.ts`, `tests/unit/ranking.test.ts`.
**Interfaces:** `createRankingClient()` supplies start/finish/submit/top; `createRankingController(storage, api, onChange)` persists names, starts and queued results.
- [x] Write and run failing tests for guest, Unicode limits, timeout, response validation, idempotent retries and persisted queues.
- [x] Implement the client and controller; run `npm test` and typecheck.
- [x] Register the manifest's game as inactive in existing `public.games`; inspect RPC grants and registration values.

### Task 2: Game and result UI
**Files:** `src/ui/screens.ts`, `src/ui/styles.css`, `src/app/createApp.ts`, `src/render/createView.ts`, `tests/unit/ranking-screens.test.ts`, `tests/browser/ranking.spec.ts`.
**Interfaces:** optional name, start pending state, submission state, fresh leaderboard and share link in `createScreens`; app owns current play and result transitions.
- [x] Write/run failing UI tests for optional names, replay placement, sharing, escaped names and top30.
- [x] Connect start/finish/retry/home without introducing gameplay waits for guests; clear run caches on reset.
- [x] Run unit/type checks and Chromium/WebKit ranking and regression browser tests.

### Task 3: Share image and verified deployment
**Files:** `public/og-takkeu-v1.png`, `index.html`, `vite.config.ts`, `.github/workflows/deploy.yml`, `tests/release/distribution.spec.ts`, `README.md`, `docs/verification/ranking-share.md`.
**Interfaces:** static OGP/Twitter metadata, published manifest/release revision, main-triggered verified deployment.
- [x] Capture actual gameplay, create/inspect the 1200×630 thumbnail and set metadata.
- [x] Verify root/Pages builds, image access, manifest schema and unchanged canonical URL. The user-authorized optional-name contract is validated with the game-specific schema; the common schema amendment was not published.
- [ ] Independently review changes, address substantial findings, create PR and pass required CI.
- [ ] Merge the verified PR, enable game registration, verify live APIs and Pages release SHA, record evidence and known verification limits.
