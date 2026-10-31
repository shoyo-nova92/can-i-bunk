import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculationRows } from './planner.js';

function result(overrides = {}) {
  const value = {
    A: 20, M: 9, N: 40, R: 11, B: 0,
    required75: 30, required60: 24, currentPercent: 100 * 20 / 29,
    reliable: true, best: 31, bestPercent: 77.5,
    allowance: 1, deficit: 0, canRecover75: true,
    ...overrides
  };
  value.attendanceSlack ??= value.A + value.R - value.B - value.required75;
  return value;
}

const explanation = value => new Map(calculationRows(value));

test('calculation breakdown substitutes counts into the final allowance equation', () => {
  const rows = explanation(result());
  assert.equal(rows.get('Classes held so far'), '20 attended + 9 missed = 29 held');
  assert.equal(rows.get('75% requirement'), 'Round up (3 × 40 ÷ 4) = 30 attended classes');
  assert.equal(rows.get('60% requirement'), 'Round up (3 × 40 ÷ 5) = 24 attended classes');
  assert.equal(rows.get('Attendance slack'), '20 attended + 11 remaining − 0 reserved bunks − 30 required = 1');
  assert.equal(rows.get('Additional bunk allowance'), 'Smaller of 11 remaining unreserved classes and 1 attendance slack = 1 additional bunks');
  assert.match(rows.get('Further attendances for the final 75% target'), /10 still needed/);
  assert.match(rows.get('Reaching a current 75%'), /7 consecutive attended classes/);
});

test('reserving one bunk makes all other remaining classes mandatory', () => {
  const rows = explanation(result({ B: 1, best: 30, bestPercent: 75, allowance: 0 }));
  assert.match(rows.get('Attendance slack'), /− 1 reserved bunks − 30 required = 0$/);
  assert.equal(rows.get('Allowance meaning'), 'All 10 remaining classes outside your reserved bunks must be attended.');
});

test('negative allowance is explained as a deficit and not permission to bunk', () => {
  const rows = explanation(result({ B: 2, best: 29, bestPercent: 72.5, allowance: -1, deficit: 1 }));
  assert.match(rows.get('Attendance deficit'), /1 attendance short/);
  assert.match(rows.get('Attendance deficit'), /Clear at least 1 reserved bunk/);
  assert.match(rows.get('Additional bunk allowance'), /0 usable additional bunks/);
  assert.equal(rows.has('Allowance meaning'), false);
});

test('zero held classes has no current percentage or fabricated current recovery', () => {
  const rows = explanation(result({ A: 0, M: 0, N: 4, R: 4, B: 0, required75: 3,
    required60: 3, currentPercent: null, best: 4, bestPercent: 100, allowance: 1 }));
  assert.match(rows.get('Current attendance'), /No classes held yet/);
  assert.match(rows.get('Reaching a current 75%'), /first class would make current attendance 100%/);
});

test('current 75% is distinguished from reaching a final semester target', () => {
  const rows = explanation(result({ A: 3, M: 1, N: 8, R: 4, required75: 6, required60: 5,
    currentPercent: 75, best: 7, bestPercent: 87.5, allowance: 1 }));
  assert.match(rows.get('Reaching a current 75%'), /already at least 75%/);
  assert.match(rows.get('Reaching a current 75%'), /does not reserve any future bunk allowance/);
  assert.match(rows.get('Further attendances for the final 75% target'), /3 still needed/);
});

test('current recovery states when there are too few remaining classes', () => {
  const rows = explanation(result({ A: 20, M: 11, R: 9, best: 29, bestPercent: 72.5,
    currentPercent: 100 * 20 / 31, allowance: -1, deficit: 1, canRecover75: false }));
  assert.match(rows.get('Reaching a current 75%'), /13 consecutive attended classes/);
  assert.match(rows.get('Reaching a current 75%'), /recovery is not possible/);
  assert.match(rows.get('Attendance deficit'), /Even attending all 9 remaining classes cannot meet/);
});

test('unreliable schedules expose counts but hide projected permission to bunk', () => {
  const rows = explanation(result({ reliable: false }));
  assert.equal(rows.has('Additional bunk allowance'), false);
  assert.equal(rows.has('Best final attendance under your plan'), false);
  assert.equal(rows.has('Reaching a current 75%'), false);
  assert.match(rows.get('Forecast status'), /Resolve the calendar warnings/);
});

test('an attendance percentage below the threshold is never explained as 75.0%', () => {
  const rows = explanation(result({ A: 1000, M: 334, N: 1334, R: 0, B: 0,
    required75: 1001, required60: 801, currentPercent: 100 * 1000 / 1334,
    best: 1000, bestPercent: 100 * 1000 / 1334, allowance: -1, deficit: 1,
    canRecover75: false }));
  assert.match(rows.get('Current attendance'), /Below 75%/);
  assert.doesNotMatch(rows.get('Current attendance'), /75\.0%/);
  assert.match(rows.get('Best final attendance under your plan'), /Below 75%/);
});

test('already exceeding the final attendance requirement does not show a false subtraction', () => {
  const rows = explanation(result({ A: 35, M: 1, N: 40, R: 4,
    currentPercent: 100 * 35 / 36, best: 39, bestPercent: 97.5, allowance: 4, attendanceSlack: 9 }));
  assert.match(rows.get('Further attendances for the final 75% target'), /35 already attended meets the requirement of 30; 0 still needed/);
  assert.match(rows.get('Attendance slack'), /required = 9$/);
  assert.match(rows.get('Additional bunk allowance'), /4 remaining unreserved classes and 9 attendance slack = 4 additional bunks/);
});

test('a completed subject has no additional classes available to bunk', () => {
  const rows = explanation(result({ A: 35, M: 5, N: 40, R: 0, B: 0,
    currentPercent: 87.5, best: 35, bestPercent: 87.5, allowance: 0, attendanceSlack: 5 }));
  assert.match(rows.get('Attendance slack'), /required = 5$/);
  assert.match(rows.get('Additional bunk allowance'), /0 remaining unreserved classes and 5 attendance slack = 0 additional bunks/);
  assert.equal(rows.get('Allowance meaning'), 'No unreserved future classes remain to bunk.');
});
