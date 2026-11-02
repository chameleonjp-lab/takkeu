import type {PendingResult} from './client';
import {RankingError} from './client';
import {RANKING_CONFIG as config} from './config';
import type {StorageLike} from '../storage/preferences';
type Store = StorageLike & Partial<Pick<Storage,'key'|'length'>>;
/** Original v1 bytes are read-only. Each new result and acknowledgement owns one UUID key. */
type DurableRecord={submissionId:string;scoreAcknowledged?:boolean;permanentFailure?:boolean};
export function createDurableStore<T extends DurableRecord>(storage:Store,valid:(v:unknown)=>v is T,baseKey:string,payload:(a:T)=>unknown){
 const prefix=baseKey+'.entry.v2.', indexKey=baseKey+'.index.v2';
 const memory=new Map<string,T>(), acknowledged=new Set<string>(),conflicts=new Set<string>();

 const same=(a:T,b:T)=>JSON.stringify(payload(a))===JSON.stringify(payload(b));
 const merge=(value:unknown,id?:string)=>{
  if(!valid(value)||(id&&value.submissionId!==id)){if(id)conflicts.add(id);return}
  const key=value.submissionId,old=memory.get(key);
  if(old&&!same(old,value)){conflicts.add(key);return}
  if('acknowledged' in value&&value.acknowledged===true)acknowledged.add(key);
  memory.set(key,{...value,...(old?.scoreAcknowledged?{scoreAcknowledged:true}:{}),...(old?.permanentFailure?{permanentFailure:true}:{})});
 };
 const read=(key:string)=>{const raw=storage.getItem(key);if(raw===null)return null;return JSON.parse(raw) as unknown};
 const refresh=()=>{
  try{const legacy=read(baseKey);if(Array.isArray(legacy))legacy.forEach((v,i)=>{if(valid(v))merge(v);else conflicts.add('legacy:'+i)});else if(legacy!==null)conflicts.add('legacy:invalid');}catch(error){if(error instanceof SyntaxError)conflicts.add('legacy:invalid');else throw error}
  let ids:string[]=[];
  if(typeof storage.key==='function')ids=Array.from({length:storage.length??0},(_,i)=>storage.key!(i)).filter((k):k is string=>!!k?.startsWith(prefix)).map(k=>k.slice(prefix.length));
  else{try{const index=read(indexKey);if(Array.isArray(index))ids=index.filter((v):v is string=>typeof v==='string');}catch{/* Do not replace an unreadable index. */}}
  for(const id of ids){try{merge(read(prefix+id),id)}catch(error){if(error instanceof SyntaxError)conflicts.add(id);else throw error}}
 };
 const list=()=>{try{refresh()}catch{/* Failed reads cannot authorize a write. */}return [...memory.values()].filter(v=>!conflicts.has(v.submissionId)&&!acknowledged.has(v.submissionId));};
 const save=(value:T):boolean=>{
  const id=value.submissionId;
  try{refresh()}catch{if(!memory.has(id))memory.set(id,value);return false}
  const old=memory.get(id);
  try{const disk=read(prefix+id);if(disk!==null)merge(disk,id)}catch(error){if(error instanceof SyntaxError)conflicts.add(id);else{if(!old)memory.set(id,value);return false}}
  const observed=memory.get(id);
  if(conflicts.has(id)||(observed&&!same(observed,value))){conflicts.add(id);throw new RankingError(false,'記録の内容が一致しません。','pending_conflict')}
  if(acknowledged.has(id))return true;
  const current=memory.get(id);
  const snapshot={...value,...(current?.scoreAcknowledged?{scoreAcknowledged:true}:{}),...(current?.permanentFailure?{permanentFailure:true}:{})};
  memory.set(id,snapshot);
  try{
   if(typeof storage.key!=='function'){
    const existing=read(indexKey);if(existing!==null&&!Array.isArray(existing))return false;
    const raw=JSON.stringify([...new Set([...(Array.isArray(existing)?existing:[]),id])]);storage.setItem(indexKey,raw);if(storage.getItem(indexKey)!==raw)return false;
   }
   const raw=JSON.stringify(snapshot);storage.setItem(prefix+id,raw);return storage.getItem(prefix+id)===raw;
  }catch{return false}
 };
 const acknowledge=(id:string)=>{
  const expected=memory.get(id);if(!expected||conflicts.has(id))throw new RankingError(false,'記録の内容が一致しません。','pending_conflict');
  let disk:unknown;try{disk=read(prefix+id)}catch{throw new RankingError(true,'記録を端末に保存できません。','storage_unavailable')}
  if(!valid(disk)||!same(expected,disk)){conflicts.add(id);throw new RankingError(false,'記録の内容が一致しません。','pending_conflict')}
  const raw=JSON.stringify({...expected,acknowledged:true});
  try{storage.setItem(prefix+id,raw);if(storage.getItem(prefix+id)!==raw)throw Error('unverified ACK')}catch{throw new RankingError(true,'記録を端末に保存できません。','storage_unavailable')}
  acknowledged.add(id);memory.set(id,expected);
 };

 return {list,save,acknowledge,conflicted:()=>conflicts.size,conflictIds:()=>[...conflicts]};
}

export function createResultStore(storage:Store,valid:(v:unknown)=>v is PendingResult){return createDurableStore(storage,valid,config.pendingKey,a=>[a.play.startId,a.play.playId,a.play.displayName,a.play.normalizedName,a.play.rulesVersion,a.score,a.resultType,a.clientVersion,a.lostBalls]);}
