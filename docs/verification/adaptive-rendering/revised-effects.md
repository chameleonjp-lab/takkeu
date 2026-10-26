> 最終方針更新：自動画質候補9a9b71fは切替時の待ちを理由に不採用。採用対象は本資料の描画整理と既存manual2モード。[Stage2不採用記録](stage2-rejection.md)。最終manual版は型検査・914unit成功、最新SHAのCI/性能/画像を改めて検証する。以下の925unit/autoの記述は候補時点の履歴。

# 改訂Stage1: 装飾を整理してプレイを優先

2026-10-26の追加指示に従い、43条件の全維持・密度固定・画素一致・削除禁止を撤回した。旧仕様のprefix upload撤回と測定は[履歴](stage1-results.md)として残す。ゲーム/入力/loop/音声/結果/ランキングには変更を加えない。

## 実測による候補選択

開始時6ec3872を固定し、実物理replayの30球位置へ装飾を合成した固定sceneを測った。Chromium/SwiftShader、CSS402×874/DPR2、標準buffer603×1311、同じsnapshot/色seed。54対照（18種類×順逆順3回）と、指定4ラリー×前後×3回の24対照。各対照は4warm+8非同期GPU query。同期readbackは最後の別frameに限定し、タイミングへ含めない。CPU生成/頂点/転送/draw/元RGBAも保存する。

| 開始ラリー | 元GPU相当中央値 ms | 簡略化対照 ms | 差 |
|---|---:|---:|---:|
|1500|105.90|69.73|−34.2%|
|2600|111.36|71.36|−35.9%|
|3000|111.60|66.57|−40.4%|
|4000|113.10|68.72|−39.2%|

**これは製品の実ゲーム改善率ではない。** 簡略化対照は全追加rootを省く診断であり、実装版は小さなhit/loss/final feedbackを残す。固定sceneのGPU相当時間と実時間RAF p95を混ぜない。正式な60秒の3組比較は別途行い、同画質とautoによるpixel削減を区別する。

4000/重複sceneの別対照では全体49,544triangle/44draw。球面のみ軽量化は24,584triangle（3組GPU中央値105.60ms、元123.19ms）、常設追加装飾のみ省略は111.39ms、全面century層のみ省略104.51ms。これらの単独差にはばらつきがあり、個別の実ゲーム改善率は未立証。広い層・既存の球面も対象にし、星空だけを主因と決めつけなかった。

## 採用した描画構造

- 球本体/発光Sphereを12×8、影Circleを12分割へ。3つのInstancedMesh、白い中心/材質/物理半径/transform/深度規則は維持。30球の上限や返球を減らす変更ではない。
- 追加演出の4batchを、打球位置の12segment輪・落球位置の6ray印・最後の4edge輪郭の2batchへ整理。常設の星/流星/多重輪/三色電撃/大到達geometryを削除。到達通知と専用fanfareは維持。
- 同時刻・同位置のhit/loss光は固定1024slotの表で一度だけ描く。異なる位置/時刻は厳密比較し、score/event/audioの事実は消さない。入力や当たり判定を呼び出す経路はない。
- 1000以降のfullscreen century祝福層を削除。1500以降のlegacy電撃/揺れは局所feedbackと既存の落球数字へ統合。1500以降の背景は暗くし、それ以前の490〜1499の虹fieldは維持する。
- 1500以降の大きな床を非表示にする。追加の固定scene24対照（4ラリー×前後×3回）ではGPU中央値が1500で70.21→39.12ms、2600で71.79→43.33ms、3000で69.19→38.20ms、4000で69.95→42.93ms。球・台・ラケットは同一状態のまま、描画31回/14,194triangleへ減る。製品の60秒RAF改善率とは区別する。
- 共通GPU資源を段階で破棄しない。早期stageのfield/legacy bufferはretryでも使う。新feedback bufferは固定・使用prefix転送・動的境界のため既存どおりfrustumCulled=false。

CPU上のgame演出事実はHUD/音声/終了clockにも使うため維持する。RALLY_EFFECTSの設定表が存在することを「全43演出が画面に残った」とは報告しない。

## テストの更新と失敗記録

新しい予算/同時光/位置/期限/終了/資源/物理半径の9unitを全RED→GREEN。独立レビューのF01（512hitでtableが満杯となりfinal4edgeが欠落）も専用test RED→GREENで修正し、+4予約をtableへ移した。床の簡略化も球の3種類のinstance行列・ラケット座標が変わらない検査をRED→GREENで追加。型検査と925unitが成功、skip0。重点22browserは容量修正前の参考成功で、最終受入は修正後commitの全CIで判定する。

旧render93caseは36caseへ置換し、予算11caseを追加。削除した形状の検査、旧タイトル、初期の失敗、置換先はrevised-test-scope-map.jsonと全JSON/logへ保存する。旧ゲーム/音声/入力/ランキング/結果/公開SHA照合のテストは削除しない。初回全980では73件のobsolete装飾検査と1件のsandbox子プロセス失敗があり、後者は検査内容を変えず実行可能な権限設定で成功した。新資源検査の5秒timeoutは大きなtyped array値比較をbuffer identityの厳密比較へ変更し、回数20と制限5秒は維持した。

## 残る検証

正式60秒性能、低polyの白中心/実シルエット、pointer精度、auto切替時の再確保、長期retry資源、点滅の旧7警告、全CIのcheckout SHA、最終独立レビューを記録する。ここまでの診断やunitの成功から、実機iPhoneの快適性・正式WCAG・人間の視認/試聴を主張しない。Draftを維持する。

## CIの巨大diff収集

517286cのpush CIは全成功、PR CIはChromiumの3返球操作試験が60秒で失敗した。以前の95cb9d7でも同じ差があった。PRログにはPlaywrightの自動git diffが3秒でtimeoutした記録がある。sparse cloneの外にある巨大な過去証拠までdiff対象になるため、全3設定でcaptureGitInfo.diffをfalseにし、commit情報は保持する。git処理の終了時にはPlaywrightが子プロセスをkillする実装であり、これを返球失敗の原因と断定しない。ゲーム・テスト内容・60秒制限・性能閾値・回数・retries=0は変えず、新commitのCIで再判定する。元の失敗ログとtraceは保存する。
