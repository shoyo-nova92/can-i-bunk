import {test} from 'node:test';
import assert from 'node:assert/strict';
import {connectDatabaseWithRetry} from '../src/startup.js';
import {classifyStartupFailure,ConfigurationError} from '../src/startup-errors.js';
const network=()=>Object.assign(new Error('TLS alert number 80 mongodb+srv://secret:password@private.example JWT_SECRET=private'),{name:'MongoNetworkError'});
test('transient startup failure cleans up, delays, then succeeds without leaking driver text',async()=>{
  const events=[],logs=[];
  let count=0;
  await connectDatabaseWithRetry('private-uri',{
    connect:async()=>{events.push('connect');if(++count<3)throw network();},
    disconnect:async()=>events.push('disconnect'),
    delay:async ms=>events.push(ms),report:message=>logs.push(message)
  });
  assert.deepEqual(events,['connect','disconnect',1000,'connect','disconnect',1000,'connect']);
  assert.equal(logs.length,2);
  assert.match(logs[0],/alert 80/);
  assert.doesNotMatch(logs.join(' '),/private|password|mongodb\+srv|JWT_SECRET/);
});
test('network retries stop at four attempts and preserve the final failure',async()=>{
  const failure=network();let calls=0,closes=0,delays=0;
  await assert.rejects(connectDatabaseWithRetry('uri',{connect:async()=>{calls++;throw failure;},disconnect:async()=>{closes++;},delay:async()=>{delays++;},report:()=>{}}),error=>error===failure);
  assert.equal(calls,4);assert.equal(closes,4);assert.equal(delays,3);
});
test('authentication, configuration and index permissions fail without retry, including nested selection errors',async()=>{
  for(const failure of [new ConfigurationError('PORT must be an integer from 1 to 65535.'),Object.assign(new Error('private-password'),{code:13}),{name:'MongoServerSelectionError',reason:{servers:new Map([['private-host',{error:{code:18,message:'private-password'}}]])}}]) {
    let calls=0;
    await assert.rejects(connectDatabaseWithRetry('uri',{connect:async()=>{calls++;throw failure;},disconnect:async()=>{},delay:async()=>assert.fail('must not delay'),report:()=>assert.fail('must not report retry')}));
    assert.equal(calls,1);
  }
});
test('startup diagnostics use fixed messages for untrusted error text',()=>{
  for(const failure of [new Error('MONGODB_URI=mongodb://user:private@host PORT JWT_SECRET=private'),{name:'MongoServerSelectionError',message:'ENOTFOUND private-host password'},{name:'MongoServerError',code:18,message:'private-password'}]) {
    assert.doesNotMatch(classifyStartupFailure(failure).message,/private|mongodb:\/\/|JWT_SECRET=/);
  }
  assert.match(classifyStartupFailure({name:'MongoServerSelectionError',message:'ENOTFOUND private'}).message,/DNS/);
});
