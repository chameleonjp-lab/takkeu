# 描画整理と自動画質の採用判断

最新の追加仕様に従い、装飾を整理して30球のゲーム性・白球・操作を優先した。自動画質は試作を実測し、切替時の待ちを理由に不採用とした。最終sourceは`b0b6760610c17dc5a1f19efebf42049a31df1150`。

- [最終結果・性能比較・正式テスト](final-results.md)
- [性能JSON（55実行と履歴profile参照）](performance-summary.json) / [standalone・profile参照CSV](performance.csv) / [43条件の診断CSV](effect-decisions.csv) / [source保護ハッシュ](source-protection.json)
- [43条件ごとの維持・軽量化・統合・削除](effects-decisions.md)
- [Stage1調査](stage1-investigation.md) / [描画整理](revised-effects.md)
- [Stage2不採用理由](stage2-rejection.md) / [試作仕様](auto-quality-spec.md)
- [画像・ボール視認性・入力・メモリ](visibility-input.md)
- [点滅の一次検査と残る警告](safety.md)
- [敵対的検証](adversarial.md) / [独立レビュー](review.md)
- [証拠の保存・復元](evidence-method.md) / [未解決事項](unresolved.md)

同じ解像度の反復比較で改善を確認したが、Linux絶対性能目標は未達。物理iPhone Safariの快適性・正式な光安全適合は未確認。Draft PRを維持し、マージ・本番公開はしていない。
