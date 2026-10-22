# 第1段階の検証記録

対象は正式設計・実装計画のT01〜T03。基準mainは `2e7bbb5a123a9bf4d740c48dc794619430c76af4`。第2段階の進行・多球・全演出・スマッシュと、第3段階の保存・実機・公開準備は対象外。

## 検証方法

- `t01-red.log`：空の起動先にタイトルがないことを確認した失敗。
- `t01-browser-green.log` / `t01-build.log`：ホーム実装後のChromium/WebKit検査、型・ビルド。
- `t02-red.log` / `t02-green.log`：1球の計算、接触、高速球、バウンド、相手返球、加点・終了の失敗から成功への記録。
- `t03-unit-red.log` / `t03-unit-green.log`：相対入力、時刻付き入力、音イベント、描画の可視条件、実際の固定ループの記録。
- `t03-browser-red.log` / `t03-browser-green.log`：開始・操作・成功・失球・結果・再挑戦と停止・再開、画面証拠、実際の音生成。
- `t03-build.log`：T03の型検査とビルド。

`*-investigation.log` / `*-attempt.log` は途中の調査記録で、正式な成功ログと区別する。停止検査の失敗はWebKitのhover表示、画面証拠の失敗は撮影によるviewport変更が原因だった。ゲームの計算や停止条件を変更して試験を弱めていない。[実装記録](../../progress.md)に詳細を記載する。

## 実行環境

Linux Debian 13、Node.js 24.19.0、npm 11.9.0、Playwright 1.64.1付属のChromium / WebKit。WebKitのプロファイルはiPhone 13の390×664 CSSピクセル・倍率3を使用する。これは端末サイズのエミュレーションでありiPhone実機ではない。PCプロファイルは1280×720、横画面は844×390。

ローカルではroot認証が使えなかったため、公式Debian共有ライブラリを`/tmp`へ展開してWebKitの探索パスに配置した。Playwrightのldconfig依存チェックだけをスキップして実ブラウザを起動した。CIにはこの回避を含めず、Ubuntu 24.04で公式の `npx playwright install --with-deps chromium webkit` を実行する。

## 未確認・後続

- 人による自分／相手SEの聞き分け、音量・音色の快適さ、端末スピーカーからの再生。自動合成・WAV生成・イベント分離だけを確認する。
- iPhone 17 Pro Safariなど実機でのスワイプ、縦横回転、アプリ切替、画面ロックと音声復帰。
- T07〜T09の保存失敗・WebGL復旧・反復資源検査・性能・200%文字拡大・読み上げの網羅的検証。
- T04〜T06の多球、加速、虹色、可視解放、420、450以降のスマッシュ。第1段階では高得点でも球は1つ、速度と見え方は初期状態のまま。
- Pages配布パスと公開設定はT10。今回はマージ・公開しない。

## 正式な最終検証

検証対象：[`9908970e0c26848f6dd021d89b5d0f3428a3d19a`](https://github.com/chameleonjp-lab/takkeu/commit/9908970e0c26848f6dd021d89b5d0f3428a3d19a)。2026-10-22 12:14〜12:15 UTCに、そのコミットのソースを変更せず実行した。以後に追加する検証文書・証拠は、このコミットのゲームやテストを変更しない。

| 検証 | 結果 | 全文・正式結果 |
|---|---|---|
| `npm ci` | 成功 | [導入ログ](final-install.log) |
| `npm run typecheck` | 成功 | [型検査ログ](final-typecheck.log) |
| Vitest単体検査 | 10ファイル・29件成功 | [全文ログ](final-unit.log) / [JSON](final-unit.json) |
| `npm run build` | 成功 | [ビルドログ](final-build.log) |
| `npm run test:browser` | Chromium 6件＋WebKit 6件、計12件成功。skip/flaky/failure 0 | [全文ログ](final-browser.log) / [JSON](final-browser.json) |

[検証マニフェスト](final-verification.json)に、実行した完全なコマンド、終了コード、時刻、版番号、検証対象43ファイルと証拠ファイルのSHA-256を保存した。単体検査にはJSON出力の追加引数を付けた。CIは同じ型・単体・ビルド・画面検査を実行する。

| 必須の動作 | 主な証拠 |
|---|---|
| 自分の接触だけ+1・継続接触の二重加点なし・相手返球は加点なし | `session.test.ts`、`collision.test.ts` |
| 高速球・移動中ラケット・円の縁を含む連続接触 | `collision.test.ts` |
| 相手側が隠れても計算・返球を継続 | `presentation.test.ts` と描画部品の可視フラグ検査 |
| 自他の別SE・イベントID重複防止・旧プレイ音の破棄 | `audio-events.test.ts`、実Web Audioの波形合成検査 |
| 指位置へ瞬間移動しない左右上下のスワイプ・PCドラッグ | `swipe.test.ts`、`basic-play.spec.ts` |
| 指離れ・再接触を含む30/60/120Hzの一致 | `pointer-loop.test.ts`、`loop.test.ts`、`replay.test.ts` |
| 開始→返球→加点→失球→結果→再挑戦、停止と手動再開 | `basic-play.spec.ts`、`session.test.ts`、`loop.test.ts` |
| 1球でラリーを継続 | `session.test.ts`で65秒・12回以上の往復。操作補助はテスト側だけに存在 |

### 画面・動画・音

以下の7枚は最終検証後に実際に開き、表示を確認した。

- ホーム：[PC](screenshots/home-desktop.png) / [スマホ縦](screenshots/home-mobile.png)
- ゲーム：[PC](screenshots/game-desktop.png) / [スマホ縦](screenshots/game-mobile.png) / [横](screenshots/game-landscape.png)
- [停止画面](screenshots/paused-mobile.png) / [結果画面](screenshots/result.png)
- [開始・返球成功・失球・結果・再挑戦の操作動画](media/basic-play-chromium.webm)。自動ブラウザ操作で、音声は収録しない。
- 実Web Audioで生成した [自分用WAV](media/player-hit.wav) / [相手用WAV](media/opponent-hit.wav)。波形の相違と非無音を自動確認した。人による聞き分けの合格記録ではない。

## レビューと第2段階への引き継ぎ

[独立レビュー](../../reviews/2026-10-22-takkeu-stage1-review.md)のImportant 1件は、生のポインター回帰検査で失敗を確認して修正した。Critical・延期Minor・未採用指摘はない。修正後の確認は実装担当による。

T04では `GameSession` の1球内部状態を複数球・返球予約へ拡張し、共通の `GameSnapshot` / `ReturnPlan` / イベント契約を保つ。T05では `presentation.ts` と分割した描画部品へ可視解放を追加する。T06では相手の判断とスマッシュを追加する。不可視を計算停止へ使わず、すべての固定刻みのイベントを音へ渡し、描画へまとめる境界を維持する。

PRとCIの実行URL・最終状態はPR本文で追跡する。CIのログと対象SHAは各実行の `verification-<sha>` 成果物にも保存する。
