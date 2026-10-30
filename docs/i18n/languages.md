# 対応言語

選択UIと辞書の基準は [src/i18n/languages.ts](../../src/i18n/languages.ts)。15言語を同時に提供し、選択肢は常にその言語の自称で表示する。`id` は辞書・保存値・`html.lang`、`locale` は数値・日付書式に使用する。

| ID | 選択肢の自称 | 書式locale |
| --- | --- | --- |
| `ja` | 日本語 | `ja-JP` |
| `en` | English | `en-US` |
| `es` | Español | `es-ES` |
| `pt-BR` | Português (Brasil) | `pt-BR` |
| `zh-Hans` | 简体中文 | `zh-CN` |
| `fr` | Français | `fr-FR` |
| `de` | Deutsch | `de-DE` |
| `ko` | 한국어 | `ko-KR` |
| `ru` | Русский | `ru-RU` |
| `it` | Italiano | `it-IT` |
| `zh-Hant` | 繁體中文 | `zh-TW` |
| `id` | Bahasa Indonesia | `id-ID` |
| `tr` | Türkçe | `tr-TR` |
| `vi` | Tiếng Việt | `vi-VN` |
| `th` | ไทย | `th-TH` |

## 辞書と補間

`src/i18n/locales/{id}.ts` に静的な訳文を置き、`translations.ts` で15辞書を読み込む。日本語の原文文字列をキーに使い、全言語の248キーを型と辞書検査で揃える。日本語・外国語の原文英語キャプションの関係は [text-inventory.md](text-inventory.md) に載せる。ブラウザ内で辞書を参照し、外部の翻訳APIは呼ばない。

表示側は `t(source, parameters?, language?)` を使用する。`{score}`、`{name}` 等の引数は語順に合わせて配置し、全言語で引数名と個数を一致させる。未指定の引数は `—` に置き換え、`{name}` のような未解決文字列を画面に出さない。未登録キーは原文を返す防御処理があるが、既知の表示対象は248キーに収録する。

`getLanguage()`、`setLanguage(id)`、`onLanguageChange(listener)` を共通入口にする。購読登録は解除関数を返す。無効なIDへの変更は無視する。同一言語の再指定では変更イベントを追加発火しない。起動時の判定と保存優先順位は [language-selection.md](language-selection.md)。

## 表示とデータ

ゲームスコア、判定、最大30球、3500クリア、100落球終了、20文字の名前上限、TOP 30、TOP 100、殿堂の正式番号と初回登録ルールは全言語で共通。翻訳は数値・ゲーム状態・保存済み記録を変更しない。

HUDのスコア・残球・落球、結果スコア、端末内自己ベスト、ランキング表の値は既存の数値文字列を使う。全体順位・登録名数・順位基準の自己ベストは選択localeで表示する。`formatNumber` を使う節目通知と賞状では日本語のカウンターに区切りを追加せず、他localeは `Intl.NumberFormat` を使う。賞状・殿堂の登録日は `Intl.DateTimeFormat` で選択localeの年月日表記にし、タイムゾーンはすべて `UTC`。

登録名・入力名を訳文に置き換えない。名前の表示はHTML解釈をせず、`textContent` と `bdi dir=auto` で隔離する。15のUI言語は左から右の表記だが、アラビア文字等を含む名前も入力どおり扱う。

`設定`・`標準` の繁体中国語、簡体中国語の番号付き一覧、`{percent}%` のように同文が正しい場合がある。詳細はインベントリの例外表を参照。ブランド、`Esc`、`X`、`WebGL 2`、`PNG`、`UTC`、URL・IDは保持する。

## 対象と検証の区別

ホーム、設定、準備、プレイ通知、停止、結果、ランキング、殿堂、読み上げ、エラー、賞状、X本文を対象とする。OGPとTwitterカードの日本語メタデータ・canonical・画像は依頼どおり固定する。

この一覧は提供仕様と辞書の実データを記録する。辞書の一致・空訳・引数・44段階の網羅は機械検査の対象であり、母語話者による校閲やiPhone実機検証の完了を意味しない。実施した自動検査・ブラウザ・スクリーンショットは [release-readiness.md](release-readiness.md) を参照。
