# takkeu

タッケウ

Three.jsを基盤にした、ラリー継続型の卓球ブラウザゲームです。スワイプでラケットを動かし、すべての球を失うまでのラリー数を記録します。

## 現在の状態

**第3段階（T07〜T10）を実装しました。[ゲームを開く](https://chameleonjp-lab.github.io/takkeu/)。**

mainへPRをマージすると、型・単体・画面・配布検査に成功したコミットをGitHub Pagesへ自動反映します。SHAを指定する手動公開にも対応します。[公開・確認・復旧手順](docs/release.md)を参照してください。

最大4球のラリー、5ラリーごとの加速、全19行の虹色・部位解放、420の不可視、450以降の予告付きスマッシュに対応します。スマホの相対スワイプとPCドラッグで操作し、指を離すとラケットはその位置で止まります。

自己ベスト、効果音音量、ミュート、感度、描画品質を端末に保存します。回転・アプリ切替・描画や音声の中断時は一時停止し、再開操作を待ちます。保存や音声の失敗時も無音・メモリ内で継続できます。

iPhone 17 Pro Safari実機の操作・60秒性能・VoiceOver、人によるSEの試聴、390の最終的な点滅基準の判定は未確認です。自動ブラウザの成功や公開をこれらの合格として扱いません。[全要件の受入表](docs/verification/acceptance.md)に結果と未確認範囲を記録しています。

ラケットの柄と球の貫通表示、虹色球の白い中心の修正、および第1・第2段階と現行仕様の対応は[最新の再照合記録](docs/verification/paddle-stage12/README.md)を参照してください。実装・検証・公開の状態を分けて記録します。

## 開発

Node.js **24.19.0** / npm **11.9.0** を使用します。

```sh
npm ci
npx playwright install --with-deps chromium webkit
npm run dev
```

```sh
npm run typecheck
npm run test:unit
npm run test:browser
npm run build
npm run verify:release
npm run test:performance
npm run preview -- --host 0.0.0.0
```

ゲーム計算は `src/game/`、入力は `src/input/`、Three.jsの表示は `src/render/`、Web Audioは `src/audio/`、画面は `src/ui/` に分離し、`src/app/` が接続します。固定計算刻みは1/120秒です。画面更新が0.10秒を超えた場合は追いつき計算をせず停止します。

[実装記録](docs/progress.md)と[第3段階の検証記録](docs/verification/stage3/README.md)で、対象コミット、正式ログ、画面・動画・音生成の証拠、未確認範囲を追跡します。CIは型・単体・画面・ビルドを検査し、全文ログと対象SHAを成果物に保存します。

## 実装資料

| 文書 | 内容 |
|---|---|
| [要件・設計書](docs/superpowers/specs/2026-10-22-takkeu-design.md) | 確定ルール、全段階表、B方式の見え方、音、初期調整値、受入条件。 |
| [3段階の実装計画書](docs/superpowers/plans/2026-10-22-takkeu-implementation.md) | タスク、作成ファイル、処理の境界、検証、並行作業、PRの完了条件。 |
| [Codexへの段階別依頼文](docs/prompts/2026-10-22-takkeu-codex.md) | 第1〜第3段階を個別に依頼するための文章。 |
| [文書レビュー記録](docs/reviews/2026-10-22-takkeu-plan-review.md) | 計画文書の確認結果と、まだ実行していない検証の区別。 |

## 実装順序

1. 基本ラリー・スワイプ操作・自分と相手の返球音を実装する。
2. 多球・加速・全演出・スマッシュを実装する。
3. スマホでの中断復帰、音、保存、性能を確認し、配布と公開の準備をする。

各段階を個別のプルリクエストとして提出します。マージと公開はユーザーの判断で行います。オンラインランキングは初回計画に含めず、まず端末内の自己ベストを保存します。

