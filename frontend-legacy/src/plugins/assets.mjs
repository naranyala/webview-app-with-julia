// Studio asset helpers (ported from the vlang sibling's `assets.mjs`).
// Pure functions over plain records: no DOM, no bridge, no Preact.
// Candidate for the future shared JS library as-is.
const ASSET_EXTENSIONS = {
  blend: 'blender',
  blend1: 'blender',
  exr: 'render',
  png: 'render',
  jpg: 'render',
  jpeg: 'render',
  wav: 'audio',
  flac: 'audio',
  mp3: 'audio',
  ogg: 'audio',
  mid: 'audio',
  midi: 'audio'
};

export function classifyAsset(filename) {
  const ext = String(filename || '')
    .split('.')
    .pop()
    .toLowerCase();
  return ASSET_EXTENSIONS[ext] || 'other';
}

export function parseAssetRecords(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item.path !== 'string' || !item.path) return [];
    return [
      {
        id: String(item.id || item.path),
        path: item.path,
        kind: item.kind || classifyAsset(item.path),
        size: Number(item.size) || 0,
        updated: String(item.updated || '')
      }
    ];
  });
}

export function summarizeAssets(assets) {
  const summary = { blender: 0, audio: 0, render: 0, other: 0, bytes: 0 };
  for (const asset of assets) {
    if (summary[asset.kind] !== undefined) summary[asset.kind] += 1;
    else summary.other += 1;
    summary.bytes += asset.size || 0;
  }
  return summary;
}

export function createAssetScanJob(volumeId) {
  return {
    id: `scan-${Date.now()}`,
    volumeId,
    state: 'queued',
    scannedFiles: 0,
    scannedBytes: 0,
    topEntries: []
  };
}

export function advanceAssetScanJob(job, batch) {
  const records = parseAssetRecords(batch);
  return {
    ...job,
    state: 'running',
    scannedFiles: job.scannedFiles + records.length,
    scannedBytes:
      job.scannedBytes + records.reduce((sum, item) => sum + item.size, 0),
    topEntries: [...job.topEntries, ...records]
      .sort((a, b) => b.size - a.size)
      .slice(0, 20)
  };
}

export function completeAssetScanJob(job) {
  return { ...job, state: 'completed' };
}
