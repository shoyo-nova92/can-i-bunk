import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyState} from './data.js';
import {loadState,saveState,createPersistence} from './storage.js';
function memory(initial=null) {let raw=initial;return {getItem:()=>raw,setItem:(_key,value)=>{raw=value;},get raw(){return raw;}};}
test('storage initializes, round-trips and preserves corrupt or unsupported originals',()=>{
  const storage=memory();assert.equal(loadState(storage).error,null);assert.equal(saveState(emptyState(),storage).ok,true);
  assert.deepEqual(loadState(storage).state,emptyState());
  for(const raw of ['broken','{"version":99,"subjects":[],"sessions":[]}']) {
    const broken=memory(raw);assert.ok(loadState(broken).error);assert.equal(broken.raw,raw);
    const session=createPersistence(broken);assert.equal(session.save(emptyState()).ok,false);assert.equal(broken.raw,raw);
    assert.equal(session.replace(emptyState()).ok,true);
  }
});
test('blocked reads, quota failures and missing storage are readable failures',()=>{
  const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('full');}};
  assert.ok(loadState(blocked).error);assert.equal(saveState(emptyState(),blocked).ok,false);
  assert.ok(loadState(null).error);
});
test('stale sessions cannot overwrite newer records even before a storage event arrives',()=>{
  const storage=memory(),first=createPersistence(storage),second=createPersistence(storage);
  assert.equal(first.save(emptyState()).ok,true);
  const before=storage.raw,result=second.save(emptyState());
  assert.equal(result.conflict,true);assert.equal(second.paused,true);assert.equal(storage.raw,before);
});
test('paused tabs preserve external saved data and only explicit recovery replaces it',()=>{
  const storage=memory(),session=createPersistence(storage);session.pause();
  assert.equal(session.save(emptyState()).ok,false);assert.equal(storage.raw,null);
  assert.equal(session.replace(emptyState()).ok,true);
});
test('async writes use the cross-tab lock and preserve rapid-edit order',async()=>{
  const storage=memory(),session=createPersistence(storage);const calls=[];
  const locks={async request(name,fn){calls.push(name);return fn();}};
  const first=session.saveAsync(emptyState(),locks),second=session.saveAsync(emptyState(),locks);
  assert.equal((await first).ok,true);assert.equal((await second).ok,true);
  assert.deepEqual(calls,['can-i-bunk.saved-state','can-i-bunk.saved-state']);
});
