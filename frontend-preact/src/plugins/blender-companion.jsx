import { useState } from 'preact/hooks';
import { backend, backendError } from '../backend.js';
import { sx } from '../stylex-styles.js';
import {
  BLENDER_ENGINES,
  BLENDER_STAGES,
  createScene,
  loadScenes,
  persistScenes,
  sceneToNoteBody,
  validateScene
} from './blender.js';

export function BlenderCompanion() {
  const [scenes, setScenes] = useState(loadScenes);
  const [name, setName] = useState('');
  const [blendPath, setBlendPath] = useState('');
  const [engine, setEngine] = useState('Eevee');
  const [error, setError] = useState('');

  function addScene(event) {
    event.preventDefault();
    const scene = createScene(name || 'Untitled scene', blendPath, engine);
    const invalid = validateScene(scene);
    if (invalid) {
      setError(invalid);
      return;
    }
    const next = [...scenes, scene];
    setScenes(next);
    persistScenes(next);
    setName('');
    setBlendPath('');
    setError('');
  }

  function updateStage(id, stage) {
    const next = scenes.map((scene) =>
      scene.id === id
        ? { ...scene, stage, updated: new Date().toISOString().slice(0, 10) }
        : scene
    );
    setScenes(next);
    persistScenes(next);
  }

  async function logScene(scene) {
    try {
      await backend.createNote(
        `Blender: ${scene.name}`,
        'Blender',
        sceneToNoteBody(scene)
      );
    } catch (failure) {
      setError(backendError(failure));
    }
  }

  return (
    <section className={sx('tool-page')}>
      <div className={sx('tool-heading')}>
        <div>
          <p className={sx('eyebrow')}>Blender studio</p>
          <h1 className={sx('page-title')}>Blender Companion</h1>
          <p className={sx('lede')}>
            Track scenes, engines, and stages next to your mix notes.
          </p>
        </div>
        <span className={sx('mock-badge')}>{scenes.length} scenes</span>
      </div>
      <div className={sx('tool-panel')}>
        <form className={sx('notes-list-heading')} onSubmit={addScene}>
          <input
            className={sx('search-field')}
            value={name}
            onInput={(event) => setName(event.currentTarget.value)}
            placeholder="Scene name…"
            aria-label="Scene name"
          />
          <input
            className={sx('search-field')}
            value={blendPath}
            onInput={(event) => setBlendPath(event.currentTarget.value)}
            placeholder="/path/scene.blend"
            aria-label="Blend path"
          />
          <select
            className={sx('select')}
            value={engine}
            onChange={(event) => setEngine(event.currentTarget.value)}
            aria-label="Render engine"
          >
            {BLENDER_ENGINES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <button type="submit" className={sx('new-note-button')}>
            + Scene
          </button>
        </form>
        {error && (
          <p className={sx('empty-notes')} role="alert">
            {error}
          </p>
        )}
        <ul className={sx('todo-list')}>
          {scenes.map((scene) => (
            <li key={scene.id} className={sx('task-row')}>
              <span>
                <strong>{scene.name}</strong> · {scene.engine} · {scene.stage}
              </span>
              <select
                className={sx('select')}
                value={scene.stage}
                onChange={(event) =>
                  updateStage(scene.id, event.currentTarget.value)
                }
                aria-label={`Stage for ${scene.name}`}
              >
                {BLENDER_STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={sx('text-button')}
                onClick={() => logScene(scene)}
              >
                Log
              </button>
            </li>
          ))}
        </ul>
        {scenes.length === 0 && (
          <p className={sx('empty-notes')}>
            No scenes yet. Add the .blend you are lighting or rendering, then
            log it to Session Notes when a look locks.
          </p>
        )}
      </div>
    </section>
  );
}
