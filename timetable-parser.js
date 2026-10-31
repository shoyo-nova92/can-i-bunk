const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_ALIASES = [['sun', 'sunday'], ['mon', 'monday'], ['tue', 'tues', 'tuesday'], ['wed', 'weds', 'wednesday'], ['thu', 'thur', 'thurs', 'thursday'], ['fri', 'friday'], ['sat', 'saturday']];
const EMPTY_CELL = /^(?:[-–—]+|break|lunch|free|off|recess|no class|n\/?a|nil)$/i;
const MAX_TEXT = 500_000;
const MAX_ROWS = 500;

export function parseDay(value) {
  const name = String(value ?? '').trim().toLowerCase().replace(/[.:]$/, '');
  const day = DAY_ALIASES.findIndex(aliases => aliases.includes(name));
  return day < 0 ? null : day;
}

/** Accept an explicit time or range; use its start, never guess a missing AM/PM. */
export function parseTime(value) {
  const source = String(value ?? '').trim().replace(/[–—]/g, '-');
  const match = source.match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?(?:\s*-\s*\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const period = match[3]?.toLowerCase();
  if (!match[2] && !period && !source.includes('-')) return null;
  if (!period && /(?:am|pm)\s*$/i.test(source)) return null;
  if (minute > 59 || hour > 23 || (period && (hour < 1 || hour > 12))) return null;
  if (period) hour = hour % 12 + (period === 'pm' ? 12 : 0);
  // A bare number is only accepted as a table time, not as an inferred period number.
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function csvCells(line, delimiter) {
  const cells = [];
  let cell = '', quoted = false;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { cell += '"'; index++; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) { cells.push(cell.trim()); cell = ''; }
    else cell += char;
  }
  cells.push(cell.trim());
  return cells;
}

function cellsFor(line) {
  if (line.includes('\t')) return csvCells(line, '\t');
  if (line.includes('|')) return line.split('|').map(cell => cell.trim()).filter((cell, index, all) => cell || (index !== 0 && index !== all.length - 1));
  if (line.includes(',')) return csvCells(line, ',');
  if (line.includes(';')) return csvCells(line, ';');
  return line.split(/\s{2,}/).map(cell => cell.trim());
}

function subjectName(value) {
  const name = String(value ?? '').replace(/\s+/g, ' ').trim();
  return name && !EMPTY_CELL.test(name) ? name : null;
}

function headerType(value) {
  const header = value.toLowerCase().replace(/[^a-z]/g, '');
  if (['subject', 'subjects', 'course', 'coursename', 'subjectname', 'class'].includes(header)) return 'subject';
  if (['day', 'weekday', 'days'].includes(header)) return 'day';
  if (['time', 'start', 'starttime', 'classstart', 'classtime', 'timings'].includes(header)) return 'time';
  return null;
}

/** Parse only recognizable mappings. Every extracted row still requires user review. */
export function parseTimetable(text) {
  if (typeof text !== 'string') throw new Error('Timetable text must be a string.');
  if (text.length > MAX_TEXT) throw new Error('The timetable text is too large. Import only the relevant schedule page.');
  const lines = text.replace(/\r\n?/g, '\n').split('\n').map(line => line.trimEnd()).filter(line => line.trim());
  const rows = [], warnings = [], seen = new Set();
  let mapping = null, dayColumns = null, timeColumns = null;
  let skipped = 0, duplicates = 0;
  const add = (subject, day, time) => {
    subject = subjectName(subject);
    if (!subject) return;
    if (subject.length > 120) { warnings.push(`A subject name longer than 120 characters was skipped: ${subject.slice(0, 40)}…`); return; }
    const key = `${subject.toLowerCase()}\u0000${day}\u0000${time}`;
    if (seen.has(key)) { duplicates++; return; }
    if (rows.length >= MAX_ROWS) throw new Error('More than 500 weekly meetings were detected. Import a single timetable at a time.');
    seen.add(key); rows.push({subject, day, time});
  };

  for (const line of lines) {
    const cells = cellsFor(line);
    const headers = cells.map(headerType);
    if (headers.includes('subject') && headers.includes('day') && headers.includes('time')) {
      mapping = {subject: headers.indexOf('subject'), day: headers.indexOf('day'), time: headers.indexOf('time')};
      dayColumns = timeColumns = null; continue;
    }
    const days = cells.map(parseDay);
    if (days.filter(day => day !== null).length >= 2 && days[0] === null) {
      dayColumns = days; timeColumns = mapping = null; continue;
    }
    const times = cells.map(parseTime);
    if ((headerType(cells[0]) === 'day' || /^(?:day\s*[/\\]\s*time)$/i.test(cells[0])) && times.slice(1).some(Boolean)) {
      timeColumns = times; dayColumns = mapping = null; continue;
    }
    if (mapping) {
      const day = parseDay(cells[mapping.day]), time = parseTime(cells[mapping.time]);
      if (day !== null && time) add(cells[mapping.subject], day, time);
      else skipped++;
      continue;
    }
    if (dayColumns) {
      const time = parseTime(cells[0]);
      if (!time || cells.length !== dayColumns.length) { skipped++; continue; }
      dayColumns.forEach((day, index) => { if (day !== null) add(cells[index], day, time); });
      continue;
    }
    if (timeColumns) {
      const day = parseDay(cells[0]);
      if (day === null || cells.length !== timeColumns.length) { skipped++; continue; }
      timeColumns.forEach((time, index) => { if (index && time) add(cells[index], day, time); });
      continue;
    }
    // Headerless delimited listings: require exactly one day, one explicit time,
    // and one subject. More columns need a header so room/staff data isn't guessed.
    if (cells.length === 3) {
      const dayIndex = days.findIndex(day => day !== null);
      const timeIndex = cells.findIndex((cell, index) => index !== dayIndex && parseTime(cell));
      if (dayIndex >= 0 && timeIndex >= 0) {
        const subjectIndex = [0, 1, 2].find(index => index !== dayIndex && index !== timeIndex);
        add(cells[subjectIndex], days[dayIndex], parseTime(cells[timeIndex])); continue;
      }
    }
    // Natural listings, e.g. Monday 09:00-10:00 Applied Mathematics.
    const natural = line.trim().match(/^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sun|Mon|Tues?|Weds?|Thurs?|Fri|Sat)\.?\s+(\d{1,2}[:.]\d{2}\s*(?:am|pm)?(?:\s*[-–—]\s*\d{1,2}[:.]\d{2}\s*(?:am|pm)?)?)\s+(.+)$/i);
    if (natural) {
      const time = parseTime(natural[2]);
      if (time) { add(natural[3], parseDay(natural[1]), time); continue; }
    }
    skipped++;
  }
  if (skipped) warnings.push(`${skipped} line(s) could not be mapped confidently. Compare the review with your original timetable; missing meetings are not imported.`);
  if (duplicates) warnings.push(`${duplicates} duplicate weekly meeting(s) were combined. If they are separate classes, correct the times in the review.`);
  if (!rows.length) warnings.push('No reliable subject/day/time mappings were found. Paste a row list such as “Monday 09:00 Mathematics”, or correct/add rows below.');
  warnings.push('Review every subject, weekday, and start time before importing. Each row counts as one equally weighted session; split a double-period class into two rows if your university counts it twice.');
  return {rows, warnings};
}

export {DAY_NAMES};
