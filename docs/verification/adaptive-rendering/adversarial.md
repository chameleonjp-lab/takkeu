# 最終版の敵対的検証台帳

最終source `b0b6760610c17dc5a1f19efebf42049a31df1150`、比較元`6ec3872`。最新仕様では装飾の削除・統合を許可する。gameplay/30球/入力/必要音声/結果/ランキングの保護と、失敗を隠さないことは継続する。旧仕様の台帳も正式アーカイブに残す。

| ID | 攻撃/失敗条件 | 最終版での検査・結果 |
|---|---|---|
| A01 | 古い事実の整理で必要な常設/通知が欠落 | game側事実はbyte不変。23段階の事実検査と全38canvas条件をA/F撮影。常設装飾の削除は新仕様の明示方針であり、不具合と混同しない |
| A02 | retry/context後に共有資源が復旧しない | 20retry/5recreate×4実行の固定資源数、両engine/両modeの実WebGL喪失/復旧・入力検査が成功。JS全体の無増加は未立証 |
| A03 | 透明描画の変更で色/奥行き/点滅が悪化 | 装飾変更は意図的。144固定画像/3000実物理画像と元RGBAを保存し、球/ラケット/警告の状態・白中心を照合。canonical36の警告9→1、実物理補足4の警告は両mode残存、新規警告0。局所赤回数等の増加と原7件未全面解決を[safety](safety.md)へ明記 |
| A04 | centerだけのcullingで電撃/輪が途中で消える | 新cullingは導入しない。元の実6頂点clip診断を保存。短いfeedbackはfrustumCulled=falseを維持。長い装飾は仕様として削除 |
| A05 | shader統合でGPUが逆増 | shader統合は不採用。旧indexed実験も再導入しない。個別ablationと全scene queryを区別し、単独原因と断定しない |
| A06 | 共通化で別の色/位置/ageが連動 | 不変unit circleのみ共有。各hit/lossの実座標/ageを独立処理。hash一致後もtime/XYZを厳密照合。異時刻/異位置のfeedback維持とhash衝突の検査が成功 |
| A07 | autoの頻繁な上下/再確保stall | 試作で最大423.1msの切替経路待ちを実測。採用を拒否し、配布版からautoを撤回。試作成功機能検査を快適性の証明にしない |
| A08 | 解像度変更でCanvas CSS寸法が変わる | 最終版は既存の固定manual2モード。CSS/カメラ/quality/update処理は元sourceと一致。portrait/rotation/復旧の実入力・寸法確認が成功 |
| A09 | held dragで飛び/停止 | trusted pointer/touchの116独立座標、最大0.731555px<既存1px。9点連続drag、回転/pause/復旧/retryが成功。最終版には自動切替中dragの配布経路はない |
| A10 | 画質切替直後pause/restoreが破損 | 候補の機能検査と待ちの失敗を保存。最終版は切替なし。元app/lifecycle/createViewを復元し、実コンテキスト復旧を両engineで再確認 |
| A11 | 同時描画の統合で事実/feedbackが欠落 | 30同時返球/得点/音声は元検査を保護。厳密同時同位置だけ光を共通化。512hit+final100lossで最後の4edge欠落(F01)を独立レビューが発見、table予約4quadを修正し専用test RED→GREEN |
| A12 | 30球に見えるだけで返球を間引く | 全game/input/audio/loop/appを含む56sourceが6ecとbyte一致、変更は4renderだけ。914unit/200browser/release8と実物理through-playを再実行。性能元sampleを再集計し、最終source44/44実行でrunning/30球/描画有効を確認。baseline停止1件は別記 |
| A13 | clockを遅くして性能値だけ改善 | fixedDt1/120・maxSteps12・slowFrame1.50・loopはbyte不変。実60秒のsim進行を別指標で記録。遅延下の既存catch-up上限による未達を、ゲーム時間改善や合格として隠さない |
| A14 | LinuxをiPhone実機と誤認 | Chromium SwiftShader/WebKit LinuxとCSS/DPRの疑似条件のみ。物理iPhone Safari/操作感/HDRは未確認のまま |
| A15 | テストscoreが本番ランキングへ送られる | 元mock/route fixtureでRPC応答を置換。新診断はlocalhost以外とWebSocketを遮断しblocked/errorsを保存。配布物にscore/debug/testURL入口がないことを検査。DB変更/試験送信なし |
| A16 | 条件/失敗を変えて改善を作る | 同じrunner/hash/入力/基準を保護。停止したbaseline第3低画質pairは失敗として残し、停止後RAFを高速gameplayと数えない。両側を比較中央値から外し、同条件pair4を追加。初回launch/不均等warmup/旧CI timeout/未実施候補撮影も成功に数えない。補足撮影の時計位相不一致4sequenceも失敗保存し、test時計だけ修正して全720対の10キー厳密一致をRED→GREENで確認。製品・解析閾値は不変 |

## 独立レビューと修正

Stage1の独立レビューはコード・24床対照のraw・PNGを読み、F01の容量欠落を発見した。修正後の容量専用検査をRED→GREENで記録した。Stage2採用判断の独立レビューはprofile:falseのraw10切替を再計算し、自動機能不採用を支持した。ただしこのLinux観測を実機へ一般化すること、全FPS差を判定統計の原価へ帰属させることを退けた。

最終の新しい文脈による全branchレビューは、4source差分に加え元画像/座標/資源/CIログ/性能raw/点滅rawを確認する。レビュー原文は正式アーカイブ `final-whole-branch-review.md`、前段階は `revised-stage1-code-review.md` と `stage2-adaptive-adoption-review.md`。レビューの保留・未確認・軽微事項も最終結果から落とさない。

正式元記録：`manual-protected-source.json`、`manual-render/`、`manual-native/`、`manual-native-input*`、`manual-resource-audit*`、`manual-effect-decisions*`、`baseline-slow-frame-failure.json`、最終性能/点滅/CI一式。保存先と復元検証は [最終結果](final-results.md) から参照する。
