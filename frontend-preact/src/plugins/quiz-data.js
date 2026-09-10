export const quizCollections = [
  {
    id: 'blender-3d',
    title: 'Blender 3D Editor',
    shortTitle: 'Blender 3D',
    description:
      'Build confidence with Blender fundamentals, modeling, and scene workflow.',
    tone: 'violet',
    icon: '◇',
    questions: [
      {
        id: 'blender-viewport',
        question:
          'Which shortcut frames the selected object in the 3D Viewport?',
        answer:
          'Press Numpad . (the decimal key). On compact keyboards, use View > Frame Selected or enable Emulate Numpad.',
        explanation:
          'Framing the selection is useful when a scene becomes crowded or an object is outside the current view.',
        tags: ['navigation', 'viewport'],
        difficulty: 'Starter'
      },
      {
        id: 'blender-object-edit',
        question: 'What is the difference between Object Mode and Edit Mode?',
        answer:
          "Object Mode transforms whole objects and manages scene-level relationships. Edit Mode changes the selected object's mesh, curves, or other editable data.",
        explanation:
          'A transform in Object Mode does not directly edit mesh vertices. This separation makes non-destructive scene layout possible.',
        tags: ['workflow', 'modeling'],
        difficulty: 'Starter'
      },
      {
        id: 'blender-modifier',
        question: 'Why would you use a Subdivision Surface modifier?',
        answer:
          'It smooths and subdivides a mesh procedurally, adding resolution while preserving the lower-resolution control cage.',
        explanation:
          'Keeping the modifier unapplied lets you continue editing the simpler base mesh and change the subdivision level later.',
        tags: ['modifiers', 'modeling'],
        difficulty: 'Intermediate'
      },
      {
        id: 'blender-normals',
        question: 'What do mesh normals describe?',
        answer:
          'Normals describe the direction a face is considered to be pointing. They affect shading, backface behavior, and some geometry operations.',
        explanation:
          'If faces appear dark or render inside out, inspect normals and use Mesh > Normals > Recalculate Outside when appropriate.',
        tags: ['mesh', 'shading'],
        difficulty: 'Intermediate'
      },
      {
        id: 'blender-collection',
        question: 'What is a Collection used for in Blender?',
        answer:
          'A Collection groups objects in the Outliner so they can be organized, selected, hidden, or instanced together.',
        explanation:
          'Collections are scene organization tools, not mesh data containers. One object can be linked into multiple collections.',
        tags: ['scene', 'organization'],
        difficulty: 'Starter'
      },
      {
        id: 'blender-shader',
        question: 'In the Principled BSDF shader, what does Roughness control?',
        answer:
          'Roughness controls how broadly light scatters across a surface. Low values look sharper and glossier; high values look softer and more matte.',
        explanation:
          'Roughness is a perceptual material control, while metallic determines whether the surface behaves like a conductor or a dielectric.',
        tags: ['materials', 'rendering'],
        difficulty: 'Intermediate'
      },
      {
        id: 'blender-origin',
        question: "Why does an object's origin matter?",
        answer:
          "The origin is the object's transformation pivot. Its position and orientation affect rotation, scaling, parenting, and modifier behavior.",
        explanation:
          'Setting the origin deliberately prevents surprising rotations and makes repeated transforms easier to control.',
        tags: ['transforms', 'workflow'],
        difficulty: 'Starter'
      },
      {
        id: 'blender-render-engine',
        question: 'When might you choose Eevee over Cycles?',
        answer:
          'Choose Eevee when interactive speed and fast previews matter. Choose Cycles when physically based path-traced lighting and higher final accuracy matter.',
        explanation:
          'The best choice depends on the target: iteration speed, stylized rendering, and real-time output favor Eevee, while realism often favors Cycles.',
        tags: ['rendering', 'performance'],
        difficulty: 'Intermediate'
      }
    ]
  },
  {
    id: 'audio-programming',
    title: 'Audio Programming',
    shortTitle: 'Audio Code',
    description:
      'Explore DSP, synthesis, timing, and the engineering behind digital sound.',
    tone: 'cyan',
    icon: '∿',
    questions: [
      {
        id: 'audio-sample-rate',
        question: 'What does a digital audio sample rate describe?',
        answer:
          'It is the number of amplitude measurements taken per second, measured in hertz. A 48 kHz stream has 48,000 samples per second.',
        explanation:
          'By the Nyquist-Shannon theorem, the sample rate must be more than twice the highest frequency you want to represent.',
        tags: ['fundamentals', 'sampling'],
        difficulty: 'Starter'
      },
      {
        id: 'audio-aliasing',
        question: 'What is aliasing in digital audio?',
        answer:
          'Aliasing is unwanted frequency content created when a signal contains frequencies above the Nyquist limit and is sampled without adequate filtering.',
        explanation:
          'An anti-aliasing low-pass filter before conversion, plus oversampling where useful, helps keep those mirrored frequencies out of the audible result.',
        tags: ['sampling', 'DSP'],
        difficulty: 'Intermediate'
      },
      {
        id: 'audio-buffer',
        question: 'What is the tradeoff when choosing an audio buffer size?',
        answer:
          'Smaller buffers reduce latency but leave less time for processing and increase the risk of underruns. Larger buffers are safer but feel less responsive.',
        explanation:
          'Real-time audio code must finish each buffer before the hardware needs it; missing that deadline produces clicks or dropouts.',
        tags: ['realtime', 'performance'],
        difficulty: 'Intermediate'
      },
      {
        id: 'audio-oscillator',
        question: 'How can an oscillator generate a sine wave?',
        answer:
          'Maintain a phase value, advance it by frequency divided by sample rate for each sample, and evaluate sin(2π × phase). Wrap phase when it reaches one.',
        explanation:
          'A phase accumulator generalizes well to wavetable oscillators and keeps pitch stable across a block of samples.',
        tags: ['synthesis', 'oscillators'],
        difficulty: 'Intermediate'
      },
      {
        id: 'audio-filter',
        question: 'What does a low-pass filter do?',
        answer:
          'It attenuates frequencies above its cutoff while allowing lower frequencies to pass, with the exact transition shaped by its filter design and slope.',
        explanation:
          'Low-pass filters are used for tone shaping, anti-aliasing, smoothing control signals, and reducing high-frequency noise.',
        tags: ['filters', 'DSP'],
        difficulty: 'Starter'
      },
      {
        id: 'audio-decibels',
        question: 'Why are decibels useful for audio gain?',
        answer:
          'Decibels express ratios logarithmically, matching the way loudness and signal levels are commonly perceived. For amplitude, gain is 20 log10(linear ratio).',
        explanation:
          'A gain of 0 dB means unity amplitude; positive and negative dB values represent boosts and cuts relative to that reference.',
        tags: ['fundamentals', 'mixing'],
        difficulty: 'Intermediate'
      },
      {
        id: 'audio-thread',
        question:
          'Why should real-time audio callbacks avoid blocking and allocation?',
        answer:
          'The callback has a strict deadline. Locks, file I/O, unpredictable allocation, or heavy logging can pause it long enough to cause an audible glitch.',
        explanation:
          'Pass prepared data through lock-free or bounded structures and do slow work on another thread before the callback needs it.',
        tags: ['realtime', 'systems'],
        difficulty: 'Advanced'
      },
      {
        id: 'audio-fft',
        question: 'What does an FFT reveal about an audio signal?',
        answer:
          'It converts a time-domain block into frequency-domain bins, showing the strength and phase of frequency components represented in that block.',
        explanation:
          'FFT resolution depends on both sample rate and block length. Windowing reduces spectral leakage but changes the measurement tradeoffs.',
        tags: ['analysis', 'FFT'],
        difficulty: 'Advanced'
      }
    ]
  },
  {
    id: 'mir-fundamentals',
    title: 'MIR Fundamentals',
    shortTitle: 'MIR',
    description:
      'Retrieval-oriented listening: features, onsets, tempo, and evaluation.',
    tone: 'cyan',
    icon: '∿',
    questions: [
      {
        id: 'mir-rms',
        question: 'What does RMS tell you that peak does not?',
        answer:
          'RMS tracks average energy and perceived loudness over a window, while peak only reports the single loudest instant.',
        explanation:
          'Use RMS for mix balance and headroom decisions; use peak to catch clipping.',
        tags: ['features', 'loudness'],
        difficulty: 'Starter'
      },
      {
        id: 'mir-zcr',
        question: 'What does a high zero-crossing rate suggest?',
        answer:
          'Bright, noisy, or transient-rich material such as hats, sibilance, or distortion.',
        explanation:
          'ZCR is a cheap time-domain brightness cue. Confirm with spectral centroid once an FFT exists.',
        tags: ['features', 'brightness'],
        difficulty: 'Starter'
      },
      {
        id: 'mir-stft',
        question: 'Why is the STFT window size a tradeoff?',
        answer:
          'Short windows localize onsets in time but blur frequency; long windows resolve pitch but smear attacks.',
        explanation:
          'Speech and drums favor short windows; tonal analysis favors longer ones.',
        tags: ['STFT', 'analysis'],
        difficulty: 'Intermediate'
      },
      {
        id: 'mir-chroma',
        question: 'What does a chromagram collapse away?',
        answer:
          'Octave information. It folds energy into 12 pitch classes to expose harmony independent of voicing.',
        explanation:
          'Chroma suits chord and key estimation, not timbre or bass-line height.',
        tags: ['chroma', 'harmony'],
        difficulty: 'Intermediate'
      },
      {
        id: 'mir-onset',
        question: 'What makes a good onset detection function?',
        answer:
          'One that rises sharply at note starts and stays flat elsewhere, often via spectral flux or high-frequency content.',
        explanation:
          'Peak-pick with adaptive thresholding, then prune with minimum inter-onset intervals.',
        tags: ['onsets', 'rhythm'],
        difficulty: 'Intermediate'
      },
      {
        id: 'mir-tempo',
        question: 'How is tempo usually estimated from onsets?',
        answer:
          'Build a novelty/onset envelope, autocorrelate or comb-filter it, and pick the lag with the strongest periodic support.',
        explanation:
          'Octave errors are common; report both 90 and 180 BPM hypotheses when unsure.',
        tags: ['tempo', 'rhythm'],
        difficulty: 'Advanced'
      },
      {
        id: 'mir-mfcc',
        question: 'What do MFCCs emphasize?',
        answer:
          'The coarse spectral envelope on a mel scale, useful for timbre and instrument similarity.',
        explanation:
          'Keep 13-20 coefficients for retrieval; deltas add temporal shape.',
        tags: ['timbre', 'features'],
        difficulty: 'Advanced'
      },
      {
        id: 'mir-eval',
        question: 'How should a retrieval experiment be judged?',
        answer:
          'Fixed dataset split, fixed features, and rank-aware metrics such as precision@k or mean reciprocal rank.',
        explanation:
          'Log the sample window, sample rate, and code version with every run.',
        tags: ['evaluation', 'workflow'],
        difficulty: 'Advanced'
      }
    ]
  }
];

export function getQuizCollection(id) {
  return quizCollections.find((collection) => collection.id === id);
}
