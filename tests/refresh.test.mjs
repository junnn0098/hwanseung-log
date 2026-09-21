import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRoute} from '../public/engine.js';
import {refreshPlan,journeyLegs} from '../public/refresh-engine.js';
const trip={date:'2026-10-07',arrival:'07:00',departure:'20:00',airport:'ICN',terminal:'T1',nextDay:false,recheck:false,immigration:75,security:180,buffer:45,entry:'confirmed',transport:'taxi',budget:150000,interests:['nature','culture']};
const now=new Date('2026-10-07T08:15:00+09:00'),route=buildRoute(['songdo','writing'],trip);
const legs=journeyLegs(trip,route).map((l,i)=>({from:l.from.id,to:l.to.id,minutes:[40,15,45][i],fare:20000}));
const update=overrides=>refreshPlan({trip,route,legs,now,...overrides});
test('all queried legs, fares and current time are reflected without persisting provider legs',()=>{
 const r=update({now:new Date('2026-10-07T10:00:00+09:00')});
 assert.ok(r.route);assert.equal(r.route.events[0].start,640);
 assert.equal(r.route.events[1].start-r.route.events[0].end,15);
 assert.equal(r.route.back-r.route.events[1].end,45);
 assert.equal(r.route.cost,60000);assert.equal(r.scenario.measuredLegs,undefined);
});
test('delayed departures never extend the deadline, earlier departures shorten it',()=>{
 const flight={scheduled:'20:00',estimated:'21:00',terminal:'P01'};
 assert.equal(update({departureFlight:flight}).route.cutoff,route.cutoff);
 assert.equal(update({departureFlight:{...flight,estimated:'19:30'}}).route.cutoff,route.cutoff-30);
 assert.equal(update({scenario:{departureCap:19*60},departureFlight:flight}).route.cutoff,19*60-225);
});
test('arrival delays reduce available time and late return cannot be applied',()=>{
 const r=update({arrivalFlight:{scheduled:'07:00',estimated:'09:00'}});
 assert.ok(r.route.events[0].start>=9*60+75+40);
 assert.equal(update({legs:legs.map(l=>({...l,minutes:300}))}).code,'NO_FIT');
 assert.equal(update({trip:{...trip,budget:1000}}).code,'NO_FIT');
 assert.equal(update({now:new Date('2026-10-07T18:00:00+09:00')}).code,'NO_FIT');
});
test('rejects partial routes, unknown fares, wrong legs, future trips and midnight ambiguity',()=>{
 assert.equal(update({legs:legs.slice(1)}).code,'INCOMPLETE_ROUTES');
 assert.equal(update({legs:legs.map(l=>({...l,fare:null}))}).code,'INCOMPLETE_ROUTES');
 assert.equal(update({legs:[...legs].reverse()}).code,'INCOMPLETE_ROUTES');
 assert.equal(update({trip:{...trip,date:'2026-10-08'}}).code,'TODAY_ONLY');
 assert.equal(update({trip:{...trip,arrival:'20:00',departure:'10:00',nextDay:true}}).code,'TODAY_ONLY');
 assert.equal(update({departureFlight:{scheduled:'20:00',estimated:'00:30'}}).code,'FLIGHT_TIME_CHECK');
});
test('cancelled flights and mismatched terminals block application',()=>{
 assert.equal(update({arrivalFlight:{status:'결항'}}).code,'FLIGHT_ATTENTION');
 assert.equal(update({departureFlight:{status:'Departed'}}).code,'FLIGHT_ATTENTION');
 assert.equal(update({departureFlight:{scheduled:'20:00',terminal:'P03'}}).code,'TERMINAL_CHECK');
});
test('outside journeys start at the selected place and respect remaining money',()=>{
 const scenario={currentPlace:'songdo',currentTime:'12:00',remainingBudget:50000};
 const path=journeyLegs(trip,route,scenario);
 assert.equal(path[0].from.id,'songdo');
 const currentLegs=path.map((l,i)=>({from:l.from.id,to:l.to.id,minutes:i===0?0:20,fare:i===0?0:20000}));
 assert.ok(update({scenario,legs:currentLegs}).route);
 assert.equal(update({scenario:{...scenario,remainingBudget:30000},legs:currentLegs}).code,'NO_FIT');
});
