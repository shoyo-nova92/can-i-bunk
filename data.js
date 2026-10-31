export const VERSION = 1;
export const clone = value => structuredClone(value);
export const uid = () => globalThis.crypto.randomUUID();
export function today() { return localDate(new Date()); }
export function localDate(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y,m,d] = value.split('-').map(Number);
  return localDate(new Date(y,m-1,d)) === value;
}
export const emptyState = () => ({version:VERSION,subjects:[],sessions:[]});
function require(condition,message) { if(!condition) throw new Error(message); }
function count(value) { return Number.isSafeInteger(value) && value >= 0; }
export function validTime(value) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
export function validateState(state) {
  require(state && state.version===VERSION,'Unsupported saved data version.');
  require(Array.isArray(state.subjects) && Array.isArray(state.sessions),'Invalid records.');
  require(state.subjects.length <= 300 && state.sessions.length <= 25000, 'This planner supports up to 300 subjects and 25,000 calendar sessions.');
  const ids=new Set();
  const endDates = new Map();
  const subjectRecords = new Map();
  for(const s of state.subjects) {
    require(typeof s.id==='string' && s.id && !ids.has(s.id),'Duplicate or missing subject ID.'); ids.add(s.id);
    require(typeof s.name==='string' && s.name.trim().length>0 && s.name.length<=120,'Enter a subject name (up to 120 characters).');
    require(count(s.total) && s.total>0 && count(s.attended) && count(s.missed),'Session counts must be whole numbers; total must be positive.');
    require(s.total <= 100000, 'The semester total must be 100,000 sessions or fewer.');
    require(s.attended+s.missed<=s.total,'Past attendance exceeds the semester total.');
    require(validDate(s.endDate),'Enter a valid semester end date.');
    endDates.set(s.id, s.endDate);
    subjectRecords.set(s.id, s);
    if (s.historyThrough !== undefined) require(validDate(s.historyThrough), 'Invalid attendance cutoff date.');
    if (s.historyThroughTime !== undefined) require(validTime(s.historyThroughTime), 'Invalid attendance cutoff time.');
    if (s.totalMode !== undefined) require(['fixed','inferred'].includes(s.totalMode), 'Invalid semester total mode.');
    require(Array.isArray(s.weekly),'Invalid weekly timetable.');
    const slots=new Set();
    for(const slot of s.weekly) {
      require(Number.isInteger(slot.day) && slot.day>=0 && slot.day<=6 && validTime(slot.time),'Invalid weekday or time.');
      const key=`${slot.day}/${slot.time}`; require(!slots.has(key),'Duplicate weekly class.'); slots.add(key);
    }
  }
  const sessionIds=new Set(), slots=new Set();
  for(const s of state.sessions) {
    require(typeof s.id==='string' && s.id && !sessionIds.has(s.id),'Duplicate or missing session ID.'); sessionIds.add(s.id);
    require(ids.has(s.subjectId),'Session has no subject.');
    require(validDate(s.date) && validTime(s.time),'Invalid session date or time.');
    require(['unmarked','attended','missed'].includes(s.actual),'Invalid attendance mark.');
    require(['undecided','attend','bunk'].includes(s.plan),'Invalid future plan.');
    require(typeof s.cancelled==='boolean','Invalid cancellation state.');
    require(s.cancelled || s.date <= endDates.get(s.subjectId), 'A class is after the semester end date. Extend the end date explicitly before moving or adding it.');
    const subject = subjectRecords.get(s.subjectId);
    if (!s.cancelled && subject.historyThrough) {
      const cutoffTime = subject.historyThroughTime ?? '23:59';
      require(s.date > subject.historyThrough || (s.date === subject.historyThrough && s.time > cutoffTime), 'This class is already covered by the starting attendance cutoff. Correct the history before adding it again.');
    }
    const key=JSON.stringify([s.subjectId,s.date,s.time]);
    if(!s.cancelled) { require(!slots.has(key),'Duplicate class at the same time.'); slots.add(key); }
  }
  return state;
}
export function createSubject(input) {
  const subject={id:uid(), name:input.name?.trim(), total:input.total, attended:input.attended??0, missed:input.missed??0, endDate:input.endDate, weekly:clone(input.weekly??[])};
  if (input.historyThrough !== undefined) subject.historyThrough = input.historyThrough;
  if (input.historyThroughTime !== undefined) subject.historyThroughTime = input.historyThroughTime;
  if (input.totalMode !== undefined) subject.totalMode = input.totalMode;
  validateState({version:VERSION,subjects:[subject],sessions:[]}); return subject;
}
export function createSession(subjectId,date,time) { return {id:uid(),subjectId,date,time,actual:'unmarked',plan:'undecided',cancelled:false}; }
export function createStore(initial=emptyState(), {onListenerError = error => console.error('Planner view failed:', error)} = {}) {
  let state=clone(validateState(initial)); const listeners=new Set();
  return {
    get:()=>clone(state),
    update(mutator) {
      const draft=clone(state);
      mutator(draft);
      for (const subject of draft.subjects) {
        if (subject.totalMode === 'inferred') {
          subject.total = subject.attended + subject.missed + draft.sessions.filter(session => session.subjectId === subject.id && !session.cancelled).length;
        }
      }
      validateState(draft);
      state=draft;
      // Rendering errors cannot roll back a commit or block other subscribers.
      for (const listener of listeners) {
        try { listener(clone(state)); }
        catch (error) { try { onListenerError(error); } catch { /* A reporting error cannot undo a commit. */ } }
      }
      return clone(state);
    },
    subscribe(listener) { listeners.add(listener); return ()=>listeners.delete(listener); }
  };
}
export function markAttendance(store,id,actual) {
  store.update(state=>{ const session=state.sessions.find(s=>s.id===id); require(session && !session.cancelled,'Class not available.'); require(session.date<=today() || actual==='unmarked','Future attendance cannot be recorded.'); session.actual=actual; });
}
