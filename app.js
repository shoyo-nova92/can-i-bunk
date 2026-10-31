import {createStore, emptyState, createSubject, createSession, today, localDate} from './data.js';
import {analyze} from './attendance.js';
import {createPersistence} from './storage.js';
import {mountSetup} from './setup.js';
import {mountCalendar} from './calendar.js';
import {mountPlanner} from './planner.js';
import {mountTimetable} from './timetable.js';

const status = document.querySelector('#save-status');
const viewError = document.querySelector('#view-error');
const recovery = document.querySelector('#recovery');
const conflict = document.querySelector('#storage-conflict');
const welcome = document.querySelector('#welcome');
const exampleButton = document.querySelector('#try-example');
const plannerRoot = document.querySelector('#planner');
const persistence = createPersistence();
const store = createStore(persistence.loaded.state, {onListenerError: reportViewError});
const controllers = [];
let lastDate = today();
let state = store.get();
let analyses = new Map();

function reportViewError(error) {
  viewError.textContent = `A view could not refresh. Your saved records have not been reset. Reload this page to retry. ${error.message || ''}`;
  viewError.hidden = false;
}
function showStatus(message, error = false) {
  status.textContent = message;
  status.className = error ? 'error' : '';
}
function refreshAnalyses() {
  state = store.get();
  analyses = new Map(state.subjects.map(subject => [subject.id, analyze(state, subject.id)]));
}
async function persist(nextState) {
  showStatus(persistence.paused ? 'Saving paused. Your saved data is protected.' : 'Saving in this browser…', persistence.paused);
  let result;
  try { result = await persistence.saveAsync(nextState); }
  catch (error) { result = {ok:false,error:`Could not save: ${error.message}. Keep this page open and retry after reloading.`}; }
  showStatus(result.ok ? 'Saved in this browser.' : result.error, !result.ok);
  if (result.conflict && !persistence.loaded.error) conflict.hidden = false;
}
function mount(factory, root) {
  try {
    const controller = factory();
    controllers.push(controller);
    return controller;
  } catch (error) {
    root.textContent = 'This view could not open. Reload to try again; your saved data is preserved.';
    reportViewError(error);
    return null;
  }
}
function render() {
  refreshAnalyses();
  welcome.hidden = state.subjects.length > 0;
  exampleButton.disabled = persistence.paused;
  document.querySelector('#today-label').textContent = new Date().toLocaleDateString(undefined, {weekday:'short',month:'short',day:'numeric'});
  for (const controller of controllers) {
    try { controller.render(); } catch (error) { reportViewError(error); }
  }
}

// Persistence is independent of rendering. A broken view cannot prevent a save.
store.subscribe(persist);
store.subscribe(render);
refreshAnalyses();
const planner = mount(() => mountPlanner(plannerRoot, store), plannerRoot);
const calendarRoot = document.querySelector('#calendar');
mount(() => mountCalendar(calendarRoot, store, {
  getLabel: session => analyses.get(session.subjectId)?.labels[session.id] ?? 'Check schedule first',
  getStatus: session => analyses.get(session.subjectId)?.statuses[session.id] ?? 'check',
  onPreview: sessionId => {
    if (!planner) throw new Error('The planner is unavailable. Reload to retry.');
    planner.preview(sessionId);
    plannerRoot.scrollIntoView({behavior:'auto',block:'start'});
    const preview = plannerRoot.querySelector('.planner-preview');
    if (preview) { preview.tabIndex = -1; preview.focus({preventScroll:true}); }
  }
}), calendarRoot);
const setupRoot = document.querySelector('#setup');
mount(() => mountSetup(setupRoot, store), setupRoot);
const timetableRoot = document.querySelector('#timetable');
mount(() => mountTimetable(timetableRoot, store), timetableRoot);

if (persistence.loaded.error) {
  recovery.hidden = false;
  document.querySelector('#recovery-message').textContent = persistence.loaded.error;
  showStatus('Saving paused. Your original saved data is protected.', true);
} else {
  showStatus(state.subjects.length ? 'Your saved planner is ready.' : 'Drop a timetable to get started. Changes save in this browser.');
}

document.querySelector('#start-fresh').addEventListener('click', () => {
  if (!window.confirm('Replace the unreadable saved records with an empty planner? This cannot be undone.')) return;
  const result = persistence.replace(emptyState());
  if (!result.ok) { showStatus(result.error, true); return; }
  window.location.reload();
});
document.querySelector('#reload-planner').addEventListener('click', () => {
  if (window.confirm('Reload the newer saved planner? Any changes in this tab that could not be saved will be lost.')) window.location.reload();
});
exampleButton.addEventListener('click', () => {
  if (store.get().subjects.length || persistence.paused) return;
  try {
    const start = new Date(); start.setHours(12,0,0,0);
    const end = new Date(start); end.setDate(end.getDate() + 10);
    const subject = createSubject({name:'Example: Applied mathematics',total:40,attended:20,missed:9,endDate:localDate(end),weekly:[]});
    const sessions = Array.from({length:11}, (_, index) => {
      const date = new Date(start); date.setDate(date.getDate() + index);
      return createSession(subject.id,localDate(date),'09:00');
    });
    store.update(draft => { draft.subjects.push(subject); draft.sessions.push(...sessions); });
  } catch (error) { showStatus(error.message || 'Could not open example data.', true); }
});
document.querySelector('#reset-planner').addEventListener('click', () => {
  if (persistence.paused) {
    (persistence.loaded.error ? recovery : conflict).scrollIntoView({block:'center'});
    return;
  }
  if (!window.confirm('Clear all subjects, attendance, and plans in this browser? This cannot be undone.')) return;
  store.update(draft => Object.assign(draft, emptyState()));
});
function refreshDate() {
  if (lastDate !== today()) { lastDate = today(); render(); }
}
window.setInterval(refreshDate, 60_000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshDate(); });
window.addEventListener('storage', event => {
  if (event.key === 'can-i-bunk.v1' || event.key === null) {
    persistence.pause();
    conflict.hidden = false;
    showStatus('Another tab changed this planner. Saving is paused to protect its newer records.', true);
    render();
  }
});
render();
