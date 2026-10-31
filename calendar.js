import {element as node} from './dom.js';
import { localDate, today, markAttendance } from './data.js';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const parseDate = value => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};
const readableDate = value => parseDate(value).toLocaleDateString(undefined, {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
});



function button(text, action, key) {
  const element = node('button', text);
  element.type = 'button';
  element.dataset.calendarKey = key;
  element.addEventListener('click', action);
  return element;
}

const STATUS_CLASSES = Object.freeze({available:'status-safe',attended:'status-safe',bunk:'status-bunk',required:'status-required',missed:'status-warning',unresolved:'status-warning',exceeded:'status-warning'});
const labelStyle = status => STATUS_CLASSES[status] || 'status-neutral';

/** Mount a calendar view. app.js owns subscriptions and calls render after changes. */
export function mountCalendar(root, store, { getLabel = session => session.actual, getStatus = session => session.actual, onPreview = () => {} } = {}) {
  let selectedDate = today();
  let visibleMonth = new Date(parseDate(selectedDate).getFullYear(), parseDate(selectedDate).getMonth(), 1);
  let error = '';
  let subjectFilter = '';
  const headingId = `${root.id || 'attendance'}-month-heading`;

  function chooseDate(value, focusDay = false) {
    selectedDate = value;
    const date = parseDate(value);
    visibleMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    error = '';
    render();
    if (focusDay) findKey(`day-${value}`)?.focus();
  }

  function findKey(key) {
    return [...root.querySelectorAll('[data-calendar-key]')].find(element => element.dataset.calendarKey === key);
  }

  function setAttendance(id, actual) {
    try {
      error = '';
      markAttendance(store, id, actual);
    } catch (problem) {
      error = problem.message || 'Attendance could not be changed.';
    }
    render();
  }

  function changeMonth(offset) {
    visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + offset, 1);
    selectedDate = localDate(visibleMonth);
    error = '';
    render();
  }

  function render() {
    const active = root.contains(document.activeElement) ? document.activeElement.dataset.calendarKey : null;
    const state = store.get();
    if (subjectFilter && !state.subjects.some(subject => subject.id === subjectFilter)) subjectFilter = '';
    const subjects = new Map(state.subjects.map(subject => [subject.id, subject]));
    const sessions = state.sessions.filter(session => !subjectFilter || session.subjectId === subjectFilter)
      .sort((left, right) => left.date.localeCompare(right.date) || left.time.localeCompare(right.time));
    const currentDate = today();
    const section = node('section', undefined, 'attendance-calendar');
    section.setAttribute('aria-label', 'Attendance calendar');

    const toolbar = node('div', undefined, 'calendar-toolbar');
    const title = node('h2', visibleMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }));
    title.id = headingId;
    const navigation = node('div', undefined, 'actions calendar-navigation');
    const previous = button('Previous', () => changeMonth(-1), 'previous');
    previous.setAttribute('aria-label', 'Previous month');
    const next = button('Next', () => changeMonth(1), 'next');
    next.setAttribute('aria-label', 'Next month');
    navigation.append(previous, button('Today', () => chooseDate(today()), 'today'), next);
    toolbar.append(title, navigation);
    section.append(toolbar);

    const controls = node('div', undefined, 'calendar-controls');
    const filterLabel = node('label', 'Show subject', 'field');
    const filter = node('select');
    filter.dataset.calendarKey = 'subject-filter';
    const allOption = node('option', 'All subjects');
    allOption.value = '';
    filter.append(allOption);
    for (const subject of state.subjects) {
      const option = node('option', subject.name);
      option.value = subject.id;
      filter.append(option);
    }
    filter.value = subjectFilter;
    filter.addEventListener('change', () => { subjectFilter = filter.value; render(); });
    filterLabel.append(filter);
    controls.append(filterLabel);
    const unresolved = sessions.filter(session => !session.cancelled && session.actual === 'unmarked' && session.date < currentDate);
    if (unresolved.length) {
      controls.append(button(`Review ${unresolved.length} unmarked past ${unresolved.length === 1 ? 'class' : 'classes'}`,
        () => chooseDate(unresolved[0].date), 'review-past'));
    }
    section.append(controls);

    const grid = node('div', undefined, 'calendar-grid');
    grid.setAttribute('aria-labelledby', headingId);
    for (const weekday of WEEKDAYS) grid.append(node('div', weekday, 'calendar-weekday'));
    const firstWeekday = (visibleMonth.getDay() + 6) % 7;
    for (let gap = 0; gap < firstWeekday; gap++) {
      const blank = node('div', undefined, 'calendar-empty');
      blank.setAttribute('aria-hidden', 'true');
      grid.append(blank);
    }
    const days = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
    for (let day = 1; day <= days; day++) {
      const value = localDate(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day));
      const entries = sessions.filter(session => session.date === value);
      const dateButton = button('', () => chooseDate(value), `day-${value}`);
      dateButton.className = 'calendar-day';
      if (value === selectedDate) dateButton.classList.add('is-selected');
      if (value === currentDate) {
        dateButton.classList.add('is-today');
        dateButton.setAttribute('aria-current', 'date');
      }
      dateButton.setAttribute('aria-pressed', String(value === selectedDate));
      const labelSummary = entries.map(session => `${session.time} ${subjects.get(session.subjectId)?.name || 'Subject'}: ${getLabel(session)}`).join('; ');
      dateButton.setAttribute('aria-label', `${readableDate(value)}${value === currentDate ? ', today' : ''}. ${labelSummary || 'No classes'}`);
      dateButton.append(node('span', String(day), 'calendar-day-number'));
      for (const session of entries.slice(0, 2)) {
        const label = getLabel(session);
        const entry = node('span', `${session.time} ${subjects.get(session.subjectId)?.name || 'Subject'}`, `calendar-entry ${labelStyle(getStatus(session))}`);
        entry.append(node('span', label, 'calendar-entry-status'));
        dateButton.append(entry);
      }
      if (entries.length > 2) dateButton.append(node('span', `+${entries.length - 2} more`, 'calendar-more'));
      dateButton.addEventListener('keydown', event => {
        const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
        if (!(event.key in offsets)) return;
        event.preventDefault();
        const destination = parseDate(value);
        destination.setDate(destination.getDate() + offsets[event.key]);
        chooseDate(localDate(destination), true);
      });
      grid.append(dateButton);
    }
    section.append(grid);
    section.append(node('p', 'Choose a day to see its classes. Candidate bunks are alternatives; selecting a bunk may make other classes mandatory.', 'muted calendar-help'));

    const details = node('section', undefined, 'calendar-day-details');
    details.setAttribute('aria-label', 'Selected day classes');
    details.append(node('h3', `${selectedDate === currentDate ? 'Today · ' : ''}${readableDate(selectedDate)}`));
    const status = node('p', error, 'error');
    status.setAttribute('role', 'alert');
    status.hidden = !error;
    details.append(status);
    const daySessions = sessions.filter(session => session.date === selectedDate);
    if (!daySessions.length) {
      details.append(node('p', state.subjects.length ? 'No classes scheduled for this day. Add or move classes in subject setup.' : 'Add your first subject and weekly timetable to populate your calendar.', 'notice'));
    }
    for (const session of daySessions) {
      const label = getLabel(session);
      const card = node('article', undefined, `session-card ${labelStyle(getStatus(session))}`);
      card.dataset.sessionId = session.id;
      card.append(node('h4', `${session.time} · ${subjects.get(session.subjectId)?.name || 'Subject'}`));
      card.append(node('p', label, 'session-status'));
      if (session.cancelled) {
        card.append(node('p', 'Excluded from attendance. Restore this class in subject setup if it is happening.', 'muted'));
      } else {
        const actions = node('div', undefined, 'actions');
        for (const [value, text] of [['attended', 'Attended'], ['missed', 'Missed']]) {
          const control = button(text, () => setAttendance(session.id, value), `${session.id}-${value}`);
          control.disabled = session.date > currentDate;
          control.setAttribute('aria-pressed', String(session.actual === value));
          actions.append(control);
        }
        const undo = button('Undo mark', () => setAttendance(session.id, 'unmarked'), `${session.id}-undo`);
        undo.disabled = session.actual === 'unmarked';
        actions.append(undo);
        if (session.actual === 'unmarked' && session.date >= currentDate) {
          actions.append(button('Preview bunk', () => {
            try { error = ''; onPreview(session.id); }
            catch (problem) { error = problem.message || 'Preview unavailable.'; render(); }
          }, `${session.id}-preview`));
        }
        card.append(actions);
        if (session.date > currentDate) card.append(node('p', 'Mark attendance on the day of class. Use the planner to reserve a future bunk.', 'muted'));
      }
      details.append(card);
    }
    section.append(details);
    root.replaceChildren(section);
    if (active) findKey(active)?.focus({ preventScroll: true });
  }

  render();
  return { render };
}
