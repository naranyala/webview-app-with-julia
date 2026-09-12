import * as stylex from '@stylexjs/stylex';
import { c } from './stylex-tokens.stylex.js';

export const foundationStyles = stylex.create({
  shell: {
    minHeight: '100dvh',
    paddingLeft: 64,
    backgroundColor: c.bg,
    color: c.text,
    fontSize: 15,
    lineHeight: 1.5,
    fontFamily: c.fontBody,
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
    backgroundColor: c.overlay,
    backdropFilter: 'blur(16px) saturate(1.4)'
  },
  workspaceTopbar: { gap: '0.5rem' },
  brandMark: {
    display: 'grid',
    placeItems: 'center',
    width: 30,
    height: 30,
    border: 0,
    borderRadius: 10,
    backgroundColor: c.accentMuted,
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
    color: c.textSecondary,
    fontSize: '0.62rem',
    fontWeight: 700,
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
    border: 0,
    borderRadius: 8,
    backgroundColor: 'transparent',
    color: c.textSecondary,
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
    border: 0,
    borderRadius: 7,
    backgroundColor: 'transparent',
    color: c.textSecondary,
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
    backgroundColor: c.overlay,
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
    border: 0,
    borderRadius: 10,
    backgroundColor: 'transparent',
    color: c.textSecondary,
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
    padding: '0.85rem 0.75rem',
    backgroundColor: c.surface,
    boxShadow: c.shadowSidebar,
    overflowY: 'auto',
    '@media (max-width: 719px)': {
      left: 0,
      bottom: 60,
      width: 'min(20rem, calc(100vw - 1rem))',
      padding: '0.7rem 0.75rem'
    }
  },
  groupLabel: {
    margin: '0 0 0.6rem 0.25rem',
    color: c.textSecondary,
    fontSize: '0.68rem',
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase'
  },
  sideNav: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    margin: '0 -0.75rem',
    padding: '0.35rem 0',
    borderTop: `1px solid ${c.border}`,
    borderBottom: `1px solid ${c.border}`
  },
  sideItem: {
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.7rem',
    padding: '0.65rem 1rem',
    borderRadius: 0,
    backgroundColor: 'transparent',
    color: c.text,
    textAlign: 'left',
    minHeight: 52,
    ':hover': { backgroundColor: c.surfaceHover }
  },
  sideItemActive: {
    backgroundColor: c.cyanMuted,
    boxShadow: `inset 3px 0 0 ${c.cyan}`
  },
  sideGlyph: {
    display: 'grid',
    placeItems: 'center',
    flex: '0 0 28px',
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: c.surfaceAlt,
    fontSize: '0.95rem',
    lineHeight: 1
  },
  sideCopy: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.15rem',
    minWidth: 0
  },
  sideCopyStrong: { fontSize: '0.85rem' },
  sideCopySmall: {
    color: c.textSecondary,
    fontSize: '0.72rem',
    lineHeight: 1.4
  },
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
    color: c.textSecondary,
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
    border: 0,
    borderRadius: 7,
    backgroundColor: 'transparent',
    color: c.textSecondary,
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
    backgroundImage: `linear-gradient(${c.gridLine} 1px, transparent 1px), linear-gradient(90deg, ${c.gridLine} 1px, transparent 1px)`,
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
    backgroundColor: c.overlay,
    color: c.textSecondary,
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
    color: c.textSecondary,
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
    border: 0,
    borderRadius: 8,
    backgroundColor: 'transparent',
    color: c.text,
    textAlign: 'left',
    ':hover': { backgroundColor: c.surfaceHover }
  },
  mapListItemActive: {
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
  mapListCopySmall: { color: c.textSecondary, fontSize: '0.64rem' },
  mapListChevron: {
    color: c.textSecondary,
    fontSize: '1.2rem',
    textAlign: 'right'
  },
  mapEmpty: { padding: '0.6rem', color: c.textSecondary, fontSize: '0.76rem' },
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
    color: c.textSecondary,
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
    color: c.textSecondary,
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
    border: 0,
    borderRadius: 6,
    backgroundColor: c.cyanMuted,
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
    color: c.textSecondary,
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
    color: c.textSecondary,
    fontSize: '0.68rem',
    lineHeight: 1.5
  },
  // ── Workspace shell (sidebar + content column) ──────────────────────────
  workspace: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    minHeight: '100dvh',
    backgroundColor: c.bg,
    color: c.text,
    fontSize: 15,
    lineHeight: 1.5,
    fontFamily: c.fontBody,
    '@media (min-width: 900px)': {
      gridTemplateColumns: '272px minmax(0, 1fr)',
      fontSize: 15.5
    }
  },
  sidebar: {
    position: 'fixed',
    top: 0,
    bottom: 0,
    left: 0,
    zIndex: 40,
    display: 'flex',
    flexDirection: 'column',
    gap: '1.1rem',
    width: 'min(18rem, calc(100vw - 2.5rem))',
    padding: '1.25rem 1rem',
    borderRight: `1px solid ${c.border}`,
    backgroundColor: c.sidebar,
    backgroundImage: c.sidebarBackground,
    overflowY: 'auto',
    transform: 'translateX(-102%)',
    transition: 'transform 180ms ease',
    '@media (min-width: 900px)': {
      position: 'sticky',
      top: 0,
      height: '100dvh',
      width: 'auto',
      transform: 'none'
    }
  },
  sidebarOpen: { transform: 'translateX(0)' },
  sidebarBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    padding: '0.15rem 0.25rem 0.3rem'
  },
  sidebarSearch: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    width: '100%',
    minHeight: 40,
    padding: '0.5rem 0.7rem',
    border: 0,
    borderRadius: 10,
    backgroundColor: c.surfaceAlt,
    color: c.textSecondary,
    fontSize: '0.8rem',
    textAlign: 'left',
    ':hover': { color: c.text, backgroundColor: c.surfaceHover },
    ':focus-visible': { boxShadow: `0 0 0 2px ${c.accent}` }
  },
  sidebarSearchKbd: {
    marginLeft: 'auto',
    padding: '0.1rem 0.4rem',
    border: 0,
    borderRadius: 5,
    backgroundColor: c.surfaceHover,
    color: c.textSecondary,
    fontFamily: c.fontMono,
    fontSize: '0.62rem'
  },
  sidebarNav: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  sidebarItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    width: '100%',
    minHeight: 44,
    padding: '0.5rem 0.6rem',
    border: 0,
    borderRadius: 10,
    backgroundColor: 'transparent',
    color: c.textSecondary,
    fontSize: '0.84rem',
    fontWeight: 600,
    textAlign: 'left',
    ':hover': { backgroundColor: c.sidebarHover, color: c.text },
    ':focus-visible': { boxShadow: `0 0 0 2px ${c.accent}` }
  },
  sidebarItemActive: {
    backgroundColor: c.accentMuted,
    boxShadow: `inset 3px 0 0 ${c.accent}`,
    color: c.text
  },
  sidebarItemGlyph: {
    display: 'grid',
    placeItems: 'center',
    flex: '0 0 30px',
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: c.surfaceAlt,
    fontSize: '0.95rem',
    lineHeight: 1
  },
  sidebarDot: {
    width: 6,
    height: 6,
    marginLeft: 'auto',
    borderRadius: '50%',
    backgroundColor: c.accent,
    flexShrink: 0
  },
  sidebarSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    padding: '0.8rem 0.6rem',
    border: 0,
    borderRadius: 14,
    backgroundColor: c.surface,
    boxShadow: c.shadowPanel
  },
  sidebarFooter: {
    marginTop: 'auto',
    paddingTop: '0.8rem',
    borderTop: `1px solid ${c.border}`
  },
  mainColumn: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  contentTopbar: {
    position: 'sticky',
    top: 0,
    zIndex: 30,
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    minHeight: 64,
    padding: '0.5rem 1.25rem',
    borderBottom: `1px solid ${c.border}`,
    backgroundColor: c.overlay,
    backdropFilter: 'blur(16px) saturate(1.4)'
  },
  menuButton: {
    display: 'grid',
    placeItems: 'center',
    width: 40,
    height: 40,
    border: 0,
    borderRadius: 9,
    backgroundColor: 'transparent',
    color: c.text,
    fontSize: '1.1rem',
    ':hover': { backgroundColor: c.surfaceHover },
    '@media (min-width: 900px)': { display: 'none' }
  },
  themeToggle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    minHeight: 36,
    padding: '0.4rem 0.65rem',
    border: 0,
    borderRadius: 9,
    backgroundColor: c.surfaceAlt,
    color: c.textSecondary,
    fontSize: '0.7rem',
    fontWeight: 700,
    ':hover': { backgroundColor: c.accentMuted, color: c.text },
    ':focus-visible': { boxShadow: `0 0 0 2px ${c.accent}` }
  },
  themeToggleIcon: { fontSize: '1rem', lineHeight: 1 },
  themeToggleLabel: {
    '@media (max-width: 560px)': { display: 'none' }
  },
  contentTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.55rem',
    minWidth: 0,
    flex: 1,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    fontSize: '0.95rem',
    fontWeight: 700
  },
  contentBody: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
    padding: '1.25rem 1rem 3rem',
    '@media (min-width: 720px)': { padding: '2rem 2rem 4rem' },
    '@media (min-width: 1280px)': { padding: '2.5rem 3.5rem 5rem' }
  },
  scrim: {
    position: 'fixed',
    inset: 0,
    zIndex: 35,
    border: 0,
    backgroundColor: c.scrim,
    '@media (min-width: 900px)': { display: 'none' }
  }
});
