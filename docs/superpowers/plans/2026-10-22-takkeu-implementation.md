# タッケウ 実装計画書（Implementation Plan）

> 公開後のユーザー指定による接触と外観の改訂は、[要件書冒頭の改訂](../specs/2026-10-22-takkeu-design.md) と [接触修正の検証記録](../../verification/contact-fix/README.md) を優先する。以下は初回実装の完了履歴。特にT02の奥行き平面だけの判定とT05の台・相手ラケットの初期非表示を、現在の仕様として再導入しない。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> 実装担当への補足：本人が指定した実行方法を優先する。各段階を一つずつ完了し、レビュー可能なプルリクエストを提出する。この文書の追加だけでゲームを実装済みと扱わない。

**Goal:** Three.jsを使い、スワイプで球を返しながら、多球・加速・相手側の段階的な出現を楽しむ卓球ゲーム「タッケウ」を実装する。

**Architecture:** ゲームの計算、入力、Three.jsの描画、音、画面、保存を分離する。計算結果の状態から描画し、接触イベントから自分用／相手用の音を鳴らす。不可視を計算停止と混同しない。

**Tech Stack:** TypeScript、Three.js WebGLRenderer、Vite、標準Web Audio、Vitest、Playwright。各版と実行環境はT01で公式の必要条件を確認して固定する。

**Spec:** [要件・設計書](../specs/2026-10-22-takkeu-design.md)

作成日：2026-10-22（日本時間）  
対象：`chameleonjp-lab/takkeu`  
基準コミット：`750b7e4da3c12bb7683e7ab44ff6391ecadbc105`  
現状：READMEだけの新規リポジトリ。以下のコード・コマンド・検証は今後実装する計画であり、実行済みの報告ではない。

## Global Constraints

- 開始時は1球。自分のラケットに球が当たると、累計ラリー数が1増える。相手の返球は加点しない。
- 30・50・150に到達したとき、それぞれ1球を1回だけ追加する。落球分の補充はない。全く落としていなければ最大4球。
- 相手側の台・人物はB方式で部位ごとに隠す。270は虹色。19行の段階表は要件書4節を唯一の根拠にする。
- 自分の返球と相手の返球は別の効果音。不可視でも相手の打球音を鳴らす。
- 390の強弱は各0.3秒、1周期0.6秒。420では相手側の球由来の表示も隠す。450以降も続行する。
- 実装数値は要件書7.2節に合わせ、調整可能な初期値として集約する。数値を利用者が指定した事実に変えない。
- スマホ縦横とパソコンドラッグに対応。指位置への瞬間移動、球への吸着、自動ラケット操作を入れない。
- この計画は端末内自己ベストまで。オンラインランキングや外部データベースを勝手に追加しない。
- 計画PR・各実装PRはユーザーがマージする。今回の計画PRではアプリコード、公開設定、料金設定を変更しない。
- テスト・監査・GitHubの実行記録は全文を保存し、実機で未確認の項目を合格にしない。

## Review Focus

| 条件 | 利用者が期待する結果 | 担当テスト |
|---|---|---|
| 同時接触で閾値を飛び越す／同じ刻みに落球する | 追加は1回、残球数と終了が正しい | T04 `progression.test.ts`、`multiball.test.ts` |
| 相手が隠れている／420で球が消える | 物理と音が継続し、光・影・残像が漏れない | T05 `presentation.test.ts`、T08 `audio-events.test.ts` |
| 指の追跡喪失・回転・アプリ切替 | 瞬間移動せず停止し、手動再開まで進まない | T07 `lifecycle.spec.ts` |
| 高速球と移動中ラケット、複数球の競合 | すり抜けず、理論上届く配球を維持する | T02 `collision.test.ts`、T04 `scheduler.test.ts` |
| リトライ反復・音声／保存失敗 | 二重ループや過去音の再生を起こさず、遊び直せる | T07 `storage.test.ts`、T08 `audio-events.test.ts`、T09 `retry.spec.ts` |

## 1. 3段階の実装と進め方

| 段階 | タスク | 成果 | 段階の完了条件 |
|---|---|---|---|
| 第1段階：基本ラリー・操作・基礎SE | T01〜T03 | 1球で開始→返球→加点→失球→結果→再挑戦を遊べる | 相手側が隠れ、スワイプと自他2種の返球音が動作。基本の一時停止を含む。 |
| 第2段階：多球・加速・全演出 | T04〜T06 | 全段階表、最大4球、420の不可視、450のスマッシュが動く | 閾値の飛び越し、減球後の追加、配球の成立条件、演出と音の整合を確認。 |
| 第3段階：スマホ・音・品質・公開準備 | T07〜T10 | 中断復帰、保存、音の仕上げ、性能、配布用設定と証拠をそろえる | 実機確認を含む受入条件を記録し、未確認項目と公開判断を明確にする。 |

各段階は前段階がユーザーにマージされた最新の`main`から始める。別の進め方を指示された場合を除き、3段階を同時に実装して大量の差分を作らない。

並行作業は同じ段階内で独立したファイルに限定する。T01で型を確定した後は、T02の計算とT03の表示・入力の下準備、T04の計算とT05の材質、T07の保存とT08の音の確認を並行にできる。`src/game/types.ts`、`src/game/config.ts`、`src/app/createApp.ts`は各段階の統合担当だけが変更し、他担当は必要な変更を統合担当へ伝える。

## 2. ファイル構成

これは実装後の配置案。今回の文書PRで空のコードファイルを大量作成しない。

| 作成・更新する場所 | 責務・担当 |
|---|---|
| `index.html`、`src/main.ts`、`package.json`、`package-lock.json`、`tsconfig.json`、`vite.config.ts`、`vitest.config.ts`、`playwright.config.ts`、`.node-version`、`.gitignore` | 起動、版固定、開発・配布・テストコマンド。T01。 |
| `src/game/types.ts`、`src/game/config.ts` | 共通の型と初期値。T01で定義、変更は統合担当。 |
| `src/game/session.ts`、`src/game/collision.ts`、`src/game/trajectory.ts` | 状態・固定刻みの進行・連続接触・1球の軌道。T02。 |
| `src/game/milestones.ts`、`src/game/progression.ts`、`src/game/difficulty.ts`、`src/game/scheduler.ts` | 閾値・増球・速度・到着予約。T04。 |
| `src/game/opponent.ts` | 相手の打球・予告・スマッシュの決定。T06。 |
| `src/input/swipe.ts`、`src/input/timeline.ts` | 1本の指・ドラッグ・移動差分・解除・時刻順の入力。T03、T07。 |
| `src/render/createView.ts`、`src/render/objects.ts`、`src/render/presentation.ts`、`src/render/rainbow.ts` | Three.jsの場面と部位、表示条件、虹色。T03、T05。 |
| `src/render/opponentView.ts`、`src/render/quality.ts` | 相手の動作、解像度と資源監視。T06、T09。 |
| `src/audio/audio.ts`、`src/audio/tones.ts` | 自分用／相手用の音生成、重複抑制、中断復帰。T03、T08。 |
| `src/ui/screens.ts`、`src/ui/styles.css`、`src/storage/preferences.ts` | ホーム・得点・残球・結果・設定・保存。T03、T07。 |
| `src/app/createApp.ts`、`src/app/loop.ts`、`src/app/lifecycle.ts` | 依存の接続、計算と描画、中断・再開。T03、T07。 |
| `tests/unit/`、`tests/browser/`、`tests/helpers/fixtures.ts`、`tests/helpers/replay.ts` | 短い機能検査、画面検査、再現用状態と入力。T01〜T09。 |
| `.github/workflows/ci.yml` | 段階ごとの自動検証と証拠保存。T01から追加。 |
| `.github/workflows/deploy.yml`、`docs/release.md` | 手動の公開候補作成・配備手順。T10。 |
| `docs/verification/`、`docs/progress.md` | 検証対象、結果全文への参照、進捗と未確認範囲。各段階で更新。 |

## 3. 共通の境界と型

以下の型・関数名を基準にする。途中で変える場合は利用側とテストを同じ変更で更新する。Three.jsのオブジェクトをゲーム状態へ保存しない。

```ts
type GamePhase = 'ready' | 'running' | 'paused' | 'gameover';
type PauseReason = 'user' | 'hidden' | 'resize' | 'slow-frame' | 'context-lost' | 'input-lost';
type BallPhase = 'queued' | 'incoming' | 'outgoing' | 'waiting-return' | 'lost';
type GameEventKind = 'player-hit' | 'opponent-hit' | 'ball-lost'
  | 'milestone' | 'smash-warning' | 'game-over';
type Point3 = Readonly<{ x: number; y: number; z: number }>;
type PaddlePoint = Readonly<{ x: number; y: number }>;
type InputFrame = Readonly<{ target: PaddlePoint }>;
type InputSample = Readonly<{ at: number; target: PaddlePoint }>;
type GameEvent = Readonly<{
  id: string; runId: string; kind: GameEventKind; time: number;
  ballId?: number; milestone?: number;
}>;
type BallSnapshot = Readonly<{
  id: number; phase: BallPhase; position: Point3; smash: boolean;
}>;
type ProgressionState = Readonly<{
  appliedMilestones: readonly number[]; ballGlowUntil: number | null;
}>;
type GameSnapshot = Readonly<{
  runId: string; phase: GamePhase; score: number; simTime: number;
  paddle: PaddlePoint; balls: readonly BallSnapshot[];
  progression: ProgressionState; scheduledReturns: readonly ReturnPlan[];
}>;
type StepResult = Readonly<{
  snapshot: GameSnapshot; events: readonly GameEvent[];
}>;
type ReturnPlan = Readonly<{
  ballId: number; departAt: number; netCrossAt: number; arriveAt: number;
  target: PaddlePoint; smash: boolean; warningAt: number | null;
  speedMultiplier: number;
}>;
```

`GameConfig`は要件書7.2節の数値と`maxBalls: 4`、`pulseHalfPeriod: 0.3`、`audioVoiceLimit: 8`を型付きで保持する。`GameEvent.id`はプレイ識別子と増加するイベント番号から作り、同じ接触に同じIDを使用する。`GameEvent.runId`は発行元の`GameSnapshot.runId`と一致させる。`queued`は新しい球の初回発射前だけに使用し、既存球の相手側での待機は`waiting-return`とする。球IDは同一プレイ中に再利用しない。

`createSession(config: GameConfig, seed: number): GameSession`がゲームの入口。`GameSession`は`start(): void`、`step(dt: number, input: InputFrame): StepResult`、`snapshot(): GameSnapshot`、`pause(reason: PauseReason): void`、`resume(): void`、`reset(seed: number): void`を公開する。`reset`はreadyへ戻し、開始ボタン側で`start`する。非running時の`step`は状態・時刻を変えず、空のイベント配列を返す。

乱数は渡された`seed`から再現できるものを使う。描画や音側でゲームの乱数列を消費しない。入力目標は`InputSample.at`にゲーム内の適用時刻を付けて記録する。`createInputTimeline(initial: PaddlePoint): InputTimeline`は`enqueue(sample): void`、`sampleAt(simTime): InputFrame`、`clear(target): void`を持ち、各固定計算時刻までの入力を時刻順に反映する。ブラウザの入力時刻はアプリ側で単調増加するゲーム内時刻へ変換し、停止時間を除く。描画フレームの最新目標を過去の全計算刻みへ適用しない。停止・再開・リトライでは未適用入力を捨てる。

## 4. 検証コマンドの契約

T01で次のスクリプトを用意する。T01以前に実行できると主張しない。

| コマンド | 動作 |
|---|---|
| `npm ci` | ロックファイルどおりの依存を導入。 |
| `npm run typecheck` | TypeScriptの型検査のみ。 |
| `npm run test:unit -- tests/unit/対象.test.ts` | 指定ファイルのVitestを1回実行。 |
| `npm run test:unit` | 単体テストを1回実行。監視モードにしない。 |
| `npm run test:browser -- tests/browser/対象.spec.ts` | 指定Playwright検査を実行。 |
| `npm run test:browser` | その段階までの画面検査。ChromiumとWebKitを設定する。 |
| `npm run build` | 型検査と配布用ビルド。 |
| `npm run build -- --base=/takkeu/` | GitHub Pagesの配下パス用ビルド。スクリプトは引数をViteへ渡す。 |
| `npm run preview -- --host 0.0.0.0` | 配布物の確認用サーバー。 |

`build`の引数転送が難しいスクリプト構成なら、`build:pages`を明示的に追加してT10と文書を同時に変更する。非実在のコマンドを完了報告へ載せない。

自動検証は、通常の変更では型・関連単体・ビルドを短く実行する。画面検査は主要な操作・表示・中断に限定し、長時間の自動ラリーで450へ到達する試験を必須にしない。テスト用状態を直接注入して各境界を確かめる。

## 第1段階：基本ラリー・操作・基礎SE

### T01：起動できる構成と共通の型を作る

**Files:** 作成＝2節の起動・設定ファイル、`src/game/types.ts`、`src/game/config.ts`、`tests/browser/boot.spec.ts`、`.github/workflows/ci.yml`、`docs/progress.md`。

**Interfaces:** 生成＝3節の型、`GameConfig`、`DEFAULT_CONFIG`。ブラウザ検査の`webServer`と`baseURL`を設定し、ホームの見出し「タッケウ」を読み取れるようにする。

- [x] 公式の実行環境要件を確認し、互換性のあるThree.js・Vite・TypeScript・検証ツールの版を固定する。採用版と確認URLを`docs/progress.md`へ記録する。
- [x] `boot.spec.ts`へ、ホームにタイトルと開始ボタンがあり、ゲーム未開始のまま表示される検査を書く。
- [x] テスト環境と最低限の空の起動先を用意し、`npm run test:browser -- tests/browser/boot.spec.ts`が「期待するホームがない」理由で失敗することを確認する。依存不足による失敗を機能検証の代わりにしない。
- [x] 起動先、ホーム、共通の型、要件書の初期値を実装する。CIは読取権限を基本とし、テスト出力を省略せず成果物へ保存する。
- [x] 同じ検査、`npm run typecheck`、`npm run build`を実行し、成功したコマンドと全文結果を保存してコミットする。

**完了条件:** ホームを起動でき、`index.html`にゲームロジックがない。ゲームコードとテスト環境の版が固定されている。

### T02：1球の往復・連続接触・得点・終了を実装する

**Files:** 作成＝`src/game/session.ts`、`src/game/collision.ts`、`src/game/trajectory.ts`、`tests/unit/session.test.ts`、`tests/unit/collision.test.ts`、`tests/helpers/fixtures.ts`、`tests/helpers/replay.ts`。

**Interfaces:** 使用＝T01の型と設定。生成＝`createSession(config, seed)`。接触計算は`sweepPaddleHit(ballFrom: Point3, ballTo: Point3, paddleFrom: PaddlePoint, paddleTo: PaddlePoint, config: GameConfig): number | null`として、接触した移動区間の割合0〜1を返す。軌道は`sampleReturn(plan: ReturnPlan, from: Point3, time: number): Point3`で評価する。フィクスチャはテスト側だけから初期球・得点・時刻を指定でき、配布入口から読み込まない。

- [x] `session.test.ts`で、自分の接触1回→得点1・`player-hit`1件、同じ接触継続→追加0、相手の接触→得点0増・`opponent-hit`1件、落球→生存0・`game-over`1件を検査する。
- [x] `collision.test.ts`で、1刻みで打球平面をまたぐ高速球、移動中のラケット、円の縁に触れる球、範囲外の球を配置し、接触時刻または`null`を照合する。描画用の光の半径は使わない。
- [x] `npm run test:unit -- tests/unit/session.test.ts tests/unit/collision.test.ts`で未実装の失敗を確認する。
- [x] 相手への自動返球、相手の確実な返球、台で弾む軌道、接触ロック、落球、時刻順処理を実装する。`pause`中は時刻と球を進めない。球の内部状態は描画オブジェクトから分離する。
- [x] 同じ単体検査と型検査を通す。入力時刻を固定した30/60/120回描画の再現検査を`replay.ts`で追加し、得点・残球・到達段階が一致することを確認してコミットする。

**完了条件:** Q01、Q02の基本部分、Q09が成立する。台の弾みや相手の打球で誤加点しない。

### T03：固定視点・スワイプ・画面・自他2種の音をつなぐ

**Files:** 作成＝`src/render/createView.ts`、`src/render/objects.ts`、`src/render/presentation.ts`、`src/input/swipe.ts`、`src/input/timeline.ts`、`src/audio/audio.ts`、`src/audio/tones.ts`、`src/ui/screens.ts`、`src/ui/styles.css`、`src/app/createApp.ts`、`src/app/loop.ts`、`tests/browser/basic-play.spec.ts`、`tests/unit/swipe.test.ts`、`tests/unit/input-timeline.test.ts`、`tests/unit/audio-events.test.ts`。

**Interfaces:** 使用＝T02の`GameSession`、`StepResult`。生成＝`createView(canvas, config): GameView`、`GameView.render(snapshot, events: readonly GameEvent[]): void`／`resize(width, height): void`／`dispose(): void`。入力は`createSwipeController(element, options: SwipeOptions): SwipeController`を使い、`updateMapping(mapping)`、`cancel()`、`dispose()`を公開する。`SwipeOptions`は`mapping`、`onTarget(sample: InputSample)`、`getPaddlePosition(): PaddlePoint`、`toSimTime(eventTimestamp: number): number`、`onInterruption(): void`を持つ。指離れ・中断時は最新の実ラケット位置を新しい目標として通知する。異常中断だけは`onInterruption`から`pause('input-lost')`を呼ぶ。`mapping`は操作平面の画面上の範囲とゲーム内範囲を持つ。音は`createAudio(config): GameAudio`を使い、`unlock(): Promise<boolean>`、`consume(events): void`、`setVolume(value): void`、`setMuted(value): void`、`suspend(): void`、`reset(runId: string): void`、`dispose(): Promise<void>`を公開する。

- [x] `swipe.test.ts`で触れた瞬間の移動0、差分での移動、範囲制限、指離れ後の実位置保持（未追従目標を破棄）、2本目の指の無視を検査する。`audio-events.test.ts`で2種類のイベントが異なる音生成へ1回ずつ渡ることを検査する。`input-timeline.test.ts`では同じ刻みに複数入力がある場合と、未到来時刻の入力を先取りしないことを検査する。
- [x] `basic-play.spec.ts`へ開始→スワイプ→成功→失球→結果→再挑戦、開始時の相手側非表示、停止中の時刻保持を追加し、未実装部分の失敗を確認する。
- [x] 固定視点、部位を分けた形状、相対スワイプ、接触時の控えめな表示、得点・残球・結果画面を実装する。相手側の不可視は5節の部位単位にする。
- [x] 開始操作内で音声を開始し、自分用と相手用の短音を生成する。音声開始失敗は無音継続にする。ループは1/120秒刻みで進め、描画間隔0.10秒超は停止する。各刻みのイベントを音へ1回ずつ渡し、1描画内の全イベントを配列にまとめて`GameView.render`へ渡す。音は初期化時とリトライ時に`reset(session.snapshot().runId)`してから受け付ける。
- [x] 関連単体検査、`basic-play.spec.ts`、ビルドを通し、1球の操作動画・自他の音の確認メモを保存する。実機未確認ならそのまま記録し、第1段階PRを作成する。

**第1段階PR完了条件:** 一連の操作が成立する。相手が見えなくても相手の返球音が鳴る。後半機能はまだ未実装と明示する。

## 第2段階：多球・加速・全演出

### T04：閾値・増球・加速・到着予約を実装する

**Files:** 作成＝`src/game/milestones.ts`、`src/game/progression.ts`、`src/game/difficulty.ts`、`src/game/scheduler.ts`、`tests/unit/progression.test.ts`、`tests/unit/multiball.test.ts`、`tests/unit/scheduler.test.ts`。更新＝`session.ts`、共通の型・設定。

**Interfaces:** `advanceProgression(state: ProgressionState, previousScore: number, nextScore: number, simTime: number): ProgressionUpdate`。`ProgressionUpdate`は`state`、`crossed: readonly number[]`、`addedBalls: number`、`speedTier: number`を返す。`speedMultiplier(score: number): number`は要件書の式を使う。`scheduleReturn(request: ReturnRequest, reserved: readonly ReturnPlan[], config: GameConfig): ReturnPlan`は既存予約を変更せず次の成立する打球を返す。`ReturnRequest`は`ballId`、`earliestDepartAt`、`preferredTarget`、`speedMultiplier`、`smash`を持つ。

- [x] `progression.test.ts`で、以下の境界とM10の5秒・M30の優先を検査する。
```ts
const state = { appliedMilestones: [10, 30], ballGlowUntil: null };
const first = advanceProgression(state, 49, 51, 12);
expect(first.crossed).toEqual([50]);
expect(first.addedBalls).toBe(1);
expect(first.speedTier).toBe(10);
expect(advanceProgression(first.state, 51, 52, 13).addedBalls).toBe(0);
expect(speedMultiplier(0)).toBe(1);
expect(speedMultiplier(450)).toBeLessThanOrEqual(2.2);
```
- [x] `multiball.test.ts`で29→31、149→151、途中の落球後に50で1球だけ追加、生存球4以下、同じ刻みの追加・落球・終了順序を検査する。`scheduler.test.ts`で左右端を交互に狙う4球、最短到着、候補なしの待機、待ち順維持、3球以上の到着列の前後双方の移動成立を検査し、最初に失敗を確認する。
- [x] 段階表をデータ化し、イベントを一度だけ適用する。球を配列の長さだけで補充しない。現在の球数と生涯追加数を区別し、発射待ちも生存球に含める。
- [x] 速度段階は得点到達で更新し、次に新規確定する相手返球の予約から適用する。予約済み・予告中・飛行中は倍率と時刻を固定する。予約時に通常0.60秒・スマッシュ0.50秒の視認下限、追加球1.0秒、移動に必要な到着間隔を満たす。既存予約を変更せず、候補なしでは打球を待つ。
- [x] 関連単体検査・型検査を通す。成立条件は境界値と固定seedで確認し、根拠なく大量のランダム試行を必須にしない。ログを保存してコミットする。

**完了条件:** Q02〜Q04、Q08の通常球部分が成立。50の時点で残り1球なら、追加後は2球。

### T05：B方式の部位解放・虹色・390・420を実装する

**Files:** 作成＝`src/render/rainbow.ts`、`tests/unit/presentation.test.ts`、`tests/browser/milestones.spec.ts`。更新＝`presentation.ts`、`objects.ts`、`createView.ts`。

**Interfaces:** `resolvePresentation(snapshot: GameSnapshot): PresentationState`を純粋関数として実装する。`PresentationState`は部位ごとの`visible`／`rainbow`、球IDごとの`visible`／`rainbow`、`pulseStrength`を持つ。部位IDは`selfCourtRight`、`selfCourtLeft`、`opponentCourtRight`、`opponentCourtLeft`、`courtEdges`、`net`、`playerRacketBody`、`playerRacketEdge`、`opponentRacketBody`、`opponentRacketEdge`、`opponentBody`。`sampleRainbow(simTime: number, phase: number): RGB`と`samplePulse(simTime: number): number`を描画だけで使用する。

- [x] `presentation.test.ts`で全19行の閾値を検査する。70では相手の縁だけ、190では右だけ、300ではラケット縁だけ、330では本体、360では身体、270では自ラケット全体が虹色になることを固定する。
- [x] 10の終了と30の常時発光、419→420、`z = 0`、消えた球、初回発射待ち`queued`、既存球の返球待ち`waiting-return`を組み合わせる。初回待機だけを隠し、30〜419の返球待ちは表示を保つ。420で相手側の球・光・影・残像が消え、自側と解放済みの部位は残ることを検査し、失敗を確認する。
- [x] 共通の表示条件を全ての球由来の描画へ適用し、部位別の材質を実装する。親の非表示で子の解放が消えない構造を保つ。390は各0.3秒で強弱を滑らかに遷移し、1周期0.6秒とする。
- [x] `milestones.spec.ts`でテスト用状態を直接注入し、開始、10の発光中/終了、30、70、190、240、270、300、330、360、390、420を撮影する。その他の節目も純粋関数の検査で対応し、画像と判定条件を混同しない。
- [x] 単体・画面検査を実行する。画像を実際に開き、未解放部位の漏れ、球の輪郭、文字、スマッシュ予告用領域を確認する。390は動画も保存し、点滅条件の検証はT09へ引き継ぐ。

**完了条件:** Q05、Q06とQ12の周期・対象が成立。可視状態の変更で物理・音を止めていない。

### T06：相手の動作と450以降のスマッシュを加える

**Files:** 作成＝`src/game/opponent.ts`、`src/render/opponentView.ts`、`tests/unit/opponent.test.ts`、`tests/browser/smash.spec.ts`。更新＝`session.ts`、`scheduler.ts`、`screens.ts`、`tones.ts`。

**Interfaces:** `chooseReturnKind(score: number, plannedDepartAt: number, committedSmashDepartures: readonly number[], randomValue: number): 'normal' | 'smash'`。`committedSmashDepartures`は実行済みと予約済み両方の打球時刻を持つ。新候補の前後2.0秒内にスマッシュがあれば通常球へ戻す。`scheduleReturn`の最終時刻でも再確認してから予約を登録し、複数球の同時予約で間隔を破らない。`scheduleReturn`が返した`warningAt`と`departAt`から、`smash-warning`と`opponent-hit`を各1回発行する。`opponentView`は`GameView.render(snapshot, events)`から状態と当該イベントを受け、表示状態はT05へ委ねる。継続中の予告は`scheduledReturns`の`warningAt <= simTime < departAt`から復元し、停止・WebGL復旧時に単発イベントの再送を必要としない。

- [x] `opponent.test.ts`で449では通常、450以上で20%の候補、実行済み・予約済みいずれかのスマッシュの前後2.0秒未満なら通常、4球が同時に候補になっても予約間隔を守る、予告が打球0.40秒以上前、音と打球が1回ずつ、450を超えても終了しないことを検査する。
- [x] 4球の予約へスマッシュを挿入し、成立しなければ通常返球または打球前の予約調整になる検査を書く。相手側の不可視を予告で解除しない検査と合わせて、失敗を確認する。
- [x] 軽量な形状を組み合わせた相手、腕とラケットの返球動作、構えによる予告、短い文字表示と予告音を実装する。外部3D素材の入手を前提にしない。
- [x] `smash.spec.ts`で390＋420＋450、ミュート、複数球、停止中の予告を確認する。予告は点滅対象にしない。打球音は通常と同じ相手用音を確実に鳴らす。
- [x] 第2段階の単体・画面・ビルド検査を通し、予告中に別球が加速閾値を越えても予約時刻と倍率が変わらないことを確認する。全節目の確認表、画像、予告動画、音メモを保存してPRを提出する。

**第2段階PR完了条件:** Q02〜Q08、Q12の実装部分、Q13が成立。プレイの全ルールが実装されている。実機の性能や安全な表示の最終判定はT09の結果を明示する。

## 第3段階：スマホ・音・品質・公開準備

### T07：中断復帰・保存・設定・画面の失敗処理を仕上げる

**Files:** 作成＝`src/app/lifecycle.ts`、`src/storage/preferences.ts`、`tests/unit/storage.test.ts`、`tests/browser/lifecycle.spec.ts`。更新＝`swipe.ts`、`loop.ts`、`createApp.ts`、`screens.ts`、`styles.css`、`createView.ts`。

**Interfaces:** `loadPreferences(storage: StorageLike): Preferences`、`savePreferences(storage, value): boolean`。`Preferences`は`version: 1`、`bestScore`、`volume`、`muted`、`sensitivity`、`quality`。`StorageLike`は`getItem`／`setItem`だけを要求する。`bindLifecycle(app): () => void`は解除関数を返し、`pause/resume`を二重に登録しない。

- [x] `storage.test.ts`で保存拒否・不正JSON・NaN・負点・不正バージョン・容量不足を与え、既定値またはメモリ内継続になり、例外でプレイが止まらないことを検査する。
- [x] `lifecycle.spec.ts`で非表示、回転、入力追跡喪失、WebGL喪失を起こす。異常中断では時刻・球・5秒発光・点滅・予告が止まり、再開操作でだけ戻ることを検査する。通常の指離れと、それに続く正常な追跡解除ではプレイを続けることも分けて検査する。予告中に描画を再作成しても、`scheduledReturns`から同じ予告表示と残り時間が復元されることを確認し、失敗を確認する。
- [x] 中断時の入力解除、再開時の時計初期化、座標変換の再計算、自己ベストの検証と保存、設定画面、利用不能時の案内を実装する。リトライで予約とイベント履歴を消す。
- [x] 44px以上のボタン、縦横、画面端の余白、文字200%、読み上げのラベルを整える。メニューと操作領域のタッチ制御を分ける。
- [x] 関連検査とビルドを実行し、保存・中断・復帰の証拠を記録してコミットする。

**完了条件:** Q10、Q11、Q15の保存・WebGL部分が成立。バックグラウンド時間が得点や演出を進めない。

### T08：自他の音、重なり、中断後の再開を仕上げる

**Files:** 更新＝`src/audio/audio.ts`、`src/audio/tones.ts`、`tests/unit/audio-events.test.ts`。作成＝`tests/browser/audio.spec.ts`、`docs/verification/audio-review.md`。

**Interfaces:** T03の`GameAudio`を維持する。音生成側は`playPlayerHit(context, output)`／`playOpponentHit(context, output)`を分ける。アプリは初期化とリトライ時に`reset(runId)`を呼び、音声側は`GameEvent.runId`がそのIDと一致するイベントだけを受け付ける。`unlock`の失敗は`false`で返し、未処理の例外を残さない。

- [x] 同じ接触IDを2回渡して1回だけ鳴る、異なる4球は4イベントとして扱う、停止中のイベントは捨てる、リトライ後に古いプレイの音を鳴らさない、不可視と音が無関係である検査を書く。既存球の返球待ちでは無音で、実際の打球時だけ相手音が鳴ることも確認する。
- [x] `audio.spec.ts`で初回開始、ミュート、解除、音量、再開失敗の表示を検査する。音声ノード生成の検査を、実際に聴いた結果の代わりにしない。
- [x] 2音の音色・高さ・長さを調整し、短い音量変化で不快なクリックを抑える。同時発音8音の上限と、終了したノードの切断を実装する。
- [ ] iPhone Safariでアプリ切替・画面ロック・復帰を行い、再開タップ後に自他2音が鳴り、過去の音がまとめて鳴らないことを確認する。音声再開失敗でも無音プレイを選べる状態にする。 **未確認：実機なし。自動ブラウザの成功で代替しない。**
- [x] 自分音・相手音・重なった音・予告音を聴いて確認し、端末と設定、可否、修正内容を`audio-review.md`へ記録してコミットする。実機が使えない場合は未確認としてT09の公開判断へ引き継ぐ。 **実試聴は未確認としてaudio-review.mdへ記録した。**

**完了条件:** A01〜A08とQ07・Q11の音部分が成立。消音でも予告が機能する。

### T09：最大負荷・再試行・実機・全要件の確認を行う

**Files:** 作成＝`src/render/quality.ts`、`tests/browser/retry.spec.ts`、`tests/browser/quality.spec.ts`、`tests/unit/loop.test.ts`、`docs/verification/acceptance.md`。必要箇所だけ修正し、関係のない書き換えは行わない。

**Interfaces:** `computeDrawingSize(cssWidth, cssHeight, deviceRatio, quality): { width: number; height: number }`は倍率上限1.5/1.0と総画素数200万を守る。`GameView.dispose`は所有する資源だけを解放し、再利用中の共有資源を破棄しない。

- [x] 解像度上限、縦横の同一操作範囲、最低視認時間を画面サイズと切り離した検査を追加する。再挑戦20回・ホーム往復20回でイベント購読、更新ループ、音が増えない検査を追加する。`loop.test.ts`は実際のアプリのループと時刻付き入力を使い、30/60/120回描画で同じ得点・残球・進行となることを検査する。
- [x] 結果を確認してから必要な品質調整と資源解放を実装する。メモリ値が完全に0になることを合格条件にせず、同じ状態へ戻った時に資源数が増え続けないことを確認する。
- [ ] iPhone 17 Pro Safariの縦横で、4球・390以降・スマッシュを含む60秒を測定する。目標は描画間隔の95%が25ms以下。球速と判定は品質変更で変えない。未達なら発光・解像度・形状を調整して該当箇所だけ再測定する。 **未確認：実機なし。自動ブラウザの成功で代替しない。**
- [ ] 390の実映像を確認し、0.6秒周期、形の維持、文字と球の識別、点滅基準を検証する。音とスマホ操作は実機で確認し、Playwright WebKitだけで代替したと記録しない。 **ブラウザ動画の連続フレーム確認済み。最終的な点滅基準は未確認。**
- [x] 要件書Q01〜Q17とR01〜R12、A01〜A08、全M番号を照合する。単体・画面・型・ビルドを一度通し、対象コミット・全文ログ・画像・動画・実機メモ・未確認範囲を`acceptance.md`へまとめる。

**完了条件:** 根拠のある受入表がある。実機や音の確認ができない場合もPR作成と独立作業を進めるが、公開可能・実機合格とは表示しない。

### T10：配布用ビルドと公開手順を用意し、第3段階PRを提出する

**Files:** 作成＝`.github/workflows/deploy.yml`、`docs/release.md`。更新＝`vite.config.ts`、`package.json`、`README.md`、`docs/progress.md`。

**Interfaces:** 配布基準パス`/takkeu/`。公開の手動ワークフローは`workflow_dispatch`の`expected_sha`入力を受け、実行対象mainのSHAと一致する場合だけ配備へ進む。PR検査側から公開権限を使用しない。`expected_sha`そのものをcheckoutし、同じコミットで必要な型・単体・画面検査と配布用ビルドを行った後、その成果物だけを配備する。

- [x] `npm run build`と`npm run build -- --base=/takkeu/`の配布物を確認する。`tests/browser`で実ビルドを対象に、入口・スクリプト・スタイルの参照失敗と、テスト用得点変更機能の混入がないことを確認する。
- [x] `deploy.yml`へ手動実行、対象SHA照合、最小限の公開権限、同時配備の整理、ビルド成果物の配備を記載する。公開対象は`dist`とし、検査・ビルド・配備の対象SHAを実行記録へ残す。開発サーバーを公開手段にしない。
- [x] `release.md`にPagesの有効化が別途必要な場合の操作、実行するmainと`expected_sha`、実行URLの確認、配布後の短い確認、以前の承認済み版へ戻す手順を書く。実機・音・390映像の検証対象コミットと公開対象の差分も確認し、ゲームに影響する変更があれば該当検証を更新する。公開必須の未確認項目が残る間は準備完了までとし、公開可能と記載しない。ユーザーの公開指示なく設定変更や実行はしない。
- [x] 最終PRの最新コミットで必要なCIが成功したこと、差分が計画範囲内であることを確認する。未確認実機項目があれば具体的に残す。実装済み範囲と公開状態を分ける。 **b06b646のPR／push CIは全工程成功。APIの結果報告遅延と成功確認を分けて保存した。最新文書追加headはPR本文・Checksで追跡する。**
- [x] 第3段階PRをDraftで提出し、PR URL、対象コミット、検査結果、実機確認状況、残る公開操作を報告する。ユーザーによるマージを待ち、自動マージしない。

**第3段階PR完了条件:** 実装・検証・配布設定と残る判断をユーザーがPRだけで確認できる。公開そのものを今回の文書作成や将来のPR提出と混同しない。


実装・正式検証と未確認の詳細：[第3段階受入表](../../verification/acceptance.md)。実機・試聴・最終点滅判定が残るため、公開可能とは判定しない。

## 5. 各PRの提出形式

タイトルには対象段階を入れる。説明は「この段階で遊べるようになったこと」「変更の範囲」「確認結果」「未確認・残件」を短く記載する。CIの失敗はログから原因を特定して修正し、同じ処理を理由なく何度も再実行しない。

証拠は`docs/verification/`の記録とGitHub Actionsの成果物へ保存する。成果物の期限で失われるものは必要に応じてリポジトリ側にも要点と参照可能な正式結果を残す。正式ログの省略版だけを保存しない。不要な巨大バイナリを繰り返しコミットしない。

## 6. 開始に使う依頼文

[段階別のCodex依頼文](../../prompts/2026-10-22-takkeu-codex.md)を使う。各依頼文はこの計画書と要件書を参照し、詳細を重複させない。前段階の最新状態を読んでから、指定段階の未完了タスクだけを実装する。

## 7. 計画書の自己確認

文書提出時に確認する項目。これはゲーム本体の検証ではない。

- [x] ユーザーの19行の段階表と、B方式・270修正・2種の返球音を転記した。
- [x] 採用済みルールと初期調整値、未指定のオンラインランキングを区別した。
- [x] 全Q番号に実装担当があり、型・関数名と作成ファイルがつながっている。
- [x] 3段階の依存関係、並行化できる範囲、各PRの完了条件が明確になっている。
- [x] 未実装・未検証・未公開の内容を、完了した事実として書いていない。

実際の文書確認結果は[文書レビュー記録](../../reviews/2026-10-22-takkeu-plan-review.md)に保存する。
