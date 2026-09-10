import {
  INDONESIA_DISTRICTS,
  INDONESIA_MAP_SOURCE,
  INDONESIA_PROVINCES
} from './indonesia-map-data.js';
import {
  createRegionIndex,
  extentForRegions,
  regionsForMode,
  regionsToFeatureCollection
} from './indonesia-map-utils.js';

// Public, renderer-neutral map surface. Consumers should treat the bundled
// arrays as read-only and use the lookup helpers for stable access.
export const INDONESIA_REGION_INDEX = createRegionIndex(
  INDONESIA_PROVINCES,
  INDONESIA_DISTRICTS
);
export const INDONESIA_MAP_EXTENT = extentForRegions(INDONESIA_DISTRICTS);
export const INDONESIA_MAP_GEOJSON =
  regionsToFeatureCollection(INDONESIA_DISTRICTS);
export const INDONESIA_MAP_MODEL = Object.freeze({
  source: INDONESIA_MAP_SOURCE,
  provinces: INDONESIA_PROVINCES,
  districts: INDONESIA_DISTRICTS,
  index: INDONESIA_REGION_INDEX,
  extent: INDONESIA_MAP_EXTENT,
  geojson: INDONESIA_MAP_GEOJSON
});

export function getIndonesiaRegions(mode, selectedProvince = '') {
  return regionsForMode(INDONESIA_REGION_INDEX, mode, selectedProvince);
}

export function getIndonesiaRegion({ id, code } = {}) {
  if (id) return INDONESIA_REGION_INDEX.districtById.get(id);
  if (code) return INDONESIA_REGION_INDEX.districtByCode.get(code);
  return undefined;
}
