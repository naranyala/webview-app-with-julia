import { useEffect, useMemo, useState } from 'preact/hooks';
import { flushRegisteredAutosaves } from './autosave.mjs';
import { backend, backendError } from './backend.js';
import { BackendStatus } from './backend-status.jsx';
import { CommandPalette } from './command-palette.jsx';
import { frontendPlugins, getFrontendPlugin } from './plugins/index.js';
import { INDONESIA_PROVINCES } from './plugins/indonesia-map-data.js';
import { styles, sx, toneStyle } from './stylex-styles.js';

const TAB_SHORT = {
  disk: 'Samples',
  equalizer: 'EQ',
  tabs: 'Tabs',
  paper: 'Papers',
  mir: 'MIR',
  map: 'Map'
};

const TAB_GLYPH = {
  disk: '◉',
  equalizer: '♪',
  tabs: '⊟',
  paper: '§',
  mir: '∿',
  map: '◎'
};

// Plugin ids grouped under the Tools submenu instead of the primary rail.
const TOOL_IDS = ['disk', 'equalizer'];
const TOOLS_GLYPH = '▤';

export function App() {
  const [activeApp, setActiveApp] = useState(null);
  const [openedApps, setOpenedApps] = useState([]);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [paperOpen, setPaperOpen] = useState(false);
  const [paperMode, setPaperMode] = useState('read');
  const [mapOpen, setMapOpen] = useState(false);
  const [mapMode, setMapMode] = useState('province');
  const [mapProvince, setMapProvince] = useState('');
  const [windowActionPending, setWindowActionPending] = useState(false);
  const [navigationPending, setNavigationPending] = useState(false);
  const [windowError, setWindowError] = useState('');
  const [windowMaximized, setWindowMaximized] = useState(false);
  const [isNative] = useState(() => backend.isNative());
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    function onGlobalKey(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    if (typeof window !== 'undefined')
      window.addEventListener('keydown', onGlobalKey);
    return () => {
      if (typeof window !== 'undefined')
        window.removeEventListener('keydown', onGlobalKey);
    };
  }, []);

  const openedWorkspaces = useMemo(
    () => frontendPlugins.filter((plugin) => openedApps.includes(plugin.id)),
    [openedApps]
  );
  const primaryPlugins = useMemo(
    () => frontendPlugins.filter((plugin) => !TOOL_IDS.includes(plugin.id)),
    []
  );
  const toolPlugins = useMemo(
    () => frontendPlugins.filter((plugin) => TOOL_IDS.includes(plugin.id)),
    []
  );
  const currentApp = getFrontendPlugin(activeApp);
  const ActivePlugin = currentApp?.component;
  const activeIsTool = activeApp !== null && TOOL_IDS.includes(activeApp);

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
    setOpenedApps((current) =>
      current.includes(appId) ? current : [...current, appId]
    );
    setActiveApp(appId);
    setToolsOpen(TOOL_IDS.includes(appId));
    setPaperOpen(appId === 'paper');
    setMapOpen(appId === 'map');
    if (typeof document !== 'undefined') {
      const plugin = getFrontendPlugin(appId);
      document.title = plugin ? `${plugin.title} - WebView App` : 'WebView App';
      window.scrollTo?.(0, 0);
    }
    setNavigationPending(false);
  }

  async function goHome() {
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
    setActiveApp(null);
    setToolsOpen(false);
    setPaperOpen(false);
    setMapOpen(false);
    if (typeof document !== 'undefined') {
      document.title = 'WebView App';
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

  const rail = (
    <nav className={sx('rail')} aria-label="Primary">
      <button
        type="button"
        className={sx('tab', activeApp === null && styles.tabActive)}
        onClick={goHome}
        aria-current={activeApp === null ? 'page' : undefined}
        title="Home"
      >
        <span className={sx('tab-glyph')} aria-hidden="true">
          ⌂
        </span>
        <span className={sx('tab-label')}>Home</span>
      </button>
      {primaryPlugins.map((app) => (
        <button
          type="button"
          key={app.id}
          className={sx(
            'tab',
            activeApp === app.id && styles.tabActive,
            toneStyle(app.tone)
          )}
          onClick={() => {
            if (app.id === 'map') {
              if (activeApp !== 'map') {
                selectApp(app.id);
                setMapMode('province');
                setMapProvince('');
                setMapOpen(true);
                return;
              }
              setMapOpen((open) => !open);
              return;
            }
            if (app.id === 'paper') {
              if (activeApp !== 'paper') {
                selectApp(app.id);
                setPaperMode('read');
                setPaperOpen(true);
                return;
              }
              setPaperMode('read');
              setPaperOpen((open) => !open);
              return;
            }
            selectApp(app.id);
          }}
          aria-current={activeApp === app.id ? 'page' : undefined}
          aria-expanded={
            app.id === 'map'
              ? mapOpen
              : app.id === 'paper'
                ? paperOpen
                : undefined
          }
          aria-controls={
            app.id === 'map'
              ? 'map-panel'
              : app.id === 'paper'
                ? 'paper-panel'
                : undefined
          }
          title={app.title}
        >
          <span className={sx('tab-glyph')} aria-hidden="true">
            {TAB_GLYPH[app.id] ?? '•'}
          </span>
          <span className={sx('tab-label')}>
            {TAB_SHORT[app.id] ?? app.title}
          </span>
          {openedApps.includes(app.id) && (
            <span
              className={sx('tab-dot', toneStyle(app.tone, 'dot'))}
              aria-hidden="true"
            />
          )}
        </button>
      ))}
      <button
        type="button"
        className={sx('tab', activeIsTool && styles.tabActive)}
        onClick={() => {
          setPaperOpen(false);
          setMapOpen(false);
          setToolsOpen((open) => !open);
        }}
        aria-expanded={toolsOpen}
        aria-controls="tools-panel"
        title="Tools"
      >
        <span className={sx('tab-glyph')} aria-hidden="true">
          {TOOLS_GLYPH}
        </span>
        <span className={sx('tab-label')}>Tools</span>
        {toolPlugins.some((app) => openedApps.includes(app.id)) && (
          <span className={sx('tab-dot')} aria-hidden="true" />
        )}
      </button>
    </nav>
  );

  const toolsPanel = toolsOpen && (
    <aside
      className={sx('tools-panel')}
      id="tools-panel"
      aria-label="Tools submenu"
    >
      <p className={sx('tools-group-label')}>Tools</p>
      <nav className={sx('sideNav')} aria-label="Tool plugins">
        {toolPlugins.map((app) => (
          <button
            type="button"
            key={app.id}
            className={sx(
              'tools-item',
              activeApp === app.id && styles.sideItemActive
            )}
            onClick={() => selectApp(app.id)}
            aria-current={activeApp === app.id ? 'page' : undefined}
          >
            <span
              className={sx('tools-item-glyph', toneStyle(app.tone))}
              aria-hidden="true"
            >
              {TAB_GLYPH[app.id] ?? '•'}
            </span>
            <span className={sx('tools-item-copy')}>
              <strong className={sx('sideCopyStrong')}>{app.title}</strong>
              <small className={sx('sideCopySmall')}>{app.description}</small>
            </span>
            {openedApps.includes(app.id) && (
              <span
                className={sx('tab-dot', toneStyle(app.tone, 'dot'))}
                aria-hidden="true"
              />
            )}
          </button>
        ))}
      </nav>
    </aside>
  );

  const paperDestinations = [
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

  const paperPanel = paperOpen && (
    <aside
      className={sx('quiz-panel')}
      id="paper-panel"
      aria-label="Paper submenu"
    >
      <p className={sx('tools-group-label')}>Paper</p>
      <nav className={sx('sideNav')} aria-label="Paper destinations">
        {paperDestinations.map((destination) => (
          <button
            type="button"
            key={destination.mode}
            className={sx(
              'tools-item',
              paperMode === destination.mode && styles.sideItemActive
            )}
            onClick={() => {
              selectApp('paper');
              setPaperMode(destination.mode);
            }}
            aria-current={paperMode === destination.mode ? 'page' : undefined}
          >
            <span
              className={sx('tools-item-glyph', styles.greenMark)}
              aria-hidden="true"
            >
              {destination.glyph}
            </span>
            <span className={sx('tools-item-copy')}>
              <strong className={sx('sideCopyStrong')}>
                {destination.title}
              </strong>
              <small className={sx('sideCopySmall')}>
                {destination.description}
              </small>
            </span>
          </button>
        ))}
      </nav>
    </aside>
  );

  const mapPanel = mapOpen && (
    <aside
      className={sx('tools-panel')}
      id="map-panel"
      aria-label="Indonesia map submenu"
    >
      <p className={sx('tools-group-label')}>Indonesia Map</p>
      <nav className={sx('sideNav')} aria-label="Map levels">
        <button
          type="button"
          className={sx(
            'tools-item',
            mapMode === 'province' && styles.sideItemActive
          )}
          onClick={() => {
            setMapMode('province');
            setMapProvince('');
          }}
          aria-current={mapMode === 'province' ? 'page' : undefined}
        >
          <span
            className={sx('tools-item-glyph', styles.blueMark)}
            aria-hidden="true"
          >
            ◎
          </span>
          <span className={sx('tools-item-copy')}>
            <strong className={sx('sideCopyStrong')}>Province overview</strong>
            <small className={sx('sideCopySmall')}>
              Compare all 38 provinces on one map.
            </small>
          </span>
        </button>
        <button
          type="button"
          className={sx(
            'tools-item',
            mapMode === 'district' && styles.sideItemActive
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
            className={sx('tools-item-glyph', styles.blueMark)}
            aria-hidden="true"
          >
            ◌
          </span>
          <span className={sx('tools-item-copy')}>
            <strong className={sx('sideCopyStrong')}>Kabupaten / Kota</strong>
            <small className={sx('sideCopySmall')}>
              Focus a province, then choose its local area.
            </small>
          </span>
        </button>
      </nav>
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
      <p className={sx('panel-note')}>
        The map is bundled locally, so the boundary browser also works offline.
      </p>
    </aside>
  );

  if (activeApp === null) {
    return (
      <div className={sx('shell')}>
        <header className={sx('topbar')}>
          <span className={sx('brand-mark')}>WV</span>
          <span className={sx('brand-name')}>WebView</span>
          <span className={sx('topbar-status')}>
            <span className={sx('status-dot')} aria-hidden="true" />
            <span>{isNative ? 'Native' : 'Mock'}</span>
          </span>
        </header>

        <main className={sx('launcher-main')}>
          <div>
            <p className={sx('eyebrow')}>Toolkit</p>
            <h1 className={sx('launcherTitle')}>Tools</h1>
            <p className={sx('lede')}>
              {frontendPlugins.length} small utilities. Pick one to start.
            </p>
          </div>

          {windowError && (
            <p className={sx('error')} role="alert">
              {windowError}
            </p>
          )}

          {paletteOpen && (
            <CommandPalette
              plugins={frontendPlugins}
              glyphFor={(id) => TAB_GLYPH[id] ?? '•'}
              onSelect={(id) => {
                setPaletteOpen(false);
                selectApp(id);
              }}
              onClose={() => setPaletteOpen(false)}
            />
          )}

          <nav className={sx('tool-list')} aria-label="Available tools">
            {frontendPlugins.map((app) => (
              <button
                type="button"
                key={app.id}
                className={sx('tool-row')}
                onClick={() => selectApp(app.id)}
              >
                <span
                  className={sx('row-glyph', toneStyle(app.tone))}
                  aria-hidden="true"
                >
                  {TAB_GLYPH[app.id] ?? '•'}
                </span>
                <span className={sx('row-copy')}>
                  <strong className={sx('rowCopyStrong')}>{app.title}</strong>
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

          <div className={sx('launcher-status')}>
            <BackendStatus compact />
          </div>
        </main>

        {rail}
        {toolsPanel}
        {paperPanel}
        {mapPanel}
      </div>
    );
  }

  return (
    <div className={sx('shell')}>
      <header className={sx('topbar', 'workspace-topbar')}>
        <button
          type="button"
          className={sx('back-button')}
          onClick={goHome}
          aria-label="Back to tools"
        >
          <span aria-hidden="true">‹</span>
          <span className={sx('back-label')}>Tools</span>
        </button>
        <div className={sx('titlebar-name')}>
          <span
            className={sx('titlebar-dot', toneStyle(currentApp.tone, 'dot'))}
            aria-hidden="true"
          />
          <strong className={sx('titlebarStrong')}>{currentApp.title}</strong>
        </div>
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

      {openedWorkspaces.length > 1 && (
        <section className={sx('recent-strip')} aria-label="Recently opened">
          {openedWorkspaces
            .filter((app) => app.id !== activeApp)
            .map((app) => (
              <button
                type="button"
                key={app.id}
                className={sx('chip')}
                onClick={() => selectApp(app.id)}
              >
                {TAB_SHORT[app.id] ?? app.title}
              </button>
            ))}
        </section>
      )}

      <main className={sx('workspace-body')}>
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
          onProvinceChange={activeApp === 'map' ? setMapProvince : undefined}
        />
      </main>

      {rail}
      {toolsPanel}
      {paperPanel}
      {mapPanel}
    </div>
  );
}
