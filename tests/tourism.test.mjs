import test from 'node:test';
import assert from 'node:assert/strict';
import {TOUR_QUERIES,matchTourismPlace,normalizeTourDetail,tourismDetail,tourismCatalog} from '../tourism.mjs';
import {withCurrentTime,returnReadiness,transportFreshness} from '../public/readiness.js';
import {handleApi} from '../cloudflare/api.mjs';

test('landmark matching rejects same-name restaurants, distant places and partial event names',()=>{
 const q=TOUR_QUERIES.find(p=>p.id==='palace'),valid={title:'경복궁',contenttypeid:'12',mapx:q.lng,mapy:q.lat,contentid:'1'};
 assert.equal(matchTourismPlace([{...valid,contenttypeid:'39'},{...valid,mapy:35},{...valid,title:'경복궁 별빛야행'},valid],q),valid);
 assert.equal(matchTourismPlace([{...valid,title:'경복궁 별빛야행'}],q),undefined);
});
test('catalog partial failures are explicit and only matched curated places are exposed',async()=>{
 const q=TOUR_QUERIES[0];const r=await tourismCatalog(async(path,p)=>p.keyword===q.keyword?{data:{live:true,items:[{title:q.name,contentid:'1',contenttypeid:q.type,mapx:q.lng,mapy:q.lat}]}}:{data:{live:false}});
 assert.equal(r.data.places.length,1);assert.equal(r.data.places[0].curatedId,q.id);assert.equal(r.data.partial,true);assert.equal(r.data.totalCount,8);
});
test('visitor detail preserves closure exceptions and unknown fees without treating text as HTML',()=>{
 const d=normalizeTourDetail({contentid:'123',contenttypeid:'14',title:'Museum',homepage:'<a href="javascript:bad">bad</a>',overview:'<script>bad()</script>A<br>B'}, {usetimeculture:'10:00~18:00',restdateculture:'월요일 / 공휴일 다음 평일',usefee:''});
 assert.equal(d.hours,'10:00~18:00');assert.equal(d.closed,'월요일 / 공휴일 다음 평일');assert.equal(d.fee,'');assert.equal(d.homepage,'');assert.equal(d.overview,'A\nB');
});
test('detail rejects wrong ids/types and allows common data with explicit missing intro',async()=>{
 const provider=async(path)=>path==='detailCommon2'?{data:{live:true,items:[{contentid:'123',contenttypeid:'14',title:'Museum'}]}}:{data:{live:false}};
 assert.equal((await tourismDetail('123','99',provider)).status,400);
 const partial=await tourismDetail('123','14',provider);assert.equal(partial.data.partial,true);assert.equal(partial.data.detail.hours,'');
 assert.equal((await tourismDetail('456','14',provider)).status,502);
});
test('Cloudflare charges both tourism detail calls and validates before quota use',async()=>{
 let cost=0,calls=0;const guard={begin:async(a,b,n)=>{cost=n;return {ok:true,finish(){}};}};
 const provider=async()=>{calls++;return {data:{live:true,items:[{contentid:'123',contenttypeid:'14'}]}};};
 const env={TOUR_API_KEY:'secret'},opts={tourProvider:provider};
 assert.equal((await handleApi(new Request('https://example.test/api/detail?id=123&type=99'),env,guard,opts)).status,400);assert.equal(cost,0);
 assert.equal((await handleApi(new Request('https://example.test/api/detail?id=123&type=14'),env,guard,opts)).status,200);assert.equal(cost,2);assert.equal(calls,2);
});
test('same-day planning does not start in the past or move an existing restriction earlier',()=>{
 const trip={date:'2026-09-21'},now=new Date('2026-09-21T11:30:00+09:00');
 assert.equal(withCurrentTime(trip,{},now).earliestStart,690);assert.equal(withCurrentTime(trip,{earliestStart:750},now).earliestStart,750);
 assert.deepEqual(withCurrentTime({date:'2026-09-22'},{},now),{});
 assert.equal(withCurrentTime({date:'2026-09-20',nextDay:true},{},now).earliestStart,2130);
});
test('return state respects sample, midnight and stale transport without claiming safety',()=>{
 const trip={date:'2026-09-21'},route={events:[{end:1500}],cutoff:1560,checkedAt:'2026-09-22T00:45:00+09:00'},now=new Date('2026-09-22T00:50:00+09:00');
 assert.equal(returnReadiness(trip,route,{now}).state,'soon');assert.equal(returnReadiness(trip,route,{now,sample:true}).state,'sample');
 assert.equal(returnReadiness(trip,route,{now:new Date('2026-09-22T02:00:00+09:00')}).state,'deadline');
 assert.equal(transportFreshness(route,now),'fresh');assert.equal(transportFreshness(route,new Date('2026-09-22T01:00:01+09:00')),'stale');assert.equal(transportFreshness({},now),'estimate');
});
