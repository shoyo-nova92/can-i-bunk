import {today} from './data.js';

export const STATUS_LABELS = Object.freeze({
  cancelled: 'Cancelled', attended: 'Attended', missed: 'Missed',
  unresolved: 'Needs attendance mark', check: 'Check schedule first',
  bunk: 'Planned bunk', exceeded: 'Plan exceeds allowance',
  required: 'Must attend for 75%', available: 'Can choose to bunk'
});

export function classify(attended, total) {
  if (!Number.isSafeInteger(total) || total <= 0 || !Number.isSafeInteger(attended) || attended < 0 || attended > total) {
    throw new Error('Invalid attendance counts.');
  }
  return 4 * attended >= 3 * total ? 'safe' : 5 * attended >= 3 * total ? 'grade-drop' : 'retake';
}

export function formatPercent(value) {
  if (value === null || !Number.isFinite(value)) return 'No classes held';
  const rounded = Number(value.toFixed(1));
  if (value < 75 && rounded >= 75) return 'Below 75%';
  if (value < 60 && rounded >= 60) return 'Below 60%';
  return `${rounded.toFixed(1)}%`;
}

function sessionStatus(session, asOf, reliable, allowance) {
  if (session.cancelled) return 'cancelled';
  if (session.actual === 'attended') return 'attended';
  if (session.actual === 'missed') return 'missed';
  if (session.date < asOf) return 'unresolved';
  if (!reliable) return 'check';
  if (session.plan === 'bunk') return 'bunk';
  if (allowance < 0) return 'exceeded';
  return allowance === 0 ? 'required' : 'available';
}

export function analyze(state, subjectId, asOf = today()) {
  const subject = state.subjects.find(item => item.id === subjectId);
  if (!subject) throw new Error('Subject not found.');
  const allSessions = state.sessions.filter(item => item.subjectId === subjectId);
  const sessions = allSessions.filter(item => !item.cancelled);
  const attended = subject.attended + sessions.filter(item => item.actual === 'attended').length;
  const missed = subject.missed + sessions.filter(item => item.actual === 'missed').length;
  const remainingSessions = sessions.filter(item => item.actual === 'unmarked');
  const remaining = remainingSessions.length;
  const plannedBunks = remainingSessions.filter(item => item.plan === 'bunk').length;
  const total = subject.total;
  const required75 = Math.ceil(3 * total / 4);
  const required60 = Math.ceil(3 * total / 5);
  const mismatch = attended + missed + remaining !== total;
  const unresolved = remainingSessions.filter(item => item.date < asOf).map(item => item.id);
  const outsideSemester = sessions.filter(item => item.date > subject.endDate).map(item => item.id);
  const reliable = !mismatch && unresolved.length === 0 && outsideSemester.length === 0;
  const best = attended + remaining - plannedBunks;
  const maximum = attended + remaining;
  const attendanceSlack = best - required75;
  // A surplus cannot buy more absences than the sessions still available.
  const allowance = Math.min(remaining - plannedBunks, attendanceSlack);
  const statuses = Object.create(null);
  const labels = Object.create(null);
  for (const session of allSessions) {
    statuses[session.id] = sessionStatus(session, asOf, reliable, allowance);
    labels[session.id] = STATUS_LABELS[statuses[session.id]];
  }
  return {
    subjectId, N: total, A: attended, M: missed, R: remaining, B: plannedBunks,
    required75, required60, mismatch, unresolved, outsideSemester, reliable,
    currentPercent: attended + missed ? 100 * attended / (attended + missed) : null,
    best, maximum, attendanceSlack, allowance, deficit: Math.max(0, -attendanceSlack),
    bestPercent: 100 * best / total, maximumPercent: 100 * maximum / total,
    canRecover75: maximum >= required75, canRecover60: maximum >= required60,
    outcome: reliable ? classify(best, total) : null, statuses, labels
  };
}

export function previewBunk(state, sessionId, asOf = today()) {
  const draft = structuredClone(state);
  const session = draft.sessions.find(item => item.id === sessionId);
  if (!session || session.cancelled || session.actual !== 'unmarked' || session.date < asOf) {
    throw new Error('Only an upcoming unmarked class can be previewed.');
  }
  const before = analyze(state, session.subjectId, asOf);
  session.plan = 'bunk';
  const after = analyze(draft, session.subjectId, asOf);
  const mandatoryIds = Object.keys(after.statuses).filter(id => after.statuses[id] === 'required');
  return {before, after, mandatoryIds};
}
