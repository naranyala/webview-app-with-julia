import { useEffect, useMemo, useState } from 'preact/hooks';
import { flushRegisteredAutosaves } from './autosave.mjs';
import { backend, backendError } from './backend.js';
import { BackendStatus } from './backend-status.jsx';
import { CommandPalette } from './command-palette.jsx';
import { frontendPlugins, getFrontendPlugin } from './plugins/index.js';
import { INDONESIA_PROVINCES } from './plugins/indonesia-map-data.js';
import { styles, sx, toneStyle } from './stylex-styles.js';

// Workbench shell: a persistent left sidebar owns navigation and the main
// column gives each tool a predictable, spacious canvas.

const GLYPH = {
  disk: '◉',
  equalizer: '♪',
  tabs: '⊟',
  paper: '§',
  mir: '∿',
  map: '◎',
  notes: '✎',
  quiz: '◈',
  blender: '⬢',
  todo: '✓'
};

const GROUPS = [
  { label: 'Workspace', ids: ['notes', 'todo', 'quiz'] },
  { label: 'Library', ids: ['paper', 'tabs'] },
  { label: 'Studio', ids: ['disk', 'equalizer', 'mir', 'blender'] },
  { label: 'Places', ids: ['map'] }
];

function glyphFor(id) {
  return GLYPH[id] ?? '•';
}

const PAPER_DESTINATIONS = [
  {
    mode: 'read',
    glyph: '▶',
    title: 'Reader',
    description: 'Two-column reading with section navigation.'
  },
  {
    mode: 'references',
    glyph: '≡',
    title: 'Reference Manager',
    description: 'Track citations and export BibTeX.'
  },
  {
    mode: 'images',
    glyph: '◫',
    title: 'Image Assets',
    description: 'Manage figures embedded in the paper.'
  }
];

const THEME_STORAGE_KEY = 'webview-workbench-theme';

function getInitialTheme() {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Native WebViews can expose an opaque origin where localStorage throws.
  }
  return window.matchMedia?.('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
}

export function App() {
  const [theme, setTheme] = useState(getInitialTheme);
  const [activeApp, setActiveApp] = useState(null);
  const [openedApps, setOpenedApps] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paperMode, setPaperMode] = useState('read');
  const [mapMode, setMapMode] = useState('province');
  const [mapProvince, setMapProvince] = useState('');
  const [windowActionPending, setWindowActionPending] = useState(false);
  const [navigationPending, setNavigationPending] = useState(false);
  const [windowError, setWindowError] = useState('');
  const [windowMaximized, setWindowMaximized] = useState(false);
  const [isNative] = useState(() => backend.isNative());
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', theme === 'light' ? '#f4f1ea' : '#111318');
    }
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Keep the current mode working even when persistence is unavailable.
    }
  }, [theme]);

  useEffect(() => {
    function onGlobalKey(event) {
      if (event.key === 'Escape') {
        setSidebarOpen(false);
        setPaletteOpen(false);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    if (typeof window !== 'undefined')
      window.addEventListener('keydown', onGlobalKey);
    if (typeof document !== 'undefined') {
      const plugin = getFrontendPlugin(activeApp);
      document.title = plugin
        ? `${plugin.title} - WebView Workbench`
        : 'WebView Workbench';
    }
    return () => {
      if (typeof window !== 'undefined')
        window.removeEventListener('keydown', onGlobalKey);
    };
  }, [activeApp]);

  const pluginById = useMemo(() => {
    const map = new Map();
    for (const plugin of frontendPlugins) map.set(plugin.id, plugin);
    return map;
  }, []);
  const currentApp = activeApp === null ? null : getFrontendPlugin(activeApp);
  const ActivePlugin = currentApp?.component;

  async function flushWorkspaces() {
    const saved = await flushRegisteredAutosaves();
    if (!saved) {
      throw new Error(
        'A workspace save failed — retry from the tool, then navigate again.'
      );
    }
  }

  async function selectApp(appId) {
    if (windowActionPending || navigationPending) return;
    setNavigationPending(true);
    setWindowError('');
    try {
      await flushWorkspaces();
    } catch (error) {
      setWindowError(`Save failed: ${backendError(error)}`);
      setNavigationPending(false);
      return;
    }
    if (appId !== null) {
      setOpenedApps((current) =>
        current.includes(appId) ? current : [...current, appId]
      );
    }
    setActiveApp(appId);
    setSidebarOpen(false);
    if (typeof document !== 'undefined') {
      const plugin = appId === null ? null : getFrontendPlugin(appId);
      document.title = plugin
        ? `${plugin.title} - WebView Workbench`
        : 'WebView Workbench';
      window.scrollTo?.(0, 0);
    }
    setNavigationPending(false);
  }

  async function runWindowAction(fn, onDone) {
    if (windowActionPending || navigationPending) return;
    setWindowActionPending(true);
    setWindowError('');
    try {
      await fn();
      onDone?.();
    } catch (error) {
      setWindowError(backendError(error));
    } finally {
      setWindowActionPending(false);
    }
  }

  const minimizeWindow = () => runWindowAction(() => backend.minimizeWindow());
  const toggleMaximize = () =>
    runWindowAction(
      () =>
        windowMaximized ? backend.restoreWindow() : backend.maximizeWindow(),
      () => setWindowMaximized((value) => !value)
    );
  const closeWindow = () =>
    runWindowAction(async () => {
      await flushWorkspaces();
      await backend.closeWindow();
    });

  const sidebar = (
    <aside
      className={sx('sidebar', sidebarOpen && styles.sidebarOpen)}
      aria-label="Workspace"
    >
      <div className={sx('sidebar-brand')}>
        <span className={sx('brand-mark')}>WV</span>
        <span className={sx('brand-name')}>Workbench</span>
        <span className={sx('topbar-status')}>
          <span className={sx('status-dot')} aria-hidden="true" />
          <span>{isNative ? 'Native' : 'Mock'}</span>
        </span>
      </div>

      <button
        type="button"
        className={sx('sidebar-search')}
        onClick={() => setPaletteOpen(true)}
        aria-label="Search tools"
      >
        <span aria-hidden="true">⌕</span>
        <span>Search…</span>
        <kbd className={sx('sidebar-search-kbd')}>Ctrl K</kbd>
      </button>

      <nav className={sx('sidebar-nav')} aria-label="Tools">
        <div>
          <p className={sx('tools-group-label')}>Start</p>
          <button
            type="button"
            className={sx(
              'sidebar-item',
              activeApp === null && styles.sidebarItemActive
            )}
            onClick={() => selectApp(null)}
            aria-current={activeApp === null ? 'page' : undefined}
            title="Open workbench home"
          >
            <span className={sx('sidebar-item-glyph')} aria-hidden="true">
              ⌂
            </span>
            <span>All tools</span>
          </button>
        </div>
        {GROUPS.map((group) => (
          <div key={group.label}>
            <p className={sx('tools-group-label')}>{group.label}</p>
            {group.ids.map((id) => {
              const app = pluginById.get(id);
              if (!app) return null;
              const active = activeApp === id;
              return (
                <button
                  type="button"
                  key={id}
                  className={sx(
                    'sidebar-item',
                    active && styles.sidebarItemActive
                  )}
                  onClick={() => {
                    if (id === 'map' && activeApp !== 'map') {
                      setMapMode('province');
                      setMapProvince('');
                    }
                    if (id === 'paper' && activeApp !== 'paper') {
                      setPaperMode('read');
                    }
                    selectApp(id);
                  }}
                  aria-current={active ? 'page' : undefined}
                  title={app.description}
                >
                  <span
                    className={sx('sidebar-item-glyph', toneStyle(app.tone))}
                    aria-hidden="true"
                  >
                    {glyphFor(id)}
                  </span>
                  <span>{app.title}</span>
                  {openedApps.includes(id) && !active && (
                    <span className={sx('sidebar-dot')} aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        ))}

        {activeApp === 'paper' && (
          <section
            className={sx('sidebar-section')}
            aria-label="Paper sections"
          >
            <p className={sx('tools-group-label')}>Paper</p>
            {PAPER_DESTINATIONS.map((destination) => (
              <button
                type="button"
                key={destination.mode}
                className={sx(
                  'sidebar-item',
                  paperMode === destination.mode && styles.sidebarItemActive
                )}
                onClick={() => {
                  selectApp('paper');
                  setPaperMode(destination.mode);
                }}
                aria-current={
                  paperMode === destination.mode ? 'page' : undefined
                }
                title={destination.description}
              >
                <span
                  className={sx('sidebar-item-glyph', styles.greenMark)}
                  aria-hidden="true"
                >
                  {destination.glyph}
                </span>
                <span>{destination.title}</span>
              </button>
            ))}
          </section>
        )}

        {activeApp === 'map' && (
          <section className={sx('sidebar-section')} aria-label="Map levels">
            <p className={sx('tools-group-label')}>Indonesia Map</p>
            <button
              type="button"
              className={sx(
                'sidebar-item',
                mapMode === 'province' && styles.sidebarItemActive
              )}
              onClick={() => {
                setMapMode('province');
                setMapProvince('');
              }}
              aria-current={mapMode === 'province' ? 'page' : undefined}
            >
              <span
                className={sx('sidebar-item-glyph', styles.blueMark)}
                aria-hidden="true"
              >
                ◎
              </span>
              <span>Province overview</span>
            </button>
            <button
              type="button"
              className={sx(
                'sidebar-item',
                mapMode === 'district' && styles.sidebarItemActive
              )}
              onClick={() => {
                setMapMode('district');
                setMapProvince(
                  (current) => current || INDONESIA_PROVINCES[0]?.name || ''
                );
              }}
              aria-current={mapMode === 'district' ? 'page' : undefined}
            >
              <span
                className={sx('sidebar-item-glyph', styles.blueMark)}
                aria-hidden="true"
              >
                ◌
              </span>
              <span>Kabupaten / Kota</span>
            </button>
            <label className={sx('select-label')} htmlFor="map-province-select">
              Focus province
            </label>
            <select
              id="map-province-select"
              className={sx('select')}
              value={mapProvince}
              onChange={(event) => setMapProvince(event.currentTarget.value)}
            >
              <option value="">All provinces</option>
              {INDONESIA_PROVINCES.map((province) => (
                <option key={province.name} value={province.name}>
                  {province.name}
                </option>
              ))}
            </select>
          </section>
        )}
      </nav>

      <div className={sx('sidebar-footer')}>
        <BackendStatus compact hideCounter />
      </div>
    </aside>
  );

  return (
    <div className={sx('workspace')}>
      {sidebar}
      {sidebarOpen && (
        <button
          type="button"
          className={sx('scrim')}
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      )}

      <div className={sx('main-column')}>
        <header className={sx('content-topbar')}>
          <button
            type="button"
            className={sx('menu-button')}
            onClick={() => setSidebarOpen((open) => !open)}
            aria-label="Toggle sidebar"
            aria-expanded={sidebarOpen}
          >
            ☰
          </button>
          <div className={sx('content-title')}>
            <span
              className={sx(
                'titlebar-dot',
                currentApp ? toneStyle(currentApp.tone, 'dot') : styles.gold
              )}
              aria-hidden="true"
            />
            <strong className={sx('titlebarStrong')}>
              {currentApp ? currentApp.title : 'All tools'}
            </strong>
          </div>
          <button
            type="button"
            className={sx('theme-toggle')}
            onClick={() =>
              setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
            }
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            <span className={sx('theme-toggle-icon')} aria-hidden="true">
              {theme === 'dark' ? '☼' : '☾'}
            </span>
            <span className={sx('theme-toggle-label')}>
              {theme === 'dark' ? 'Light' : 'Dark'}
            </span>
          </button>
          {isNative ? (
            <div className={sx('window-actions')}>
              <button
                type="button"
                className={sx('windowAction')}
                onClick={minimizeWindow}
                disabled={windowActionPending}
                aria-label="Minimize window"
              >
                –
              </button>
              <button
                type="button"
                className={sx('windowAction')}
                onClick={toggleMaximize}
                disabled={windowActionPending}
                aria-label={
                  windowMaximized ? 'Restore window' : 'Maximize window'
                }
              >
                {windowMaximized ? '❐' : '□'}
              </button>
              <button
                type="button"
                className={sx('windowAction', 'close-button')}
                onClick={closeWindow}
                disabled={windowActionPending}
                aria-label="Close window"
              >
                ×
              </button>
            </div>
          ) : (
            <span className={sx('topbar-status')}>
              <span className={sx('status-dot')} aria-hidden="true" />
              <span>Mock</span>
            </span>
          )}
        </header>

        {windowError && (
          <p className={sx('error', 'workspace-error')} role="alert">
            {windowError}
          </p>
        )}

        {paletteOpen && (
          <CommandPalette
            plugins={frontendPlugins}
            glyphFor={glyphFor}
            onSelect={(id) => {
              setPaletteOpen(false);
              selectApp(id);
            }}
            onClose={() => setPaletteOpen(false)}
          />
        )}

        <main className={sx('content-body')}>
          {currentApp && ActivePlugin ? (
            <ActivePlugin
              mode={
                activeApp === 'map'
                  ? mapMode
                  : activeApp === 'paper'
                    ? paperMode
                    : undefined
              }
              selectedProvince={activeApp === 'map' ? mapProvince : undefined}
              onModeChange={activeApp === 'map' ? setMapMode : undefined}
              onProvinceChange={
                activeApp === 'map' ? setMapProvince : undefined
              }
            />
          ) : (
            <section className={sx('home-page')}>
              <div className={sx('home-hero')}>
                <div className={sx('home-hero-copy')}>
                  <p className={sx('eyebrow')}>WebView Workbench</p>
                  <h1 className={sx('home-title')}>
                    Make room for focused work.
                  </h1>
                  <p className={sx('lede')}>
                    A local-first collection of tools for notes, research,
                    media, maps, and daily planning.
                  </p>
                </div>
                <div className={sx('home-mark')} aria-hidden="true">
                  <span className={sx('home-mark-span')}>WV</span>
                  <small className={sx('home-mark-small')}>
                    LOCAL
                    <br />
                    FIRST
                  </small>
                </div>
              </div>

              <div className={sx('home-toolbar')}>
                <div>
                  <p className={sx('eyebrow')}>Your toolbox</p>
                  <h2 className={sx('home-section-title')}>
                    Choose a workspace
                  </h2>
                </div>
                <span className={sx('home-count')}>
                  {frontendPlugins.length} tools · {GROUPS.length} spaces
                </span>
              </div>

              <nav className={sx('tool-list')} aria-label="Available tools">
                {frontendPlugins.map((app) => (
                  <button
                    type="button"
                    key={app.id}
                    className={sx('tool-row')}
                    onClick={() => selectApp(app.id)}
                  >
                    <span className={sx('row-topline')}>
                      <span
                        className={sx('row-glyph', toneStyle(app.tone))}
                        aria-hidden="true"
                      >
                        {glyphFor(app.id)}
                      </span>
                      <span className={sx('row-symbol')}>{app.symbol}</span>
                    </span>
                    <span className={sx('row-copy')}>
                      <strong className={sx('rowCopyStrong')}>
                        {app.title}
                      </strong>
                      <small className={sx('rowCopySmall')}>
                        {app.description}
                      </small>
                    </span>
                    <span
                      className={sx('row-chevron', toneStyle(app.tone))}
                      aria-hidden="true"
                    >
                      ›
                    </span>
                  </button>
                ))}
              </nav>

              <div className={sx('home-footer')}>
                <span>
                  Everything stays on this device unless you export it.
                </span>
                <span className={sx('home-shortcut')}>
                  Ctrl K <span>to jump anywhere</span>
                </span>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
