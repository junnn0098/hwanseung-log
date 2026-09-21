const dayAt=now=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export const limitsFrom=env=>Object.fromEntries([['transit','ODSAY_DAILY_LIMIT',30],['car','KAKAO_DAILY_LIMIT',500],['flights','AIRPORT_DAILY_LIMIT',500],['tourism','TOUR_DAILY_LIMIT',500]].map(([kind,key,fallback])=>[kind,/^\d{1,7}$/.test(env[key]||'')?+env[key]:fallback]));
// One named Durable Object serializes the daily budget across all Worker locations.
// Only aggregate counts are persisted; IP hashes and provider responses are not.
export function createDurableGuard(storage,{now=Date.now,limits=limitsFrom({}),perMinute=12,maxConcurrent=4}={}){
 const clients=new Map();let active=0;
 const fail=(code,status,retryAfter)=>({ok:false,code,status,retryAfter});
 return {async begin(client,resource,cost=1){
  const time=now();
  if(!(resource in limits)||!Number.isSafeInteger(cost)||cost<1||cost>8)return fail('INVALID_QUERY',400,1);
  for(const [key,value] of clients)if(time-value.start>=60000)clients.delete(key);
  const bucket=clients.get(client)||{start:time,count:0};
  if(bucket.count>=perMinute)return fail('RATE_LIMITED',429,Math.ceil((bucket.start+60000-time)/1000));
  if(active>=maxConcurrent||(!clients.has(client)&&clients.size>=5000))return fail('SERVER_BUSY',503,5);
  bucket.count++;clients.set(client,bucket);active++;
  let finished=false;const finish=()=>{if(!finished){active--;finished=true;}};
  try{
   const allowed=await storage.transaction(async txn=>{
    let ledger=await txn.get('daily-usage');
    if(ledger&&(!/^\d{4}-\d{2}-\d{2}$/.test(ledger.day)||!ledger.counts||typeof ledger.counts!=='object'||Array.isArray(ledger.counts)||Object.values(ledger.counts).some(n=>!Number.isSafeInteger(n)||n<0)))throw Error('invalid ledger');
    if(!ledger||ledger.day!==dayAt(time))ledger={day:dayAt(time),counts:{}};
    if((ledger.counts[resource]||0)+cost>limits[resource])return false;
    ledger.counts[resource]=(ledger.counts[resource]||0)+cost;
    await txn.put('daily-usage',ledger);return true;
   });
   if(!allowed){finish();return fail('DAILY_LIMIT',429,Math.max(1,Math.ceil((Date.parse(`${dayAt(time)}T00:00:00+09:00`)+86400000-time)/1000)));}
   return {ok:true,finish};
  }catch{finish();return fail('QUOTA_UNAVAILABLE',503,60);}
 }};
}
