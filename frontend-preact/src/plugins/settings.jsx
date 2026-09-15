import { useEffect, useState } from 'preact/hooks';
import { backend, backendError } from '../backend.js';
import { sx } from '../stylex-styles.js';

const FALLBACK_SETTINGS = {
  schemaVersion: 1,
  workspace: { roots: [], defaultNotesPath: '' },
  ui: { theme: 'system', sidebarCollapsed: false, fontSize: 14 },
  plugins: { enabled: [], disabled: [] },
  paper: { defaultTemplateId: 'default', recentProjects: [] }
};

export function Settings({
  settings: applicationSettings,
  onSettingsChange,
  availablePlugins = []
}) {
  const [settings, setSettings] = useState(
    applicationSettings || FALLBACK_SETTINGS
  );
  const [rootsText, setRootsText] = useState(
    applicationSettings?.workspace.roots.join('\n') || ''
  );
  const [state, setState] = useState(applicationSettings ? 'ready' : 'loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!applicationSettings) {
      let active = true;
      backend.getSettings().then(
        (loaded) => {
          if (!active) return;
          setSettings(loaded);
          setRootsText(loaded.workspace.roots.join('\n'));
          setState('ready');
        },
        (error) => {
          if (!active) return;
          setState('error');
          setMessage(backendError(error));
        }
      );
      return () => {
        active = false;
      };
    }
    setSettings(applicationSettings);
    setRootsText(applicationSettings.workspace.roots.join('\n'));
    setState('ready');
    return undefined;
  }, [applicationSettings]);

  function patchSection(section, patch) {
    setSettings((current) => ({
      ...current,
      [section]: { ...current[section], ...patch }
    }));
  }

  function togglePlugin(id, enabled) {
    const disabled = new Set(settings.plugins.disabled);
    if (enabled) disabled.delete(id);
    else disabled.add(id);
    patchSection('plugins', { disabled: [...disabled] });
  }

  async function save() {
    setState('saving');
    setMessage('');
    const roots = rootsText
      .split(/\r?\n/)
      .map((root) => root.trim())
      .filter(Boolean);
    try {
      const saved = await backend.saveSettings({
        ...settings,
        workspace: { ...settings.workspace, roots }
      });
      setSettings(saved);
      setRootsText(saved.workspace.roots.join('\n'));
      setState('saved');
      setMessage('Settings saved');
      onSettingsChange?.(saved);
    } catch (error) {
      setState('error');
      setMessage(backendError(error));
    }
  }

  return (
    <section className={sx('tool-page')}>
      <div className={sx('tool-heading')}>
        <div>
          <p className={sx('eyebrow')}>Application</p>
          <h1 className={sx('page-title')}>Settings</h1>
          <p className={sx('lede')}>
            Configure local workspaces, presentation, and available tools.
          </p>
        </div>
        <span className={sx('mock-badge')}>{state}</span>
      </div>

      <div className={sx('tool-panel')}>
        <span className={sx('panel-label')}>Workspace roots</span>
        <p className={sx('empty-notes')}>
          One existing directory per line. Documents is always authorized.
        </p>
        <textarea
          className={sx('qna-import-input')}
          rows="6"
          aria-label="Workspace roots"
          placeholder="~/Research\n/run/media/you/Data/projects"
          value={rootsText}
          onInput={(event) => setRootsText(event.currentTarget.value)}
        />
      </div>

      <div className={sx('tool-panel')}>
        <span className={sx('panel-label')}>Appearance</span>
        <div className={sx('notes-list-heading')}>
          <label>
            Theme{' '}
            <select
              className={sx('select')}
              value={settings.ui.theme}
              onChange={(event) =>
                patchSection('ui', { theme: event.currentTarget.value })
              }
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label>
            Font size{' '}
            <input
              className={sx('search-field')}
              type="number"
              min="10"
              max="32"
              value={settings.ui.fontSize}
              onInput={(event) =>
                patchSection('ui', {
                  fontSize: Number(event.currentTarget.value)
                })
              }
            />
          </label>
          <label>
            Default paper template{' '}
            <input
              className={sx('search-field')}
              value={settings.paper.defaultTemplateId}
              onInput={(event) =>
                patchSection('paper', {
                  defaultTemplateId: event.currentTarget.value
                })
              }
            />
          </label>
        </div>
      </div>

      <div className={sx('tool-panel')}>
        <span className={sx('panel-label')}>Enabled tools</span>
        <div className={sx('notes-list')}>
          {availablePlugins
            .filter((plugin) => plugin.id !== 'settings')
            .map((plugin) => (
              <label key={plugin.id} className={sx('notes-list-heading')}>
                <span>{plugin.title}</span>
                <input
                  type="checkbox"
                  checked={!settings.plugins.disabled.includes(plugin.id)}
                  onChange={(event) =>
                    togglePlugin(plugin.id, event.currentTarget.checked)
                  }
                />
              </label>
            ))}
        </div>
      </div>

      <div className={sx('tool-panel')}>
        <div className={sx('note-editor-footer')}>
          <button
            type="button"
            className={sx('new-note-button')}
            disabled={state === 'loading' || state === 'saving'}
            onClick={save}
          >
            {state === 'saving' ? 'Saving…' : 'Save settings'}
          </button>
          {message && (
            <span className={state === 'error' ? sx('error') : undefined}>
              {message}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
