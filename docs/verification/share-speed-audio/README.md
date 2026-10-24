# X共有・残球速度・多層効果音の検証

Draft PR: https://github.com/chameleonjp-lab/takkeu/pull/19 。merge・自動merge・手動公開・本番ランキング送信・実際のX投稿は行わない。

基準mainは依頼の `27ebee8fb5fa0d29f7f82e15244dd1fbd1a88de1` と一致。GitHubのopen PRなし、remote既存branchを確認して、新規partial cloneのclean作業ツリーから `feat/share-speed-layered-audio` を作成した。過去の大容量媒体は取得対象を絞り、既存証拠は削除していない。[計画](../../superpowers/plans/2026-10-24-share-speed-audio.md)、[経過・判断](progress.md)、[独立レビュー](review.md)を参照。

製品の実装は `6615e88c1d1c4514536c518d652a0fcfaca80b01`。既存probeの「oscillator一つ=voice一つ」という旧前提の更新は `a380a431198c2c8209ed6809f8e2eb62851273c0`（製品変更なし）。その後CIで警告音の既存RMS下限未達を再現し、peakを上げず減衰を60→75msへ調整した `9155b19b2d3cedaf24e7130d8d134f370b136728` を最終の検証対象とする。証拠追加commitのheadとは区別する。最終対象・終了コードは `final-manifest.json` に記録する。画面例：[ホーム縦200%](screenshots/home-portrait-200.png)、[結果縦200%](screenshots/result-portrait-200.png)、[結果横200%](screenshots/result-landscape-200.png)。

## A: 共有・静的サムネイル

既存 `scoreShareUrl`・intentリンク・正式URL設定・`og-takkeu-v1.png` を再利用。ホームfooterへ「Xでシェア」を追加し、既存の開始を主操作に保つ。結果はgameoverの確定ラリーだけで更新し、retry/homeでhrefを消す。0は有効、非有限・負数・小数等の不正結果はhrefなし・aria-disabledで明示する。新しい保存、APIキー、SDKはない。

- ホームbest>=1: `卓球ゲーム「タッケウ」で自己ベスト{bestScore}ラリー！\n何ラリーつなげられる？ #タッケウ`
- ホームbest0/無効: `タップ＆ドラッグで遊べる卓球ゲーム「タッケウ」！\n何ラリーつなげられる？ #タッケウ`
- 結果: `タッケウで{score}ラリー達成！\n何ラリーつなげられる？ #タッケウ`

いずれも `https://chameleonjp-lab.github.io/takkeu/`。URLSearchParamsを一度だけ適用する。名前・ID・ランキング情報を含めず、通常の安全な新規タブリンクとして動作する。[共有の記録](a-results.md)とa-*ログ・画像を参照。

既存画像を実際に開いて、現在の台とラケット・読みやすい文字を確認し再利用。初期HTMLにOG/Twitter Card/canonicalの各指定があり、descriptionとaltを整合した。ビルドHTML・画像PNG/実寸/MIME/ルートと `/takkeu/` の確認は配布検査。公開GETは別に [public-fetch.json](public-fetch.json)、ヘッダー、取得HTML・releaseを保存した。公開画像200/image/png/1200×630/630382bytes、SHA256 `826313cf164cfc8da1c37121f9516efa038aee35c19a04bfe044f6817f6b0caf` はローカルと同一。公開中はbase版で、今回のHTMLはまだ公開されていない。**実際のXカード表示・キャッシュは未確認。**

## B: 残球速度

| 100以上の生存数 | 旧追加倍率 | 今回の倍率 | 実飛行時間 |
| --- | --- | --- | --- |
| 1 | 2 | 1.4 | D/1.4 |
| 2 | 1.5 | 1.3 | D/1.3 |
| 3 | 1.25 | 1.2 | D/1.2 |
| 4 | 1 | 1.1 | D/1.1 |
| 5以上 | 1 | 1 | D |

0–99は1倍。lost以外の自側・相手側・飛行・待機全phaseを数え、未来の未獲得球は含めない。0は終了し発射しない。相手の実打球で固定し、予約・待機中は再評価、飛行中の単なる球数変化では変えない。outgoingへ持ち越さない。既存の通常加速・smash係数・最低時間を求めた後に独立倍率を適用し、最低時間へ再丸めしない。

同tickは時刻順→バウンド優先→球ID順という既存順序。100到達時は、そのhit内の増球も処理して次actionへ進む。ID1が100到達・増球→ID2失球→ID3相手打球なら、その時点の生存3球で1.2倍。5→4/4→3/2→1/1→増球、再予約、540段階、555軌道、予告0.4秒、到着gap0.12秒、30/60/120Hzと高速接触を検査した。補足の[飛行順84条件](flight-order.json)でも実ネット通過・table-bounceイベント・到着を測り、両エンジンで順序を確認した。

[b-results.md](b-results.md)、[旧期待値の対応](b-expectations.md)、[実測まとめ](b-measurement-summary.json)を参照。実シミュレーション座標のネット／到着通過時刻を測る両ブラウザ42行ずつで、D/倍率の最大比率誤差 `1.2878587085651816e-14`。通常100ラリーのD=0.9646498191774704秒に対し、1球0.6890355851267636秒。540smashのD=0.48150370976532386秒に対し、1球0.3439312212609451秒。従来の速度検証・文書は履歴として保持する。

## C: 音響の設計と測定

Web Audioで独自生成。短いkick、三角波/少しずらしたsawの中域打撃、帯域ノイズ、WaveShaperの歪み、12–60ms（成功は15–75ms）の高音arpを重ねる。相手は200→50Hzの低めのkickと中域・square、警告は0/42/84msの三段上昇（各75ms、全159ms）、成功は300→38Hzのkickと金属的な打撃。ノイズと歪みカーブはcontextを弱参照キーにキャッシュし、ゲームPRNGを使わない。音源/ノードの割り当ては各再生で存在し、GC負荷ゼロ等とは主張しない。

`player-hit` に当該球のplanを書き換える前の `smashReturn` と加点後の `rallyScore` をコピーする。警告フラグ・経過時間から推測しない。旧イベントの任意項目がない場合は通常の基底段階。通常/スマッシュ混在・同じ球IDの次往復・停止復帰を検査した。

段階は累計ラリーの `floor(score/5)` を、半音 `0,2,4,7,9,12,14,16` に対応させ最大16。5/10の返球から高音を1/2追加する。mute/0/未解放/失敗で音が鳴らなくてもイベントの確定scoreを次の音に直接使い、発音回数を数えない。pause/retry/home・古いrun/重複イベント・復旧で過去音を再生しない。周波数は25Hz〜min(7000Hz, sampleRate×0.18)、出力low-passはmin(6000Hz, sampleRate×0.2)、shaperは2x oversampling。

| voice | 標準の音源数（基底/5/10以上） | 低負荷 |
| --- | --- | --- |
| 自分 | 7/8/9 | 4 |
| 相手 | 4 | 3 |
| 警告 | 4 | 4 |
| 成功 | 8/9/10 | 5 |

8active+8fadeを上限、1voice最大10音源/25ノード、全voice合計最大160音源/400ノード＋master2ノード（合計402）を保守的上限とする。遅延arpは1voice最大5、全体80以下。半分以上のactive数では装飾を低負荷構成に縮減。上限時は警告を残し、古い終了間近の打撃を8msでfadeへ移す。fadeが8を超える場合は最古の尾を即時回収する。ゲームの計算は変えない。通常fadeは完了前にdisconnectしない一方、mute/0/停止/終了/破棄は予約も含め即時切断する。

各sourceを作成直後に所有登録し、全sourceのonendedを数えてvoice完了を一度だけ通知する。生成/接続/param/startの全記録操作への故意の失敗、masterの構築/resume失敗、suspend/close同期例外、古い完了・unlock・context再生成を検査した。圧縮または歪み等がない場合は0.08peakの単音へ落とし、部分構築失敗では無音継続・明示復旧を許す。

Gemini案の大きなpeak・sqrtによるheadroom・初期音量0.85は採用しない。voice出力gain0.12、filter/歪みの余裕を含む0.16基準をactive+fade数で線形に割ったheadroom `0.8/(2×limit×0.16)` を使う。masterのcompressorは追加の音色/ダイナミクス調整とし、その後にユーザー音量を置く。既定0.65・保存済み値は維持する。

実OfflineAudioContextの44.1/48kHz・Chromium/WebKitで、通常段階1/4/5/9/10、相手・警告・成功、最大voiceとfade、全16voice標準品質成功、mute/0/fallbackを測定。全sample有限、最大peak0.439668（full-quality16voices、compressorなしの保守的測定）、実製品graphの開始時重なり・音量1でpeak0.155194。全ケース0.3–0.5秒の終端peak0、mute/0は全sample0。補足の[減衰中の重なり24条件](overlap-measurements.json)では、実OfflineContextを6/25/60msでsuspend/resumeし、音量1で8voiceへ次の8打撃を重ねた。最大peak0.255931、全sample有限・終端無音で、時刻はrender量子化後の実値も保存した。単発通常は48000Hzでpeak0.01156/RMS0.00141、成功10はpeak0.01500/RMS0.00250。新しい通常音は元の音より小さめで、迫力を音量上昇だけから判断していない。

旧音fixtureはbaseのtonesをコピーし旧master/headroom/0.65で比較。元音量WAVと全0.5秒区間のRMSを0.025へ揃えたWAVを保存（[Chromium](audio/chromium/README.md) / [WebKit](audio/webkit/README.md)）。波形測定は試聴の代替ではない。**人による試聴、スピーカー/イヤホン、iPhone Safari実機は未確認。**

## 統合・失敗履歴・限界

正式結果：[final-manifest.json](final-manifest.json)。ローカルはunit477・型/配布8・性能8測定・減衰重なり24・飛行順84を終了0で完了。ブラウザ全件はCIでChromium62操作+3負荷、WebKit62操作+3負荷の計130成功（[run](https://github.com/chameleonjp-lab/takkeu/actions/runs/40105005643)）。同ソースのpush CIも成功。ローカル全件は重複を省くため63成功/1中断/66未実行、終了130で止めた。ローカル130件成功とは記載しない。`record-check.mjs` が終了コード・SHA・dirty状態・時刻・ログhashを記録する。clock操作した機能テストと、実時間performanceの記録は別に扱う。[実時間比較](performance-results.md)、`performance-summary.json` と `performance-data/` は生の描画間隔・wall時間・simTime・pause理由・音源/voice推移を保持する。

初回失敗はbaseline-releaseのsandbox子プロセス制限（同一テストを権限環境で再実行し成功）、新仕様RED、WebKit依存不足、fixtureの巨大scoreからの過剰球生成（screens-onlyで修正）、CSS大結果値の横はみ出し、Offline lifecycle Proxy setter束縛、旧runtimeProbeのoscillator=voice前提、CIで検出し両エンジンで再現した警告RMS0.009881<0.01。警告はpeakを上げず減衰を75msへ延長し基準を維持して再検査した。元ログ/trace/再検査を残し、assertion削除・無関係なtimeout緩和はしていない。retryのvoice上限1は維持し、今はshaperを1voiceとして数え、別にnoiseを含む全音源4以下も検査する。

Linuxの既存性能目標未達、実iPhone性能、実機操作・点滅の最終安全性は、今回の自動検査で解消済みとしない。[過去の受入記録](../acceptance.md)と[公開手順](../../release.md)の未確認を維持する。

## マージ・公開後に行う確認

1. ユーザーのレビュー・merge後、Pages release成功と公開release.jsonの完全SHA・base=/takkeu/を照合する（今回merge/公開操作はしない）。
2. 公開の最初のHTMLに更新済みOG/Twitter/canonicalが一つずつあり、絶対HTTPS画像URLが200/image/png/1200×630を返すことを再確認する。
3. Xの投稿作成画面で共有文・正式URL・カード表示を確認し、サービス側のキャッシュ状況を記録する。画像の即時表示を保証しない。必要に応じX側の更新を待ち再確認する。確認目的の本番投稿は不要。
4. iPhone Safari実機、スピーカー/イヤホンで自他・警告・成功・多球を聴き、快適さと識別を記録する。OS/ブラウザ・音量・品質・実SHAを残す。端末の実時間性能と既存点滅の最終確認も別途実施する。

CIの対象branch headは9155b19b2d3cedaf24e7130d8d134f370b136728、PR用checkoutは231268dc73d79d80c820a80d10b0f9336d5ca94f（main27ebee8へのテストmerge）。[jobメタデータ](ci-tuned-source-jobs.json)・[core全文](ci-tuned-source-core.log)・ci-source-*-{interaction,load}.log・[全媒体への参照](ci-source-artifacts.json)を保存。大きなCI媒体は既存workflowの30日保存。証拠追加headのCIはPRの最新Checksと本文を正とする。

大きな重複描画媒体は[local-full-media-index.json](local-full-media-index.json)へhash付きで一覧化し、ワークスペースに残した。全件CIの媒体は既存30日artifact保存を利用する（ci-source-artifacts.json）。ローカルの正式ログ・JSON・失敗/中断trace、今回の共有画像・比較WAVはGit内に保持する。既存の過去検証ファイルを削除していない。
