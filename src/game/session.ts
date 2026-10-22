import { clampPaddle, INITIAL_PADDLE } from './config';
import { sweepPaddleHit } from './collision';
import { sampleReturn } from './trajectory';
import type { BallPhase, GameConfig, GameEvent, GameEventKind, GamePhase, GameSession, GameSnapshot, PaddlePoint, PauseReason, Point3, ReturnPlan } from './types';

let nextSessionId = 0;

export function createSession(config: GameConfig, seed: number): GameSession {
  const sessionId = ++nextSessionId;
  let run = 0;
  let eventNumber = 0;
  let randomState = seed >>> 0 || 1;
  let phase: GamePhase = 'ready';
  let pauseReason: PauseReason | null = null;
  let score = 0;
  let simTime = 0;
  let paddle: PaddlePoint = { ...INITIAL_PADDLE };
  let ball: { phase: BallPhase; position: Point3; from: Point3; plan: ReturnPlan } | null = null;
  let servePending = false;
  const runId = (): string => `session-${sessionId}-run-${run}`;
  const random = (): number => {
    randomState ^= randomState << 13;
    randomState ^= randomState >>> 17;
    randomState ^= randomState << 5;
    return (randomState >>> 0) / 4294967296;
  };
  const makePlan = (departAt: number, from: Point3, target: PaddlePoint, landingZ: number): ReturnPlan => {
    const duration = 2 * Math.max(config.minimumVisibleSeconds, config.normalVisibleSeconds);
    return { ballId: 1, departAt, netCrossAt: departAt + duration * Math.abs(from.z) / Math.abs(landingZ - from.z), arriveAt: departAt + duration, target, smash: false, warningAt: null, speedMultiplier: 1, landingZ, bounceY: config.tableY + config.ballRadius };
  };
  const snapshot = (): GameSnapshot => ({
    runId: runId(), phase, pauseReason, score, simTime, paddle: { ...paddle },
    balls: ball ? [{ id: 1, phase: ball.phase, position: { ...ball.position }, smash: false }] : [],
    progression: { appliedMilestones: [], ballGlowUntil: null },
    scheduledReturns: ball?.phase === 'incoming' ? [{ ...ball.plan, target: { ...ball.plan.target } }] : [],
  });
  return {
    snapshot,
    start() {
      if (phase !== 'ready') return;
      phase = 'running';
      const from = { x: 0, y: 0.5, z: -config.paddleZ };
      ball = { phase: 'incoming', from, position: from, plan: makePlan(0, from, INITIAL_PADDLE, config.paddleZ) };
      servePending = true;
    },
    step(dt, input) {
      if (phase !== 'running' || !ball) return { snapshot: snapshot(), events: [] };
      if (!Number.isFinite(dt) || dt <= 0 || dt > config.fixedDt + 1e-12) throw new RangeError('Use a positive fixed simulation step.');
      const events: GameEvent[] = [];
      const emit = (kind: GameEventKind, time: number): void => {
        events.push({ id: `${runId()}:${++eventNumber}`, runId: runId(), kind, time, ballId: 1 });
      };
      if (servePending) { emit('opponent-hit', simTime); servePending = false; }
      const end = simTime + dt;
      const previousPaddle = paddle;
      const target = clampPaddle(input.target, config);
      const distance = Math.hypot(target.x - paddle.x, target.y - paddle.y);
      const fraction = distance > 0 ? Math.min(1, config.paddleSpeed * dt / distance) : 0;
      paddle = { x: paddle.x + (target.x - paddle.x) * fraction, y: paddle.y + (target.y - paddle.y) * fraction };
      const nextPosition = sampleReturn(ball.plan, ball.from, end);
      if (ball.phase === 'incoming') {
        const hit = sweepPaddleHit(ball.position, nextPosition, previousPaddle, paddle, config);
        if (hit !== null) {
          const time = simTime + hit * dt;
          const from = {
            x: ball.position.x + (nextPosition.x - ball.position.x) * hit,
            y: ball.position.y + (nextPosition.y - ball.position.y) * hit,
            z: ball.position.z + (nextPosition.z - ball.position.z) * hit,
          };
          score++;
          emit('player-hit', time);
          // Phase is the per-flight contact lock; outgoing balls never score.
          ball.phase = 'outgoing';
          ball.from = from;
          ball.plan = makePlan(time, from, { x: 0, y: 0.5 }, -config.paddleZ);
          ball.position = sampleReturn(ball.plan, from, end);
        } else if (nextPosition.z > config.paddleZ + config.ballRadius) {
          const fractionLost = (config.paddleZ + config.ballRadius - ball.position.z) / (nextPosition.z - ball.position.z);
          const time = simTime + Math.max(0, fractionLost) * dt;
          ball.phase = 'lost';
          ball.position = nextPosition;
          phase = 'gameover';
          emit('ball-lost', time);
          emit('game-over', time);
        } else ball.position = nextPosition;
      } else if (ball.phase === 'outgoing' && end >= ball.plan.arriveAt) {
        const time = ball.plan.arriveAt;
        const from = sampleReturn(ball.plan, ball.from, time);
        ball.phase = 'incoming';
        ball.from = from;
        const target = { x: (random() * 2 - 1) * 0.75, y: 0.25 + random() * 0.5 };
        ball.plan = makePlan(time, from, target, config.paddleZ);
        ball.position = sampleReturn(ball.plan, from, end);
        emit('opponent-hit', time);
      } else ball.position = nextPosition;
      simTime = end;
      return { snapshot: snapshot(), events };
    },
    pause(reason) { if (phase === 'running') { phase = 'paused'; pauseReason = reason; } },
    resume() { if (phase === 'paused') { phase = 'running'; pauseReason = null; } },
    reset(nextSeed) {
      run++;
      eventNumber = 0;
      randomState = nextSeed >>> 0 || 1;
      phase = 'ready'; pauseReason = null; score = 0; simTime = 0;
      paddle = { ...INITIAL_PADDLE }; ball = null; servePending = false;
    },
  };
}
