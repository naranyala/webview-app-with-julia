/**
 * Validate the small manifest shared by every frontend tool plugin.
 * Rendering and state stay inside the plugin component so the shell only
 * coordinates navigation and window lifecycle concerns.
 */
export function defineFrontendPlugin(plugin) {
  for (const field of [
    'id',
    'index',
    'title',
    'description',
    'tone',
    'component'
  ]) {
    if (!plugin[field]) throw new Error(`Frontend plugin is missing ${field}`);
  }

  return Object.freeze(plugin);
}
