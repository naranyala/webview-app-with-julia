import * as stylex from '@stylexjs/stylex';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { flushRegisteredAutosaves } from './autosave.mjs';
import { backendError } from './backend.js';
import { ErrorBoundary } from './error-boundary.jsx';
import { getFrontendPlugin } from './plugins/index.js';
import { sx, toneStyle } from './stylex-styles.js';
import { lightTheme } from './stylex-tokens.stylex.js';
import {
  nextThemePreference,
  normalizeThemePreference,
  resolveTheme
} from './theme-preference.js';
import { getWorkspace, WORKSPACES } from './workspace-catalog.js';

const THEME_STORAGE_KEY = 'webview-workbench-theme';

function getInitialThemePreference() {
  try {
    return normalizeThemePreference(
      window.localStorage.getItem(THEME_STORAGE_KEY)
    );
  } catch {
    return 'system';
  }
}

function getSystemTheme() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

// The shell only decides where a feature is presented. Feature components and
// their registry remain independent, so they can be reused in a future UI.
export function App() {
  const [themePreference, setThemePreference] = useState(
    getInitialThemePreference
  );
  const [systemTheme, setSystemTheme] = useState(getSystemTheme);
  const [workspaceId, setWorkspaceId] = useState(null);
  const [activeFeatureId, setActiveFeatureId] = useState(null);
  const [navigationPending, setNavigationPending] = useState(false);
  const [error, setError] = useState('');
  const workspace = getWorkspace(workspaceId);
  const activeFeature = getFrontendPlugin(activeFeatureId);
  const ActiveFeature = activeFeature?.component;
  const features = useMemo(
    () => workspace?.featureIds.map(getFrontendPlugin).filter(Boolean) ?? [],
    [workspace]
  );
  const theme = resolveTheme(themePreference, systemTheme);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return undefined;
    const update = () => setSystemTheme(media.matches ? 'dark' : 'light');
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.title = activeFeature
      ? `${activeFeature.title} - WebView Workbench`
      : workspace
        ? `${workspace.title} - WebView Workbench`
        : 'WebView Workbench';
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, themePreference);
    } catch {
      // Native WebViews can expose an opaque origin without localStorage.
    }
  }, [activeFeature, theme, themePreference, workspace]);

  async function flushBeforeNavigate() {
    if (navigationPending) return false;
    setNavigationPending(true);
    setError('');
    try {
      const saved = await flushRegisteredAutosaves();
      if (!saved) throw new Error('A workspace save failed. Please retry.');
      return true;
    } catch (cause) {
      setError(`Save failed: ${backendError(cause)}`);
      return false;
    } finally {
      setNavigationPending(false);
    }
  }

  async function openWorkspace(id) {
    if (!(await flushBeforeNavigate())) return;
    setActiveFeatureId(null);
    setWorkspaceId(id);
    window.scrollTo?.(0, 0);
  }

  async function openFeature(id) {
    if (!(await flushBeforeNavigate())) return;
    setActiveFeatureId(id);
    window.scrollTo?.(0, 0);
  }

  async function closeFeature() {
    if (!(await flushBeforeNavigate())) return;
    setActiveFeatureId(null);
  }

  async function closeWorkspace() {
    if (!(await flushBeforeNavigate())) return;
    setActiveFeatureId(null);
    setWorkspaceId(null);
  }

  const cycleTheme = () =>
    setThemePreference((value) => nextThemePreference(value));
  const themeLabel = `Theme: ${themePreference}`;

  return (
    <div
      className={`${sx('focus-shell')} ${theme === 'light' ? (stylex.props(lightTheme).className ?? '') : ''}`}
    >
      {error && (
        <p className={sx('focus-error')} role="alert">
          {error}
        </p>
      )}

      {!workspace && (
        <main className={sx('focus-launcher')} aria-label="Choose a workspace">
          <p className={sx('focus-kicker')}>WebView Workbench</p>
          <h1 className={sx('focus-title')}>Choose a workspace.</h1>
          <div className={sx('focus-menu')}>
            {WORKSPACES.map((item) => (
              <button
                type="button"
                key={item.id}
                className={sx('focus-choice')}
                onClick={() => openWorkspace(item.id)}
                disabled={navigationPending}
              >
                <span className={sx('focus-choice-eyebrow')}>
                  {item.eyebrow}
                </span>
                <strong>{item.title}</strong>
                <span className={sx('focus-choice-arrow')} aria-hidden="true">
                  →
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className={sx('focus-theme-toggle')}
            onClick={cycleTheme}
          >
            {themeLabel}
          </button>
        </main>
      )}

      {workspace && !activeFeature && (
        <main
          className={sx('focus-panel')}
          aria-label={`${workspace.title} workspace`}
        >
          <header className={sx('focus-panel-header')}>
            <button
              type="button"
              className={sx('focus-back')}
              onClick={closeWorkspace}
              disabled={navigationPending}
            >
              ← Menu
            </button>
            <button
              type="button"
              className={sx('focus-theme-toggle', 'focus-theme-toggle-inline')}
              onClick={cycleTheme}
            >
              {themeLabel}
            </button>
          </header>
          <div className={sx('focus-panel-layout')}>
            <section className={sx('focus-panel-intro')}>
              <p className={sx('focus-kicker')}>{workspace.eyebrow}</p>
              <h1 className={sx('focus-title')}>{workspace.title}</h1>
              <p>{workspace.description}</p>
            </section>
            <aside
              className={sx('focus-side-panel')}
              aria-label={`${workspace.title} feature menu`}
            >
              <div className={sx('focus-side-panel-heading')}>
                <span>Available tools</span>
                <small>{features.length}</small>
              </div>
              <nav
                className={sx('focus-feature-grid')}
                aria-label={`${workspace.title} features`}
              >
                {features.map((feature) => (
                  <button
                    type="button"
                    key={feature.id}
                    className={sx('focus-feature')}
                    onClick={() => openFeature(feature.id)}
                    disabled={navigationPending}
                    aria-label={feature.title}
                  >
                    <span
                      className={sx(
                        'focus-feature-symbol',
                        toneStyle(feature.tone)
                      )}
                    >
                      {feature.symbol}
                    </span>
                    <strong>{feature.title}</strong>
                    <small>{feature.description}</small>
                  </button>
                ))}
              </nav>
            </aside>
          </div>
        </main>
      )}

      {workspace && activeFeature && ActiveFeature && (
        <section
          className={sx('feature-panel')}
          aria-label={activeFeature.title}
        >
          <header className={sx('feature-panel-header')}>
            <button
              type="button"
              className={sx('focus-back')}
              onClick={closeFeature}
              disabled={navigationPending}
            >
              ← {workspace.title}
            </button>
            <strong>{activeFeature.title}</strong>
            <button
              type="button"
              className={sx('focus-theme-toggle', 'focus-theme-toggle-inline')}
              onClick={cycleTheme}
            >
              {themeLabel}
            </button>
          </header>
          <div className={sx('feature-panel-body')}>
            <ErrorBoundary key={activeFeatureId}>
              <ActiveFeature
                availablePlugins={
                  activeFeatureId === 'settings' ? features : undefined
                }
              />
            </ErrorBoundary>
          </div>
        </section>
      )}
    </div>
  );
}
