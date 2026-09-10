import * as stylex from '@stylexjs/stylex';

const c = {
  bg: '#0e0f12',
  surface: '#16181c',
  surfaceAlt: '#1e2025',
  surfaceHover: '#26282e',
  text: '#e8e9ed',
  textSecondary: '#8b8d96',
  muted: '#5e6069',
  border: 'rgba(255, 255, 255, 0.07)',
  borderStrong: 'rgba(255, 255, 255, 0.12)',
  cyan: '#22d3ee',
  cyanMuted: 'rgba(34, 211, 238, 0.14)',
  amber: '#fbbf24',
  amberMuted: 'rgba(251, 191, 36, 0.14)',
  emerald: '#34d399',
  emeraldMuted: 'rgba(52, 211, 153, 0.14)',
  red: '#f87171',
  redMuted: 'rgba(248, 113, 113, 0.14)',
  blue: '#60a5fa',
  blueMuted: 'rgba(96, 165, 250, 0.14)',
  purple: '#a78bfa',
  purpleMuted: 'rgba(167, 139, 250, 0.14)',
  coral: '#fb923c',
  coralMuted: 'rgba(251, 146, 60, 0.14)',
  green: '#34d399',
  greenMark: 'rgba(52, 211, 153, 0.14)',
  gold: '#fbbf24',
  goldMark: 'rgba(251, 191, 36, 0.14)'
};

export const styles = stylex.create({
  shell: {
    minHeight: '100dvh',
    paddingLeft: 64,
    backgroundColor: c.bg,
    color: c.text,
    fontSize: 15,
    lineHeight: 1.5,
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    '@media (min-width: 720px)': { fontSize: 15.5 },
    '@media (max-width: 719px)': { paddingLeft: 0, paddingBottom: 60 }
  },
  topbar: {
    position: 'sticky',
    top: 0,
    zIndex: 20,
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    height: 52,
    padding: '0 0.9rem',
    borderBottom: `1px solid ${c.border}`,
    backgroundColor: 'rgba(14, 15, 18, 0.88)',
    backdropFilter: 'blur(16px) saturate(1.4)'
  },
  workspaceTopbar: { gap: '0.5rem' },
  brandMark: {
    display: 'grid',
    placeItems: 'center',
    width: 30,
    height: 30,
    border: `1px solid ${c.borderStrong}`,
    borderRadius: 8,
    color: c.cyan,
    fontSize: '0.62rem',
    fontWeight: 800,
    letterSpacing: '0.08em'
  },
  brandName: { fontWeight: 700, fontSize: '0.9rem' },
  topbarStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    marginLeft: 'auto',
    color: c.muted,
    fontSize: '0.7rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em'
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    backgroundColor: c.emerald,
    boxShadow: `0 0 8px ${c.emeraldMuted}`
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.15rem',
    minHeight: 44,
    minWidth: 44,
    padding: '0 0.5rem 0 0.25rem',
    marginLeft: '-0.25rem',
    borderRadius: 8,
    backgroundColor: 'transparent',
    color: c.muted,
    fontSize: '1.25rem',
    ':hover': { color: c.text, backgroundColor: c.surfaceHover }
  },
  backLabel: { fontSize: '0.82rem', fontWeight: 600 },
  titlebarName: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    minWidth: 0,
    flex: 1,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    fontSize: '0.9rem'
  },
  titlebarStrong: { overflow: 'hidden', textOverflow: 'ellipsis' },
  titlebarDot: { flex: '0 0 8px', width: 8, height: 8, borderRadius: '50%' },
  windowActions: {
    display: 'none',
    '@media (min-width: 1024px)': { display: 'flex', gap: '0.15rem' }
  },
  windowAction: {
    minHeight: 36,
    minWidth: 40,
    padding: '0.35rem 0.5rem',
    borderRadius: 7,
    backgroundColor: 'transparent',
    color: c.muted,
    fontSize: '0.85rem',
    ':hover': { backgroundColor: c.surfaceHover, color: c.text }
  },
  closeButton: { ':hover': { backgroundColor: c.red, color: 'white' } },
  rail: {
    position: 'fixed',
    top: 52,
    bottom: 0,
    left: 0,
    zIndex: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    width: 64,
    padding: '0.5rem 0.4rem',
    borderRight: `1px solid ${c.border}`,
    backgroundColor: 'rgba(14, 15, 18, 0.96)',
    backdropFilter: 'blur(16px)',
    '@media (max-width: 719px)': {
      top: 'auto',
      right: 0,
      width: 'auto',
      height: 60,
      flexDirection: 'row',
      overflowX: 'auto',
      padding: '0.25rem 0.35rem',
      borderTop: `1px solid ${c.border}`,
      borderRight: 0
    }
  },
  tab: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minHeight: 56,
    borderRadius: 10,
    backgroundColor: 'transparent',
    color: c.muted,
    ':hover': { color: c.text, backgroundColor: c.surfaceHover },
    '@media (max-width: 719px)': { flex: '0 0 4rem', minHeight: 52 }
  },
  tabActive: { color: c.text, backgroundColor: c.surfaceAlt },
  tabGlyph: { fontSize: '1.05rem', lineHeight: 1 },
  tabLabel: {
    fontSize: '0.58rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase'
  },
  tabDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 5,
    height: 5,
    borderRadius: '50%'
  },
  sidePanel: {
    position: 'fixed',
    top: 52,
    bottom: 0,
    left: 64,
    zIndex: 19,
    width: 240,
    padding: '1rem 0.75rem',
    borderRight: `1px solid ${c.border}`,
    backgroundColor: c.surface,
    boxShadow: '12px 0 32px rgba(0, 0, 0, 0.4)',
    overflowY: 'auto',
    '@media (max-width: 719px)': {
      left: 0,
      bottom: 60,
      width: 'min(20rem, calc(100vw - 1rem))',
      padding: '0.75rem',
      borderRight: `1px solid ${c.border}`
    }
  },
  groupLabel: {
    margin: '0 0 0.6rem 0.25rem',
    color: c.muted,
    fontSize: '0.68rem',
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase'
  },
  sideNav: { display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  sideItem: {
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.6rem',
    padding: '0.7rem 0.65rem',
    border: '1px solid transparent',
    borderRadius: 12,
    backgroundColor: 'transparent',
    color: c.text,
    textAlign: 'left',
    minHeight: 44,
    ':hover': { backgroundColor: c.surfaceHover }
  },
  sideItemActive: {
    borderColor: c.borderStrong,
    backgroundColor: c.surfaceAlt
  },
  sideGlyph: { fontSize: '1.1rem', lineHeight: 1.4 },
  sideCopy: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.15rem',
    minWidth: 0
  },
  sideCopyStrong: { fontSize: '0.85rem' },
  sideCopySmall: { color: c.muted, fontSize: '0.72rem', lineHeight: 1.4 },
  launcher: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    width: '100%',
    maxWidth: '36rem',
    margin: '0 auto',
    padding: '1.25rem 1rem 2rem',
    '@media (min-width: 720px)': { maxWidth: '42rem', paddingTop: '2rem' },
    '@media (min-width: 1024px)': { maxWidth: '62rem' }
  },
  quizLayout: { width: '100%', maxWidth: '72rem', margin: '0 auto' },
  mapPage: { maxWidth: '80rem' },
  mapLayout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    gap: '0.8rem',
    '@media (min-width: 720px)': {
      gridTemplateColumns: 'minmax(0, 1.35fr) minmax(15rem, 0.65fr)'
    }
  },
  mapPanel: {
    minWidth: 0,
    padding: '1rem',
    border: `1px solid ${c.border}`,
    borderRadius: 14,
    backgroundColor: c.surface,
    '@media (min-width: 720px)': { padding: '1.35rem' },
    '@media (max-width: 719px)': { padding: '0.75rem' }
  },
  mapPanelHeading: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '0.75rem',
    marginBottom: '0.9rem'
  },
  mapPanelActions: {
    display: 'flex',
    alignItems: 'flex-end',
    flexDirection: 'column',
    gap: '0.15rem'
  },
  mapReset: { minHeight: 32, fontSize: '0.68rem' },
  mapCount: {
    flexShrink: 0,
    color: c.muted,
    fontFamily: 'monospace',
    fontSize: '0.62rem',
    textTransform: 'uppercase'
  },
  mapToolbar: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    marginBottom: '0.8rem',
    '@media (min-width: 720px)': {
      flexDirection: 'row',
      alignItems: 'center'
    }
  },
  mapMode: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 2,
    minInlineSize: 0,
    margin: 0,
    padding: 2,
    border: 0,
    borderRadius: 9,
    backgroundColor: c.surfaceAlt,
    '@media (min-width: 720px)': { flex: '0 0 auto' }
  },
  mapModeButton: {
    minHeight: 40,
    padding: '0.45rem 0.65rem',
    borderRadius: 7,
    backgroundColor: 'transparent',
    color: c.muted,
    fontSize: '0.72rem',
    fontWeight: 700,
    ':hover': { color: c.text, backgroundColor: c.surfaceHover }
  },
  mapModeActive: {
    backgroundColor: c.cyanMuted,
    color: c.text
  },
  mapSelectWrap: { display: 'block', minWidth: 0, flex: 1 },
  mapSelect: {
    width: '100%',
    minHeight: 40,
    padding: '0.55rem 0.65rem',
    border: `1px solid ${c.borderStrong}`,
    borderRadius: 8,
    outline: 0,
    backgroundColor: c.surfaceAlt,
    color: c.text,
    fontSize: '0.78rem',
    ':focus': { borderColor: c.cyan }
  },
  mapCanvas: {
    position: 'relative',
    minHeight: 280,
    overflow: 'hidden',
    border: `1px solid ${c.borderStrong}`,
    borderRadius: 11,
    backgroundColor: c.bg,
    backgroundImage:
      `linear-gradient(${c.border} 1px, transparent 1px), linear-gradient(90deg, ${c.border} 1px, transparent 1px)`,
    backgroundSize: '32px 32px'
  },
  mapSvg: {
    display: 'block',
    width: '100%',
    height: 'clamp(18rem, 46vw, 34rem)'
  },
  mapWater: { fill: c.bg },
  mapShape: {
    cursor: 'pointer',
    stroke: c.bg,
    strokeWidth: 0.035,
    vectorEffect: 'non-scaling-stroke',
    transition: 'opacity 120ms ease, filter 120ms ease',
    ':hover': { filter: 'brightness(1.2)', opacity: 1 }
  },
  mapShapeSelected: {
    stroke: c.amber,
    strokeWidth: 0.1,
    filter: 'brightness(1.15)',
    opacity: 1
  },
  mapOverlay: {
    position: 'absolute',
    right: 12,
    bottom: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: '0.45rem 0.6rem',
    border: `1px solid ${c.borderStrong}`,
    borderRadius: 7,
    backgroundColor: 'rgba(14, 15, 18, 0.88)',
    color: c.muted,
    fontFamily: 'monospace',
    fontSize: '0.58rem',
    textAlign: 'right',
    textTransform: 'uppercase'
  },
  mapOverlayKicker: { color: c.cyan, fontWeight: 800 },
  mapFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    marginTop: '0.65rem',
    color: c.muted,
    fontSize: '0.68rem',
    '@media (max-width: 719px)': {
      alignItems: 'flex-start',
      flexDirection: 'column'
    }
  },
  mapSourceMark: {
    color: c.cyan,
    fontFamily: 'monospace',
    fontSize: '0.6rem',
    fontWeight: 700
  },
  mapBrowser: {
    minWidth: 0,
    padding: '1rem',
    border: `1px solid ${c.border}`,
    borderRadius: 14,
    backgroundColor: c.surfaceAlt,
    '@media (min-width: 720px)': { padding: '1.15rem' },
    '@media (max-width: 719px)': { padding: '0.75rem' }
  },
  mapBrowserHeading: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '0.75rem',
    marginBottom: '0.8rem'
  },
  mapSearchWrap: { display: 'block', marginBottom: '0.65rem' },
  mapSearch: {
    width: '100%',
    minHeight: 42,
    padding: '0.6rem 0.7rem',
    border: `1px solid ${c.borderStrong}`,
    borderRadius: 8,
    outline: 0,
    backgroundColor: c.bg,
    color: c.text,
    fontSize: '0.78rem',
    ':focus': { borderColor: c.cyan }
  },
  mapList: {
    display: 'flex',
    maxHeight: '31rem',
    flexDirection: 'column',
    gap: 2,
    overflowY: 'auto'
  },
  mapListItem: {
    display: 'grid',
    gridTemplateColumns: '0.45rem minmax(0, 1fr) 0.8rem',
    alignItems: 'center',
    gap: '0.55rem',
    width: '100%',
    minHeight: 48,
    padding: '0.5rem 0.45rem',
    border: '1px solid transparent',
    borderRadius: 8,
    backgroundColor: 'transparent',
    color: c.text,
    textAlign: 'left',
    ':hover': { backgroundColor: c.surfaceHover }
  },
  mapListItemActive: {
    borderColor: c.cyanMuted,
    backgroundColor: c.cyanMuted
  },
  mapListColor: { width: 7, height: 28, borderRadius: 4 },
  mapListCopy: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0
  },
  mapListCopyStrong: { fontSize: '0.78rem' },
  mapListCopySmall: { color: c.muted, fontSize: '0.64rem' },
  mapListChevron: { color: c.muted, fontSize: '1.2rem', textAlign: 'right' },
  mapEmpty: { padding: '0.6rem', color: c.muted, fontSize: '0.76rem' },
  mapDataPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.8rem',
    marginTop: '0.8rem',
    padding: '1rem',
    border: `1px solid ${c.border}`,
    borderRadius: 14,
    backgroundColor: c.surface,
    '@media (max-width: 719px)': { padding: '0.75rem' }
  },
  mapDataHeading: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '0.75rem'
  },
  mapTableScroll: {
    overflowX: 'auto',
    border: `1px solid ${c.border}`,
    borderRadius: 9
  },
  mapTable: {
    width: '100%',
    minWidth: '38rem',
    borderCollapse: 'collapse',
    fontSize: '0.72rem',
    textAlign: 'left',
    '@media (max-width: 719px)': {
      minWidth: 0,
      fontSize: '0.68rem'
    }
  },
  mapTableHead: {
    padding: '0.65rem 0.7rem',
    borderBottom: `1px solid ${c.borderStrong}`,
    color: c.muted,
    fontSize: '0.6rem',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
    '@media (max-width: 719px)': { padding: '0.55rem 0.45rem' }
  },
  mapTableCell: {
    padding: '0.65rem 0.7rem',
    borderBottom: `1px solid ${c.border}`,
    color: c.muted,
    whiteSpace: 'nowrap',
    '@media (max-width: 719px)': {
      padding: '0.55rem 0.45rem',
      whiteSpace: 'normal'
    }
  },
  mapTableDetail: { '@media (max-width: 719px)': { display: 'none' } },
  mapTableRow: { ':hover': { backgroundColor: c.surfaceHover } },
  mapTableAction: {
    padding: '0.3rem 0.5rem',
    border: `1px solid ${c.cyanMuted}`,
    borderRadius: 6,
    backgroundColor: 'transparent',
    color: c.cyan,
    fontSize: '0.64rem',
    fontWeight: 700,
    whiteSpace: 'nowrap',
    ':hover': { backgroundColor: c.cyanMuted },
    '@media (max-width: 719px)': {
      padding: '0.3rem 0.4rem'
    }
  },
  mapTableActionName: {
    '@media (max-width: 719px)': { display: 'none' }
  },
  mapTableEmpty: {
    margin: 0,
    padding: '1rem',
    color: c.muted,
    fontSize: '0.76rem'
  },
  mapSelection: {
    marginTop: '0.8rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    padding: '0.9rem 1rem',
    border: `1px solid ${c.amberMuted}`,
    borderRadius: 11,
    backgroundColor: c.amberMuted,
    '@media (max-width: 719px)': {
      alignItems: 'flex-start',
      flexDirection: 'column'
    }
  },
  mapSelectionType: {
    margin: 0,
    color: c.amber,
    fontFamily: 'monospace',
    fontSize: '0.6rem',
    fontWeight: 800,
    letterSpacing: '0.1em',
    textTransform: 'uppercase'
  },
  mapSelectionName: { margin: '0.2rem 0 0', fontSize: '1.05rem' },
  mapSource: {
    margin: 0,
    color: c.muted,
    fontSize: '0.68rem',
    lineHeight: 1.5
  },
  eyebrow: {
    color: c.muted,
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
    color: c.muted,
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
    color: c.muted,
    fontSize: '0.78rem',
    lineHeight: 1.4,
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
    overflow: 'hidden'
  },
  rowChevron: {
    color: c.muted,
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
    color: c.muted,
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
    color: c.muted,
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
  muted: { color: c.muted, fontSize: '0.72rem' },
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
    color: c.muted,
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
    color: c.muted,
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
    color: c.muted,
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
    color: c.muted,
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
  noteUpdated: { color: c.muted, textTransform: 'none' },
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
    color: c.muted,
    fontSize: '0.7rem',
    lineHeight: 1.4,
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2
  },
  empty: { padding: '0.75rem', color: c.muted, fontSize: '0.8rem' },
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
    color: c.muted,
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
  qnaHelp: { margin: '0.5rem 0', color: c.muted, fontSize: '0.72rem' },
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
    color: c.muted,
    fontSize: '0.72rem'
  },
  textButton: {
    minHeight: 44,
    padding: 0,
    backgroundColor: 'transparent',
    color: c.amber,
    fontSize: '0.8rem',
    fontWeight: 700
  },
  audioConsole: { marginBottom: 0 },
  trackMeta: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  albumArt: {
    display: 'grid',
    flex: '0 0 46px',
    width: 46,
    height: 46,
    placeItems: 'center',
    borderRadius: 10,
    backgroundImage: 'linear-gradient(145deg, #22d3ee, #164e63)',
    backgroundColor: '#164e63',
    color: c.bg,
    fontSize: '0.65rem',
    fontWeight: 800
  },
  trackTitle: { margin: '0.2rem 0', fontSize: '0.95rem' },
  toggle: {
    width: 'auto',
    minHeight: 40,
    marginLeft: 'auto',
    padding: '0.5rem 0.8rem',
    borderRadius: 9,
    backgroundColor: c.surfaceAlt,
    color: c.muted,
    fontSize: '0.75rem'
  },
  toggleEnabled: {
    border: `1px solid ${c.emeraldMuted}`,
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
    color: c.muted,
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
    color: c.muted,
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
    color: c.muted,
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
    border: '1px solid transparent',
    borderRadius: 8,
    backgroundColor: c.surfaceAlt,
    color: c.muted,
    fontSize: '0.82rem',
    fontWeight: 600,
    ':hover': { borderColor: c.cyan, color: c.text }
  },
  presetActive: { borderColor: c.cyan, color: c.text },
  backendStatus: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.8rem',
    border: `1px solid ${c.border}`,
    borderRadius: 10,
    backgroundColor: c.surface,
    color: c.muted,
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
  backendError: { width: '100%', color: c.red },
  quizShell: {
    minHeight: 'calc(100dvh - 52px)',
    padding: '1.25rem 1rem 3rem',
    backgroundImage:
      'radial-gradient(circle at 78% 0%, rgba(167, 139, 250, 0.09), transparent 28rem)',
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
    color: c.muted,
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
    color: c.muted,
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
    color: c.muted,
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
    color: c.muted,
    fontSize: '0.78rem',
    lineHeight: 1.5
  },
  quizProgress: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    margin: '1.25rem 0 0.75rem',
    color: c.muted,
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
    backgroundImage: 'linear-gradient(90deg, #8b5cf6, #c4b5fd)'
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
    color: c.muted,
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
    color: c.muted,
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
    borderRadius: 8,
    fontSize: '0.75rem',
    fontWeight: 700
  },
  quizSecondary: {
    backgroundColor: c.surfaceAlt,
    color: c.muted
  },
  quizPrimary: {
    backgroundColor: c.purple,
    color: '#1e1b4b',
    ':hover': { backgroundColor: '#8b5cf6' }
  },
  quizKnown: { backgroundColor: c.emeraldMuted, color: c.green },
  quizIndex: { alignSelf: 'start', padding: '1rem' },
  quizIndexHeading: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: '0.6rem',
    marginBottom: '0.85rem',
    color: c.muted,
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
    borderRadius: 8,
    backgroundColor: 'transparent',
    color: c.muted,
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
  },
  todoToggleAll: {
    flexShrink: 0,
    padding: '0.25rem 0.5rem',
    borderRadius: 999,
    backgroundColor: 'transparent',
    color: c.muted,
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
    border: `2px solid ${c.borderStrong}`,
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
    borderBottom: `1px solid ${c.border}`
  },
  taskLabel: {
    minWidth: 0,
    overflowWrap: 'break-word',
    color: c.text,
    fontSize: '0.88rem',
    lineHeight: 1.45,
    cursor: 'text'
  },
  taskDone: { color: c.muted, textDecorationLine: 'line-through' },
  taskDestroy: {
    flexShrink: 0,
    minHeight: 36,
    minWidth: 36,
    padding: '0.25rem',
    borderRadius: 8,
    backgroundColor: 'transparent',
    color: c.muted,
    fontSize: '1.1rem',
    lineHeight: 1,
    ':hover': { backgroundColor: c.red, color: 'white' }
  },
  dueText: {
    flexShrink: 0,
    padding: '0.15rem 0.55rem',
    border: `1px solid ${c.amberMuted}`,
    borderRadius: 100,
    backgroundColor: 'transparent',
    color: c.amber,
    fontFamily: 'monospace',
    fontSize: '0.62rem',
    whiteSpace: 'nowrap'
  },
  dueOverdue: { borderColor: c.redMuted, color: c.red },
  dueInput: {
    flexShrink: 0,
    width: '8.2rem',
    minHeight: 44,
    padding: '0.5rem',
    border: `1px solid ${c.borderStrong}`,
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
    color: c.muted,
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
    border: '1px solid transparent',
    borderRadius: 8,
    backgroundColor: 'transparent',
    color: c.text,
    fontSize: '0.74rem',
    ':hover': { backgroundColor: c.surfaceHover }
  },
  calSelected: {
    borderColor: c.amberMuted,
    backgroundColor: c.amberMuted
  },
  calToday: { color: c.amber, fontWeight: 800 },
  calDots: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    minHeight: 5
  },
  calDot: { width: 4, height: 4, borderRadius: '50%', backgroundColor: c.amber },
  calDotDone: { backgroundColor: c.emerald },
  calCount: { color: c.muted, fontFamily: 'monospace', fontSize: '0.6rem' },
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
  bandLast: { borderBottom: 0 }
});

const aliases = {
  shell: 'shell',
  topbar: 'topbar',
  'workspace-topbar': 'workspaceTopbar',
  'brand-mark': 'brandMark',
  'brand-name': 'brandName',
  'topbar-status': 'topbarStatus',
  'status-dot': 'statusDot',
  'back-button': 'backButton',
  'back-label': 'backLabel',
  'titlebar-name': 'titlebarName',
  'titlebar-dot': 'titlebarDot',
  'window-actions': 'windowActions',
  'close-button': 'closeButton',
  rail: 'rail',
  tab: 'tab',
  'tab-glyph': 'tabGlyph',
  'tab-label': 'tabLabel',
  'tab-dot': 'tabDot',
  'tools-panel': 'sidePanel',
  'quiz-panel': 'sidePanel',
  'tools-group-label': 'groupLabel',
  'tools-item': 'sideItem',
  'tools-item-glyph': 'sideGlyph',
  'tools-item-copy': 'sideCopy',
  'quiz-shell': 'quizShell',
  'quiz-layout': 'quizLayout',
  'map-page': 'mapPage',
  'map-layout': 'mapLayout',
  'map-panel': 'mapPanel',
  'map-panel-heading': 'mapPanelHeading',
  'map-panel-actions': 'mapPanelActions',
  'map-reset': 'mapReset',
  'map-count': 'mapCount',
  'map-toolbar': 'mapToolbar',
  'map-mode': 'mapMode',
  'map-mode-button': 'mapModeButton',
  'map-select-wrap': 'mapSelectWrap',
  'map-select': 'mapSelect',
  'map-canvas': 'mapCanvas',
  'map-leaflet': 'mapLeaflet',
  'map-overlay': 'mapOverlay',
  'map-overlay-kicker': 'mapOverlayKicker',
  'map-footer': 'mapFooter',
  'map-source-mark': 'mapSourceMark',
  'map-browser': 'mapBrowser',
  'map-browser-heading': 'mapBrowserHeading',
  'map-search-wrap': 'mapSearchWrap',
  'map-search': 'mapSearch',
  'map-list': 'mapList',
  'map-list-item': 'mapListItem',
  'map-list-color': 'mapListColor',
  'map-list-copy': 'mapListCopy',
  'map-list-chevron': 'mapListChevron',
  'map-empty': 'mapEmpty',
  'map-data-panel': 'mapDataPanel',
  'map-data-heading': 'mapDataHeading',
  'map-table-scroll': 'mapTableScroll',
  'map-table': 'mapTable',
  'map-table-head': 'mapTableHead',
  'map-table-cell': 'mapTableCell',
  'map-table-detail': 'mapTableDetail',
  'map-table-row': 'mapTableRow',
  'map-table-action': 'mapTableAction',
  'map-table-action-name': 'mapTableActionName',
  'map-table-empty': 'mapTableEmpty',
  'map-selection': 'mapSelection',
  'map-selection-type': 'mapSelectionType',
  'map-selection-name': 'mapSelectionName',
  'map-source': 'mapSource',
  'quiz-header': 'quizHeader',
  'quiz-score': 'quizScore',
  'quiz-collection-row': 'quizCollection',
  'quiz-editor-toolbar': 'quizToolbar',
  'quiz-editor-summary': 'quizSummary',
  'quiz-editor-list': 'quizEditorList',
  'quiz-editor-row': 'quizEditorRow',
  'quiz-editor-number': 'quizNumber',
  'quiz-select-wrap': 'sideCopy',
  'quiz-search': 'searchInput',
  'quiz-collection-mark': 'quizMark',
  'quiz-collection-copy': 'quizCopy',
  'quiz-reset-button': 'quizButton',
  'quiz-secondary-button': 'quizButton',
  'quiz-known-button': 'quizButton',
  'quiz-primary-button': 'quizButton',
  'quiz-reveal': 'quizButton',
  'quiz-progress': 'quizProgress',
  'quiz-progress-track': 'quizProgressTrack',
  'quiz-main-grid': 'quizGrid',
  'quiz-card': 'quizCard',
  'quiz-index-card': 'quizIndex',
  'quiz-card-topline': 'quizTopline',
  'quiz-difficulty': 'difficulty',
  'quiz-card-kicker': 'quizKicker',
  'quiz-answer': 'quizAnswer',
  'quiz-answer-label': 'quizAnswerLabel',
  'quiz-explanation': 'quizExplanation',
  'quiz-card-actions': 'quizActions',
  'quiz-question-list': 'quizQuestions',
  'quiz-question-row': 'quizQuestion',
  'quiz-empty': 'empty',
  'launcher-main': 'launcher',
  'launcher-head': 'toolHeading',
  'tool-list': 'toolList',
  'tool-row': 'toolRow',
  'row-glyph': 'rowGlyph',
  'row-copy': 'rowCopy',
  'row-chevron': 'rowChevron',
  'launcher-status': 'launcherStatus',
  'recent-strip': 'recent',
  chip: 'chip',
  error: 'error',
  'workspace-error': 'workspaceError',
  'workspace-body': 'workspaceBody',
  'tool-page': 'toolPage',
  eyebrow: 'eyebrow',
  lede: 'lede',
  'error-title': 'errorTitle',
  'tool-heading': 'toolHeading',
  'mock-badge': 'badge',
  'tool-panel': 'panel',
  'panel-heading': 'panelHeading',
  'panel-label': 'panelLabel',
  'panel-status': 'panelStatus',
  'select-label': 'selectLabel',
  select: 'select',
  'panel-note': 'note',
  'disk-grid': 'diskGrid',
  'volume-summary': 'summaryRow',
  'progress-track': 'bar',
  'primary-button': 'primary',
  'folder-list': 'folderList',
  'folder-copy': 'folderCopy',
  'storage-footer': 'footerRow',
  'notes-layout': 'notesLayout',
  'notes-list-panel': 'notesPanel',
  'note-editor': 'editor',
  'notes-list-heading': 'headingRow',
  'new-note-button': 'action',
  'export-button': 'action',
  'search-field': 'searchInput',
  'search-engine-note': 'searchEngineNote',
  'notes-list': 'notesList',
  'note-list-item': 'noteItem',
  'note-list-meta': 'noteMeta',
  'note-list-updated': 'noteUpdated',
  'empty-notes': 'empty',
  'note-editor-heading': 'headingRow',
  'note-saved': 'saved',
  'note-title-input': 'titleInput',
  'note-meta-row': 'metaRow',
  'note-body-input': 'bodyInput',
  'qna-field': 'qnaField',
  'qna-label': 'qnaLabel',
  'qna-input': 'qnaInput',
  'qna-question-input': 'qnaQuestionInput',
  'qna-answer-input': 'qnaAnswerInput',
  'qna-import': 'qnaImport',
  'qna-help': 'qnaHelp',
  'qna-import-input': 'qnaImportInput',
  'note-editor-footer': 'editorFooter',
  'text-button': 'textButton',
  'audio-console': 'audioConsole',
  'track-meta': 'trackMeta',
  'album-art': 'albumArt',
  'track-source': 'muted',
  'toggle-button': 'toggle',
  visualizer: 'visualizer',
  'transport-row': 'transport',
  'transport-track': 'transportTrack',
  bands: 'bands',
  band: 'band',
  'band-value': 'bandValue',
  'band-label': 'bandLabel',
  'master-row': 'master',
  'presets-panel': 'presets',
  'preset-list': 'presetList',
  'backend-status': 'backendStatus',
  'backend-status-label': 'backendLabel',
  'backend-status-value': 'backendValue',
  'backend-status-actions': 'backendActions',
  'backend-status-error': 'backendError',
  'toggle-all': 'todoToggleAll',
  'todo-list': 'todoList',
  'todo-checkbox': 'todoCheckbox',
  'todo-filters': 'todoFilters',
  'sr-only': 'srOnly'
};

export function sx(...classNames) {
  const values = classNames.flatMap((value) => {
    if (value && typeof value === 'object') return [value];
    return String(value || '')
      .split(/\s+/)
      .map((name) => {
        const camelName = name.replace(/-([a-z])/g, (_, letter) =>
          letter.toUpperCase()
        );
        return styles[aliases[name] || camelName];
      })
      .filter(Boolean);
  });
  return stylex.props(...values).className;
}

export function toneStyle(tone, variant = '') {
  if (tone === 'violet') tone = 'purple';
  if (variant === true) variant = 'mark';
  const suffix = variant ? variant[0].toUpperCase() + variant.slice(1) : '';
  const name = `${tone[0].toUpperCase()}${tone.slice(1)}${suffix}`;
  return styles[name] || styles.gold;
}
