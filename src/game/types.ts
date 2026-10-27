import type { CelebrationState } from './celebrations';
export type GamePhase = 'ready' | 'running' | 'paused' | 'gameover';
export type PauseReason = 'user' | 'hidden' | 'resize' | 'slow-frame' | 'context-lost' | 'input-lost';
export type BallPhase = 'queued' | 'incoming' | 'outgoing' | 'waiting-return' | 'lost';
export type GameEventKind = 'player-hit' | 'opponent-hit' | 'ball-lost' | 'milestone' | 'smash-warning' | 'game-over' | 'game-clear' | 'table-bounce';
export type Point3 = Readonly<{ x: number; y: number; z: number }>;
export type PaddlePoint = Readonly<{ x: number; y: number }>;
export type InputFrame = Readonly<{ target: PaddlePoint; samples?: readonly InputSample[] }>;
export type InputSample = Readonly<{ at: number; target: PaddlePoint; kind?: 'place' | 'move' | 'release' }>;
export type GameEvent = Readonly<{
  id: string; runId: string; kind: GameEventKind; time: number;
  ballId?: number; milestone?: number;
  /** Player contact facts, copied before replacing the incoming plan.
   * Legacy events without these fields use the normal, base-stage sound. */
  smashReturn?: boolean; rallyScore?: number;
  /** Confirmed cumulative loss count; position is copied at the exact loss time. */
  lossCount?: number;
  position?: Point3; effect?: 'racket-firework' | 'bounce-firework';
}>;
export type BallSnapshot = Readonly<{ id: number; phase: BallPhase; position: Point3; smash: boolean }>;
export type ProgressionState = Readonly<{ appliedMilestones: readonly number[]; ballGlowUntil: number | null; awardedBallCount: number }>;
export type ReturnPlan = Readonly<{
  ballId: number; departAt: number; netCrossAt: number; arriveAt: number;
  target: PaddlePoint; smash: boolean; warningAt: number | null; speedMultiplier: number;
  landingZ?: number; bounceY?: number; bounceX?: number; speedScore?: number; smashMultiplier?: number;
  /** Independent opponent-only bonus, fixed at departure; never folded into speedMultiplier. */
  remainingBallMultiplier?: number;
}>;
export type GameSnapshot = Readonly<{
  runId: string; phase: GamePhase; score: number; simTime: number; lostBallCount: number;
  pauseReason: PauseReason | null;
  /** Explicit outcome; older saved/test snapshots without a reason are losses. */
  endReason?: 'clear' | 'loss' | null;
  celebrations: CelebrationState;
  paddle: PaddlePoint; balls: readonly BallSnapshot[];
  opponentPaddle?: PaddlePoint;
  progression: ProgressionState; scheduledReturns: readonly ReturnPlan[];
}>;
export type StepResult = Readonly<{ snapshot: GameSnapshot; events: readonly GameEvent[] }>;
export interface GameSession {
  start(): void;
  step(dt: number, input: InputFrame): StepResult;
  snapshot(): GameSnapshot;
  pause(reason: PauseReason): void;
  resume(): void;
  reset(seed: number): void;
}
export type GameConfig = Readonly<{
  tableHalfWidth: number; tableHalfLength: number; tableY: number;
  paddleZ: number; paddleMinX: number; paddleMaxX: number;
  paddleMinY: number; paddleMaxY: number; paddleSpeed: number;
  ballRadius: number; paddleRadius: number;
  fixedDt: number; maxStepsPerFrame: number; slowFrameSeconds: number;
  normalVisibleSeconds: number; minimumVisibleSeconds: number;
  pulseHalfPeriod: number; audioVoiceLimit: number;
  maxPixelRatio: number; maxDrawingPixels: number;
}>;
