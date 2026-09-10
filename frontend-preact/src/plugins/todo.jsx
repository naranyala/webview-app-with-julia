import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { styles, sx } from '../stylex-styles.js';
import {
  buildMonthGrid,
  countByDate,
  formatDay,
  isDueDate,
  shiftMonth,
  todayISO
} from './todo-calendar.js';
import {
  onHashChange,
  readHash,
  storageGet,
  storageSet,
  writeHash
} from './todo-storage.js';

const STORAGE_KEY = 'preact-todomvc.todos';
const FILTERS = ['all', 'active', 'completed'];
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readFilter() {
  const hashFilter = readHash().replace(/^#\/?/, '');
  return FILTERS.includes(hashFilter) ? hashFilter : 'all';
}

function normalizeTodo(todo) {
  if (
    !todo ||
    typeof todo.id !== 'string' ||
    typeof todo.title !== 'string' ||
    typeof todo.completed !== 'boolean'
  ) {
    return null;
  }
  return {
    id: todo.id,
    title: todo.title,
    completed: todo.completed,
    due: isDueDate(todo.due) ? todo.due : null
  };
}

function loadTodos() {
  try {
    const savedTodos = JSON.parse(storageGet(STORAGE_KEY));
    if (!Array.isArray(savedTodos)) return [];
    return savedTodos.map(normalizeTodo).filter(Boolean);
  } catch {
    return [];
  }
}

export function TodoApp({
  mode = 'tasks',
  focusDate = null,
  onFocusDate = () => {},
  cursor = todayISO().slice(0, 7),
  onCursor = () => {},
  onPickDate = null
}) {
  const [todos, setTodos] = useState(loadTodos);
  const [newTodo, setNewTodo] = useState('');
  const [newDue, setNewDue] = useState('');
  const [filter, setFilter] = useState(readFilter);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editDue, setEditDue] = useState('');
  const editInputRef = useRef(null);
  const cancelEditRef = useRef(false);

  const today = todayISO();
  const focus = isDueDate(focusDate) ? focusDate : null;
  const counts = useMemo(() => countByDate(todos), [todos]);
  const activeCount = todos.reduce(
    (count, todo) => count + (todo.completed ? 0 : 1),
    0
  );
  const completedCount = todos.length - activeCount;
  const dueTodayCount = todos.filter(
    (todo) => !todo.completed && todo.due === today
  ).length;
  const visibleTodos = todos.filter((todo) => {
    if (filter === 'active' && todo.completed) return false;
    if (filter === 'completed' && !todo.completed) return false;
    if (focus && todo.due !== focus) return false;
    return true;
  });

  useEffect(() => {
    storageSet(STORAGE_KEY, JSON.stringify(todos));
  }, [todos]);

  useEffect(() => {
    const handleHashChange = () => setFilter(readFilter());
    return onHashChange(handleHashChange);
  }, []);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  function addTodo(event) {
    event.preventDefault();
    const title = newTodo.trim();
    if (!title) return;
    const due = isDueDate(newDue) ? newDue : focus || null;

    setTodos((currentTodos) => [
      ...currentTodos,
      { id: createId(), title, completed: false, due }
    ]);
    setNewTodo('');
    setNewDue('');
  }

  function toggleTodo(id) {
    setTodos((currentTodos) =>
      currentTodos.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  }

  function deleteTodo(id) {
    setTodos((currentTodos) => currentTodos.filter((todo) => todo.id !== id));
    if (editingId === id) setEditingId(null);
  }

  function toggleAll() {
    const shouldComplete = activeCount > 0;
    setTodos((currentTodos) =>
      currentTodos.map((todo) => ({ ...todo, completed: shouldComplete }))
    );
  }

  function beginEditing(todo) {
    cancelEditRef.current = false;
    setEditingId(todo.id);
    setEditValue(todo.title);
    setEditDue(todo.due || '');
  }

  function cancelEditing() {
    cancelEditRef.current = true;
    setEditingId(null);
    setEditValue('');
    setEditDue('');
  }

  function finishEditing(save) {
    if (!editingId) return;

    if (cancelEditRef.current) {
      cancelEditRef.current = false;
      setEditingId(null);
      setEditValue('');
      setEditDue('');
      return;
    }

    const title = editValue.trim();

    if (save && title) {
      setTodos((currentTodos) =>
        currentTodos.map((todo) =>
          todo.id === editingId ? { ...todo, title } : todo
        )
      );
    } else if (save && !title) {
      deleteTodo(editingId);
    }

    setEditingId(null);
    setEditValue('');
    setEditDue('');
  }

  function saveDue(id, value) {
    setTodos((currentTodos) =>
      currentTodos.map((todo) =>
        todo.id === id
          ? { ...todo, due: isDueDate(value) ? value : null }
          : todo
      )
    );
  }

  function chooseFilter(nextFilter) {
    setFilter(nextFilter);
    writeHash(nextFilter === 'all' ? '#/' : `#/${nextFilter}`);
  }

  function clearCompleted() {
    setTodos((currentTodos) => currentTodos.filter((todo) => !todo.completed));
  }

  function pickDay(iso) {
    onFocusDate(iso);
    if (onPickDate) onPickDate();
  }

  if (mode === 'calendar') {
    const grid = buildMonthGrid(cursor);
    return (
      <section className={sx('tool-page')}>
        <div className={sx('tool-heading')}>
          <div>
            <p className={sx('eyebrow')}>Planner</p>
            <h1 className={sx('page-title')}>Calendar</h1>
            <p className={sx('lede')}>
              {todos.length} tasks · {dueTodayCount} due today · pick a day to
              filter the list
            </p>
          </div>
        </div>

        <div className={sx('tool-panel')}>
          <div className={sx('notes-list-heading')}>
            <button
              type="button"
              className={sx('text-button')}
              onClick={() => onCursor(shiftMonth(cursor, -1))}
              aria-label="Previous month"
            >
              ‹
            </button>
            <span className={sx('panel-label')}>{grid.label}</span>
            <button
              type="button"
              className={sx('text-button')}
              onClick={() => onCursor(shiftMonth(cursor, 1))}
              aria-label="Next month"
            >
              ›
            </button>
            <button
              type="button"
              className={sx('text-button')}
              onClick={() => onCursor(today.slice(0, 7))}
            >
              Today
            </button>
          </div>
          <div className={sx('cal-grid')}>
            {WEEKDAYS.map((day) => (
              <span key={day} className={sx('cal-dow')}>
                {day}
              </span>
            ))}
            {grid.weeks.flat().map((cell, index) => {
              if (!cell) return <span key={`blank-${index}`} />;
              const entry = counts.get(cell.iso) || { total: 0, done: 0 };
              const active = entry.total - entry.done;
              return (
                <button
                  type="button"
                  key={cell.iso}
                  aria-label={`${cell.iso}, ${entry.total} tasks`}
                  className={sx(
                    'cal-cell',
                    cell.iso === focus && styles.calSelected,
                    cell.iso === today && styles.calToday
                  )}
                  onClick={() => pickDay(cell.iso)}
                >
                  <span>{cell.day}</span>
                  {entry.total > 0 && (
                    <span className={sx('cal-dots')} aria-hidden="true">
                      {entry.total <= 3 ? (
                        Array.from({ length: entry.total }, (_, dot) => (
                          <span
                            key={dot}
                            className={sx(
                              'cal-dot',
                              dot >= active && styles.calDotDone
                            )}
                          />
                        ))
                      ) : (
                        <span className={sx('cal-count')}>{entry.total}</span>
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <p className={sx('empty-notes')}>
          Gold dots are open tasks, dim dots are done. Picking a day filters
          Tasks and jumps there.
        </p>
      </section>
    );
  }

  return (
    <section className={sx('tool-page')}>
      <div className={sx('tool-heading')}>
        <div>
          <p className={sx('eyebrow')}>Planner</p>
          <h1 className={sx('page-title')}>Todos</h1>
          <p className={sx('lede')}>
            {activeCount} open · {dueTodayCount} due today
          </p>
        </div>
        {focus && (
          <button
            type="button"
            className={sx('chip')}
            onClick={() => onFocusDate(null)}
          >
            Due {formatDay(focus)} ×
          </button>
        )}
      </div>

      <div className={sx('tool-panel')}>
        <form className={sx('notes-list-heading')} onSubmit={addTodo}>
          <button
            className={sx('toggle-all')}
            type="button"
            aria-label={
              activeCount > 0 ? 'Complete all todos' : 'Mark all todos active'
            }
            onClick={toggleAll}
            disabled={todos.length === 0}
          >
            ↓
          </button>
          <input
            className={sx('search-field')}
            value={newTodo}
            onInput={(event) => setNewTodo(event.currentTarget.value)}
            placeholder={
              focus ? `Add a task due ${formatDay(focus)}…` : 'Add a task…'
            }
            aria-label="New todo"
            autoComplete="off"
            style={{ flex: 1 }}
          />
          <input
            className={sx('due-input')}
            type="date"
            value={newDue}
            onInput={(event) => setNewDue(event.currentTarget.value)}
            aria-label="Due date for new todo"
          />
          <button type="submit" className={sx('new-note-button')}>
            + Add
          </button>
        </form>

        {todos.length > 0 && (
          <ul className={sx('todo-list')} aria-live="polite">
            {visibleTodos.map((todo) => (
              <li className={sx('task-row')} key={todo.id}>
                {editingId === todo.id ? (
                  <input
                    className={sx('search-field')}
                    ref={editInputRef}
                    value={editValue}
                    onInput={(event) => setEditValue(event.currentTarget.value)}
                    onBlur={() => finishEditing(true)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') finishEditing(true);
                      if (event.key === 'Escape') {
                        cancelEditing();
                      }
                    }}
                    aria-label="Edit todo"
                    style={{ flex: 1 }}
                  />
                ) : (
                  <input
                    className={sx('todo-checkbox')}
                    id={`todo-${todo.id}`}
                    type="checkbox"
                    checked={todo.completed}
                    onChange={() => toggleTodo(todo.id)}
                  />
                )}
                {editingId === todo.id ? (
                  <input
                    className={sx('due-input')}
                    type="date"
                    value={editDue}
                    onInput={(event) => {
                      const next = event.currentTarget.value;
                      setEditDue(next);
                      saveDue(todo.id, next);
                    }}
                    aria-label="Due date"
                  />
                ) : (
                  <label
                    className={sx(
                      'task-label',
                      todo.completed && styles.taskDone
                    )}
                    htmlFor={`todo-${todo.id}`}
                    onDblClick={() => beginEditing(todo)}
                    style={{ flex: 1 }}
                  >
                    {todo.title}
                  </label>
                )}
                {editingId !== todo.id && todo.due && (
                  <button
                    type="button"
                    className={sx(
                      'due-text',
                      !todo.completed && todo.due < today && styles.dueOverdue
                    )}
                    onClick={() => saveDue(todo.id, '')}
                    title="Clear due date"
                    aria-label={`Clear due date ${todo.due}`}
                  >
                    {formatDay(todo.due)}
                  </button>
                )}
                <button
                  className={sx('task-destroy')}
                  type="button"
                  onClick={() =>
                    editingId === todo.id
                      ? cancelEditing()
                      : deleteTodo(todo.id)
                  }
                  aria-label={
                    editingId === todo.id
                      ? 'Cancel editing'
                      : `Delete ${todo.title}`
                  }
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        {todos.length > 0 && (
          <div className={sx('note-editor-footer')}>
            <span>
              <strong>{activeCount}</strong>{' '}
              {activeCount === 1 ? 'item' : 'items'} left
            </span>
            <nav className={sx('todo-filters')} aria-label="Todo filters">
              {FILTERS.map((filterName) => (
                <button
                  className={sx(
                    'chip',
                    filter === filterName && styles.sideItemActive
                  )}
                  type="button"
                  onClick={() => chooseFilter(filterName)}
                  aria-current={filter === filterName ? 'page' : undefined}
                  key={filterName}
                >
                  {filterName}
                </button>
              ))}
            </nav>
            {completedCount > 0 && (
              <button
                className={sx('text-button')}
                type="button"
                onClick={clearCompleted}
              >
                Clear completed
              </button>
            )}
          </div>
        )}

        {todos.length > 0 && visibleTodos.length === 0 && (
          <p className={sx('empty-notes')}>Nothing here right now.</p>
        )}
        {todos.length === 0 && (
          <p className={sx('empty-notes')}>
            No tasks yet. Double-click a task to edit it.
          </p>
        )}
      </div>
    </section>
  );
}
