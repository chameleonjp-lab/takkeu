import { expect, it } from 'vitest';
import * as tones from '../../src/audio/tones';
import { createAudio } from '../../src/audio/audio';
import { DEFAULT_CONFIG } from '../../src/game/config';
import { layeredAudioContext } from '../helpers/audioContext';
import type { GameEvent } from '../../src/game/types';
const hit = (score: number, smashReturn = false, id = String(score)): GameEvent => ({ kind: 'player-hit', id, runId: 'run', time: score, ballId: 1, rallyScore: score, smashReturn });

it('player layers include kick, distortion, noise and delayed arpeggio; buffers/curve are reused', () => {
  const t = layeredAudioContext();
  const a = tones.playPlayerHit(t.context, t.context.destination);
  expect(t.sources.length).toBeGreaterThanOrEqual(7);
  expect(t.sources.length).toBeLessThanOrEqual(10);
  expect(t.nodes.some(n => n.kind === 'shaper')).toBe(true);
  expect(t.sources.some(s => s.kind === 'buffer')).toBe(true);
  expect(t.sources.some(s => s.starts[0]! >= .012)).toBe(true);
  expect(t.sources[0]!.frequencies).toEqual([260, 55]);
  const first = t.sources.length;
  const b = tones.playPlayerHit(t.context, t.context.destination);
  expect(t.buffers[0]).toBe(t.buffers[1]); expect(t.curves[0]).toBe(t.curves[1]);
  a.disconnect(); b.disconnect();
  expect(t.nodes.every(n => n.disconnected)).toBe(true); expect(t.sources.length).toBe(first * 2);
});

it('音階と重なりは確定ラリー1/4/5/9/10/上限へ連動する', () => {
  expect([1,4,5,9,10,100000,NaN,-1].map(n => tones.audioStage(n))).toEqual([
    { semitones:0, accents:0 }, { semitones:0, accents:0 }, { semitones:2, accents:1 }, { semitones:2, accents:1 },
    { semitones:4, accents:2 }, { semitones:16, accents:2 }, { semitones:0, accents:0 }, { semitones:0, accents:0 },
  ]);
});

it('全音源の終了を待ち、複数stop/disconnect/古い完了でも通知は一度', () => {
  const t = layeredAudioContext(); let ended = 0;
  const voice = tones.playPlayerHit(t.context, t.context.destination, () => ended++);
  const late = t.sources.at(-1)!.ended!;
  t.finish(t.sources.length - 1); expect(ended).toBe(0);
  voice.stop(); voice.stop(); expect(t.nodes.some(n => !n.disconnected)).toBe(true);
  t.finishAll(); expect(ended).toBe(1); expect(t.nodes.every(n => n.disconnected)).toBe(true);
  voice.disconnect(); voice.disconnect(); late(); expect(ended).toBe(1);
});

it('mute/0/未解放/失敗中も確定scoreを失わず復帰時に古い音を再生しない', async () => {
  const t = layeredAudioContext(), audio = createAudio(DEFAULT_CONFIG, () => t.context);
  audio.reset('run'); audio.consume([hit(4)]); await audio.unlock();
  audio.setMuted(true); audio.consume([hit(5)]); audio.setMuted(false); audio.consume([hit(5)]);
  expect(t.sources).toHaveLength(0);
  audio.setVolume(0); audio.consume([hit(9)]); audio.setVolume(.65); audio.consume([hit(9)]);
  expect(t.sources).toHaveLength(0);
  audio.consume([hit(10)]); expect(t.sources).toHaveLength(9);
  const count = t.sources.length;
  audio.suspend(); audio.consume([hit(11)]); await audio.unlock(); audio.consume([hit(11), hit(12, false, 'new')]);
  expect(t.sources.length).toBe(count + 9);
  await audio.dispose(); expect(t.nodes.every(n => n.disconnected)).toBe(true);
});

it('予告された別球の通常接触・同球次往復を成功音と推測しない', async () => {
  const t = layeredAudioContext(), audio = createAudio(DEFAULT_CONFIG, () => t.context);
  audio.reset('run'); await audio.unlock();
  audio.consume([{ kind:'smash-warning', time:0, runId:'run', id:'warn', ballId:2 }]);
  let offset = t.sources.length;
  audio.consume([hit(1)]); expect(t.sources[offset]!.frequencies[0]).toBe(260);
  offset = t.sources.length;
  audio.consume([{ ...hit(2,true), ballId:2 }]); expect(t.sources[offset]!.frequencies[0]).toBe(300);
  offset = t.sources.length;
  audio.consume([{ ...hit(3), ballId:2 }]); expect(t.sources[offset]!.frequencies[0]).toBe(260);
  await audio.dispose();
});

it('91球の連続イベントでも8active+8fade以下、音源160以下、終了で全切断', async () => {
  const t = layeredAudioContext(), audio = createAudio(DEFAULT_CONFIG, () => t.context);
  audio.reset('run'); await audio.unlock();
  for (let i=1;i<=91;i++) {
    audio.consume([hit(i,true)]);
    expect(t.sources.filter(s => !s.record.disconnected).length).toBeLessThanOrEqual(160);
    expect(t.nodes.filter(s => s.kind==='shaper' && !s.disconnected).length).toBeLessThanOrEqual(16);
  }
  audio.setVolume(0); expect(t.sources.every(s => s.record.disconnected)).toBe(true);
  await audio.dispose(); expect(t.nodes.every(n => n.disconnected)).toBe(true);
});

it('低負荷では重要な4種類の音を保ち1voice5音源以下', () => {
  for (const fn of [tones.playPlayerHit, tones.playOpponentHit, tones.playSmashWarning, tones.playSmashSuccess]) {
    const t = layeredAudioContext(); const voice = fn(t.context, t.context.destination, undefined, { score:1000, quality:'low' });
    expect(t.sources.length).toBeGreaterThanOrEqual(3); expect(t.sources.length).toBeLessThanOrEqual(5);
    voice.disconnect(); expect(t.nodes.every(n => n.disconnected)).toBe(true);
  }
});

it('音源生成・接続・自動化・startの全途中段階で失敗しても作成済みnodeを残さない', () => {
  const successful = layeredAudioContext();
  tones.playSmashSuccess(successful.context, successful.context.destination, undefined, { score:10 }).disconnect();
  const operations = successful.operations();
  expect(operations).toBeGreaterThan(80);
  for (let offset=1;offset<=operations;offset++) {
    const t = layeredAudioContext(); t.failNext(offset);
    try { tones.playSmashSuccess(t.context, t.context.destination, undefined, { score:10 }).disconnect(); } catch { /* injected */ }
    expect(t.nodes.filter(n=>!n.disconnected), `fault ${offset}`).toHaveLength(0);
    expect(t.sources.every(s=>s.starts.length===0 || s.stops.length>0), `stopped ${offset}`).toBe(true);
  }
});

it('master構築・resumeの全途中失敗を回収して次のunlockで復旧する', async () => {
  const successful = layeredAudioContext(), first = createAudio(DEFAULT_CONFIG, ()=>successful.context);
  await first.unlock(); const operations=successful.operations(); await first.dispose();
  for (let offset=1;offset<=operations;offset++) {
    const t=layeredAudioContext(), audio=createAudio(DEFAULT_CONFIG,()=>t.context);
    t.failNext(offset); expect(await audio.unlock()).toBe(false);
    expect(t.nodes.every(n=>n.disconnected)).toBe(true);
    expect(await audio.unlock()).toBe(true); await audio.dispose();
    expect(t.nodes.every(n=>n.disconnected)).toBe(true);
  }
});

it('音声suspend/closeの同期例外でも停止・破棄を完了する', async () => {
  const t=layeredAudioContext(), audio=createAudio(DEFAULT_CONFIG,()=>t.context);
  audio.reset('run'); await audio.unlock(); audio.consume([hit(10,true)]);
  t.context.suspend=()=>{throw new Error('suspend sync');};
  t.context.close=()=>{throw new Error('close sync');};
  expect(()=>audio.suspend()).not.toThrow(); await expect(audio.dispose()).resolves.toBeUndefined();
  expect(t.nodes.every(n=>n.disconnected)).toBe(true);
});

it('標本化周波数に合わせた上限、装飾数と半音16の上限を維持', () => {
  for(const rate of [22050,44100,48000]) {
    const t=layeredAudioContext(rate);
    tones.playSmashSuccess(t.context,t.context.destination,undefined,{score:100000}).disconnect();
    expect(t.sources).toHaveLength(10);
    for(const source of t.sources) for(const value of source.frequencies) {
      expect(Number.isFinite(value)).toBe(true); expect(value).toBeGreaterThanOrEqual(25);
      expect(value).toBeLessThanOrEqual(Math.min(7000,rate*.18));
    }
  }
});

it('古いunlockと完了がreset/dispose後のrunや新contextへ干渉しない', async () => {
  const old=layeredAudioContext(), next=layeredAudioContext(); let count=0;
  const audio=createAudio(DEFAULT_CONFIG,()=>count++ ? next.context:old.context);
  audio.reset('run'); await audio.unlock(); audio.consume([hit(10,true)]);
  const callbacks=old.sources.map(s=>s.ended!);
  Object.assign(old.context,{state:'closed'}); audio.reset('new'); await audio.unlock();
  audio.consume([{...hit(1),runId:'new'}]); const live=next.nodes.filter(n=>!n.disconnected).length;
  callbacks.forEach(fn=>fn()); expect(next.nodes.filter(n=>!n.disconnected)).toHaveLength(live);
  expect(old.nodes.every(n=>n.disconnected)).toBe(true);
  await audio.dispose(); callbacks.forEach(fn=>fn()); expect(next.nodes.every(n=>n.disconnected)).toBe(true);
});

it('圧縮または歪みがない場合は多層を省略し保守的な単音へ落とす', async () => {
  for(const missing of ['createDynamicsCompressor','createWaveShaper'] as const) {
    const t=layeredAudioContext(); Object.assign(t.context,{[missing]:undefined});
    const audio=createAudio(DEFAULT_CONFIG,()=>t.context); audio.reset('run'); await audio.unlock(); audio.consume([hit(10,true)]);
    expect(t.sources).toHaveLength(1); expect(t.nodes.some(n=>n.kind==='shaper')).toBe(false);
    expect(t.sources[0]!.frequencies).toEqual([1500,800]);
    await audio.dispose(); expect(t.nodes.every(n=>n.disconnected)).toBe(true);
  }
});
