import test from 'node:test';
import assert from 'node:assert/strict';
import {createDurableGuard} from '../cloudflare/quota.mjs';
import {handleApi,apiStatus} from '../cloudflare/api.mjs';
import {requestApi} from '../public/api.js';

function storage(){
 let values=new Map(),queue=Promise.resolve();
 return {read:key=>structuredClone(values.get(key)),async transaction(fn){
  const pending=queue.then(async()=>{const draft=structuredClone(values);const result=await fn({get:async k=>structuredClone(draft.get(k)),put:async(k,v)=>{draft.set(k,structuredClone(v));}});values=draft;return result;});
  queue=pending.catch(()=>{});return pending;
 }};
}
const request=path=>new Request('https://example.workers.dev'+path,{headers:{'X-Client-Hash':'hashed-test'}});
const transit='/api/directions?mode=transit&origin=126.4512,37.4475&destination=126.6392,37.3926';
const permit={begin:async()=>({ok:true,finish(){}})};
test('Cloudflare never substitutes or exposes the ODsay Server key as a Web key',async()=>{
 const env={ODSAY_API_KEY:'server-private'};
 assert.equal(apiStatus(env).transitConfigured,false);
 const missing=await handleApi(request(transit),env,permit);
 assert.equal(missing.status,503);assert.equal((await missing.json()).code,'WEB_TRANSIT_NOT_CONFIGURED');
 const ready=await handleApi(request(transit),{...env,ODSAY_WEB_PUBLIC_KEY:'public-web'},permit);
 const text=await ready.text();assert.ok(!text.includes('server-private'));
 assert.deepEqual(JSON.parse(text),{live:false,code:'BROWSER_TRANSIT',webKey:'public-web'});
});
test('browser Web transport calls only ODsay and normalizes responses used by both live screens',async()=>{
 const calls=[];
 const result=await requestApi('directions',new URL('https://example.test'+transit).searchParams,{fetcher:async(url,options)=>{
  calls.push({url:String(url),options});return Response.json(calls.length===1?{code:'BROWSER_TRANSIT',webKey:'web%2Bkey'}:{result:{path:[{info:{totalTime:81,payment:4750},subPath:[{trafficType:1,sectionTime:50,lane:[{name:'AREX'}]}]}]}});
 }});
 assert.equal(calls.length,2);const url=new URL(calls[1].url);
 assert.equal(url.origin,'https://api.odsay.com');assert.equal(url.searchParams.get('apiKey'),'web+key');
 assert.equal(calls[1].options.headers,undefined);assert.equal(result.data.routes[0].minutes,81);assert.equal(result.data.routes[0].steps[0].line,'AREX');
});
test('browser failures preserve sanitized errors and local Node responses remain compatible',async()=>{
 let calls=0;const result=await requestApi('directions',new URL('https://example.test'+transit).searchParams,{fetcher:async()=>{if(++calls===1)return Response.json({code:'BROWSER_TRANSIT',webKey:'public-key'});throw Error('sensitive payload');}});
 assert.equal(result.data.code,'UPSTREAM_UNAVAILABLE');assert.ok(!JSON.stringify(result).includes('sensitive'));
 const local=await requestApi('directions',{mode:'transit'},{fetcher:async()=>Response.json({live:true,routes:[]})});assert.equal(local.data.live,true);
 let unknownCalls=0;const forbidden=await requestApi('flights',{}, {fetcher:async()=>{unknownCalls++;return Response.json({code:'BROWSER_TRANSIT',webKey:'public-key'});}});
 assert.equal(unknownCalls,1);assert.equal(forbidden.ok,false);
});
test('durable daily quota is atomic across simultaneous requests and survives a new guard',async()=>{
 const db=storage(),opts={limits:{transit:1}},g=createDurableGuard(db,opts);
 const results=await Promise.all([g.begin('a','transit'),g.begin('b','transit')]);
 assert.equal(results.filter(r=>r.ok).length,1);results.forEach(r=>r.finish?.());
 assert.equal((await createDurableGuard(db,opts).begin('c','transit')).code,'DAILY_LIMIT');
 assert.deepEqual(Object.keys(db.read('daily-usage')).sort(),['counts','day']);
});
test('durable quota resets in Korea time and storage failure prevents provider calls',async()=>{
 let now=Date.parse('2026-09-21T23:59:59+09:00');const db=storage(),g=createDurableGuard(db,{now:()=>now,limits:{car:1}});
 (await g.begin('a','car')).finish();assert.equal((await g.begin('b','car')).code,'DAILY_LIMIT');
 now+=2000;assert.ok((await g.begin('b','car')).ok);
 let called=false;const broken=createDurableGuard({transaction:async()=>{throw Error('offline');}});
 const response=await handleApi(request(transit),{ODSAY_WEB_PUBLIC_KEY:'public'},broken,{directionProvider:async()=>{called=true;}});
 assert.equal(response.status,503);assert.equal((await response.json()).code,'QUOTA_UNAVAILABLE');assert.equal(called,false);
});
test('configured Worker forwards server credentials only to the correct provider',async()=>{
 const r=await handleApi(request('/api/directions?mode=car&origin=126,37&destination=127,37'),{KAKAO_REST_API_KEY:'private-kakao',ODSAY_API_KEY:'private-odsay'},permit,{directionProvider:async(params,opts)=>{
  assert.equal(opts.kakao,'private-kakao');assert.equal(opts.odsay,'');return {status:200,data:{live:true,routes:[]}};
 }});
 assert.equal(r.status,200);assert.equal((await r.text()).includes('private'),false);
 assert.equal((await handleApi(request('/api/missing'),{},permit)).status,404);
 assert.equal((await handleApi(request('/api/directions?mode=transit&origin=0,0&destination=127,37'),{},permit)).status,400);
});
