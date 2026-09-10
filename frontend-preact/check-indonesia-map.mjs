import {
  getIndonesiaRegion,
  INDONESIA_MAP_GEOJSON,
  INDONESIA_MAP_MODEL,
  INDONESIA_REGION_INDEX
} from './src/plugins/indonesia-map-api.js';
import {
  INDONESIA_DISTRICTS,
  INDONESIA_MAP_SOURCE,
  INDONESIA_PROVINCES
} from './src/plugins/indonesia-map-data.js';
import { validateMapDataset } from './src/plugins/indonesia-map-utils.js';

const summary = validateMapDataset({
  source: INDONESIA_MAP_SOURCE,
  provinces: INDONESIA_PROVINCES,
  districts: INDONESIA_DISTRICTS
});
if (INDONESIA_MAP_MODEL.source !== INDONESIA_MAP_SOURCE) {
  throw new Error('public map model source is out of sync');
}
if (INDONESIA_MAP_MODEL.index !== INDONESIA_REGION_INDEX) {
  throw new Error('public map model index is out of sync');
}
if (INDONESIA_MAP_MODEL.geojson !== INDONESIA_MAP_GEOJSON) {
  throw new Error('public map model GeoJSON is out of sync');
}
if (INDONESIA_MAP_GEOJSON.features.length !== summary.districtCount) {
  throw new Error('public map GeoJSON count is out of sync');
}
if (getIndonesiaRegion({ code: '51.03' })?.name !== 'Badung') {
  throw new Error('public map code lookup is out of sync');
}
console.log(
  `indonesia map data: ${summary.provinceCount} provinces, ${summary.districtCount} ADM2 geometries passed`
);
