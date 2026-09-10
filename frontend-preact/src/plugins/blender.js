export const BLENDER_ENGINES = ['Eevee', 'Cycles', 'Workbench'];
export const BLENDER_STAGES = [
  'modeling',
  'uv',
  'shading',
  'lighting',
  'animation',
  'render',
  'composite'
];
const STORAGE_KEY = 'webview-app.blender-scenes';

export function createScene(name, blendPath = '', engine = 'Eevee') {
  return {
    id: `scene-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`,
    name: name.trim(),
    blendPath,
    engine: BLENDER_ENGINES.includes(engine) ? engine : 'Eevee',
    stage: 'modeling',
    updated: new Date().toISOString().slice(0, 10),
    notes: ''
  };
}

export function validateScene(scene) {
  if (!scene || typeof scene.name !== 'string' || scene.name.trim() === '')
    return 'scene name is required';
  if (scene.name.length > 200) return 'scene name is too long';
  if (typeof scene.blendPath !== 'string' || scene.blendPath.length > 500)
    return 'blend path is invalid';
  if (!BLENDER_ENGINES.includes(scene.engine))
    return 'render engine is invalid';
  if (!BLENDER_STAGES.includes(scene.stage)) return 'stage is invalid';
  return null;
}

export function loadScenes() {
  try {
    const raw = globalThis.window?.localStorage?.getItem(STORAGE_KEY);
    const scenes = raw ? JSON.parse(raw) : [];
    return Array.isArray(scenes) ? scenes.filter((s) => !validateScene(s)) : [];
  } catch {
    return [];
  }
}

export function persistScenes(scenes) {
  try {
    globalThis.window?.localStorage?.setItem(
      STORAGE_KEY,
      JSON.stringify(scenes)
    );
  } catch {
    // Browser storage may be unavailable in the native shell; list stays in memory.
  }
}

export function sceneToNoteBody(scene) {
  return `Blender scene: ${scene.name}\nEngine: ${scene.engine}\nStage: ${scene.stage}\nBlend: ${scene.blendPath || 'unsaved'}\nNotes:\n${scene.notes || '-'}`;
}
