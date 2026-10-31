import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseTimetable, parseDay, parseTime} from './timetable-parser.js';
import {buildTimetableImport} from './timetable.js';
import {validateState} from './data.js';

test('parses day names and explicit times without guessing ambiguous AM/PM', () => {
  assert.equal(parseDay('Thurs.'), 4);
  assert.equal(parseDay('Someday'), null);
  assert.equal(parseTime('9:30 am'), '09:30');
  assert.equal(parseTime('12:00 AM'), '00:00');
  assert.equal(parseTime('12:00 PM'), '12:00');
  assert.equal(parseTime('09:00–10:00'), '09:00');
  assert.equal(parseTime('9-10pm'), null);
  assert.equal(parseTime('9'), null);
  assert.equal(parseTime('25:00'), null);
  assert.equal(parseTime('09:99'), null);
});

test('parses natural row listings and quoted CSV with arbitrary header order', () => {
  assert.deepEqual(parseTimetable('Monday 09:00 Mathematics\nTue 11:30-12:30 Physics').rows, [
    {subject: 'Mathematics', day: 1, time: '09:00'},
    {subject: 'Physics', day: 2, time: '11:30'}
  ]);
  assert.deepEqual(parseTimetable('Subject,Start time,Day,Room\n"Logic, proofs",2:00 PM,Friday,A12').rows, [
    {subject: 'Logic, proofs', day: 5, time: '14:00'}
  ]);
});

test('supports time rows with weekday columns and empty/break cells', () => {
  const parsed = parseTimetable('Time\tMonday\tTuesday\tWednesday\n09:00\tApplied Mathematics\t\tPhysics\n10:00-11:00\tBreak\tChemistry\tLunch');
  assert.deepEqual(parsed.rows, [
    {subject: 'Applied Mathematics', day: 1, time: '09:00'},
    {subject: 'Physics', day: 3, time: '09:00'},
    {subject: 'Chemistry', day: 2, time: '10:00'}
  ]);
});

test('supports weekday rows with explicit time columns', () => {
  assert.deepEqual(parseTimetable('Day,09:00,11:00\nMonday,Mathematics,Physics\nTuesday,,Chemistry').rows, [
    {subject: 'Mathematics', day: 1, time: '09:00'},
    {subject: 'Physics', day: 1, time: '11:00'},
    {subject: 'Chemistry', day: 2, time: '11:00'}
  ]);
});

test('warns rather than shifts uneven columns, guesses rooms, or repeats meetings', () => {
  const uneven = parseTimetable('Time\tMonday\tTuesday\n09:00\tMathematics');
  assert.equal(uneven.rows.length, 0);
  assert.match(uneven.warnings.join(' '), /could not be mapped confidently/);
  assert.equal(parseTimetable('Monday,09:00,Mathematics,Room 12').rows.length, 0);
  const duplicated = parseTimetable('Monday 09:00 Mathematics\nMonday 09:00 mathematics');
  assert.equal(duplicated.rows.length, 1);
  assert.match(duplicated.warnings.join(' '), /duplicate/);
});

test('rejects oversized input and never treats subject markup as instructions', () => {
  assert.throws(() => parseTimetable('x'.repeat(500001)), /too large/);
  const parsed = parseTimetable('Subject,Day,Time\n<img src=x onerror=alert(1)>,Monday,09:00');
  assert.equal(parsed.rows[0].subject, '<img src=x onerror=alert(1)>');
});

const meetings = [{subject: 'Mathematics', day: 6, time: '09:00'}, {subject: 'Mathematics', day: 6, time: '11:00'}];
const options = {cutoff: '2026-10-31', endDate: '2026-11-07', asOf: '2026-10-31'};
const inputs = (attended = '6', held = '8') => new Map([['mathematics', {attended, held}]]);

test('import derives missed and total counts and starts after the cutoff', () => {
  const result = buildTimetableImport(meetings, inputs(), options);
  assert.equal(result.subjects.length, 1);
  assert.equal(result.subjects[0].attended, 6);
  assert.equal(result.subjects[0].missed, 2);
  assert.equal(result.subjects[0].total, 10);
  assert.equal(result.sessions.length, 2);
  assert.ok(result.sessions.every(session => session.date === '2026-11-07'));
  assert.equal(new Set(result.sessions.map(session => session.id)).size, 2);
  assert.ok(result.sessions.every(session => session.subjectId === result.subjects[0].id));
  validateState({version: 1, ...result});
});

test('zero held is valid with future meetings; no future and no history is rejected', () => {
  const result = buildTimetableImport(meetings, inputs('0', '0'), options);
  assert.equal(result.subjects[0].total, 2);
  assert.equal(result.subjects[0].missed, 0);
  assert.throws(() => buildTimetableImport(meetings, inputs('0', '0'), {...options, endDate: options.cutoff}), /no held or future/);
});

test('midday cutoff keeps later classes today and excludes exactly counted start times', () => {
  const midday = buildTimetableImport(meetings, inputs(), {...options, cutoffTime: '10:00'});
  assert.equal(midday.sessions.length, 3);
  assert.equal(midday.subjects[0].total, 11);
  assert.deepEqual(midday.sessions.filter(session => session.date === options.cutoff).map(session => session.time), ['11:00']);
  assert.equal(midday.subjects[0].historyThrough, options.cutoff);
  assert.equal(midday.subjects[0].historyThroughTime, '10:00');
  const exact = buildTimetableImport(meetings, inputs(), {...options, cutoffTime: '09:00'});
  assert.equal(exact.sessions.filter(session => session.date === options.cutoff).length, 1);
  const beforeAll = buildTimetableImport(meetings, inputs('0', '0'), {...options, cutoffTime: '08:59'});
  assert.equal(beforeAll.sessions.length, 4);
  assert.throws(() => buildTimetableImport(meetings, inputs(), {...options, cutoffTime: ['10:00']}), /valid counts-through time/);
});

test('rejects invalid dates, inconsistent counts, and duplicate weekly meetings', () => {
  assert.throws(() => buildTimetableImport(meetings, inputs(), {...options, cutoff: '2026-11-01'}), /today or earlier/);
  assert.throws(() => buildTimetableImport(meetings, inputs(), {...options, endDate: '2026-02-30'}), /end date/);
  assert.throws(() => buildTimetableImport(meetings, inputs('9', '8'), options), /no greater than held/);
  assert.throws(() => buildTimetableImport(meetings, inputs('1.5', '8'), options), /whole numbers/);
  assert.throws(() => buildTimetableImport(meetings, inputs('', '8'), options), /Enter attended/);
  assert.throws(() => buildTimetableImport([meetings[0], meetings[0]], inputs(), options), /Duplicate weekly/);
});

test('existing subjects cannot be overwritten and grouped names are case insensitive', () => {
  const existingSubjects = [{name: ' MATHEMATICS '}];
  assert.throws(() => buildTimetableImport(meetings, inputs(), {...options, existingSubjects}), /already exists/);
  assert.equal(existingSubjects[0].name, ' MATHEMATICS ');
  const renamed = [{...meetings[0], subject: ' Mathematics '}, {...meetings[1], subject: 'mathematics'}];
  assert.equal(buildTimetableImport(renamed, inputs(), options).subjects.length, 1);
});
