import {transitResult} from './public/transit.js';
const fail=(code,status=502)=>({status,data:{live:false,code}});
const success=data=>({status:200,data:{live:true,fetchedAt:new Date().toISOString(),...data}});
const decode=v=>{try{return decodeURIComponent(v);}catch{return v;}};
export const kstDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function flightTime(value){const s=String(value||'');const v=s.length===12?s.slice(-4):s;return /^(?:[01]\d|2[0-3])[0-5]\d$/.test(v)?`${v.slice(0,2)}:${v.slice(2)}`:null;}
export function normalizeFlight(p,direction){return {flight:String(p.flightId||''),airline:String(p.airline||''),airport:String(p.airport||''),scheduled:flightTime(p.scheduleDateTime),estimated:flightTime(p.estimatedDateTime),status:String(p.remark||''),gate:String(p.gatenumber||''),terminal:String(p.terminalId||''),checkin:String(p.chkinrange||''),direction};}
export async function flights(params,{key=process.env.AIRPORT_API_KEY,fetcher=fetch}={}){
 const flight=(params.get('flight')||'').replace(/\s/g,'').toUpperCase(),direction=params.get('direction')||'departure',date=params.get('date')||kstDate();
 if(!/^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/.test(flight)||!['arrival','departure'].includes(direction))return fail('INVALID_QUERY',400);
 if(date!==kstDate())return fail('TODAY_ONLY',400);
 if(!key)return fail('NOT_CONFIGURED',503);
 const url=new URL(`https://apis.data.go.kr/B551177/StatusOfPassengerFlightsOdp/${direction==='arrival'?'getPassengerArrivalsOdp':'getPassengerDeparturesOdp'}`);
 Object.entries({serviceKey:decode(key),from_time:'0000',to_time:'2400',flight_id:flight,lang:params.get('lang')==='en'?'E':'K',type:'json'}).forEach(([k,v])=>url.searchParams.set(k,v));
 try{const r=await fetcher(url,{signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error();const j=await r.json();if(!['00','0000'].includes(j.response?.header?.resultCode))throw Error();let raw=j.response?.body?.items;raw=Array.isArray(raw)?raw:raw?.item||[];const items=(Array.isArray(raw)?raw:[raw]).filter(p=>String(p.flightId).replace(/\s/g,'').toUpperCase()===flight).map(p=>normalizeFlight(p,direction));return success({items,date,source:'인천국제공항공사'});}catch{return fail('UPSTREAM_UNAVAILABLE');}
}
export function coordinates(value){if(!value||!/^[-\d.]+,[-\d.]+$/.test(value))return null;const c=value.split(',').map(Number);return c.length===2&&c.every(Number.isFinite)&&c[0]>=124&&c[0]<=132&&c[1]>=33&&c[1]<=39?c:null;}
export async function directions(params,{odsay=process.env.ODSAY_API_KEY,kakao=process.env.KAKAO_REST_API_KEY,fetcher=fetch}={}){
 const origin=coordinates(params.get('origin')),destination=coordinates(params.get('destination')),mode=params.get('mode');
 if(!origin||!destination||!['transit','car'].includes(mode))return fail('INVALID_QUERY',400);
 if(!(mode==='car'?kakao:odsay))return fail('NOT_CONFIGURED',503);
 try{
  if(mode==='car'){
   const url=new URL('https://apis-navi.kakaomobility.com/v1/directions');Object.entries({origin:origin.join(','),destination:destination.join(','),summary:'true',alternatives:'false',priority:'RECOMMEND'}).forEach(([k,v])=>url.searchParams.set(k,v));
   const r=await fetcher(url,{headers:{Authorization:`KakaoAK ${kakao}`},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error();const j=await r.json(),route=j.routes?.find(r=>r.result_code===0),s=route?.summary;if(!s||!Number.isFinite(s.duration))throw Error();return success({source:'Kakao Mobility',mode,routes:[{minutes:Math.ceil(s.duration/60),distance:s.distance,fare:s.fare?.taxi??null,toll:s.fare?.toll??null,steps:[]}]});
  }
  const url=new URL('https://api.odsay.com/v1/api/searchPubTransPathT');Object.entries({SX:origin[0],SY:origin[1],EX:destination[0],EY:destination[1],apiKey:decode(odsay),lang:params.get('lang')==='en'?1:0}).forEach(([k,v])=>url.searchParams.set(k,String(v)));
  const r=await fetcher(url,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error();const j=await r.json();return transitResult(j);
 }catch{return fail('UPSTREAM_UNAVAILABLE');}
}
