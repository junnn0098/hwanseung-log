import {PLACES} from './data.js?v=1.2.2';
import {createWorkspaceStore,PERSONAL_STORAGE} from './workspace.js?v=1.2.2';
export const STORAGE=PERSONAL_STORAGE;
export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const defaultTrip=()=>({date:today(),arrival:'08:00',departure:'18:30',nextDay:false,airport:'ICN',terminal:'T1',immigration:75,security:180,buffer:45,recheck:false,entry:'unknown',transport:'train',budget:60000,interests:['culture','nature'],flight:''});
let browserStorage;try{browserStorage=globalThis.localStorage;}catch{}
const store=createWorkspaceStore(browserStorage);
const mode=store.mode(globalThis.location?.hash||'');
function workspaceData(mode){
 let saved=store.read(mode);
 const legacy=store.read('personal');
 if(mode==='demo'&&saved.version!==1&&legacy.sample)saved={...legacy,trip:defaultTrip(),active:null,baseline:null,scenario:{},history:[],note:'',sample:true};
 if(mode==='personal'&&saved.sample)saved={...saved,trip:defaultTrip(),active:null,baseline:null,scenario:{},history:[],note:'',sample:false};
 return {trip:{...defaultTrip(),...(saved.trip||{})},favorites:Array.isArray(saved.favorites)?saved.favorites.filter(x=>typeof x==='string'):[],logs:Array.isArray(saved.logs)?saved.logs.filter(x=>x&&x.route&&Array.isArray(x.route.ids)).slice(0,50):[],active:saved.active&&Array.isArray(saved.active.ids)?saved.active:null,scenario:saved.scenario||{},baseline:saved.baseline||null,history:Array.isArray(saved.history)?saved.history.slice(-20):[],sample:mode==='demo',note:saved.note||'',checklist:saved.checklist||{},flights:Array.isArray(saved.flights)?saved.flights:[],demoScene:saved.demoScene||'base'};
}
const saved=store.read(mode);
export const state={lang:(saved.lang||store.read('personal').lang)==='en'?'en':'ko',mode,page:'home',...workspaceData(mode),filter:'all',region:'all',search:'',indoorOnly:false,logTab:'trips',editPlan:false,result:null,weather:null,weatherStatus:'idle',apiStatus:'unknown',apiCheckedAt:null,apiPartial:false,livePlaces:[],loadingPlaces:false,mobileMenu:false};
export function persist(){state.sample=state.mode==='demo';return store.write(state.mode,{version:1,lang:state.lang,trip:state.trip,favorites:state.favorites,logs:state.logs,active:state.active,scenario:state.scenario,baseline:state.baseline,history:state.history,sample:state.sample,note:state.note,checklist:state.checklist,flights:state.flights,demoScene:state.demoScene});}
export function switchWorkspace(mode){
 if(state.mode===mode)return;
 persist();Object.assign(state,workspaceData(mode),{mode,result:null,editPlan:false,weather:null,weatherStatus:'idle'});
}
export const clearWorkspaces=()=>store.clear();
export function t(ko,en){return state.lang==='en'?en:ko;}
export function name(p){return state.lang==='en'?p?.en:p?.name;}
export function regionName(region){return ({seoul:t('서울','Seoul'),songdo:t('송도','Songdo'),incheon:t('인천','Incheon'),magok:t('마곡','Magok'),yeongjong:t('영종도','Yeongjong')})[region]||region;}
export function money(n){return state.lang==='en'?`₩${Math.round(n).toLocaleString('en-US')}`:`${Math.round(n).toLocaleString('ko-KR')}원`;}
export function catalog(){return PLACES.map(p=>{const live=state.livePlaces.find(v=>v.curatedId===p.id);return live?{...p,liveTitle:live.name,liveImage:live.image,liveAddress:live.address,contentid:live.contentid,contenttypeid:live.contenttypeid,live:true}:p;});}
export function placeById(id){return catalog().find(p=>p.id===id)||PLACES.find(p=>p.id===id);}
