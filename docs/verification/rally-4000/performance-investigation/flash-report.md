# 点滅再検証：一次警告7件を保持

変更後18scene×360frame、追加の変更前390/1000両画質4scene×360frame、計7920frame。60Hz/6秒、1024×768へ既存方式でcanvasを読み出し、同じ一次解析器・閾値を使用した。これは内容clockの合成stress場面であり、実時間性能や実機の明滅ではない。CSS HUD/モニタ/HDR/視距離/眼球運動は対象外。

[全capture/解析/生画素への索引](flash/index.json)、[前後の数値](flash/before-after-primary.json)、[実行同一性](flash-run-provenance-summary.json)。新コードはb697a98、追加baselineは059bcba8。既存14sceneの標準7sceneは旧保存sequenceと全RGB pixel hashが同じなので、巨大動画は重複せず同一画素の保存先を参照する。今回のcapture metadata/全解析rowは別々に残す。これは画素同一性の参照であって、旧性能値の流用ではない。

| 場面 | 前maxGeneralHighFrequencyArea | 後 | 変化率 | 一次警告 前→後 | RGB全frame一致 |
|---|---:|---:|---:|---|---|
| 1500-low | 7616 | 7899 | +3.72% | True→True | False |
| 1500-standard | 9207 | 9207 | +0.00% | True→True | True |
| 2000-low | 12742 | 9587 | -24.76% | False→False | False |
| 2000-standard | 10267 | 10267 | +0.00% | False→False | True |
| 3000-low | 6925 | 6824 | -1.46% | True→True | False |
| 3000-standard | 9175 | 9175 | +0.00% | False→False | True |
| 4000-low | 8567 | 8769 | +2.36% | True→True | False |
| 4000-low-reduced | 0 | 0 | — | False→False | False |
| 4000-standard | 6293 | 6293 | +0.00% | True→True | True |
| 4000-standard-reduced | 0 | 0 | — | False→False | True |
| 4000-standard-legacy100 | 10822 | 10822 | +0.00% | False→False | True |
| 4000-low-legacy100 | 8816 | 6985 | -20.77% | False→False | False |
| 4000-low-legacy-fireworks | 10307 | 10410 | +1.00% | False→False | False |
| 4000-standard-legacy-fireworks | 9483 | 9483 | +0.00% | False→False | True |
| 1000-low | 6293 | 6432 | +2.21% | True→True | False |
| 1000-standard | 10267 | 10267 | +0.00% | True→True | True |
| 390-low | 6594 | 6890 | +4.49% | False→False | False |
| 390-standard | 6594 | 6594 | +0.00% | False→False | True |

この面積指標は解析器の一般高頻度pixel閃光面積の最大値であり、発作リスクや総発光エネルギーの変化率ではない。全sceneで一般/赤の高頻度面積は21824未満。しかし一次解析の保守的global closing-frame警告は7件残る。新1000両画質の警告もbeforeで再現する。元の5警告を解決済みへ変更していない。

追加固定field診断は同じ位置の341×256窓を全位置で調べ、61sampleの包含1秒窓で一般countは以下、赤はすべて0だった。診断が<=3でも一次警告は解除しない。

| 対象 | 場面 | 固定field最大count |
|---|---|---:|
| fixed-fields-current | fixed-field-1000-low | 2 |
| fixed-fields-current | fixed-field-1000-standard | 3 |
| fixed-fields-current | fixed-field-1500-low | 2 |
| fixed-fields-current | fixed-field-1500-standard | 2 |
| fixed-fields-current | fixed-field-3000-low | 2 |
| fixed-fields-current | fixed-field-4000-low | 1 |
| fixed-fields-current | fixed-field-4000-standard | 2 |
| fixed-fields-before | fixed-field-1000-low | 2 |
| fixed-fields-before | fixed-field-1000-standard | 3 |

解析器の既存自己検証も再実行した。全原log、360行の一次row、固定field詳細と失敗扱いのflagを保存する。PNGは既存のlosslessRGB方式で復号一致を検証して圧縮するか、全RGBが同じ既存archiveへのhash参照を使う。正式WCAG適合、人間の視認、iPhone/HDRの安全性は未確認。
