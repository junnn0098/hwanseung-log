import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequestGuard,clientAddress} from '../request-guard.mjs';
import {createApp} from '../server.mjs';
const req={socket:{remoteAddress:'127.0.0.1'},headers:{}};
test('concurrent reservations count before completion and release exactly once',()=>{
 const g=createRequestGuard({maxConcurrent:1,limits:{transit:2}}),a=g.begin(req,'transit');
 assert.equal(g.begin(req,'transit').code,'SERVER_BUSY');a.finish();a.finish();
 const b=g.begin(req,'transit');assert.ok(b.ok);b.finish();
 assert.equal(g.begin(req,'transit').code,'DAILY_LIMIT');
});
test('daily ledger survives restarts, resets at Korea midnight, and fails closed on corruption',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'hwanseung-quota-')),file=join(dir,'usage.json');
 let now=Date.parse('2026-10-07T23:59:00+09:00');const config={file,now:()=>now,limits:{transit:1}};
 try{
  createRequestGuard(config).begin(req,'transit').finish();
  assert.equal(createRequestGuard(config).begin(req,'transit').code,'DAILY_LIMIT');
  assert.deepEqual(JSON.parse(await readFile(file,'utf8')),{day:'2026-10-07',counts:{transit:1}});
  now+=60001;assert.ok(createRequestGuard(config).begin(req,'transit').ok);
  await writeFile(file,'broken');assert.equal(createRequestGuard(config).begin(req,'transit').code,'QUOTA_UNAVAILABLE');
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('forged forwarding headers cannot bypass client limits',()=>{
 const g=createRequestGuard({perMinute:1});g.begin(req,'transit').finish();
 const forged={...req,headers:{'x-real-ip':'1.1.1.1','x-forwarded-for':'8.8.8.8'}};
 assert.equal(g.begin(forged,'transit').code,'RATE_LIMITED');
 assert.equal(clientAddress(forged,true),'1.1.1.1');
 assert.equal(clientAddress({...forged,socket:{remoteAddress:'8.8.4.4'}},true),'8.8.4.4');
});
test('blocked requests never call providers; HEAD and health checks consume no upstream quota',async()=>{
 let calls=0;const app=createApp({guard:createRequestGuard({limits:{transit:1}}),directionProvider:async()=>{calls++;return {status:200,data:{live:true}};}});
 await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${app.address().port}`;
 try{
  assert.equal((await fetch(origin+'/healthz')).status,200);
  assert.equal((await fetch(origin+'/api/directions?mode=transit',{method:'HEAD'})).status,405);
  assert.equal((await fetch(origin+'/api/directions?mode=transit')).status,200);
  const r=await fetch(origin+'/api/directions?mode=transit');assert.equal(r.status,429);assert.ok(+r.headers.get('retry-after')>0);
  assert.equal((await r.json()).code,'DAILY_LIMIT');assert.equal(calls,1);
 }finally{await new Promise(resolve=>app.close(resolve));}
});
