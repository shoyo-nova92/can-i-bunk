import { today } from './data.js';
import { analyze, previewBunk } from './attendance.js';

const percent = value => `${value.toFixed(1)}%`;
const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
const sessionOrder = (a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);
const upcoming = session => !session.cancelled && session.actual === 'unmarked' && session.date >= today();

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function button(text, action, disabled = false) {
  const node = element('button', text);
  node.type = 'button';
  node.disabled = disabled;
  node.addEventListener('click', action);
  return node;
}

function option(value, text) {
  const node = element('option', text);
  node.value = value;
  return node;
}

function classDescription(session) {
  return `${session.date === today() ? 'Today' : session.date}, ${session.time}`;
}

function allowanceText(result) {
  if (result.allowance < 0) return `${plural(result.deficit, 'attendance')} short of 75% under this plan`;
  return `${plural(result.allowance, 'additional bunk')} available`;
}

export function getSessionLabel(state, session) {
  if (!session) return 'Class not found';
  if (!state.subjects.some(subject => subject.id === session.subjectId)) return 'Subject not found';
  return analyze(state, session.subjectId).labels[session.id] ?? 'Class not found';
}

export function mountPlanner(root, store) {
  let selectedSubjectId = '';
  let selectedSessionId = '';
  let previewId = '';
  let error = '';

  function changePlan(plan) {
    try {
      error = '';
      previewId = '';
      store.update(state => {
        const session = state.sessions.find(item => item.id === selectedSessionId);
        if (!session || !upcoming(session)) throw new Error('Choose an upcoming unmarked class first.');
        session.plan = plan;
      });
      render();
    } catch (reason) {
      error = reason.message || 'Could not change this plan.';
      render();
    }
  }

  function summary(subject, state) {
    const result = analyze(state, subject.id);
    const card = element('article', undefined, 'subject-card planner-subject');
    const heading = element('h3', subject.name);
    const counts = element('p', `${result.A} attended · ${result.M} missed · ${result.R} unmarked`, 'muted');
    const current = element('p', result.currentPercent === null
      ? 'Current attendance: no attendance recorded.'
      : `Current attendance: ${percent(result.currentPercent)}`);
    card.append(heading, counts, current);

    if (!result.reliable) {
      if (result.mismatch) {
        card.append(element('p', `Schedule needs checking: history and active calendar contain ${result.A + result.M + result.R} classes, but the semester total is ${result.N}. Correct the total or calendar in subject setup.`, 'notice'));
      }
      if (result.unresolved.length) {
        card.append(element('p', `Mark ${plural(result.unresolved.length, 'past class', 'past classes')} before trusting future bunk advice.`, 'notice'));
      }
      card.append(element('p', 'Final forecast and bunk allowance are unavailable until these issues are resolved.', 'muted'));
    } else {
      card.append(element('p', allowanceText(result), result.allowance < 0 ? 'error planner-allowance' : 'planner-allowance'));
      card.append(element('p', `Best final attendance under your plan: ${result.best}/${result.N} (${percent(result.bestPercent)}).`));
      card.append(element('p', `${plural(result.B, 'planned bunk')}. Need ${result.required75} attendances for 75%; ${result.required60} to avoid a retake.`, 'muted'));

      if (!result.canRecover75) {
        card.append(element('p', `75% is unreachable even if you attend every remaining class. The best possible result is ${result.maximum}/${result.N} (${percent(result.maximumPercent)}).`, 'error'));
        card.append(element('p', result.canRecover60
          ? '60% is still reachable: you can avoid a retake, but the grade-drop threshold cannot be met.'
          : '60% is also unreachable. The final attendance falls in the retake zone even with perfect remaining attendance.', 'notice'));
      } else if (result.deficit) {
        card.append(element('p', `Clear at least ${plural(result.deficit, 'planned bunk')} and attend those classes to make 75% possible again.`, 'error'));
      } else if (result.allowance === 0 && result.R > result.B) {
        card.append(element('p', 'Every remaining class outside your planned bunks must be attended to reach 75%.', 'notice'));
      }
      if (result.best < result.required60) {
        card.append(element('p', 'Your current plan ends below 60%: retake zone. Change planned bunks where possible.', 'error'));
      } else if (result.best < result.required75) {
        card.append(element('p', 'Your current plan ends below 75%: grade-drop zone.', 'notice'));
      }
    }
    return card;
  }

  function previewSection(state) {
    if (!previewId) return null;
    const session = state.sessions.find(item => item.id === previewId);
    if (!session || !upcoming(session)) {
      previewId = '';
      return null;
    }
    const subject = state.subjects.find(item => item.id === session.subjectId);
    const result = previewBunk(state, session.id);
    const section = element('section', undefined, 'planner-preview');
    section.setAttribute('aria-label', 'Bunk preview');
    section.append(element('h3', `What if I bunk ${classDescription(session)}?`));
    section.append(element('p', `${subject.name}. Preview only — your saved plan has not changed.`, 'muted'));
    if (!result.before.reliable) {
      section.append(element('p', 'This forecast is not reliable. Reconcile the schedule and mark past classes before deciding to bunk.', 'notice'));
    } else {
      section.append(element('p', `Before: ${allowanceText(result.before)}. After: ${allowanceText(result.after)}.`));
      section.append(element('p', `Best final attendance: ${percent(result.before.bestPercent)} before → ${percent(result.after.bestPercent)} after (${result.after.best}/${result.after.N}).`));
      if (session.plan === 'bunk') section.append(element('p', 'This class is already a planned bunk, so the preview uses no extra allowance.', 'muted'));
      if (result.after.deficit) {
        section.append(element('p', result.after.canRecover75
          ? `This plan cannot reach 75%. Clear ${plural(result.after.deficit, 'planned bunk')} to recover.`
          : '75% cannot be recovered, even by attending every remaining class.', 'error'));
      }
      const newMandatory = result.mandatoryIds.filter(id => result.before.labels[id] !== 'Must attend for 75%');
      section.append(element('p', `${plural(newMandatory.length, 'class', 'classes')} become mandatory under this preview.`));
      if (newMandatory.length) {
        const list = element('ul', undefined, 'planner-mandatory');
        for (const item of state.sessions.filter(item => newMandatory.includes(item.id)).sort(sessionOrder)) {
          list.append(element('li', `${subject.name}: ${classDescription(item)}`));
        }
        section.append(list);
      } else if (result.mandatoryIds.length) {
        section.append(element('p', `${plural(result.mandatoryIds.length, 'other class', 'other classes')} were already mandatory.`, 'muted'));
      }
    }
    section.append(button('Close preview', () => { previewId = ''; render(); }));
    return section;
  }

  function render() {
    const state = store.get();
    const active = root.contains(document.activeElement) ? document.activeElement : null;
    const focusKey = active?.dataset?.plannerFocus;
    root.replaceChildren();
    root.append(element('h2', 'Plan your next bunk'));
    root.append(element('p', 'Possible bunks are alternatives. Choosing one uses an allowance that other classes may need.', 'notice'));
    root.append(element('p', 'Forecasts assume you attend every remaining class outside your selected bunks. Penalties are assessed per subject at semester end: 75% or above is safe, 60% to below 75% means a grade drop, and below 60% means a retake.', 'muted'));
    if (error) {
      const message = element('p', error, 'error');
      message.setAttribute('role', 'alert');
      root.append(message);
    }
    if (!state.subjects.length) {
      root.append(element('p', 'Add a subject and its remaining classes to see your bunk allowance.', 'planner-empty'));
      return;
    }
    const summaries = element('div', undefined, 'planner-summaries');
    for (const subject of state.subjects) summaries.append(summary(subject, state));
    root.append(summaries);

    if (!state.subjects.some(subject => subject.id === selectedSubjectId)) selectedSubjectId = state.subjects[0].id;
    const controls = element('section', undefined, 'planner-controls');
    controls.append(element('h3', 'Choose a class'));
    const subjectField = element('label', 'Subject', 'field');
    const subjectSelect = element('select');
    subjectSelect.dataset.plannerFocus = 'subject';
    for (const subject of state.subjects) subjectSelect.append(option(subject.id, subject.name));
    subjectSelect.value = selectedSubjectId;
    subjectSelect.addEventListener('change', () => {
      selectedSubjectId = subjectSelect.value;
      selectedSessionId = '';
      previewId = '';
      error = '';
      render();
    });
    subjectField.append(subjectSelect);
    controls.append(subjectField);

    const sessions = state.sessions.filter(session => session.subjectId === selectedSubjectId && upcoming(session)).sort(sessionOrder);
    if (!sessions.some(session => session.id === selectedSessionId)) selectedSessionId = sessions[0]?.id ?? '';
    const sessionField = element('label', 'Upcoming class', 'field');
    const sessionSelect = element('select');
    sessionSelect.dataset.plannerFocus = 'session';
    sessionSelect.disabled = !sessions.length;
    if (!sessions.length) sessionSelect.append(option('', 'No upcoming unmarked classes'));
    for (const session of sessions) {
      const intent = session.plan === 'bunk' ? 'planned bunk' : session.plan === 'attend' ? 'plan to attend' : 'undecided';
      sessionSelect.append(option(session.id, `${classDescription(session)} — ${intent}`));
    }
    sessionSelect.value = selectedSessionId;
    sessionSelect.addEventListener('change', () => { selectedSessionId = sessionSelect.value; previewId = ''; error = ''; render(); });
    sessionField.append(sessionSelect);
    controls.append(sessionField);
    const selected = sessions.find(session => session.id === selectedSessionId);
    if (selected) controls.append(element('p', getSessionLabel(state, selected), 'planner-selection-label'));
    const actions = element('div', undefined, 'actions');
    const items = [
      ['Preview bunk', () => preview(selectedSessionId), !selected],
      ['Want to bunk', () => changePlan('bunk'), !selected || selected.plan === 'bunk'],
      ['Plan to attend', () => changePlan('attend'), !selected || selected.plan === 'attend'],
      ['Clear plan', () => changePlan('undecided'), !selected || selected.plan === 'undecided']
    ];
    for (const [label, action, disabled] of items) {
      const actionButton = button(label, action, disabled);
      actionButton.dataset.plannerFocus = label;
      actions.append(actionButton);
    }
    controls.append(actions);
    if (!sessions.length) controls.append(element('p', 'Add upcoming sessions in subject setup, or undo an incorrect attendance mark in the calendar.', 'muted'));
    root.append(controls);
    const previewNode = previewSection(state);
    if (previewNode) root.append(previewNode);
    if (focusKey) {
      const target = [...root.querySelectorAll('[data-planner-focus]')].find(node => node.dataset.plannerFocus === focusKey);
      if (target && !target.disabled) target.focus({ preventScroll: true });
    }
  }

  function preview(sessionId) {
    try {
      const state = store.get();
      const session = state.sessions.find(item => item.id === sessionId);
      if (!session || !upcoming(session)) throw new Error('Choose an upcoming unmarked class to preview.');
      selectedSubjectId = session.subjectId;
      selectedSessionId = session.id;
      previewId = session.id;
      error = '';
      render();
    } catch (reason) {
      error = reason.message || 'Could not preview this class.';
      previewId = '';
      render();
    }
  }

  render();
  return { render, preview };
}
