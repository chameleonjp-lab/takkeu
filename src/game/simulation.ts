import { clampPaddle, DIFFICULTY, INITIAL_PADDLE } from './config';
import { paddleExitFraction, sweepPaddleHit } from './collision';
import { speedMultiplier } from './difficulty';
import { advanceProgression } from './progression';
import { scheduleReturn } from './scheduler';
import { bounceTime, sampleReturn } from './trajectory';
import { planOpponentReturn } from './opponent';
import type { BallPhase, GameConfig, GameEvent, GameEventKind, GamePhase, GameSnapshot, InputFrame, PaddlePoint, PauseReason, Point3, ProgressionState, ReturnPlan, StepResult } from './types';

export type SimulationBall = {
  id: number; phase: BallPhase; position: Point3; from: Point3; plan: ReturnPlan; warningSent: boolean;
};
export type SimulationState = {
  runId: string; randomState: number; eventNumber: number; phase: GamePhase; pauseReason: PauseReason | null;
  committedSmashDepartures: number[]; score: number; simTime: number; paddle: PaddlePoint; balls: SimulationBall[]; progression: ProgressionState;
};
let nextRunId = 0;
export function createSimulationState(seed: number): SimulationState {
  return {
    runId: `run-${++nextRunId}`, randomState: seed >>> 0 || 1, eventNumber: 0,
    phase: 'ready', pauseReason: null, committedSmashDepartures: [], score: 0, simTime: 0, paddle: { ...INITIAL_PADDLE }, balls: [],
    progression: { appliedMilestones: [], ballGlowUntil: null },
  };
}
function random(state: SimulationState): number {
  state.randomState ^= state.randomState << 13;
  state.randomState ^= state.randomState >>> 17;
  state.randomState ^= state.randomState << 5;
  return (state.randomState >>> 0) / 4294967296;
}
function reservations(state: SimulationState): ReturnPlan[] {
  return state.balls.filter(b => b.phase === 'queued' || b.phase === 'waiting-return' || b.phase === 'incoming')
    .map(b => b.plan).sort((a, b) => a.arriveAt - b.arriveAt || a.ballId - b.ballId);
}
export function snapshotSimulation(state: SimulationState): GameSnapshot {
  return {
    runId: state.runId, phase: state.phase, pauseReason: state.pauseReason, score: state.score, simTime: state.simTime,
    paddle: { ...state.paddle },
    balls: state.balls.map(b => ({ id: b.id, phase: b.phase, position: { ...b.position }, smash: b.plan.smash })),
    progression: { appliedMilestones: [...state.progression.appliedMilestones], ballGlowUntil: state.progression.ballGlowUntil },
    scheduledReturns: reservations(state).map(p => ({ ...p, target: { ...p.target } })),
  };
}
export function startSimulation(state: SimulationState, config: GameConfig): void {
  if (state.phase !== 'ready') return;
  state.phase = 'running';
  const from = { x: 0, y: 0.5, z: -config.paddleZ };
  state.balls.push({ id: 1, phase: 'queued', from, position: from, warningSent: false,
    plan: scheduleReturn({ ballId: 1, earliestDepartAt: 0, preferredTarget: INITIAL_PADDLE, speedMultiplier: 1, smash: false }, [], config) });
}

type Action = { kind: 'hit' | 'lost' | 'ready' | 'warning' | 'depart'; time: number; ball: SimulationBall; position?: Point3 };

/** Domain state only: neither rendering nor sound can feed back into the simulation. */
export function stepSimulation(state: SimulationState, config: GameConfig, dt: number, input: InputFrame): StepResult {
  if (state.phase !== 'running') return { snapshot: snapshotSimulation(state), events: [] };
  if (!Number.isFinite(dt) || dt <= 0 || dt > config.fixedDt + 1e-12) throw new RangeError('Use a positive fixed simulation step.');
  const events: GameEvent[] = [];
  const emit = (kind: GameEventKind, time: number, ballId?: number, milestone?: number): void => {
    events.push({ id: `${state.runId}:${++state.eventNumber}`, runId: state.runId, kind, time,
      ...(ballId === undefined ? {} : { ballId }), ...(milestone === undefined ? {} : { milestone }) });
  };
  const end = state.simTime + dt;
  state.committedSmashDepartures = state.committedSmashDepartures.filter(time => time >= state.simTime - DIFFICULTY.smashSeparation);
  const previousPaddle = state.paddle;
  const target = clampPaddle(input.target, config);
  const distance = Math.hypot(target.x - previousPaddle.x, target.y - previousPaddle.y);
  const fraction = distance > 0 ? Math.min(1, config.paddleSpeed * dt / distance) : 0;
  state.paddle = { x: previousPaddle.x + (target.x - previousPaddle.x) * fraction, y: previousPaddle.y + (target.y - previousPaddle.y) * fraction };
  const actions: Action[] = [];
  const enqueueDeparture = (ball: SimulationBall): void => {
    if (!ball.warningSent && ball.plan.warningAt !== null && ball.plan.warningAt <= end + 1e-12) actions.push({ kind: 'warning', time: ball.plan.warningAt, ball });
    if (ball.plan.departAt <= end + 1e-12) actions.push({ kind: 'depart', time: ball.plan.departAt, ball });
  };
  for (const ball of state.balls) {
    if (ball.phase === 'queued' || ball.phase === 'waiting-return') { enqueueDeparture(ball); continue; }
    if (ball.phase === 'lost') continue;
    if (ball.phase === 'outgoing') {
      if (ball.plan.arriveAt <= end + 1e-12) actions.push({ kind: 'ready', time: ball.plan.arriveAt, ball });
      continue;
    }
    const nextPosition = sampleReturn(ball.plan, ball.from, end);
    const lostFraction = paddleExitFraction(ball.position, nextPosition, config);
    const contactStart = Math.max(state.simTime, bounceTime(ball.plan));
    const contactEnd = state.simTime + (lostFraction ?? 1) * dt;
    let hit: number | null = null;
    if (contactStart <= contactEnd + 1e-12) {
      const first = Math.min(1, (contactStart - state.simTime) / dt);
      const last = (contactEnd - state.simTime) / dt;
      const paddleAt = (t: number): PaddlePoint => ({ x: previousPaddle.x + (state.paddle.x - previousPaddle.x) * t, y: previousPaddle.y + (state.paddle.y - previousPaddle.y) * t });
      const fraction = sweepPaddleHit(sampleReturn(ball.plan, ball.from, contactStart), sampleReturn(ball.plan, ball.from, contactEnd), paddleAt(first), paddleAt(last), config);
      if (fraction !== null) hit = first + (last - first) * fraction;
    }
    if (hit !== null) {
      const time = state.simTime + hit * dt;
      actions.push({ kind: 'hit', time, ball, position: sampleReturn(ball.plan, ball.from, time) });
    } else if (lostFraction !== null) {
      actions.push({ kind: 'lost', time: state.simTime + lostFraction * dt, ball });
    }
  }
  while (actions.length) {
    actions.sort((a, b) => a.time - b.time || a.ball.id - b.ball.id || (a.kind === 'hit' ? -1 : 1));
    const { kind, time, ball, position } = actions.shift()!;
    if (kind === 'hit') {
      state.score++;
      emit('player-hit', time, ball.id);
      ball.phase = 'outgoing';
      ball.from = position!;
      // Outgoing flights are generated to reach the opponent without a second contact.
      const duration = 2 * Math.max(config.minimumVisibleSeconds, config.normalVisibleSeconds);
      ball.plan = { ballId: ball.id, departAt: time, netCrossAt: time + duration / 2, arriveAt: time + duration,
        target: { x: 0, y: 0.5 }, smash: false, warningAt: null, speedMultiplier: 1,
        landingZ: -config.paddleZ, bounceY: config.tableY + config.ballRadius };
      const update = advanceProgression(state.progression, state.score - 1, state.score, time);
      state.progression = update.state;
      for (const milestone of update.crossed) emit('milestone', time, undefined, milestone);
      for (let added = 0; added < update.addedBalls && state.balls.length < config.maxBalls; added++) {
        const id = Math.max(0, ...state.balls.map(b => b.id)) + 1;
        const from = { x: 0, y: 0.5, z: -config.paddleZ };
        const plan = scheduleReturn({ ballId: id, earliestDepartAt: time, earliestArriveAt: time + DIFFICULTY.addedBallDelay,
          preferredTarget: { x: (random(state) * 2 - 1) * 0.75, y: 0.25 + random(state) * 0.5 },
          speedMultiplier: speedMultiplier(state.score), smash: false }, reservations(state), config);
        const extra: SimulationBall = { id, phase: 'queued', from, position: from, plan, warningSent: false };
        state.balls.push(extra); enqueueDeparture(extra);
      }
    } else if (kind === 'lost') {
      ball.phase = 'lost'; emit('ball-lost', time, ball.id);
    } else if (kind === 'ready') {
      ball.from = sampleReturn(ball.plan, ball.from, time);
      ball.position = ball.from;
      // Process ready actions in chronological order; this preserves waiting order.
      ball.plan = planOpponentReturn({ ballId: ball.id, earliestDepartAt: time,
        preferredTarget: { x: (random(state) * 2 - 1) * 0.75, y: 0.25 + random(state) * 0.5 },
        speedMultiplier: speedMultiplier(state.score), score: state.score, randomValue: random(state) }, reservations(state), state.committedSmashDepartures, config);
      if (ball.plan.smash) state.committedSmashDepartures.push(ball.plan.departAt);
      ball.warningSent = false; ball.phase = 'waiting-return'; enqueueDeparture(ball);
    } else if (kind === 'warning') {
      ball.warningSent = true; emit('smash-warning', time, ball.id);
    } else {
      ball.phase = 'incoming'; emit('opponent-hit', time, ball.id);
    }
  }
  for (const ball of state.balls) {
    if (ball.phase === 'incoming' || ball.phase === 'outgoing') ball.position = sampleReturn(ball.plan, ball.from, end);
  }
  if (state.balls.length && state.balls.every(b => b.phase === 'lost')) {
    state.phase = 'gameover';
    emit('game-over', events.at(-1)?.time ?? end);
  }
  state.simTime = end;
  return { snapshot: snapshotSimulation(state), events };
}
