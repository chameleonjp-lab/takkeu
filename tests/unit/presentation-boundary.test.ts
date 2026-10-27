import {expect,it} from 'vitest';
import {createPresentationBoundary} from '../../src/app/presentationBoundary';
import {createCelebrations,lossCelebration,rallyCelebration} from '../../src/game/celebrations';
import {scenario} from '../helpers/scenarios';
it('expires old legacy drawing facts while preserving game time, physics and new same-run events',()=>{
 const boundary=createPresentationBoundary();const c=rallyCelebration(lossCelebration(createCelebrations(),99,20),1000,20),s={...scenario(2000,20.2).snapshot(),celebrations:c};
 boundary.interrupt(s);const f=boundary.frame(s);expect(f.simTime).toBe(s.simTime);expect(f.balls).toBe(s.balls);expect(f.score).toBe(s.score);expect(f.celebrations).toMatchObject({lastLossAt:null,centuryAt:null,numberNotices:[]});expect(s.celebrations).toBe(c);
 const next={...s,celebrations:lossCelebration(c,100,20.3)};expect(boundary.frame(next).celebrations.numberNotices.map(n=>n.value)).toEqual([100]);
 const fresh={...s,runId:'new'};expect(boundary.frame(fresh)).toBe(fresh);
});
