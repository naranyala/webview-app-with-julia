import { Component } from 'preact';
import { sx } from './stylex-styles.js';

/**
 * Production error boundary / fallback screen.
 * Catches render or backend-driven crashes in the toolkit shell and offers
 * a safe recovery instead of a blank WebView.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    if (typeof console !== 'undefined' && error) {
      console.error('[WebView App] Unhandled UI error:', error);
    }
  }

  handleReset = () => {
    this.setState({ error: null });
    if (typeof window !== 'undefined' && window.location) {
      window.location.reload();
    }
  };

  render(props, state) {
    if (state.error) {
      const message =
        state.error instanceof Error
          ? state.error.message
          : String(state.error ?? 'Unknown error');
      return (
        <div className={sx('shell')}>
          <main className={sx('launcher-main')} role="alert">
            <p className={sx('eyebrow')}>Toolkit</p>
            <h1 className={sx('error-title')}>Something went wrong</h1>
            <p className={sx('lede')}>
              The workspace hit an unexpected error and stopped rendering.
            </p>
            <p className={sx('error')}>{message}</p>
            <button
              className={sx('primary')}
              type="button"
              onClick={this.handleReset}
            >
              Reload workspace
            </button>
          </main>
        </div>
      );
    }
    return props.children;
  }
}
