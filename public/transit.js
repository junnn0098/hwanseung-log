// Shared by the Node proxy and the browser's domain-authorized ODsay integration.
export function transitResult(j){
 if(j.error)return {status:502,data:{live:false,code:'UPSTREAM_UNAVAILABLE'}};
 if(!Array.isArray(j.result?.path))return {status:404,data:{live:false,code:'NO_ROUTE'}};
 const routes=j.result.path.filter(p=>Number.isFinite(p.info?.totalTime)).slice(0,3).map(p=>({minutes:p.info.totalTime,fare:Number.isFinite(p.info.payment)&&p.info.payment>=0?p.info.payment:null,steps:(p.subPath||[]).map(s=>({type:s.trafficType,minutes:s.sectionTime,from:s.startName||'',to:s.endName||'',line:s.lane?.[0]?.name||s.lane?.[0]?.busNo||''}))}));
 return {status:200,data:{live:true,fetchedAt:new Date().toISOString(),source:'ODsay',mode:'transit',routes}};
}
