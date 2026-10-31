import {today} from './data.js';
export function classify(attended,total) {
  if(!Number.isSafeInteger(total)||total<=0||!Number.isSafeInteger(attended)||attended<0||attended>total) throw new Error('Invalid attendance counts.');
  return 4*attended>=3*total?'safe':5*attended>=3*total?'grade-drop':'retake';
}
export function analyze(state,subjectId,asOf=today()) {
  const subject=state.subjects.find(s=>s.id===subjectId); if(!subject) throw new Error('Subject not found.');
  const sessions=state.sessions.filter(s=>s.subjectId===subjectId&&!s.cancelled);
  const A=subject.attended+sessions.filter(s=>s.actual==='attended').length;
  const M=subject.missed+sessions.filter(s=>s.actual==='missed').length;
  const remaining=sessions.filter(s=>s.actual==='unmarked');
  const R=remaining.length,B=remaining.filter(s=>s.plan==='bunk').length,N=subject.total;
  const required75=Math.ceil(3*N/4),required60=Math.ceil(3*N/5);
  const mismatch=A+M+R!==N, unresolved=remaining.filter(s=>s.date<asOf).map(s=>s.id);
  const reliable=!mismatch&&!unresolved.length;
  const best=A+R-B,maximum=A+R,allowance=best-required75;
  const labels={};
  for(const s of state.sessions.filter(s=>s.subjectId===subjectId)) {
    labels[s.id]=s.cancelled?'Cancelled':s.actual!=='unmarked'?(s.actual==='attended'?'Attended':'Missed'):s.date<asOf?'Needs attendance mark':!reliable?'Check schedule first':s.plan==='bunk'?'Planned bunk':allowance<0?'Plan exceeds allowance':allowance===0?'Must attend for 75%':'Can choose to bunk';
  }
  return {subjectId,N,A,M,R,B,required75,required60,mismatch,unresolved,reliable,currentPercent:A+M?100*A/(A+M):null,best,maximum,allowance,deficit:Math.max(0,-allowance),bestPercent:100*best/N,maximumPercent:100*maximum/N,canRecover75:maximum>=required75,canRecover60:maximum>=required60,outcome:reliable?classify(best,N):null,labels};
}
export function previewBunk(state,sessionId,asOf=today()) {
  const draft=structuredClone(state),session=draft.sessions.find(s=>s.id===sessionId);
  if(!session||session.cancelled||session.actual!=='unmarked'||session.date<asOf) throw new Error('Only an upcoming unmarked class can be previewed.');
  const before=analyze(state,session.subjectId,asOf); session.plan='bunk';
  const after=analyze(draft,session.subjectId,asOf);
  return {before,after,mandatoryIds:Object.keys(after.labels).filter(id=>after.labels[id]==='Must attend for 75%')};
}
