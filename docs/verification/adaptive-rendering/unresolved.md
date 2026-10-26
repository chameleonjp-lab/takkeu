# 未解決・未確認事項

最終sourceは`b0b6760610c17dc5a1f19efebf42049a31df1150`。機能検査の成功を、性能目標達成や快適性の保証と読み替えない。Draftを維持し、ユーザーの許可なくマージ/自動マージ/本番公開をしない。

| 項目 | 現状・実用上の限界 |
|---|---|
| Linux絶対性能 | 開始時から目標未達。最終版もp95<=25ms/25ms以内>=95%/game>=59秒を全条件では満たさない。閾値を変更していない。[全数値](final-results.md) |
| 変更前の一時停止 | 追加比較のbaseline第3LOWで2049.9ms遅延→元のslow-frame停止。原因は未分離。停止後の高速RAFを継続性能へ使わず、失敗保存と同条件pair追加を行った |
| 自動画質 | 試作の同期resize経路が最大423.1ms待ち、採用を見送った。統計計算自体の高負荷や物理iPhoneで同じ待ちが出ることは立証していない。最終UIは元の標準/低画質のみ |
| 実機 | 物理iPhone Safari/Android、実際の指・発熱・バッテリー・長時間のOS挙動・120Hz端末の操作感は未確認。Linux WebKitとCSS402×874/DPR2は特定機種の再現ではない |
| メモリ | GPU資源数は20retry/5recreateで安定。forced-GC JSusedには小増加が残り、JIT/fixture/製品別の帰属は未分離。WebKit heapは取得不可。5分継続は無期限の安定性保証ではない |
| 点滅 | canonicalの最終1000-lowと、実物理4000補足の標準/低画質で一次警告が残る。新規flag0でも局所赤回数などの増加があり、安全性の全面改善とはしない。原7警告の証拠を維持。一部の過去撮影とwholeRGBが異なり原因は未分離で、原7警告の無条件な全面解決扱いはしない。[全指標](safety.md)。正式WCAG/PEAT/Harding適合、人間の視認、HDR、PWM/残像等の実機特性は未確認 |
| 音声 | sourceと必要音声の機能/波形を保護。既存144 native音源はhashで再利用し、改めて人間が試聴したとは報告しない。実機の音量/音質/警告の聞き取りは未確認 |
| 視認性 | 同位置の白中心/警告/状態/CSSを検証。重なった球と画面外の点は幾何学的に除外し、その数も保存。30球が常時分離して見えることや人間の視力・認知を保証しない |
| 個別費用 | 38canvas条件のGPU値はscene全体。装飾単独への完全な因果帰属やDOM通知単独CPU費用は未分離。個別の微小差は改善未立証とする |
| 条件ごとの改善 | 1000-LOW profileの1観測はp95 200.0→216.7ms、game49.289→44.803秒/実60秒へ悪化。原因未分離で、この条件は改善未立証。WebKit標準のgame進行も1観測では58.987→58.963秒で微減。4000の反復改善を全条件へ一般化しない |
| 過去CI失敗 | 旧contact3返球timeout等を保存。重いgit diff収集をやめても、過去失敗の原因をそれだけに断定しない。最終b0bのpush/PR CIは新たに全成功 |
| 作業中のmain更新 | 公開前確認で別PR #28によりmainが開始時aff3116から532025df5e40ce94556c0b90ede85f707933bc7fへ進んだ。検査済みPR checkoutは旧baseのe742。取得したPRのclean/mergeable表示もbase=aff/e742で、532との統合成功証拠ではない。4renderとの差分重複はないがapp/ranking/SQL変更を含み、最新mainとの統合は未検証。将来のマージ前に最新baseで再CIが必要 |
| 公開直前の再確認 | さらにPR29でmainが628439f5907601c9b34ee2ba01f70c918b6e8d18へ進んだ。23:41 UTCのAPIはPR27をopen/Draft・mergeable=false・merge SHA=nullと報告する（base metadataはaffのまま）。最新mainへの統合/競合解消は未実施。sourceを変更せず[応答元](publication-before-remote-update.json)と[差分一覧](publication-main-advance-after-freeze.json)を保存し、Draftの明確な阻害事項として残す |
| 旧測定CLI（軽微） | `scripts/performance/render-audit.mjs`は4batch時代、`adaptive.mjs`は旧auto試作のanchorに依存する。最終2batchへ直接実行するCLI guardは未追加。下記の版指定を守り、最終検証は保存済みrunnerを使う |

## 測定ツールの版指定

追跡済みの`/scripts/performance/`は作業履歴のツールで、全ての版に対して動く共通CLIではない。`render-audit.mjs`と`render-final.mjs`は6ecの4meshを前提とし、最終b0bの2meshへ実行するとglow meshが存在せず失敗する。`adaptive.mjs`もb673/95cb系の旧anchor用である。これらを最終版の成功証拠や最終再現手順に使用しない。

最終版の実行runnerは正式アーカイブの `runners/performance-revised.mjs`、`performance-phone-revised.mjs`、`render-playable.mjs`、`native-manual.mjs`、`native-manual-input.spec.ts`、`resource-audit.mjs`、`effect-catalogue.mjs`、`capture-flash.mjs`、`native-physical-flash-aligned.mjs`。最後のrunnerは初回`native-physical-flash.mjs`の撮影時計不一致を修正したもので、原runner/失敗映像/10キーの720対厳密一致を保存した。各入力plan/実行command/runner SHA256/前後source SHA256/原logを同じアーカイブへ保存した。[復元方法](evidence-method.md)。

## 自律的に行った判断

1. 詳細な依頼と自律実行の許可を優先し、可逆な実装/検査/Draft更新について追加の承認待ちを設けなかった。マージ/本番公開の禁止は守った。
2. 最新仕様を優先し、43条件の装飾維持・密度固定・画素完全一致を撤回した。見た目の豪華さを失う代わりに球/警告/入力と負荷を優先した。
3. autoは切替経路の待ちを理由に不採用にした。別の実機では有効に動く可能性が残り、機能提供を遅らせる判断である。
4. BとCは同じsourceとして証拠を再利用し、Eは不採用9a9だけとした。実際に異なる最終auto版があるような比較を作らない。
5. 停止したbaseline pairを失敗として保持し、同じ条件の追加pairで継続比較を補った。停止の運用上の失敗率は比較中央値から消さず別に報告する。

独立レビューが対象外/未確認として残した実機・HDR・人間の評価・正式適合・未分離の費用についても、この表の限界をそのまま適用する。根拠のない「快適」「安全」「全メモリ増加なし」を理由にDraftを解除しない。
