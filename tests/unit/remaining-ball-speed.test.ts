import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, INITIAL_PADDLE } from '../../src/game/config';
import { paddleExitFraction } from '../../src/game/collision';
import { flightDuration, speedMultiplier } from '../../src/game/difficulty';
import { refreshFlightSpeeds } from '../../src/game/flightSpeed';
import { retimeFlight } from '../../src/game/flightSpeed';
import { scheduleReturn } from '../../src/game/scheduler';
import { createSession } from '../../src/game/session';
import { stepSimulation } from '../../src/game/simulation';
import { sampleReturn } from '../../src/game/trajectory';
import { incoming } from '../helpers/scenarios';
import { measureFlight, missPaddle, remainingScenario, waitingBall } from '../helpers/remainingBall';

describe('残球数による実際の飛行時間', () => {
  for (const score of [99, 100, 101, 450, 539, 540, 555]) {
    it.each([[1, 2], [2, 1.5], [3, 1.25], [4, 1], [8, 1]])(`${score}ラリー・%i球`, (count, multiplier) => {
      const baseline = measureFlight(score, 4), flight = measureFlight(score, count);
      const ratio = score < 100 ? 1 : multiplier;
      expect(baseline.duration / flight.duration).toBeCloseTo(ratio, 8);
      expect(baseline.visible / flight.visible).toBeCloseTo(ratio, 8);
    });
  }
  it('既存の最短時間へ達しても追加2倍が実速度へ反映される', () => {
    const config = { ...DEFAULT_CONFIG, minimumVisibleSeconds: 0.7 };
    expect(measureFlight(101, 4, config).duration).toBeCloseTo(1.4, 8);
    expect(measureFlight(101, 1, config).duration).toBeCloseTo(0.7, 8);
    expect(measureFlight(540, 4).duration / measureFlight(540, 1).duration).toBeCloseTo(2, 8);
    expect(measureFlight(540, 1).duration).toBeLessThan(measureFlight(539, 1).duration);
  });
});

describe('相手の打球時に固定する倍率', () => {
  it('同一tickで99→100になれば増球も含む現在の生存数で追加加速する', () => {
    const s = remainingScenario(99, 2, 20.004);
    s.state.balls.push(incoming(3, 20.002));
    const result = s.step();
    expect(s.state.score).toBe(100); expect(s.state.balls).toHaveLength(4);
    const plan = s.state.balls[0]!.plan;
    expect(result.events.some(e => e.kind === 'opponent-hit' && e.ballId === 1)).toBe(true);
    expect(plan.arriveAt - plan.departAt).toBeCloseTo(flightDuration(DEFAULT_CONFIG, 100, false), 8);
    // Three alive including the new ball instead gives exactly 1.25, at 100.
    const t = remainingScenario(99, 1, 20.004); t.state.balls.push(incoming(2, 20.002)); t.step();
    expect(t.state.balls).toHaveLength(3);
    const accelerated = t.state.balls[0]!.plan;
    expect(accelerated.arriveAt - accelerated.departAt).toBeCloseTo(flightDuration(DEFAULT_CONFIG, 100, false) / 1.25, 8);
  });
  it('同一tickで打球後に起きた失球はその飛行へ遡及しない', () => {
    const s = remainingScenario(101, 2, 20.001);
    const lost = incoming(2, 20, { x: 0.6, y: 0.6 });
    // Locate this real trajectory's exit, then put it 4ms into the tested tick.
    for (let time = 20; time < 22; time += DEFAULT_CONFIG.fixedDt) {
      const fraction = paddleExitFraction(sampleReturn(lost.plan, lost.from, time), sampleReturn(lost.plan, lost.from, time + DEFAULT_CONFIG.fixedDt), DEFAULT_CONFIG);
      if (fraction === null) continue;
      const shift = 20.004 - (time + fraction * DEFAULT_CONFIG.fixedDt);
      lost.plan = { ...lost.plan, departAt: lost.plan.departAt + shift, netCrossAt: lost.plan.netCrossAt + shift, arriveAt: lost.plan.arriveAt + shift };
      break;
    }
    lost.position = sampleReturn(lost.plan, lost.from, 20); s.state.balls[1] = lost;
    const result = s.step(missPaddle), hit = result.events.find(e => e.kind === 'opponent-hit')!, loss = result.events.find(e => e.kind === 'ball-lost')!;
    expect(hit).toBeDefined(); expect(loss).toBeDefined(); expect(loss.time).toBeGreaterThan(hit.time);
    const plan = s.state.balls[0]!.plan;
    expect(plan.arriveAt - plan.departAt).toBeCloseTo(flightDuration(DEFAULT_CONFIG, 101, false) / 1.5, 8);
  });
  it('異なる固定倍率の飛行球も539→540で到着間隔と位置を保つ', () => {
    const request = (ballId: number, bonus: number, smash: boolean) => ({ ballId, remainingBallMultiplier: bonus,
      score: 539, speedMultiplier: speedMultiplier(539), smash, earliestDepartAt: 20, preferredTarget: { x: 0.4, y: 0.6 } });
    const a = scheduleReturn(request(1, 1, false), [], DEFAULT_CONFIG);
    const b = scheduleReturn(request(2, 1.5, true), [a], DEFAULT_CONFIG);
    const c = scheduleReturn(request(3, 2, true), [a, b], DEFAULT_CONFIG);
    const at = Math.max(a.departAt, b.departAt, c.departAt) + 0.001;
    const next = [a, b, c].map(p => retimeFlight(p, at, 539, 540, DEFAULT_CONFIG)).sort((x, y) => x.arriveAt - y.arriveAt);
    for (let i = 1; i < next.length; i++) expect(next[i]!.arriveAt - next[i - 1]!.arriveAt).toBeGreaterThanOrEqual(0.12 - 1e-10);
    for (const plan of [a, b, c]) {
      const updated = next.find(p => p.ballId === plan.ballId)!, from = { x: 0.5, y: 0.6, z: -1.95 };
      expect(updated.remainingBallMultiplier).toBe(plan.remainingBallMultiplier);
      const before = sampleReturn(plan, from, at), after = sampleReturn(updated, from, at);
      for (const axis of ['x', 'y', 'z'] as const) expect(after[axis]).toBeCloseTo(before[axis], 10);
    }
  });
  it('待機・queued・outgoing・incomingは数え、lostだけを除く', () => {
    const s = remainingScenario(101, 5);
    s.state.balls[1]!.phase = 'lost';
    s.state.balls[2] = incoming(3, 22, { x: 0.6, y: 0.6 });
    const out = incoming(4, 22);
    s.state.balls[3] = { ...out, phase: 'outgoing', from: { x: 0, y: 0.5, z: 1.95 }, plan: { ...out.plan, landingZ: -1.95 } };
    s.step(missPaddle);
    const plan = s.state.balls[0]!.plan;
    expect(plan.arriveAt - plan.departAt).toBeCloseTo(flightDuration(DEFAULT_CONFIG, 101, false), 8);
    expect(s.state.balls).toHaveLength(4);
  });
  it('打球直前の失球を反映し、その直後の失球では飛行中の時間を変更しない', () => {
    const s = remainingScenario(101, 3, 20.02);
    s.state.balls[2] = { ...incoming(3, 19, missPaddle), position: { x: 0.5, y: -5, z: 5 } };
    s.step(missPaddle); expect(s.state.balls).toHaveLength(2);
    while (s.state.balls[0]!.phase !== 'incoming') s.step(missPaddle);
    const ball = s.state.balls[0]!, committed = structuredClone(ball.plan);
    expect(committed.arriveAt - committed.departAt).toBeCloseTo(flightDuration(DEFAULT_CONFIG, 101, false) / 1.5, 8);
    s.state.balls[1] = { ...incoming(2, 19, missPaddle), position: { x: 0.5, y: -5, z: 5 } };
    const next = s.step(missPaddle);
    expect(next.events.some(e => e.kind === 'ball-lost')).toBe(true);
    expect(s.state.balls).toHaveLength(1); expect(ball.plan).toEqual(committed);
  });
  it('同一tick内で打球前に失われた球を数えない', () => {
    const s = remainingScenario(101, 2, 20.004);
    s.state.balls[1] = { ...incoming(2, 19, missPaddle), position: { x: 0.5, y: -5, z: 5 } };
    const result = s.step(missPaddle), plan = s.state.balls[0]!.plan;
    expect(result.events.findIndex(e => e.kind === 'ball-lost')).toBeLessThan(result.events.findIndex(e => e.kind === 'opponent-hit'));
    expect(plan.arriveAt - plan.departAt).toBeCloseTo(flightDuration(DEFAULT_CONFIG, 101, false) / 2, 8);
  });
  it('返球予定時点の3球から待機中に1球へ減れば2倍で出発する', () => {
    const s = remainingScenario(100, 3, 20.1);
    s.step(missPaddle);
    s.state.balls[1]!.phase = 'lost'; s.state.balls[2]!.phase = 'lost';
    while (s.state.balls[0]!.phase !== 'incoming') s.step(missPaddle);
    const plan = s.state.balls[0]!.plan;
    expect(plan.arriveAt - plan.departAt).toBeCloseTo(flightDuration(DEFAULT_CONFIG, 100, false) / 2, 8);
  });
  it.each([101, 450, 539, 540, 555])('重なる3球の予定を調停し予告と飛行中の予約を守る（%i）', score => {
    const s = remainingScenario(score, 3);
    s.state.balls = [1, 2, 3].map(id => waitingBall(id, score));
    const committed = new Map<number, typeof s.state.balls[0]['plan']>();
    const hits: number[] = [];
    for (let i = 0; i < 180; i++) {
      const result = s.step(missPaddle);
      for (const [id, plan] of committed) {
        const ball = s.state.balls.find(b => b.id === id);
        if (ball?.phase === 'incoming') expect(ball.plan).toEqual(plan);
      }
      for (const event of result.events.filter(e => e.kind === 'opponent-hit')) {
        const ball = s.state.balls.find(b => b.id === event.ballId)!;
        if (hits.length < 3) {
          hits.push(event.time); committed.set(ball.id, structuredClone(ball.plan));
          expect(ball.plan.arriveAt - ball.plan.departAt).toBeCloseTo(flightDuration(DEFAULT_CONFIG, score, score >= 450) / 1.25, 8);
          if (score >= 450) expect(event.time - ball.warningEmittedAt!).toBeGreaterThanOrEqual(0.4 - 1e-10);
        }
      }
      if (hits.length === 3) break;
    }
    expect(hits).toHaveLength(3);
    const plans = [...committed.values()].sort((a, b) => a.arriveAt - b.arriveAt);
    for (let i = 1; i < plans.length; i++) expect(plans[i]!.arriveAt - plans[i - 1]!.arriveAt).toBeGreaterThanOrEqual(0.12 - 1e-10);
  });
  it.each([[100, 101], [539, 540], [554, 555]])('全球加速%s→%sでも位置・軌道・独立倍率を保持する', (before, after) => {
    const s = remainingScenario(before, 1); s.step(missPaddle);
    for (let i = 0; i < 5; i++) s.step(missPaddle);
    const ball = s.state.balls[0]!, old = structuredClone(ball.plan), at = s.state.simTime;
    const point = sampleReturn(old, ball.from, at);
    s.state.score = after; refreshFlightSpeeds(s.state, before, at, DEFAULT_CONFIG);
    expect(ball.plan.arriveAt - ball.plan.departAt).toBeCloseTo(flightDuration(DEFAULT_CONFIG, after, old.smash) / 2, 8);
    const next = sampleReturn(ball.plan, ball.from, at);
    for (const axis of ['x', 'y', 'z'] as const) expect(next[axis]).toBeCloseTo(point[axis], 10);
    refreshFlightSpeeds(s.state, before, at, DEFAULT_CONFIG);
    expect(ball.plan.arriveAt - ball.plan.departAt).toBeCloseTo(flightDuration(DEFAULT_CONFIG, after, old.smash) / 2, 8);
  });
  it('プレイヤーの返球には追加倍率を持ち越さず、次の相手打球では再判定する', () => {
    const s = remainingScenario(101, 1); s.step(missPaddle);
    let hit = false;
    for (let i = 0; i < 500; i++) {
      const ball = s.state.balls[0]!;
      const result = s.step(ball.phase === 'incoming' ? ball.plan.target : INITIAL_PADDLE);
      if (result.events.some(e => e.kind === 'player-hit')) {
        const duration = ball.plan.arriveAt - ball.plan.departAt;
        expect(duration).toBeCloseTo(flightDuration(DEFAULT_CONFIG, s.state.score, false), 8);
        s.state.balls.push(waitingBall(2, s.state.score, 1000)); hit = true;
      } else if (hit && result.events.some(e => e.kind === 'opponent-hit' && e.ballId === 1)) {
        expect(ball.plan.arriveAt - ball.plan.departAt).toBeCloseTo(flightDuration(DEFAULT_CONFIG, s.state.score, false) / 1.5, 8);
        return;
      }
    }
    throw new Error('Return cycle did not finish');
  });
  it('停止・再開は確定速度を維持しリトライは初速へ戻る', () => {
    const s = remainingScenario(540, 1); s.step(missPaddle);
    s.state.phase = 'paused'; const before = s.snapshot();
    expect(stepSimulation(s.state, DEFAULT_CONFIG, DEFAULT_CONFIG.fixedDt, { target: missPaddle }).snapshot).toEqual(before);
    s.state.phase = 'running'; s.step(missPaddle);
    const ball = s.state.balls[0]!;
    expect(ball.plan.arriveAt - ball.plan.departAt).toBeCloseTo(flightDuration(DEFAULT_CONFIG, 540, true) / 2, 8);
    const session = createSession(DEFAULT_CONFIG, 7); session.start(); session.pause('user'); session.resume(); session.reset(7); session.start();
    const plan = session.snapshot().scheduledReturns[0]!;
    expect(plan.arriveAt - plan.departAt).toBe(2); expect(plan.speedMultiplier).toBe(speedMultiplier(0));
  });
});
