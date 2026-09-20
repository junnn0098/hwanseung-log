import {PLACES} from './data.js?v=1.0.1';
export const STORAGE='hwanseung-log-v1';
export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const defaultTrip=()=>({date:today(),arrival:'08:00',departure:'18:30',nextDay:false,airport:'ICN',terminal:'T1',immigration:75,security:180,buffer:45,recheck:false,entry:'unknown',transport:'train',budget:60000,interests:['culture','nature'],flight:''});
function read(){try{const v=JSON.parse(localStorage.getItem(STORAGE)||'null');return v&&typeof v==='object'&&v.version===1?v:{};}catch{return {};}}
const saved=read();
export const state={lang:saved.lang==='en'?'en':'ko',page:'home',trip:{...defaultTrip(),...(saved.trip||{})},favorites:Array.isArray(saved.favorites)?saved.favorites.filter(x=>typeof x==='string'):[],logs:Array.isArray(saved.logs)?saved.logs.filter(x=>x&&x.route&&Array.isArray(x.route.ids)).slice(0,50):[],active:saved.active&&Array.isArray(saved.active.ids)?saved.active:null,scenario:saved.scenario||{},baseline:saved.baseline||null,history:Array.isArray(saved.history)?saved.history.slice(-20):[],sample:!!saved.sample,note:saved.note||'',filter:'all',region:'all',search:'',indoorOnly:false,logTab:'trips',editPlan:false,result:null,weather:null,weatherStatus:'idle',apiStatus:'unknown',livePlaces:[],loadingPlaces:false,checklist:saved.checklist||{},flights:Array.isArray(saved.flights)?saved.flights:[],mobileMenu:false};
export function persist(){try{localStorage.setItem(STORAGE,JSON.stringify({version:1,lang:state.lang,trip:state.trip,favorites:state.favorites,logs:state.logs,active:state.active,scenario:state.scenario,baseline:state.baseline,history:state.history,sample:state.sample,note:state.note,checklist:state.checklist,flights:state.flights}));return true;}catch{return false;}}
export function t(ko,en){return state.lang==='en'?en:ko;}
export function name(p){return state.lang==='en'?p?.en:p?.name;}
export function regionName(region){return ({seoul:t('서울','Seoul'),songdo:t('송도','Songdo'),incheon:t('인천','Incheon'),magok:t('마곡','Magok'),yeongjong:t('영종도','Yeongjong')})[region]||region;}
export function money(n){return state.lang==='en'?`₩${Math.round(n).toLocaleString('en-US')}`:`${Math.round(n).toLocaleString('ko-KR')}원`;}
export function catalog(){return [...PLACES.map(p=>{const live=state.livePlaces.find(v=>v.name?.replace(/\s/g,'').includes(p.name.replace(/\s/g,'')));return live?{...p,liveTitle:live.name,liveImage:live.image,liveAddress:live.address,contentid:live.id,live:true}:p;})];}
export function placeById(id){return catalog().find(p=>p.id===id)||PLACES.find(p=>p.id===id);}
