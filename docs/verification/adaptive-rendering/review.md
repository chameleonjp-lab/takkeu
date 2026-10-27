# 独立レビュー

最終source `b0b6760610c17dc5a1f19efebf42049a31df1150` を、新しい文脈の独立reviewerがコード・raw測定・画像・入力・資源・CI・点滅rowから確認した。[全文](source-review.md)。これはアーカイブ入力を固定する前の最終コード/証拠レビューであり、復元検証の追補は[archive-review](archive-review.md)に分けて保存する。

アーカイブ追補も完了した。独立reviewerが434partと結合archive SHA、復元した全18,818payload/6,644,483,018bytes、正確なfile集合、61provider receiptを照合し、復元gateを閉じた。リモート公開の完了は、このローカル復元監査とは別にGit転送とDraft headの受領確認で判断する。

- 製品差分は4renderのみ、game/input/audio等56sourceは開始時6ecと一致。新たなCritical不具合なし。
- 全55実時間測定を再集計。最終source44/44継続、絶対目標0/55、4000の各3有効pairの相対改善を確認。快適性や全条件の改善とはしない。
- 画像144枚/実物理3000枚、入力116点、20retry/5recreate、61CI artifact receipt/78full log/14tree証明を確認。
- canonical36全rowを再計算、警告9→1。補足4sequenceは取り直し後の720対・7200キーが厳密一致し、両modeの警告が残る。解析器は6ecとbyte一致。
- 失敗撮影/起動失敗/古いCI失敗と補正理由を保持。過去RGB差の未分離原因や局所指標の増加を隠していない。

残すImportant事項は、性能目標未達、最終の一次点滅警告（canonical1条件/実物理補足2条件）、原7警告の無条件解決未立証、別PR28で進んだmain532との統合未検証。軽微事項として旧測定CLIの版guardは未実装で、[対応するrunnerと版を明記](unresolved.md)した。実機iPhone/HDR/人間の評価/正式適合はレビュー対象として判定できない。

公開前の追加確認ではmainがさらに628439fへ進み、PRはmergeable=false/null merge SHAを報告した。追補は[応答元](publication-before-remote-update.json)を引用し、最新mainとの統合を合格としていない。アーカイブの検証成功はマージ可能性や公開許可を意味しない。

Stage1は独立レビューが容量欠落F01を発見し、最後の4edge予約をtableへ修正、専用検査RED→GREENを確認した。Stage2はraw10切替の長い待ちを再計算し、auto不採用を支持した。原文はアーカイブの`revised-stage1-code-review.md`/`stage2-adaptive-adoption-review.md`に保存する。

**マージ可の判定ではない。Draft継続、マージ・公開の許可なし。**
