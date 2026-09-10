// Pure date helpers for the Todos calendar: ISO day strings, month cursor
// arithmetic, Monday-first month grids, and per-day todo counts. No DOM,
// deterministic, fully unit-tested in `check-todo-calendar.mjs`.
const MONTH_NAMES = Object.freeze([
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]);

const ISO_DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function isDueDate(value) {
  if (typeof value !== 'string' || !ISO_DAY.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function toISODate(year, month, day) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function parseISODate(value) {
  if (!isDueDate(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
}

export function todayISO(from = new Date()) {
  return toISODate(from.getFullYear(), from.getMonth() + 1, from.getDate());
}

export function monthCursor(value) {
  if (typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    return value;
  }
  const parsed = parseISODate(value);
  if (parsed) return value.slice(0, 7);
  return todayISO().slice(0, 7);
}

export function shiftMonth(cursor, delta) {
  const [year, month] = monthCursor(cursor).split('-').map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return toISODate(date.getFullYear(), date.getMonth() + 1, 1).slice(0, 7);
}

export function monthLabel(cursor) {
  const [year, month] = monthCursor(cursor).split('-').map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

// Monday-first grid: 6 rows max, padded with null. Each cell is
// { iso, day, inMonth } or null.
export function buildMonthGrid(cursor) {
  const [year, month] = monthCursor(cursor).split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const lead = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const cells = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ iso: toISODate(year, month, day), day, inMonth: true });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let row = 0; row < cells.length; row += 7) {
    weeks.push(cells.slice(row, row + 7));
  }
  return { weeks, label: monthLabel(cursor) };
}

export function formatDay(iso) {
  const parsed = parseISODate(iso);
  if (!parsed) return iso;
  return `${MONTH_NAMES[parsed.month - 1].slice(0, 3)} ${parsed.day}`;
}

// Map of ISO day -> { total, done } for due-dated todos.
export function countByDate(todos) {
  const counts = new Map();
  for (const todo of todos || []) {
    if (!todo || !isDueDate(todo.due)) continue;
    const entry = counts.get(todo.due) || { total: 0, done: 0 };
    entry.total += 1;
    if (todo.completed) entry.done += 1;
    counts.set(todo.due, entry);
  }
  return counts;
}
