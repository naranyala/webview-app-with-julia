import * as stylex from '@stylexjs/stylex';
import { c } from './stylex-tokens.stylex.js';

export const mediaStyles = stylex.create({
  audioConsole: { marginBottom: 0 },
  trackMeta: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  albumArt: {
    display: 'grid',
    flex: '0 0 46px',
    width: 46,
    height: 46,
    placeItems: 'center',
    borderRadius: 10,
    backgroundImage: c.mediaBackground,
    backgroundColor: c.cyan,
    color: c.inkOnAccent,
    fontSize: '0.65rem',
    fontWeight: 800
  },
  trackTitle: { margin: '0.2rem 0', fontSize: '0.95rem' },
  toggle: {
    width: 'auto',
    minHeight: 40,
    marginLeft: 'auto',
    padding: '0.5rem 0.8rem',
    border: 0,
    borderRadius: 9,
    backgroundColor: c.surfaceAlt,
    color: c.textSecondary,
    fontSize: '0.75rem'
  },
  toggleEnabled: {
    backgroundColor: c.emeraldMuted,
    color: c.green
  },
  visualizer: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 3,
    height: 72,
    margin: '1rem 0 0.75rem',
    padding: '0 0.1rem 0.5rem',
    borderBottom: `1px solid ${c.border}`
  },
  visualBar: {
    flex: 1,
    minWidth: 3,
    borderRadius: '3px 3px 0 0',
    backgroundColor: c.cyan,
    opacity: 0.65
  },
  visualAccent: { backgroundColor: c.amber, opacity: 0.9 },
  transport: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.6rem',
    color: c.textSecondary,
    fontFamily: 'monospace',
    fontSize: '0.65rem'
  },
  transportTrack: {
    flex: 1,
    height: 4,
    overflow: 'hidden',
    borderRadius: 20,
    backgroundColor: c.surfaceAlt
  },
  transportFill: {
    display: 'block',
    width: '38%',
    height: '100%',
    backgroundColor: c.cyan
  },
  equalizerGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '0.8rem',
    '@media (min-width: 1024px)': { gridTemplateColumns: '1.5fr 0.7fr' }
  },
  bands: { display: 'flex', flexDirection: 'column', gap: '0.15rem' },
  band: {
    display: 'grid',
    gridTemplateColumns: '2.6rem 1fr 2.6rem',
    alignItems: 'center',
    gap: '0.6rem',
    minHeight: 48,
    padding: '0.35rem 0',
    borderBottom: `1px solid ${c.border}`
  },
  range: { width: '100%', minHeight: 44, accentColor: c.cyan },
  bandValue: {
    color: c.text,
    fontFamily: 'monospace',
    fontSize: '0.72rem',
    textAlign: 'right'
  },
  bandLabel: {
    order: -1,
    color: c.textSecondary,
    fontFamily: 'monospace',
    fontSize: '0.68rem'
  },
  master: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    marginTop: '0.8rem',
    paddingTop: '0.8rem',
    borderTop: `1px solid ${c.border}`,
    color: c.textSecondary,
    fontSize: '0.78rem'
  },
  masterRange: { flex: 1, minHeight: 44, accentColor: c.cyan },
  masterStrong: { minWidth: '2.6rem', color: c.text, textAlign: 'right' },
  presets: { display: 'flex', flexDirection: 'column' },
  presetList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '0.5rem',
    marginTop: '0.8rem',
    '@media (min-width: 1024px)': { gridTemplateColumns: '1fr' }
  },
  preset: {
    minHeight: 46,
    padding: '0.65rem',
    border: 0,
    borderRadius: 8,
    backgroundColor: c.surfaceAlt,
    color: c.textSecondary,
    fontSize: '0.82rem',
    fontWeight: 600,
    ':hover': { backgroundColor: c.cyanMuted, color: c.text }
  },
  presetActive: { backgroundColor: c.cyanMuted, color: c.text },
  backendStatus: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.8rem',
    border: `1px solid ${c.border}`,
    borderRadius: 10,
    backgroundColor: c.surface,
    color: c.textSecondary,
    fontSize: '0.78rem'
  },
  backendLabel: {
    color: c.text,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    fontSize: '0.62rem'
  },
  backendValue: {
    flex: '1 1 100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    '@media (min-width: 720px)': { flex: 1 }
  },
  backendActions: {
    display: 'flex',
    gap: '0.4rem',
    width: '100%',
    '@media (min-width: 720px)': { width: 'auto', marginLeft: 'auto' }
  },
  backendButton: {
    flex: 1,
    minHeight: 40,
    padding: '0.5rem',
    border: 0,
    borderRadius: 8,
    backgroundColor: c.surfaceAlt,
    color: c.text,
    fontSize: '0.75rem',
    fontWeight: 700,
    '@media (min-width: 720px)': {
      flex: 'none',
      paddingLeft: '0.9rem',
      paddingRight: '0.9rem'
    }
  },
  backendError: { width: '100%', color: c.red }
});
