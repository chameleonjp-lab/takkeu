# Stage2：自動画質は実装・検証後に不採用

最優先の追加指示「自動画質の仕組み自体が新たな負荷を生む場合は、無理に導入せず、理由と比較結果を報告」を適用する。最終版は既存の標準/低負荷を維持し、プレイ中に解像度を切り替える自動モードを含めない。同時光の共通描画はStage1側で採用する。

## 候補と判定方法

候補は[9a9b71f](https://github.com/chameleonjp-lab/takkeu/commit/9a9b71f41a0640f88ae3fb1bfd507adf928f9405)。opt-in/v1互換、標準→中間→既存LOW、3秒p95評価、2不良区間/6秒span、10秒cooldown、安定20秒復帰、CSS/camera/入力の分離、point-size補正を実装した。設計・境界/60Hz/120Hz/中断/入力/復旧の機能試験は成功し、[PR CI全6job](https://github.com/chameleonjp-lab/takkeu/actions/runs/40329439829)は925unit+208browser+8release=1141件成功した。

Linux実時間測定は35+追加16+phone8、従来の16条件の計75回を完了。実行と30球継続は成功したが、絶対性能目標は未達。自動候補の採用可否は、機能試験成功と別に判定した。

## 再現した切替の待ち

4000ラリー/30球、各実時間60秒、通常描画・音声、profile:falseの3組。同期resize経路の経過時間は次のとおり。

| 環境 | 1段階目 ms | 2段階目 ms |
|---|---:|---:|
| Chromium 1280×720/DPR1・1組目 |158.3|156.7|
| 同・2組目 |110.6|135.1|
| 同・3組目 |187.3|423.1|
| Chromium CSS402×874/DPR2 |145.6|80.7|
| WebKit CSS402×874/DPR2 |28|13|

最大423.1msの待ちの次RAF間隔は433.2msだった。独立レビューはraw全10件のstart/end差、profile:false、60秒以上、全sample running/30球/描画有効、source不変、errors/外部通信0を確認した。

rawのフィールド名は`cpuMs`だが、計測はrenderer.setSize直前から、field解像度uniform更新と寸法代入後までの**同期経路の経過時間**である。純CPU計算時間やGPU単体時間と断定しない。OS schedulingや既存GPU作業の待ちが含まれ得る。それでも、プレイ中の解像度変更で長い待ちが繰り返し生じる採用上の問題がある。

EautoとDlowでは演出密度・音声品質も異なる。全体p95差を自動判定の原価へ帰属させない。判定統計自体が重いことは立証していない。Linuxソフトウェア描画の結果をiPhone GPUへ一般化しない。物理iPhoneでの切替コスト・操作感は未確認。

## 撤回と再検証

- 自動モードのUI/保存値/controller/描画buffer変更/point uniformと、その専用検査を候補不採用として撤回。対象と元source/testのSHA256・Git blobは正式記録のwithdraw-adaptive-source-map.jsonに保存し、親commit9a9b71fから復元できる。
- app/createView/quality/particles/preferences/screensと補助fixtureを6ec3872の元実装へ戻す。ゲーム・物理・入力・音声・結果44段階・ランキングの処理は変更しない。
- 既存standard/lowとtakkeu.preferences.v1を維持。未公開候補のauto値が残っても、bestScore等を保持したままstandardへ安全復旧する検査をRED→GREENで追加。
- 採用するsource差分はballs/celebrations/presentation/rallyEffectsの4描画file。型検査・914unit成功。最終manual版は新SHAでCI/ビルド/実時間性能/実入力/視認性/資源/点滅を再検証する。候補の成功を新sourceの成功へ流用しない。

候補の追加native/auto撮影は不採用判断で未実施とし、成功に数えない。旧成功/失敗・75回の元測定・独立レビューは保存する。実機で切替の待ちが小さいことや、別方式の有効性が実測できるまでは、快適性を優先して自動機能を配布対象へ含めない。
