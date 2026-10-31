import {createStore,emptyState,createSubject,createSession,today,localDate} from './data.js';
import {loadState,saveState} from './storage.js';
import {mountSetup} from './setup.js';
import {mountCalendar} from './calendar.js';
import {mountPlanner,getSessionLabel} from './planner.js';

const loaded=loadState();
const store=createStore(loaded.state);
let savingPaused=Boolean(loaded.error);
let lastDate=today();
const status=document.querySelector('#save-status');
const recovery=document.querySelector('#recovery');
const welcome=document.querySelector('#welcome');
const exampleButton=document.querySelector('#try-example');
const plannerRoot=document.querySelector('#planner');

function showStatus(text,error=false) {
  status.textContent=text;
  status.className=error?'error':'';
}

function persist(state) {
  if(savingPaused) {
    showStatus('Saving paused. Original saved data is protected.',true);
    return;
  }
  const result=saveState(state);
  showStatus(result.ok?'Saved in this browser.':result.error,!result.ok);
}

const planner=mountPlanner(plannerRoot,store);
const calendar=mountCalendar(document.querySelector('#calendar'),store,{
  getLabel:session=>getSessionLabel(store.get(),session),
  onPreview:sessionId=>{
    planner.preview(sessionId);
    plannerRoot.scrollIntoView({behavior:'auto',block:'start'});
    const preview=plannerRoot.querySelector('.planner-preview');
    if(preview) { preview.tabIndex=-1; preview.focus({preventScroll:true}); }
  }
});
const setup=mountSetup(document.querySelector('#setup'),store);

function render() {
  const state=store.get();
  welcome.hidden=state.subjects.length>0;
  exampleButton.disabled=savingPaused;
  document.querySelector('#today-label').textContent=new Date().toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
  calendar.render();
  planner.render();
  setup.render();
}

store.subscribe(state=>{render();persist(state);});

if(loaded.error) {
  recovery.hidden=false;
  document.querySelector('#recovery-message').textContent=loaded.error;
  showStatus('Saving paused. Review the saved-data message below.',true);
} else {
  showStatus(loaded.state.subjects.length?'Your saved planner is ready.':'Ready when you are. Changes save in this browser.');
}

document.querySelector('#start-fresh').addEventListener('click',()=>{
  if(!window.confirm('Replace the original saved data with an empty planner? This cannot be undone.')) return;
  savingPaused=false;
  recovery.hidden=true;
  store.update(state=>Object.assign(state,emptyState()));
});

exampleButton.addEventListener('click',()=>{
  if(store.get().subjects.length||savingPaused) return;
  try {
    const start=new Date(); start.setHours(12,0,0,0);
    const end=new Date(start); end.setDate(end.getDate()+10);
    const subject=createSubject({name:'Example: Applied mathematics',total:40,attended:20,missed:9,endDate:localDate(end),weekly:[]});
    const sessions=Array.from({length:11},(_,index)=>{
      const date=new Date(start); date.setDate(date.getDate()+index);
      return createSession(subject.id,localDate(date),'09:00');
    });
    store.update(state=>{state.subjects.push(subject);state.sessions.push(...sessions);});
  } catch(error) {showStatus(error.message||'Could not open example data.',true);}
});

document.querySelector('#reset-planner').addEventListener('click',()=>{
  if(savingPaused) {recovery.scrollIntoView({block:'center'});return;}
  if(!window.confirm('Clear all subjects, attendance, and plans in this browser? This cannot be undone.')) return;
  store.update(state=>Object.assign(state,emptyState()));
  document.querySelector('#setup').scrollIntoView({block:'start'});
});

function refreshDate() {
  if(lastDate!==today()) {lastDate=today();render();}
}
window.setInterval(refreshDate,60_000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden) refreshDate();});
window.addEventListener('storage',event=>{
  if(event.key==='can-i-bunk.v1') showStatus('Another tab changed your saved planner. Reload before making further edits to avoid overwriting it.',true);
});
render();
