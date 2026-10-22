# Three.jsで参考画像の画角・3D描画を再構築

2026-10-22。PR #7マージ後の main `adc13ba` を基準とする。前回は配色を寄せた一方、視点が高く台が小さかった。ユーザーの指摘と「three.jsベースで作り直してください」に従って修正する。元のThree.jsエンジンを利用し、カメラ・モデル・材質・照明・フレームを作り直す。

## 変更と要件差分

- 固定の低い視点 `(0.34, 1.3, 3.4)` と、少し右から見た透視投影。参考画像の手前／奥の台幅比（約2.7）と奥行き／手前幅（約0.44）を検査する。
- 台全体を描画領域の約9割の横幅で見せる。PC・スマホ縦・横のレイアウトを調整し、縦画面は描画と指用の操作領域を分ける。
- 緑の台に連続した陰影、白線、細かいネットと支柱、厚み・脚・補強材、木目の床と壁、柔らかい床影。赤青のラケットを木の縁・表裏のラバー・傾いた柄で再構成。小さな生成テクスチャを使い、元の参考画像自体は配布しない。
- 大きすぎたラケットの初期半径を0.20から0.12へ変更。見た目と返球判定に同じ半径を使う。画角に収まる移動範囲と相手の配球を共通化し、回転でも範囲を変えない。全ジオメトリの頂点を投影し、操作端でも面と柄が収まることを検査する。
- ワンバウンド後の見える接触・失球下端、球速、加速・予約・全19段階の条件を維持。新しい視点のため接触位置は変わる。相手人物の表示サイズ・スマッシュの構えの高さを新画角へ合わせるが、予告の時刻や音は変更しない。
- ホームの旧SVGを実際のThree.js描画から生成した静止プレビューへ変更。画像はViteのハッシュ付きassetsへ同梱し、ルートと /takkeu/ で読み込む。
- 全テクスチャを一度ずつ解放。停止中の不要描画、省画素設定、保存、音声、中断復帰、既存の自動公開を維持する。

正式設計書の冒頭と初期調整値にも差異を記録する。

## 失敗と修正の記録

- 基準の最初の単体検査は93成功・公開SHA検査1件失敗。Node子プロセスの起動がsandboxのEPERMで拒否され、stdout/stderrが空だった。必要な実行権限を付けた同じコマンドの再実行は94件成功。製品コードを変更して回避していない。baseline-sandbox.log / baseline-unit.log。
- 新規の構図検査は旧カメラの手前／奥幅比1.815を検出して失敗。木目・影の資源解放検査も旧版にテクスチャがなく失敗。framing-before.log。
- カメラ変更直後は旧モデルの頭の固定座標、旧視点の最初のバウンド位置、球の両端で投影半径が同じという検査が不一致。実モデルの姿と新視点の投影へ更新し、接触前禁止・高速球・重複防止・失球の検査を維持した。unit-first.log / unit-second.log。
- 新画角で操作端のラケットが画面外へ出ることを追加検査で検出。入力と配球を同じ固定の可視範囲へ制限した。回転した円の外接箱には実際に描かれない空の角があるため、面と柄の実頂点を検査する。paddle-bounds-before.log / unit-third.log / unit-fourth.log / unit-fifth.log。
- 旧画角で最上端へ置くブラウザ検査は、新画角では球と重ならず失敗。新しい見えるバウンド位置へ実ドラッグして返球する検査へ変更。到着予約を読まない3ラリー検査は維持した。visual-contact-iteration.log / visual-contact-final.log。

- ホーム画像の検査は旧SVGにimgがなく失敗し、新プレビューで両ブラウザ成功。配布監査は画像を許可していなかったため一度失敗し、プレビューのハッシュ付きPNGだけをPNGヘッダー照合付きで許可した。一般の追加ファイルや開発コードの禁止は維持。home-preview-before.log / preview-framing-after.log / preview-distribution-before.log / preview-distribution-after.log。

## 正式検証

正式対象 **c4a277126799156ae2e974905c36b958f3e5c0f3**、2026-10-22 18:12:53〜18:24:09 UTC。`TAKKEU_VERIFICATION_DIR=docs/verification/reference-threejs node scripts/verify-stage3.mjs` で実行。対象98ファイルのSHA-256、コマンド、終了コード、日時、ログと配布物のハッシュを [final-verification.json](final-verification.json) に保存した。ソース変更なしで全コマンド終了コード0。`passed`は記録コマンドの成功であり、下記の連続負荷や実機合格を意味しない。

| 項目 | 判定 | 根拠 |
|---|---|---|
| 型検査 | 成功 | final-typecheck.log |
| 単体99件／22ファイル | 成功 | final-unit.log/json。新画角、描画と接触の投影一致、全操作端の実頂点、球の移動区間と高速接触、資源解放。 |
| 画面58件（各ブラウザ29件） | 成功 | final-browser.log/json。失敗・skip・flaky 0。実ドラッグ3ラリー、縦横・中断・復旧・保存・音声失敗、全19段階、4球450の30秒、再挑戦20回・ホーム往復20回。 |
| ルートと /takkeu/ の配布ビルド・画面4件 | 成功 | final-distribution.log、final-release.json。画像読み込み、対象SHA、得点URL無効、開発経路404・fixtureの非混入。 |
| 4球の進行・描画資源 | 成功（機能検査） | four-ball-chromium/webkit.json。30ゲーム内秒で450→482、4球を維持。draw calls44〜56、geometry50〜56（初回表示で増加）、textures4、programs12。20回反復でも増殖なし。実時間の性能合格とは分ける。 |
| Linux実フレームの連続負荷60秒 | **失敗（連続プレイ未成立）** | Chromiumの実ゲーム進行0.05秒、WebKitは0秒でslow-frame停止。いずれも実スマッシュ0回。採取コマンド2件の成功と区別する。 |
| iPhone 17 Pro Safariの実機操作・性能 | **未確認** | 実機なし。Linux WebKit／iPhone 13プロファイルを代替合格にしない。 |
| 人の試聴・390点滅安全性の最終評価 | **未確認** | [画像・映像・音の確認範囲](visual-review.md)。 |

### CIで見つけた検査の同期不良

最初のCI [39829519243](https://github.com/chameleonjp-lab/takkeu/actions/runs/39829519243) は型・単体99・配布4が成功、画面は57成功・1失敗。停止中にviewportを変更し、32msのテスト時計を進めた直後、まだネイティブresize通知が届かず、描画回数が8のままだった。ゲームのタイマーと、ブラウザが通知するリサイズは別の非同期処理である。ci-first.log / ci-first-jobs.json、ci-resize-first-trace.zip、ci-resize-first.png に保存した。トレースでは32msのテスト時計の処理は実時間1.43msで完了しており、ネイティブ通知の待機にはならない（ci-resize-timings.json）。

通知に伴う描画が増えるまで `expect.poll` で待ってから、その後の不要描画がないことを検査する。停止中・終了中の固定、回転後の描画、再開後の描画の各条件は維持。**ゲーム本体は変更していない**。検査同期だけを変更した対象 **81e2957ac890309d18aa61d5cc244bed4b2ae505** の両ブラウザ各3回、合計6件が成功。型検査も成功。resize-sync-after.log、resize-sync-browser.json、resize-sync-typecheck.log、[差分と98ファイルのハッシュ](resize-sync-verification.json)を保存した。正式対象との差分は tests/browser/render-loop.spec.ts の1ファイルだけである。

同期修正後のCI [39831564379](https://github.com/chameleonjp-lab/takkeu/actions/runs/39831564379) は **全工程成功**。型・単体99・ルート／Pages配布4・画面58件が成功。ci-final.log、ci-final-run.json、ci-final-jobs.jsonに全文ログと完了状態を保存した。これにより、製品本体を変えずに検査の同期を修正した81e2957でも全工程を再検証できた。

### 構図の計測と媒体

[framing-chromium.json](framing-chromium.json) / [framing-webkit.json](framing-webkit.json)。PC1280×720、縦390×844、横874×402の両ブラウザで、手前／奥の台幅比 **2.7167**、台の奥行き／手前幅 **0.4397**。手前幅の画面占有率はPC88.53%、縦89.36%、横92.00%。参考画像の約2.7／0.44と近いことを数値と実描画で確認した。

[比較用の3D描画](screenshots/reference-pose.png) · [PC画面](screenshots/screen-1280x720-desktop.png) · [縦画面](screenshots/screen-390x844-phone.png) · [横画面](screenshots/screen-874x402-phone.png)

画像34点・動画6本・合成WAV10本。[media-manifest.json](media-manifest.json)に対象SHA・バイト数・ハッシュを保存。比較用の1枚は製品のThree.jsレンダラーをそのまま使い、プレイヤーのラケット位置だけを参考画像に近い位置へ置いた静止描画である。実入力や実時間の速度検査とは扱わず、reference-pose.json/mjsで条件を記録する。3ラリー動画もテスト時計で制御しており、人の試遊や実機性能を証明しない。

Linux採取のp95はChromium16.7ms／WebKit17ms、25ms以下の割合99.97%／99.95%だが、ほぼ停止中の値であるため性能合格に使わない。performance-chromium/webkit.jsonに全間隔・端末条件・実進行・状態を保存した。正式目標「iPhone 17 Pro Safari、4球・390以降・スマッシュを含む60秒、95%以上25ms以下」は未確認のまま。

## 残る実機確認と公開

iPhone 17 Pro Safari実機、音の試聴、390ラリーの安全性の最終測定は未確認。Linux自動検査を実機合格へ代用しない。連続負荷は停止中の値を分けて評価する。変更は新しいDraft PRで提出し、自動マージは行わない。[Draft PR #8](https://github.com/chameleonjp-lab/takkeu/pull/8)へ提出した。ユーザーがDraftを解除しChecksを確認してmainへマージすると、既存のPages releaseが同じコミットで検査・ビルド・配備する。手動のexpected_sha照合も維持。公開後は /takkeu/release.json とActionsのSHA、縦横の返球・リトライを確認する。問題があれば [公開・revertによる復旧手順](../../release.md) に従う。修正版の公開実行・自動マージ・課金変更・ランキング追加は行っていない。
