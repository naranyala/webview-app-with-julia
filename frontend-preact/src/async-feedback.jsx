import { sx } from './stylex-styles.js';

export function AsyncFeedback({ pending, error, message }) {
  if (error) {
    return (
      <p className={sx('async-notice', 'async-error')} role="alert">
        {error}
      </p>
    );
  }
  if (!pending && !message) return null;
  return (
    <p
      className={sx(
        'async-notice',
        pending ? 'async-loading' : 'async-success'
      )}
      role="status"
      aria-live="polite"
    >
      {pending || message}
    </p>
  );
}
