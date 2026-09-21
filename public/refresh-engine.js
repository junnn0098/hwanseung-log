import {buildRoute,getBudget,minutes,validateTrip} from './engine.js?v=1.2.2';
import {PLACES} from './data.js?v=1.2.2';
export const koreaToday=(now=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export const snapshotKey=(trip,route,scenario)=>JSON.stringify([trip,route,scenario]);
export function journeyLegs(trip,route,scenario={}){
 const airport={id:'airport',label:`ICN ${trip.terminal}`,coords:trip.terminal==='T2'?'126.4337,37.4688':'126.4512,37.4475'};
 const place=id=>{const p=PLACES.find(p=>p.id===id);if(!p)throw Error('INVALID_PLAN');return {id:p.id,label:p.name,coords:`${p.lng},${p.lat}`};};
 const stops=[scenario.currentPlace?place(scenario.currentPlace):airport,...route.ids.map(place),airport];
 return stops.slice(0,-1).map((from,i)=>({from,to:stops[i+1],index:i}));
}
export function refreshPlan({trip,route,scenario={},legs,arrivalFlight,departureFlight,now=new Date()}){
 if(validateTrip(trip)||trip.entry!=='confirmed'||!route?.ids?.length)return {code:'INVALID_PLAN'};
 if(trip.date!==koreaToday(now)||trip.nextDay)return {code:'TODAY_ONLY'};
 const next={...scenario},original=getBudget(trip,scenario);
 let delay=original.delay,departure=original.departure;
 for(const [flight,kind] of [[arrivalFlight,'arrival'],[departureFlight,'departure']]){
  if(!flight)continue;
  if(/취소|결항|cancel|회항|divert/i.test(flight.status))return {code:'FLIGHT_ATTENTION'};
  if(kind==='departure'&&/출발|이륙|departed|boarding closed/i.test(flight.status))return {code:'FLIGHT_ATTENTION'};
  const scheduled=minutes(flight.scheduled),estimated=minutes(flight.estimated||flight.scheduled),entered=minutes(trip[kind]);
  // Today's endpoint supplies clock times only. Do not guess midnight rollovers or different services.
  if(!Number.isFinite(scheduled)||!Number.isFinite(estimated)||Math.abs(scheduled-entered)>180||Math.abs(estimated-scheduled)>720)return {code:'FLIGHT_TIME_CHECK'};
  if(kind==='arrival')delay=Math.max(delay,estimated-minutes(trip.arrival),0);
  else{
   const terminal={P01:'T1',P02:'T1',P03:'T2'}[flight.terminal];
   if(terminal&&terminal!==trip.terminal)return {code:'TERMINAL_CHECK'};
   departure=Math.min(departure,scheduled,estimated);
  }
 }
 const expected=journeyLegs(trip,route,scenario);
 if(!Array.isArray(legs)||legs.length!==expected.length||legs.some((l,i)=>l.from!==expected[i].from.id||l.to!==expected[i].to.id||!Number.isFinite(l.minutes)||l.minutes<0||!Number.isFinite(l.fare)||l.fare<0))return {code:'INCOMPLETE_ROUTES'};
 const startOfDay=Date.parse(`${trip.date}T00:00:00+09:00`),current=Math.ceil((now-startOfDay)/60000);
 next.delay=delay;
 // Keep the earlier deadline, including one already shortened by a previous refresh.
 next.departureCap=Math.min(departure,Number.isFinite(scenario.departureCap)?scenario.departureCap:Infinity);
 next.earliestStart=current;
 next.measuredLegs=legs;
 const updated=buildRoute(route.ids,trip,next);
 if(!updated)return {code:'NO_FIT'};
 const {measuredLegs,...savedScenario}=next;
 return {route:{...updated,checkedAt:now.toISOString()},scenario:savedScenario};
}
