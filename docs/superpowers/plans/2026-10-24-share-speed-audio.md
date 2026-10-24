# 共有・残球速度・多層効果音 Implementation Plan

> この統合計画の残球倍率は当時の履歴。現在は[残球速度の現行設計](../specs/2026-10-24-remaining-ball-design.md)に従い、500ラリー以上・1球だけ1.1倍。それ以外は追加等倍。

> **For agentic workers:** Use superpowers:executing-plans. User supplied the complete specification and authorized implementation through one Draft PR; execute inline, then obtain a fresh branch review.

**Goal:** ホーム／結果のX共有、新残球倍率、球別に正確で上限のある多層効果音を既存機能へ統合する。
**Architecture:** 既存の共有URL設定とリンク、打球時の倍率確定、GameEventとvoice管理を拡張する。音源はWeb Audioで生成し、context単位のキャッシュとvoice単位の後始末を分離する。
**Tech Stack:** TypeScript, Vite, Vitest, Playwright Chromium/WebKit, Web Audio.
**Spec:** 2026-10-24のユーザー依頼（本セッション）。確定要件を以下と検証記録へ転記する。

## Global Constraints

- base: `27ebee8fb5fa0d29f7f82e15244dd1fbd1a88de1`。remote `https://github.com/chameleonjp-lab/takkeu.git`。open PRなし。新規clone、作業ツリーclean、既存branchの変更なし。
- Draft PR一件まで。merge・auto merge・手動公開・実際のX投稿・本番ランキング送信・DB/認証/課金変更は禁止。
- 正式URL・静的1200×630 PNGを再利用。結果は今回の確定値、ホームは自己ベスト。共有値は有限非負整数。
- 0–99は1倍。100以上は残球1/2/3/4/5以上に1.4/1.3/1.2/1.1/1倍。失球以外の全phaseを数え、実際の相手打球で固定。
- 通常加速・スマッシュ・残球倍率を分離。入力、予告、到着間隔、隠す球、555以後の軌道は保持。
- 自分の接触イベントに球ID、接触前のsmash、加点後のscoreを値として渡す。音声は警告から推測しない。
- 音響段階は累計score、半音0/2/4/7/9/12/14/16で上限16。5/10から装飾を追加、10以後の音源数一定。
- 初期音量0.65と保存済み設定を保持。voice上限8、最大音源数を記録。mute/0は無音、失敗時は保守的な代替か無音。
- ランキングは既存browserTest fixtureで外部通信を遮断。描画・固定計算・遅延停止の閾値は緩めない。

## Review Focus

- 非有限・負値・小数の共有値、結果と自己ベストの混同。
- 同tickの100到達・増球・失球・打球と待機再予約。
- 多球の警告と別球の返球、同球の次往復のsmash漏れ。
- start/接続/param/resume途中失敗、古いunlockと完了通知の競合。
- 多voiceとフェード尾・遅延装飾の重なり、音量0、context再生成。

### A: 共有と静的カード

Files: `src/ranking/config.ts`, `src/ui/screens.ts`, `index.html`, 関連unit/browser/release検査。
- [ ] 共有文・無効値・結果0／ホームbest有無のREDテストを作り実行。
- [ ] `scoreShareUrl(score): string | null`と`homeShareUrl(bestScore): string`へ集約。既存リンクを更新、ホームfooterへ通常リンクを追加。結果はgameoverのみ更新。
- [ ] 既存PNGを実見して再利用可否を判断。HTMLのdescription/altを整合し初期HTMLと配布パスを検査。
- [ ] リンク遷移要求、キーボード、縦横／文字拡大、retry/home、ランキング失敗を検査してcommit。

### B: 残球速度

Files: `src/game/difficulty.ts`, existing remaining-ball unit/browser fixtures, 現行文書。
- [ ] 99/100/101 × 1/2/3/4/5/8、新旧対応・不正値のRED検査。基準Dは5球以上とする。
- [ ] 新倍率へ置換し、既存シミュレーションを通したD/倍率、固定・再評価・通常加速・outgoing非適用を確認。
- [ ] 5→4・4→3・2→1・1→増球、同時刻順、予告・間隔・高速接触・30/60/120Hzを検査してcommit。

### C: 多層音響

Files: `src/audio/tones.ts`, `src/audio/audio.ts`, `src/game/{types,simulation}.ts`, 関連fixtures/tests。
- [ ] 球別smash/score、段階、通常経路／fallback、部分失敗と後始末のRED検査。
- [ ] 多層tone builderとcontextキャッシュを実装。kick・中域・ノイズ・WaveShaper・高速arp・成功／警告を区別。最大10音源以下、低負荷／上限時の装飾縮減。
- [ ] 全source完了を数え一度だけ通知、fade置換と即時silenceを分離。master graphの例外／contextライフサイクルを処理。
- [ ] scoreはイベントの確定値から取得、古い／重複イベントは破棄、mute/0/復旧で過去音を再生しない。
- [ ] OfflineAudioContextの44.1/48kHz波形・peak/RMS/終端無音、実Web Audio資源、比較WAV（元音量とRMS整合）を保存してcommit。

### 統合・提出

- [ ] 型・全unit・Chromium/WebKit・実時間performance・verify:releaseを実在scriptsで実行。失敗・trace・再検査と対象SHAを保存。
- [ ] baseとheadで450/555実時間を同条件比較。生のframe間隔／実経過／simTime／pause／voice・source数を分離。
- [ ] 最終diffの独立レビュー、重要指摘は修正＋再検査。
- [ ] 文書・画像・音声・ログを追加し、一つのDraft PRを作成。base/head完全SHA・CI状態・未確認と公開後手順を記載。
