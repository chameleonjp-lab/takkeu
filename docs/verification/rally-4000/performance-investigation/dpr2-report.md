# DPR2補足：実音源を確認した短期診断

先のquality-diagnostics/standard-DPR2はwarmup後に音声生成0だったため、そのまま通常音声の対照結果とはしなかった。元記録を残し、test専用の追加audio unlockを前後とも同じ条件で実行した。`audible:true`はこの追加unlockを意味する。通常の`audible:false`はmuteではない。

4本は1280×720/DPR2、4000/30球、同じfull/profile:true、warmup3秒+12秒。実時間性能の最終60秒比較とは別の診断であり、この1組だけを改善率の正式値へ加えない。

| 条件 | 描画buffer | p95 ms | GPU算術中央値 ms | valid queries | native音源生成 | running30 |
|---|---|---:|---:|---:|---:|---|
| standard-before | 1885×1060 | 333.2 | 143.940 | 78 | 1755 | True |
| standard-candidate | 1885×1060 | 316.7 | 158.272 | 73 | 1660 | True |
| low-candidate | 960×540 | 149.9 | 61.682 | 176 | 2655 | True |
| low-before | 1280×720 | 199.9 | 87.413 | 129 | 2384 | True |

全4本で実音源・有効query・安定sourceを確認。残query/無効値は元データに保持し、欠測を0msとしない。標準の描画サイズ・製品分岐は同じで、before/candidate間のばらつきを改善とは報告しない。低のサイズ削減はDPR1/2とも働く。これはLinuxのソフトウェアrendererの結果であり、iPhone Safariの代替測定ではない。
