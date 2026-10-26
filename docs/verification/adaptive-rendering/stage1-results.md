# Stage 1 結果 — 実ゲーム改善未立証、候補を撤回

開始時A=`6ec38720b4f720c71bf48c5aef3cdc5732fdd578`、candidate=`1cab814dcaf071ef814460121303f13260f58706`（別worktree）。製品候補はlegacy celebrationとfireworkの属性を使用prefixだけ転送する2file。描画式/色/順序/寿命/イベントとゲーム計算は変更なし。2unitをRED→GREEN、candidate961unit/型成功、全protected src bytes一致を独立レビューで確認した。

## 正式な3組交互比較

各回実測60秒以上、起動準備後3s warmup、同じ初期4000/30球、実stepSimulation/autoplay/native音源あり。profile:false、collector:full、同一Chrome/SwiftShader/1280×720/DPR1/CPU4quota/cpuset0–4。A/B B/A A/Bと順序を反転し、標準/低を別集団とする。重いローカル検査を並行しない。初期の環境準備とunitを並行した探索2回は別フォルダに残し、正式3組へ混ぜない。

| 画質・3回の中央値 | A | candidate | 判定 |
|---|---:|---:|---|
| standard p50/p95/p99 ms |133.3 / 283.3 / 316.8|133.4 / 283.4 / 316.7|p95改善未立証|
| standard sim秒/実60秒 |37.213|37.562|安定した改善の立証なし|
| low p50/p95/p99 ms |100 / 199.9 / 216.7|100 / 199.9 / 216.7|改善未立証|
| low sim秒/実60秒 |50.841|50.810|改善未立証|
| standard/low終了JS heap中央値 |各27.6MB|各29.4MB|粗いperformance.memory。単一時点差からリークとは判定しない|

元12回の全interval/各frameのphase・score・球数・資源・audio/heap、全src SHA256、設定・runner SHA256を保存。全回30球/running/外部要求0/例外0。絶対目標25ms/95%/59秒は **12/12未達**。`simulationSecondsPer60`は実測window長で正規化する。最初の部分intervalを一律除外してnearest-rank集計、原値は削除しない。profile:falseのGPU/詳細CPUは欠測null、別の診断を長期性能の結果に混ぜない。

候補の初期測定ではHEADのcommit fieldがAのまま（未commit2file）だった。全回の実srcハッシュからcandidate1cab814との同一性を確認し、その写像を記録する。commit欄だけからAコードでBを測定したと推測しない。Stage2以後はcommitしてから測定する。

## 採用・不採用

| 候補 | 調査/実験 | 結論 |
|---|---|---|
| legacy/particle prefix upload |unit・GL転送・GPU診断・RGBA/geometry比較・12正式回|実ゲーム改善未立証のため製品から撤回。元patch/test/失敗・成功logを保存|
| 同時落球wave統合、4GPU batch、球InstancedMesh |既存実装を確認|実装済み。今回の改善へ加算しない|
| 星空hash cache、ring/電撃のshape共通化 |不変/独立stateと既存CPU調査を確認|全体効果未立証。未採用|
| culling |実際のribbon6頂点とcamera/resize/table shakeを含む診断|center-onlyやfrustumCulled=trueだけの変更を禁止。追加判定費用と正しい境界の実測利益を立証できず未採用|
| 透明層削減、shader統合 |現在のblend/depth/orderとoverdraw診断|色/奥行き/閃光/fill costの同等性・利益を裏付けず未採用|
| 古いイベント/prune追加 |寿命/上限/無event時参照/finish時計を調査|有限・既に描画除外。追加走査/GCの利益未立証、未変更|
| indexed geometry |既存正式資料/撤回を確認|以前の不採用を維持、再実装せず|

Stage1製品ソースはAと一致へ戻す。したがって正式比較対象B（Stage1完了版）はAと同じ製品tree。候補をBとして性能改善率を捏造しない。Stage1による実ゲーム改善率は「改善未立証」、採用最適化は0件。Stage2では解像度低下の効果を別に測定する。

詳細overdraw/転送/CPU/GPU/画面外比率/実画像/独立レビュー/CIは新しいevidence archiveと索引に保存する。点滅の一次警告7件、絶対性能未達、人間/実機未確認は継続。調査表は[stage1-investigation.md](stage1-investigation.md)。

## 描画診断の実値

Chromium/WebKit、402×874/DPR2と1280×720/DPR1、standard/low、17scene（8指定ラリー、1000/4000の別時刻、loss55/99/100、30球＋64firework事実の合成stress、期限後）の **136組**でRGBA全画素・snapshot・state・全active属性hash・resources一致。diagnostic mesh-overdraw histogramも対応sceneで一致。

1280standard4000 age.65: 502,572→459,564B/frame、draw36→36、GPU109.40→115.56ms（単一診断sample）。同時stress: 1,322,316→711,468B/frame（−46.20%）、draw44→44、GPU140.52→138.20ms。この診断単一sample差を改善率に用いない。CPUは概ねpresentation0.6–0.9ms/new effects0.5–0.9msの例があるが、timer精度やfixture余分更新を含み、正式loopとは異なる。

mesh透明fragmentの最大重複は例：phone4000で7、landscape同時stressで14（point sprite除外、MSAA edge近似）。phone4000のworld1500quad中94が完全clip外、landscape stress1564中387が完全clip外。線幅/揺れ込み実6頂点での診断であり、これをcenter cullへ置換しない。GPUは既にclipするため、数の減少だけで性能を予測しない。

全PNGはnative buffer縦横比を維持。実画像もAI確認済み。白球/ラケット/電撃の識別は有限sceneの範囲であり、人間の視認性や実機快適性を保証しない。独立担当が元データ/画像を別途検査する。
