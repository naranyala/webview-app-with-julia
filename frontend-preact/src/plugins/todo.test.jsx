import { fireEvent, render, screen } from '@testing-library/preact';
import { beforeEach, describe, expect, test } from 'vitest';
import { TodoApp } from './todo.jsx';

beforeEach(() => {
  window.localStorage.clear();
  window.location.hash = '';
});

function addTodo(title) {
  const input = screen.getByLabelText('New todo');
  fireEvent.input(input, { target: { value: title } });
  fireEvent.submit(input.closest('form'));
}

describe('TodoApp tasks', () => {
  test('renders the empty planner', () => {
    render(<TodoApp mode="tasks" />);
    expect(screen.getByText('Todos')).toBeTruthy();
    expect(screen.getByText(/No tasks yet/)).toBeTruthy();
  });

  test('adds a todo through the form', () => {
    render(<TodoApp mode="tasks" />);
    addTodo('Buy milk');
    expect(screen.getByText('Buy milk')).toBeTruthy();
  });

  test('toggles a todo complete', () => {
    render(<TodoApp mode="tasks" />);
    addTodo('Buy milk');
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox.checked).toBe(false);
    fireEvent.change(checkbox, { target: { checked: true } });
    expect(checkbox.checked).toBe(true);
  });

  test('filters to active todos', () => {
    render(<TodoApp mode="tasks" />);
    addTodo('One');
    addTodo('Two');
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'active' }));
    expect(screen.queryByText('One')).toBeNull();
    expect(screen.getByText('Two')).toBeTruthy();
  });

  test('calendar mode renders the current month', () => {
    render(<TodoApp mode="calendar" cursor="2026-09" />);
    expect(screen.getByText('September 2026')).toBeTruthy();
  });
});
