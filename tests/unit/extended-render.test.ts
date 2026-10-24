import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/game/config';
import { resolvePresentation, applyPresentation } from '../../src/render/presentation';
import { createObjects } from '../../src/render/objects';
import { createFireworks, PARTICLE_LIMIT } from '../../src/render/particles';
import { sampleRandomMotion } from '../../src/render/rainbow';
import { scenario } from '../helpers/scenarios';
import type { GameEvent } from '../../src/game/types';

describe('後半の発光表示', () => {
  it('460から足、480から相手の球を再表示し、490から相手の輪郭を消す', () => {
    const view = (score:number) => {
      const s=scenario(score); const base=s.snapshot();
      return resolvePresentation({...base,balls:[{id:999,phase:'incoming',smash:true,position:{x:0,y:.5,z:-1}}]});
    };
    expect(view(459).parts.structure.rainbow).toBe(false);
    expect(view(460).parts.structure.rainbow).toBe(true);
    expect(view(479).balls[999]!.visible).toBe(false);
    expect(view(480).balls[999]).toEqual({visible:true,rainbow:true});
    expect(view(489).opponentField).toBe(false);
    const last=view(490); expect(last.opponentField).toBe(true);
    for (const id of ['opponentCourtRight','opponentCourtLeft','opponentRacketBody','opponentRacketEdge','opponentBody','opponentFloor','opponentWall'] as const) expect(last.parts[id].visible).toBe(false);
    expect(last.opponentEdgesVisible).toBe(false); expect(last.parts.net.visible).toBe(true);
    expect(view(499).opponentRandom).toBe(false); expect(view(500).opponentRandom).toBe(true);
    expect(view(509).ownRandom).toBe(false); expect(view(510).ownRandom).toBe(true);
  });
  it('連続模様は同じ材質・画面座標を使い、乱数演出は停止・再描画で変わらない', () => {
    const objects=createObjects(DEFAULT_CONFIG), s=scenario(510).snapshot();
    applyPresentation(objects,s);
    expect(objects.opponentField.root.visible).toBe(true);
    expect(objects.opponentField.surfaces[0]!.material).toBe(objects.opponentField.surfaces[1]!.material);
    const before=JSON.stringify(objects.opponentField.material.uniforms);
    applyPresentation(objects,{...s,phase:'paused'});
    expect(JSON.stringify(objects.opponentField.material.uniforms)).toBe(before);
    applyPresentation(objects,{...s,runId:'another-run'});
    expect(JSON.stringify(objects.opponentField.material.uniforms)).not.toBe(before);
    expect(sampleRandomMotion(2,7)).toEqual(sampleRandomMotion(2,7));
    expect(sampleRandomMotion(2,7)).not.toEqual(sampleRandomMotion(3,7));
    const values=objects.parts.selfFloor.children.length; expect(values).toBe(0);
    objects.dispose();
  });
});

describe('再利用する虹色花火', () => {
  const event=(id:number,time=20):GameEvent=>({id:`e${id}`,runId:'test',kind:'player-hit',time,position:{x:.2,y:.5,z:1.95},effect:'racket-firework'});
  const snapshot=(time=20)=>({...scenario(530,time).snapshot(),runId:'test'});
  it('イベント重複・停止・古い音と同じ実行IDを判別し、0.7秒で消す',()=>{
    const f=createFireworks(); const s=snapshot(); f.update(s,[event(1)],'standard');
    expect(f.active()).toBe(24); const first=Array.from(f.geometry.attributes.position!.array);
    f.update({...s,phase:'paused'},[event(1)],'standard');
    expect(f.active()).toBe(24); expect(Array.from(f.geometry.attributes.position!.array)).toEqual(first);
    f.update(snapshot(20.71),[event(1)],'standard'); expect(f.active()).toBe(0);
    f.update(snapshot(21),[{...event(2,21),runId:'old'}],'standard'); expect(f.active()).toBe(0);
    f.dispose(); f.dispose();
  });
  it('大量の返球とバウンドでも上限固定、低品質は半数、終了・リトライで消去',()=>{
    const f=createFireworks(); f.update(snapshot(),[event(1)],'low'); expect(f.active()).toBe(12);
    f.update(snapshot(),Array.from({length:200},(_,i)=>event(i+2)),'standard'); expect(f.active()).toBe(PARTICLE_LIMIT);
    f.update({...snapshot(),phase:'gameover'},[],'standard'); expect(f.active()).toBe(0);
    f.update({...snapshot(),runId:'new'},[event(900)],'standard'); expect(f.active()).toBe(0);
    f.dispose();
  });
});
