import { AcademicPaper } from './academic-paper.jsx';
import { AudioEqualizer } from './audio-equalizer.jsx';
import { BlenderCompanion } from './blender-companion.jsx';
import { ChainNotes } from './chain-notes.jsx';
import { defineFrontendPlugin } from './contract.js';
import { DiskScanner } from './disk-scanner.jsx';
import { IndonesiaMap } from './indonesia-map.jsx';
import { MirLab } from './mir-lab.jsx';
import { Quiz } from './quiz.jsx';
import { TabVault } from './tab-vault.jsx';
import { TodoApp } from './todo.jsx';

export {
  getIndonesiaRegion,
  getIndonesiaRegions,
  INDONESIA_MAP_EXTENT,
  INDONESIA_MAP_GEOJSON,
  INDONESIA_MAP_MODEL,
  INDONESIA_REGION_INDEX
} from './indonesia-map-api.js';

export const diskScannerPlugin = defineFrontendPlugin({
  id: 'disk',
  index: '01',
  title: 'Sample Library',
  description: 'Map sample packs, stems, and .blend storage before a session.',
  tone: 'coral',
  symbol: 'STORAGE',
  component: DiskScanner
});

export const audioEqualizerPlugin = defineFrontendPlugin({
  id: 'equalizer',
  index: '02',
  title: 'Monitor EQ',
  description: 'Shape the monitoring chain while MIR analysis stays dry.',
  tone: 'blue',
  symbol: 'SIGNAL',
  component: AudioEqualizer
});

export const tabVaultPlugin = defineFrontendPlugin({
  id: 'tabs',
  index: '03',
  title: 'Tab Vault',
  description: 'Import, inspect, edit, and re-export browser tab JSON backups.',
  tone: 'amber',
  symbol: 'VAULT',
  component: TabVault
});

export const academicPaperPlugin = defineFrontendPlugin({
  id: 'paper',
  index: '06',
  title: 'MIR Papers',
  description: 'ISMIR-style reading with citations, figures, and PDF export.',
  tone: 'green',
  symbol: 'SCHOLAR',
  component: AcademicPaper
});

export const mirLabPlugin = defineFrontendPlugin({
  id: 'mir',
  index: '07',
  title: 'MIR Lab',
  description: 'Offline loudness, peak, and brightness analysis.',
  tone: 'cyan',
  symbol: 'WAVE',
  component: MirLab
});

export const indonesiaMapPlugin = defineFrontendPlugin({
  id: 'map',
  index: '09',
  title: 'Indonesia Map',
  description: 'Browse all provinces and focus down to kabupaten or kota.',
  tone: 'blue',
  symbol: 'ATLAS',
  component: IndonesiaMap
});

export const chainNotesPlugin = defineFrontendPlugin({
  id: 'notes',
  index: '10',
  title: 'Chain Notes',
  description: 'Persistent notes with tagging, search, and PDF export.',
  tone: 'purple',
  symbol: 'NOTE',
  component: ChainNotes
});

export const quizPlugin = defineFrontendPlugin({
  id: 'quiz',
  index: '11',
  title: 'Quiz',
  description: 'Create, study, and review flashcard collections.',
  tone: 'gold',
  symbol: 'QUIZ',
  component: Quiz
});

export const blenderCompanionPlugin = defineFrontendPlugin({
  id: 'blender',
  index: '12',
  title: 'Blender Companion',
  description:
    'Scene logging, render notes, and pipeline tracking for Blender.',
  tone: 'orange',
  symbol: 'BLEND',
  component: BlenderCompanion
});

export const todoPlugin = defineFrontendPlugin({
  id: 'todo',
  index: '13',
  title: 'Todos',
  description: 'Task planner with due dates, priorities, and calendar view.',
  tone: 'teal',
  symbol: 'TASK',
  component: TodoApp
});

const registeredPlugins = [
  diskScannerPlugin,
  audioEqualizerPlugin,
  tabVaultPlugin,
  academicPaperPlugin,
  mirLabPlugin,
  indonesiaMapPlugin,
  chainNotesPlugin,
  quizPlugin,
  blenderCompanionPlugin,
  todoPlugin
];
const pluginIds = new Set();

for (const plugin of registeredPlugins) {
  if (pluginIds.has(plugin.id))
    throw new Error(`Duplicate frontend plugin id: ${plugin.id}`);
  pluginIds.add(plugin.id);
}

export const frontendPlugins = Object.freeze(registeredPlugins);

export function getFrontendPlugin(id) {
  return frontendPlugins.find((plugin) => plugin.id === id);
}
