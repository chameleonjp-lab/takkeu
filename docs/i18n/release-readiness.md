# 15言語版の公開準備

確認日: 2026-10-30 UTC。対象は正式発行済みの [Draft PR #35](https://github.com/chameleonjp-lab/takkeu/pull/35)、ブランチ `feat/i18n-15-languages`。作業開始時の main は `84b9122713b280255d762978c4bf9906f8b1987b`。

## 今回の公開対象

| 項目 | 値 |
| --- | --- |
| release | `takkeu-i18n-15-20261030` |
| pull_request | `35` |
| head_ref | `feat/i18n-15-languages` |
| client_version | `takkeu-web-clear-3500-1`（維持） |

[`release-target.json`](../../scripts/release/release-target.json) と [`merge-authorization.mjs`](../../scripts/release/merge-authorization.mjs) の固定対象を同時に更新した。PR #34 / `release/3500-production-ab-final-20261028` / `takkeu-3500-production-ab-final-20261028` は今回の公開対象として受理しない。`client_version`、`game_slug`、`rules_version`、DB migration・契約・権限・本番データはこの対象変更で変更しない。

## 所有者マージ後の公開経路

現行の [Pages release workflow](../../.github/workflows/deploy.yml) は、以下のすべてを満たした場合に公開を進める。

1. Draft解除後の PR #35 を所有者 `chameleonjp-lab` が main へ正式マージし、そのマージに公開対象markerのレビュー済み変更が含まれる。PR番号・head/base・repository・ownerのidentity・merge commitを照合する。
2. マージ後の現在 main SHA に対する最新の正式 `CI` push run/attempt が成功し、workflow run と actor/triggering actor の所有者情報が一致する。PR CI、ブランチCI、直接push、未マージPRだけでは公開しない。
3. Pages URL/HTTPS/Source、`github-pages` environment の main限定設定、同一SHAの公開済み成功履歴を確認する。本番DBの公開GET観測と既存/新規RPCのHEAD signatureが、レビュー済みの全契約に一致する。
4. そのSHAを再ビルド・配布検証し、正式main CIのmanifestと全配布byteが一致する。同一release runのPages artifactを使い、アップロードしたtarもmanifestと照合する。
5. 配備直前に正式マージ・最新CI・Pages/environment・本番読取り専用DB契約・現在mainを再確認する。認証・ネットワーク・タイムアウト・契約差分・byte差分のいずれも公開を停止する。
6. 配備後に公開SHA・全static byte・3500 client version・本番DB契約を再検証する。

workflow自体、所有者による承認判定、DB検査、distribution hash照合、postdeploy検査には変更を加えていない。過去の運用記録は書き換えていない。

## 公開ゲートのローカル検証

| 検証 | 結果 |
| --- | --- |
| `node --test --test-isolation=none tests/release/merge-authorization.test.mjs` | 6/6 成功 |
| `npm run test:release-guards` | 32/32 成功、skipなし |
| PR #35 と一致する正式owner merge + 最新main CI | fixtureで承認成功 |
| 旧PR #34のmarker全体と、それに整合する正式merge応答 | 明示的marker gateで拒否 |
| 旧release/ref、別PR、Draft、未merge、別owner、stale SHA/CI、DB/配布失敗 | 拒否を維持 |

変更前のgateでPR #35が拒否され、旧PR #34が受理されることを先に再現した。同じテストが対象変更後に成功することを確認した。既定sandboxの初回総合実行は、既存の `offline preparation works in the real CI sparse layout without docs or credentials` と `every file, release SHA/base and 3500 client version are bound to manifest and tar` が子プロセスの `EPERM` 制約で失敗した。子プロセスを実行できる環境権限で再実行し、テストやassertionを緩和せず32件すべてが通過した。

## 公開完了と区別する確認事項

この検証はrelease markerとローカルの正式gate regressionの証拠であり、公開成功の記録ではない。PRはDraftとして発行されており、この作業ではmainへのマージ、公開workflowの起動、本番DB更新、Pages公開を行っていない。

アプリ・翻訳・ブラウザ・描画負荷の実行結果は [verification-results.md](verification-results.md) に保存した。実際の本番読取り専用契約もGET/HEADで一致した。Production release readinessはPR #35上で本番契約とPages/environment設定を検証して成功している。最終コミットの全CIは [PR checks](https://github.com/chameleonjp-lab/takkeu/pull/35/checks) とartifactのcommit.txtで確認し、成功前にDraftを解除しない。所有者マージ後のmain SHA、正式CI run/attempt、artifact hash一致、配備直前の再確認、公開後のbyte/DB一致は、実際のrelease runが成功するまで未確認のまま扱う。GitHubのmain更新とdeploy APIは原子的ではないため、最終照合から配備完了までmainとDB契約を変更しない運用も維持する。
