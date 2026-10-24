import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, INITIAL_PADDLE } from '../../src/game/config';
import { paddleExitFraction } from '../../src/game/collision';
import { flightDuration, remainingBallMultiplier, speedMultiplier } from '../../src/game/difficulty';
import { refreshFlightSpeeds } from '../../src/game/flightSpeed';
import { retimeFlight } from '../../src/game/flightSpeed';
import { scheduleReturn } from '../../src/game/scheduler';
import { createSession } from '../../src/game/session';
import { stepSimulation } from '../../src/game/simulation';
import { sampleReturn } from '../../src/game/trajectory';
import type { GameEvent, InputFrame } from '../../src/game/types';
import { incoming } from '../helpers/scenarios';
import { measureFlight, missPaddle, remainingScenario, waitingBall } from '../helpers/remainingBall';

describe('残球数による実際の飛行時間', () => {
  for (const score of [0, 99, 100, 101, 450, 499, 500, 501, 539, 540, 555]) {
    it.each([[1, 1.2], [2, 1], [3, 1], [4, 1], [5, 1], [8, 1]])(`${score}ラリー・%i球`, (count, multiplier) => {
      const baseline = measureFlight(score, 5), flight = measureFlight(score, count);
      const ratio = score < 100 ? 1 : multiplier;
      expect(baseline.duration / flight.duration).toBeCloseTo(ratio, 8);
      expect(baseline.visible / flight.visible).toBeCloseTo(ratio, 8);
      expect(flight.departed).toBeLessThan(flight.net); expect(flight.net).toBeLessThan(flight.arrived);
    });
  }
  it('基本飛行時間の下限を確定してから独立した1.2倍を適用する', () => {
    const config = { ...DEFAULT_CONFIG, minimumVisibleSeconds: 0.7 };
    const normal = scheduleReturn({ ballId: 1, score: 501, smash: false, speedMultiplier: speedMultiplier(501),
      earliestDepartAt: 20, preferredTarget: INITIAL_PADDLE, remainingBallMultiplier: 1.2 }, [], config);
    expect(flightDuration(config, 501, false)).toBeCloseTo(1.4, 8);
    expect(normal.arriveAt - normal.departAt).toBeCloseTo(1.1666666666666667, 8);
    expect(measureFlight(540, 5).duration / measureFlight(540, 1).duration).toBeCloseTo(1.2, 8);
    expect(measureFlight(540, 1).duration).toBeLessThan(measureFlight(539, 1).duration);
  });
  it.each([0, 1, 98, 99])('%iラリーでは残球数による加速をしない', score => {
    for (const count of [1, 2, 3, 4, 5, 8]) expect(remainingBallMultiplier(score, count)).toBe(1);
  });
  it.each([NaN, Infinity, -Infinity, -1, 99.5, 100.5, 499.5, 500.5])('不正なラリー数%sでは安全な等倍へ戻す', score => {
    for (const count of [1, 2, 3, 4, 5]) expect(remainingBallMultiplier(score, count)).toBe(1);
  });
  it.each([NaN, Infinity, -Infinity, -1, 0, 1.5, 2.5, 3.5, 4.5])('不正な残球数%sでは安全な等倍へ戻す', count => {
    expect(remainingBallMultiplier(500, count)).toBe(1);
  });
  it('最後の球を失った後は新たな相手打球を発生させない', () => {
    const s = remainingScenario(500, 1); s.state.balls[0]!.phase = 'lost';
    const result = s.step(missPaddle);
    expect(result.snapshot.phase).toBe('gameover'); expect(result.snapshot.balls).toHaveLength(0);
    expect(result.events.map(e => e.kind)).toEqual(['game-over']);
    expect(s.step(missPaddle).events).toEqual([]);
  });
});

describe('相手の打球時に固定する倍率', () => {
  it.each([[5, 4, 1], [4, 3, 1], [2, 1, 1.2]])('予約後の%i→%i球を実打球時に%s倍として確定する', (before, after, multiplier) => {
    const s = remainingScenario(501, before, 20.05);
    s.step(missPaddle);
    expect(s.state.balls[0]!.plan.remainingBallMultiplier).toBe(1);
    for (const ball of s.state.balls.slice(after)) ball.phase = 'lost';
    for (let tick = 0; tick < 120 && s.state.balls[0]!.phase !== 'incoming'; tick++) s.step(missPaddle);
    const plan = s.state.balls[0]!.plan;
    expect(s.state.balls).toHaveLength(after); expect(s.state.balls[0]!.phase).toBe('incoming');
    expect(plan.remainingBallMultiplier).toBe(multiplier);
    expect(plan.arriveAt - plan.departAt).toBeCloseTo(flightDuration(DEFAULT_CONFIG, 501, true) / multiplier, 8);
  });
  it.each([[5, 4, 1], [4, 3, 1], [2, 1, 1]])('打球後の%i→%i球は既に飛行中の%s倍を変えない', (before, after, multiplier) => {
    const s = remainingScenario(501, before); s.step(missPaddle);
    const ball = s.state.balls[0]!, committed = structuredClone(ball.plan);
    expect(committed.remainingBallMultiplier).toBe(multiplier);
    for (const other of s.state.balls.slice(after)) other.phase = 'lost';
    s.step(missPaddle);
    expect(s.state.balls).toHaveLength(after); expect(ball.plan).toEqual(committed);
  });
  it('待機中の1→2球を実打球時に再評価して追加倍率なしで発射する', () => {
    const s = remainingScenario(501, 1, 20.05); s.step(missPaddle);
    s.state.balls.push(waitingBall(2, 501, 1000));
    for (let tick = 0; tick < 120 && s.state.balls[0]!.phase !== 'incoming'; tick++) s.step(missPaddle);
    expect(s.state.balls[0]!.phase).toBe('incoming');
    expect(s.state.balls[0]!.plan.remainingBallMultiplier).toBe(1);
    expect(s.state.balls[0]!.plan.arriveAt - s.state.balls[0]!.plan.departAt)
      .toBeCloseTo(flightDuration(DEFAULT_CONFIG, 501, true), 8);
  });
  it.each([499, 500, 501, 540, 555])('飛行中の1→2球の増球では確定倍率を維持する（%i）', score => {
    const s = remainingScenario(score, 1); s.step(missPaddle);
    const ball = s.state.balls[0]!, committed = structuredClone(ball.plan);
    expect(committed.remainingBallMultiplier).toBe(score < 100 ? 1 : 1.2);
    s.state.balls.push(waitingBall(2, score, 1000)); s.step(missPaddle);
    expect(s.state.balls).toHaveLength(2); expect(ball.plan).toEqual(committed);
  });
  it.each([500, 501, 540, 555])('予約衝突で延期した球も実打球時の2→1球を再判定する（%i）', score => {
    const s = remainingScenario(score, 2), reserved = waitingBall(2, score);
    reserved.phase = 'incoming';
    reserved.plan = scheduleReturn({ ballId: 2, score, speedMultiplier: speedMultiplier(score), smash: score >= 450,
      earliestDepartAt: 20 - (score >= 450 ? 0.4 : 0), preferredTarget: { x: 0.5, y: 0.6 }, remainingBallMultiplier: 1 }, [], DEFAULT_CONFIG);
    reserved.position = sampleReturn(reserved.plan, reserved.from, 20); s.state.balls[1] = reserved;
    // A real queue already respects existing reservations before stroke time.
    s.state.balls[0]!.plan = scheduleReturn({ ballId: 1, score, speedMultiplier: speedMultiplier(score),
      smash: true, earliestDepartAt: 19.6, preferredTarget: { x: 0.5, y: 0.6 } }, [reserved.plan], DEFAULT_CONFIG);
    const first = s.step(missPaddle), ball = s.state.balls[0]!;
    expect(first.events.some(e => e.kind === 'opponent-hit' && e.ballId === 1)).toBe(false);
    expect(ball.phase).toBe('waiting-return'); expect(ball.plan.remainingBallMultiplier).toBe(1);
    expect(ball.plan.departAt).toBeGreaterThan(s.state.simTime);
    expect(ball.plan.arriveAt - reserved.plan.arriveAt).toBeGreaterThanOrEqual(0.12 - 1e-10);
    reserved.phase = 'lost';
    const events: GameEvent[] = [];
    for (let tick = 0; tick < 120 && ball.phase !== 'incoming'; tick++) events.push(...s.step(missPaddle).events);
    expect(ball.phase).toBe('incoming'); expect(s.state.balls).toHaveLength(1);
    expect(ball.plan.remainingBallMultiplier).toBe(1.2);
    expect(ball.plan.arriveAt - ball.plan.departAt).toBeCloseTo(flightDuration(DEFAULT_CONFIG, score, score >= 450) / 1.2, 8);
    if (score >= 450) expect(events.find(e => e.kind === 'opponent-hit' && e.ballId === 1)!.time - ball.warningEmittedAt!)
      .toBeGreaterThanOrEqual(0.4 - 1e-10);
  });
  it.each([[1, 2, 1], [2, 1, 1.2]])('同時刻の打球ID%i・失球ID%iは球ID順の生存数で%s倍となる', (departingId, lostId, multiplier) => {
    const s = remainingScenario(501, 0);
    s.state.balls = [waitingBall(departingId, 501),
      { ...incoming(lostId, 19, missPaddle), position: { x: 0.5, y: -5, z: 5 } }];
    const result = s.step(missPaddle);
    const ordered = result.events.filter(e => e.kind === 'opponent-hit' || e.kind === 'ball-lost');
    expect(ordered.map(e => e.ballId)).toEqual([1, 2]);
    expect(ordered.map(e => e.time)).toEqual([20, 20]);
    expect(s.state.balls[0]!.plan.remainingBallMultiplier).toBe(multiplier);
  });
  it('同時刻のバウンドを球IDより先に処理してから打球・失球をID順に処理する', () => {
    const s = remainingScenario(501, 0);
    s.state.balls = [waitingBall(1, 501),
      { ...incoming(2, 19, missPaddle), position: { x: 0.5, y: -5, z: 5 } },
      incoming(99, 20.35, { x: 0.6, y: 0.6 }, 20, 1.25)];
    const result = s.step(missPaddle);
    expect(result.events.map(e => [e.kind, e.ballId, e.time])).toEqual([
      ['table-bounce', 99, 20], ['opponent-hit', 1, 20], ['ball-lost', 2, 20],
    ]);
    expect(s.state.balls[0]!.plan.remainingBallMultiplier).toBe(1);
  });
  it('同時刻の99→100と失球では生存2球で等倍打球する', () => {
    const s = remainingScenario(99, 0);
    s.state.balls = [waitingBall(3, 99), incoming(1, 20),
      { ...incoming(2, 19, missPaddle), position: { x: 0.5, y: -5, z: 5 } }];
    const result = s.step(), plan = s.state.balls[0]!.plan;
    expect(result.events.map(e => [e.kind, e.ballId, e.time])).toEqual([
      ['player-hit', 1, 20], ['milestone', undefined, 20], ['ball-lost', 2, 20], ['opponent-hit', 3, 20],
    ]);
    expect(s.state.score).toBe(100); expect(s.state.balls).toHaveLength(2);
    expect(plan.remainingBallMultiplier).toBe(1);
    expect(plan.arriveAt - plan.departAt).toBeCloseTo(flightDuration(DEFAULT_CONFIG, 100, false), 8);
  });
  it('同一tickで99→100になっても残球数による追加加速をしない', () => {
    const s = remainingScenario(99, 2, 20.004);
    s.state.balls.push(incoming(3, 20.002));
    const result = s.step();
    expect(s.state.score).toBe(100); expect(s.state.balls).toHaveLength(3);
    const plan = s.state.balls[0]!.plan;
    expect(result.events.some(e => e.kind === 'opponent-hit' && e.ballId === 1)).toBe(true);
    expect(plan.arriveAt - plan.departAt).toBeCloseTo(flightDuration(DEFAULT_CONFIG, 100, false), 8);
    // Two live balls remain neutral at the new 100 threshold.
    const t = remainingScenario(99, 1, 20.004); t.state.balls.push(incoming(2, 20.002)); t.step();
    expect(t.state.balls).toHaveLength(2);
    const accelerated = t.state.balls[0]!.plan;
    expect(accelerated.arriveAt - accelerated.departAt).toBeCloseTo(flightDuration(DEFAULT_CONFIG, 100, false), 8);
  });
  it('499→500と増球が同じtickなら追加された待機球も数えて等倍で打球する', () => {
    const s = remainingScenario(499, 1, 20.004);
    s.state.balls.push(incoming(2, 20.002));
    const result = s.step();
    expect(s.state.score).toBe(500); expect(s.state.balls).toHaveLength(5);
    expect(result.events.some(e => e.kind === 'opponent-hit' && e.ballId === 1)).toBe(true);
    expect(s.state.balls[0]!.plan.remainingBallMultiplier).toBe(1);
    expect(s.state.balls[0]!.plan.arriveAt - s.state.balls[0]!.plan.departAt)
      .toBeCloseTo(flightDuration(DEFAULT_CONFIG, 500, true), 8);
  });
  it('同一tickで打球後に起きた失球はその飛行へ遡及しない', () => {
    const s = remainingScenario(501, 2, 20.001);
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
    expect(plan.arriveAt - plan.departAt).toBeCloseTo(flightDuration(DEFAULT_CONFIG, 501, true), 8);
  });
  it('異なる固定倍率の飛行球も539→540で到着間隔と位置を保つ', () => {
    const request = (ballId: number, bonus: number, smash: boolean) => ({ ballId, remainingBallMultiplier: bonus,
      score: 539, speedMultiplier: speedMultiplier(539), smash, earliestDepartAt: 20, preferredTarget: { x: 0.4, y: 0.6 } });
    const a = scheduleReturn(request(1, 1, false), [], DEFAULT_CONFIG);
    const b = scheduleReturn(request(2, 1, true), [a], DEFAULT_CONFIG);
    const c = scheduleReturn(request(3, 1.2, true), [a, b], DEFAULT_CONFIG);
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
    const s = remainingScenario(500, 6);
    s.state.balls[1]!.phase = 'lost';
    s.state.balls[2] = incoming(3, 22, { x: 0.6, y: 0.6 });
    const out = incoming(4, 22);
    s.state.balls[3] = { ...out, phase: 'outgoing', from: { x: 0, y: 0.5, z: 1.95 }, plan: { ...out.plan, landingZ: -1.95 } };
    s.state.balls[4]!.phase = 'queued';
    s.step(missPaddle);
    const plan = s.state.balls[0]!.plan;
    expect(plan.arriveAt - plan.departAt).toBeCloseTo(flightDuration(DEFAULT_CONFIG, 500, true), 8);
    expect(s.state.balls).toHaveLength(5);
  });
  it.each(['queued', 'waiting-return', 'outgoing', 'incoming', 'lost'] as const)('2球目が%sなら実打球時の生存数へ正しく反映する', phase => {
    const s = remainingScenario(500, 2);
    if (phase === 'incoming' || phase === 'outgoing') {
      const other = incoming(2, 22, { x: 0.6, y: 0.6 });
      s.state.balls[1] = phase === 'incoming' ? other : {
        ...other, phase, from: { x: 0, y: 0.5, z: 1.95 }, plan: { ...other.plan, landingZ: -1.95 },
      };
    } else s.state.balls[1]!.phase = phase;
    const result = s.step(missPaddle), plan = s.state.balls[0]!.plan;
    const multiplier = phase === 'lost' ? 1.2 : 1;
    expect(result.events.some(e => e.kind === 'opponent-hit' && e.ballId === 1)).toBe(true);
    expect(plan.remainingBallMultiplier).toBe(multiplier);
    expect(plan.arriveAt - plan.departAt).toBeCloseTo(flightDuration(DEFAULT_CONFIG, 500, true) / multiplier, 8);
    expect(s.state.balls).toHaveLength(phase === 'lost' ? 1 : 2);
    if (phase !== 'lost') expect(s.state.balls[1]!.phase).toBe(phase);
  });
  it('打球後の失球では確定速度を変えず、次の相手打球は増球後の生存数で判定する', () => {
    const s = remainingScenario(500, 3, 20.02);
    s.state.balls[2] = { ...incoming(3, 19, missPaddle), position: { x: 0.5, y: -5, z: 5 } };
    s.step(missPaddle); expect(s.state.balls).toHaveLength(2);
    while (s.state.balls[0]!.phase !== 'incoming') s.step(missPaddle);
    const ball = s.state.balls[0]!, committed = structuredClone(ball.plan);
    expect(committed.arriveAt - committed.departAt).toBeCloseTo(flightDuration(DEFAULT_CONFIG, 500, true), 8);
    s.state.balls[1] = { ...incoming(2, 19, missPaddle), position: { x: 0.5, y: -5, z: 5 } };
    const next = s.step(missPaddle);
    expect(next.events.some(e => e.kind === 'ball-lost')).toBe(true);
    expect(s.state.balls).toHaveLength(1); expect(ball.plan).toEqual(committed);
    for (let tick = 0; tick < 500; tick++) {
      const result = s.step(ball.phase === 'incoming' ? ball.plan.target : INITIAL_PADDLE);
      if (result.events.some(e => e.kind === 'opponent-hit' && e.ballId === 1)) {
        expect(ball.plan.remainingBallMultiplier).toBe(1);
        expect(s.state.balls.length).toBeGreaterThan(1);
        expect(ball.plan.arriveAt - ball.plan.departAt).toBeCloseTo(flightDuration(DEFAULT_CONFIG, s.state.score, true), 8);
        return;
      }
    }
    throw new Error('Next opponent stroke did not finish');
  });
  it('同一tick内で打球前に失われた球を数えない', () => {
    const s = remainingScenario(501, 2, 20.004);
    s.state.balls[1] = { ...incoming(2, 19, missPaddle), position: { x: 0.5, y: -5, z: 5 } };
    const result = s.step(missPaddle), plan = s.state.balls[0]!.plan;
    expect(result.events.findIndex(e => e.kind === 'ball-lost')).toBeLessThan(result.events.findIndex(e => e.kind === 'opponent-hit'));
    expect(plan.arriveAt - plan.departAt).toBeCloseTo(flightDuration(DEFAULT_CONFIG, 501, true) / 1.2, 8);
  });
  it('返球予定時点の3球から待機中に1球へ減れば1.2倍で出発する', () => {
    const s = remainingScenario(500, 3, 20.1);
    s.step(missPaddle);
    s.state.balls[1]!.phase = 'lost'; s.state.balls[2]!.phase = 'lost';
    while (s.state.balls[0]!.phase !== 'incoming') s.step(missPaddle);
    const plan = s.state.balls[0]!.plan;
    expect(plan.arriveAt - plan.departAt).toBeCloseTo(flightDuration(DEFAULT_CONFIG, 500, true) / 1.2, 8);
  });
  it.each([499, 500, 501, 539, 540, 555])('重なる3球の予定を調停し予告と飛行中の予約を守る（%i）', score => {
    const s = remainingScenario(score, 3);
    s.state.balls = [];
    // Model three simultaneous requests through the real queue builder. With
    // no bonus for three balls, departure need not repair invalid fixture plans.
    for (const id of [1, 2, 3]) {
      const ball = waitingBall(id, score);
      ball.plan = scheduleReturn({ ballId: id, score, speedMultiplier: speedMultiplier(score), smash: true,
        earliestDepartAt: 19.6, preferredTarget: ball.plan.target }, s.state.balls.map(b => b.plan), DEFAULT_CONFIG);
      if (ball.plan.warningAt !== null) ball.warningEmittedAt = ball.plan.warningAt;
      s.state.balls.push(ball);
    }
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
          expect(ball.plan.arriveAt - ball.plan.departAt).toBeCloseTo(flightDuration(DEFAULT_CONFIG, score, score >= 450), 8);
          if (score >= 450) expect(event.time - ball.warningEmittedAt!).toBeGreaterThanOrEqual(0.4 - 1e-10);
        }
      }
      if (hits.length === 3) break;
    }
    expect(hits).toHaveLength(3);
    const plans = [...committed.values()].sort((a, b) => a.arriveAt - b.arriveAt);
    for (let i = 1; i < plans.length; i++) expect(plans[i]!.arriveAt - plans[i - 1]!.arriveAt).toBeGreaterThanOrEqual(0.12 - 1e-10);
  });
  it.each([[100, 101], [499, 500], [500, 501], [539, 540], [554, 555], [555, 556]])('全球加速%s→%sでも位置・軌道・独立倍率を保持する', (before, after) => {
    const s = remainingScenario(before, 1);
    if (before >= 555) s.state.balls[0]!.plan = { ...s.state.balls[0]!.plan, bounceX: 0.92 };
    s.step(missPaddle);
    for (let i = 0; i < 5; i++) s.step(missPaddle);
    const ball = s.state.balls[0]!, old = structuredClone(ball.plan), at = s.state.simTime;
    const point = sampleReturn(old, ball.from, at);
    s.state.score = after; refreshFlightSpeeds(s.state, before, at, DEFAULT_CONFIG);
    expect(ball.plan.arriveAt - ball.plan.departAt).toBeCloseTo(flightDuration(DEFAULT_CONFIG, after, old.smash) / (before < 100 ? 1 : 1.2), 8);
    expect(ball.plan.bounceX).toBe(old.bounceX);
    const next = sampleReturn(ball.plan, ball.from, at);
    for (const axis of ['x', 'y', 'z'] as const) expect(next[axis]).toBeCloseTo(point[axis], 10);
    refreshFlightSpeeds(s.state, before, at, DEFAULT_CONFIG);
    expect(ball.plan.arriveAt - ball.plan.departAt).toBeCloseTo(flightDuration(DEFAULT_CONFIG, after, old.smash) / (before < 100 ? 1 : 1.2), 8);
  });
  it.each([499, 500, 501, 539, 540, 555])('プレイヤーの返球には追加倍率を持ち越さず、次の相手打球では再判定する（%i）', score => {
    const s = remainingScenario(score, 1); s.step(missPaddle);
    let hit = false;
    for (let i = 0; i < 500; i++) {
      const ball = s.state.balls[0]!;
      const result = s.step(ball.phase === 'incoming' ? ball.plan.target : INITIAL_PADDLE);
      if (result.events.some(e => e.kind === 'player-hit' && e.ballId === 1)) {
        const duration = ball.plan.arriveAt - ball.plan.departAt;
        expect(duration).toBeCloseTo(flightDuration(DEFAULT_CONFIG, s.state.score, false), 8);
        expect(ball.plan.remainingBallMultiplier ?? 1).toBe(1);
        if (score >= 555) expect(ball.plan.bounceX).toBeDefined();
        // Every hit here adds three queued balls through progression.
        expect(s.state.balls).toHaveLength(4); hit = true;
      } else if (hit && result.events.some(e => e.kind === 'opponent-hit' && e.ballId === 1)) {
        expect(ball.plan.arriveAt - ball.plan.departAt).toBeCloseTo(flightDuration(DEFAULT_CONFIG, s.state.score, score >= 450), 8);
        if (score >= 555) expect(ball.plan.bounceX).toBeDefined();
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
    expect(ball.plan.arriveAt - ball.plan.departAt).toBeCloseTo(flightDuration(DEFAULT_CONFIG, 540, true) / 1.2, 8);
    const session = createSession(DEFAULT_CONFIG, 7); session.start(); session.pause('user'); session.resume(); session.reset(7); session.start();
    const plan = session.snapshot().scheduledReturns[0]!;
    expect(plan.arriveAt - plan.departAt).toBe(2); expect(plan.speedMultiplier).toBe(speedMultiplier(0));
  });
  it('500→502の増球と新残球倍率も同じ時刻付き入力なら30/60/120Hzで一致する', () => {
    const baseline = remainingScenario(500, 1), input: InputFrame[] = [], expected: GameEvent[] = [];
    const bonuses = new Set<number>();
    for (let tick = 0; tick < 120 * 4; tick++) {
      const target = baseline.snapshot().scheduledReturns[0]?.target ?? baseline.state.paddle;
      const frame: InputFrame = { target, samples: [{ at: baseline.state.simTime + 0.004, target, kind: 'move' }] };
      input.push(frame);
      const result = stepSimulation(baseline.state, DEFAULT_CONFIG, DEFAULT_CONFIG.fixedDt, frame);
      expected.push(...result.events);
      for (const event of result.events.filter(e => e.kind === 'opponent-hit')) {
        bonuses.add(baseline.state.balls.find(b => b.id === event.ballId)!.plan.remainingBallMultiplier!);
      }
    }
    expect(baseline.state.score).toBeGreaterThanOrEqual(502);
    expect(baseline.state.balls).toHaveLength(1 + 3 * (baseline.state.score - 500));
    expect([...bonuses].sort()).toEqual([1, 1.2]);
    const comparable = (s: ReturnType<typeof remainingScenario>) => {
      const { runId: _, ...snapshot } = s.snapshot(); return snapshot;
    };
    const eventData = (events: GameEvent[]) => events.map(({ id: _, runId: __, ...event }) => event);
    for (const hz of [30, 60, 120]) {
      const s = remainingScenario(500, 1), events: GameEvent[] = []; let ticks = 0;
      for (let frame = 1; frame <= hz * 4; frame++) {
        while ((ticks + 1) * DEFAULT_CONFIG.fixedDt <= frame / hz + 1e-10) {
          events.push(...stepSimulation(s.state, DEFAULT_CONFIG, DEFAULT_CONFIG.fixedDt, input[ticks++]!).events);
        }
      }
      expect(comparable(s)).toEqual(comparable(baseline));
      expect(eventData(events)).toEqual(eventData(expected));
      expect(s.state.randomState).toBe(baseline.state.randomState);
    }
  });
});
