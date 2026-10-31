import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSubject,createSession,createStore,validateState,emptyState} from './data.js';
import {analyze,classify,formatPercent,previewBunk} from './attendance.js';
import {parseTimetable} from './timetable-parser.js';

function example() {
  const subject=createSubject({name:'Math',total:40,attended:20,missed:9,endDate:'2030-12-31'});
  return {version:1,subjects:[subject],sessions:Array.from({length:11},(_,i)=>createSession(subject.id,`2030-12-${String(i+1).padStart(2,'0')}`,'09:00'))};
}
test('75%,74.6%,60% and near-boundary display never imply unsafe is safe',()=>{
  assert.equal(classify(30,40),'safe'); assert.equal(classify(373,500),'grade-drop');
  assert.equal(classify(24,40),'grade-drop'); assert.equal(classify(23,40),'retake');
  assert.equal(formatPercent(74.6),'74.6%'); assert.equal(formatPercent(75),'75.0%');
  assert.equal(formatPercent(100000/1334),'Below 75%'); assert.equal(formatPercent(59.98),'Below 60%');
  assert.equal(formatPercent(null),'No classes held');
});
test('today and later bunk alternatives have equal costs and preview never commits',()=>{
  const state=example(),today='2030-12-01';
  const now=previewBunk(state,state.sessions[0].id,today),later=previewBunk(state,state.sessions[1].id,today);
  assert.equal(now.after.allowance,0); assert.equal(later.after.allowance,0);
  assert.equal(later.after.statuses[state.sessions[0].id],'required');
  assert.equal(now.after.statuses[state.sessions[1].id],'required');
  assert.equal(state.sessions[0].plan,'undecided');
});
test('after-semester sessions fail validation and raw forecasts are unreliable',()=>{
  const state=example(); state.sessions[0].date='2031-01-01';
  assert.throws(()=>validateState(state),/semester end/);
  const result=analyze(state,state.subjects[0].id,'2030-12-01');
  assert.equal(result.reliable,false); assert.equal(result.outcome,null);
  assert.equal(result.outsideSemester.length,1);
});
test('array-valued saved times and timetable times are rejected',()=>{
  const state=example();state.sessions[0].time=['09:00'];assert.throws(()=>validateState(state),/time/);
  state.sessions[0].time='09:00';state.subjects[0].weekly=[{day:1,time:['09:00']}];
  assert.throws(()=>validateState(state),/time/);
});
test('observer failure does not turn a committed update into an error or block saving',()=>{
  const errors=[],store=createStore(emptyState(),{onListenerError:error=>errors.push(error.message)});
  let notified=false;
  store.subscribe(()=>{throw Error('view broken');});store.subscribe(()=>{notified=true;});
  assert.doesNotThrow(()=>store.update(state=>state.subjects.push(example().subjects[0])));
  assert.equal(store.get().subjects.length,1);assert.equal(notified,true);assert.deepEqual(errors,['view broken']);
});
test('inferred totals follow cancellations while fixed totals require reconciliation',()=>{
  const state=example();state.subjects[0].totalMode='inferred';const store=createStore(state);
  store.update(draft=>{draft.sessions[0].cancelled=true;});assert.equal(store.get().subjects[0].total,39);
  store.update(draft=>{draft.sessions[0].cancelled=false;});assert.equal(store.get().subjects[0].total,40);
  const fixed=createStore(example());fixed.update(draft=>{draft.sessions[0].cancelled=true;});
  assert.equal(analyze(fixed.get(),fixed.get().subjects[0].id,'2030-12-01').mismatch,true);
});
test('history cutoff rejects adding a session that the held count already includes',()=>{
  const state=example();Object.assign(state.subjects[0],{historyThrough:'2030-12-01',historyThroughTime:'09:00'});
  assert.throws(()=>validateState(state),/cutoff/);state.sessions[0].time='10:00';assert.doesNotThrow(()=>validateState(state));
});
test('trailing empty grid columns retain earlier classes and do not shift weekdays',()=>{
  const result=parseTimetable('Time\tMonday\tTuesday\tWednesday\n09:00\tMath\t\t');
  assert.deepEqual(result.rows,[{subject:'Math',day:1,time:'09:00'}]);
});
test('large attendance surplus is capped to future sessions and completion offers no extra bunk',()=>{
  const subject=createSubject({name:'Surplus',total:40,attended:35,missed:1,endDate:'2030-12-31'});
  const state={version:1,subjects:[subject],sessions:Array.from({length:4},(_,i)=>createSession(subject.id,`2030-12-${i+10}`,'09:00'))};
  assert.equal(analyze(state,subject.id,'2030-12-01').attendanceSlack,9);
  assert.equal(analyze(state,subject.id,'2030-12-01').allowance,4);
  for(const session of state.sessions) session.actual='attended';
  assert.equal(analyze(state,subject.id,'2030-12-31').allowance,0);
});
test('session IDs cannot affect prototype or mandatory-session calculations',()=>{
  const state=example();state.sessions[0].id='__proto__';
  const result=analyze(state,state.subjects[0].id,'2030-12-01');
  assert.equal(result.statuses.__proto__,'available');assert.equal(Object.getPrototypeOf(result.statuses),null);
});
