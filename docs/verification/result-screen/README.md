# 結果画面・全登録順位の検証記録

作業開始main: `7b48f223b83c80b11ac9c242583577e9096d540f` (PR #25)。専用ブランチ `codex/result-celebration-rank`。Draft PRでレビューし、mainへmerge/ゲーム公開はしない。

## 変更した責務

| 対象 | 変更 |
| --- | --- |
| `src/ui/resultComments.ts` | 44段階の日本語コメント、到達時に切替、2000以上固定 |
| `src/ui/resultEffects.ts` | 300/500/800/1000/1500境界、SVG二層、緑/青/赤の独立スケジュール、約30fps、最大5本 |
| `src/ui/result.css`, `styles.css` | 金属金色・移動虹色・コメントの色/発光/登場・モバイル配置・reduce motion |
| `src/ui/screens.ts` | スコア→コメント→全登録順位→端末best→操作→TOP30、読み上げ/再試行 |
| `src/ranking/client.ts`, `config.ts`, `ranking-manifest.json` | 最小応答の順位RPC。全登録のブラウザ取得なし、上位制限なし |
| `src/ranking/controller.ts` | play/submission単位の送信状態通知。既存idempotency/保存/再送契約維持 |
| `src/ranking/resultPosition.ts`, `src/app/createApp.ts` | 対象ACK後のみ順位取得、epochで再プレイ/ホーム/破棄後の応答を無効化 |
| `supabase/migrations/20261025184307_takkeu_result_position.sql` | takkeu専用の追加集計RPC。既存関数/テーブル/データを変更しない |
| `tests/unit`, `tests/browser`, `tests/helpers`, `tests/fixtures` | 境界/非同期/SQL/レイアウト/時間変化/回帰テスト。デバッグ機能はテスト入口のみ |

## 集計とDB適用

- **本番適用済み**: Supabase project `mlpnjgezrnhdxsxolyzj`、履歴version `20261025184307` / `takkeu_result_position`。
- `get_best_score_ranking` は一切変更しない。takkeuはdescを現行DBで確認。
- `first_score is not null`、`coalesce(ranking_status,'normal')='normal'`、`game_slug='takkeu'`。登録名の集約済みbestのみ。自分より高いbestの登録名数+1。同点1/1/3。
- 同じSQLスナップショットで順位・総登録数・登録bestだけを返す。対象外/未登録は0行。表示は人数との混同を避け `○位 / ○登録中`。
- 既存TOP30との実DB照合: **30件、不一致0**（対象618登録、集計時点）。その後全登録照合: **620件、100位超520件、不一致0、最大順位613**。実際の総登録数はサービス利用により変動する。
- 読取り計測: 5.108ms（単発計測、負荷保証ではない）。`db-explain.json`。
- 公開キーでのREST読取りは `db-rest-publishable-check.json`。テストプレイヤーやスコアを本番へ作成していない。
- 追加関数のみなので旧クライアントに影響しない。機能を戻す場合はUI変更を戻し、この新関数だけを別migrationで削除できる。既存RPC/記録は削除しない。

## 監査

`db-advisors-before-*.json` と `db-advisors-after-*.json` を省略せず保存。

追加のSECURITY DEFINER関数は既存の公開ランキングと同様にanon/authenticatedから呼び出すため、意図した警告がそれぞれ1増える。テーブルSELECTは引き続き不可。PUBLIC実行権限を剥奪し、対象ゲーム・返却情報を限定、空search_path、動的SQLなし。既存の無関係な警告やインフラ設定は変更しない。

警告の説明: [公開SECURITY DEFINER関数](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)。既存の[重複index警告](https://supabase.com/docs/guides/database/database-linter?lint=0009_duplicate_index)も前後比較記録に含む。

`npm-audit.json`: 脆弱性 **0**。SQLテスト用PGliteはdev dependencyに完全固定、lockfile更新済み。

## 自動検証の対象

- 全44コメントを上下境界で画面検証。4→5、49→50、99→100、199→200、299→300、499→500、799→800、999→1000、1499→1500、1999→2000、最大100000000。
- 300金色のみ、500金+緑、800虹+緑、1000虹+緑青、1500/2000虹+緑青赤。時間サンプルで形状/起点が変化。最大5本、前面1/4、各色の長さ/幅/寿命/周期/分岐差。
- 結果非表示/準備中/非アクティブタブ/破棄でRAF停止、再表示で1本のループのみ再開。reduce motionを途中で変更して停止/再開。
- SQL fixture: 初回対象追加、best更新、既存bestで順位、同点/複数1位、30位超・100位超、対象外・初回未完・異ゲーム、総数増減、anon API権限とテーブル非公開。
- 実アプリ通信境界: 送信/順位遅延、503、送信ACK喪失、同ID再送、旧キュー失敗と新結果、順位取得中の再プレイ。正常ACK前に順位を確定しない。ゲストの順位非表示。
- モバイル: ChromiumとWebKit、**320×568 / 402×874**。44コメントの通常表示2行以内、横スクロールなし、順位まで初期画面内。9桁、root200%と最長見出し実寸2倍、44px操作、DOM読み上げ順・status通知を確認。実フォント拡大時は2行制限より折返しと非重複を優先。
- 演出の証拠: `evidence/step4/*score-*.png`、`*lightning-frame-0/6/11.png` と正式結果JSONの `animation-observations`。静止画のみで動作を判定していない。

## 実行環境と再現

Node 24.19.0、npm 11.9.0、Playwright 1.64.1。LinuxのChromium/WebKit。402×874はiPhone 17 Pro相当CSS寸法のエミュレーション。既存回帰suiteのWebKitは既存iPhone13プロファイルを維持。

```sh
npm ci
npx playwright install --with-deps chromium webkit
npm test
npm run typecheck
npm run test:browser
npm run verify:release
npm run test:performance
npm audit --json
```

この作業環境はroot不許可だったため、WebKitの不足依存をDebian trixie公式パッケージから一時領域へ展開してPlaywright専用 `sys/lib` に置いた。公式ラッパーがLD_LIBRARY_PATHを上書きするためで、システム設定は変更していない。ldd確認後、システムldconfigのみを見る事前検査を `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1` でスキップして**実際のWebKit起動・テスト**を実行。通常のCI環境は既存 `install --with-deps` で再現できる。

通常sandboxでは既存Node spawnSyncテストがEPERMになった。同じテストを追加権限で実行すると成功。ソース回避を加えず、以後の正式検証は追加権限で実行。`logs/baseline-*` に失敗/成功両方を保存。

## 確認できない範囲

- **実機iPhone 17 ProのSafari・VoiceOver操作・実機での60fps性能は未確認**。WebKitの画面/DOM/通信/時間変化検証を代替として実施。rootフォントや見出しの拡大テストは実機の文字サイズ設定やブラウザzoomではない。
- Linuxの実フレーム測定は参考値。ゲームの重い30球場面と結果演出を分けて記録し、実機性能の合格と解釈しない。
- 名前単位の従来仕様により同名は合算。順位・総数はその取得時点のスナップショットで、他プレイヤーの更新は再取得時に反映する。

段階ごとの実行記録は `progress.md`、独立レビューと修正は `review.md`、正式な全テスト/失敗ログは `logs/` と結果JSONに保存する。

## 正式な全体結果

- Unit **777/777**（62ファイル）、typecheck成功。
- 全browser **182/182**（Chromium/WebKit各91、skip/flaky/unexpectedすべて0）。
- 通常ビルドとPagesビルド成功、実配布物 **8/8**。
- ゲーム60秒測定 **8/8実行成功・全ケース継続**。ただしLinuxの描画目安は全ケース未達（合格の意味は実行エラーなしであり、滑らかさ合格ではない）。詳細は下記性能表と全フレームJSON。
- 結果電撃5秒: Chromium 301 frames / p95 16.7ms / 311形状、WebKit 286 frames / p95 25ms / 338形状。両方とも3色・最大5本。`evidence/final/animation-summary.json`。
- レイアウト各88通常ケース: 横スクロールなし・通常コメント2行以内・順位が初期画面内。拡大2ケース/ブラウザも重なりなし。`evidence/final/layout-summary.json`。

### 高負荷ゲーム性能（各60秒、Linux参考値）

| Browser | 品質 | 開始ラリー | frames | p95(ms) | 継続 | 目安 |
| --- | --- | ---: | ---: | ---: | --- | --- |
| chromium | standard | 450 | 844 | 150.0 | 継続 | 未達 |
| chromium | standard | 555 | 869 | 133.4 | 継続 | 未達 |
| chromium | low | 450 | 824 | 150.0 | 継続 | 未達 |
| chromium | low | 555 | 846 | 149.9 | 継続 | 未達 |
| webkit | standard | 450 | 1905 | 43.0 | 継続 | 未達 |
| webkit | standard | 555 | 1886 | 43.0 | 継続 | 未達 |
| webkit | low | 450 | 2233 | 37.0 | 継続 | 未達 |
| webkit | low | 555 | 2290 | 36.0 | 継続 | 未達 |

変更前main `7b48f22` も同じ代表条件（standard・450・60秒）を隔離コピーで比較。WebKitは1933 frames / p95 42ms（今回1905 / 43ms）、Chromiumは再測定844 frames / p95 133.4ms（今回844 / 150ms）。いずれもLinux目安未達。Chromium初回は約2秒で既存slow-frame保護が停止したためFPS比較に使用せず、記録を残して1回だけ再測定した。単発比較から厳密な性能差・実機性能を結論しない。今回のゲーム実装ファイルは未変更で、結果電撃はゲーム中に描画されない。

全測定・全フレーム: `final-performance-results.json.gz`, `baseline-main-performance-*.json`, `evidence/performance/`。参考目安は各フレーム25ms以内が95%以上。実行テストが成功していても、測定の `measurementVerdict` は未達であることを上表に明示した。

大きな正式JSON・全フレーム記録は内容を省略せずgzip化し、PRのソース差分を読める形にした。`compressed-artifacts.json` に元サイズ・SHA256を記録し、全ファイルの展開一致を検証済み。`gzip -dk <file>.json.gz` で元のJSONを取り出せる。監査・要約・通常ログはそのまま読める。
