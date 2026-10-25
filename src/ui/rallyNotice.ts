import type { GameSnapshot } from '../game/types';
import { resultComment } from './resultComments';
import './rallyNotice.css';

export type RallyNoticeFrame = Readonly<{
  notice: Readonly<{score:number;at:number;major:boolean}> | null;
  bestAt: number | null;
  goldAt: number | null;
}>;

/** Drawing is entirely a function of simTime: pause/restore cannot restart a cue. */
export function createRallyNotice(root: HTMLElement) {
  const hud=root.querySelector<HTMLElement>('.hud')!;
  const score=root.querySelector<HTMLElement>('[data-score]')!;
  const toast=root.ownerDocument.createElement('p');
  toast.className='rally-toast';toast.dataset.rallyNotice='';toast.hidden=true;toast.setAttribute('aria-hidden','true');
  const label=root.ownerDocument.createElement('span');label.className='rally-toast-label';toast.append(label);
  const live=root.ownerDocument.createElement('span');live.className='sr-only';live.dataset.rallyLive='';
  live.setAttribute('role','status');live.setAttribute('aria-live','polite');live.setAttribute('aria-atomic','true');
  const aura=root.ownerDocument.createElement('span');aura.className='rally-score-aura';aura.setAttribute('aria-hidden','true');
  score.classList.add('rally-score-anchor');
  // screens.render writes score.textContent; the aura belongs to its stable parent.
  score.parentElement!.classList.add('rally-score-host');score.parentElement!.append(aura);
  hud.append(toast,live);
  let announced='',disposed=false;
  const active=(at:number|null,time:number,duration:number)=>at!==null&&time>=at&&time<at+duration-1e-9;
  return {
    update(snapshot:GameSnapshot,frame:RallyNoticeFrame,finishing=false) {
      if(disposed)return;
      const visible=snapshot.phase!=='ready'&&(snapshot.phase!=='gameover'||finishing);
      const t=snapshot.simTime,n=frame.notice;
      const best=active(frame.bestAt,t,2),gold=active(frame.goldAt,t,1.5);
      const showNotice=!!n&&active(n.at,t,n.major?2.5:1.8);
      const isMajor=showNotice&&n!.major;
      const chosen=isMajor?'major':best?'best':showNotice?'notice':'';
      const text=chosen==='best'?'自己ベスト更新！':chosen?(n!.major||n!.score>=2000?`${n!.score} RALLY`:`${n!.score} RALLY · ${resultComment(n!.score)}`):'';
      toast.hidden=!visible||!text;toast.dataset.kind=chosen;
      if(label.textContent!==text)label.textContent=text;
      const age=isMajor?t-n!.at:0;
      // Cubic ease-out gives the dedicated label a large, decelerating arrival.
      toast.style.setProperty('--arrival-scale',String(isMajor?1+1.2*Math.pow(Math.max(0,1-age/.55),3):1));
      // Scale the text, not the full flex row. Bound the arrival to the HUD even
      // with enlarged fonts; measure only during the four dedicated arrivals.
      if(isMajor){
        const available=hud.clientWidth,width=label.offsetWidth;
        toast.style.setProperty('--arrival-max-scale',String(available>0&&width>0?Math.max(1,Math.min(2.2,(available-2)/width)):2.2));
      }
      toast.style.setProperty('--notice-opacity',String(isMajor?Math.min(1,(2.5-age)*4):1));
      const key=visible&&(isMajor||chosen==='best')?`${snapshot.runId}:${chosen}:${isMajor?n!.at:frame.bestAt}`:'';
      if(key&&key!==announced){live.textContent=text;announced=key;}
      if(!visible){live.textContent='';announced='';}
      aura.hidden=!visible||(!best&&!gold);aura.dataset.kind=best?'best':'gold';
      score.parentElement!.dataset.rallyAura=!aura.hidden?(best?'best':'gold'):'';
      const auraAge=t-(best?frame.bestAt!:frame.goldAt!);
      aura.style.setProperty('--aura-scale',String(1+Math.max(0,auraAge)*.3));
      aura.style.setProperty('--aura-opacity',String(Math.max(0,1-auraAge/(best?2:1.5))*(best?.6:.95)));
    },
    dispose(){disposed=true;toast.remove();live.remove();aura.remove();score.classList.remove('rally-score-anchor');score.parentElement?.classList.remove('rally-score-host');if(score.parentElement)delete score.parentElement.dataset.rallyAura;},
  };
}
