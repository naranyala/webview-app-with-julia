// Navigation policy belongs here, separate from the feature registry and UI.
// A feature remains registered in `plugins/index.js`; this catalog only says
// where it is presented in the new focused launcher.
export const WORKSPACES = Object.freeze([
  {
    id: 'writing',
    title: 'Writing',
    eyebrow: 'Words, research, and planning',
    description:
      'Capture ideas, develop papers, and keep the supporting work in one place.',
    featureIds: [
      'notes',
      'paper',
      'todo',
      'tabs',
      'media',
      'map',
      'settings',
      'diagnostics'
    ]
  },
  {
    id: 'music',
    title: 'Analyze Music',
    eyebrow: 'Audio analysis and studio tools',
    description:
      'Inspect material, monitor playback, and work through music-analysis tasks.',
    featureIds: ['mir', 'equalizer', 'disk', 'blender']
  },
  {
    id: 'media-manager',
    title: 'Media Manager',
    eyebrow: 'Local file browsing and management',
    description:
      'Browse directories, inspect file metadata, and convert local media.',
    featureIds: ['files', 'media', 'disk', 'gallery']
  }
]);

export function getWorkspace(id) {
  return WORKSPACES.find((workspace) => workspace.id === id) ?? null;
}
