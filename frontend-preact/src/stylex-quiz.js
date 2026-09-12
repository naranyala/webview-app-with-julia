import * as stylex from '@stylexjs/stylex';
import { c } from './stylex-tokens.stylex.js';

export const quizStyles = stylex.create({
  quizShell: {
    minHeight: 'calc(100dvh - 52px)',
    padding: '1.25rem 1rem 3rem',
    backgroundImage: c.quizBackground,
    backgroundColor: c.bg
  },
  quizHeader: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: '1rem',
    marginBottom: '1.25rem'
  },
  quizTitle: {
    margin: '0.3rem 0 0',
    color: c.text,
    fontSize: 'clamp(2.2rem, 8vw, 4rem)',
    fontWeight: 700,
    letterSpacing: '-0.07em',
    lineHeight: 0.95
  },
  quizScore: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    color: c.textSecondary,
    fontSize: '0.65rem',
    fontWeight: 700,
    textTransform: 'uppercase'
  },
  quizScoreStrong: { color: c.purple, fontSize: '2rem' },
  quizCollection: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '1rem',
    padding: '0.75rem',
    border: `1px solid ${c.border}`,
    borderRadius: 14,
    backgroundColor: c.surface
  },
  quizToolbar: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    marginBottom: '1rem',
    padding: '0.75rem',
    border: `1px solid ${c.border}`,
    borderRadius: 14,
    backgroundColor: c.surface,
    '@media (min-width: 720px)': {
      alignItems: 'flex-end',
      flexDirection: 'row'
    }
  },
  quizEditorBadge: {
    padding: '0.35rem 0.5rem',
    border: `1px solid ${c.purpleMuted}`,
    borderRadius: 6,
    color: c.purple,
    fontSize: '0.62rem',
    fontWeight: 800,
    letterSpacing: '0.1em',
    textTransform: 'uppercase'
  },
  quizSummary: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.8rem',
    marginBottom: '0.75rem',
    padding: '1rem',
    border: `1px solid ${c.purpleMuted}`,
    borderRadius: 14,
    backgroundColor: c.purpleMuted
  },
  quizSummaryCopy: { flex: 1, minWidth: 0 },
  quizSummaryTitle: {
    margin: '0.15rem 0 0',
    color: c.text,
    fontSize: '1.1rem'
  },
  quizSummaryDescription: {
    margin: '0.25rem 0 0',
    color: c.textSecondary,
    fontSize: '0.78rem'
  },
  quizCount: {
    alignSelf: 'flex-start',
    color: c.purple,
    fontSize: '0.68rem',
    fontWeight: 800,
    textTransform: 'uppercase'
  },
  quizMark: {
    display: 'grid',
    flex: '0 0 42px',
    placeItems: 'center',
    width: 42,
    height: 42,
    borderRadius: 11,
    fontSize: '1.25rem'
  },
  quizCopy: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    gap: '0.15rem',
    minWidth: 0
  },
  quizCopyStrong: { fontSize: '0.9rem' },
  quizCopySpan: {
    overflow: 'hidden',
    color: c.textSecondary,
    fontSize: '0.72rem',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  quizEditorList: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  quizEditorRow: {
    display: 'grid',
    gridTemplateColumns: '2rem minmax(0, 1fr) auto',
    gap: '0.65rem',
    padding: '0.9rem',
    border: `1px solid ${c.border}`,
    borderRadius: 12,
    backgroundColor: c.surface
  },
  quizNumber: { color: c.purple, fontSize: '0.72rem', fontWeight: 800 },
  quizRowTitle: {
    margin: 0,
    color: c.text,
    fontSize: '0.9rem',
    lineHeight: 1.35
  },
  quizRowText: {
    margin: '0.4rem 0 0',
    color: c.textSecondary,
    fontSize: '0.78rem',
    lineHeight: 1.5
  },
  quizProgress: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    margin: '1.25rem 0 0.75rem',
    color: c.textSecondary,
    fontSize: '0.68rem',
    fontWeight: 700
  },
  quizProgressTrack: {
    height: 4,
    flex: 1,
    overflow: 'hidden',
    borderRadius: 4,
    backgroundColor: c.surfaceAlt
  },
  quizProgressFill: {
    display: 'block',
    height: '100%',
    backgroundImage: `linear-gradient(90deg, ${c.purple}, ${c.cyan})`
  },
  quizGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    gap: '1rem',
    '@media (min-width: 720px)': {
      gridTemplateColumns: 'minmax(0, 1.4fr) minmax(15rem, 0.6fr)'
    }
  },
  quizCard: {
    display: 'flex',
    minHeight: '29rem',
    flexDirection: 'column',
    padding: 'clamp(1.25rem, 4vw, 2.4rem)'
  },
  quizTopline: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.6rem',
    color: c.textSecondary,
    fontSize: '0.65rem',
    textTransform: 'uppercase'
  },
  difficulty: { padding: '0.25rem 0.45rem', borderRadius: 5 },
  quizKicker: {
    margin: 'auto 0 0.75rem',
    color: c.purple,
    fontSize: '0.7rem',
    fontWeight: 800,
    textTransform: 'uppercase'
  },
  quizQuestionTitle: {
    maxWidth: '42rem',
    margin: '0 0 1.6rem',
    color: c.text,
    fontSize: 'clamp(1.55rem, 4vw, 2.45rem)',
    lineHeight: 1.08
  },
  quizAnswer: {
    marginBottom: '1.5rem',
    padding: '1rem',
    borderLeft: `3px solid ${c.purple}`,
    borderRadius: '0 10px 10px 0',
    backgroundColor: c.purpleMuted
  },
  quizAnswerText: {
    margin: 0,
    color: c.text,
    fontSize: '0.95rem',
    lineHeight: 1.6
  },
  quizAnswerLabel: {
    margin: '0 0 0.4rem',
    color: c.purple,
    fontSize: '0.65rem',
    fontWeight: 800,
    textTransform: 'uppercase'
  },
  quizExplanation: {
    margin: '0.75rem 0 0',
    color: c.textSecondary,
    fontSize: '0.78rem'
  },
  quizActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.5rem',
    marginTop: 'auto'
  },
  quizButton: {
    minHeight: 40,
    padding: '0.5rem 0.8rem',
    border: 0,
    borderRadius: 8,
    fontSize: '0.75rem',
    fontWeight: 700
  },
  quizSecondary: {
    backgroundColor: c.surfaceAlt,
    color: c.textSecondary
  },
  quizPrimary: {
    backgroundColor: c.purple,
    color: c.inkOnAccent,
    ':hover': { backgroundColor: c.purpleStrong }
  },
  quizKnown: { backgroundColor: c.emeraldMuted, color: c.green },
  quizIndex: { alignSelf: 'start', padding: '1rem' },
  quizIndexHeading: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: '0.6rem',
    marginBottom: '0.85rem',
    color: c.textSecondary,
    fontSize: '0.65rem'
  },
  quizIndexTitle: {
    display: 'block',
    marginTop: '0.25rem',
    color: c.text,
    fontSize: '0.9rem'
  },
  quizQuestions: {
    display: 'flex',
    maxHeight: '23rem',
    flexDirection: 'column',
    gap: '0.25rem',
    overflowY: 'auto'
  },
  quizQuestion: {
    display: 'grid',
    gridTemplateColumns: '1.5rem minmax(0, 1fr) 1rem',
    alignItems: 'center',
    gap: '0.45rem',
    width: '100%',
    minHeight: 42,
    padding: '0.45rem',
    border: 0,
    borderRadius: 8,
    backgroundColor: 'transparent',
    color: c.textSecondary,
    textAlign: 'left',
    ':hover': { backgroundColor: c.surfaceHover, color: c.text }
  },
  quizQuestionActive: {
    backgroundColor: c.surfaceAlt,
    color: c.text
  },
  quizQuestionNumber: {
    color: c.purple,
    fontSize: '0.62rem',
    fontWeight: 800
  },
  quizQuestionText: {
    overflow: 'hidden',
    fontSize: '0.73rem',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  quizKnownMark: { color: c.green },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: 0
  }
});
