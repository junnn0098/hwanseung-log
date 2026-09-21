import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,renameSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {isIP} from 'node:net';

const dayAt=now=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
const resetIn=now=>Math.max(1,Math.ceil((Date.parse(`${dayAt(now)}T00:00:00+09:00`)+86400000-now)/1000));
export function clientAddress(req,trustProxy=false){
 const peer=(req.socket.remoteAddress||'unknown').replace(/^::ffff:/,'');
 const privatePeer=peer==='127.0.0.1'||peer==='::1'||/^10\./.test(peer)||/^192\.168\./.test(peer)||/^172\.(1[6-9]|2\d|3[01])\./.test(peer);
 const forwarded=req.headers['x-real-ip'];
 return trustProxy&&privatePeer&&typeof forwarded==='string'&&isIP(forwarded)?forwarded:peer;
}
// A single-process budget ledger stores counts only, never provider responses or keys.
export function createRequestGuard({file,now=Date.now,perMinute=12,maxConcurrent=4,trustProxy=false,limits={transit:30,car:500,flights:500,tourism:500}}={}){
 const clients=new Map();let active=0,memoryLedger={day:dayAt(now()),counts:{}};
 const reject=(code,status,retryAfter)=>({ok:false,code,status,retryAfter});
 return {begin(req,resource,cost=1){
  const time=now(),key=createHash('sha256').update(clientAddress(req,trustProxy)).digest('hex');
  for(const [id,v] of clients)if(time-v.start>=60000)clients.delete(id);
  const bucket=clients.get(key)||{start:time,count:0};
  if(bucket.count>=perMinute)return reject('RATE_LIMITED',429,Math.ceil((bucket.start+60000-time)/1000));
  if(active>=maxConcurrent||(!clients.has(key)&&clients.size>=5000))return reject('SERVER_BUSY',503,5);
  let ledger=file?{day:dayAt(time),counts:{}}:structuredClone(memoryLedger);
  try{
   if(file){try{ledger=JSON.parse(readFileSync(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}}
   if(!/^\d{4}-\d{2}-\d{2}$/.test(ledger.day)||!ledger.counts||Array.isArray(ledger.counts)||typeof ledger.counts!=='object'||Object.values(ledger.counts).some(v=>!Number.isSafeInteger(v)||v<0))throw Error('invalid ledger');
   if(ledger.day!==dayAt(time))ledger={day:dayAt(time),counts:{}};
   if((ledger.counts[resource]||0)+cost>(limits[resource]??0))return reject('DAILY_LIMIT',429,resetIn(time));
   ledger.counts[resource]=(ledger.counts[resource]||0)+cost;
   if(file){mkdirSync(dirname(file),{recursive:true});writeFileSync(file+'.tmp',JSON.stringify(ledger),{mode:0o600});renameSync(file+'.tmp',file);}else memoryLedger=ledger;
  }catch{return reject('QUOTA_UNAVAILABLE',503,60);}
  bucket.count++;clients.set(key,bucket);active++;
  let finished=false;
  return {ok:true,finish(){if(!finished){active--;finished=true;}}};
 }};
}
