# タッケウ15言語対応 実装計画

## 仕様と制約
ユーザー依頼の全15言語を初回PRに含める。日本語を原文キーとして静的辞書を管理し、物理・入力・音声条件・保存済み記録・通信契約・DB・canonical/OGPを保つ。言語専用キーは `takkeu.language.v1`。言語変更はDOMの文言・属性と画像の世代だけを更新する。canvas・ゲーム・通信を再生成しない。サイノメmainのlanguage-options/i18n/translations/localesおよびmultilingual/translation-catalogsテストを参考にする。

## Stage A: 翻訳基盤
- [ ] 15言語IDと地域判定、保存失敗を含む自動選択のテストを先に追加。
- [ ] `src/i18n/{languages,i18n,translations}.ts` と15辞書を実装。
- [ ] `t(source, parameters?, language?)`, `getLanguage()`, `setLanguage(language)`, `onLanguageChange(listener)` を共通接口にする。購読解除関数を返す。初期言語はアプリ生成時に設定し、単体モジュールの既定は日本語。
- [ ] プレースホルダー一致・全キー・非空・44コメント・重要数値の検査。

## Stage B: 画面・賞状・共有
- [ ] screensは静的DOMを一度構築し、表示状態を保持して文言だけ再適用。ホーム・設定に言語選択。動的状態の再表示からネットワーク呼出しはしない。
- [ ] loading/progress/rallyNotice/createAppのエラー、進捗、通知を対応。翻訳は表示値変更時のみ。
- [ ] 44コメント条件不変。ランキング・殿堂の名前は無変換で安全なtextContentとbdi/dir=auto。
- [ ] certificateは900×1200 PNG、言語を世代キーに含め古い非同期結果を破棄。Unicodeフォント代替・折返しを検証。
- [ ] X共有は正規URL・正式番号のみ・短い翻訳本文。URLSearchParamsで符号化。
- [ ] `docs/i18n/text-inventory.md` と仕様・コメント表を記録。

## Stage C: 総合検証と公開準備
- [ ] 既存単体・ブラウザ・性能・配布物・正式公開ゲートの検査を条件維持で実行。
- [ ] 15言語の主要画面をChromium/WebKitで検証し、長文・異なる文字体系を撮影。iPhone実機と区別。
- [ ] 独立レビューで文字漏れ・二重送信・不正HTML・画像世代・WebGL/イベント/負荷を確認し、問題を修正。
- [ ] 正式Draft PR番号発行後、公開対象のPR/ブランチ/識別子だけを更新して安全機構を維持。
- [ ] 検証結果・SHA・制約を記録。未完了があればDraftを維持。main push/merge/本番公開はしない。

## 注目する異常条件
保存API例外、通信中の切替、PNG処理中の切替・画面離脱、混在文字体系の名前、短い横画面と拡大文字。各担当のテストで実際の表示と状態同一性を確認する。

## 進捗
2026-10-30: main `84b9122713b280255d762978c4bf9906f8b1987b` から専用の新規cloneで作業開始。履歴の大容量検証画像はsparse cloneで省略。設計・実行は詳細な依頼に基づき追加承認を要求せず進行。
