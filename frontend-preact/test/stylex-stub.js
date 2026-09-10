// Test-only stand-in for `@stylexjs/stylex`, which throws outside its
// babel plugin. Components under test only read the `className` returned by
// `props()`, so static stand-ins are sufficient for behavioral assertions.
export function create(styles) {
  return styles;
}

export function props() {
  return { className: 'test-style' };
}
