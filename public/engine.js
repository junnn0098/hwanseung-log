import {PLACES, AIRPORT_TRAVEL, TRAVEL_COST} from './data.js?v=1.0.1';
export function minutes(time) { const m=/^(\d{2}):(\d{2})$/.exec(time||''); return m&&+m[1]<24&&+m[2]<60?+m[1]*60 + +m[2]:NaN; }
export function clock(min) { const m=((Math.round(min)%1440)+1440)%1440;return `${Math.floor(m/60).toString().padStart(2,'0')}:${(m%60).toString().padStart(2,'0')}`; }
export function duration(n,lang='ko') {n=Math.max(0,Math.round(n));const h=Math.floor(n/60),m=n%60;return lang==='en'?`${h?h+'h ':''}${m||!h?m+'m':''}`.trim():`${h?h+'시간 ':''}${m||!h?m+'분':''}`.trim();}
export function tripDate(iso,dayOffset=0) { const d=new Date(`${iso}T12:00:00+09:00`);d.setUTCDate(d.getUTCDate()+dayOffset); return d; }
export function totalLayover(trip) { const a=minutes(trip.arrival), d=minutes(trip.departure); return d+(trip.nextDay?1440:0)-a; }
export function validateTrip(trip) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(trip.date||'')||!Number.isFinite(tripDate(trip.date).getTime())||tripDate(trip.date).toISOString().slice(0,10)!==trip.date)return 'date';
  if(!Number.isFinite(minutes(trip.arrival))||!Number.isFinite(minutes(trip.departure)))return 'time';
  if(totalLayover(trip)<=0||totalLayover(trip)>1440)return 'duration';
  if(!Number.isFinite(+trip.budget)||+trip.budget<0)return 'budget';
  for(const k of ['immigration','security','buffer'])if(!Number.isFinite(+trip[k])||+trip[k]<0||+trip[k]>360)return 'buffer';
  if(trip.airport!=='ICN'||!['T1','T2'].includes(trip.terminal)||!['train','taxi'].includes(trip.transport)||!Array.isArray(trip.interests))return 'settings';
  return null;
}
export function isOpen(place,start,end,iso) {
  const dayOffset=Math.floor(start/1440),day=tripDate(iso,dayOffset).getUTCDay();
  if(place.closed.includes(day))return false;
  const from=dayOffset*1440+place.open*60,to=dayOffset*1440+place.close*60;
  return start>=from&&end<=to;
}
export function getBudget(trip,scenario={}) {
  const arrival=minutes(trip.arrival), departure=minutes(trip.departure)+(trip.nextDay?1440:0);
  const delay=Math.max(0,+scenario.delay||0),traffic=Math.max(0,+scenario.traffic||0);
  const airportExtra=trip.terminal==='T2'?20:0;
  const luggage=trip.recheck?45:0;
  const initial=arrival+Math.max(0,+trip.immigration||0)+delay+luggage;
  const current=minutes(scenario.currentTime)+(scenario.currentNextDay?1440:0);
  const start=scenario.currentPlace&&Number.isFinite(current)?Math.max(initial,current):initial;
  const cutoff=departure-Math.max(0,+trip.security||0)-Math.max(0,+trip.buffer||0)-airportExtra;
  return {arrival,departure,start,cutoff,delay,traffic,luggage,available:Math.max(0,cutoff-start),total:departure-arrival};
}
export function buildRoute(ids,trip,scenario={},catalog=PLACES) {
  const b=getBudget(trip,scenario),mode=trip.transport==='taxi'?'taxi':'train';
  const selected=ids.map(id=>catalog.find(p=>p.id===id)).filter(Boolean);
  if(!selected.length||selected.length!==ids.length||new Set(ids).size!==ids.length)return null;
  const first=selected[0],last=selected.at(-1);
  if(!Number.isFinite(AIRPORT_TRAVEL[mode][first.region]))return null;
  let now=b.start+(scenario.currentPlace?0:AIRPORT_TRAVEL[mode][first.region]+b.traffic);
  const events=[];let totalCost=scenario.currentPlace?Math.ceil(TRAVEL_COST[mode][last.region]/2):TRAVEL_COST[mode][first.region];
  for (let i=0;i<selected.length;i++) {
    const p=selected[i];
    if(i>0)now+=p.region===selected[i-1].region?20:50;
    if(i===0&&scenario.currentPlace&&scenario.currentPlace!==p.id)now+=20;
    const day=Math.floor(now/1440),openAt=day*1440+p.open*60;
    const wait=Math.max(0,openAt-now);if(wait>90)return null;now+=wait;
    const dwell=scenario.tired?Math.max(30,p.duration-15):p.duration;
    if(!isOpen(p,now,now+dwell,trip.date))return null;
    if((scenario.weather==='rain'||scenario.weather==='snow')&&!p.indoor)return null;
    if((scenario.skip||[]).includes(p.id))return null;
    events.push({id:p.id,start:now,end:now+dwell,wait});now+=dwell;totalCost+=p.cost;
  }
  const returnTravel=AIRPORT_TRAVEL[mode][last.region]+b.traffic;
  const back=now+returnTravel;
  const budget=scenario.currentPlace&&Number.isFinite(+scenario.remainingBudget)?Math.min(+trip.budget,+scenario.remainingBudget):+trip.budget;
  if(back>b.cutoff||totalCost>budget)return null;
  const affinity=selected.reduce((s,p)=>s+(trip.interests.includes(p.category)?35:5),0);
  const used=back-b.start;
  return {ids:selected.map(p=>p.id),events,back,cutoff:b.cutoff,slack:b.cutoff-back,cost:totalCost,travel:used-events.reduce((s,e)=>s+e.end-e.start,0),sightseeing:events.reduce((s,e)=>s+e.end-e.start,0),score:affinity+selected.length*15-used*.04,region:first.region,estimated:true};
}
export function generateRoutes(trip,scenario={},catalog=PLACES) {
  const error=validateTrip(trip);if(error)return {routes:[],reason:error,budget:null};
  const budget=getBudget(trip,scenario);
  if(trip.entry!=='confirmed')return {routes:[],reason:'entry',budget};
  if(budget.available<70)return {routes:[],reason:'short',budget};
  let pool=catalog.filter(p=>!(scenario.skip||[]).includes(p.id));
  if(scenario.currentPlace) {const current=catalog.find(p=>p.id===scenario.currentPlace);if(current)pool=pool.filter(p=>p.region===current.region);}
  const combos=pool.map(p=>[p.id]);
  for(const a of pool)for(const b of pool)if(a.id!==b.id&&a.region===b.region)combos.push([a.id,b.id]);
  const routes=combos.map(ids=>buildRoute(ids,trip,scenario,catalog)).filter(Boolean).sort((a,b)=>b.score-a.score);
  const unique=[];const seen=new Set();for(const r of routes){const key=[...r.ids].sort().join('-');if(!seen.has(key)){seen.add(key);unique.push(r);}}
  return {routes:unique.slice(0,6),reason:unique.length?null:'none',budget};
}
export function compareRoutes(before,after) {return {removed:(before?.ids||[]).filter(id=>!after?.ids.includes(id)),added:(after?.ids||[]).filter(id=>!before?.ids.includes(id)),timeDelta:(after?.sightseeing||0)-(before?.sightseeing||0),costDelta:(after?.cost||0)-(before?.cost||0)};}
export function compareFlight(flight) {
  const layover=minutes(flight.departure)+(flight.nextDay?1440:0)-minutes(flight.arrival);
  const usable=Math.max(0,layover-(+flight.immigration||0)-(+flight.security||0)-(+flight.buffer||0)-(+flight.transfer||0)*2);
  return {...flight,layover,usable,valid:layover>0&&layover<=1440&&Number.isFinite(+flight.price)&&+flight.price>=0&&['immigration','security','buffer','transfer'].every(k=>Number.isFinite(+flight[k])&&+flight[k]>=0&&+flight[k]<=600)};
}
export function escapeHTML(value) {return String(value??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));}
