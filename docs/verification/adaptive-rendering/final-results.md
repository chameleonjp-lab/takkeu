# 最終結果：装飾整理を採用、自動画質は不採用

> 公開前追記（23:41 UTC）：mainは別PR29で`628439f5907601c9b34ee2ba01f70c918b6e8d18`へ進んだ。PR27のAPIはopen/Draft、mergeable=false、merge SHA=nullを報告している。検証済みb0bを保持し、最新mainとの統合/競合解消は未実施。[確認元](publication-before-remote-update.json) / [追加差分](publication-main-advance-after-freeze.json)。以前の成功を最新mainの成功へ流用しない。

対象sourceは **`b0b6760610c17dc5a1f19efebf42049a31df1150`**、開始時PR27は`6ec38720b4f720c71bf48c5aef3cdc5732fdd578`。最新の追加指示に従い、43条件すべての装飾維持より、白球・ラケット・スマッシュ警告・30球の処理を優先した。**Linux絶対性能目標は未達**。改善の確認と目標達成、機能成功、物理iPhoneの快適性を別々に判定する。Draftのまま、マージ/本番公開を行わない。

## 採用・不採用

| 段階 | 調査した問題 | 実施した対策 | 性能改善 | 見た目 | テスト | 判定 |
|---|---|---|---|---|---|---|
| Stage1 | 広い背景/床と半透明重複、球面の頂点、毎frameの装飾生成 | 2つの共用feedback batch、不変12分割輪、厳密同時同位置の共通描画、低poly球、1000以降の全面祝福/1500以降のfield・床・大量電撃を整理 | 同解像度/同設定の4000/30球でp95中央値 標準−52.9%・低−41.7%（Linux、各3有効pair） | 背景装飾を簡素化。白中心/警告/ラケットを検査 | 914unit/200browser/release8、画像/入力/資源/性能/点滅 | 採用、絶対性能目標未達 |
| Stage1候補 | 既存legacy/point属性の全容量転送 | 使用prefix転送を個別実験 | 12回の正式比較では改善未立証 | 136画素比較一致 | 元log/失敗/撤回patch保存 | 撤回 |
| Stage1候補 | 画面外生成、shader統合、indexed geometry | 実境界を調査、追加実装なし | 実ゲーム改善未立証、cull判定/合成の原価・リスクを解消できず | 中心だけのcullや動的境界無視は導入しない | 元調査/既存撤回証拠をhash参照 | 不採用 |
| Stage2 | 継続負荷に応じた3段階解像度 | opt-in/v1互換・3秒p95/2不良区間・10秒間隔・20秒安定復帰を実装し検証 | 切替経路に80〜423.1ms等の待ちを再現。統計処理自体の原価や全FPS差の原因とは断定しない | 候補の機能/入力は通過したが切替待ちが採用上の問題 | 候補75実時間測定・1141機能検査、独立rawレビュー | 撤回、元の標準/低画質を復元 |

43条件の分類は**維持8/軽量化2/統合・簡略化13/削除20**。[全行の対応方針と実測負荷](effects-decisions.md)。削除した20は装飾形状であり、得点・イベント・数字・必要音声ではない。新しい既定設定や球数制限を導入しない。

## 実時間の反復比較

1280×720/DPR1、通常音声・30球・同じautoplay、実60秒、Chromium156/SwiftShader。標準buffer1280×720、LOW960×540。下表は**実際にゲームを継続した各3pairの中央値**。同じ解像度で装飾と球面を整理した比較であり、見た目が同一という意味ではない。

| 対象 | p50 ms | p95 ms | p99 ms | 25ms以内 % | 実60秒あたりgame秒 |
|---|---:|---:|---:|---:|---:|
| A 開始時・標準 | 133.3 | 283.3 | 316.6 | 10.18 | 38.165 |
| B/C 最終・標準 | 66.7 | 133.4 | 166.7 | 10.76 | 55.880 |
| A 開始時・低 | 100.0 | 200.0 | 299.9 | 10.62 | 48.147 |
| D 最終・低 | 50.0 | 116.6 | 166.6 | 11.60 | 57.209 |

最初の第3低画質pairのAは2049.9msのRAF遅延で元のslow-frame保護が働き、一時停止した。停止後のp95=16.8msを高速なgameplayと数えない。元の失敗と対応するDの観測を保持し、そのpair両側を継続比較から除外。同一条件のpair4を追加し、低画質の比較にはpair1/2/4を使った。停止条件1.50秒やfixedDt1/120・maxSteps12は変更していない。外因は未分離。

比較の名称：A=開始時6ec、B=改訂Stage1最終b0b、C=Bと同じsource（Stage2不採用）、D=b0b手動LOW、E=9a9の不採用auto試作。Eを最終製品や同画質の高速化として報告しない。

## 8段階のprofile観測

別のprofile実行。最終16観測と同じrunner/protocolの不変6ec参照16観測を照合する。参照はこのsession内の前時刻で、各条件1観測にすぎない。個別stageの改善率やprimaryと同じ計測負荷とは扱わない。CPU/GPU/転送の全元値は正式CSV/JSONに保存する。

| 開始ラリー | A標準 p95 | 最終標準 p95 | A低 p95 | 最終低 p95 |
|---|---:|---:|---:|---:|
| 500 | 316.6 | 216.7 | 383.3 | 149.9 |
| 1000 | 283.3 | 183.3 | 200.0 | 216.7 |
| 1500 | 283.4 | 133.4 | 200.1 | 100.0 |
| 2000 | 333.4 | 133.4 | 199.9 | 100.0 |
| 2600 | 266.7 | 133.4 | 200.0 | 100.0 |
| 3000 | 266.7 | 133.4 | 200.0 | 100.0 |
| 3500 | 333.3 | 133.4 | 200.0 | 100.0 |
| 4000 | 300.0 | 133.3 | 200.0 | 100.0 |

1000のLOW profile1観測はp95が200.0→216.7ms、game秒/実60秒が49.289→44.803へ悪化した。原因は未分離で、この条件の改善は未立証。「全ラリー/全条件で改善」とは報告しない。

4000標準の別profileの中央値/代表値：

| 指標 | A | 最終 |
|---|---:|---:|
| draw/frame p50 | 35.000 | 27.000 |
| triangle/frame p50 | 44,640.000 | 13,510.000 |
| buffer転送bytes/frame p50 | 499,452.000 | 103,992.000 |
| 追加feedback生成CPU p95 ms | 5.600 | 0.100 |
| simulation CPU p95 ms | 1.600 | 0.800 |
| submit CPU経路 p95 ms | 6.400 | 2.000 |
| GL elapsed p50 ms | 131.139 | 61.379 |

GL elapsedはソフトウェア描画の経過時間で、物理GPUの時間ではない。submitには待ちが含まれ得る。頂点は静止GL診断のdraw参照数で記録し、GPUの実shader invocation数と呼ばない。profile/counter/readbackの費用はゼロではなく、readPixelsはタイミングframeと分離した。

## スマホ相当画面の観測

CSS402×874/DPR2、標準603×1311、LOW402×874。各1観測/60秒であり、実機iPhoneの性能・操作感や統計的な個別改善率の証明ではない。

| engine/設定 | A p95 ms | 最終 p95 ms | A game秒/60秒 | 最終 game秒/60秒 |
|---|---:|---:|---:|---:|
| chromium/standard | 233.3 | 100.0 | 44.477 | 56.945 |
| chromium/low | 150.0 | 66.7 | 53.830 | 59.479 |
| webkit/standard | 75.0 | 49.0 | 58.987 | 58.963 |
| webkit/low | 49.0 | 35.0 | 59.422 | 59.661 |

5分の最終LOW実時間検査：300.020秒、game進行290.750秒、p95=100.0ms、全sample30球/描画有効/running=True。heapには検査journal/collectorを含む。無制限の長期安定を保証しない。

## 合否を分けた正式集計

- 型検査、root/Pages build、配布物検査：成功。最終sourceの通常機能**1122件成功**（914unit+200Chromium/WebKit+8release）、skip/flakyなし。別のnative入力8件も成功。
- 実時間**55実行**（53予定+同条件の追加pair2）：最終sourceは**44/44継続成功**、baselineを含む全体は**54/55成功**。内訳はstandalone継続成功38/39、従来16条件の実行成功16/16。baselineの停止失敗を保持する。
- Linux基準：standalone達成0/39、従来16条件達成0/16。**性能目標未達**。p95<=25ms、25ms以内>=95%、game>=59秒/実60秒、30球、予期しない停止なしを維持した。
- 視認性：144固定画像/72比較と実物理3000枚/1500対。白中心の既存220→200基準、適格96点最小229・実物理232点最小230。除外数/警告106frame/variantも保存。入力116点の最大誤差0.731555px<1px。[詳細](visibility-input.md)。
- 点滅：元解析器/閾値のcanonical36sequenceと実物理補足4sequence、計14400frame。今回のfresh canonical一次警告は9→1、追加警告0。別scopeの実物理4000補足は標準/低画質の両方で警告が残る。一部の過去撮影とwhole RGBが異なり、原因は未分離。**原7警告の無条件な全面解決とは扱わない**。正式WCAG/HDR/人間の視認は未確認。[詳細](safety.md)。
- 資源：20retry/5recreate×両engine/A-F、固定GPU数安定。geometry39→32、新batch描画属性typed-array1,720,320→1,133,664bytes。重複照合配列2KiBは別途追加で、総CPU/VRAM値ではない。forced-GC JSusedはA10,520,976→10,949,820、F10,117,352→10,485,156bytesへ小増加し、全メモリ無増加/リークなしは未立証。

実時間測定の`performance.memory`は丸め・量子化された値であり、正確なheap差や増加ゼロの証明には使わない。上記forced-GC診断と区別し、両方の元値を保存する。

## 失敗・不採用と未確認

初回release8件はbrowser場所の環境変数不足で起動前失敗し、元log/traceを保存、同コード/同検査を正しい環境で8成功。初回resource baselineは再生成時のshader warmup条件が不一致で同値検査に失敗し、条件をそろえて全4実行を再検査した。旧CIのcontact3返球timeout、旧仕様の中断、未実施候補撮影、候補の機能成功と性能未達も区別して残した。閾値/時間制限/retriesを緩めていない。

補足点滅の初回4sequence/1440frameは撮影時計の位相が揃わず、物理snapshotの不一致を検出したため比較から除外した。初回全映像/解析/logを保存し、test-onlyのperformance/RAF時計を厳密に揃えて4sequenceを取り直した。再撮影の720対でsnapshot/effects/events/clock/座標/CSS/警告が全一致。ブラウザのローカルsocket権限による0frame起動失敗も別に保存した。これは撮影手順の修正であり、製品source・物理演算・解析閾値は不変である。

物理iPhone Safari/Android、実際の指の感覚、HDR、VoiceOver、人間の視認/試聴、規範的WCAG適合は未確認。装飾ごとの独立した因果GPU費用、DOM通知単独費用、メモリ増加のJIT/fixture/製品別帰属も未立証。快適動作を保証しない。[未解決](unresolved.md)。

## CIと証拠

最終source b0bの [push40344003207](https://github.com/chameleonjp-lab/takkeu/actions/runs/40344003207) / [PR40344231010](https://github.com/chameleonjp-lab/takkeu/actions/runs/40344231010) は全6job成功。PR実checkout`e7424bcdce86a7995c97b9b1dbb0f3f43785d696`とb0bのtreeは共に`89b634281d2fb056c115de1a865925fc178f1c22`。13attempt/78full logと14checkout/tree証明を正式記録に保存する。記録追加commitはdocsだけで、source/test/config/packageが検査済みb0bと不変であることを別途照合する。記録commit自身をCI成功済みと偽らない。

公開前の確認中、別PR #28でmainが開始時aff3116から532025df5e40ce94556c0b90ede85f707933bc7fへ進んだ。取得したPRのbase/mergeable情報はaff/e742を指しており、最新mainとの統合成功を示さない。検証済みb0bを保持し、**最新mainとの統合は未検証**としてDraftに残す。将来のマージ前には最新baseで再CIが必要である。

[アーカイブと復元方法](evidence-method.md) / [manifest](evidence/manifest.json) / [敵対的検証・独立レビュー](adversarial.md)。provider ZIPは受領時のGitHub digestとCRCを検証し、exact member bytesを保存する。ZIPコンテナのtimestamp/圧縮形式は再現しない。動画は全decoded RGB一致を確認し、旧巨大証拠を6ecのSHA256参照で再利用する。
