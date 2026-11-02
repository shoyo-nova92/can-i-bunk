import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {createApp} from '../src/app.js';
import {connectDatabase,disconnectDatabase} from '../src/database.js';
import {User} from '../src/models.js';

let mongo,app,alice,bob;
const secret='test-only-secret-'.repeat(4);
const person=name=>({name,email:`${name}@example.test`,password:'Strong-password-2026!'});
const subject=(id='math')=>({id,name:'Mathematics',total:40,attended:20,missed:9,endDate:'2030-12-31',weekly:[]});
const session=(id='class-1',subjectId='math')=>({id,subjectId,date:'2026-11-01',time:'09:00',actual:'unmarked',plan:'undecided',cancelled:false});
const api=(method,url,token=alice)=>request(app)[method](url).set('Authorization',`Bearer ${token}`);
before(async()=>{
  mongo=await MongoMemoryServer.create();
  await connectDatabase(mongo.getUri('can_i_bunk_tests'));
  app=createApp({jwtSecret:secret,authLimit:1000});
  alice=(await request(app).post('/api/auth/register').send(person('alice')).expect(201)).body.token;
  bob=(await request(app).post('/api/auth/register').send(person('bob')).expect(201)).body.token;
});
after(async()=>{await disconnectDatabase();await mongo?.stop();});

test('health, password hashing, email normalization, login, authentication and duplicate account',async()=>{
  await request(app).get('/api/health').expect(200,{status:'ok',database:'connected'});
  const raw=await User.findOne({email:'alice@example.test'}).select('+passwordHash').lean();
  assert.notEqual(raw.passwordHash,person('alice').password);
  assert.match(raw.passwordHash,/^\$2[ab]\$12\$/);
  const login=await request(app).post('/api/auth/login').send({...person('alice'),email:' ALICE@example.test ',name:undefined}).expect(200);
  assert.equal(login.body.user.email,'alice@example.test');
  assert.equal(login.body.user.passwordHash,undefined);
  await request(app).post('/api/auth/register').send(person('alice')).expect(409);
  await request(app).post('/api/auth/login').send({email:'alice@example.test',password:'Wrong-password-2026'}).expect(401);
  await request(app).post('/api/auth/register').send({...person('weak'),password:'short'}).expect(400);
  await request(app).get('/api/state').expect(401);
  await api('get','/api/state','invalid').expect(401);
  const me=await api('get','/api/auth/me').expect(200);
  assert.equal(me.body.user.name,'alice');
  assert.equal(me.headers['cache-control'],'no-store');
});

test('subject/session CRUD, isolation, stale saves and atomic subject cascade',async()=>{
  let response=await api('get','/api/state').expect(200);
  assert.equal(response.body.revision,0);
  response=await api('post','/api/subjects').send({subject:subject(),revision:0}).expect(201);
  assert.equal(response.body.revision,1);
  await api('get','/api/subjects/math').expect(200);
  await api('get','/api/subjects/math',bob).expect(404);
  await api('patch','/api/subjects/math',bob).send({changes:{name:'stolen'},revision:0}).expect(404);
  await api('delete','/api/subjects/math',bob).send({revision:0}).expect(404);
  const other=await api('get','/api/state',bob).expect(200);
  assert.deepEqual(other.body.state,{version:1,subjects:[],sessions:[]});
  await api('patch','/api/subjects/math').send({changes:{name:'Updated mathematics'},revision:1}).expect(200);
  await api('patch','/api/subjects/math').send({changes:{name:'Stale'},revision:1}).expect(409);
  await api('post','/api/sessions').send({session:session(),revision:2}).expect(201);
  response=await api('get','/api/sessions/class-1').expect(200);
  assert.equal(response.body.session.subjectId,'math');
  await api('get','/api/sessions/class-1',bob).expect(404);
  await api('patch','/api/sessions/class-1',bob).send({changes:{plan:'bunk'},revision:0}).expect(404);
  await api('patch','/api/sessions/class-1').send({changes:{actual:'attended'},revision:3}).expect(200);
  response=await api('get','/api/sessions').expect(200);
  assert.equal(response.body.sessions[0].actual,'attended');
  await api('delete','/api/sessions/class-1').send({revision:4}).expect(200);
  await api('get','/api/sessions/class-1').expect(404);
  await api('post','/api/sessions').send({session:session('class-2'),revision:5}).expect(201);
  response=await api('delete','/api/subjects/math').send({revision:6}).expect(200);
  assert.equal(response.body.revision,7);
  assert.deepEqual(response.body.state,{version:1,subjects:[],sessions:[]});
});

test('validation rejects malformed counts, references, duplicate IDs, fields and impossible dates',async()=>{
  for(const invalid of [
    {...subject(),attended:50},
    {...subject(),total:2.5},
    {...subject(),endDate:'2030-02-30'},
    {...subject(),owner:'other'},
    {...subject(),weekly:[{day:1,time:'25:00'}]},
    {...subject(),id:'x'.repeat(129)}
  ])await api('post','/api/subjects').send({subject:invalid,revision:7}).expect(400);
  await api('post','/api/sessions').send({session:session(),revision:7}).expect(400);
  await api('post','/api/subjects').send({subject:subject(),revision:7}).expect(201);
  await api('patch','/api/subjects/math').send({changes:{id:'renamed'},revision:8}).expect(400);
  await api('post','/api/subjects').send({subject:subject(),revision:8}).expect(400);
  for(const invalid of [
    {...session(),date:'2031-01-01'},
    {...session(),date:'2030-01-01',actual:'attended'},
    {...session(),date:'2026-02-30'},
    {...session(),subjectId:'orphan'},
    {...session(),plan:'maybe'},
    {...session(),cancelled:'false'}
  ])await api('post','/api/sessions').send({session:invalid,revision:8}).expect(400);
  await api('put','/api/state').send(JSON.parse('{"state":{"version":1,"subjects":[],"sessions":[],"__proto__":{"polluted":true}},"revision":8}')).expect(400);
  await api('put','/api/state').send({state:{version:1,subjects:[],sessions:[]},revision:'8'}).expect(400);
  await api('put','/api/state').send({state:{version:1,subjects:[],sessions:[]},revision:8,owner:'bob'}).expect(400);
  await request(app).put('/api/state').set('Authorization',`Bearer ${alice}`).set('Content-Type','application/json').send('{invalid').expect(400);
  assert.equal({}.polluted,undefined);
});

test('state replacement preserves IDs, handles concurrent revisions and persists after reconnect',async()=>{
  const state={version:1,subjects:[subject('science')],sessions:[session('science-class','science')]};
  const responses=await Promise.all([api('put','/api/state').send({state,revision:8}),api('put','/api/state').send({state,revision:8})]);
  assert.deepEqual(responses.map(result=>result.status).sort(),[200,409]);
  await disconnectDatabase();
  await request(app).get('/api/health').expect(503);
  await connectDatabase(mongo.getUri('can_i_bunk_tests'));
  app=createApp({jwtSecret:secret});
  const restored=await api('get','/api/state').expect(200);
  assert.deepEqual(restored.body.state,state);
  assert.equal(restored.body.revision,9);
});

test('inferred totals follow CRUD while bulk save rejects inconsistent inferred data',async()=>{
  const state={version:1,subjects:[{...subject('inferred'),total:29,totalMode:'inferred'}],sessions:[]};
  await api('put','/api/state').send({state,revision:9}).expect(200);
  let response=await api('post','/api/sessions').send({session:session('inferred-class','inferred'),revision:10}).expect(201);
  assert.equal(response.body.state.subjects[0].total,30);
  response=await api('patch','/api/sessions/inferred-class').send({changes:{cancelled:true},revision:11}).expect(200);
  assert.equal(response.body.state.subjects[0].total,29);
  response.body.state.subjects[0].total=40;
  await api('put','/api/state').send({state:response.body.state,revision:12}).expect(400);
});

test('static whitelist denies backend, environment, Git, dependencies and test files',async()=>{
  for(const path of ['/server/.env','/.git/config','/server/src/app.js','/server/package.json','/package.json','/data.test.js','/node_modules/mongoose/package.json','/API_CONTRACT.md'])await request(app).get(path).expect(404);
  await request(app).get('/').expect(200).expect('Content-Type',/html/);
  await request(app).get('/data.js').expect(200);
  // Encoded separators retain traversal segments through the HTTP client so
  // express.static itself must reject them; private paths remain indistinct.
  for(const path of ['/vendor/..%2fserver%2f.env','/vendor/%2e%2e%2fserver%2f.env','/vendor/..%5cserver%5c.env'])await request(app).get(path).expect(404);
  await request(app).get('/api/no-such-route').set('Authorization',`Bearer ${alice}`).expect(404);
});

test('authentication is rate limited',async()=>{
  const limited=createApp({jwtSecret:secret,authLimit:1});
  await request(limited).post('/api/auth/login').send({email:'unknown@example.test',password:'Long-enough-password'}).expect(401);
  const response=await request(limited).post('/api/auth/login').send({email:'unknown@example.test',password:'Long-enough-password'}).expect(429);
  assert.equal(response.body.error.code,'RATE_LIMITED');
});
