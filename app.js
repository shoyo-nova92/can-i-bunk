import {createStore, emptyState, createSubject, createSession, today, localDate} from './data.js';
import {analyze} from './attendance.js';
import {createPersistence} from './storage.js';
import {createApi, createCloudPersistence} from './api.js';
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
const localStore = createStore(persistence.loaded.state, {onListenerError: reportViewError});
const api = createApi();
let store = localStore;
let cloudStore = null;
let cloudPersistence = null;
let user = null;
let mode = 'local';
let busy = false;
let localPending = Promise.resolve();
let controllers = [];
let lastDate = today();
let state = store.get();
let analyses = new Map();
const accountMessage = document.querySelector('#account-message');
const authForm = document.querySelector('#account-form');
const accountActions = document.querySelector('#account-actions');
const cloudSave = document.querySelector('#cloud-save');

function reportViewError(error) {
  viewError.textContent = `A view could not refresh. Your saved records have not been reset. Reload this page to retry. ${error.message || ''}`;
  viewError.hidden = false;
}
function showStatus(message, error = false) {
  status.textContent = message;
  status.className = error ? 'error' : '';
}
function message(text, error = false) {
  accountMessage.textContent = text;
  accountMessage.className = error ? 'error' : 'muted';
}
function dirtyCloud() { return Boolean(cloudStore && cloudPersistence?.dirty(cloudStore.get())); }
function updateAccount() {
  authForm.hidden = Boolean(user);
  accountActions.hidden = !user;
  document.querySelector('#account-identity').textContent = user ? `Signed in as ${user.name} (${user.email}).` : 'Use an account to save your planner to the database.';
  document.querySelector('#planner-location').textContent = mode === 'local' ? 'Local browser planner' : 'Account planner';
  document.querySelector('#footer-location').textContent = mode === 'local' ? 'Saved in this browser, on this address.' : 'Account planner. Use Save to account after editing.';
  document.querySelector('#cloud-open').hidden = mode === 'cloud';
  document.querySelector('#local-open').hidden = mode === 'local';
  cloudSave.disabled = busy || mode !== 'cloud' || !dirtyCloud() || cloudPersistence?.conflict;
  for (const button of document.querySelectorAll('#account-actions button:not(#download-account), #account-form button')) button.disabled = busy || (button === cloudSave && (mode !== 'cloud' || !dirtyCloud() || cloudPersistence?.conflict));
  document.querySelector('#local-upload').disabled = busy || persistence.paused;
  recovery.hidden = mode !== 'local' || !persistence.loaded.error;
  conflict.hidden = mode !== 'local' || !persistence.paused || Boolean(persistence.loaded.error);
}
function refreshAnalyses() {
  state = store.get();
  analyses = new Map(state.subjects.map(subject => [subject.id, analyze(state, subject.id)]));
}
async function persistLocal(nextState) {
  if (mode === 'local') showStatus(persistence.paused ? 'Saving paused. Your saved data is protected.' : 'Saving in this browser…', persistence.paused);
  let result;
  try { result = await persistence.saveAsync(nextState); }
  catch (error) { result = {ok:false,error:`Could not save: ${error.message}. Keep this page open and download a backup.`}; }
  if (mode === 'local') {
    showStatus(result.ok ? 'Saved in this browser.' : result.error, !result.ok);
    updateAccount();
  }
}
localStore.subscribe(nextState => { localPending = persistLocal(nextState); });
localStore.subscribe(() => { if (mode === 'local') render(); });
function observeCloud() {
  cloudStore.subscribe(() => {
    if (mode === 'cloud') {
      showStatus(dirtyCloud() ? 'Unsaved account changes. Use Save to account.' : 'Saved to your account.', dirtyCloud());
      render();
    }
    updateAccount();
  });
}
function mount(factory, root) {
  try { const controller = factory(); controllers.push(controller); return controller; }
  catch (error) { root.textContent = 'This view could not open. Reload to retry; download your records before reloading.'; reportViewError(error); return null; }
}
function mountViews() {
  controllers = [];
  // A fresh mount belongs to a different store. Discard old form nodes and
  // their event closures; normal render() calls still preserve active drafts.
  for (const root of document.querySelectorAll('#planner, #calendar, #setup, #timetable')) root.replaceChildren();
  refreshAnalyses();
  const planner = mount(() => mountPlanner(plannerRoot, store), plannerRoot);
  const calendarRoot = document.querySelector('#calendar');
  mount(() => mountCalendar(calendarRoot, store, {
    getLabel: session => analyses.get(session.subjectId)?.labels[session.id] ?? 'Check schedule first',
    getStatus: session => analyses.get(session.subjectId)?.statuses[session.id] ?? 'check',
    onPreview: sessionId => {
      if (!planner) throw new Error('The planner is unavailable.');
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
}
function render() {
  refreshAnalyses();
  welcome.hidden = state.subjects.length > 0;
  exampleButton.disabled = mode === 'local' && persistence.paused;
  document.querySelector('#today-label').textContent = new Date().toLocaleDateString(undefined, {weekday:'short',month:'short',day:'numeric'});
  for (const controller of controllers) { try { controller.render(); } catch (error) { reportViewError(error); } }
  updateAccount();
}
function switchMode(next) {
  mode = next; store = next === 'local' ? localStore : cloudStore;
  mountViews(); render();
  showStatus(next === 'local'
    ? (persistence.paused ? 'Local saving is paused. Your original data is protected.' : 'Your local browser planner is ready.')
    : (dirtyCloud() ? 'Unsaved account changes. Use Save to account.' : 'Account planner loaded. Changes need Save to account.'), next === 'local' && persistence.paused);
}
function confirmViewChange() {
  return window.confirm('Switch planners? Unsubmitted form and timetable import drafts will be cleared. Saved local records and account edits remain separate.');
}
async function action(task) {
  if (busy) return;
  busy = true; updateAccount();
  try { await task(); }
  catch (error) {
    const suffix = error.status === 409 ? ' Download your draft before loading the latest account records.' : error.status === 401 ? ' Download unsaved account changes before signing out and signing in again.' : '';
    message(`${error.message}${suffix}`, true);
    if (mode === 'cloud') showStatus('Account operation failed. Your current records are retained; download a backup or retry.', true);
  } finally { busy = false; updateAccount(); }
}
function useCloud(result) {
  cloudStore = createStore(result.state, {onListenerError:reportViewError});
  cloudPersistence = createCloudPersistence(api, result);
  observeCloud();
  switchMode('cloud');
}
authForm.addEventListener('submit', event => {
  event.preventDefault();
  const kind = event.submitter?.value === 'register' ? 'register' : 'login';
  if (kind === 'register' && !authForm.elements.name.value.trim()) { message('Enter your name to create an account.', true); return; }
  if (!confirmViewChange()) return;
  const input = {email:authForm.elements.email.value.trim(),password:authForm.elements.password.value};
  if (kind === 'register') input.name = authForm.elements.name.value.trim();
  action(async () => {
    message('Opening your account…');
    const signedIn = await api.authenticate(kind, input);
    try {
      const result = await api.load();
      user = signedIn; authForm.elements.password.value = '';
      await localPending;
      useCloud(result);
      message('Account planner opened. Your local browser planner has not been uploaded or changed.');
    } catch (error) { api.signOut(); throw error; }
  });
});
cloudSave.addEventListener('click', () => action(async () => {
  message('Saving account changes…');
  await cloudPersistence.save(cloudStore.get());
  message('Account save confirmed.');
  if (mode === 'cloud') showStatus(dirtyCloud() ? 'More account edits are unsaved. Save again.' : 'Saved to your account.', dirtyCloud());
}));
document.querySelector('#cloud-reload').addEventListener('click', () => {
  if (!confirmViewChange()) return;
  if (dirtyCloud() && !window.confirm('Discard unsaved account changes and load the latest server records? Download your account draft first if you want to keep it.')) return;
  action(async () => { useCloud(await api.load()); message('Latest account planner loaded. Local records remain unchanged.'); });
});
document.querySelector('#local-open').addEventListener('click', () => {
  if (busy || !confirmViewChange()) return;
  switchMode('local'); message(dirtyCloud() ? 'Local planner opened. Unsaved account edits remain in this tab; reopen the account planner to save them.' : 'Local browser planner opened.');
});
document.querySelector('#cloud-open').addEventListener('click', () => {
  if (busy || !confirmViewChange()) return;
  switchMode('cloud'); message('Account planner reopened.');
});
document.querySelector('#local-upload').addEventListener('click', () => {
  if (persistence.paused || !confirmViewChange()) return;
  if (!window.confirm('Replace your account planner with a copy of the local browser planner? This replaces all existing account records after you save. Local records will be kept.')) return;
  if (dirtyCloud() && !window.confirm('This also replaces unsaved account edits in this tab. Continue?')) return;
  // Load first so replacement is based on the current server revision; a racing write still yields 409.
  action(async () => {
    await localPending;
    const result = await api.load();
    cloudPersistence = createCloudPersistence(api, result);
    cloudStore = createStore(localStore.get(), {onListenerError:reportViewError});
    observeCloud(); switchMode('cloud');
    message('Local planner copied into an account draft. Click Save to account to confirm the upload.');
    showStatus('Account draft ready. Click Save to account to upload.', true);
  });
});
document.querySelector('#account-signout').addEventListener('click', () => {
  if (busy || !confirmViewChange()) return;
  if (dirtyCloud() && !window.confirm('Sign out and discard unsaved account changes? Download your account draft first to keep it.')) return;
  api.signOut(); user = null; cloudStore = null; cloudPersistence = null;
  switchMode('local'); message('Signed out. Your local browser planner is ready.');
});
function download(records, label) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(records, null, 2)], {type:'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = `can-i-bunk-${label}-${today()}.json`;
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
document.querySelector('#download-local').addEventListener('click', () => download(localStore.get(), 'local'));
document.querySelector('#download-account').addEventListener('click', () => { if (cloudStore) download(cloudStore.get(), 'account'); });

if (persistence.loaded.error) {
  document.querySelector('#recovery-message').textContent = persistence.loaded.error;
  showStatus('Saving paused. Your original saved data is protected.', true);
} else showStatus(state.subjects.length ? 'Your saved planner is ready.' : 'Drop a timetable to get started. Changes save in this browser.');
document.querySelector('#start-fresh').addEventListener('click', () => {
  if (mode !== 'local' || !window.confirm('Replace the unreadable saved records with an empty planner? This cannot be undone.')) return;
  const result = persistence.replace(emptyState());
  if (!result.ok) { showStatus(result.error, true); return; }
  window.location.reload();
});
document.querySelector('#reload-planner').addEventListener('click', () => {
  if (window.confirm('Reload the newer saved planner? Download unsaved local or account changes first; they will be lost.')) window.location.reload();
});
exampleButton.addEventListener('click', () => {
  if (store.get().subjects.length || (mode === 'local' && persistence.paused)) return;
  try {
    const start = new Date(); start.setHours(12,0,0,0);
    const end = new Date(start); end.setDate(end.getDate() + 10);
    const subject = createSubject({name:'Example: Applied mathematics',total:40,attended:20,missed:9,endDate:localDate(end),weekly:[]});
    const sessions = Array.from({length:11}, (_, index) => { const date = new Date(start); date.setDate(date.getDate() + index); return createSession(subject.id,localDate(date),'09:00'); });
    store.update(draft => { draft.subjects.push(subject); draft.sessions.push(...sessions); });
  } catch (error) { showStatus(error.message || 'Could not open example data.', true); }
});
document.querySelector('#reset-planner').addEventListener('click', () => {
  if (mode === 'local' && persistence.paused) { (persistence.loaded.error ? recovery : conflict).scrollIntoView({block:'center'}); return; }
  if (!window.confirm(`Clear all subjects, attendance, and plans in the ${mode === 'local' ? 'local browser' : 'account draft'} planner?${mode === 'cloud' ? ' Use Save to account to apply this deletion.' : ' This cannot be undone.'}`)) return;
  store.update(draft => Object.assign(draft, emptyState()));
});
function refreshDate() { if (lastDate !== today()) { lastDate = today(); render(); } }
window.setInterval(refreshDate, 60_000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshDate(); });
window.addEventListener('storage', event => {
  if (event.key === 'can-i-bunk.v1' || event.key === null) {
    persistence.pause();
    if (mode === 'local') showStatus('Another tab changed this planner. Saving is paused to protect its newer records.', true);
    render();
  }
});
window.addEventListener('beforeunload', event => {
  if (dirtyCloud()) { event.preventDefault(); event.returnValue = ''; }
});
mountViews(); render();
