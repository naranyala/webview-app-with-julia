import { useState } from 'preact/hooks';
import { styles, sx } from '../stylex-styles.js';

const equalizerPresets = [
  { name: 'Flat', values: [0, 0, 0, 0, 0, 0, 0] },
  { name: 'Focus', values: [-2, 1, 3, 4, 2, -1, -2] },
  { name: 'Warm', values: [4, 3, 1, -1, -2, -2, -1] },
  { name: 'Vocal', values: [-3, -1, 2, 4, 3, 1, -2] }
];

const bandLabels = ['60', '150', '400', '1k', '2.4k', '6k', '14k'];
const visualizerLevels = [
  42, 66, 52, 78, 58, 86, 69, 48, 72, 54, 80, 62, 44, 74, 57, 68
];

export function AudioEqualizer() {
  const [activePreset, setActivePreset] = useState('Focus');
  const [equalizerEnabled, setEqualizerEnabled] = useState(true);
  const [bandValues, setBandValues] = useState([-2, 1, 3, 4, 2, -1, -2]);
  const [masterVolume, setMasterVolume] = useState(68);

  function choosePreset(preset) {
    setActivePreset(preset.name);
    setBandValues([...preset.values]);
  }

  function updateBand(index, event) {
    const next = [...bandValues];
    next[index] = Number(event.currentTarget.value);
    setBandValues(next);
    setActivePreset('Custom');
  }

  return (
    <section className={sx('tool-page')}>
      <div className={sx('tool-heading')}>
        <div>
          <p className={sx('eyebrow')}>Sound</p>
          <h1 className={sx('pageTitle')}>Equalizer</h1>
          <p className={sx('lede')}>Tune the mix. Changes are local for now.</p>
        </div>
        <span className={sx('mock-badge')}>Mock</span>
      </div>

      <div className={sx('audio-console', 'tool-panel')}>
        <div className={sx('track-meta')}>
          <div className={sx('album-art')}>AUX</div>
          <div>
            <span className={sx('panel-label')}>Source</span>
            <h2 className={sx('track-title')}>Night drive</h2>
            <span className={sx('track-source')}>Local mock</span>
          </div>
          <button
            type="button"
            className={sx(
              'toggle-button',
              equalizerEnabled && styles.toggleEnabled
            )}
            onClick={() => setEqualizerEnabled((value) => !value)}
          >
            {equalizerEnabled ? 'Enabled' : 'Bypassed'}
          </button>
        </div>
        <div
          className={sx('visualizer')}
          role="img"
          aria-label="Mock audio visualizer"
        >
          {visualizerLevels.map((level, index) => (
            <span
              key={index}
              className={sx(
                'visualBar',
                index % 4 === 0 && styles.visualAccent
              )}
              style={`height: ${level}%`}
            />
          ))}
        </div>
        <div className={sx('transport-row')}>
          <span>01:24</span>
          <div className={sx('transport-track')}>
            <span className={sx('transport-fill')} />
          </div>
          <span>03:48</span>
        </div>
      </div>

      <div className={sx('equalizer-grid')}>
        <div className={sx('tool-panel')}>
          <div className={sx('panel-heading')}>
            <div>
              <span className={sx('panel-label')}>Bands</span>
              <h2 className={sx('panel-title')}>{activePreset}</h2>
            </div>
            <span className={sx('panel-status')}>Local</span>
          </div>
          <div className={sx('bands')}>
            {bandValues.map((value, index) => (
              <label
                className={sx(
                  'band',
                  index === bandValues.length - 1 && styles.bandLast
                )}
                key={bandLabels[index]}
              >
                <input
                  className={sx('range')}
                  type="range"
                  min="-12"
                  max="12"
                  value={value}
                  onInput={(event) => updateBand(index, event)}
                  aria-label={`${bandLabels[index]} Hz gain`}
                />
                <span className={sx('band-value')}>
                  {value > 0 ? '+' : ''}
                  {value}
                </span>
                <span className={sx('band-label')}>{bandLabels[index]}</span>
              </label>
            ))}
          </div>
          <div className={sx('master-row')}>
            <span>Master</span>
            <input
              className={sx('master-range')}
              type="range"
              min="0"
              max="100"
              value={masterVolume}
              onInput={(event) =>
                setMasterVolume(Number(event.currentTarget.value))
              }
              aria-label="Master volume"
            />
            <strong className={sx('master-strong')}>{masterVolume}%</strong>
          </div>
        </div>

        <div className={sx('tool-panel', 'presets-panel')}>
          <span className={sx('panel-label')}>Presets</span>
          <div className={sx('preset-list')}>
            {equalizerPresets.map((preset) => (
              <button
                type="button"
                key={preset.name}
                className={sx(
                  'preset',
                  activePreset === preset.name && styles.presetActive
                )}
                onClick={() => choosePreset(preset)}
              >
                {preset.name}
              </button>
            ))}
          </div>
          <p className={sx('panel-note')}>
            Presets update controls only until the backend connects.
          </p>
        </div>
      </div>
    </section>
  );
}
