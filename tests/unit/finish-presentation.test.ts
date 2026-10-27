import { expect, it } from 'vitest';
import { createFinishPresentation } from '../../src/app/finishPresentation';
import { createCelebrations, lossCelebration, rallyCelebration } from '../../src/game/celebrations';
import { scenario } from '../helpers/scenarios';

it('ゲーム終了後は計算を止めたまま最後の数字まで表示し、結果を一度だけ確定する', () => {
  const finish=createFinishPresentation(),base=scenario(340,20).snapshot();
  const end={...base,phase:'gameover' as const,celebrations:lossCelebration(createCelebrations(),100,20)};
  expect(finish.frame(end,1000)).toMatchObject({finishing:true,snapshot:{simTime:20}});
  expect(finish.frame(end,2000)).toMatchObject({finishing:true,snapshot:{simTime:20},presentationTime:21});
  expect(end.simTime).toBe(20);expect(end.phase).toBe('gameover');
  expect(finish.frame(end,3000)).toMatchObject({finishing:false,snapshot:{simTime:20},presentationTime:22});
  expect(finish.frame(end,9000).presentationTime).toBe(22);
  const ready={...base,phase:'ready' as const,runId:'new',celebrations:createCelebrations()};
  expect(finish.frame(ready,10000)).toEqual({snapshot:ready,finishing:false,presentationTime:ready.simTime});
});

it('既存の5秒演出の残りだけを表示し、通常終了も電撃を見せる', () => {
  const finish=createFinishPresentation(),base=scenario(200,22).snapshot();
  const end={...base,phase:'gameover' as const,celebrations:rallyCelebration(createCelebrations(),200,20)};
  expect(finish.frame(end,0).finishing).toBe(true);
  expect(finish.frame(end,2999).finishing).toBe(true);
  expect(finish.frame(end,3000).finishing).toBe(false);
  const empty={...end,runId:'new',celebrations:lossCelebration(createCelebrations(),1,22)};
  expect(finish.frame(empty,4000).finishing).toBe(true);
  expect(finish.frame(empty,4901).finishing).toBe(false);
});
// Additional presentation lifetimes must not delay score finality or move balls.
it('new effects use the existing bounded finish drawing clock without changing final facts',()=>{
  const finish=createFinishPresentation(),base=scenario(4000,20).snapshot();
  const end={...base,phase:'gameover' as const,celebrations:createCelebrations()};
  const first=finish.frame(end,1000,40);
  expect(first.finishing).toBe(true);expect(first.snapshot.balls).toBe(end.balls);
  expect(finish.frame(end,5999,40).finishing).toBe(true);
  expect(finish.frame(end,6000,40)).toMatchObject({finishing:false,snapshot:{simTime:20,score:4000},presentationTime:25});
  expect(end.simTime).toBe(20);
});
