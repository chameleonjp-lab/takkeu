import type {GameSnapshot} from '../game/types';
import type {StorageLike} from './preferences';
type Record={id:string;runId:string;score:number;lostBallCount:number;simTime:number;endReason:'clear'|'loss';named:boolean;identity:{startId:string;name:string}|null};
const key='takkeu.result.v1';
function valid(x:unknown):x is Record{if(!x||typeof x!=='object')return false;const r=x as Record;return typeof r.id==='string'&&/^[0-9a-f-]{36}$/i.test(r.id)&&typeof r.runId==='string'&&r.runId.length<200&&typeof r.named==='boolean'&&(r.named?!!r.identity&&typeof r.identity.name==='string'&&r.identity.name.trim()===r.identity.name&&[...r.identity.name].length>0&&[...r.identity.name].length<=20&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(r.identity.startId):r.identity===null)&&Number.isSafeInteger(r.score)&&r.score>=0&&r.score<=3500&&Number.isSafeInteger(r.lostBallCount)&&r.lostBallCount>=0&&r.lostBallCount<=100&&Number.isFinite(r.simTime)&&r.simTime>=0&&(r.endReason==='clear'?r.score===3500&&r.lostBallCount<100:r.endReason==='loss'&&r.score<3500)}
/** Display-only final result. This module never resumes physics or submits a score. */
export function createResultSnapshot(storage:StorageLike){
 let current:Record|null=null,closeRequested=false;
 function close():boolean{closeRequested=true;if(!current)return true;try{storage.setItem(key+'.closed',current.id);return storage.getItem(key+'.closed')===current.id}catch{return false}}
 return {
  capture(snapshot:GameSnapshot,named:boolean,identity:{startId:string;name:string}|null=null){if(snapshot.phase!=='gameover')return;const row:Record={id:crypto.randomUUID(),runId:snapshot.runId,score:snapshot.score,lostBallCount:snapshot.lostBallCount,simTime:snapshot.simTime,endReason:snapshot.endReason==='clear'?'clear':'loss',named,identity};if(valid(row)){current=row;closeRequested=false}},
  save():boolean{if(!current)return true;try{const old=storage.getItem(key);if(old!==null){const parsed:unknown=JSON.parse(old);if(!valid(parsed))return false;if(parsed.id===current.id&&JSON.stringify(parsed)!==JSON.stringify(current))return false;if(parsed.id!==current.id){const previous=key+'.previous.'+parsed.id;const existing=storage.getItem(previous);if(existing!==null&&existing!==old)return false;storage.setItem(previous,old);if(storage.getItem(previous)!==old)return false}}
   const raw=JSON.stringify(current);storage.setItem(key,raw);return storage.getItem(key)===raw&&(!closeRequested||close());
  }catch{return false}},
  close,
  load(base:GameSnapshot):{snapshot:GameSnapshot;named:boolean}|null{try{const raw=storage.getItem(key);if(!raw)return null;const row:unknown=JSON.parse(raw);if(!valid(row)||storage.getItem(key+'.closed')===row.id)return null;current=row;return{named:row.named,snapshot:{...base,runId:row.runId,phase:'gameover',score:row.score,lostBallCount:row.lostBallCount,simTime:row.simTime,endReason:row.endReason,balls:[],scheduledReturns:[],pauseReason:null}}}catch{return null}},
 };
}
