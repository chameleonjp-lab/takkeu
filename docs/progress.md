# 第1段階の実装記録

対象：T01〜T03。開始main：`2e7bbb5a123a9bf4d740c48dc794619430c76af4`。計画PR #1はマージ済み。他の実装PR、AGENTS.md、ゲームコード、既存テストはなかった。専用の新規チェックアウト `/workspace/takkeu` と `feat/stage1-basic-rally` を使用する。

要件の再検討は行わず、正式設計・計画・レビュー記録に従う。第2段階の多球、加速、虹色、段階解放、スマッシュは今回追加しない。共通型の将来用フィールドは計画どおり定義する。

## T01：基盤

2026-10-22に公式資料とnpmパッケージの`engines`を確認した。

| ツール | 固定版 | 確認した必要条件・資料 |
|---|---|---|
| Node.js / npm | 24.19.0 / 11.9.0 | 実行環境を`.node-version`、`engines`、`packageManager`へ固定 |
| Three.js / 型 | 0.186.1 / 0.186.0 | [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html)：WebGL 2必須、r163以降WebGL 1非対応 |
| Vite | 8.3.5 | [Guide](https://vite.dev/guide/)と`engines`：Node ^20.19.0 または >=22.12.0 |
| TypeScript | 7.0.2 | [npm公式メタデータ](https://registry.npmjs.org/typescript/7.0.2)：Node >=16.20.0 |
| Vitest | 5.0.5 | [Guide](https://vitest.dev/guide/)と`engines`：Node ^22.12.0 / ^24.0.0 / >=26.0.0 |
| Playwright | 1.64.1 | [Introduction](https://playwright.dev/docs/intro)と`engines`：Node >=20 |
| jsdom | 30.1.3 | [npm公式メタデータ](https://registry.npmjs.org/jsdom/30.1.3)：Node ^22.22.2 / ^24.15.0 / >=26.0.0 |

依存は完全な版番号とlockfileで固定。CIは読取権限で型・単体・ビルド・Chromium/WebKit画面検査を実行し、全文ログ・JSON結果・画像・動画・trace・対象コミットを成果物に保存する。公開ワークフローは追加しない。

進行と正式な結果は各タスク完了時および `docs/verification/stage1/` に追記する。自動ブラウザ検査をiPhone実機や音の試聴の代わりにしない。

T01完了：ホームの未実装失敗を確認し、Chromium/WebKitの起動検査2件、型検査、ビルドが成功。ローカル環境はDebian 13でroot認証が使えず、WebKitの不足共有ライブラリを公式Debianパッケージから`/tmp`へ展開してブラウザのローカル探索パスに配置した。ホスト検査はldconfigのみを見るためローカル実行だけ`PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1`を使用。実際に両ブラウザが起動し画面の検査を通過した。CIはUbuntu 24.04で公式`install --with-deps`を使用し、このローカル回避は含めない。

T02完了：単体12件・型検査成功。接触は球と移動する円形ラケットの距離から区間内の最初の時刻を求める。incoming→outgoingの状態遷移で継続接触をロックする。相手側も同じ計算を継続する。軌道はネットを越え、台内で1回弾む。30/60/120回描画で得点・残球・進行が一致し、テスト専用操作で65秒・12回以上のラリーが成立した。

型の補足：`ReturnPlan`へ省略可能な`landingZ`と`bounceY`を追加した。相手向きの軌道と設定変更時の台面・球半径を同じ軌道関数で扱うため。既存の計画契約を保ち、利用側とテストも同時に対応する。軌道の弾み位置0.72、補間用の高さ0.35/0.10は初期調整値としてconfigに集約した。
