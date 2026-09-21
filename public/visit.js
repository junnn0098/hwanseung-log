import {state,t,name,placeById} from './state.js?v=1.2.2';
import {icon,button} from './components.js?v=1.2.2';
import {escapeHTML as esc,clock} from './engine.js?v=1.2.2';
import {returnReadiness} from './readiness.js?v=1.2.2';

// Current-page display state only; provider records never enter localStorage.
const details=new Map();
export const getVisitInfo=id=>details.get(id);
export async function fetchVisitInfo(place,{force=false}={}){
 const previous=details.get(place.id);
 if(previous?.loading||(!force&&previous?.detail&&Date.now()-Date.parse(previous.detail.fetchedAt)<300000))return;
 if(!place.contentid||!place.contenttypeid){details.set(place.id,{error:'NOT_MATCHED'});return;}
 details.set(place.id,{loading:true});
 try{
  const r=await fetch(`/api/detail?${new URLSearchParams({id:place.contentid,type:place.contenttypeid})}`,{signal:AbortSignal.timeout(20000)}),data=await r.json();
  if(!r.ok||!data.live||!data.detail)throw Error(data.code||'UNAVAILABLE');
  details.set(place.id,{detail:data.detail,partial:data.partial});
 }catch(e){details.set(place.id,{error:e.message});}
}
const stamp=iso=>new Date(iso).toLocaleString(state.lang==='ko'?'ko-KR':'en-GB',{timeZone:'Asia/Seoul',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})+' KST';
export function visitSection(p){
 const info=getVisitInfo(p.id),d=info?.detail,loading=!info||info.loading;
 const retry=button(icon('refresh-cw')+t('운영정보 다시 확인','Refresh visitor information'),'load-visit','small',`data-id="${esc(p.id)}" ${loading?'disabled':''}`);
 const message=loading?t('관광공사의 운영정보를 확인하고 있어요…','Checking visitor information…'):info?.error==='DAILY_LIMIT'?t('오늘 조회 한도에 도달했어요. 아래 공식 안내를 확인해 주세요.','Today’s query limit has been reached. Use the official link below.'):t('운영정보를 확인하지 못했어요. 공식 안내에서 방문일 운영 여부를 확인해 주세요.','Visitor information is unavailable. Check the official website for your visit date.');
 const fields=[[t('운영시간','Opening hours'),d?.hours],[t('휴관·쉬는 날','Closures'),d?.closed],[t('입장료 안내','Admission'),d?.fee],[t('문의','Contact'),d?.phone]];
 return `<section class="visit-brief" aria-label="${t('방문 전 운영정보','Visitor information')}"><div class="visit-brief-heading"><div><span class="eyebrow">BEFORE YOU GO</span><h3>${t('헛걸음 없는 작은 여행','Know before you go')}</h3></div><span class="tag ${d?'sage':'outline'}">${d?t('공식 데이터 조회','Source checked'):loading?t('확인 중','Checking'):t('확인 필요','Check required')}</span></div>${d?`<div class="visit-facts">${fields.map(([label,value])=>`<div><span>${label}</span><p>${esc(value||t('제공 정보 없음 · 공식 안내 확인','Not supplied · check official information'))}</p></div>`).join('')}</div><p class="field-note">${state.lang==='en'?'Source information is provided in Korean. ':''}${t('조회','Checked')} ${esc(stamp(d.fetchedAt))} · ${t('출처: ⓒ한국관광공사','Source: ⓒKorea Tourism Organization')}</p>${d.overview?`<details class="visit-description"><summary>${t('공식 장소 소개 읽기','Read the destination description')}</summary><p>${esc(d.overview)}</p></details>`:''}<p class="field-note">${t('임시 휴관·공휴일 예외는 방문일에 다시 확인하세요. 아래 계획값과 다르면 장소를 제외하거나 여행 조건을 조정하세요.','Recheck temporary closures and holiday exceptions. If these details differ from the estimates below, remove the stop or adjust your trip.')}</p>`:`<p class="notice">${loading?'<span class="spinner"></span>':''}${message}</p>`}<div class="button-row mt-20">${retry}${d?.homepage?`<a class="text-link" href="${esc(d.homepage)}" target="_blank" rel="noopener">${t('제공기관 홈페이지','Destination website')}${icon('arrow-up-right')}</a>`:''}${state.active?.ids.includes(p.id)?button(t('방문이 어렵다면 이 장소 제외','Remove this stop if unavailable'),'skip-place','small',`data-id="${esc(p.id)}"`):''}</div></section>`;
}
export function returnBoard(){
 const r=state.active,m=returnReadiness(state.trip,r,{sample:state.sample});if(!m)return '';
 const labels={sample:['예시 일정 · 시간 흐름 미반영','Sample itinerary'],future:['여행일 전에 다시 확인해요','Recheck before your travel day'],deadline:['복귀 기준 시각이 지났어요','Return deadline has passed'],return:['계획상 공항으로 출발할 시간','Time to start your planned return'],soon:['복귀 출발이 가까워요','Your planned return is approaching'],planned:['돌아오는 길까지 계획했어요','Your return is part of the plan']};
 const checked={fresh:['10분 이내 교통 조회 반영','Transport checked within 10 min'],stale:['교통정보 다시 확인 필요','Transport needs a refresh'],estimate:['이동시간은 계획 추정값','Travel time uses planning estimates']};
 return `<section class="return-board ${['deadline','return','soon'].includes(m.state)?'attention':''}"><div class="return-board-top"><span class="eyebrow">A LITTLE ROOM TO RETURN</span>${icon('plane-takeoff')}</div><h3>${t(...labels[m.state])}</h3><div class="return-clocks"><div><span>${t('계획상 복귀 출발','Planned return departure')}</span><strong>${clock(m.leave)}</strong></div><span class="return-clock-arrow">→</span><div><span>${t('공항 도착 기준','Airport arrival deadline')}</span><strong>${clock(m.cutoff)}</strong></div></div><p>${t(...checked[m.transport])}</p><div class="return-board-actions">${button(t('공항으로 가는 길 확인','Check the way back'),'return-directions','small',`data-id="${esc(state.scenario.currentPlace||r.ids.at(-1))}"`)}${state.mode==='demo'?button(t('내 일정으로 시작하기','Use my own trip'),'personal-mode','ghost small'):button(t('지금 정보로 다시 계산','Refresh itinerary'),'refresh-plan','ghost small')}</div><small>${t('입력한 일정 기준입니다. 현재 위치·탑승 가능 여부를 자동 판정하지 않아요.','Based on your itinerary. Your location and boarding eligibility are not automatically verified.')}</small></section>`;
}
export function visitChecklist(){
 if(!state.active)return '';
 return `<section class="visit-checklist"><div><span class="eyebrow">ONE MORE LITTLE CHECK</span><h3>${t('떠나기 전, 문이 열리는지','Before heading out, check the doors')}</h3><p>${t('장소별 운영시간·휴관일·입장료를 확인하세요.','Check each stop’s hours, closures and admission.')}</p></div>${state.active.ids.map(id=>{const p=placeById(id),d=getVisitInfo(id)?.detail;return `<button class="visit-check-row" data-action="place" data-id="${esc(id)}"><span>${icon(d?'file-check-2':'clock-3')}${esc(name(p))}</span><span>${d?t('조회 내용 보기','View source'):t('운영정보 확인','Check details')}${icon('arrow-up-right')}</span></button>`;}).join('')}</section>`;
}
