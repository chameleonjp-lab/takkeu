# 遊びやすさを優先する描画整理 Implementation Plan

> For agentic workers: Use superpowers:executing-plans. The user's autonomous execution instruction remains in force; do not add a design approval gate.

Goal: 装飾を整理し、30球の視認・操作・安定性を優先する。
Architecture: ゲームの事実/音声/物理を描画から分離した既存構造を維持。test-onlyの個別ablationを先に行い、効果のある簡略化だけ製品へ反映する。95cbのopt-in自動画質は、整理後にも必要かを同じ計測で再評価する。
Tech Stack: TypeScript/Three.js/Vite、Vitest、Playwright Chromium/WebKit。
Spec: この会話の追加指示「演出維持の制約を撤回」（2026-10-26、11:43 UTC受信）。旧planと43条件維持/画素完全一致/密度固定/削除禁止より優先する。

## Global Constraints

- 得点、最大30球、増球、全同時返球、難易度、球速/軌道/スマッシュ/バウンド、入力/衝突、終了条件、4000後の継続を保護。
- fixedDt=1/120、maxStepsPerFrame=12、slowFrameSeconds=1.50とloopを変更しない。
- PR26結果44コメント、名前別best順位、ランキング/失敗/再送、X共有、必要な音（通常/スマッシュ警告/専用fanfare）は維持。
- 本番スコア/DB権限変更/main commit/merge/deploy禁止。Draft PR27でレビュー可能にする。
- absolute目標p95<=25ms、<=25ms率>=95%、sim>=59s/実60s、30球、予期しない停止なしを緩和しない。
- obsoleteな装飾shapeテストは新仕様へ更新するが、ゲーム/入力/性能の失敗は隠さない。変更理由と削除したassertionを記録する。

## Review Focus

1. 装飾の削除がscore/events/audio/return数へ漏れない。全game/input/loop/audio hashと30同時返球を確認。
2. 背景/光の削減で白球/ラケット/スマッシュwarningが隠れない。native aspect、同位置の白core>=200（baseline>=220）、入力<1CSSpxを維持。
3. 100落球で最後のfeedbackが残り、retry/contextでshared資源が復旧する。終了時計/資源/再挑戦を検査。
4. autoの段階でCSS/camera/pointer captureが変わらない。手動設定互換/held drag/rotation/hidden/restoreを検査。
5. 新しい点滅警告を作らず、旧7件を解消済みに見せない。同じ一次解析器/閾値/6sを使用し、残存と追加を分ける。

## 方針の比較と判断権

候補A: 追加の常設装飾を個別に軽量化。意味を残せるが、既存の測定ではCPU費用は小さく大幅な改善は未立証。
候補B: 重複する常設装飾をまとめ、必要な打球/落球/到達のfeedbackと読みやすい暗い背景へ整理。負荷/視認/安全性を優先する今回の第一候補。
候補C: 追加描画をすべて削除しHUDと音だけにする。最小負荷の対照として測るが、打球feedback/終了の識別性を失うなら採用しない。
最終の選択は実測・画像・入力の結果で行う。ユーザーは簡略化/統合/削除と自律判断を明示的に許可した。

## Task 1: 個別負荷と候補対照

Files: artifacts/adaptive-rendering/runners/effect-ablation.mjs（test-only）、revised-effects調査表/元JSON。

- [ ] 1500/2600/3000/4000、実物理replay30球の同じsnapshotで、stars/光輪/三色/流星/各arrival/loss、全追加rootの個別対照を測る。
- [ ] CPU生成・頂点/転送・draw・取得可能な非同期GPU時間を記録。固定scene診断を実時間60s性能とは呼ばない。
- [ ] 大きな既存fullscreen装飾も別の対照として切り分け、追加演出だけを原因と決めつけない。
- [ ] 全演出を「維持/軽量化/統合・簡略化/削除」、見た目への貢献/実測負荷/効果で表にする。

## Task 2: 装飾整理を実装・検証・commit

Files: src/render/rallyEffects.ts、必要な場合のみsrc/render/celebrations.ts/createView.ts/field.ts、対応するrender-only unit/browser tests。game/audio/input/loop/結果/ランキングは変更しない。

- [ ] 選んだ描画予算/重複feedback/終了/静止設定/再利用をテストにし、現コードでREDを記録。
- [ ] 最小の描画変更を実装、個別test GREEN。全ゲーム保護testを保持。
- [ ] 3組以上の同条件前後実時間比較、1500/2600/3000/4000の30球・画像・memory・input・flash。効果未立証は未立証と記録。
- [ ] 型/unit/Chromium/WebKit/root/Pages/release、敵対検証・独立レビューを実施しStage1改訂commit。

## Task 3: 自動画質を再評価・最終記録

Files: 既存adaptiveQuality/quality/createView/createApp/preferences/screens（必要な修正のみ）、仕様/性能/入力/安全性/レビュー報告。

- [ ] 整理後の標準/低/autoを同条件比較。不要な自動切替/負荷増があれば採用を再判断する。
- [ ] v1互換/opt-in/上下限/3s評価/2bad/20s安定/10s間隔、60/120Hz・held pointer等の既存必須caseを再実行。
- [ ] 従来の変更していない16条件suiteとスマホ相当の画面で実時間測定。物理iPhoneは未確認。
- [ ] 全原log/途中失敗/旧仕様中断/画像を圧縮・分割・hash検証し、既存と同一の証拠を再利用。
- [ ] fresh whole-branchレビュー、最終CIの実checkout SHAを固定。Draft本文に維持/変更/削除と結果/未解決を明記、マージ/公開しない。

## 旧仕様の証拠

95cbの71本予定は30本完了時に停止。完了した15本の正式3組比較と15本のprofile診断はそのまま保存し、新しい簡略化版の結果へ流用しない。次のnative/flash/phone/旧16suiteは未起動のまま停止した。retained-effects-interruption.jsonに日時と全labelを記録する。prefix upload候補の12回と撤回、旧136組/340scene、CIの成功/失敗も履歴として保持する。

## 採用判定の変更

Ruling: 9a9b71fの自動画質は不採用。profile:falseの3組/phone2条件で同期resize経路の長い待ちが再現し、最大423.1msの次RAFは433.2msだった。最新追加指示の「仕組み自体が新たな負荷を生む場合は無理に導入しない」を適用する。統計処理そのものが重いことやiPhoneで同じ待ちが出ることは立証していない。標準/低負荷とゲーム/input/audio/rankingの元実装へ戻し、4つの描画整理fileを採用する。候補75実時間測定・全CI・source/test hashを残し、auto専用の未実施追加撮影は成功に数えない。最終manual版を新SHAで全検証する。判断が過度に保守的なら、実機で安全に切り替わる可能性がある自動機能の提供が遅れる。
