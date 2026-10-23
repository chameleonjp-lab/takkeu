# 最終ソースCIの全成果物

対象: `d47753586136db8c4c20dd3a87bb89e912fb9f31`、[run 40023104678](https://github.com/chameleonjp-lab/takkeu/actions/runs/40023104678)。core、両engineの通常/負荷、集約verifyの6jobすべて成功。

元のActions artifactをZIPのまま保存する。全内容を展開済みファイルとbyte比較し、ZIP CRCも確認した。省略や再圧縮はしていない。各`*-artifact-inventory.json`にartifact ID、元archiveのSHA256、全entryのサイズ/CRCを記録する。全jobのデコード済みログは[logs](../../logs/)にある。

- [core: 型・256unit・4配布検査](core.zip)
- [Chromium: 通常41件](chromium-interaction.zip)
- [Chromium: 負荷3件](chromium-load.zip)
- [WebKit: 通常41件](webkit-interaction.zip)
- [WebKit: 負荷3件](webkit-load.zip)

各ZIPを別directoryへ展開し、`npx playwright show-report <directory>/playwright-report`でHTML reportを開く。JSON、画像、動画、元ログ、実行SHAもZIP内に含む。成功時のtraceは既存のretain-on-failure設定に従う。過去の失敗traceは別のCI/run directoryに全て保持する。
