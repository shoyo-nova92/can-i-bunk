import {validateState,today} from '../../data.js';
import {ApiError} from './errors.js';
export const subjectFields = ['id','name','total','attended','missed','endDate','weekly','historyThrough','historyThroughTime','totalMode'];
export const sessionFields = ['id','subjectId','date','time','actual','plan','cancelled'];
export function object(value, fields, label='Request') {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key=>!fields.includes(key))) throw new ApiError(400,'VALIDATION_ERROR',`${label} has invalid or unsupported fields.`);
  return value;
}
export function revision(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new ApiError(400,'VALIDATION_ERROR','A nonnegative integer revision is required.');
  return value;
}
export function record(value,kind,patch=false) {
  object(value,(kind==='subjects'?subjectFields:sessionFields).filter(key=>!patch || key!=='id'),kind==='subjects'?'Subject':'Session');
  if (!patch && (typeof value.id !== 'string' || !value.id || value.id.length>128)) throw new ApiError(400,'VALIDATION_ERROR','Record ID must be a string of 1–128 characters.');
  if (Object.hasOwn(value,'weekly')) {
    if (!Array.isArray(value.weekly) || value.weekly.length>168) throw new ApiError(400,'VALIDATION_ERROR','Weekly timetable must have at most 168 slots.');
    value.weekly.forEach(slot=>object(slot,['day','time'],'Timetable slot'));
  }
  return value;
}
export function plannerState(state,{recalculate=false}={}) {
  object(state,['version','subjects','sessions'],'State');
  if (!Array.isArray(state.subjects) || !Array.isArray(state.sessions)) throw new ApiError(400,'VALIDATION_ERROR','State needs subject and session arrays.');
  state.subjects.forEach(subject=>record(subject,'subjects'));
  state.sessions.forEach(session=>record(session,'sessions'));
  for (const subject of state.subjects) {
    if (subject.totalMode==='inferred') {
      const total=subject.attended+subject.missed+state.sessions.filter(session=>session.subjectId===subject.id&&!session.cancelled).length;
      if (recalculate) subject.total=total;
      else if (subject.total!==total) throw new ApiError(400,'VALIDATION_ERROR','Inferred totals must equal history plus active sessions.');
    }
  }
  try { validateState(state); }
  catch(error) { throw new ApiError(400,'VALIDATION_ERROR',error.message); }
  for (const session of state.sessions) {
    if (session.date>today() && session.actual!=='unmarked') throw new ApiError(400,'VALIDATION_ERROR','Future attendance cannot be recorded.');
  }
  return state;
}
