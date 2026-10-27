import { clampPaddle, CLEAR_SCORE, DIFFICULTY, INITIAL_PADDLE, MAX_LOST_BALLS } from './config';
import { paddleExitFraction, sweepPaddleHit } from './collision';
import { flightDuration, remainingBallMultiplier, speedMultiplier } from './difficulty';
import { refreshFlightSpeeds } from './flightSpeed';
import { chooseOpponentTarget, choosePlayerTarget, randomUnit } from './targets';
import { advanceProgression } from './progression';
import { MAX_BALLS } from './milestones';
import { scheduleReturn } from './scheduler';
import { bounceTime, deflectBounce, sampleReturn } from './trajectory';
import { planOpponentReturn } from './opponent';
import { createCelebrations, lossCelebration, rallyCelebration } from './celebrations';
import type { CelebrationState } from './celebrations';
import type { BallPhase, GameConfig, GameEvent, GameEventKind, GamePhase, GameSnapshot, InputFrame, PaddlePoint, PauseReason, Point3, ProgressionState, ReturnPlan, StepResult } from './types';

export type SimulationBall = {
  id: number; phase: BallPhase; position: Point3; from: Point3; plan: ReturnPlan; warningSent: boolean;
  warningEmittedAt?: number; bounceEmitted?: boolean;
};
export type SimulationState = {
  celebrations: CelebrationState;
  runId: string; nextBallId: number; randomState: number; eventNumber: number; phase: GamePhase; pauseReason: PauseReason | null;
  endReason: 'clear' | 'loss' | null;
  committedSmashDepartures: number[]; score: number; simTime: number; lostBallCount: number; paddle: PaddlePoint; opponentPaddle: PaddlePoint; balls: SimulationBall[]; progression: ProgressionState;
};
let nextRunId = 0;
export function createSimulationState(seed: number): SimulationState {
  return {
    celebrations: createCelebrations(),
    runId: `run-${++nextRunId}`, nextBallId: 2, randomState: seed >>> 0 || 1, eventNumber: 0,
    phase: 'ready', pauseReason: null, endReason: null, committedSmashDepartures: [], score: 0, simTime: 0, lostBallCount: 0, paddle: { ...INITIAL_PADDLE }, balls: [],
    opponentPaddle: { ...INITIAL_PADDLE }, progression: { appliedMilestones: [], ballGlowUntil: null, awardedBallCount: 0 },
  };
}
function reservations(state: SimulationState): ReturnPlan[] {
  return state.balls.filter(b => b.phase === 'queued' || b.phase === 'waiting-return' || b.phase === 'incoming')
    .map(b => b.plan).sort((a, b) => a.arriveAt - b.arriveAt || a.ballId - b.ballId);
}
export function snapshotSimulation(state: SimulationState): GameSnapshot {
  return {
    celebrations: { ...state.celebrations, numberNotices: state.celebrations.numberNotices.map(n => ({ ...n })) },
    runId: state.runId, phase: state.phase, pauseReason: state.pauseReason, endReason: state.endReason, score: state.score, simTime: state.simTime, lostBallCount: state.lostBallCount,
    paddle: { ...state.paddle }, opponentPaddle: { ...state.opponentPaddle },
    balls: state.balls.map(b => ({ id: b.id, phase: b.phase, position: { ...b.position }, smash: b.plan.smash })),
    progression: { ...state.progression, appliedMilestones: [...state.progression.appliedMilestones] },
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

type Action = { kind: 'bounce' | 'hit' | 'lost' | 'ready' | 'warning' | 'depart'; time: number; ball: SimulationBall; position?: Point3; paddleFraction?: number };

/** Advance an uncommitted part of a fixed tick, including zero-time input paths. */
function advanceSegment(state: SimulationState, config: GameConfig, dt: number, target: PaddlePoint, deferEndContact = false): StepResult {
  const events: GameEvent[] = [];
  const emit = (kind: GameEventKind, time: number, ballId?: number, milestone?: number, position?: Point3, effect?: GameEvent['effect'], contact?: Pick<GameEvent, 'smashReturn' | 'rallyScore' | 'lossCount'>): void => {
    events.push({ id: `${state.runId}:${++state.eventNumber}`, runId: state.runId, kind, time,
      ...(ballId === undefined ? {} : { ballId }), ...(milestone === undefined ? {} : { milestone }),
      ...(position ? { position: { ...position } } : {}), ...(effect ? { effect } : {}), ...contact });
  };
  const end = state.simTime + dt;
  let stoppedAt: number | undefined;
  const previousPaddle = state.paddle;
  state.paddle = clampPaddle(target, config);
  const actions: Action[] = [];
  const enqueueDeparture = (ball: SimulationBall): void => {
    if (!ball.warningSent && ball.plan.warningAt !== null && ball.plan.warningAt <= end + 1e-12) actions.push({ kind: 'warning', time: ball.plan.warningAt, ball });
    if (ball.plan.departAt <= end + 1e-12) actions.push({ kind: 'depart', time: ball.plan.departAt, ball });
  };
  for (const ball of state.balls) {
    if (ball.phase === 'queued' || ball.phase === 'waiting-return') { enqueueDeparture(ball); continue; }
    if (ball.phase === 'lost') continue;
    const bounce = bounceTime(ball.plan);
    if (!ball.bounceEmitted && bounce >= state.simTime - 1e-12 && bounce <= end + 1e-12) {
      actions.push({ kind: 'bounce', time: bounce, ball, position: sampleReturn(ball.plan, ball.from, bounce) });
    }
    if (ball.phase === 'outgoing') {
      if (ball.plan.arriveAt <= end + 1e-12) actions.push({ kind: 'ready', time: ball.plan.arriveAt, ball });
      continue;
    }
    const nextPosition = sampleReturn(ball.plan, ball.from, end);
    const lostFraction = paddleExitFraction(ball.position, nextPosition, config);
    const contactStart = Math.max(state.simTime, bounceTime(ball.plan));
    const contactEnd = state.simTime + (lostFraction ?? 1) * dt;
    let hit: number | null = null;
    if (lostFraction !== 0 && contactStart <= contactEnd + 1e-12) {
      const first = dt > 0 ? Math.min(1, (contactStart - state.simTime) / dt) : 0;
      const last = dt > 0 ? (contactEnd - state.simTime) / dt : 1;
      const paddleAt = (t: number): PaddlePoint => ({ x: previousPaddle.x + (state.paddle.x - previousPaddle.x) * t, y: previousPaddle.y + (state.paddle.y - previousPaddle.y) * t });
      const fraction = sweepPaddleHit(sampleReturn(ball.plan, ball.from, contactStart), sampleReturn(ball.plan, ball.from, contactEnd), paddleAt(first), paddleAt(last), config);
      if (fraction !== null) hit = first + (last - first) * fraction;
    }
    if (hit !== null && !(deferEndContact && hit >= 1 - 1e-10)) {
      const time = state.simTime + hit * dt;
      actions.push({ kind: 'hit', time, ball, position: sampleReturn(ball.plan, ball.from, time), paddleFraction: hit });
    } else if (hit === null && lostFraction !== null && !(deferEndContact && lostFraction >= 1 - 1e-10)) {
      actions.push({ kind: 'lost', time: state.simTime + lostFraction * dt, ball });
    }
  }
  while (actions.length) {
    actions.sort((a, b) => a.time - b.time || Number(b.kind === 'bounce') - Number(a.kind === 'bounce') || a.ball.id - b.ball.id);
    const { kind, time, ball, position, paddleFraction } = actions.shift()!;
    if (kind === 'bounce') {
      ball.bounceEmitted = true;
      emit('table-bounce', time, ball.id, undefined, position, ball.phase === 'incoming' && state.score >= 530 ? 'bounce-firework' : undefined);
    } else if (kind === 'hit') {
      const smashReturn = ball.plan.smash;
      state.score++;
      state.celebrations = rallyCelebration(state.celebrations, state.score, time);
      const at = paddleFraction!;
      const centre = { x: previousPaddle.x + (state.paddle.x - previousPaddle.x) * at,
        y: previousPaddle.y + (state.paddle.y - previousPaddle.y) * at, z: config.paddleZ };
      emit('player-hit', time, ball.id, undefined, centre, state.score >= 520 ? 'racket-firework' : undefined, { smashReturn, rallyScore: state.score });
      ball.phase = 'outgoing';
      ball.from = position!;
      // Outgoing flights are generated to reach the opponent without a second contact.
      const duration = flightDuration(config, state.score, false);
      ball.plan = { ballId: ball.id, departAt: time, netCrossAt: time + duration / 2, arriveAt: time + duration,
        target: chooseOpponentTarget(state, config), smash: false, warningAt: null, speedMultiplier: speedMultiplier(state.score), speedScore: state.score,
        landingZ: -config.paddleZ, bounceY: config.tableY + config.ballRadius };
      ball.bounceEmitted = false;
      if (state.score >= 555) ball.plan = deflectBounce(ball.plan, ball.from, randomUnit(state), config);
      const update = advanceProgression(state.progression, state.score - 1, state.score, time);
      state.progression = update.state;
      for (const milestone of update.crossed) emit('milestone', time, undefined, milestone);
      const slots = Math.max(0, MAX_BALLS - state.balls.filter(b => b.phase !== 'lost').length);
      for (let added = 0; added < Math.min(update.addedBalls, slots); added++) {
        const id = state.balls.reduce((next, ball) => Math.max(next, ball.id + 1), state.nextBallId);
        state.nextBallId = id + 1;
        const from = { ...chooseOpponentTarget(state, config), z: -config.paddleZ };
        let plan = planOpponentReturn({ ballId: id, earliestDepartAt: time + DIFFICULTY.addedBallDelay,
          preferredTarget: choosePlayerTarget(state, config, from), speedMultiplier: speedMultiplier(state.score), score: state.score,
          randomValue: randomUnit(state) }, reservations(state), state.committedSmashDepartures, config);
        if (state.score >= 555) plan = deflectBounce(plan, from, randomUnit(state), config);
        const extra: SimulationBall = { id, phase: 'queued', from, position: from, plan, warningSent: false };
        state.balls.push(extra); enqueueDeparture(extra);
      }
      if (state.score === CLEAR_SCORE) {
        state.phase = 'gameover'; state.endReason = 'clear'; stoppedAt = time;
        emit('game-clear', time); break;
      }
    } else if (kind === 'lost') {
      ball.phase = 'lost';
      emit('ball-lost', time, ball.id, undefined, sampleReturn(ball.plan, ball.from, time), undefined, { lossCount: state.lostBallCount + 1 });
      state.lostBallCount++;
      state.celebrations = lossCelebration(state.celebrations, state.lostBallCount, time);
      if (state.lostBallCount >= MAX_LOST_BALLS) {
        state.phase = 'gameover'; state.endReason = 'loss'; stoppedAt = time;
        emit('game-over', time); break;
      }
    } else if (kind === 'ready') {
      ball.from = sampleReturn(ball.plan, ball.from, time);
      ball.position = ball.from;
      // Process ready actions in chronological order; this preserves waiting order.
      ball.plan = planOpponentReturn({ ballId: ball.id, earliestDepartAt: time,
        preferredTarget: choosePlayerTarget(state, config, ball.from),
        speedMultiplier: speedMultiplier(state.score), score: state.score, randomValue: randomUnit(state) }, reservations(state), state.committedSmashDepartures, config);
      if (ball.plan.smash) state.committedSmashDepartures.push(ball.plan.departAt);
      if (state.score >= 555) ball.plan = deflectBounce(ball.plan, ball.from, randomUnit(state), config);
      ball.warningSent = false; delete ball.warningEmittedAt; ball.bounceEmitted = false;
      ball.phase = 'waiting-return'; enqueueDeparture(ball);
    } else if (kind === 'warning') {
      if (!ball.warningSent) { ball.warningSent = true; ball.warningEmittedAt = time; emit('smash-warning', time, ball.id); }
    } else {
      // A different ball may cross 450 earlier in this same fixed step.
      if (state.score >= 450 && !ball.plan.smash) {
        ball.plan = planOpponentReturn({ ballId: ball.id, earliestDepartAt: time, preferredTarget: ball.plan.target,
          speedMultiplier: speedMultiplier(state.score), score: state.score, randomValue: 0 }, reservations(state).filter(p => p.ballId !== ball.id), [], config);
        ball.warningSent = false; delete ball.warningEmittedAt; enqueueDeparture(ball); continue;
      }
      // Waiting reservations are provisional: losses, added balls or a hit in
      // this tick may have changed the bonus since the plan was queued. Commit
      // using the live count at the actual stroke, without moving flying balls.
      const previous = ball.plan;
      const bonus = remainingBallMultiplier(state.score, state.balls.filter(b => b.phase !== 'lost').length);
      if ((previous.remainingBallMultiplier ?? 1) !== bonus) {
        ball.plan = scheduleReturn({ ballId: ball.id, earliestDepartAt: time - (previous.smash ? DIFFICULTY.smashWarning : 0),
          preferredTarget: previous.target, speedMultiplier: previous.speedMultiplier, score: previous.speedScore ?? state.score, smash: previous.smash,
          remainingBallMultiplier: bonus }, reservations(state).filter(p => p.ballId !== ball.id), config);
        if (previous.bounceX !== undefined) ball.plan = { ...ball.plan, bounceX: previous.bounceX };
        if (ball.warningEmittedAt !== undefined) ball.plan = { ...ball.plan, warningAt: ball.warningEmittedAt };
        if (ball.plan.departAt > time + 1e-12) { enqueueDeparture(ball); continue; }
      }
      state.opponentPaddle = { x: ball.from.x, y: ball.from.y };
      ball.phase = 'incoming'; emit('opponent-hit', time, ball.id);
    }
  }
  for (const ball of state.balls) {
    if (ball.phase === 'incoming' || ball.phase === 'outgoing') ball.position = sampleReturn(ball.plan, ball.from, stoppedAt ?? end);
  }
  if (state.phase === 'running' && state.balls.length && state.balls.every(b => b.phase === 'lost')) {
    state.phase = 'gameover'; state.endReason = 'loss';
    emit('game-over', events.at(-1)?.time ?? end);
  }
  // The loss event is sufficient history. Do not retain every lost ball forever.
  state.balls = state.balls.filter(ball => ball.phase !== 'lost');
  state.simTime = end;
  return { snapshot: snapshotSimulation(state), events };
}

/**
 * Inputs split only this uncommitted tick. A move starts at its timestamp and
 * reaches its target at the next input or tick end; a place has no swept path.
 * At an input boundary: prior events, bounce, ordered input, overlap, then loss.
 * Speed/flight reservations still refresh once at the original fixed boundary.
 */
export function stepSimulation(state: SimulationState, config: GameConfig, dt: number, input: InputFrame): StepResult {
  if (state.phase !== 'running') return { snapshot: snapshotSimulation(state), events: [] };
  if (!Number.isFinite(dt) || dt <= 0 || dt > config.fixedDt + 1e-12) throw new RangeError('Use a positive fixed simulation step.');
  const start = state.simTime, end = start + dt, oldScore = state.score;
  const validPoint = (point: PaddlePoint): boolean => Number.isFinite(point.x) && Number.isFinite(point.y);
  state.committedSmashDepartures = state.committedSmashDepartures.filter(time => time >= start - DIFFICULTY.smashSeparation);
  const samples = (input.samples ?? []).filter(s => Number.isFinite(s.at) && validPoint(s.target) && s.at >= start - 1e-10 && s.at <= end + 1e-10)
    .map(s => ({ ...s, at: Math.max(start, Math.min(end, s.at)) })).sort((a, b) => a.at - b.at);
  // A bare frame is a move known at the tick start (used by domain clients).
  let target = input.samples ? state.paddle : validPoint(input.target) ? clampPaddle(input.target, config) : state.paddle;
  let moving = !input.samples;
  const events: GameEvent[] = [];
  const advance = (until: number, defer = false): void => {
    if (state.phase !== 'running') return;
    events.push(...advanceSegment(state, config, Math.max(0, until - state.simTime), target, defer).events);
    moving = false;
  };
  for (const sample of samples) {
    // A same-time move still has a real path. Never collapse it into release.
    if (sample.at > state.simTime || moving) advance(sample.at, sample.at > state.simTime);
    if (state.phase !== 'running') break;
    if (sample.kind === 'place') {
      state.paddle = clampPaddle(sample.target, config);
      target = state.paddle;
      advance(sample.at);
    } else if (sample.kind === 'release') {
      // Prior accepted move has already completed; release cannot invent a path.
      target = state.paddle;
      // Settle its endpoint before a subsequent same-time recontact can place
      // elsewhere. Bounce has already been processed by the preceding segment.
      advance(sample.at);
    } else {
      target = clampPaddle(sample.target, config); moving = true;
    }
  }
  if (state.phase === 'running') advance(end);
  // Even game-over inside a tick commits that fixed interval, as before.
  state.simTime = end;
  if (state.phase === 'running') refreshFlightSpeeds(state, oldScore, end, config);
  return { snapshot: snapshotSimulation(state), events };
}
