import * as stylex from '@stylexjs/stylex';
import { c } from './stylex-tokens.stylex.js';

export const taskStyles = stylex.create({
  todoToggleAll: {
    flexShrink: 0,
    padding: '0.25rem 0.5rem',
    border: 0,
    borderRadius: 999,
    backgroundColor: 'transparent',
    color: c.textSecondary,
    fontSize: '1.5rem',
    lineHeight: 1
  },
  todoList: { margin: 0, padding: 0, listStyle: 'none' },
  todoCheckbox: {
    flexShrink: 0,
    width: 24,
    height: 24,
    appearance: 'none',
    cursor: 'pointer',
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: c.borderStrong,
    borderRadius: '50%',
    ':checked': { borderColor: c.emerald, backgroundColor: c.emerald }
  },
  todoFilters: { display: 'flex', alignItems: 'center', gap: '0.25rem' },
  taskRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    minHeight: 48,
    padding: '0.45rem 0.2rem',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: c.border
  },
  taskLabel: {
    minWidth: 0,
    overflowWrap: 'break-word',
    color: c.text,
    fontSize: '0.88rem',
    lineHeight: 1.45,
    cursor: 'text'
  },
  taskDone: { color: c.textSecondary, textDecorationLine: 'line-through' },
  taskDestroy: {
    flexShrink: 0,
    minHeight: 36,
    minWidth: 36,
    padding: '0.25rem',
    border: 0,
    borderRadius: 8,
    backgroundColor: 'transparent',
    color: c.textSecondary,
    fontSize: '1.1rem',
    lineHeight: 1,
    ':hover': { backgroundColor: c.red, color: 'white' }
  },
  dueText: {
    flexShrink: 0,
    padding: '0.15rem 0.55rem',
    border: 0,
    borderRadius: 100,
    backgroundColor: c.amberMuted,
    color: c.amber,
    fontFamily: 'monospace',
    fontSize: '0.62rem',
    whiteSpace: 'nowrap'
  },
  dueOverdue: { backgroundColor: c.redMuted, color: c.red },
  dueInput: {
    flexShrink: 0,
    width: '8.2rem',
    minHeight: 44,
    padding: '0.5rem',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: c.borderStrong,
    borderRadius: 8,
    outline: 0,
    backgroundColor: c.surfaceAlt,
    color: c.text,
    colorScheme: 'dark',
    fontSize: '0.75rem',
    ':focus': { borderColor: c.amber }
  },
  calGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: 2,
    marginTop: '0.8rem'
  },
  calDow: {
    paddingBottom: '0.3rem',
    color: c.textSecondary,
    fontSize: '0.62rem',
    fontWeight: 700,
    textAlign: 'center'
  },
  calCell: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minHeight: 40,
    padding: '0.2rem',
    border: 0,
    borderRadius: 8,
    backgroundColor: 'transparent',
    color: c.text,
    fontSize: '0.74rem',
    ':hover': { backgroundColor: c.surfaceHover }
  },
  calSelected: {
    backgroundColor: c.amberMuted
  },
  calToday: { color: c.amber, fontWeight: 800 },
  calDots: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    minHeight: 5
  },
  calDot: {
    width: 4,
    height: 4,
    borderRadius: '50%',
    backgroundColor: c.amber
  },
  calDotDone: { backgroundColor: c.emerald },
  calCount: {
    color: c.textSecondary,
    fontFamily: 'monospace',
    fontSize: '0.6rem'
  },
  coral: { color: c.coral },
  blue: { color: c.blue },
  gold: { color: c.gold },
  purple: { color: c.purple },
  coralMark: { backgroundColor: c.coralMuted, color: c.coral },
  blueMark: { backgroundColor: c.blueMuted, color: c.blue },
  goldMark: { backgroundColor: c.amberMuted, color: c.amber },
  purpleMark: { backgroundColor: c.purpleMuted, color: c.purple },
  coralDot: { backgroundColor: c.coral },
  blueDot: { backgroundColor: c.blue },
  goldDot: { backgroundColor: c.amber },
  purpleDot: { backgroundColor: c.purple },
  green: { color: c.green },
  greenMark: { backgroundColor: c.greenMark, color: c.green },
  greenDot: { backgroundColor: c.green },
  cyan: { color: c.cyan },
  cyanMark: { backgroundColor: c.cyanMark, color: c.cyan },
  cyanDot: { backgroundColor: c.cyan },
  teal: { color: c.teal },
  tealMark: { backgroundColor: c.tealMuted, color: c.teal },
  tealDot: { backgroundColor: c.teal },
  orange: { color: c.orange },
  orangeMark: { backgroundColor: c.orangeMuted, color: c.orange },
  orangeDot: { backgroundColor: c.orange },
  bandLast: { borderBottom: 0 }
});
