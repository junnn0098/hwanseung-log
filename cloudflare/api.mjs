import {flights,directions,coordinates} from '../integrations.mjs';
import {tourism,tourismCatalog,tourismDetail} from '../tourism.mjs';
export const json=(status,data,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin',...headers}});
export function apiStatus(env){return {tourismConfigured:!!env.TOUR_API_KEY,airportConfigured:!!env.AIRPORT_API_KEY,transitConfigured:!!env.ODSAY_WEB_PUBLIC_KEY,transitPlatform:'web',carConfigured:!!env.KAKAO_REST_API_KEY};}
export async function handleApi(request,env,guard,{flightProvider=flights,directionProvider=directions,tourProvider=tourism}={}){
 const url=new URL(request.url),p=url.searchParams;
 const resource={'/api/flights':'flights','/api/directions':p.get('mode')==='transit'?'transit':'car','/api/places':'tourism','/api/detail':'tourism'}[url.pathname];
 if(!resource)return json(404,{live:false,code:'NOT_FOUND'});
 if(request.method!=='GET')return json(405,{live:false,code:'METHOD_NOT_ALLOWED'},{Allow:'GET'});
 if(url.pathname==='/api/directions'&&(!coordinates(p.get('origin'))||!coordinates(p.get('destination'))||!['car','transit'].includes(p.get('mode'))))return json(400,{live:false,code:'INVALID_QUERY'});
 if(url.pathname==='/api/detail'&&(!/^\d{1,12}$/.test(p.get('id')||'')||!['12','14'].includes(p.get('type'))))return json(400,{live:false,code:'INVALID_QUERY'});
 const configured={transit:env.ODSAY_WEB_PUBLIC_KEY,car:env.KAKAO_REST_API_KEY,flights:env.AIRPORT_API_KEY,tourism:env.TOUR_API_KEY}[resource];
 if(!configured)return json(503,{live:false,code:resource==='transit'?'WEB_TRANSIT_NOT_CONFIGURED':'NOT_CONFIGURED'});
 const ticket=await guard.begin(request.headers.get('X-Client-Hash')||'unknown',resource,url.pathname==='/api/places'?8:url.pathname==='/api/detail'?2:1);
 if(!ticket.ok)return json(ticket.status,{live:false,code:ticket.code},{'Retry-After':String(ticket.retryAfter)});
 try{
  // An ODsay Web platform key is intentionally public and domain restricted.
  // Never return, reuse, or send the existing Server platform ODSAY_API_KEY here.
  if(resource==='transit')return json(200,{live:false,code:'BROWSER_TRANSIT',webKey:env.ODSAY_WEB_PUBLIC_KEY});
  if(url.pathname==='/api/flights'){const r=await flightProvider(p,{key:env.AIRPORT_API_KEY||''});return json(r.status,r.data);}
  if(resource==='car'){const r=await directionProvider(p,{kakao:env.KAKAO_REST_API_KEY||'',odsay:''});return json(r.status,r.data);}
  const options={key:env.TOUR_API_KEY||'',base:env.TOUR_API_BASE||'https://apis.data.go.kr/B551011/KorService2'};
  const r=url.pathname==='/api/detail'?await tourismDetail(p.get('id'),p.get('type'),tourProvider,options):await tourismCatalog(tourProvider,options);
  return json(r.status,r.data);
 }catch{return json(502,{live:false,code:'UPSTREAM_UNAVAILABLE'});}finally{ticket.finish();}
}
