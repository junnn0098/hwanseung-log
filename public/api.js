import {transitResult} from './transit.js?v=1.2.2';
const failed=()=>({ok:false,status:502,data:{live:false,code:'UPSTREAM_UNAVAILABLE'}});
export async function requestApi(kind,params,{signal,fetcher=fetch}={}){
 const p=new URLSearchParams(params),res=await fetcher(`/api/${kind}?${p}`,{signal}),data=await res.json();
 if(!res.ok||data.code!=='BROWSER_TRANSIT')return {ok:res.ok,status:res.status,data};
 if(kind!=='directions'||p.get('mode')!=='transit'||typeof data.webKey!=='string'||!data.webKey)return failed();
 const coords=value=>{if(!/^[-\d.]+,[-\d.]+$/.test(value||''))return null;const v=value.split(',').map(Number);return v.length===2&&v.every(Number.isFinite)&&v[0]>=124&&v[0]<=132&&v[1]>=33&&v[1]<=39?v:null;};
 const origin=coords(p.get('origin')),destination=coords(p.get('destination'));if(!origin||!destination)return failed();
 // This branch accepts a separately issued Web key only. The URL is fixed, and
 // the browser supplies its genuine Origin/Referer for ODsay domain validation.
 const url=new URL('https://api.odsay.com/v1/api/searchPubTransPathT');
 let key=data.webKey;try{key=decodeURIComponent(key);}catch{}
 Object.entries({apiKey:key,SX:origin[0],SY:origin[1],EX:destination[0],EY:destination[1],lang:p.get('lang')==='en'?1:0}).forEach(([k,v])=>url.searchParams.set(k,String(v)));
 try{
  const upstream=await fetcher(url,{signal,referrerPolicy:'strict-origin-when-cross-origin'});if(!upstream.ok)return failed();
  const result=transitResult(await upstream.json());return {ok:result.status===200,...result};
 }catch{return failed();}
}
