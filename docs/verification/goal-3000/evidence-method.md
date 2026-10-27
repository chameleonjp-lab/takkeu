# 正式証拠の保存・復元

最終検証対象は `720c06357beff5e7bdfe0073fb35293c7f45b372`。製品srcは `93294e80a9066c486121a20088189d1a17627a53` と同一。最終PR CIの仮想merge checkout `29b0dd1dba17bed19ab74d1a948db9c5e7f1f8a1` は720c063と全treeが同一だった。[6試行の照合](source-ci-provenance.json)にsource/checkout/treeを保存した。仮想checkoutはmainへのマージ実行を意味しない。

## 保存範囲

- 元ファイル1150本、1,097,701,583 bytes。単体・ブラウザー・配布物・PostgreSQL競合・画像/点滅/heap・独立レビュー・source保護・CI metadata/logを保存した。
- 6 workflow attempt、実行済み28 job全文ログ、skip2件のmetadata、GitHub公式artifact ZIP22本を含む。途中の失敗・中断・誤コピーと訂正記録を残し、成功した試行へ置き換えていない。
- クリア画面の追加画素一致試験はChromiumで失敗のまま保存。initial scriptは当時の条件を復元したものと明示し、実行時の原本hashを証明したとは扱わない。
- 旧描画整理の巨大証拠は複製せず、[旧保存方式](../adaptive-rendering/evidence-method.md)とmanifest/archiveのhashで参照する。新しいpackage自体は旧archiveなしで全件復元できる。

## 分割と重複排除

[manifest](evidence/manifest.json) のSHA256:

```text
5327b2dc15759d79add06d2d7289c40bb957085f0fe1a84fd3be0047160d40f6
```

gzip tarを32MiB以下の14partに分割し、各partのhashをmanifestへ記録した。結合archiveは438,866,486 bytes、SHA256:

```text
6dcc71ececb51141b26ddea17a694bb9a98da8796ac3c9e41310e1a489137c0d
```

同一byte列をSHA256 objectとして共用する。provider ZIPはlocal header・圧縮payload・central directory等の区間をrecipeで再結合するため、ZIP内で重複した動画等もまとめられる。ZIPを作り直す方式ではなく、**GitHubが返した元のZIP全byteをそのまま復元**する。22本全てでGitHub公式digest一致と全member CRCを確認した。ファイル名と内容を保持し、filesystemのmtime/owner/permissionは保存対象としない。

## 復元と照合

Python 3標準ライブラリだけで実行できる。repository rootから、全partとmanifestを取得した状態で実行する。出力先は空である必要がある。

```sh
python3 docs/verification/goal-3000/restore_evidence.py \
  docs/verification/goal-3000/evidence/manifest.json /tmp/takkeu-goal-evidence
```

part/結合archive/object/各復元fileのサイズとhashを全て照合する。復元ファイルを出力せずに検証する場合は出力先の代わりに `--verify-only` を指定する（一時領域は使用する）。再packは [pack_evidence.py](pack_evidence.py)、復元は [restore_evidence.py](restore_evidence.py)。[自己試験](selftest_evidence.py)で空ファイル・重複file・異なるZIPの共通payload・原ZIP完全復元・改ざんpart拒否・親directoryへの逸脱拒否を検査した。

今回の全復元は [restore.log](restore.log) と [元1150fileとの再照合](restore-verification.json)を参照する。元の全path集合と各SHA256が一致し、復元した22ZIPの公式digest/CRCも再照合した。[pack記録](pack.log)と[独立証拠監査](evidence-review.md)を併記する。記録のみを加えた最終commitは、新しい製品CIの合格SHAとして扱わない。
