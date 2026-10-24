# A：共有と静的カードの検証

ホームfooterに「Xでシェア」を追加し、既存の結果リンク・intent URL生成を拡張した。正式URLは設定済みの `https://chameleonjp-lab.github.io/takkeu/` を共用する。リンクは通常のanchorで、`target="_blank"` と `rel="noopener noreferrer"` を付ける。X投稿は行っていない。

共有文（改行を含む）は次のとおり。

| 場所・条件 | 文面（`\n` は改行） |
| --- | --- |
| ホーム：有効な自己ベスト1以上 | `卓球ゲーム「タッケウ」で自己ベスト{bestScore}ラリー！\n何ラリーつなげられる？ #タッケウ` |
| ホーム：自己ベストなし・0・無効値 | `タップ＆ドラッグで遊べる卓球ゲーム「タッケウ」！\n何ラリーつなげられる？ #タッケウ` |
| 結果：今回の確定スコア | `タッケウで{score}ラリー達成！\n何ラリーつなげられる？ #タッケウ` |

共有に使うスコアは有限の非負整数だけを受け付ける。結果はgameover時のみ有効にし、0も共有する。無効・未確定の結果とretry/homeへの移動時はhrefを除去し、`aria-disabled="true"`・`tabindex="-1"` にする。自己ベストと今回の結果は別々に更新する。長い結果数値は折り返し、横方向のはみ出しを防ぐ。

HTMLのdescription／OG／X description、および両カードの画像altを統一した。既存の `public/og-takkeu-v1.png`（1200×630）を変更せず再利用する。[公開画像の取得記録](public-fetch.json)ではHTTP 200、ローカル画像とのSHA-256一致を確認している。SHA-256は `826313cf164cfc8da1c37121f9516efa038aee35c19a04bfe044f6817f6b0caf`。[公開release](public-release-before.json)は基準SHA `27ebee8fb5fa0d29f7f82e15244dd1fbd1a88de1` のままで、新HTMLは未公開。

| 実行済み検証 | 結果・記録 |
| --- | --- |
| 共有文・無効値・結果0・自己ベスト・初期HTMLのRED | 41失敗／3成功、終了1：[a-red.log](a-red.log) |
| 関連unit 4ファイルのGREEN | 52成功、終了0：[a-green.log](a-green.log) |
| 大きな結果数値のレイアウトRED | 小画面4失敗／4成功、終了1：[a-browser-red.log](a-browser-red.log) |
| Chromium GREEN | 8成功、終了0：[a-browser-green.log](a-browser-green.log) |
| WebKit GREEN | 8成功、終了0：[a-webkit-green.log](a-webkit-green.log) |

ブラウザは合計16成功。自己ベスト有無、結果0・大きな値、異なるbest/result、retry/home、ランキング取得失敗、クリック・Tab/Enter、320×568・568×320・1280×720と文字100%／200%を検査した。X intentのGETはローカル応答へ差し替え、ランキング通信は既存browserTestで遮断した。WebKitは導入済みのローカル依存ライブラリを使用し、起動確認後にシステムキャッシュ検査のみ回避した。テスト・assertionのスキップはない。

目視確認したChromium画像：[縦200%ホーム](a-browser-artifacts/sharing-共有リンクは320x568・文字200-でも読めて操作できる-chromium/home-320x568-2.png)、[縦200%結果](a-browser-artifacts/sharing-共有リンクは320x568・文字200-でも読めて操作できる-chromium/result-320x568-2.png)、[横200%結果](a-browser-artifacts/sharing-共有リンクは568x320・文字200-でも読めて操作できる-chromium/result-568x320-2.png)。リンクの読める表示と操作領域に重なりがないことを確認した。

配布物の初期HTMLからcanonical・OG・X metadataを解析し、root／`/takkeu/`両パスのPNG signature・MIME・寸法を検査するreleaseテストを追加済み。統合head9155b19b2d3cedaf24e7130d8d134f370b136728でrootの `npm run verify:release` が型・root/Pagesビルド・8配布ケースを完了し終了0（[正式配布ログ](final-release.log)、[対象SHA/終了コード](final-release.json)）。実際のXカード表示は未確認である。公開後に新HTMLのmetadata、公開画像、X側のカード再取得・表示を確認する必要がある。
