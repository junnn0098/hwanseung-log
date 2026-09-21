import {requestApi} from './api.js?v=1.2.2';
import {state,t,name,money,placeById} from './state.js?v=1.2.2';
import {clock,duration,escapeHTML as esc} from './engine.js?v=1.2.2';
import {koreaToday,journeyLegs,refreshPlan,snapshotKey} from './refresh-engine.js?v=1.2.2';
let pending=null;
const messages={
 TODAY_ONLY:['오늘 출발하는 당일 일정에서 사용할 수 있어요. 여행 조건에서 날짜를 확인해 주세요.','Use this for a same-day trip departing today. Check your travel date.'],
 INVALID_PLAN:['먼저 코스를 선택하고 입국 조건을 확인해 주세요.','Choose a route and verify entry requirements first.'],
 FLIGHT_ATTENTION:['취소·회항·출발 상태가 확인됐어요. 외출 전 항공사 안내를 확인해 주세요.','This flight is cancelled, diverted or has departed. Check with your airline before leaving.'],
 FLIGHT_TIME_CHECK:['입력한 시간과 운항정보를 대조해 주세요. 날짜가 불명확한 시각은 자동 반영하지 않아요.','Check your entered times against the flight information. Ambiguous dates cannot be applied.'],
 TERMINAL_CHECK:['항공편의 출국 터미널이 여행 설정과 달라요. 여행 조건을 먼저 수정해 주세요.','The departure terminal differs from your trip. Edit your trip first.'],
 INCOMPLETE_ROUTES:['모든 구간의 시간·요금을 확인하지 못했어요. 기존 일정을 유지했어요.','Some journey times or fares are unavailable. Your itinerary is unchanged.'],
 NO_FIT:['새 이동시간으로는 복귀 마감·예산·운영시간 조건을 맞추기 어려워요. 장소를 줄이거나 공항 복귀를 우선해 주세요.','This route no longer fits your return deadline, budget or opening hours. Reduce your stops or prioritize returning to the airport.'],
 NO_FLIGHT:['해당 편명을 찾지 못했어요. 편명과 도착·출발 구분을 확인해 주세요.','No matching flight. Check the flight number and direction.'],
 RATE_LIMITED:['짧은 시간에 조회가 많았어요. 1분 뒤 다시 확인해 주세요.','Too many requests. Please try again in a minute.'],
 DAILY_LIMIT:['오늘의 조회 한도에 도달했어요. 제공기관의 길찾기도 함께 확인해 주세요.','Today’s query allowance has been reached. Check the provider’s directions.'],
 STALE:['조회 후 일정이 바뀌었거나 10분이 지났어요. 다시 조회해 주세요.','The itinerary changed or ten minutes elapsed. Please refresh again.'],
 WEB_TRANSIT_NOT_CONFIGURED:['대중교통 서비스의 배포 주소 연결을 준비 중이에요. 기존 일정을 유지했어요.','Public transit is being connected to this site. Your itinerary is unchanged.'],
 NOT_CONFIGURED:['이 서버의 API 연결 설정이 필요해요.','This server needs API configuration.']
};
const message=code=>t(...(messages[code]||['지금 정보를 가져오지 못했어요. 기존 일정은 유지돼요. 잠시 후 다시 확인해 주세요.','Information is unavailable. Your itinerary is unchanged. Please try again shortly.']));
export function refreshDialog(){
 pending=null;
 const ready=state.active&&!state.editPlan&&state.trip.entry==='confirmed',dateReady=state.trip.date===koreaToday()&&!state.trip.nextDay;
 return `<h2 id="dialog-title" class="modal-title">${t('지금 정보로 일정 업데이트','Refresh your itinerary')}</h2><p class="modal-subtitle">${t('가는 길부터 돌아오는 길까지 확인하고, 바뀐 일정을 비교해요.','Check every leg of the journey and compare your updated itinerary.')}</p>${!ready||!dateReady?`<p class="notice">${message(!ready?'INVALID_PLAN':'TODAY_ONLY')}</p>`:`<form id="refresh-plan-form"><div class="refresh-journey"><span class="eyebrow">${t('이번에 확인할 여정','YOUR JOURNEY')}</span><p>${esc(state.scenario.currentPlace?name(placeById(state.scenario.currentPlace)):`ICN ${state.trip.terminal}`)} → ${state.active.ids.map(id=>esc(name(placeById(id)))).join(' → ')} → ICN ${esc(state.trip.terminal)}</p><small>${state.trip.transport==='taxi'?t('택시 · Kakao Mobility','Taxi · Kakao Mobility'):t('대중교통 · ODsay','Public transport · ODsay')}</small></div><div class="form-grid"><label class="field"><span>${t('인천 도착 편명 (선택)','Arriving flight (optional)')}</span><input name="arrivalFlight" placeholder="KE123" maxlength="10" pattern="[A-Za-z0-9 ]{3,10}"></label><label class="field"><span>${t('인천 출발 편명 (선택)','Departing flight (optional)')}</span><input name="departureFlight" value="${esc(/^[A-Za-z0-9 ]{3,10}$/.test(state.trip.flight||'')?state.trip.flight:'')}" placeholder="KE001" maxlength="10" pattern="[A-Za-z0-9 ]{3,10}"></label></div><p class="field-note mt-20">${t('편명을 비워두면 교통만 반영해요. 공항을 이미 나왔다면 ‘지금 상황으로 다시 계획’에서 현재 장소를 먼저 설정하세요.','Leave flights blank to update transport only. If you have left the airport, set your current location in Adapt my itinerary first.')}</p><div class="form-actions"><span class="subtle">${t('출발 지연으로 복귀 마감을 늦추지 않아요.','Departure delays never extend your return deadline.')}</span><button type="submit" class="btn primary">${t('조회하고 비교하기','Check & compare')}</button></div></form>`}<div id="refresh-result" aria-live="polite"></div>`;
}
async function query(path,params,signal){const res=await requestApi(path,params,{signal});const data=res.data;if(!res.ok||!data.live)throw Error(data.code||'UNAVAILABLE');return data;}
export async function submitRefresh(form){
 const target=document.querySelector('#refresh-result'),button=form.querySelector('[type=submit]');if(!target||button.disabled)return;
 pending=null;button.disabled=true;
 const trip=structuredClone(state.trip),route=structuredClone(state.active),scenario=structuredClone(state.scenario),key=snapshotKey(trip,route,scenario),fd=new FormData(form);
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),100000);
 const observer=new MutationObserver(()=>{if(!form.isConnected)controller.abort();});observer.observe(document.querySelector('#modal-root'),{childList:true,subtree:true});
 target.innerHTML=`<p class="notice"><span class="spinner"></span> ${t('항공편과 이동 경로를 확인하고 있어요…','Checking flights and directions…')}</p>`;
 try{
  const flightData={};
  for(const [field,direction] of [['arrivalFlight','arrival'],['departureFlight','departure']]){
   const flight=fd.get(field)?.trim();if(!flight)continue;
   const data=await query('flights',{flight,direction,date:trip.date,lang:'ko'},controller.signal);
   if(data.items?.length!==1)throw Error('NO_FLIGHT');flightData[field]=data.items[0];
  }
  const path=journeyLegs(trip,route,scenario),legs=[];
  for(const leg of path){
   if(!target.isConnected)return;
   target.innerHTML=`<p class="notice"><span class="spinner"></span> ${t('이동 구간 확인 중','Checking journey')} ${leg.index+1} / ${path.length}</p>`;
   if(leg.from.id===leg.to.id){legs.push({from:leg.from.id,to:leg.to.id,minutes:0,fare:0});continue;}
   const data=await query('directions',{origin:leg.from.coords,destination:leg.to.coords,mode:trip.transport==='taxi'?'car':'transit',lang:state.lang},controller.signal);
   const best=[...data.routes].filter(r=>Number.isFinite(r.minutes)&&r.minutes>=0&&Number.isFinite(r.fare)&&r.fare>=0).sort((a,b)=>a.minutes-b.minutes)[0];
   if(!best)throw Error('INCOMPLETE_ROUTES');
   legs.push({from:leg.from.id,to:leg.to.id,minutes:best.minutes,fare:best.fare+(Number.isFinite(best.toll)?best.toll:0)});
  }
  const output=refreshPlan({trip,route,scenario,legs,...flightData});
  if(output.code)throw Error(output.code);
  if(key!==snapshotKey(state.trip,state.active,state.scenario))throw Error('STALE');
  if(!target.isConnected)return;
  pending={...output,key,created:Date.now()};
  const card=(r,label,extra='')=>`<div class="comparison-panel ${extra}"><h3>${label}</h3><div class="refresh-return"><small>${t('공항 복귀 예상','Estimated airport return')}</small><strong>${clock(r.back)}</strong></div><p>${t('마감까지 여유','Time before deadline')} ${duration(r.slack,state.lang)}</p><p>${t('총비용 추정','Estimated total')} ${money(r.cost)}</p></div>`;
  target.innerHTML=`<div class="scenario-comparison">${card(route,t('현재 일정','Current itinerary'))}${card(output.route,t('최신 정보 반영','Updated estimates'),'new')}</div><div class="refresh-segments">${legs.map((leg,i)=>`<div><span>${esc(path[i].from.id==='airport'?path[i].from.label:name(placeById(leg.from)))} → ${esc(path[i].to.id==='airport'?path[i].to.label:name(placeById(leg.to)))}</span><strong>${duration(leg.minutes,state.lang)}</strong></div>`).join('')}</div><p class="field-note mt-20">${t('현재 조회한 이동시간으로 계산한 예상 일정이에요. 출발 시각별 배차·막차·미래 교통은 반영하지 못해요. 운영시간·입장료는 기존 추정값이며, 택시는 통행료를 추가해 계산해요.','Estimates use travel times queried now, not future schedules or last trains. Opening hours and admission costs remain estimates. Taxi estimates include an additional toll allowance.')}</p><div class="form-actions"><span class="subtle">${t('복귀 마감','Return deadline')} ${clock(output.route.cutoff)}</span><button class="btn primary" data-action="apply-refresh">${t('이 일정으로 반영하기','Apply this itinerary')}</button></div>`;
 }catch(e){if(target.isConnected)target.innerHTML=`<p class="notice" role="alert">${esc(message(e.message))}</p>`;}
 finally{clearTimeout(timer);observer.disconnect();button.disabled=false;}
}
export function takeRefresh(){
 if(!pending||Date.now()-pending.created>600000||pending.key!==snapshotKey(state.trip,state.active,state.scenario)){
  const target=document.querySelector('#refresh-result');if(target)target.innerHTML=`<p class="notice" role="alert">${message('STALE')}</p>`;pending=null;return null;
 }
 const result=pending;pending=null;return result;
}
