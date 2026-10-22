# タッケウの公開手順

第3段階は配布用ビルドと手順の準備まで。Pages設定の有効化・公開・マージは実行していない。
**iPhone実機・試聴・390映像の最終点滅判定が未確認の間は、公開可能と扱わない。**
[受入表](verification/acceptance.md)、[音の確認記録](verification/audio-review.md)、第3段階Draft PRの残件を先に確認する。

## 公開前にユーザーが行うこと

1. iPhone 17 ProのOS/Safari版、縦横、音量、品質、低電力モード等の条件を記録する。4球・390・420・450・最大速度付近を検証し、60秒の描画間隔の95%以上が25ms以下であるか測る。操作・回転・アプリ切替・画面ロック・音声復帰・VoiceOverも確認する。
2. 自分音・相手音・4球の重なり・予告音を実際に聴き、識別と快適さを記録する。390の実動画を確認し、[WCAG 2.3.1](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html)の頻度・明るさ・面積・赤色を判断する。不適合は表示を調整し再検証する。
3. レビューを終え、ユーザーがPRをmainへマージする。自動マージは使用しない。
4. 公開する**mainの完全な40文字SHA**を確定する。PR headとマージ後SHAは別の場合がある。検証済みコミットと公開対象の差分を確認し、ゲーム・入力・音・描画・設定・依存・配布設定に変更があれば該当検証をやり直す。実機・試聴・映像の対象SHAと結果をPR／検証記録へ紐付ける。
5. 必須の未確認がなくなった後に、GitHubのSettings → PagesでSourceをGitHub Actionsにする。この設定はユーザーが行う。github-pages Environmentの承認者・main限定の配備規則も設定することを推奨する。

## 手動公開

Actions → **Manual Pages release** → Run workflowで、ブランチを`main`、`expected_sha`を上記の完全SHAにする。

ワークフローはそのSHA自体をcheckoutし、現在のmainと一致することを照合する。短縮SHA、別ブランチ、古いSHA、検査中に進んだmainは拒否する。PRのCIは読取権限だけで動く。

同じcheckoutで依存導入、型、単体、Chromium/WebKit画面検査、ルート／`/takkeu/`の配布検査を実行する。最後に作った`dist`だけをPages成果物へ保存する。配備直前にもmainのSHAを再照合し、**同じ実行の検査済み成果物**を配備する。配備ジョブで再ビルドはしない。検査失敗時は配備へ進まない。

`release-verification-<expected_sha>`成果物に全文ログ、`revision.json`、配布物のSHA-256、画像等を90日保存する。公開対象の`release.json`にもコミットと基準パスを含める。実行URLと公開対象SHAを公開記録へ残す。mainが進んだ場合は、新しい対象を確認して新しい手動実行を行う。同時配備は直列化する。

## 公開後の確認

- `https://chameleonjp-lab.github.io/takkeu/release.json`の`commit`が`expected_sha`、`base`が`/takkeu/`であることを確認する。キャッシュを避けるため再読込やクエリー付き取得も使う。
- `/takkeu/`の入口と全JS/CSSが200で読み込まれ、コンソールに例外がないことを確認する。
- iPhone縦横とPCで開始、相対操作、停止・手動再開、結果、再挑戦、ホーム、保存、音の切替を短く試す。
- `?score=450&debug=1`でも0ラリー・1球から始まること、`tests/fixtures/stage3.html`等の開発用ファイルが配信されないことを確認する。
- 不具合があれば公開記録へ症状・端末・対象SHAを残し、次の手順で戻す。

## 以前の承認済み版へ戻す

1. 公開記録と`release.json`から直前の正常な公開SHAを特定し、その検証記録・成果物を確保する。
2. mainを強制更新しない。正常版との差分を戻すブランチを作り、問題の変更をrevertしたPRを作る。マージコミットを戻す場合は正しい親を確認する。公開のSHA照合と手動実行の仕組みは維持する。
3. 復旧PRの型・単体・画面・配布検査を通し、戻すゲーム内容と既存実機・音・映像の証拠を比較する。差異があれば再検証する。ユーザーが復旧PRをマージする。
4. **復旧後mainの新しいSHA**を`expected_sha`として手動公開する。過去SHAをそのまま入力して最新mainの照合を回避しない。
5. 公開後確認を繰り返し、障害版／正常版／復旧版のSHAと実行URLを記録する。

## ローカルでの配布確認

Node/npmはリポジトリの固定版を使う。

```sh
npm ci
npx playwright install --with-deps chromium webkit
npm run typecheck
npm run test:unit
npm run test:browser
npm run verify:release
```

`verify:release`はルート用ビルドを`artifacts/root-dist`、Pages用を`dist`へ作り、それぞれ実ファイルだけを配信するサーバーで確認する。`npm run build:pages`は`/takkeu/`用の単独ビルド。開発サーバーは公開に使わない。
