import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INDONESIA_MAP_CROSSWALK } from '../src/plugins/indonesia-map-crosswalk.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(scriptDir, '..');
const outputPath = path.join(
  frontendDir,
  'src/plugins/indonesia-map-data.js'
);
const simplificationTolerance = 0.03;
const sourceRevision = '9469f09';
const sourceUrl =
  `https://github.com/wmgeolab/geoBoundaries/raw/${sourceRevision}/releaseData/gbOpen/IDN/ADM2/geoBoundaries-IDN-ADM2_simplified.geojson`;
const sourceMetadata = {
  name: 'Indonesia ADM2 boundaries',
  source: 'geoBoundaries open ADM2; BPS, WFP, and OCHA ROAP',
  sourceRevision,
  simplificationTolerance,
  url: 'https://www.geoboundaries.org/api/current/gbOpen/IDN/ADM2/',
  downloadUrl: sourceUrl,
  upstreamUrl:
    'https://data.humdata.org/dataset/indonesia-administrative-boundary-polygons-lines-and-places-levels-0-4b',
  crosswalkUrl:
    'https://github.com/marifauzan/geojson-kabupaten-kota-indonesia',
  license: 'CC BY 3.0 IGO',
  boundaryYear: '2020'
};

const aliases = new Map([
  ['Kepulauan Seribu', 'Administrasi Kepulauan Seribu'],
  ['Kota Jakarta Barat', 'Kota Administrasi Jakarta Barat'],
  ['Kota Jakarta Pusat', 'Kota Administrasi Jakarta Pusat'],
  ['Kota Jakarta Selatan', 'Kota Administrasi Jakarta Selatan'],
  ['Kota Jakarta Timur', 'Kota Administrasi Jakarta Timur'],
  ['Kota Jakarta Utara', 'Kota Administrasi Jakarta Utara'],
  ['Kota Padangsidimpuan', 'Kota Padang Sidempuan'],
  ['Mahakam Hulu', 'Mahakam Ulu'],
  ['Maluku Tenggara Barat', 'Kepulauan Tanimbar'],
  ['Mamuju Utara', 'Pasangkayu'],
  ['Pangkajene Dan Kepulauan', 'Pangkajene Kepulauan'],
  ['Siau Tagulandang Biaro', 'Kepulauan Siau Tagulandang Biaro'],
  ['Toba Samosir', 'Toba']
]);
const ignoredNames = new Set([
  'Danau',
  'Danau Toba',
  'Hutan',
  'Waduk Cirata',
  'Wadung Kedungombo'
]);

function normalizeName(value) {
  return String(value || '')
    .toLocaleLowerCase('id-ID')
    .replace(/[^a-z0-9]+/g, '');
}

const labelsByName = new Map();
for (const label of INDONESIA_MAP_CROSSWALK) {
  const key = normalizeName(label.name);
  if (labelsByName.has(key)) {
    throw new Error(`Duplicate crosswalk name: ${label.name}`);
  }
  labelsByName.set(key, label);
}

async function loadSource() {
  const localSourcePath = process.env.INDONESIA_MAP_SOURCE_FILE;
  if (localSourcePath) {
    return JSON.parse(fs.readFileSync(localSourcePath, 'utf8'));
  }
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Unable to download map source: ${response.status}`);
  }
  return response.json();
}

function labelForShape(shapeName) {
  const alias = aliases.get(shapeName) || shapeName;
  return labelsByName.get(normalizeName(alias));
}

function distanceSquared(point, start, end) {
  let x = start[0];
  let y = start[1];
  let dx = end[0] - x;
  let dy = end[1] - y;
  if (dx !== 0 || dy !== 0) {
    const position =
      ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy);
    if (position > 1) {
      x = end[0];
      y = end[1];
    } else if (position > 0) {
      x += dx * position;
      y += dy * position;
    }
  }
  dx = point[0] - x;
  dy = point[1] - y;
  return dx * dx + dy * dy;
}

function simplifyLine(points) {
  if (points.length <= 2) return points;
  const marked = new Uint8Array(points.length);
  marked[0] = 1;
  marked[points.length - 1] = 1;
  const toleranceSquared = simplificationTolerance * simplificationTolerance;

  function simplify(first, last) {
    let largest = toleranceSquared;
    let index = 0;
    for (let cursor = first + 1; cursor < last; cursor += 1) {
      const distance = distanceSquared(points[cursor], points[first], points[last]);
      if (distance > largest) {
        index = cursor;
        largest = distance;
      }
    }
    if (index !== 0) {
      marked[index] = 1;
      simplify(first, index);
      simplify(index, last);
    }
  }

  simplify(0, points.length - 1);
  return points.filter((_, index) => marked[index]);
}

function roundedPoint([longitude, latitude]) {
  return [Number(longitude.toFixed(3)), Number(latitude.toFixed(3))];
}

function simplifyRing(ring) {
  const simplified = simplifyLine(ring).map(roundedPoint);
  return simplified.length >= 4 ? simplified : ring.map(roundedPoint);
}

function simplifyGeometry(feature) {
  if (feature.geometry?.type === 'Polygon') {
    return [feature.geometry.coordinates.map(simplifyRing)];
  }
  if (feature.geometry?.type === 'MultiPolygon') {
    return feature.geometry.coordinates.map((polygon) =>
      polygon.map(simplifyRing)
    );
  }
  throw new Error(`Unsupported geometry: ${feature.geometry?.type || 'none'}`);
}

function buildData(source) {
  const districts = [];
  const unmatched = [];
  for (const feature of source.features || []) {
    const shapeName = feature.properties?.shapeName;
    if (ignoredNames.has(shapeName)) continue;
    const label = labelForShape(shapeName);
    if (!label) {
      unmatched.push(shapeName);
      continue;
    }
    districts.push({
      id: feature.properties.shapeID,
      province: label.province,
      provinceCode: label.provinceCode,
      name: label.name,
      type: label.type,
      code: label.code,
      geometry: simplifyGeometry(feature)
    });
  }

  if (unmatched.length > 0) {
    throw new Error(`Unmatched GeoBoundaries names: ${unmatched.join(', ')}`);
  }
  if (source.features.length - districts.length !== 5) {
    throw new Error(
      `Expected five excluded non-administrative features, got ${source.features.length - districts.length}`
    );
  }
  if (districts.length !== 514) {
    throw new Error(`Expected 514 administrative areas, got ${districts.length}`);
  }

  const counts = new Map();
  for (const district of districts) {
    const current = counts.get(district.province) || {
      districtCount: 0,
      mappableCount: 0
    };
    current.districtCount += 1;
    current.mappableCount += 1;
    counts.set(district.province, current);
  }
  const provinceNames = [...counts.keys()].sort((left, right) =>
    left.localeCompare(right, 'id-ID')
  );
  const provinceLabels = new Map(
    INDONESIA_MAP_CROSSWALK.map((label) => [label.province, label])
  );
  const provinces = provinceNames.map((name) => ({
    name,
    code: provinceLabels.get(name).provinceCode,
    ...counts.get(name)
  }));

  return { districts, provinces };
}

function renderData(source, { districts, provinces }) {
  const metadata = {
    ...sourceMetadata,
    sourceFeatureCount: source.features.length,
    administrativeFeatureCount: districts.length,
    excludedNonAdministrativeFeatureCount:
      source.features.length - districts.length
  };
  return [
    '// biome-ignore-all lint/suspicious/noApproximativeNumericConstant: Coordinates are geographic data, not mathematical constants.',
    `export const INDONESIA_MAP_SOURCE = ${JSON.stringify(metadata)};`,
    '',
    `export const INDONESIA_PROVINCES = ${JSON.stringify(provinces)};`,
    '',
    'export const INDONESIA_DISTRICTS = [',
    ...districts.map(
      (district, index) =>
        `${JSON.stringify(district)}${index === districts.length - 1 ? '' : ','}`
    ),
    '];',
    ''
  ].join('\n');
}

const source = await loadSource();
const data = buildData(source);
fs.writeFileSync(outputPath, renderData(source, data));
console.log(
  JSON.stringify({
    provinces: data.provinces.length,
    districts: data.districts.length,
    output: path.relative(process.cwd(), outputPath)
  })
);
