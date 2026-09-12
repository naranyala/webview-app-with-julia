import * as stylex from '@stylexjs/stylex';
import { c } from './stylex-tokens.stylex.js';

export const contentStyles = stylex.create({
  eyebrow: {
    color: c.textSecondary,
    fontSize: '0.66rem',
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase'
  },
  launcherTitle: {
    margin: '0.3rem 0 0',
    fontSize: 'clamp(1.9rem, 8vw, 2.6rem)',
    fontWeight: 650,
    letterSpacing: '-0.05em',
    lineHeight: 1,
    '@media (min-width: 720px)': { fontSize: 'clamp(2.2rem, 5vw, 3.2rem)' }
  },
  lede: {
    margin: '0.5rem 0 0',
    maxWidth: '28rem',
    color: c.textSecondary,
    fontSize: '0.88rem',
    lineHeight: 1.55
  },
  toolList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    '@media (min-width: 720px)': {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr'
    }
  },
  toolRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.8rem',
    minHeight: 68,
    width: '100%',
    padding: '0.8rem 0.9rem',
    border: `1px solid ${c.border}`,
    borderRadius: 12,
    backgroundColor: c.surface,
    textAlign: 'left',
    ':hover': { borderColor: c.coral, backgroundColor: c.surfaceHover },
    '@media (min-width: 720px)': {
      flexDirection: 'column',
      alignItems: 'flex-start',
      minHeight: 170
    }
  },
  rowGlyph: {
    display: 'grid',
    placeItems: 'center',
    flex: '0 0 38px',
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: c.surfaceAlt,
    fontSize: '1rem'
  },
  rowCopy: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.15rem',
    minWidth: 0,
    flex: 1
  },
  rowCopyStrong: { fontSize: '0.95rem' },
  rowCopySmall: {
    color: c.textSecondary,
    fontSize: '0.78rem',
    lineHeight: 1.4,
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
    overflow: 'hidden'
  },
  rowChevron: {
    color: c.textSecondary,
    fontSize: '1.4rem',
    lineHeight: 1,
    '@media (min-width: 720px)': { marginTop: 'auto' }
  },
  launcherStatus: { marginTop: '0.25rem' },
  recent: {
    display: 'flex',
    gap: '0.4rem',
    overflowX: 'auto',
    padding: '0.6rem 1rem 0',
    maxWidth: '44rem',
    margin: '0 auto',
    width: '100%',
    '@media (min-width: 1024px)': { maxWidth: '62rem' }
  },
  chip: {
    flex: '0 0 auto',
    minHeight: 32,
    padding: '0.3rem 0.7rem',
    border: `1px solid ${c.border}`,
    borderRadius: 100,
    backgroundColor: c.surface,
    fontSize: '0.75rem',
    fontWeight: 600
  },
  error: { color: c.red, fontSize: '0.82rem', margin: 0 },
  errorTitle: {
    margin: '0.35rem 0 0',
    fontSize: 'clamp(2rem, 8vw, 3rem)',
    fontWeight: 700,
    letterSpacing: '-0.06em',
    lineHeight: 1
  },
  workspaceError: {
    padding: '0.75rem 1rem 0',
    maxWidth: '44rem',
    margin: '0 auto',
    width: '100%'
  },
  workspaceBody: {
    display: 'flex',
    justifyContent: 'center',
    padding: '1rem 1rem 2rem',
    '@media (min-width: 1024px)': { padding: '1.5rem 2rem 3rem' },
    '@media (max-width: 719px)': { padding: '1rem 0.75rem 5rem' }
  },
  toolPage: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.8rem',
    width: '100%',
    maxWidth: '44rem',
    '@media (min-width: 1024px)': { maxWidth: '62rem' }
  },
  toolHeading: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    marginBottom: '0.25rem'
  },
  pageTitle: {
    margin: '0.3rem 0 0',
    fontSize: 'clamp(1.9rem, 8vw, 2.6rem)',
    fontWeight: 650,
    letterSpacing: '-0.05em',
    lineHeight: 1
  },
  badge: {
    alignSelf: 'flex-start',
    border: `1px solid ${c.cyanMuted}`,
    borderRadius: 100,
    color: c.cyan,
    fontFamily: 'monospace',
    fontSize: '0.62rem',
    letterSpacing: '0.08em',
    padding: '0.35rem 0.65rem',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap'
  },
  panel: {
    padding: '1rem',
    border: `1px solid ${c.border}`,
    borderRadius: 12,
    backgroundColor: c.surface,
    '@media (min-width: 720px)': { padding: '1.35rem' }
  },
  panelHeading: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '0.75rem',
    marginBottom: '1rem'
  },
  panelLabel: {
    color: c.textSecondary,
    fontSize: '0.66rem',
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase'
  },
  panelTitle: { margin: '0.25rem 0 0', fontSize: '1.05rem', fontWeight: 650 },
  panelStatus: { padding: '0.2rem 0', color: c.emerald, fontSize: '0.6rem' },
  selectLabel: {
    display: 'block',
    marginBottom: '0.35rem',
    color: c.textSecondary,
    fontSize: '0.75rem'
  },
  select: {
    width: '100%',
    minHeight: 44,
    padding: '0.65rem',
    border: `1px solid ${c.borderStrong}`,
    borderRadius: 8,
    outline: 0,
    backgroundColor: c.surfaceAlt,
    color: c.text,
    fontSize: '0.9rem'
  },
  muted: { color: c.textSecondary, fontSize: '0.72rem' },
  summaryRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem'
  },
  summaryCopy: { display: 'flex', flexDirection: 'column', gap: '0.15rem' },
  bar: {
    height: 6,
    overflow: 'hidden',
    borderRadius: 20,
    backgroundColor: c.surfaceAlt,
    margin: '0.8rem 0 1rem'
  },
  barNoMargin: {
    height: 4,
    overflow: 'hidden',
    borderRadius: 20,
    backgroundColor: c.surfaceAlt
  },
  barFill: {
    display: 'block',
    height: '100%',
    borderRadius: 'inherit',
    backgroundColor: c.cyan
  },
  primary: {
    width: '100%',
    minHeight: 46,
    padding: '0.7rem 1rem',
    borderRadius: 9,
    backgroundColor: c.cyan,
    color: c.bg,
    fontSize: '0.85rem',
    fontWeight: 700,
    ':hover': { backgroundColor: '#06b6d4' },
    '@media (min-width: 720px)': { width: 'auto', minWidth: 200 }
  },
  note: {
    margin: '0.75rem 0 0',
    color: c.textSecondary,
    fontSize: '0.72rem',
    lineHeight: 1.5
  },
  diskGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '0.8rem',
    '@media (min-width: 1024px)': { gridTemplateColumns: '1fr 1fr' }
  },
  folderList: { display: 'flex', flexDirection: 'column', gap: '0.9rem' },
  folderCopy: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.5rem',
    marginBottom: '0.4rem',
    color: c.textSecondary,
    fontSize: '0.8rem'
  },
  folderStrong: { color: c.text },
  footerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    marginTop: '1.25rem',
    paddingTop: '0.8rem',
    borderTop: `1px solid ${c.border}`,
    color: c.textSecondary,
    fontSize: '0.8rem'
  },
  strongGreen: { color: c.green },
  notesLayout: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '0.8rem',
    '@media (min-width: 720px)': {
      gridTemplateColumns: 'minmax(220px, 0.8fr) minmax(0, 1.2fr)'
    }
  },
  selectWrap: {
    display: 'flex',
    flex: '0 0 11rem',
    flexDirection: 'column',
    gap: '0.2rem'
  },
  quizEditorSearch: { flex: 1, margin: 0, minWidth: 0 },
  notesPanel: { order: 1 },
  editor: {
    order: 2,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 380
  },
  headingRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem'
  },
  action: {
    minHeight: 40,
    padding: '0.5rem 0.8rem',
    borderRadius: 8,
    backgroundColor: c.amber,
    color: c.bg,
    fontSize: '0.75rem',
    fontWeight: 800,
    ':hover': { backgroundColor: '#f59e0b' }
  },
  searchInput: {
    width: '100%',
    minHeight: 44,
    padding: '0.65rem 0.75rem',
    border: `1px solid ${c.borderStrong}`,
    borderRadius: 8,
    outline: 0,
    backgroundColor: c.surfaceAlt,
    color: c.text,
    fontSize: '0.85rem'
  },
  searchEngineNote: {
    margin: '0.45rem 0 0',
    color: c.textSecondary,
    fontFamily: 'monospace',
    fontSize: '0.58rem',
    textTransform: 'uppercase'
  },
  notesList: {
    display: 'flex',
    gap: '0.5rem',
    marginTop: '0.8rem',
    overflowX: 'auto',
    paddingBottom: '0.25rem',
    '@media (min-width: 720px)': {
      flexDirection: 'column',
      overflow: 'visible'
    }
  },
  noteItem: {
    display: 'flex',
    flex: '0 0 200px',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '0.3rem',
    minHeight: 44,
    padding: '0.7rem',
    border: '1px solid transparent',
    borderRadius: 9,
    backgroundColor: c.surfaceAlt,
    textAlign: 'left',
    ':hover': {
      borderColor: c.cyanMuted,
      backgroundColor: c.surfaceHover
    },
    '@media (min-width: 720px)': { flex: 'none' }
  },
  noteItemActive: {
    borderColor: c.cyanMuted,
    backgroundColor: c.cyanMuted
  },
  noteMeta: {
    display: 'flex',
    width: '100%',
    justifyContent: 'space-between',
    color: c.cyan,
    fontFamily: 'monospace',
    fontSize: '0.58rem',
    textTransform: 'uppercase'
  },
  noteUpdated: { color: c.textSecondary, textTransform: 'none' },
  noteTitle: {
    color: c.text,
    fontSize: '0.82rem',
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '100%'
  },
  noteBody: {
    display: '-webkit-box',
    overflow: 'hidden',
    color: c.textSecondary,
    fontSize: '0.7rem',
    lineHeight: 1.4,
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2
  },
  empty: { padding: '0.75rem', color: c.textSecondary, fontSize: '0.8rem' },
  saved: {
    display: 'block',
    marginTop: '0.3rem',
    color: c.emerald,
    fontFamily: 'monospace',
    fontSize: '0.6rem'
  },
  titleInput: {
    width: '100%',
    marginTop: '1.25rem',
    padding: '0 0 0.6rem',
    border: 0,
    borderBottom: `1px solid ${c.borderStrong}`,
    outline: 0,
    backgroundColor: 'transparent',
    color: c.text,
    font: 'inherit',
    fontSize: '1.35rem',
    fontWeight: 650,
    ':focus': { borderBottomColor: c.amber }
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.8rem',
    marginTop: '0.6rem',
    color: c.textSecondary,
    fontFamily: 'monospace',
    fontSize: '0.62rem'
  },
  bodyInput: {
    width: '100%',
    flex: 1,
    minHeight: 160,
    marginTop: '1rem',
    padding: 0,
    border: 0,
    outline: 0,
    resize: 'vertical',
    backgroundColor: 'transparent',
    color: c.text,
    font: 'inherit',
    fontSize: '0.9rem',
    lineHeight: 1.7
  },
  qnaField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    marginTop: '1rem'
  },
  qnaLabel: {
    color: c.amber,
    fontFamily: 'monospace',
    fontSize: '0.65rem',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase'
  },
  qnaInput: {
    width: '100%',
    minHeight: 88,
    padding: '0.75rem',
    border: `1px solid ${c.borderStrong}`,
    borderRadius: 8,
    outline: 0,
    resize: 'vertical',
    backgroundColor: c.surfaceAlt,
    color: c.text,
    font: 'inherit',
    fontSize: '0.9rem',
    lineHeight: 1.6,
    ':focus': { borderColor: c.amber }
  },
  qnaQuestionInput: { minHeight: 82 },
  qnaAnswerInput: { minHeight: 220 },
  qnaImport: {
    marginTop: '1rem',
    paddingTop: '0.8rem',
    borderTop: `1px solid ${c.border}`
  },
  qnaHelp: { margin: '0.5rem 0', color: c.textSecondary, fontSize: '0.72rem' },
  qnaImportInput: {
    width: '100%',
    minHeight: 120,
    padding: '0.75rem',
    border: `1px solid ${c.borderStrong}`,
    borderRadius: 8,
    outline: 0,
    resize: 'vertical',
    backgroundColor: c.surfaceAlt,
    color: c.text,
    font: 'inherit',
    fontSize: '0.82rem',
    lineHeight: 1.5,
    ':focus': { borderColor: c.amber }
  },
  editorFooter: {
    display: 'flex',
    alignItems: 'flex-start',
    flexDirection: 'column',
    gap: '0.5rem',
    marginTop: '1rem',
    paddingTop: '0.8rem',
    borderTop: `1px solid ${c.border}`,
    color: c.textSecondary,
    fontSize: '0.72rem'
  },
  textButton: {
    minHeight: 44,
    padding: 0,
    backgroundColor: 'transparent',
    color: c.amber,
    fontSize: '0.8rem',
    fontWeight: 700
  }
});
