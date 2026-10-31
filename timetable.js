import {createSubject, localDate, today, validDate} from './data.js';
import {generateSessions} from './setup.js';
import {DAY_NAMES, parseTimetable} from './timetable-parser.js';

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function field(parent, labelText, type, value = '') {
  const label = node('label', undefined, 'field');
  label.append(node('span', labelText));
  const input = node('input');
  input.type = type;
  input.value = value;
  label.append(input);
  parent.append(label);
  return input;
}

function button(text, action, className = 'secondary') {
  const control = node('button', text, className);
  control.type = 'button';
  control.addEventListener('click', action);
  return control;
}

const nameKey = name => name.trim().toLowerCase();
const nextDate = value => {
  const [year, month, day] = value.split('-').map(Number);
  return localDate(new Date(year, month - 1, day + 1, 12));
};

/** Turn a reviewed weekly schedule into new records without changing saved state. */
export function buildTimetableImport(rows, counts, {cutoff, endDate, existingSubjects = [], asOf = today()}) {
  if (!validDate(cutoff) || cutoff > asOf) throw new Error('Counts-through date must be today or earlier.');
  if (!validDate(endDate) || endDate < cutoff) throw new Error('Semester end date must be on or after the counts-through date.');
  if (!Array.isArray(rows) || !rows.length || rows.length > 500) throw new Error('Review between 1 and 500 weekly meetings.');
  const grouped = new Map();
  for (const row of rows) {
    if (typeof row.subject !== 'string' || !row.subject.trim() || row.subject.trim().length > 120 || typeof row.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.time)) throw new Error('Every meeting needs a subject name and valid start time.');
    const key = nameKey(row.subject);
    if (!grouped.has(key)) grouped.set(key, {name: row.subject.trim(), weekly: []});
    grouped.get(key).weekly.push({day: row.day, time: row.time});
  }
  const existing = new Set(existingSubjects.map(subject => nameKey(subject.name)));
  const subjects = [], sessions = [];
  for (const [key, subject] of grouped) {
    if (existing.has(key)) throw new Error(`“${subject.name}” already exists. Import adds new subjects only; correct this name or manage the existing subject first.`);
    const input = counts.get(key);
    if (input?.attended === undefined || input?.held === undefined || !String(input.attended).trim() || !String(input.held).trim()) throw new Error(`Enter attended and held counts for ${subject.name}.`);
    const attended = Number(input.attended), held = Number(input.held);
    if (![attended, held].every(value => Number.isSafeInteger(value) && value >= 0) || attended > held) throw new Error(`${subject.name}: use whole numbers and keep attended no greater than held.`);
    const remaining = generateSessions({id: 'estimate', ...subject, endDate}, nextDate(cutoff));
    const total = held + remaining.length;
    if (!total) throw new Error(`${subject.name} has no held or future sessions. Correct its timetable or end date.`);
    const validated = createSubject({...subject, total, attended, missed: held - attended, endDate});
    subjects.push(validated);
    sessions.push(...remaining.map(session => ({...session, subjectId: validated.id})));
  }
  return {subjects, sessions};
}

/** Mount once: later app renders must never erase a partly reviewed timetable. */
export function mountTimetable(root, store) {
  const rows = [];
  const counts = new Map();
  let busy = false;
  const heading = node('h2', 'Drop your timetable');
  const introduction = node('p', 'Upload a PDF, Excel workbook, or image. We read it in this browser, then you review the detected classes. Your files are not uploaded or saved.', 'muted');
  const dropzone = node('div', undefined, 'timetable-dropzone');
  dropzone.append(node('p', 'Drop a PDF, .xlsx, .xls, CSV, or image here, or choose a file.'));
  const fileInput = field(dropzone, 'Timetable file', 'file');
  fileInput.accept = '.pdf,.xlsx,.xls,.csv,.tsv,.txt,image/png,image/jpeg,image/webp,image/bmp';
  const message = node('p', '', 'notice');
  message.setAttribute('role', 'status');
  message.setAttribute('aria-live', 'polite');
  message.hidden = true;
  const textDetails = node('details');
  textDetails.append(node('summary', 'Paste or correct extracted text'));
  const textLabel = node('label', undefined, 'field');
  textLabel.append(node('span', 'Timetable text'));
  const textArea = node('textarea');
  textArea.rows = 7;
  textArea.maxLength = 500000;
  textArea.placeholder = 'Monday 09:00 Mathematics\nTuesday 11:00 Physics\n\nOr paste a table with Time, Monday, Tuesday… columns.';
  textLabel.append(textArea);
  textDetails.append(textLabel);
  const parseButton = button('Find classes in text', () => parse(textArea.value));
  textDetails.append(parseButton);
  const warningsBox = node('div', undefined, 'timetable-warnings');
  const review = node('section', undefined, 'timetable-review');
  review.hidden = true;
  review.setAttribute('aria-label', 'Review imported timetable');
  review.append(node('h3', 'Review the classes we found'));
  review.append(node('p', 'Check against the original file, especially OCR, abbreviations, breaks, and double periods. The importer does not know your university’s subject codes or session weights.', 'muted'));
  const rowList = node('div', undefined, 'timetable-rows');
  review.append(rowList);
  review.append(button('Add missing meeting', () => addRow({subject: '', day: 1, time: '09:00'})));

  const form = node('form', undefined, 'timetable-counts-form');
  const dates = node('div', undefined, 'form-grid');
  const cutoff = field(dates, 'Counts include every class through', 'date', today());
  cutoff.required = true;
  cutoff.max = today();
  const endDate = field(dates, 'Semester end date', 'date');
  endDate.required = true;
  form.append(dates);
  form.append(node('p', 'Enter the counts separately for each subject. “Held” includes attended and missed classes through the selected date, including today. New calendar sessions start the following day, so today is not counted twice.', 'notice'));
  form.append(node('p', 'Semester totals are estimated as held so far + all weekly meetings through the end date. Review holidays, cancellations, and postponements in the calendar before trusting bunk advice.', 'muted'));
  const countsRoot = node('div', undefined, 'timetable-counts');
  form.append(countsRoot);
  const confirmationLabel = node('label', undefined, 'timetable-confirmation');
  const confirmation = node('input');
  confirmation.type = 'checkbox';
  confirmation.required = true;
  confirmationLabel.append(confirmation, node('span', 'I checked the subjects, days, times, and counts against my timetable.'));
  form.append(confirmationLabel);
  const submit = node('button', 'Create subjects and calendar');
  submit.type = 'submit';
  form.append(submit);
  review.append(form);
  root.replaceChildren(heading, introduction, dropzone, message, textDetails, warningsBox, review);

  function report(text, error = false) {
    message.textContent = text;
    message.className = error ? 'error' : 'notice';
    message.setAttribute('role', error ? 'alert' : 'status');
    message.hidden = !text;
  }

  function readRows() {
    return rows.map(row => ({subject: row.subject.value.trim(), day: Number(row.day.value), time: row.time.value}));
  }

  function saveCountDrafts() {
    for (const card of countsRoot.children) {
      if (card.attendedInput) counts.set(card.subjectKey, {attended: card.attendedInput.value, held: card.heldInput.value});
    }
  }

  function refreshCounts() {
    saveCountDrafts();
    countsRoot.replaceChildren();
    const grouped = new Map();
    for (const row of readRows()) {
      if (!row.subject) continue;
      const key = nameKey(row.subject);
      if (!grouped.has(key)) grouped.set(key, {name: row.subject, weekly: []});
      grouped.get(key).weekly.push({day: row.day, time: row.time});
    }
    for (const [key, subject] of grouped) {
      const card = node('section', undefined, 'subject-card timetable-subject');
      card.subjectKey = key;
      card.append(node('h4', subject.name));
      const grid = node('div', undefined, 'form-grid');
      const draft = counts.get(key) ?? {attended: '', held: ''};
      const attended = field(grid, `${subject.name}: attended so far`, 'number', draft.attended);
      const held = field(grid, `${subject.name}: sessions held so far`, 'number', draft.held);
      for (const input of [attended, held]) { input.required = true; input.min = '0'; input.step = '1'; }
      card.attendedInput = attended;
      card.heldInput = held;
      const estimate = node('p', '', 'muted');
      function updateEstimate() {
        counts.set(key, {attended: attended.value, held: held.value});
        confirmation.checked = false;
        const attendedCount = Number(attended.value), heldCount = Number(held.value);
        if (!attended.value || !held.value) { estimate.textContent = 'Enter attended and held counts to calculate missed classes.'; return; }
        if (!Number.isSafeInteger(attendedCount) || !Number.isSafeInteger(heldCount) || attendedCount < 0 || heldCount < attendedCount) {
          estimate.textContent = 'Use whole numbers: held must be at least attended.'; return;
        }
        let suffix = '';
        if (validDate(cutoff.value) && validDate(endDate.value) && endDate.value >= cutoff.value) {
          try {
            const remaining = generateSessions({id: 'estimate', weekly: subject.weekly, endDate: endDate.value}, nextDate(cutoff.value)).length;
            suffix = ` + ${remaining} scheduled remaining = ${heldCount + remaining} estimated semester sessions.`;
          } catch (error) { suffix = ` ${error.message}`; }
        }
        estimate.textContent = `${heldCount} held − ${attendedCount} attended = ${heldCount - attendedCount} missed.${suffix}`;
      }
      attended.addEventListener('input', updateEstimate);
      held.addEventListener('input', updateEstimate);
      card.append(grid, estimate);
      countsRoot.append(card);
      updateEstimate();
    }
    submit.disabled = !grouped.size || busy;
  }

  function addRow(value) {
    const container = node('div', undefined, 'timetable-row');
    const subject = field(container, 'Detected subject', 'text', value.subject);
    subject.required = true;
    subject.maxLength = 120;
    const dayLabel = node('label', undefined, 'field');
    dayLabel.append(node('span', 'Weekday'));
    const day = node('select');
    DAY_NAMES.forEach((name, index) => { const option = node('option', name); option.value = index; day.append(option); });
    day.value = value.day;
    dayLabel.append(day);
    container.append(dayLabel);
    const time = field(container, 'Start time', 'time', value.time);
    time.required = true;
    const item = {container, subject, day, time};
    const remove = button('Remove meeting', () => {
      saveCountDrafts();
      rows.splice(rows.indexOf(item), 1);
      container.remove();
      confirmation.checked = false;
      refreshCounts();
    }, 'quiet');
    container.append(remove);
    for (const input of [subject, day, time]) input.addEventListener('change', () => { confirmation.checked = false; refreshCounts(); });
    rows.push(item);
    rowList.append(container);
    confirmation.checked = false;
    refreshCounts();
  }

  function parse(text, extraWarnings = []) {
    if (busy) return;
    try {
      const parsed = parseTimetable(text);
      saveCountDrafts();
      rows.length = 0;
      rowList.replaceChildren();
      warningsBox.replaceChildren();
      for (const warning of [...extraWarnings, ...parsed.warnings]) warningsBox.append(node('p', warning, 'notice'));
      parsed.rows.forEach(addRow);
      review.hidden = false;
      confirmation.checked = false;
      refreshCounts();
      report(`${parsed.rows.length} weekly meeting(s) found. Review and correct them before creating your calendar.`);
    } catch (error) { report(error.message || 'Could not read this timetable text.', true); }
  }

  async function readFile(file) {
    if (!file || busy) return;
    if (rows.length && !window.confirm('Replace your unsaved timetable review with this file? Saved subjects will not change.')) return;
    busy = true;
    fileInput.disabled = parseButton.disabled = submit.disabled = true;
    report('Reading your file locally…');
    try {
      const {readTimetableFile} = await import('./file-readers.js');
      const result = await readTimetableFile(file, {onProgress: value => report(typeof value === 'string' ? value : value?.message || 'Reading timetable…')});
      textArea.value = result.text;
      busy = false;
      parse(result.text, result.warnings);
    } catch (error) { report(error.message || 'Could not extract this file. Try a clearer scan or paste the timetable text.', true); }
    finally {
      busy = false;
      fileInput.disabled = parseButton.disabled = false;
      submit.disabled = !rows.length;
      fileInput.value = '';
    }
  }

  fileInput.addEventListener('change', () => readFile(fileInput.files?.[0]));
  dropzone.addEventListener('dragover', event => { event.preventDefault(); dropzone.classList.add('is-dragging'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-dragging'));
  dropzone.addEventListener('drop', event => {
    event.preventDefault();
    dropzone.classList.remove('is-dragging');
    if (event.dataTransfer.files.length !== 1) { report('Drop one timetable file at a time.', true); return; }
    readFile(event.dataTransfer.files[0]);
  });
  cutoff.addEventListener('change', refreshCounts);
  endDate.addEventListener('change', refreshCounts);
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (busy) return;
    try {
      if (!confirmation.checked) throw new Error('Confirm that you reviewed the timetable and counts first.');
      saveCountDrafts();
      const {subjects: newSubjects, sessions: newSessions} = buildTimetableImport(readRows(), counts, {cutoff: cutoff.value, endDate: endDate.value, existingSubjects: store.get().subjects});
      store.update(state => {
        // Check again inside the atomic update in case another UI changed the store.
        const existingNames = new Set(state.subjects.map(subject => nameKey(subject.name)));
        if (newSubjects.some(subject => existingNames.has(nameKey(subject.name)))) throw new Error('A subject was already added. Review your import before trying again.');
        state.subjects.push(...newSubjects);
        state.sessions.push(...newSessions);
      });
      const importedCount = newSubjects.length;
      rows.length = 0;
      counts.clear();
      rowList.replaceChildren();
      countsRoot.replaceChildren();
      warningsBox.replaceChildren();
      review.hidden = true;
      confirmation.checked = false;
      report(`Created ${importedCount} subject(s) and ${newSessions.length} future class(es). Check the calendar for holidays and postponed classes. Existing subjects were preserved.`);
    } catch (error) { report(error.message || 'The timetable could not be imported.', true); }
  });

  return {render() { cutoff.max = today(); }};
}
