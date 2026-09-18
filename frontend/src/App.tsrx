import { useEffect, useState } from 'octane';
import './App.css';
import { appBackend } from './backend.js';
import { WritingWorkspace } from './WritingWorkspace.tsrx';
import { MusicWorkspace } from './MusicWorkspace.tsrx';
import { DirectSearch } from './DirectSearch.tsrx';
import { MediaWorkspace } from './MediaWorkspace.tsrx';
import {
  IconWriting,
  IconMusic,
  IconResearch,
  IconMedia,
  IconSettings,
} from './utils.js';
import { message } from './utils.js';

const WORKSPACES = [
  {
    id: 'writing',
    title: 'Writing',
    icon: IconWriting,
    tools: [
      { id: 'notes', label: 'Notes', desc: 'Capture and shape ideas.' },
      { id: 'paper', label: 'Paper desk', desc: 'Draft, save, and export papers.' },
      { id: 'references', label: 'References', desc: 'Parse BibTeX and add citations.' },
    ],
  },
  {
    id: 'music',
    title: 'Analyze music',
    icon: IconMusic,
    tools: [
      { id: 'mir', label: 'MIR lab', desc: 'Measure loudness, peak, and brightness.' },
    ],
  },
  {
    id: 'research',
    title: 'Research',
    icon: IconResearch,
    tools: [
      { id: 'direct-search', label: 'Direct web search', desc: 'Search scholarly sources.' },
    ],
  },
  {
    id: 'media',
    title: 'Media',
    icon: IconMedia,
    tools: [
      { id: 'files', label: 'File browser', desc: 'Browse directory contents.' },
      { id: 'inspect', label: 'Media inspector', desc: 'Check media file properties.' },
      { id: 'scan', label: 'Disk scanner', desc: 'Scan for media assets.' },
      { id: 'gallery', label: 'Image gallery', desc: 'Browse and preview images.' },
    ],
  },
];

function WelcomeScreen() {
  return (
    <div class="welcome">
      <div class="welcome-header">
        <p class="welcome-eyebrow">WebView Workbench</p>
        <h1 class="welcome-title">Choose your focus.</h1>
        <p class="welcome-subtitle">
          Select a workspace from the sidebar to get started. Each workspace
          contains focused tools for a specific domain.
        </p>
      </div>

      <nav class="workspace-grid" aria-label="Workspaces">
        {WORKSPACES.map((ws) => {
          const Icon = ws.icon;
          return (
            <div class={`workspace-card workspace-card--${ws.id}`} key={ws.id}>
              <div class="workspace-card-icon">
                <Icon size="1.25rem" />
              </div>
              <div class="workspace-card-title">{ws.title}</div>
              <div class="workspace-card-desc">
                {ws.tools.map((t) => t.label).join(', ')}
              </div>
            </div>
          );
        })}
      </nav>
    </div>
  );
}

function SettingsPanel() {
  const [settings, setSettings] = useState({ ui: { theme: 'system', fontSize: 14 } });
  const [diagnostics, setDiagnostics] = useState([]);
  const [status, setStatus] = useState('Loading settings...');

  useEffect(() => {
    Promise.all([appBackend.getSettings(), appBackend.getDiagnostics(20)])
      .then(([loaded, logs]) => {
        setSettings(loaded || settings);
        setDiagnostics(Array.isArray(logs?.entries) ? logs.entries : []);
        setStatus('Settings loaded.');
      })
      .catch((error) => setStatus(message(error)));
  }, []);

  async function save() {
    try {
      await appBackend.saveSettings({ ui: settings.ui });
      setStatus('Settings saved.');
    } catch (error) {
      setStatus(message(error));
    }
  }

  async function clearDiagnostics() {
    try {
      await appBackend.clearDiagnostics();
      setDiagnostics([]);
      setStatus('Diagnostics cleared.');
    } catch (error) {
      setStatus(message(error));
    }
  }

  return (
    <div class="panel">
      <div class="panel-header"><div class="panel-header-title">Settings</div></div>
      <div class="panel-body">
        <div class="card" style={{ marginBottom: 'var(--space-6)' }}>
          <div class="card-header"><div class="card-title">Interface</div></div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Theme</label><select class="form-input" value={settings.ui?.theme || 'system'} onChange={(e) => setSettings((current) => ({ ...current, ui: { ...current.ui, theme: e.currentTarget.value } }))}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></div>
            <div class="form-group"><label class="form-label">Font size</label><input class="form-input" type="number" min="10" max="32" value={settings.ui?.fontSize || 14} onInput={(e) => setSettings((current) => ({ ...current, ui: { ...current.ui, fontSize: Number(e.currentTarget.value) || 14 } }))} /></div>
          </div>
          <button class="btn btn-primary" type="button" onClick={save}>Save settings</button>
        </div>
        <div class="card"><div class="card-header"><div class="card-title">Recent diagnostics</div><button class="btn btn-secondary btn-sm" type="button" onClick={clearDiagnostics}>Clear</button></div><div class="empty-state" style={{ padding: 'var(--space-4)' }}>{diagnostics.length ? `${diagnostics.length} recent entries available.` : 'No diagnostics available.'}</div></div>
      </div>
      <div class="status-bar"><div class="status-message"><span class="status-icon status-icon--info" />{status}</div></div>
    </div>
  );
}

function ToolView({ workspace, tool, onBack }) {
  if (workspace === 'writing') {
    return <WritingWorkspace tool={tool} onBack={onBack} />;
  }
  if (workspace === 'music') {
    return <MusicWorkspace onBack={onBack} />;
  }
  if (workspace === 'research') {
    return <DirectSearch onBack={onBack} />;
  }
  if (workspace === 'media') {
    return (
      <MediaWorkspace
        tool={tool}
        onBack={(id) => (id ? onBack(id) : onBack(''))}
      />
    );
  }
  return null;
}

export function App() {
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [activeTool, setActiveTool] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const activeWs = WORKSPACES.find((ws) => ws.id === activeWorkspace);

  function selectWorkspace(id) {
    setActiveWorkspace(id);
    setActiveTool('');
  }

  function selectTool(id) {
    setActiveTool(id);
  }

  function backToTools() {
    setActiveTool('');
  }

  function backToWelcome() {
    setShowSettings(false);
    setActiveWorkspace(null);
    setActiveTool('');
  }

  const currentLabel = activeWs
    ? activeTool
      ? activeWs.tools.find((t) => t.id === activeTool)?.label || activeTool
      : activeWs.title
    : null;

  return (
    <div class="app-shell">
      <aside class="sidebar">
        <div class="sidebar-brand">
          <div class="sidebar-brand-icon">W</div>
          <span class="sidebar-brand-name">Workbench</span>
        </div>

        <nav class="sidebar-nav">
          <div class="sidebar-section">
            <div class="sidebar-section-label">Workspaces</div>
            {WORKSPACES.map((ws) => {
              const Icon = ws.icon;
              const isActive = activeWorkspace === ws.id;
              return (
                <div key={ws.id}>
                  <button
                    class={`sidebar-item ${isActive ? 'sidebar-item--active' : ''}`}
                    type="button"
                    onClick={() => selectWorkspace(ws.id)}
                  >
                    <span class="sidebar-item-icon">
                      <Icon size="1rem" />
                    </span>
                    {ws.title}
                  </button>
                  {isActive && (
                    <div style={{ paddingLeft: '0.75rem' }}>
                      {ws.tools.map((tool) => (
                        <button
                          class={`sidebar-item ${activeTool === tool.id ? 'sidebar-item--active' : ''}`}
                          type="button"
                          key={tool.id}
                          onClick={() => selectTool(tool.id)}
                        >
                          {tool.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        <div class="sidebar-footer">
          <button class="sidebar-item" type="button" onClick={() => { setShowSettings(true); setActiveWorkspace(null); setActiveTool(''); }}>
            <span class="sidebar-item-icon">
              <IconSettings size="1rem" />
            </span>
            Settings
          </button>
        </div>
      </aside>

      <div class="main-area">
        <header class="topbar">
          <div class="topbar-left">
            <div class="topbar-breadcrumb">
              {activeWs ? (
                <>
                  <button
                    class="btn btn-ghost btn-sm"
                    type="button"
                    onClick={backToWelcome}
                  >
                    Workspaces
                  </button>
                  <span class="topbar-breadcrumb-sep">/</span>
                  <button
                    class="btn btn-ghost btn-sm"
                    type="button"
                    onClick={backToTools}
                  >
                    {activeWs.title}
                  </button>
                  {activeTool && (
                    <>
                      <span class="topbar-breadcrumb-sep">/</span>
                      <span class="topbar-breadcrumb-current">
                        {currentLabel}
                      </span>
                    </>
                  )}
                </>
              ) : (
                <span class="topbar-breadcrumb-current">Overview</span>
              )}
            </div>
          </div>
          <div class="topbar-right">
            <div class="topbar-status">
              <span class="topbar-status-dot" />
              Ready
            </div>
          </div>
        </header>

        <div class="content-area">
          {showSettings ? (
            <SettingsPanel />
          ) : activeWs ? (
            <ToolView
              workspace={activeWorkspace}
              tool={activeTool}
              onBack={activeTool ? backToTools : backToWelcome}
            />
          ) : (
            <WelcomeScreen />
          )}
        </div>
      </div>
    </div>
  );
}
