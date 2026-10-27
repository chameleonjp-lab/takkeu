# 条件別対応・検証マトリクス

**最終判定：総合受入は未達（性能P1 FAILED）。Linux性能target全16条件未達、4000遅延悪化のP1はFAILED（未解決）。CI4/実装/AI画像の成功を全要件達成にしない。GPU診断96queryを確認。改善の一貫性なし、完全な因果帰属は未立証。**

**判定範囲:** 視覚基準`0285168…`とrender最適化`72c1920…`の検証範囲を区別する。72は全958unit/typecheck通過、Chromium広域416比較すべてRGB差0。canonical Cは`d30aa196f2faccd88fab36de4b94bb585c21b464`（production tree47bd0f3、22:49push）で固定。CI4は全6job成功。最終FULL16は全実行成功だが全target未達。広域832比較とfresh-default16caseは全差0で完了。初回Chromium6成功+WebKit再試行6成功で、単一clean12runではない。初回WebKit1timeout/1interrupt/4未実行を保存。AB初回240秒timeoutを保存しopt-in capture予算だけ4倍、pixel/通常194browser/性能閾値は不変。旧CIを最終判定へ流用しない。38条件の視覚実装と自動検証を確認し、下表の取得画像をAIが観察した。N01単独best文字/光輪と2600通常数字は両engineで追加取得・AI観察済み。人間の視認/試聴・物理端末・VoiceOver・規範的WCAG適合は未確認。継続的な漸増や単独bestの直接画像については行内の限界も残す。

この表の中核条件数は **38 = ラリー23 + 落球13 + 自己ベスト/通常通知2**。専用音声5条件と保護・横断検証は別枠であり、中核条件の達成数へ加算しない。実装・自動検証・AI画像観察の成功を、変更後性能、人間の試聴、実機、規範的光安全性の総合成功へ拡張しない。

`成功（実装・自動・AI画像）`は限定した技術/画像確認の判定であり、人間の視認や試聴を意味しない。CI4はexact canonical C `d30aa196f2faccd88fab36de4b94bb585c21b464`で全6job成功（958unit/71files、194browser、release8=1160）。Playwright skip/flaky/retry/top-level errorsは全0。最終local focused browserは16/16成功。

実装リンク: [状態][state] = `src/game/rallyEffects.ts`、[描画][render] = `src/render/rallyEffects.ts`、[通知][notice] = `src/ui/rallyNotice.ts` と [通知CSS][notice-css]、[既存祝福][legacy] = `src/render/celebrations.ts`、[アプリ][app] = `src/app/createApp.ts`。

自動テストリンク: [状態test][state-test]、[描画test][render-test]、[通知test][notice-test]、[落球座標test][loss-test]、[browser fixture/test][browser-test]。ブラウザ出力先は `evidence/{chromium,webkit}/`。下表は [browserテスト][browser-test] が出力した実画像を参照する。最終focused16件とAI観察の範囲を示し、全ての動作/全端末を網羅した人間確認とはしない。連続画像は必要に応じ [安全性capture][flash-capture] の60Hzデータでも検証する。

## ラリー到達・常設演出（23条件）

| 条件 | 実装ファイル | 自動テスト | 画像・動画 | 判定 |
| --- | --- | --- | --- | --- |
| R01: 50以上、成功返球ごとに実座標のラケット輪 `.3s`（C） | [状態][state] / [描画][render] `hits` | [状態test][state-test]、[描画test][render-test] `.3s`境界/座標/foreign-run | [C](evidence/chromium/thresholds/50-during.png) / [W](evidence/webkit/thresholds/50-during.png) | 成功（実装・自動・AI画像）。人間/実機未確認 |
| R02: 100、台外周を1周 `1.2s`（B） | [状態][state] / [描画][render] `perimeter` | [描画test][render-test] 全外周・終了境界・未解放コート保護 | [C](evidence/chromium/thresholds/100-during.png) / [W](evidence/webkit/thresholds/100-during.png) | 成功（実装・自動・AI画像）。人間/実機未確認 |
| R03: 200、ネット両端から中央交差 `1.2s`（B） | [状態][state] / [描画][render] `netCross` | [状態test][state-test] / [描画test][render-test] 到達・期限 | [C](evidence/chromium/thresholds/200-during.png) / [W](evidence/webkit/thresholds/200-during.png) | 成功（実装・自動・AI画像）。人間/実機未確認 |
| R04: 300、ラリー数字背後の金色光条 `1.5s`（B） | [状態][state] / [通知][notice] / [通知CSS][notice-css] | [通知test][notice-test]、`logs/ui-finish-green.log` | [C](evidence/chromium/thresholds/300-during.png) / [W](evidence/webkit/thresholds/300-during.png) | 成功（実装・自動・AI画像）。人間/実機未確認 |
| R05: 400、相手側背景の細い光糸がゆっくり移動（A） | [状態][state] / [描画][render] `threads` | [描画test][render-test] 段階・時刻差 / [browser][browser-test] | [C](evidence/chromium/thresholds/400-during.png) / [W](evidence/webkit/thresholds/400-during.png) | 成功（実装・自動・AI画像）。人間/実機未確認 |
| R06: 500、緑の台外周電流（A） | [状態][state] / [描画][render] `perimeter` | [描画test][render-test] 境界・quality・静止 / [browser][browser-test] | [C](evidence/chromium/thresholds/500-during.png) / [W](evidence/webkit/thresholds/500-during.png) / [連続画像](evidence/chromium/motion/500-0.10.png) | 成功（実装・自動・AI画像）。人間/実機未確認 |
| R07: 600、緑のネット電流（A） | [状態][state] / [描画][render] `netCross` | [状態test][state-test] / [描画test][render-test] 段階 | [C](evidence/chromium/thresholds/600-during.png) / [W](evidence/webkit/thresholds/600-during.png) | 成功（実装・自動・AI画像）。人間/実機未確認 |
| R08: 700、遠景の大きな輪がゆっくり拡縮（A） | [状態][state] / [描画][render] `single-halo` | [描画test][render-test] 時間別bounds・reduced-motion | [C](evidence/chromium/thresholds/700-during.png) / [W](evidence/webkit/thresholds/700-during.png) / [連続画像](evidence/chromium/motion/700-0.10.png) | 成功（実装・自動・AI画像）。人間/実機未確認 |
| R09: 800、台縁から虹/緑の火花 `1.5s`（B） | [状態][state] / [描画][render] `edge-sparks` | [描画test][render-test] 期限・resource cap | [C](evidence/chromium/thresholds/800-during.png) / [W](evidence/webkit/thresholds/800-during.png) | 成功（実装・自動・AI画像）。人間/実機未確認 |
| R10: 900–999、四隅へ集まり徐々に明るくなる（A、1000で置換） | [状態][state] / [描画][render] `cornerGather` | [描画test][render-test] 900/950/999 alpha・1000除去 | [C:900](evidence/chromium/thresholds/900-during.png) / [C:999](evidence/chromium/thresholds/1000-before.png) / [W:900](evidence/webkit/thresholds/900-during.png) / [W:999](evidence/webkit/thresholds/1000-before.png) | 成功（実装・自動・AI 900/999状態画像）。全区間の連続動画/人間未確認 |
| R11: 1000、巨大虹衝撃波+緑青交差電撃 `3.5s`、大通知 `2.5s`（B、常設緑青world） | [状態][state] / [描画][render] / [通知][notice] | [描画test][render-test]、[通知test][notice-test]、優先fade/再生防止 | [C](evidence/chromium/thresholds/1000-during.png) / [W](evidence/webkit/thresholds/1000-during.png) / [連続画像](evidence/chromium/motion/1000-0.10.png) | 成功（実装・自動・AI画像）。人間/実機未確認 |
| R12: 1250、横方向の流星、4秒周期（A） | [状態][state] / [描画][render] `meteors(false)` | [状態test][state-test] / [描画test][render-test] 段階・geometry | [C](evidence/chromium/thresholds/1250-during.png) / [W](evidence/webkit/thresholds/1250-during.png) / [連続画像](evidence/chromium/motion/1250-0.10.png) | 成功（実装・自動・AI画像）。人間/実機未確認 |
| R13: 1500、緑青赤の交差電流、色別の幅/長さ/周期、強い瞬滅なし（A） | [状態][state] / [描画][render] `crossing`, `tricolorTable` | [描画test][render-test] 幅・decay・微小時刻差・台/ネット3色 | [C](evidence/chromium/thresholds/1500-during.png) / [W](evidence/webkit/thresholds/1500-during.png) / [連続画像](evidence/chromium/motion/1500-0.10.png) | 成功（実装・自動・AI画像）。人間/実機未確認 |
| R14: 1750、床外周の光波が遠くへ流れる、4秒周期（A、2500で置換） | [状態][state] / [描画][render] `floorWave` | [描画test][render-test] 1750/2500境界・geometry | [C](evidence/chromium/thresholds/1750-during.png) / [W](evidence/webkit/thresholds/1750-during.png) / [連続画像](evidence/chromium/motion/1750-0.10.png) | 成功（実装・自動・AI画像）。人間/実機未確認 |
| R15: 2000、2.5秒で暗い宇宙的奥行き・星・大輪へ、3色電撃と既存虹台を維持（A+遷移） | [状態][state] / [描画][render] `stars` | [描画test][render-test] 実camera投影・不透明台との遮蔽・遷移期限 | [C](evidence/chromium/thresholds/2000-during.png) / [W](evidence/webkit/thresholds/2000-during.png) / [連続画像](evidence/chromium/motion/2000-0.10.png) | 成功（実装・自動・AI画像）。人間/実機未確認 |
| R16: 2250、左右側方の輪、3秒周期（A、3500で置換） | [状態][state] / [描画][render] `sideHalos` | [状態test][state-test] / [描画test][render-test] 2250/3500境界 | [C](evidence/chromium/thresholds/2250-during.png) / [W](evidence/webkit/thresholds/2250-during.png) / [連続画像](evidence/chromium/motion/2250-0.10.png) | 成功（実装・自動・AI画像）。人間/実機未確認 |
| R17: 2500、台の周囲を回る帯と帯に沿う電撃（A、床波を置換） | [状態][state] / [描画][render] `orbitRibbon` | [描画test][render-test] 波打つstrand geometry・置換 | [C](evidence/chromium/thresholds/2500-during.png) / [W](evidence/webkit/thresholds/2500-during.png) / [連続画像](evidence/chromium/motion/2500-0.10.png) | 成功（実装・自動・AI画像）。人間/実機未確認 |
| R18: 2750、複数背景輪+3色交差（A、単一輪を置換） | [状態][state] / [描画][render] `multiHalos`, `crossing` | [状態test][state-test] / [描画test][render-test] 2749/2750境界 | [C](evidence/chromium/thresholds/2750-during.png) / [W](evidence/webkit/thresholds/2750-during.png) / [連続画像](evidence/chromium/motion/2750-0.10.png) | 成功（実装・自動・AI画像）。人間/実機未確認 |
| R19: 3000、巨大電撃輪の開放+遠景虹波 `3.5s`、大通知 `2.5s`（B） | [状態][state] / [描画][render] `electricOpening` / [通知][notice] | [描画test][render-test] 期限・実camera内geometry / [通知test][notice-test] | [C](evidence/chromium/thresholds/3000-during.png) / [W](evidence/webkit/thresholds/3000-during.png) / [連続画像](evidence/chromium/motion/3000-0.10.png) | 成功（実装・自動・AI画像）。人間/実機未確認 |
| R20: 3250、流星群+電撃分岐増加（A、単流星を置換） | [状態][state] / [描画][render] `meteors(true)`, `crossing` | [描画test][render-test] 3249/3250のdegree>=3接合点増加 | [C](evidence/chromium/thresholds/3250-during.png) / [W](evidence/webkit/thresholds/3250-during.png) / [連続画像](evidence/chromium/motion/3250-0.10.png) | 成功（実装・自動・AI画像）。人間/実機未確認 |
| R21: 3500、台の二重輪に3D電撃が絡む（A、側方輪を置換） | [状態][state] / [描画][render] `tableHalos` | [描画test][render-test] 新規strandの高さ変動・置換 | [C](evidence/chromium/thresholds/3500-during.png) / [W](evidence/webkit/thresholds/3500-during.png) / [連続画像](evidence/chromium/motion/3500-0.10.png) | 成功（実装・自動・AI画像）。人間/実機未確認 |
| R22: 3750–3999、中央電撃の密度が4000へ向け増加（A） | [状態][state] / [描画][render] `centerDensity` | [状態test][state-test] / [描画test][render-test] 3750/4000境界 | [C:3750](evidence/chromium/thresholds/3750-during.png) / [C:3999](evidence/chromium/thresholds/4000-before.png) / [W:3750](evidence/webkit/thresholds/3750-during.png) / [W:3999](evidence/webkit/thresholds/4000-before.png) | 成功（実装・自動・AI 3750/3999状態画像）。全区間の連続動画/人間未確認 |
| R23: 4000、4秒の3色収束→虹輪形成→急拡大→複数重なりfade、4001+の最終world維持（B+A） | [状態][state] / [描画][render] `finalAssembly` / [通知][notice] | [描画test][render-test] 4phase・4輪投影・期限・priority/replay / [実物理test][through-test] | [C](evidence/chromium/thresholds/4000-during.png) / [W](evidence/webkit/thresholds/4000-during.png) / [連続画像](evidence/chromium/motion/4000-0.10.png) | 成功（実装・自動・AI画像）。人間/実機未確認 |

## 落球（13条件）

13条件の状態・実座標・描画・終了継続を実装し、自動検証と取得画像のAI観察を確認した。既存数字色/期限は保持した。低音の人間試聴は別枠で未確認。

| 条件 | 実装ファイル | 自動テスト | 画像・動画 | 判定 |
| --- | --- | --- | --- | --- |
| L01: 落球ごとに実落球位置の短い火花、最大 `.5s` | [simulation][simulation] / [状態][state] `loss-spark`、[描画][render] | [落球座標test][loss-test]、[状態test][state-test]、[browser][browser-test] | [C](evidence/chromium/losses/1-0.25.png) / [W](evidence/webkit/losses/1-0.25.png) | 成功（実装・自動・AI画像）。人間/実機未確認 |
| L02: 2秒以内の4球以上、実座標を失わず衝撃/低音 | [状態][state] `loss-impact`、[audio][audio]、[描画][render] | [状態test][state-test] 真のrolling窓、[落球座標test][loss-test]、[音声test][audio-test] | [C](evidence/chromium/losses/4-0.25.png) / [W](evidence/webkit/losses/4-0.25.png) | 成功（実装・自動・AI画像）。人間/実機未確認。低音の人間試聴未確認 |
| L03: 累計10球、台へ光波 `1.2s` | [状態][state] `loss-wave`、[描画][render] | [状態test][state-test] 10特別cue / [browser][browser-test] | [C](evidence/chromium/losses/10-0.25.png) / [W](evidence/webkit/losses/10-0.25.png) | 成功（実装・自動・AI画像）。人間/実機未確認 |
| L04: 累計20球、台へ光波 `1.2s` | [状態][state] `loss-wave`、[描画][render] | [状態test][state-test] 20特別cue / [browser][browser-test] | [C](evidence/chromium/losses/20-0.25.png) / [W](evidence/webkit/losses/20-0.25.png) | 成功（実装・自動・AI画像）。人間/実機未確認 |
| L05: 累計30球、台へ光波 `1.2s` | [状態][state] `loss-wave`、[描画][render] | [状態test][state-test] 30特別cue / [browser][browser-test] | [C](evidence/chromium/losses/30-0.25.png) / [W](evidence/webkit/losses/30-0.25.png) | 成功（実装・自動・AI画像）。人間/実機未確認 |
| L06: 累計40球、台へ光波 `1.2s` | [状態][state] `loss-wave`、[描画][render] | [状態test][state-test] 40特別cue / [browser][browser-test] | [C](evidence/chromium/losses/40-0.25.png) / [W](evidence/webkit/losses/40-0.25.png) | 成功（実装・自動・AI画像）。人間/実機未確認 |
| L07: 累計50球、ネット電撃 `1.2s` | [状態][state] `loss-net`、[描画][render] | [状態test][state-test] 50特別cue / [browser][browser-test] | [C](evidence/chromium/losses/50-0.25.png) / [W](evidence/webkit/losses/50-0.25.png) | 成功（実装・自動・AI画像）。人間/実機未確認 |
| L08: 累計55球、既存数字色/寿命を保ち数字halo `.8s` | [既存祝福][legacy] / [状態][state] `loss-number`、[描画][render] | [状態test][state-test] `.8s`、既存 `celebrations.test.ts` / `celebration-render.test.ts` | [C](evidence/chromium/losses/55-0.25.png) / [W](evidence/webkit/losses/55-0.25.png) | 成功（実装・自動・AI画像）。人間/実機未確認 |
| L09: 累計77球、既存数字色/寿命を保ち数字halo `.8s` | [既存祝福][legacy] / [状態][state] `loss-number`、[描画][render] | [状態test][state-test] `.8s`、既存数字test | [C](evidence/chromium/losses/77-0.25.png) / [W](evidence/webkit/losses/77-0.25.png) | 成功（実装・自動・AI画像）。人間/実機未確認 |
| L10: 累計88球、既存数字色/寿命を保ち数字halo `.8s` | [既存祝福][legacy] / [状態][state] `loss-number`、[描画][render] | [状態test][state-test] `.8s`、既存数字test | [C](evidence/chromium/losses/88-0.25.png) / [W](evidence/webkit/losses/88-0.25.png) | 成功（実装・自動・AI画像）。人間/実機未確認 |
| L11: 累計90–99球、警告の柱/段階（常設lostBallCountも利用） | [状態][state] `loss-warning`、[描画][render] | [状態test][state-test] 90…99全cue / [browser][browser-test] | [C](evidence/chromium/losses/90-0.25.png) / [W](evidence/webkit/losses/90-0.25.png) | 成功（実装・自動・AI画像）。人間/実機未確認 |
| L12: 累計99球、金色光 `1.2s` | [状態][state] `loss-gold`、[描画][render] | [状態test][state-test] cue/期間 / [browser][browser-test] | [C](evidence/chromium/losses/99-0.25.png) / [W](evidence/webkit/losses/99-0.25.png) | 成功（実装・自動・AI画像）。人間/実機未確認 |
| L13: 累計100球、終了時の外向き演出、物理停止・最後の演出だけ継続 | [simulation][simulation] / [状態][state] `loss-final` / [finish][finish] / [描画][render] | [落球座標test][loss-test]、`loss-limit.test.ts`、`finish-presentation.test.ts`、[browser][browser-test] | [C](evidence/chromium/losses/100-0.25.png) / [W](evidence/webkit/losses/100-0.25.png) / [終了](evidence/chromium/losses/100-finishing.png) | 成功（実装・自動・AI画像）。人間/実機未確認 |

## 自己ベスト・通常通知（2条件）

| 条件 | 実装ファイル | 自動テスト | 画像・動画 | 判定 |
| --- | --- | --- | --- | --- |
| N01: 開始時の非0自己ベストを初めて超えた1回だけ、文字2秒・光輪・成功音。初回best=0は対象外 | [アプリ][app] / [状態][state] / [通知][notice] / [音源][tones] | [状態test][state-test] initialBest、[通知test][notice-test]、[音声test][audio-test]、`screens-direct.test.ts` / [追加2/2](logs/browser-best-2600.json) | [C before](evidence/chromium/layout/best-before.png) / [C during](evidence/chromium/layout/best-during.png) / [W during](evidence/webkit/layout/best-during.png) / [after](evidence/chromium/layout/best-after.png) / [再送](evidence/webkit/layout/best-no-repeat.png) / [metadata](evidence/chromium/layout/best-and-2600.json) | 成功（実装・自動・AI実画像）。人間試聴/実機未確認 |
| N02: 5刻み〜49、10刻み50〜199、100刻み200〜4000、通常1.8秒。主要4節目2.5秒優先。2000+は数字主体 | [状態][state] / [通知][notice] / [通知CSS][notice-css]、既存 `resultComments.ts`再利用 | [状態test][state-test] cadence、[通知test][notice-test]、[browser][browser-test] 200%/320px/warning nonoverlap / [追加2/2](logs/browser-best-2600.json) | [通常50](evidence/chromium/thresholds/50-during.png) / [C 2600数字](evidence/chromium/layout/ordinary-2600.png) / [W 2600数字](evidence/webkit/layout/ordinary-2600.png) / [主要200%](evidence/webkit/layout/4000-320x568-text200-age0.png) | 成功（実装・自動・AI実画像）。人間/実機未確認 |

## 追加音声（5条件、中核38へ加算しない）

波形は [audio-report.md](audio-report.md)、`audio/summary.json`、`audio/{chromium,webkit}-measurements.json` を参照。140条件matrix + 終了impact/対照4件 = **144 native renders**の自動確認は**人間の実試聴の代用ではない**。

| 条件 | 実装ファイル | 自動テスト | 画像・動画 | 判定 |
| --- | --- | --- | --- | --- |
| A01: 1000専用ファンファーレ、通常100単位音を置換 | [audio][audio] / [音源][tones] | [音声test][audio-test] 重複/置換/contour、`logs/audio-focused-green.log`、`audio/summary.json` | [C音源](audio/chromium-1000-standard.wav) / [W音源](audio/webkit-1000-standard.wav) / [波形](audio/summary.json) | **未確認（人間試聴・音声総合）**。実装/自動/native144 render確認 |
| A02: 3000専用祝福音、通常100単位音を置換 | [audio][audio] / [音源][tones] | [音声test][audio-test]、native offline probe | [C音源](audio/chromium-3000-standard.wav) / [W音源](audio/webkit-3000-standard.wav) / [波形](audio/summary.json) | **未確認（人間試聴・音声総合）**。実装/自動/native144 render確認 |
| A03: 4000専用到達音、通常100単位音を置換 | [audio][audio] / [音源][tones] | [音声test][audio-test]、native offline probe | [C音源](audio/chromium-4000-standard.wav) / [W音源](audio/webkit-4000-standard.wav) / [波形](audio/summary.json) | **未確認（人間試聴・音声総合）**。実装/自動/native144 render確認 |
| A04: 非0開始best超えの成功音、1プレイ1回 | [アプリ][app] / [状態][state] / [audio][audio] / [音源][tones] | [音声test][audio-test] mute/zero/pause/reset/once、[状態test][state-test] | [C音源](audio/chromium-1000-best-record.wav) / [W音源](audio/webkit-1000-best-record.wav) / [波形](audio/summary.json) | **未確認（人間試聴・音声総合）**。実装/自動/native144 render確認 |
| A05: rolling2秒/4落球以上の低い衝撃音 | [状態][state] / [audio][audio] / [音源][tones] | [状態test][state-test] rolling窓、[音声test][audio-test] unique/current/limits | [C音源](audio/chromium-1000-loss-impact.wav) / [W音源](audio/webkit-1000-loss-impact.wav) / [波形](audio/summary.json) / [終了対照4render](audio/ending-impact-summary.json) | **未確認（人間試聴・音声総合）**。実装/自動/native144 render確認 |

## 保護・横断検証（上記条件数と別枠）

| 条件 | 実装ファイル | 自動テスト | 画像・動画 | 判定 |
| --- | --- | --- | --- | --- |
| 再送/複数固定tick/同時30hit/100loss、異run、履歴上限、ゲーム乱数不使用 | [状態][state] / [simulation][simulation] / [アプリ][app] | [状態test][state-test]、[落球座標test][loss-test]、`simulation-isolation.test.ts` | `through-play.json`は数値証拠、画像ではない | 成功（unit/状態・数値比較）。人間操作動画ではない |
| pause/resume/resize/context再構築で一時演出を再開時に再発生させない | [アプリ][app] / [描画][render] / [通知][notice] | [描画test][render-test] pause/restore、[browser][browser-test] deterministic restore | [C metadata](evidence/chromium/motion/geometry-sequence.json) / [W metadata](evidence/webkit/motion/geometry-sequence.json) | 成功（CI4/最終focused16・AI画像）。物理端末未確認 |
| gameoverは物理即停止、最終score/登録は即確定、描画だけ残り最大5秒 | [アプリ][app] / [finish][finish] | `finish-presentation.test.ts`、`loss-limit.test.ts`、`screens-direct.test.ts`、[browser][browser-test] | 予定 `losses/100-finishing.png` | 成功（自動・AI終了画像）。描画のみ最大5秒、登録は即時 |
| ranking/share/保存を保護。guest非参加、同play+submission ack後の順位、TOP100/TOP30 | `src/ranking/{client,controller,config,resultPosition}.ts`（無変更） / [アプリ][app] | `ranking.test.ts`、`ranking-screens.test.ts`、`result-position.test.ts`、`ranking-position-sql.test.ts`、`tests/browser/ranking-isolation.spec.ts` | 既存result browser tests。今回の結果画像再取得は未確認 | 成功（保護byte照合・CI4回帰）。本番試験送信なし |
| PR26の44コメント、2000+固定コメント、結果数値色/電撃/順序/順位表示 | `src/ui/{resultComments.ts,resultEffects.ts,result.css,screens.ts}`、`src/ranking/resultPosition.ts`（無変更） | `result-comments.test.ts`、`result-effects.test.ts`、`result-layout.test.ts`、`tests/browser/result-{layout,position,presentation}.spec.ts` | PR26再確認画像は本matrix更新時点で未確認 | 成功（保護byte照合・CI4回帰）。VoiceOver実機未確認 |
| 直接入力/カメラ/衝突/速度/30球上限/100落球終了/450smash/555bounce/報酬を保護 | `src/game/*`、`src/input/*`、`src/render/camera.ts`（event例外のみ） | [実物理test][through-test]、`simulation-isolation.test.ts`、既存input/physics suites | `through-play.json`: 実固定step0→4001、30球、RNG/snapshot/events一致。fixture画像ではない | 成功（保護・Cで実物理0→4001再export1/1、events/snapshot/RNG一致）。物理端末入力未確認 |
| 警告最優先、専用曲をduck、voice上限でも警告を失わず、2000通常曲維持 | [audio][audio] / [音源][tones] | [音声test][audio-test] limit1/8・duck・reset/fallback、offline paired warning residual | 実WAV `audio/{engine}-{1000,3000,4000}-saturated-warning.wav` | 実装/graph/native144件確認。人間試聴未確認 |
| reduced-motionで識別可能な静的段階、光/揺れの装飾運動を抑え、物理座標維持 | [描画][render]、`src/render/{presentation,celebrations,particles}.ts`、[アプリ][app] | `reduced-world.test.ts`、[描画test][render-test]、`logs/reduced-world-green.log`、`logs/reduced-particles-green.log` | 実画像 `motion/4001-reduced-motion.png`、`safety/captures/4000-{standard,low}-reduced/` | 成功（自動・AI画像）。規範的WCAG/実機は未確認 |
| 品質standard/lowは密度調整、固定GPU/node/material上限、長時間/再試行cleanup | [描画][render] / `src/render/createView.ts` | [描画test][render-test] buffer identity/caps/dispose、[性能test][performance-test] | [C frames](evidence/chromium/thresholds/frames.json) / [W frames](evidence/webkit/thresholds/frames.json) / [final resources](after-single-pass/resource-detail.json) | 固定資源/cleanup自動確認、最終40calls/57geometry/1688報告active particles。既存1536point slots+新10240quad slots（1720320bytes）；raw11776は異単位和で物理particle容量ではない |
| 性能:1500/2000/3000/4000×両品質×反復、30球60秒、前後同環境、p95/25ms比率 | `tests/performance/rally-4000.spec.ts`、[性能collector][performance-collector]、[比較][performance-compare] | [性能test][performance-test]、`performance-method.md` | [最終FULL16](after-single-pass/chromium/summary.json) / [3way報告](performance-report.md) / [baseline→final](performance-comparison-single-pass.json) / [initial→final](performance-optimization-comparison.json) | **未達・P1 FAILED（未解決）**。3matrix全実行成功/各target0/16。4000 final中央値標準300ms（baseline+16.2%）/低316.7ms（+15.2%）。GPU96/96 available/disjoint0、一貫したsingle-pass改善なし。4CPU quota原因は未立証 |
| WCAG2.3.1:既存虹/金/数字交替も含む60Hz6秒、一般/赤閃光・面積・両品質 | [安全性capture][flash-capture] / [解析][flash-analyzer] / [pack][flash-pack] | `logs/flash-analyzer-tests.log`自己検証、実capture解析は予定 | [最終14scene/5040frame](safety/final-primary-index.json) / [固定field追加診断](safety/fixed-field-1500-standard.json) | 全area<21824。一次9通過/5aux警告を保持。追加固定field<=2。**規範的適合は未確認** |
| Chromium/WebKit、320px/縦横/200%文字、主要通知/警告の重なりと入力透過 | [通知][notice] / [通知CSS][notice-css] / [browser][browser-test] | [browser][browser-test] layout assertions | [320px](evidence/chromium/layout/320x568-text100.png) / [200%](evidence/webkit/layout/390x844-text200.png) / [横画面](evidence/chromium/layout/844x390-text100.png) | 成功（CI4 194・local16・AI画像）。実機/VoiceOver未確認 |
| human listening/iPhone/Android/HDR/端末負荷 | 生成WAV・標準のゲーム起動経路 | 自動化結果で代替不可 | `audio/*.wav`は材料のみ、実機映像なし | **未確認** |

## 現時点の証拠への入口

- [stage1-review.md](stage1-review.md) / [stage2-review.md](stage2-review.md): 実装段階レビューと修正履歴。画像/性能/安全性合格の証明ではない。
- [state-report.md](state-report.md)、`logs/state-green.log`、`logs/render-stage2-final-green.log`、`logs/ui-finish-green.log`: 対象unit範囲を確認する。
- [browser-evidence-report.md](browser-evidence-report.md): 取得予定と現在の実行状況。画像の取得と内容の観察は別々に更新する。
- [audio-report.md](audio-report.md): native波形と人間試聴の区別。
- [performance-method.md](performance-method.md)、[safety/README.md](safety/README.md): 方法と限界。
- [archive-provenance.json](archive-provenance.json) / [log](logs/archive-provenance.log): canonical Cと239実行入力のmode/bytes一致、manifest SHA256 `595a0c039b59140997d66a565f8054d506f82c72b9d8e436bed39caeeba93f98`。archive前確認済み、record commit後はread-only再確認。記録CIは`[skip ci]`で意図skip、成功ではない。
- [protected-integrity.json](protected-integrity.json): 固定baselineと現作業ツリーのバイト照合。`python docs/rally-4000/refresh-report-index.py`で最終修正後に再生成する。
- [変更ファイル一覧](../../rally-4000/changed-files.md): `git diff main` + 未追跡ファイルの時点一覧。

[state]: ../../../src/game/rallyEffects.ts
[render]: ../../../src/render/rallyEffects.ts
[notice]: ../../../src/ui/rallyNotice.ts
[notice-css]: ../../../src/ui/rallyNotice.css
[legacy]: ../../../src/render/celebrations.ts
[simulation]: ../../../src/game/simulation.ts
[app]: ../../../src/app/createApp.ts
[finish]: ../../../src/app/finishPresentation.ts
[audio]: ../../../src/audio/audio.ts
[tones]: ../../../src/audio/tones.ts
[state-test]: ../../../tests/unit/rally-effects.test.ts
[render-test]: ../../../tests/unit/rally-render.test.ts
[notice-test]: ../../../tests/unit/rally-notice.test.ts
[loss-test]: ../../../tests/unit/loss-position.test.ts
[audio-test]: ../../../tests/unit/rally-audio.test.ts
[through-test]: ../../../tests/unit/rally-through-play.test.ts
[browser-test]: ../../../tests/browser/rally-effects.spec.ts
[performance-test]: ../../../tests/performance/rally-4000.spec.ts
[performance-collector]: ../../../tests/helpers/collectRallyPerformance.mjs
[performance-compare]: ../../../tests/helpers/compareRallyPerformance.mjs
[flash-capture]: ../../../tests/helpers/captureRallyFlashFrames.mjs
[flash-analyzer]: ../../../tests/helpers/rallyFlashAnalysis.py
[flash-pack]: ../../../tests/helpers/packRallyFlashEvidence.py
