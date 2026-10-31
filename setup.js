import {element} from './dom.js';
import {createSubject, createSession, today, localDate, validDate} from './data.js';
import {analyze} from './attendance.js';

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];



function button(text, action, className) {
  const node = element('button', text, className);
  node.type = 'button';
  if (action) node.addEventListener('click', action);
  return node;
}

function commitForm(form, action) {
  form.dataset.dirty = 'false';
  try { action(); }
  catch (error) { form.dataset.dirty = 'true'; throw error; }
}

function field(parent, text, type, value = '', attributes = {}) {
  const label = element('label', undefined, 'field');
  label.append(element('span', text));
  const input = element('input');
  input.type = type;
  input.value = String(value);
  Object.assign(input, attributes);
  label.append(input);
  parent.append(label);
  return input;
}

function disclosure(title, key, openKeys) {
  const details = element('details');
  details.dataset.setupKey = key;
  details.open = openKeys.has(key);
  details.append(element('summary', title));
  return details;
}

/** Generate only a brand-new subject's schedule. Existing schedules are edited explicitly. */
export function generateSessions(subject, start = today()) {
  if (!validDate(start) || !validDate(subject.endDate)) throw new Error('Enter valid calendar dates.');
  if (subject.endDate < start) return [];
  const [year, month, day] = start.split('-').map(Number);
  const cursor = new Date(year, month - 1, day, 12);
  const sessions = [];
  let days = 0;
  while (localDate(cursor) <= subject.endDate) {
    if (++days > 366 * 3) throw new Error('Choose a semester end date within three years.');
    for (const slot of subject.weekly) {
      if (slot.day === cursor.getDay()) sessions.push(createSession(subject.id, localDate(cursor), slot.time));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return sessions;
}

export function mountSetup(root, store) {
  let message = '';
  let messageIsError = false;
  const openKeys = new Set();
  const messageBox = element('p', '', 'notice');
  messageBox.setAttribute('role', 'status');

  function report(text, error = false) {
    message = text;
    messageIsError = error;
    messageBox.textContent = text;
    messageBox.className = error ? 'error' : 'notice';
    messageBox.hidden = !text;
  }

  function act(action, success) {
    try {
      action();
      report(success);
    } catch (error) {
      report(error.message || 'The change could not be saved.', true);
    }
  }

  function timetable(parent, initial = []) {
    const group = element('fieldset', undefined, 'weekly-editor');
    group.append(element('legend', 'Weekly classes'));
    group.append(element('p', 'Add each weekly meeting separately, including two classes on the same day.', 'muted'));
    const rows = element('div', undefined, 'weekly-rows');
    group.append(rows);
    function addRow(slot = {day: 1, time: '09:00'}) {
      const row = element('div', undefined, 'weekly-row');
      const label = element('label', undefined, 'field');
      label.append(element('span', 'Weekday'));
      const select = element('select');
      weekdays.forEach((day, index) => {
        const option = element('option', day);
        option.value = String(index);
        select.append(option);
      });
      select.value = String(slot.day);
      label.append(select);
      row.append(label);
      const time = field(row, 'Class time', 'time', slot.time, {required: true});
      row.append(button('Remove weekly meeting', () => { row.remove(); parent.dataset.dirty = 'true'; }, 'quiet'));
      row.getSlot = () => ({day: Number(select.value), time: time.value});
      rows.append(row);
    }
    initial.forEach(addRow);
    group.append(button('Add weekly meeting', () => { addRow(); parent.dataset.dirty = 'true'; }, 'secondary'));
    parent.append(group);
    return () => [...rows.children].map(row => row.getSlot());
  }

  function subjectForm(parent, subject = null) {
    const form = element('form', undefined, 'setup-form');
    form.dataset.formKey = subject ? `subject-${subject.id}` : 'new-subject';
    const fields = element('div', undefined, 'form-grid');
    const name = field(fields, 'Subject name', 'text', subject?.name || '', {required: true, maxLength: 120});
    const total = field(fields, 'Planned semester sessions', 'number', subject?.total ?? '', {required: true, min: '1', step: '1'});
    if (subject?.totalMode === 'inferred') {
      total.readOnly = true;
      total.title = 'Estimated from starting held counts plus active calendar classes; updates when classes change.';
    }
    const attended = field(fields, 'Already attended', 'number', subject?.attended ?? 0, {required: true, min: '0', step: '1'});
    const held = field(fields, 'Sessions held before calendar', 'number', subject ? subject.attended + subject.missed : 0, {required: true, min: '0', step: '1'});
    const endDate = field(fields, 'Semester end date', 'date', subject?.endDate || '', {required: true});
    form.append(fields);
    form.append(element('p', 'Starting counts cover classes before your calendar entries. If a class earlier today is already counted, remove that duplicate calendar entry.', 'muted'));
    const getWeekly = timetable(form, subject?.weekly || []);
    if (subject) {
      form.append(element('p', 'Saving changes updates subject details only. It never replaces existing classes or attendance. Use the schedule controls below to add, move, cancel, or remove individual sessions.', 'notice'));
    } else {
      form.append(element('p', 'Saving generates classes from today through the end date. You can also leave weekly meetings empty and add classes individually.', 'muted'));
    }
    const submit = element('button', subject ? 'Save subject details' : 'Add subject and classes');
    submit.type = 'submit';
    form.append(submit);
    form.addEventListener('submit', event => {
      event.preventDefault();
      act(() => {
        const input = {name: name.value, total: Number(total.value), attended: Number(attended.value), missed: Number(held.value) - Number(attended.value), endDate: endDate.value, weekly: getWeekly()};
        if (subject?.historyThrough) input.historyThrough = subject.historyThrough;
        if (subject?.historyThroughTime) input.historyThroughTime = subject.historyThroughTime;
        const validated = createSubject(input);
        if (subject) {
          commitForm(form, () => store.update(state => {
            const index = state.subjects.findIndex(item => item.id === subject.id);
            if (index < 0) throw new Error('This subject no longer exists.');
            state.subjects[index] = {...state.subjects[index], ...validated, id: subject.id};
          }));
        } else {
          const sessions = generateSessions(validated);
          openKeys.add(`subject-${validated.id}`);
          commitForm(form, () => store.update(state => { state.subjects.push(validated); state.sessions.push(...sessions); }));
          form.reset();
        }
      }, subject ? 'Subject details saved. Existing calendar sessions were preserved.' : 'Subject added. Check the session count before relying on a bunk forecast.');
    });
    parent.append(form);
  }

  function sessionEditor(parent, session) {
    const title = `${session.date} at ${session.time} — ${session.cancelled ? 'cancelled' : session.actual === 'unmarked' ? 'not marked' : session.actual}`;
    const details = disclosure(title, `session-${session.id}`, openKeys);
    details.className = 'session-editor';
    const form = element('form', undefined, 'session-edit-form');
    form.dataset.formKey = `session-${session.id}`;
    const fields = element('div', undefined, 'form-grid');
    const date = field(fields, 'Class date', 'date', session.date, {required: true});
    const time = field(fields, 'Class time', 'time', session.time, {required: true});
    form.append(fields);
    form.append(element('p', 'Moving a class preserves its attendance and bunk plan.', 'muted'));
    const actions = element('div', undefined, 'actions');
    const move = element('button', 'Move class');
    move.type = 'submit';
    actions.append(move);
    actions.append(button(session.cancelled ? 'Restore class' : 'Cancel class', () => act(() => {
      store.update(state => {
        const item = state.sessions.find(candidate => candidate.id === session.id);
        if (!item) throw new Error('This class no longer exists.');
        item.cancelled = !item.cancelled;
      });
    }, 'Class updated. Check that the semester total still matches the calendar.'), 'secondary'));
    const remove = button('Remove class', () => act(() => {
      store.update(state => {
        const item = state.sessions.find(candidate => candidate.id === session.id);
        if (!item) throw new Error('This class no longer exists.');
        if (item.actual !== 'unmarked') throw new Error('Undo this class’s attendance mark in the calendar before removing it.');
        state.sessions = state.sessions.filter(candidate => candidate.id !== session.id);
      });
    }, 'Class removed. Check the planned semester total.'), 'danger');
    remove.disabled = session.actual !== 'unmarked';
    if (remove.disabled) remove.title = 'Undo attendance in the calendar first.';
    actions.append(remove);
    form.append(actions);
    form.addEventListener('submit', event => {
      event.preventDefault();
      act(() => commitForm(form, () => store.update(state => {
        const item = state.sessions.find(candidate => candidate.id === session.id);
        if (!item) throw new Error('This class no longer exists.');
        if (item.actual !== 'unmarked' && date.value > today()) throw new Error('Undo attendance before moving a recorded class into the future.');
        item.date = date.value;
        item.time = time.value;
      })), 'Class moved. Its attendance and plan were preserved.');
    });
    details.append(form);
    parent.append(details);
  }

  function scheduleEditor(parent, subject, sessions) {
    const details = disclosure(`Manage ${sessions.length} calendar sessions`, `schedule-${subject.id}`, openKeys);
    const form = element('form', undefined, 'add-session-form');
    form.dataset.formKey = `add-session-${subject.id}`;
    form.append(element('h4', 'Add an individual class'));
    const fields = element('div', undefined, 'form-grid');
    const date = field(fields, 'New class date', 'date', today(), {required: true});
    const time = field(fields, 'New class time', 'time', '09:00', {required: true});
    form.append(fields);
    const add = element('button', 'Add class');
    add.type = 'submit';
    form.append(add);
    form.addEventListener('submit', event => {
      event.preventDefault();
      act(() => commitForm(form, () => store.update(state => state.sessions.push(createSession(subject.id, date.value, time.value)))), 'Class added. Check that the semester total matches the calendar.');
    });
    details.append(form);
    if (!sessions.length && subject.weekly.length) {
      details.append(button('Generate weekly classes', () => act(() => {
        const generated = generateSessions(subject);
        store.update(state => {
          if (state.sessions.some(item => item.subjectId === subject.id)) throw new Error('Weekly generation is only available for an empty schedule. Edit existing classes individually.');
          state.sessions.push(...generated);
        });
      }, 'Weekly classes generated. Check the total.'), 'secondary'));
    }
    details.append(element('p', 'Cancellation excludes a class from attendance counts; postponement only changes its date. After cancelling or removing a class, reconcile the planned semester total. Marked classes cannot be removed until their attendance is undone.', 'muted'));
    sessions.forEach(session => sessionEditor(details, session));
    parent.append(details);
  }

  function render() {
    const active = root.contains(document.activeElement) ? document.activeElement : null;
    const drafts = new Map([...root.querySelectorAll('form[data-form-key]')]
      .filter(form => form.dataset.dirty === 'true' || (form.dataset.dirty !== 'false' && form.contains(active)))
      .map(form => [form.dataset.formKey, form]));
    for (const details of root.querySelectorAll('details[data-setup-key]')) {
      if (details.open) openKeys.add(details.dataset.setupKey);
      else openKeys.delete(details.dataset.setupKey);
    }
    const state = store.get();
    root.replaceChildren();
    root.append(element('h2', 'Advanced subject & schedule corrections'));
    root.append(element('p', 'Import your timetable above for automatic subject setup. Use these controls to correct totals, history, or individual dates.', 'muted'));
    root.append(messageBox);
    report(message, messageIsError);
    const add = disclosure('Add a subject', 'new-subject', openKeys);
    if (!state.subjects.length) add.open = true;
    subjectForm(add);
    root.append(add);
    state.subjects.forEach(subject => {
      const details = disclosure(subject.name, `subject-${subject.id}`, openKeys);
      details.className = 'subject-card';
      const sessions = state.sessions.filter(session => session.subjectId === subject.id).sort((a,b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
      const result = analyze(state, subject.id);
      const expected = subject.total - subject.attended - subject.missed;
      const active = sessions.filter(session => !session.cancelled).length;
      details.append(element('p', `${subject.attended} attended + ${subject.missed} missed before calendar; ${active} active calendar sessions; ${subject.total} planned in total.`, 'muted'));
      if (result.mismatch) details.append(element('p', `Calendar mismatch: expected ${expected} calendar sessions, found ${active}. Add or remove classes, or correct the semester total before trusting the forecast.`, 'error'));
      if (result.unresolved.length) details.append(element('p', `${result.unresolved.length} past class(es) need an attendance mark in the calendar.`, 'notice'));
      subjectForm(details, subject);
      scheduleEditor(details, subject, sessions);
      root.append(details);
    });
    for (const form of root.querySelectorAll('form[data-form-key]')) {
      const draft = drafts.get(form.dataset.formKey);
      if (draft) form.replaceWith(draft);
      else {
        form.addEventListener('input', () => { form.dataset.dirty = 'true'; });
        form.addEventListener('change', () => { form.dataset.dirty = 'true'; });
      }
    }
    if (active && root.contains(active)) active.focus({preventScroll:true});
  }

  render();
  return {render};
}
