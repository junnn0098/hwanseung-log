import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceStore,PERSONAL_STORAGE,DEMO_STORAGE,MODE_STORAGE} from '../public/workspace.js';
import {demoSession,demoResult} from '../public/demo.js';
const base={date:'2026-09-21',arrival:'08:00',departure:'18:30',nextDay:false,airport:'ICN',terminal:'T1',immigration:75,security:180,buffer:45,recheck:false,entry:'unknown',transport:'train',budget:60000,interests:['culture','nature']};
const storage=()=>{const data=new Map();return {getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};};

test('home opens personal mode while the demo link and a resumed plan respect explicit mode choice',()=>{
 const disk=storage(),store=createWorkspaceStore(disk);
 assert.equal(store.mode(),'personal');assert.equal(store.mode('#plan'),'personal');
 disk.setItem(PERSONAL_STORAGE,JSON.stringify({version:1,sample:false,trip:{date:'2026-09-25'}}));
 assert.equal(store.mode(),'personal');assert.equal(store.mode('#demo'),'demo');
 disk.setItem(MODE_STORAGE,'personal');assert.equal(store.mode('#home'),'personal');
 disk.setItem(MODE_STORAGE,'demo');assert.equal(store.mode(),'personal');assert.equal(store.mode('#home'),'personal');assert.equal(store.mode('#plan'),'demo');
});
test('demo edits and reset never replace personal trip, notes, bookmarks or logs',()=>{
 const disk=storage(),store=createWorkspaceStore(disk),personal={version:1,sample:false,trip:base,note:'My own trip',favorites:['palace'],logs:[{id:'private-log'}]};
 store.write('personal',personal);const original=disk.getItem(PERSONAL_STORAGE);
 store.write('demo',{version:1,...demoSession(base),note:'Demo note'});
 store.write('demo',{version:1,...demoSession(base)});
 assert.equal(disk.getItem(PERSONAL_STORAGE),original);assert.equal(store.read('personal').note,'My own trip');
 assert.notEqual(disk.getItem(DEMO_STORAGE),null);
 const reloaded=createWorkspaceStore(disk);assert.equal(reloaded.mode('#plan'),'demo');assert.equal(reloaded.mode(),'personal');assert.deepEqual(reloaded.read('personal'),personal);
});
test('demo remains usable when browser storage is denied',()=>{
 const store=createWorkspaceStore({getItem(){throw Error();},setItem(){throw Error();}});
 assert.equal(store.mode(),'personal');assert.equal(store.mode('#demo'),'demo');assert.equal(store.write('personal',{version:1,note:'Keep in memory'}),false);
 store.write('demo',{version:1,note:'Sample'});assert.equal(store.read('personal').note,'Keep in memory');
});
test('all demo situations reproduce without network calls across weekday and year boundaries',()=>{
 for(const date of ['2026-09-21','2026-09-23','2026-09-26','2026-12-31']){
  const b={...base,date},normal=demoSession(b);
  assert.ok(normal.active);assert.deepEqual(normal.active.ids,['songdo','writing']);assert.ok(normal.trip.date>=date);
  const rain=demoResult(b,'rain'),delay=demoResult(b,'delay'),back=demoResult(b,'return');
  assert.equal(rain.result.routes[0].ids.includes('songdo'),false);
  assert.equal(delay.result.routes[0].ids.includes('writing'),true);
  assert.ok(delay.result.routes[0].events[0].start>rain.result.routes[0].events[0].start);
  assert.equal(back.result.routes.length,0);assert.equal(back.scenario.currentPlace,'writing');
 }
});
