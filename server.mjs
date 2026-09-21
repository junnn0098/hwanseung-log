import {tourism as fetchTourism,normalizePlace,tourismCatalog,tourismDetail} from './tourism.mjs';
import {flights,directions} from './integrations.mjs';
import {setDefaultResultOrder} from 'node:dns';
setDefaultResultOrder('ipv4first');
import http from 'node:http';
import {createRequestGuard} from './request-guard.mjs';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('./public/',import.meta.url));
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'};
const send=(res,status,body,headers={})=>{res.writeHead(status,{'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin',...headers});res.end(body);};
const json=(res,status,data)=>send(res,status,JSON.stringify(data),{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
export const tourism=(path,params,key=process.env.TOUR_API_KEY)=>fetchTourism(path,params,{key,base:process.env.TOUR_API_BASE||'https://apis.data.go.kr/B551011/KorService2'});
export {normalizePlace};
const envLimit=(name,fallback)=>/^\d+$/.test(process.env[name]||'')?Number(process.env[name]):fallback;
export function createApp({guard=createRequestGuard({file:process.env.QUOTA_FILE||resolve('data/api-usage.json'),trustProxy:process.env.TRUST_PROXY==='true',limits:{transit:envLimit('ODSAY_DAILY_LIMIT',30),car:envLimit('KAKAO_DAILY_LIMIT',500),flights:envLimit('AIRPORT_DAILY_LIMIT',500),tourism:envLimit('TOUR_DAILY_LIMIT',500)}}),flightProvider=flights,directionProvider=directions,tourProvider=tourism}={}){
 return http.createServer(async(req,res)=>{
  let ticket;
  try{
   const url=new URL(req.url,'http://localhost');
   if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'Method not allowed'});
   if(url.pathname==='/healthz')return json(res,200,{ok:true});
   if(url.pathname==='/api/status')return json(res,200,{tourismConfigured:!!process.env.TOUR_API_KEY,airportConfigured:!!process.env.AIRPORT_API_KEY,transitConfigured:!!process.env.ODSAY_API_KEY,carConfigured:!!process.env.KAKAO_REST_API_KEY});
   const resource={'/api/flights':'flights','/api/directions':url.searchParams.get('mode')==='transit'?'transit':'car','/api/places':'tourism','/api/detail':'tourism'}[url.pathname];
   if(resource){
    if(req.method!=='GET')return json(res,405,{error:'Use GET for API queries'});
    if(url.pathname==='/api/detail'&&(!/^\d{1,12}$/.test(url.searchParams.get('id')||'')||!['12','14'].includes(url.searchParams.get('type'))))return json(res,400,{live:false,code:'INVALID_QUERY'});
    ticket=guard.begin(req,resource,url.pathname==='/api/places'?8:url.pathname==='/api/detail'?2:1);
    if(!ticket.ok){res.setHeader('Retry-After',String(ticket.retryAfter));return json(res,ticket.status,{live:false,code:ticket.code});}
   }
   if(url.pathname==='/api/flights'){const r=await flightProvider(url.searchParams);return json(res,r.status,r.data);}
   if(url.pathname==='/api/directions'){const r=await directionProvider(url.searchParams);return json(res,r.status,r.data);}
   if(url.pathname==='/api/places'){
    if(!process.env.TOUR_API_KEY)return json(res,503,{live:false,code:'NOT_CONFIGURED'});
    const r=await tourismCatalog((path,params)=>tourProvider(path,params));return json(res,r.status,r.data);
   }
   if(url.pathname==='/api/detail'){
    const r=await tourismDetail(url.searchParams.get('id'),url.searchParams.get('type'),(path,params)=>tourProvider(path,params));return json(res,r.status,r.data);
   }
   if(url.pathname.startsWith('/api/'))return json(res,404,{error:'Not found'});
   const pathname=decodeURIComponent(url.pathname),file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
   if(!file.startsWith(root.endsWith(sep)?root:root+sep))return send(res,403,'Forbidden');
   const info=await stat(file);if(!info.isFile())return send(res,404,'Not found');
   const content=req.method==='HEAD'?null:await readFile(file);
   return send(res,200,content,{'Content-Type':MIME[extname(file)]||'application/octet-stream','Cache-Control':file.endsWith('sw.js')||file.endsWith('.html')?'no-cache':'public, max-age=300'});
  }catch(err){send(res,err.code==='ENOENT'?404:500,err.code==='ENOENT'?'Not found':'Request failed');}
  finally{ticket?.finish?.();}
 });
}
export const server=createApp();
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const port=Number(process.env.PORT)||4173,host=process.env.HOST||'127.0.0.1';
 server.requestTimeout=30000;server.headersTimeout=10000;
 server.listen(port,host,()=>console.log(`Hwanseung Log ready: http://${host}:${port}`));
 const shutdown=()=>{server.close(()=>process.exit(0));setTimeout(()=>process.exit(1),30000).unref();};
 process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
}
