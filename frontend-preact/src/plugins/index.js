import { AcademicPaper } from './academic-paper.jsx';
import { AudioEqualizer } from './audio-equalizer.jsx';
import { defineFrontendPlugin } from './contract.js';
import { DiskScanner } from './disk-scanner.jsx';
import { IndonesiaMap } from './indonesia-map.jsx';
import { MirLab } from './mir-lab.jsx';
import { TabVault } from './tab-vault.jsx';

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

const registeredPlugins = [
  diskScannerPlugin,
  audioEqualizerPlugin,
  tabVaultPlugin,
  academicPaperPlugin,
  mirLabPlugin,
  indonesiaMapPlugin
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
