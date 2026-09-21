import test from 'node:test';
import assert from 'node:assert/strict';
import {flights,directions,flightTime,kstDate,coordinates} from '../integrations.mjs';
import {transitResult} from '../public/transit.js';
const params=v=>new URLSearchParams(v);
test('ODsay unavailable fares stay unknown while free and known fares remain usable',()=>{
 for(const [payment,expected] of [[-1,null],[undefined,null],[0,0],[2300,2300]]){
  const result=transitResult({result:{path:[{info:{totalTime:57,payment},subPath:[]}]}});
  assert.equal(result.data.routes[0].fare,expected);
 }
});
test('airport filters exact flight and preserves missing times',async()=>{
 let called;
 const result=await flights(params({flight:'ke 123',direction:'arrival'}),{key:'secret',fetcher:async url=>{called=url;return {ok:true,json:async()=>({response:{header:{resultCode:'00'},body:{items:[{flightId:'KE123',scheduleDateTime:'0900',estimatedDateTime:'',gatenumber:'12'},{flightId:'KE1234'}]}}})};}});
 assert.equal(called.searchParams.get('flight_id'),'KE123');assert.equal(result.data.items.length,1);assert.equal(result.data.items[0].estimated,null);assert.equal(result.data.items[0].scheduled,'09:00');assert.equal(JSON.stringify(result).includes('secret'),false);
});
test('airport does not use today data for a future trip or malformed input',async()=>{
 assert.equal((await flights(params({flight:'KE123',date:'2099-01-01'}))).data.code,'TODAY_ONLY');assert.equal((await flights(params({flight:'<script>'}))).status,400);assert.equal((await flights(params({flight:'KE123',date:kstDate()}),{key:''})).status,503);assert.equal(flightTime('202609210910'),'09:10');assert.equal(flightTime('9999'),null);
});
test('provider errors never expose keys or upstream content',async()=>{
 const r=await flights(params({flight:'KE123'}),{key:'private',fetcher:async()=>{throw Error('private');}});assert.deepEqual(r,{status:502,data:{live:false,code:'UPSTREAM_UNAVAILABLE'}});
});
test('directions validate locations and missing credentials',async()=>{
 assert.equal(coordinates('0,0'),null);assert.equal(coordinates('126,'),null);
 assert.equal((await directions(params({mode:'car',origin:'126,37',destination:'127,37'}),{kakao:''})).status,503);
 assert.equal((await directions(params({mode:'car',origin:'https://bad',destination:'127,37'}),{kakao:'secret'})).status,400);
});
test('car times convert seconds to rounded-up minutes',async()=>{
 const r=await directions(params({mode:'car',origin:'126,37',destination:'127,37'}),{kakao:'secret',fetcher:async()=>({ok:true,json:async()=>({routes:[{result_code:0,summary:{duration:121,distance:1000,fare:{taxi:5000,toll:0}}}]})})});assert.equal(r.data.routes[0].minutes,3);assert.equal(r.data.routes[0].fare,5000);
});
test('transit retains provider route steps and handles no-route response',async()=>{
 const p=params({mode:'transit',origin:'126,37',destination:'127,37'});
 const r=await directions(p,{odsay:'secret',fetcher:async()=>({ok:true,json:async()=>({result:{path:[{info:{totalTime:60,payment:4500},subPath:[{trafficType:1,sectionTime:40,startName:'A',endName:'B',lane:[{name:'AREX'}]}]}]}})})});assert.equal(r.data.routes[0].steps[0].line,'AREX');assert.equal(r.data.routes[0].minutes,60);
 assert.equal((await directions(p,{odsay:'secret',fetcher:async()=>({ok:true,json:async()=>({result:{}})})})).data.code,'NO_ROUTE');
});
