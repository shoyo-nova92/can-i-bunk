// Rebuild importable Postman assets without embedding real credentials or tokens.
import {writeFileSync} from 'node:fs';
const tests=(code,extra=[])=>[{listen:'test',script:{type:'text/javascript',exec:[`pm.test('HTTP ${code}', () => pm.response.to.have.status(${code}));`,...extra]}}];
const readRevision="if (pm.response.code < 300 && Number.isInteger(pm.response.json().revision)) pm.collectionVariables.set('revision', pm.response.json().revision);";
function request(name,method,path,body,code=200,extra=[],token='token') {
  return {name,event:tests(code,[readRevision,...extra]),request:{method,header:body===undefined?[]:[{key:'Content-Type',value:'application/json'}],auth:token?{type:'bearer',bearer:[{key:'token',value:`{{${token}}}`,type:'string'}]}:{type:'noauth'},url:'{{baseUrl}}'+path,...(body===undefined?{}:{body:{mode:'raw',raw:typeof body==='string'?body:JSON.stringify(body,null,2),options:{raw:{language:'json'}}}})}};
}
const raw=value=>JSON.stringify(value);
const subject={id:'{{subjectId}}',name:'Postman Mathematics',total:40,attended:20,missed:9,endDate:'2099-12-31',weekly:[]};
const session={id:'{{sessionId}}',subjectId:'{{subjectId}}',date:'2099-01-05',time:'09:00',actual:'unmarked',plan:'undecided',cancelled:false};
const revisionBody=fields=>'{'+Object.entries(fields).map(([key,value])=>raw(key)+':'+raw(value)).join(',')+',"revision":{{revision}}}';
const collection={info:{name:'Can I Bunk — Assignment API verification',schema:'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',description:'Run in order against a disposable local/demo or Atlas test database. Creates two uniquely named synthetic accounts per run (no account-delete API); subject/session data is removed at the end. Never run with real student data. Tests auth, CRUD, stale revisions and cross-account isolation. Tokens/passwords are runtime values, not exported secrets.'},variable:[{key:'revision',value:'0'},{key:'subjectId',value:'demo-subject'},{key:'sessionId',value:'demo-session'}],event:[{listen:'prerequest',script:{type:'text/javascript',exec:["if (pm.info.requestName === '01 Health') {","  const run = pm.variables.replaceIn('{{$guid}}');","  pm.collectionVariables.set('email', 'postman-' + run + '@example.test');","  pm.collectionVariables.set('otherEmail', 'other-' + run + '@example.test');","  pm.collectionVariables.set('password', 'Demo-' + pm.variables.replaceIn('{{$guid}}') + '!');","  pm.collectionVariables.set('subjectId', 'subject-' + run);","  pm.collectionVariables.set('sessionId', 'session-' + run);","}"]}}],item:[
request('01 Health','GET','/api/health',undefined,200,["pm.test('MongoDB connected', () => pm.expect(pm.response.json().database).to.eql('connected'));"],null),
request('02 Registration','POST','/api/auth/register',{name:'Postman Student',email:'{{email}}',password:'{{password}}'},201,["pm.collectionVariables.set('token', pm.response.json().token);","pm.test('User has no password hash', () => pm.expect(pm.response.json().user).not.to.have.property('passwordHash'));"],null),
request('03 Login','POST','/api/auth/login',{email:'{{email}}',password:'{{password}}'},200,["pm.collectionVariables.set('token', pm.response.json().token);"],null),
request('04 Current user','GET','/api/auth/me',undefined,200,["pm.test('Correct account', () => pm.expect(pm.response.json().user.email).to.eql(pm.collectionVariables.get('email')));"]),
request('05 Empty planner','GET','/api/state',undefined,200,["pm.test('Starts empty', () => pm.expect(pm.response.json().state.subjects).to.have.lengthOf(0));"]),
request('06 Create subject','POST','/api/subjects',revisionBody({subject}),201),
request('07 List subjects','GET','/api/subjects',undefined,200,["pm.test('Created subject listed', () => pm.expect(pm.response.json().subjects[0].name).to.eql('Postman Mathematics'));"]),
request('08 Read subject','GET','/api/subjects/{{subjectId}}'),
request('09 Update subject','PATCH','/api/subjects/{{subjectId}}',revisionBody({changes:{name:'Updated Mathematics'}}),200,["pm.test('Subject updated', () => pm.expect(pm.response.json().state.subjects[0].name).to.eql('Updated Mathematics'));"]),
request('10 Create session','POST','/api/sessions',revisionBody({session}),201),
request('11 List sessions','GET','/api/sessions',undefined,200,["pm.test('Created session listed', () => pm.expect(pm.response.json().sessions).to.have.lengthOf(1));"]),
request('12 Read session','GET','/api/sessions/{{sessionId}}'),
request('13 Update session','PATCH','/api/sessions/{{sessionId}}',revisionBody({changes:{plan:'bunk'}}),200,["pm.test('Plan updated', () => pm.expect(pm.response.json().state.sessions[0].plan).to.eql('bunk'));"]),
request('14 Reject stale write','PATCH','/api/subjects/{{subjectId}}',{changes:{name:'Stale'},revision:0},409),
request('15 Reject invalid counts','PATCH','/api/subjects/{{subjectId}}',revisionBody({changes:{attended:999}}),400),
request('16 Reject missing authentication','GET','/api/state',undefined,401,[],null),
request('17 Second account','POST','/api/auth/register',{name:'Other Student',email:'{{otherEmail}}',password:'{{password}}'},201,["pm.collectionVariables.set('otherToken', pm.response.json().token);"],null),
request('18 Other account cannot read subject','GET','/api/subjects/{{subjectId}}',undefined,404,[],'otherToken'),
request('19 Other account cannot edit subject','PATCH','/api/subjects/{{subjectId}}',{changes:{name:'Unauthorized'},revision:0},404,[],'otherToken'),
request('20 Other account cannot delete session','DELETE','/api/sessions/{{sessionId}}',{revision:0},404,[],'otherToken'),
request('21 Read full state','GET','/api/state',undefined,200,["pm.collectionVariables.set('snapshot', JSON.stringify(pm.response.json().state));"]),
request('22 Save full state','PUT','/api/state','{"state":{{snapshot}},"revision":{{revision}}}'),
request('23 Delete session','DELETE','/api/sessions/{{sessionId}}','{"revision":{{revision}}}',200,["pm.test('Session deleted', () => pm.expect(pm.response.json().state.sessions).to.have.lengthOf(0));"]),
request('24 Delete subject','DELETE','/api/subjects/{{subjectId}}','{"revision":{{revision}}}',200,["pm.test('Subject deleted', () => pm.expect(pm.response.json().state.subjects).to.have.lengthOf(0));"]),
request('25 Deleted subject is missing','GET','/api/subjects/{{subjectId}}',undefined,404),
request('26 Final planner','GET','/api/state',undefined,200,["pm.test('Synthetic planner cleaned', () => { pm.expect(pm.response.json().state.subjects).to.have.lengthOf(0); pm.expect(pm.response.json().state.sessions).to.have.lengthOf(0); });"])
]};
const target=new URL('./Can-I-Bunk.postman_collection.json',import.meta.url);
writeFileSync(target,JSON.stringify(collection,null,2)+'\n');
writeFileSync(new URL('./Local.postman_environment.json',import.meta.url),JSON.stringify({name:'Can I Bunk Local',values:[{key:'baseUrl',value:'http://127.0.0.1:3000',enabled:true}],_postman_variable_scope:'environment'},null,2)+'\n');
console.log('Generated Postman collection and local environment.');
