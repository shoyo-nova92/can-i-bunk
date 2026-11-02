import test from 'node:test';
import assert from 'node:assert/strict';
import {createApi,createCloudPersistence,ApiError} from './api.js';
import {emptyState} from './data.js';
const response = (body, status = 200) => ({ok:status < 400,status,json:async () => body});

test('API keeps bearer auth in memory and sends exact state/revision without credentials', async () => {
  const calls = [];
  const api = createApi(async (url, options) => {
    calls.push({url,options});
    if (url.endsWith('/login')) return response({token:'memory-only',user:{email:'student@example.com',name:'Student'}});
    return response({state:emptyState(),revision:1});
  });
  await api.authenticate('login',{email:'student@example.com',password:'example password'});
  await api.save(emptyState(),0);
  assert.equal(calls[1].options.headers.Authorization,'Bearer memory-only');
  assert.equal(calls[1].options.credentials,'omit');
  assert.deepEqual(JSON.parse(calls[1].options.body),{state:emptyState(),revision:0});
  api.signOut(); await api.load();
  assert.equal(calls[2].options.headers.Authorization,undefined);
});

test('API reports static hosting, network and HTTP errors without accepting a false success', async () => {
  await assert.rejects(createApi(async()=>{throw new Error('offline');}).load(), /changes are still here/);
  await assert.rejects(createApi(async()=>({ok:true,status:200,json:async()=>{throw new Error();}})).load(), /Run the Node server/);
  await assert.rejects(createApi(async()=>response({error:{code:'UNAUTHORIZED',message:'Sign in again'}},401)).load(), error => error.status === 401 && error.message === 'Sign in again');
  await assert.rejects(createApi(async()=>response({state:emptyState(),revision:-1})).load(), /invalid planner revision/);
});

test('failed cloud saves retain revision/draft; confirmed saves advance revision', async () => {
  const original = emptyState();
  const draft = {version:1,subjects:[{id:'math',name:'Math',total:10,attended:0,missed:0,endDate:'2027-01-01',weekly:[]}],sessions:[]};
  let fail = true;
  const seen = [];
  const persistence = createCloudPersistence({save:async(state,revision)=>{
    seen.push(revision);
    if(fail) throw new ApiError('offline');
    return {state,revision:revision+1};
  }},{state:original,revision:4});
  await assert.rejects(persistence.save(draft), /offline/);
  assert.equal(persistence.revision,4); assert.equal(persistence.dirty(draft),true);
  fail = false; await persistence.save(draft);
  assert.deepEqual(seen,[4,4]); assert.equal(persistence.revision,5); assert.equal(persistence.dirty(draft),false);
  assert.deepEqual(original,emptyState());
});

test('a racing edit remains dirty after a snapshot save and a conflict blocks overwrite retries', async () => {
  const initial = emptyState();
  let finish;
  const api = {save:(state,revision)=>new Promise(resolve=>{finish=()=>resolve({state,revision:revision+1});})};
  const persistence = createCloudPersistence(api,{state:initial,revision:0});
  const inFlight = persistence.save(initial);
  initial.subjects.push({id:'math',name:'Math',total:10,attended:0,missed:0,endDate:'2027-01-01',weekly:[]});
  finish(); await inFlight;
  assert.equal(persistence.dirty(initial),true);
  let writes = 0;
  const conflicted = createCloudPersistence({save:async()=>{writes++;throw new ApiError('stale',409);}}, {state:emptyState(),revision:1});
  await assert.rejects(conflicted.save(initial), /stale/);
  await assert.rejects(conflicted.save(initial), /Newer account records/);
  assert.equal(writes,1); assert.equal(conflicted.revision,1); assert.equal(conflicted.dirty(initial),true);
});
