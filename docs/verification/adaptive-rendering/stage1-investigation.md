# Stage 1 調査（2026-10-26）

A=PR27開始時 `6ec38720b4f720c71bf48c5aef3cdc5732fdd578`。既存の失敗・警告・indexed撤回は取り消さない。最終判定と元測定は別の結果資料を参照。

## 実装済み・未実装・改善余地・不明

| 対象 | 状態 | 現状・判断 |
|---|---|---|
| 追加演出4batch | 実装済み | shared dynamic geometry、used-prefix upload、forceSinglePass=true、renderOrder/depth/blending固定。再実装しない |
| 球・発光・影 | 実装済み | InstancedMeshプール。白core/halo/shadowは独立した役割。合成統合は見た目を変えるため採用しない |
| 置換条件 | 実装済み | 下表とworldStage/rederの閾値。過去500rallyで消す方式は使わない |
| 同時落球wave | 実装済み | 同時刻同形状を1回描画、異時刻alpha budget共通。イベントは保持。二重実装しない |
| legacy celebration属性 | 改善余地あり | drawRangeは使用数のみだが属性更新は全容量。使用prefixだけ転送する候補を実験 |
| 花火属性 | 改善余地あり | 固定1536point ring、毎frame全属性を転送。live prefixのみ候補。密度/寿命/位置/色/音変更なし |
| 星空 | 改善余地あり／有効性不明 | count=80/120/160/240によりupper halfの位置が異なる。不変hashだけcache可能だが過去診断でCPUは主因未立証。今回の転送候補とは別。根拠なし採用しない |
| 虹の床/壁 | 実装済み | 同一screen-space shader材質を2平面で共有、opaque depth-write。半透明扱いで合体しない。uResolution更新を守る |
| 光輪・三色電撃 | 実装済み／改善不明 | shared4batchへ直接書込。細線/haloは異なる幅・色・alpha・blend/順序。単純に層を削ると輪郭と光量変化。shader集約はfill costの逆増・合成差を立証できず未採用 |
| 光輪/流星/電撃/星の画面外省略 | 未実装／有効性不明 | fixed cameraでもaspect/sizeに応じてfrustumは変化。ring半径+aspect+線半幅、meteor長さ+head広がり、枝電撃とtable shakeを含む境界が必要。中心cullは不可。4batchのgeometry boundingSphereは動的、frustumCulledだけtrueへ変更不可。CPUテスト/生成scanが増えるため無条件導入しない |
| 完全遮蔽 | 既存depthTest | 透明depthWrite=falseでopaque床/台が遮蔽。CPU側の部分遮蔽認定は高価かつ危険、追加なし |
| 過去stage専用GPU | 実装済み | stage別allocationなし。4GPU batch共通、legacyも固定。段階でdispose/recreate不要。retry reuse、view dispose時一括解放 |
| 期限切れイベント | 一部実装済み | consumeでarrival/hits/loss/cue/windowをprune。イベントのない時間はboundedな古い参照が残る。rendererは寿命判定済み。wall時刻で消すとpause/final presentationを破壊。上限512hits/512cues/100loss、bestはrunの1fact。prune追加の実ゲーム改善は未立証、変更なし |
| 毎打球worldStage | 改善余地／効果不明 | 最大23entry Map構築。threshold間cache余地はあるが事実/state保護と性能増分の根拠なし、対象を広げない |
| indexed geometry | 調査済み・撤回 | 以前の正式比較で転送量減少だけ、p95改善未立証。再実装しない |
| 大画面手動LOW | 実装済み | 518400pixel上限、スマホ1x、標準上限2M/DPR1.5。Stage1は変更なし |

## 生存期間と資源

A=常設、B=到達、C=action。start/終了/後継はコードそのものに基づく。全て専用GPU allocationを持たず4batchを共用。時刻はsimTime、pauseでは進まない。期限後も共有GPUを保持してretry/後続で再利用する。

| R | 解放 | 終了/後継 | 保持する状態 |
|---|---:|---|---|
| R01 hit ring |50|各hit .3s|実position/score/at/smashReturn（hits record上限1.5s）|
| R02 perimeter B |100|1.2s|arrival.at/config|
| R03 net cross B |200|1.2s|arrival.at/config|
| R04 gold rays B |300|1.5s|arrivalとHUD通知、DOM/CSS|
| R05 threads A |400|2000 star worldへ|score/simTime、不変手続き式|
| R06 green perimeter A |500|1500 tricolorへ|同上|
| R07 green net A |600|1500 tricolorへ|同上|
| R08 background halo A |700|2750 multiへ|同上|
| R09 rainbow sparks B |800|1.5s|arrival.at|
| R10 corner gather A |900|1000 shockwave/worldへ|score進度|
| R11 shockwave B/world A |1000|B3.5s、world1500でtricolorへ|arrival.at/score|
| R12 meteor A |1250|3250 swarmへ|simTime位相|
| R13 tricolor A |1500|プレイ終了まで|simTime/score、各channel独立色/幅/周期|
| R14 floor wave A |1750|2500 orbitへ|simTime位相|
| R15 stars A + transition B |2000|transition2.5s、常設継続|arrival.at、score、count別不変seed|
| R16 side halos A |2250|3500 double-tableへ|simTime位相|
| R17 orbit ribbon A |2500|継続（2600でも保持）|simTime|
| R18 multi halos A |2750|継続|simTime、独立3色|
| R19 opening B |3000|3.5s|arrival.at|
| R20 meteor swarm A |3250|継続|simTime/seed|
| R21 double halos A |3500|継続|simTime|
| R22 center density A |3750|4000 finalへ|score進度|
| R23 final B/world A |4000|B4s、world4001以降も継続|arrival.at/score|

落球L01〜L13は実position/.5s spark、rolling2s impact、10/20/30/40wave1.2s、50net1.2s、55/77/88number.8s、90–99warning.8s、99gold1.2s、100final2s。legacy数字は通常2s/特別3s、net burst .9s、repdigit/century5sを独立保持する。N01 best2sとN02 notice1.8s/major2.5sはHUDとstate、音声5条件はaudio固有資源。対応表を独立した条件へ勝手に再定義しない。正式な43行定義は[既存coverage](https://github.com/chameleonjp-lab/takkeu/blob/6ec38720b4f720c71bf48c5aef3cdc5732fdd578/docs/verification/rally-4000/coverage.md)を参照。

終了時はfinishPresentationがeffectEndまで装飾時刻だけを進める。game simulation時計は停止。最後の演出をその前に参照削除しない。home/retryでcontrollerとrunId、particle births/seen、ball pool可視状態がリセットされる。context復旧はviewをdispose/recreateして現在stateから描画を再構築する。

## 測定上の限界
透明overdrawの診断は本番の描画と分離する。GPU非同期timer query、CPU送信時間、RAF間隔、pixel coverage/頂点/転送量を別の指標として保存。診断のreadPixels/gl.finish時間を実ゲームの性能とは報告しない。point spriteはmaskが違うためmesh overdrawヒストグラムから除外し、point数を別計数する。単一平均box面積を正確なfragment数とは呼ばない。
