# 0–4000ラリー演出拡張：検証結果と未解決事項

Draft PR: [#27](https://github.com/chameleonjp-lab/takkeu/pull/27)（main向け・性能P1未解消・マージ/公開なし）。

**総合受入は未達。Linux性能targetはbaseline・initial・finalの各16条件すべて未達で、4000の遅延悪化はP1 FAILED（未解決）。GPU診断は96/96 queryを取得し完了。性能悪化の完全な因果帰属は未立証。** CI成功、draw call削減、画素一致を遅延改善へ読み替えない。Draft PR用の記録で、マージ・公開・DB変更は行わない。

canonical Cは[`d30aa196f2faccd88fab36de4b94bb585c21b464`](https://github.com/chameleonjp-lab/takkeu/commit/d30aa196f2faccd88fab36de4b94bb585c21b464)、production tree `47bd0f370ad169de00c77b37bb74429b63020d44`、tests tree `097b10b95f55aded9d77af6dd4ed6b85925b9684`。4つのflat/unlit materialへのsingle-pass最適化は`72c1920…`で導入し、Cのruntime/source/tests/configを固定した。

ゲーム世界は台の電流から流星・暗い宇宙・多重輪へ発展し、4000の収束→形成→拡大→fade後もプレイが続く。中核は**38=ラリー23+落球13+best/通知2**、音声は別枠5。実装・自動検証・AI取得画像観察の成功と、人間の視認/試聴、規範的SC、物理端末の確認を区別する。

## 判定の入口

| 項目 | 証拠・実測 | 判定 |
| --- | --- | --- |
| 視覚38 | [全条件matrix](coverage.md)、両engineの画像、best/no-repeat/2600追加2件 | 成功（実装・自動・AI画像の範囲）。全連続区間/全30球経路、人間/実機は未確認 |
| Canonical CI4 | [正式記録](ci/40241944794/README.md)、[proof-counts](ci/40241944794/proof-counts.json)：958unit/71files+194browser+8release=1160、全6job成功 | Cの正式成功。Playwright skip/flaky/retry/unexpected/top-level errors0。Vitestは958/958・失敗/skip0、別個flaky/retry fieldは未報告 |
| ローカルA/B | [832比較とfresh16](diagnostics/single-pass/summary.json)：全RGB差0 | 有限scene証拠。初回Chromium6成功+WebKit再試行6成功で、clean12runではない |
| 音声5 | [140matrix+終了対照4=144native renders](audio-report.md) | **未確認（人間試聴を含む音声総合）**。波形/graph/cleanupは自動確認 |
| 最終光14scene | [5040frame](safety/final-primary-index.json)：全area<21824、原guard9通過/5aux警告保持 | **規範的WCAG/SC適合は未確認**。固定field追加count2/2/2/2/1、原閾値/flags不変 |
| 最終性能 | [FULL16](after-single-pass/chromium/summary.json)：16/16実行成功・全30球・pause/error0、target0/16 | **未達・P1 FAILED（未解決）**。latency改善は未立証。GPU診断96query/non-disjoint確認、完全な因果帰属は未立証 |
| 保護 | [28厳格保護とevent-only例外](protected-integrity.json) | 時点照合。最終archive Dのbyte/mode比較は別途記録する |
| 人間/物理端末 | 自動結果からは代替しない | 実視聴、iPhone/Safari/Android、VoiceOver、HDR、実機入力/発熱は未確認 |

## コード・条件・レビュー

- [全38+音声5matrix](coverage.md)、[全43行を含むPR本文](pr-body.md)、[変更ファイル](../../rally-4000/changed-files.md)、[artifact upload計画](artifact-upload-plan.md)。
- [設計](../../superpowers/specs/2026-10-25-rally-4000-design.md) / [計画](../../superpowers/plans/2026-10-25-rally-4000.md) / [進捗](progress.md)。
- [状態](../../../src/game/rallyEffects.ts)、[描画・共有priority](../../../src/render/rallyEffects.ts)、[通知](../../../src/ui/rallyNotice.ts)、[app](../../../src/app/createApp.ts)、[終了clock](../../../src/app/finishPresentation.ts)、[音声](../../../src/audio/audio.ts) / [音源](../../../src/audio/tones.ts)。
- [状態報告](state-report.md)、[描画報告](renderer-report.md)、[音声報告](audio-report.md)、[browser報告](browser-evidence-report.md)。独立レビュー：[stage1](stage1-review.md)、[stage2](stage2-review.md)、[全体/実画像/安全性](adversarial-review.md)。
- [実物理0→4001 test](../../../tests/unit/rally-through-play.test.ts) / [Cからの最終数値export](through-play.json)と[physical-final-unit.json](logs/physical-final-unit.json)は1/1成功、対照runとのevents/snapshot/RNG比較。旧exportは[physical/](physical/through-play-before-final-export.json)に保持。任意scoreの[画像fixture](../../../tests/helpers/rallyHarness.ts)とは別である。

## Single-passの画素一致と試行履歴

広域A/BはChromium416+WebKit416=**832比較すべてRGB差0**。既存6case/engineを使い、初回Chromium6成功とWebKit再試行6成功で全12組合せを確認した。初回WebKitは240秒のcapture timeout1件、次caseの明示interrupt1件、未実行4件を保存（reportのskipped5はinterruptを含む）。再試行はopt-in A/Bのcapture予算だけ4倍の960秒。pixel assertion、通常194browserの予算、性能/安全性閾値は変えていない。

[初回失敗report](logs/single-pass-browser-initial-budget.json)、[WebKit再試行](logs/single-pass-browser-pixels.json)、[方法](diagnostics/single-pass/README.md)、[fresh-default16結果](diagnostics/single-pass/fresh-default/results.json)。fresh bridge16case/32pixel relationsも全差0で、production default/null-before-restoreの最初の新material描画を確認した。cached side-program macroが未使用の現unlit材質でcache再利用だけへ依存しない補助確認。元5040frameの安全性再取得、認定解析、人間/端末確認を意味しない。

## 性能：3way全16条件、目標未達と悪化を保持

[performance-report.md](performance-report.md)、[baseline→initial](performance-comparison.json)、[baseline→final](performance-comparison-single-pass.json)、[initial→final](performance-optimization-comparison.json)。before17回（16+clean control）、initial16回、final16回の測定実行は成功したが、canonical targetは全matrix **0/16**。全canonical行は30球、running、pause/errorなし。初回負荷重複runも保持し、guard/step budgetを緩めず自動resumeしない。

| 範囲 | baseline | initial028 | final C |
| --- | ---: | ---: | ---: |
| running p95 ms | 233.3–633.3 | 249.9–300.0 | 266.7–433.3 |
| <=25ms比率 | 5.88–15.70% | 12.19–16.13% | 11.08–17.23% |
| sim秒/60秒 | 21.25–44.99 | 34.45–42.57 | 30.32–39.22 |
| 目標達成 | 0/16 | 0/16 | 0/16 |
| 最大draw calls | 36 | 44 | 40 |
| 最大geometries / textures / programs | 53/4/16 | 57/4/16 | 57/4/17 |
| 報告active particle count | 1440 | 1688 | 1688 |
| browser JS heap MB | 21.7–31.2 | 23.1–35.1 | 23.1–33.1 |

4000のp95中央値は標準**258.25→291.65→300.00ms（finalはbaseline+16.17%）**、低**275.00→291.70→316.70ms（+15.16%）**。4draw減少は実証したが、この実loopではlatencyが改善したとは言えない。遅延GPU queryは全96件取得/disjoint0で完了。一貫したsingle-pass GPU改善はなく、約100msの残存scene graphics floorを確認した。約300msの実loop p95との差全体や4CPU quotaへの因果帰属は未立証。**性能P1: FAILED（要件未達）**。

| 画質 | score | 回 | baseline p95 | initial p95 | final p95 | final <=25ms | final sim秒/60秒 | 目標 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| standard | 1500 | 1 | 233.30 | 249.90 | 333.40 | 11.08% | 33.79 | 未達 |
| standard | 1500 | 2 | 450.00 | 249.90 | 283.40 | 14.02% | 36.90 | 未達 |
| standard | 2000 | 1 | 266.70 | 266.60 | 266.70 | 11.19% | 38.42 | 未達 |
| standard | 2000 | 2 | 633.30 | 250.00 | 433.30 | 15.30% | 30.32 | 未達 |
| standard | 3000 | 1 | 599.90 | 283.20 | 300.00 | 14.39% | 36.01 | 未達 |
| standard | 3000 | 2 | 366.60 | 266.70 | 400.00 | 12.50% | 31.10 | 未達 |
| standard | 4000 | 1 | 266.60 | 300.00 | 316.70 | 11.72% | 33.31 | 未達 |
| standard | 4000 | 2 | 249.90 | 283.30 | 283.30 | 12.74% | 35.83 | 未達 |
| low | 1500 | 1 | 316.60 | 266.70 | 266.70 | 15.14% | 39.22 | 未達 |
| low | 1500 | 2 | 333.30 | 250.00 | 350.00 | 14.49% | 34.78 | 未達 |
| low | 2000 | 1 | 266.60 | 283.30 | 350.00 | 12.37% | 32.01 | 未達 |
| low | 2000 | 2 | 266.70 | 266.70 | 283.40 | 17.23% | 36.92 | 未達 |
| low | 3000 | 1 | 250.10 | 283.30 | 283.30 | 13.74% | 37.89 | 未達 |
| low | 3000 | 2 | 300.00 | 283.30 | 350.00 | 13.51% | 32.68 | 未達 |
| low | 4000 | 1 | 266.70 | 300.00 | 316.70 | 12.34% | 33.86 | 未達 |
| low | 4000 | 2 | 283.30 | 283.40 | 316.70 | 14.90% | 32.94 | 未達 |

容量の単位を分離する：既存**1536 point-particle slots**、新演出**10240 quad slots**、新position/RGBA固定buffer **1,720,320 bytes**。raw `particleCapacity=11776`は異単位を加えた歴史的診断値で、物理particle容量ではない。元JSONは変えずこの注記を付ける。finalは最大3188active rally quads/535584bytesのactive attribute range、248rally particle countと1440legacy point particles。heap標本は粗く、leak/VRAM/物理端末メモリの判定ではない。

原データ：[baseline](baseline/chromium/summary.json) / [clean control](baseline/chromium-clean-repeat1/summary.json) / [initial](after/chromium/summary.json) / [final](after-single-pass/chromium/summary.json) / [resource detail](after-single-pass/resource-detail.json)。[方法](performance-method.md)。

## GPU診断と原性能artifactの検証

[GPU query報告](diagnostics/gpu-query-report.md)は全96/96 available、disjoint0。遅延削除/RAF待ちのprobeで取得した値で、初回query未取得のprobeとは別実験として両方保持する。

| Quality/state | 通常2pass GPU ms | single-pass GPU ms | 新roots非表示 GPU ms | 新roots zero-scissor GPU ms |
| --- | ---: | ---: | ---: | ---: |
| standard peak | 114.01 | 113.45 | 100.56 | 104.63 |
| standard middle | 116.67 | 115.63 | 112.83 | 131.10 |
| low peak（不安定） | 140.08 | 192.49 | 180.65 | 211.62 |
| low middle | 111.10 | 113.43 | 105.45 | 109.16 |

新rootsを隠した約100msのfloorはcanonical Cの残存sceneで、歴史的PR26そのものではない。描画費用は相応にあるが、single-passのGPU改善は一貫しない。hide/zero-scissorはupload/submissionやdriver最適化も変わり、純fragment/vertex費用の分離ではない。low peakは同一normal block間でも不安定。containerの4CPU quotaは記録したが、probe中throttle差分/因果実験がなく、悪化の説明としては**未立証**。全frame差や約33msをGPU/CPU quotaへ断定しない。

[performance-artifact-verification.json](logs/performance-artifact-verification.json)は**49正式raw measurement+4full reporter**のbyte/hash検証を記録し、全16条件のC/harness固定・30球・target失敗理由は[condition-verdicts.json](after-single-pass/condition-verdicts.json)に保持。これは報告済み検証記録への参照であり、この文書作成で巨大hashを再実行したものではない。追加のproduction変更は行わない。

## 光：原失敗・14scene・残る規範判定

[safety/final-primary-index.json](safety/final-primary-index.json)は14scene×360frame=5040frame、60Hz6秒/scene、同一表示source・取得中stable・外部通信0を記録する。全general/red高頻度area<**21824**、原guardは**9通過/5aux警告**を保持。警告5scene（1500標準/低、3000低、4000標準/低）の固定field追加countは**2/2/2/2/1**。groupingや閾値変更はなく、追加countを単独のSC適合証明にしない。

修正前標準22回/82788画素、低23回/82515、修正1=31808、修正2=24817、修正3=21975は全て失敗として保持。V4最悪標準10822/低8816で原guard閾値超過なし。全14sceneの原数値はindexを参照。[原因](flash-fix.md) / [独立調査](adversarial-review.md) / [方法とlossless復元](safety/README.md)。source/copy SHA、全解析、RGB復号一致、canonical partsとmanifestを保存する。SDR canvasの有限screenで、PEAT/Harding認定、CSS外側/HDR/眼球運動/実機表示を包括しない。**規範的WCAG/SC適合、人間/実機は未確認。**

| Scene | general最大回数 | general高頻度area | red高頻度area | 原global closing/秒 | 原guard | 固定field追加count |
| --- | ---: | ---: | ---: | ---: | --- | ---: |
| 4000-standard-legacy100 | 9 | 10,822 | 0 | 1 | 閾値超過なし | — |
| 4000-low-legacy100 | 8 | 8,816 | 0 | 1 | 閾値超過なし | — |
| 4000-low-legacy-fireworks | 15 | 10,307 | 0 | 3 | 閾値超過なし | — |
| 4000-standard-legacy-fireworks | 12 | 9,483 | 0 | 3 | 閾値超過なし | — |
| 1500-low | 14 | 7,616 | 0 | 4 | 警告を保持 | 2 |
| 1500-standard | 12 | 9,207 | 0 | 7 | 警告を保持 | 2 |
| 2000-low | 13 | 12,742 | 0 | 3 | 閾値超過なし | — |
| 2000-standard | 15 | 10,267 | 0 | 3 | 閾値超過なし | — |
| 3000-low | 13 | 6,925 | 0 | 4 | 警告を保持 | 2 |
| 3000-standard | 13 | 9,175 | 0 | 3 | 閾値超過なし | — |
| 4000-low | 14 | 8,567 | 0 | 5 | 警告を保持 | 1 |
| 4000-low-reduced | 1 | 0 | 0 | 0 | 閾値超過なし | — |
| 4000-standard | 12 | 6,293 | 0 | 5 | 警告を保持 | 2 |
| 4000-standard-reduced | 1 | 0 | 0 | 0 | 閾値超過なし | — |

## Canonical CI4の全記録と最終archive D

[40241944794](https://github.com/chameleonjp-lab/takkeu/actions/runs/40241944794)はexact Cで全6job成功。[README](ci/40241944794/README.md) / [proof-counts](ci/40241944794/proof-counts.json) / [summary](ci/40241944794/summary.json) / [全case](ci/40241944794/test-results-summary.json)。958unit/71files、各engine94interaction+3load=194、release8=**1160実行**。Playwright skip/flaky/retry/unexpected/top-level errors0。unitは958/958/71files成功・失敗/skip0で、個別flaky/retry JSON fieldは未報告。

全6log、72workflow members、5ZIP/1034artifact membersを全保存。69記録files約270.60MB、parts最大32MiB、元ZIP/part/member SHAと復元/展開照合は正式manifestに記録済み。ここで再hashしたという意味ではない。[旧CI3](ci/40235973827/README.md) / [旧CI2](ci/40234298364/README.md) / [初期失敗](ci/40232449369/diagnosis.md)も残す。

本記録を格納する最終archive-only commitには`[skip ci]`を付け、そのCIを**意図的にskip（成功ではない）**として扱う。正式な成功はcanonical CのCI4として識別し、最新docs HEADへ成功と偽って付け替えない。

[archive-provenance.json](archive-provenance.json) / [正式log](logs/archive-provenance.log)は**239 execution inputs一致**を確認済み。canonical/head manifest SHA256はともに`595a0c039b59140997d66a565f8054d506f82c72b9d8e436bed39caeeba93f98`。対象は全tracked non-docと2つのintegrity checkerで、mode/blob/working bytesを比較した。文書archive前と最初の記録コミット後の一致を確認済み。最終の記録追加後にも、同じcheckerをread-onlyで実行する。自己参照を避け、最終archive commitのSHAはこの文書へ埋めず、PR metadata/最終返信で記録する。性能P1 FAILED、音声総合/規範的SC/物理端末の未確認は維持する。

再確認コマンド:

```sh
python docs/rally-4000/verify-archive-provenance.py d30aa196f2faccd88fab36de4b94bb585c21b464
```
