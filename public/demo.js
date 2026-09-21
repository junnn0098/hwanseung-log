import {buildRoute,generateRoutes} from './engine.js?v=1.2.2';

export function demoTrip(base){
 const date=new Date(base.date+'T12:00:00+09:00');
 date.setUTCDate(date.getUTCDate()+(3-date.getUTCDay()+7)%7);
 return {...base,date:date.toISOString().slice(0,10),entry:'confirmed',arrival:'07:00',departure:'20:00',nextDay:false,recheck:false,airport:'ICN',terminal:'T1',interests:['nature','culture'],transport:'taxi',budget:150000,flight:''};
}
export function demoSession(base){
 const trip=demoTrip(base),active=buildRoute(['songdo','writing'],trip);
 return {trip,active,baseline:structuredClone(active),scenario:{},history:[],note:'',sample:true,result:null,editPlan:false,weather:null,weatherStatus:'idle',demoScene:'base'};
}
export function demoScenario(kind){
 if(kind==='rain')return {weather:'rain'};
 if(kind==='delay')return {weather:'rain',delay:90};
 if(kind==='return')return {currentPlace:'writing',currentTime:'15:30',remainingBudget:50000};
 return {};
}
export function demoResult(base,kind){const session=demoSession(base),scenario=demoScenario(kind);return {session,scenario,result:generateRoutes(session.trip,scenario)};}
