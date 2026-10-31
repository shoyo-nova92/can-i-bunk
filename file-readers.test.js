import {test} from 'node:test';
import assert from 'node:assert/strict';
import {layoutTextRuns, rowsToText, validateImportFile, readTimetableFile} from './file-readers.js';

const run = (text, x, y, width = text.length * 6) => ({text, x, y, width, height: 10});

test('readable file types accepted case-insensitively without loading browser libraries', () => {
  for (const extension of ['PDF', 'xlsx', 'xls', 'csv', 'tsv', 'txt', 'png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif']) {
    assert.equal(validateImportFile(new File(['fixture'], `timetable.${extension}`)), extension.toLowerCase());
  }
});

test('rejects empty, oversized, and unsupported files before extraction', async () => {
  assert.throws(() => validateImportFile(new File([], 'empty.pdf')), /empty/);
  assert.throws(() => validateImportFile({name: 'huge.pdf', size: 16 * 1024 * 1024, arrayBuffer() {}}), /15 MB/);
  assert.throws(() => validateImportFile(new File(['x'], 'image.svg')), /Supported files/);
  await assert.rejects(readTimetableFile(new File(['not pdf'], 'bad.pdf')), /not a valid PDF/);
});

test('plain timetable text and CSV return without DOM or library initialization', async () => {
  const result = await readTimetableFile(new File(['Monday\t09:00\tMathematics'], 'table.txt'));
  assert.equal(result.text, 'Monday\t09:00\tMathematics');
  assert.deepEqual(result.warnings, []);
  assert.equal((await readTimetableFile(new File(['Day,Time,Subject\nMon,09:00,Math'], 'table.csv'))).text, 'Day,Time,Subject\nMon,09:00,Math');
});

test('empty text and overlarge extraction fail clearly', async () => {
  await assert.rejects(readTimetableFile(new File([' \n '], 'table.txt')), /No readable text/);
  await assert.rejects(readTimetableFile(new File(['a'.repeat(1_000_001)], 'table.txt')), /too large/);
});

test('rows are represented as inert text with empty cells retained', () => {
  assert.equal(rowsToText([['Time', 'Monday', 'Tuesday'], ['09:00', '', '<img onerror=alert(1)>'], ['10:00', 'Data\nScience', null]]), 'Time\tMonday\tTuesday\n09:00\t\t<img onerror=alert(1)>\n10:00\tData Science\t');
});

test('positioned PDF runs group into reading lines regardless of input order', () => {
  assert.equal(layoutTextRuns([run('Physics', 180, 30), run('09:00', 60, 10), run('Math', 180, 10), run('10:00', 60, 30), run('Monday', 0, 10), run('Tuesday', 0, 30)]), 'Monday\t09:00\tMath\nTuesday 10:00\tPhysics');
});

test('day-column grids preserve blank cells rather than shifting a subject weekday', () => {
  const text = layoutTextRuns([
    run('Time', 0, 0), run('Monday', 120, 0), run('Tuesday', 260, 0), run('Wednesday', 410, 0),
    run('09:00', 0, 20), run('Physics', 260, 20),
    run('10:00', 0, 40), run('Math', 120, 40), run('Biology', 410, 40)
  ]);
  assert.equal(text, 'Time\tMonday\tTuesday\tWednesday\n09:00\t\tPhysics\t\n10:00\tMath\t\tBiology');
});

test('time-column grids and a missing corner heading retain column positions', () => {
  const text = layoutTextRuns([
    run('09:00', 140, 0), run('10:00', 280, 0),
    run('Monday', 0, 20), run('Math', 140, 20),
    run('Tuesday', 0, 40), run('Physics', 280, 40)
  ]);
  assert.equal(text, '\t09:00\t10:00\nMonday\tMath\t\nTuesday\t\tPhysics');
});

test('invalid geometry and blank words are ignored', () => {
  assert.equal(layoutTextRuns([run('', 0, 0), run('Valid', 0, 10), {text: 'bad', x: NaN, y: 0, width: 10, height: 10}]), 'Valid');
  assert.equal(layoutTextRuns([]), '');
});

test('cancellation and excessive page geometry fail before costly work', async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(readTimetableFile(new File(['abc'], 'file.txt'), {signal: controller.signal}), /cancelled/);
  assert.throws(() => layoutTextRuns(Array(25_001).fill(run('x', 0, 0))), /too many text fragments/);
});
