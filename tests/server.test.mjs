import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp,tourism,normalizePlace} from '../server.mjs';
import {createRequestGuard} from '../request-guard.mjs';
const server=createApp({guard:createRequestGuard()});
test('missing tourism credentials are explicit',async()=>{const r=await tourism('areaBasedList2',{},'');assert.equal(r.status,503);assert.equal(r.data.live,false);});
test('upstream metadata does not contain invented opening hours',()=>{const p=normalizePlace({contentid:'123',title:'Place',mapx:'126',mapy:'37',firstimage:'javascript:bad',contenttypeid:'14'});assert.equal(p.image,null);assert.equal(p.open,undefined);assert.equal(p.category,'culture');});
test('static server denies file traversal and exposes JSON API status',async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;try{assert.equal((await fetch(origin+'/')).status,200);const status=await(await fetch(origin+'/api/status')).json();assert.equal(typeof status.tourismConfigured,'boolean');assert.equal((await fetch(origin+'/api/detail?id=bad')).status,400);assert.equal((await fetch(origin+'/%2e%2e%5c.env')).status,403);assert.equal((await fetch(origin+'/api/missing')).status,404);}finally{await new Promise(resolve=>server.close(resolve));}});
