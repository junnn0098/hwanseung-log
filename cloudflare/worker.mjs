import {DurableObject} from 'cloudflare:workers';
import {handleApi,apiStatus,json} from './api.mjs';
import {createDurableGuard,limitsFrom} from './quota.mjs';

export class ApiGate extends DurableObject {
 constructor(ctx,env){super(ctx,env);this.guard=createDurableGuard(ctx.storage,{limits:limitsFrom(env)});}
 async fetch(request){return handleApi(request,this.env,this.guard);}
}
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(!['GET','HEAD'].includes(request.method))return json(405,{live:false,code:'METHOD_NOT_ALLOWED'},{Allow:'GET, HEAD'});
  if(url.pathname==='/healthz')return json(200,{ok:true,runtime:'cloudflare-workers'});
  if(url.pathname==='/api/status')return json(200,apiStatus(env));
  if(url.pathname.startsWith('/api/')){
   if(request.method!=='GET')return json(405,{live:false,code:'METHOD_NOT_ALLOWED'},{Allow:'GET'});
   try{
    // Ignore all client-supplied forwarding/hash headers. Cloudflare sets this IP.
    const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(request.headers.get('CF-Connecting-IP')||'unknown'));
    const hash=Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
    const gate=env.API_GATE.getByName('hwanseung-log-api-v1');
    return await gate.fetch(new Request(url,{headers:{'X-Client-Hash':hash}}));
   }catch{return json(503,{live:false,code:'QUOTA_UNAVAILABLE'},{'Retry-After':'60'});}
  }
  return env.ASSETS.fetch(request);
 }
};
