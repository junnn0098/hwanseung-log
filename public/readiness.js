export const localTravelMinute=(date,now=new Date())=>(now.getTime()-Date.parse(`${date}T00:00:00+09:00`))/60000;
export function withCurrentTime(trip,scenario={},now=new Date()){
 const minute=localTravelMinute(trip.date,now);
 return minute>=0&&minute<(trip.nextDay?2880:1440)?{...scenario,earliestStart:Math.max(Math.ceil(minute),scenario.earliestStart||0)}:{...scenario};
}
export function transportFreshness(route,now=new Date()){
 const age=now.getTime()-Date.parse(route?.checkedAt||'');
 return Number.isFinite(age)&&age>=0?(age<=600000?'fresh':'stale'):'estimate';
}
export function returnReadiness(trip,route,{sample=false,now=new Date()}={}){
 if(!route?.events?.length)return null;
 const current=localTravelMinute(trip.date,now),leave=route.events.at(-1).end,remaining=Math.ceil(leave-current);
 const state=sample?'sample':current<0?'future':current>=route.cutoff?'deadline':current>=leave?'return':remaining<=30?'soon':'planned';
 return {state,leave,remaining,cutoff:route.cutoff,transport:transportFreshness(route,now)};
}
