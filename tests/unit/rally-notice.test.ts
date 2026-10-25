// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createRallyNotice } from '../../src/ui/rallyNotice';
import { scenario } from '../helpers/scenarios';
import { resultComment } from '../../src/ui/resultComments';

function setup() {
  const host=document.createElement('div');host.innerHTML='<div class="hud"><div><output data-score>300</output></div></div>';
  const ui=createRallyNotice(host);return {host,ui};
}
describe('in-game notifications independent of results',()=>{
  it('uses the existing comment with 1.8 second simulation-clock lifetime',()=>{
    const {host,ui}=setup(),state=scenario(300,10).snapshot();
    ui.update(state,{notice:{score:300,at:10,major:false},bestAt:null,goldAt:10});
    expect(host.querySelector('[data-rally-notice]')!.textContent).toBe(`300 RALLY · ${resultComment(300)}`);
    ui.update({...state,phase:'paused',simTime:11},{notice:{score:300,at:10,major:false},bestAt:null,goldAt:10});
    expect((host.querySelector('[data-rally-notice]') as HTMLElement).hidden).toBe(false);
    ui.update({...state,simTime:11.8},{notice:{score:300,at:10,major:false},bestAt:null,goldAt:10});
    expect((host.querySelector('[data-rally-notice]') as HTMLElement).hidden).toBe(true);
  });
  it('prioritizes major 2.5-second arrival over best and uses numeric 2000+ ordinary notices',()=>{
    const {host,ui}=setup(),state=scenario(2000,10).snapshot();
    ui.update(state,{notice:{score:2000,at:10,major:true},bestAt:10,goldAt:null});
    expect(host.querySelector('[data-rally-notice]')!.textContent).toBe('2000 RALLY');
    ui.update({...state,score:2100},{notice:{score:2100,at:10,major:false},bestAt:null,goldAt:null});
    expect(host.querySelector('[data-rally-notice]')!.textContent).toBe('2100 RALLY');
    ui.update({...state,simTime:12.5},{notice:{score:2000,at:10,major:true},bestAt:null,goldAt:null});
    expect((host.querySelector('[data-rally-notice]') as HTMLElement).hidden).toBe(true);
  });
  it('shows best for 2 seconds, resets on ready and does not read each rally aloud',()=>{
    const {host,ui}=setup(),state=scenario(81,5).snapshot();
    ui.update(state,{notice:null,bestAt:5,goldAt:null});
    expect(host.querySelector('[data-rally-notice]')!.textContent).toBe('自己ベスト更新！');
    expect(host.querySelector('[data-rally-live]')!.textContent).toBe('自己ベスト更新！');
    ui.update({...state,score:82,simTime:6},{notice:null,bestAt:5,goldAt:null});
    expect(host.querySelector('[data-rally-live]')!.textContent).toBe('自己ベスト更新！');
    ui.update({...state,phase:'ready'},{notice:null,bestAt:5,goldAt:null});
    expect((host.querySelector('[data-rally-notice]') as HTMLElement).hidden).toBe(true);
    ui.dispose();expect(host.querySelector('[data-rally-notice]')).toBeNull();
  });
  it('finishes the remaining gold rays on the drawing clock after game over',()=>{
    const {host,ui}=setup(),base=scenario(300,10).snapshot(),state={...base,phase:'gameover' as const};
    ui.update(state,{notice:null,bestAt:null,goldAt:10},true);
    expect((host.querySelector('.rally-score-aura') as HTMLElement).hidden).toBe(false);
    ui.update({...state,simTime:11.5},{notice:null,bestAt:null,goldAt:10},true);
    expect((host.querySelector('.rally-score-aura') as HTMLElement).hidden).toBe(true);
  });
});
