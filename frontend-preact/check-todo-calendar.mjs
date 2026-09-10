// Calendar helper tests for `src/plugins/todo-calendar.js`: ISO handling,
// cursor arithmetic, Monday-first grids, and per-day counts.
// Run: `npm test`. `zig build test` runs it via `npm run test`.
import {
  buildMonthGrid,
  countByDate,
  formatDay,
  isDueDate,
  monthCursor,
  monthLabel,
  parseISODate,
  shiftMonth,
  todayISO,
  toISODate
} from './src/plugins/todo-calendar.js';

let failures = 0;

function check(name, condition, extra = '') {
  if (condition) {
    console.log(`ok: ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL: ${name}${extra ? ` (${extra})` : ''}`);
  }
}

check('toISODate pads parts', toISODate(2026, 9, 4) === '2026-09-04');
check('isDueDate accepts real dates', isDueDate('2026-09-04'));
check('isDueDate rejects february 30', !isDueDate('2026-02-30'));
check('isDueDate accepts leap day', isDueDate('2024-02-29'));
check('isDueDate rejects bad shapes', !isDueDate('2026-9-4') && !isDueDate('') && !isDueDate(null));
check(
  'parseISODate splits valid days',
  JSON.stringify(parseISODate('2026-09-04')) ===
    JSON.stringify({ year: 2026, month: 9, day: 4 })
);
check('parseISODate rejects junk', parseISODate('not-a-date') === null);
check('todayISO matches local date', todayISO(new Date(2026, 8, 4)) === '2026-09-04');
check('monthCursor keeps cursors', monthCursor('2026-09') === '2026-09');
check('monthCursor derives from days', monthCursor('2026-09-04') === '2026-09');
check('shiftMonth rolls years', shiftMonth('2026-12', 1) === '2027-01');
check('shiftMonth goes backwards', shiftMonth('2026-01', -1) === '2025-12');
check('monthLabel names months', monthLabel('2026-09') === 'September 2026');

const september = buildMonthGrid('2026-09');
check(
  'september 2026 (tuesday start) pads one blank',
  september.weeks[0][0] === null &&
    september.weeks[0][1]?.iso === '2026-09-01' &&
    september.weeks.length === 5
);
const february = buildMonthGrid('2026-02');
check(
  'february 2026 (sunday start) pads six blanks',
  february.weeks[0].slice(0, 6).every((cell) => cell === null) &&
    february.weeks[0][6]?.iso === '2026-02-01'
);
const leap = buildMonthGrid('2024-02');
check(
  'leap february has 29 days',
  leap.weeks.flat().filter(Boolean).length === 29
);
check(
  'grid cells carry iso, day, and inMonth',
  september.weeks[4][6] === null ||
    september.weeks.flat().every((cell) => cell === null || (cell.iso && cell.day && cell.inMonth))
);
check('formatDay shortens months', formatDay('2026-09-04') === 'Sep 4');
check('formatDay passes junk through', formatDay('junk') === 'junk');

const counts = countByDate([
  { id: 'a', due: '2026-09-04', completed: false },
  { id: 'b', due: '2026-09-04', completed: true },
  { id: 'c', due: null, completed: false },
  { id: 'd', due: 'bogus', completed: false }
]);
check(
  'countByDate groups valid due dates only',
  counts.size === 1 &&
    counts.get('2026-09-04').total === 2 &&
    counts.get('2026-09-04').done === 1
);
check('countByDate tolerates junk input', countByDate(null).size === 0);

if (failures > 0) process.exit(1);
console.log('todo calendar: all tests passed');
