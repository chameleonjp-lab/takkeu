# 敵対的検証台帳

正式判定は完了ログ・レビューを追加して更新する。実装説明だけでPASSとしない。

| ID | 攻撃/失敗条件 | 検査方法 | 結果 |
|---|---|---|---|
| A01 | 2600でも500由来電撃/常設を誤削除 | 全stage境界、実controller/render tests、byte保護比較 | 検証中 |
| A02 | retry/contextで共有GPUが消える | repeated retry/restoreとresource plateau | 検証中 |
| A03 | 透明統合で色/奥行き/点滅が変化 | 同state全RGBA、材質/order、既存flash閾値 | 検証中 |
| A04 | 部分的な長い電撃/光輪が消える | 実6頂点clip診断、portrait/landscape、center cull禁止 | 検証中 |
| A05 | shaderでGPU逆増 | profile診断と非同期query。未採用なら無変更を照合 | 検証中 |
| A06 | shared材質の色/状態が連動 | 各channel/position/hash、単独/同時stress | 検証中 |
| A07 | autoの上下反復/再確保stall | 60/120Hz・反復load単体＋実buffer切替interval | 検証中 |
| A08 | buffer変更でCanvas CSSが変化 | native CSS rectangle前後完全一致 | 検証中 |
| A09 | held pointerで飛び/停止 | 同じpointerID・全9点CSS誤差<1px・切替中drag | 検証中 |
| A10 | 切替直後pause/restore破損 | pause/resume/hidden/context/rotation fixtures | 検証中 |
| A11 | 同時feedback欠落 | 30hit score/events/audio、max火花とloss100、geometry/hash | 検証中 |
| A12 | 返球を間引く | 全simulation/loop/input filehashとisolation/30simultaneous tests | 検証中 |
| A13 | ゲーム時計を遅くする | loop/dt/maxSteps不変＋実60sのsim進行全sample | 検証中 |
| A14 | Linux結果をiPhone実機と誤認 | WebKit/viewportと実機未確認を別欄にする | 実機未確認を維持 |
| A15 | 本番ランキング送信 | route mock/外部遮断、release/debug入口監査 | 検証中 |
| A16 | テスト条件変更で改善を作る | 事前plan、同runner/source hashes、全反復/失敗保存、独立再集計 | 検証中 |

独立したコードレビュー担当は `/workspace/stage1-code-review.md` にStage1コード2file/全保護fileのhashを確認済み。元測定と画像が揃うまで採用判定を保留している。
