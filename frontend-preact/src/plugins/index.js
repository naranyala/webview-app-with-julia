import { AcademicPaper } from './academic-paper.jsx';
import { AudioEqualizer } from './audio-equalizer.jsx';
import { BlenderCompanion } from './blender-companion.jsx';
import { ChainNotes } from './chain-notes.jsx';
import { defineFrontendPlugin } from './contract.js';
import { Diagnostics } from './diagnostics.jsx';
import { DiskScanner } from './disk-scanner.jsx';
import { IndonesiaMap } from './indonesia-map.jsx';
import { MediaInspector } from './media-inspector.jsx';
import { MirLab } from './mir-lab.jsx';
import { Settings } from './settings.jsx';
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
export {
  enhancePaperExtensions,
  getPaperExtension,
  listPaperExtensions,
  paperBlocksToHtml,
  parsePaperMarkdown,
  registerPaperExtension
} from './paper-extensions.js';

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

export const mediaInspectorPlugin = defineFrontendPlugin({
  id: 'media',
  index: '08',
  title: 'Media Inspector',
  description: 'Inspect, preview, and convert local documents and images.',
  tone: 'cyan',
  symbol: 'MEDIA',
  component: MediaInspector
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

export const settingsPlugin = defineFrontendPlugin({
  id: 'settings',
  index: '14',
  title: 'Settings',
  description: 'Configure workspaces, appearance, and enabled tools.',
  tone: 'blue',
  symbol: 'SETTINGS',
  component: Settings
});

export const diagnosticsPlugin = defineFrontendPlugin({
  id: 'diagnostics',
  index: '15',
  title: 'Diagnostics',
  description: 'Inspect and export structured frontend and backend logs.',
  tone: 'amber',
  symbol: 'LOGS',
  component: Diagnostics
});

const registeredPlugins = [
  diskScannerPlugin,
  audioEqualizerPlugin,
  tabVaultPlugin,
  academicPaperPlugin,
  mirLabPlugin,
  mediaInspectorPlugin,
  indonesiaMapPlugin,
  chainNotesPlugin,
  blenderCompanionPlugin,
  todoPlugin,
  settingsPlugin,
  diagnosticsPlugin
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
