import {RankingError,validUuid,validScore,validLostBalls,clientVersionForPlay} from './client';
import type {Play,PendingResult,RankingApi} from './client';
import {RANKING_CONFIG as config} from './config';
import type {StorageLike} from '../storage/preferences';
import {createDurableStore} from './pendingStore';
type Waiting={submissionId:string;startId:string;displayName:string;score:number;resultType:PendingResult['resultType'];lostBalls:number;permanentFailure?:boolean};
export type NamedRun={startId:string;displayName:string;play:Play|null;ready:Promise<Play|null>};
type Handle=NamedRun&{result?:Waiting;request?:Promise<Play|null>;error?:unknown;finalized?:boolean};
export function createDeferredStarts(storage:StorageLike,api:RankingApi,enqueue:(row:PendingResult)=>boolean,changed:()=>void){
 const valid=(v:unknown):v is Waiting=>{if(!v||typeof v!=='object')return false;const x=v as Waiting;return validUuid(x.submissionId)&&validUuid(x.startId)&&typeof x.displayName==='string'&&x.displayName.trim()===x.displayName&&[...x.displayName].length>0&&[...x.displayName].length<=20&&validScore(x.score)&&x.score<=3500&&validLostBalls(x.lostBalls)&&(['game_over','retire'].includes(x.resultType)?x.score<3500:x.resultType==='clear'&&x.score===3500&&x.lostBalls<100)};
 const store=createDurableStore(storage,valid,config.pendingKey+'.awaiting-start.v1',x=>[x.startId,x.displayName,x.score,x.resultType,x.lostBalls]);
 const handles=new Map<string,Handle>();let storageFailed=false;
 function save(row:Waiting):boolean{try{const ok=store.save(row);storageFailed=!ok;return ok}catch{storageFailed=true;return false}}
 function settle(h:Handle){const row=h.result;if(!row)return; if(!save(row))return;
  if(h.play){const accepted:PendingResult={play:h.play,submissionId:row.submissionId,score:row.score,resultType:row.resultType,lostBalls:row.lostBalls,clientVersion:clientVersionForPlay(h.play)};
   if(enqueue(accepted)){try{store.acknowledge(row.submissionId);delete h.result}catch{storageFailed=true}}}
  else if(h.error instanceof RankingError&&!h.error.retryable){h.result={...row,permanentFailure:true};save(h.result)}
  changed();
 }
 function attempt(h:Handle):Promise<Play|null>{if(h.play)return Promise.resolve(h.play);if(h.request)return h.request;
  h.request=api.start(h.startId,h.displayName).then(play=>{h.play=play;h.error=undefined;return play}).catch(error=>{h.error=error;return null}).finally(()=>{delete h.request;settle(h)});return h.request;
 }
 const begin=(displayName:string):NamedRun=>{const h:Handle={startId:crypto.randomUUID(),displayName,play:null,ready:Promise.resolve(null)};handles.set(h.startId,h);h.ready=attempt(h);return h};
 function finish(run:NamedRun|null,score:number,resultType:PendingResult['resultType'],lostBalls:number){if(!run)return;const h=handles.get(run.startId);if(!h||h.finalized)return;
  const row:Waiting={submissionId:crypto.randomUUID(),startId:h.startId,displayName:h.displayName,score,resultType,lostBalls};if(!valid(row))return;
  h.finalized=true;h.result=row;save(row);settle(h);if(!h.result)h.error='finished';changed();
 }
 async function retry(){for(const row of store.list()){
  if(row.permanentFailure)continue;
  let h=handles.get(row.startId);if(!h){h={startId:row.startId,displayName:row.displayName,play:null,ready:Promise.resolve(null),result:row};handles.set(row.startId,h)}
  if(!h.result)h.result=row;if(!save(row))continue;
  await attempt(h);settle(h);
 }}
 return {begin,finish,retry,state:()=>({count:store.list().length+store.conflicted(),storageFailed,permanent:store.conflicted()>0||store.list().some(x=>x.permanentFailure)})};
}
