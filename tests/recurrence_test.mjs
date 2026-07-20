import { generateSessionDates as gen, ordinalOfWeekdayInMonth, nthWeekdayOfMonth, parseDateLocal } from './recurrence.mjs';
let pass = 0, fail = 0;
const eq = (l, a, e) => { const A = JSON.stringify(a), E = JSON.stringify(e), ok = A === E; ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${l}${ok ? '' : `\n   got  ${A}\n   want ${E}`}`); };

// 2026-08-04 is a Tuesday. 1st Tuesday of Aug 2026.
console.log('\n== weekly ==');
eq('every 1 week, count 4', gen({ start: '2026-08-04', freq: 'weeks', interval: 1, end: { type: 'count', n: 4 } }),
   ['2026-08-04','2026-08-11','2026-08-18','2026-08-25']);
eq('every 2 weeks, count 3', gen({ start: '2026-08-04', freq: 'weeks', interval: 2, end: { type: 'count', n: 3 } }),
   ['2026-08-04','2026-08-18','2026-09-01']);
eq('every 1 week, until 2026-08-20', gen({ start: '2026-08-04', freq: 'weeks', interval: 1, end: { type: 'until', date: '2026-08-20' } }),
   ['2026-08-04','2026-08-11','2026-08-18']);
eq('until before start → empty', gen({ start: '2026-08-04', freq: 'weeks', interval: 1, end: { type: 'until', date: '2026-07-01' } }), []);

console.log('\n== monthly by date ==');
eq('15th every month, count 3', gen({ start: '2026-08-15', freq: 'months', interval: 1, monthlyMode: 'date', end: { type: 'count', n: 3 } }),
   ['2026-08-15','2026-09-15','2026-10-15']);
eq('31st clamps to short months', gen({ start: '2026-01-31', freq: 'months', interval: 1, monthlyMode: 'date', end: { type: 'count', n: 4 } }),
   ['2026-01-31','2026-02-28','2026-03-31','2026-04-30']);
eq('every 2 months by date', gen({ start: '2026-08-10', freq: 'months', interval: 2, monthlyMode: 'date', end: { type: 'count', n: 3 } }),
   ['2026-08-10','2026-10-10','2026-12-10']);

console.log('\n== monthly by weekday (ordinal) ==');
// 2026-08-04 = 1st Tuesday. Sept 1st Tue = 09-01, Oct 1st Tue = 10-06.
eq('1st Tuesday every month, count 3', gen({ start: '2026-08-04', freq: 'months', interval: 1, monthlyMode: 'weekday', end: { type: 'count', n: 3 } }),
   ['2026-08-04','2026-09-01','2026-10-06']);
// 2026-08-18 = 3rd Tuesday. Sept 3rd Tue = 09-15, Oct 3rd Tue = 10-20.
eq('3rd Tuesday every month, count 3', gen({ start: '2026-08-18', freq: 'months', interval: 1, monthlyMode: 'weekday', end: { type: 'count', n: 3 } }),
   ['2026-08-18','2026-09-15','2026-10-20']);
// 2026-08-31 = last (5th) Monday → treated as "last Monday". Sep last Mon = 09-28, Oct last Mon = 10-26.
eq('last Monday (5th→last), count 3', gen({ start: '2026-08-31', freq: 'months', interval: 1, monthlyMode: 'weekday', end: { type: 'count', n: 3 } }),
   ['2026-08-31','2026-09-28','2026-10-26']);
eq('every 2 months, 1st Tuesday', gen({ start: '2026-08-04', freq: 'months', interval: 2, monthlyMode: 'weekday', end: { type: 'count', n: 3 } }),
   ['2026-08-04','2026-10-06','2026-12-01']);

console.log('\n== helpers + safety ==');
eq('ordinal of 2026-08-18 (3rd Tue)', ordinalOfWeekdayInMonth(parseDateLocal('2026-08-18')), 3);
eq('count clamps to CAP would not exceed 200', gen({ start: '2026-01-01', freq: 'weeks', interval: 1, end: { type: 'count', n: 5000 } }).length, 200);
eq('single (count 1)', gen({ start: '2026-08-04', freq: 'weeks', interval: 1, end: { type: 'count', n: 1 } }), ['2026-08-04']);

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
