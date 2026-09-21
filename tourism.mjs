import {PLACES} from './public/data.js';
export async function tourism(path,params,{key='',base='https://apis.data.go.kr/B551011/KorService2',fetcher=fetch}={}){
 if(!key)return {status:503,data:{live:false,code:'NOT_CONFIGURED'}};
 const url=new URL(`${base.replace(/\/$/,'')}/${path}`);
 if(url.protocol!=='https:'||url.hostname!=='apis.data.go.kr')return {status:503,data:{live:false,code:'INVALID_API_BASE'}};
 let decoded=key;try{decoded=decodeURIComponent(key);}catch{}
 Object.entries({serviceKey:decoded,MobileOS:'ETC',MobileApp:'HwanseungLog',_type:'json',numOfRows:24,pageNo:1,...params}).forEach(([k,v])=>url.searchParams.set(k,String(v)));
 try{const response=await fetcher(url,{signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error();const data=await response.json();if(data.response?.header?.resultCode!=='0000'&&data.response?.header?.resultCode!=='00')throw Error();const raw=data.response?.body?.items?.item||[],items=Array.isArray(raw)?raw:[raw];return {status:200,data:{live:true,items,fetchedAt:new Date().toISOString(),source:'ⓒ한국관광공사'}};}catch{return {status:502,data:{live:false,code:'UPSTREAM_UNAVAILABLE'}};}
}
export function normalizePlace(p){const types={'12':'nature','14':'culture','15':'culture','28':'rest','38':'shopping','39':'food'};const image=/^https?:\/\//.test(p.firstimage||'')?p.firstimage.replace(/^http:/,'https:'):null;return {id:`kto-${p.contentid}`,contentid:String(p.contentid),name:String(p.title||''),en:String(p.title||''),category:types[p.contenttypeid]||'culture',region:p.areacode==='1'?'seoul':'incheon',lat:+p.mapy,lng:+p.mapx,live:true,indoor:false,image,liveImage:image,address:String(p.addr1||''),tags:['한국관광공사'],tagsEn:['Korea Tourism Organization'],sub:'한국관광공사에서 불러온 장소',subEn:'From Korea Tourism Organization',source:'https://english.visitkorea.or.kr/'};}

export const TOUR_QUERIES=PLACES.map(p=>({...p,type:['museum','writing'].includes(p.id)?'14':'12',keyword:({insadong:'인사동',seaside:'씨사이드파크'})[p.id]||p.name,aliases:({insadong:['인사동','인사동거리','인사동문화의거리'],seaside:['씨사이드파크','영종씨사이드파크']})[p.id]||[p.name]}));
const compact=s=>String(s||'').replace(/[\s·()\[\]]/g,'');
export function matchTourismPlace(items,query){
 // A matching name is insufficient: restaurants and events can share a landmark's name.
 const matches=items.filter(p=>query.aliases.some(a=>compact(a)===compact(p.title))&&String(p.contenttypeid)===query.type&&Number.isFinite(+p.mapx)&&Number.isFinite(+p.mapy)&&Math.hypot((+p.mapx-query.lng)*88,(+p.mapy-query.lat)*111)<3);
 return matches.sort((a,b)=>Math.hypot(+a.mapx-query.lng,+a.mapy-query.lat)-Math.hypot(+b.mapx-query.lng,+b.mapy-query.lat))[0];
}
export async function tourismCatalog(provider=tourism,options){
 const results=await Promise.all(TOUR_QUERIES.map(async q=>{
  const r=await provider('searchKeyword2',{keyword:q.keyword,contentTypeId:q.type,numOfRows:20},options);
  const raw=r.data.live?matchTourismPlace(r.data.items||[],q):null;
  return raw?{...normalizePlace(raw),curatedId:q.id,contenttypeid:q.type}:null;
 }));
 const places=results.filter(Boolean);
 return places.length?{status:200,data:{live:true,partial:places.length<TOUR_QUERIES.length,places,matchedCount:places.length,totalCount:TOUR_QUERIES.length,fetchedAt:new Date().toISOString(),source:'ⓒ한국관광공사'}}:{status:502,data:{live:false,code:'UPSTREAM_UNAVAILABLE'}};
}
export function plainTourText(value){return String(value||'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<br\s*\/?>|<\/(p|div|li)>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"').replace(/&#39;/g,"'").trim().slice(0,6000);}
export function normalizeTourDetail(common,intro={},fetchedAt=new Date().toISOString()){
 const first=(...keys)=>plainTourText(keys.map(k=>intro[k]).find(v=>String(v||'').trim())||'');
 const homepage=String(common.homepage||'').match(/https?:\/\/[^\s"'<>]+/i)?.[0]||'';
 return {contentid:String(common.contentid),contenttypeid:String(common.contenttypeid),title:plainTourText(common.title),address:plainTourText([common.addr1,common.addr2].filter(Boolean).join(' ')),overview:plainTourText(common.overview),homepage,phone:first('infocenter','infocenterculture','infocenterleports','infocenterfood','infocentershopping')||plainTourText(common.tel),hours:first('usetime','usetimeculture','usetimeleports','opentimefood','opentime'),closed:first('restdate','restdateculture','restdateleports','restdatefood','restdateshopping'),fee:first('usefee','usefeeleports'),access:first('chkpet','chkpetculture','chkpetleports'),modifiedAt:String(common.modifiedtime||''),fetchedAt,source:'ⓒ한국관광공사'};
}
export async function tourismDetail(id,type,provider=tourism,options){
 if(!/^\d{1,12}$/.test(id||'')||!['12','14'].includes(type))return {status:400,data:{live:false,code:'INVALID_QUERY'}};
 const [common,intro]=await Promise.all([provider('detailCommon2',{contentId:id},options),provider('detailIntro2',{contentId:id,contentTypeId:type},options)]);
 const item=common.data.items?.find(p=>String(p.contentid)===id&&String(p.contenttypeid)===type);
 if(!common.data.live||!item)return {status:502,data:{live:false,code:'UPSTREAM_UNAVAILABLE'}};
 const extra=intro.data.items?.find(p=>String(p.contentid)===id)||{};
 return {status:200,data:{live:true,partial:!intro.data.live,detail:normalizeTourDetail(item,extra),source:'ⓒ한국관광공사'}};
}
