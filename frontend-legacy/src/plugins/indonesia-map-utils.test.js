import { describe, expect, test } from 'vitest';
import {
  getIndonesiaRegion,
  getIndonesiaRegions,
  INDONESIA_MAP_EXTENT,
  INDONESIA_MAP_GEOJSON,
  INDONESIA_MAP_MODEL,
  INDONESIA_REGION_INDEX
} from './indonesia-map-api.js';
import {
  INDONESIA_DISTRICTS,
  INDONESIA_MAP_SOURCE,
  INDONESIA_PROVINCES
} from './indonesia-map-data.js';
import {
  createRegionIndex,
  extentForRegions,
  formatRegionLabel,
  getProvinceColor,
  MAP_MODES,
  regionsForMode,
  regionsToFeatureCollection,
  validateMapDataset
} from './indonesia-map-utils.js';

const index = createRegionIndex(INDONESIA_PROVINCES, INDONESIA_DISTRICTS);

describe('Indonesia map utilities', () => {
  test('indexes provinces and districts for both map levels', () => {
    expect(regionsForMode(index, MAP_MODES.PROVINCE)).toHaveLength(514);
    expect(regionsForMode(index, MAP_MODES.DISTRICT, 'Bali')).toHaveLength(9);
    expect(index.districtByCode.get('51.03').name).toBe('Badung');
    expect(() => regionsForMode(index, 'invalid')).toThrow('unknown map mode');
  });

  test('exports a renderer-neutral GeoJSON FeatureCollection', () => {
    const bali = regionsForMode(index, MAP_MODES.DISTRICT, 'Bali');
    const collection = regionsToFeatureCollection(bali);

    expect(collection.type).toBe('FeatureCollection');
    expect(collection.features).toHaveLength(9);
    expect(collection.features[0].id).toBe(bali[0].id);
    expect(collection.features[0].geometry.type).toBe('MultiPolygon');
    expect(collection.features[0].properties.province).toBe('Bali');
    expect(collection.features[0].properties.code).toBe('51.03');
    expect(formatRegionLabel(bali[0])).toBe('Kabupaten Badung, Bali');
    const extent = extentForRegions(bali);
    expect(extent).toHaveLength(4);
    expect(extent[0]).toBeLessThan(extent[2]);
    expect(extent[1]).toBeLessThan(extent[3]);
    expect(extentForRegions([])).toBeNull();
  });

  test('keeps colors deterministic and validates the checked-in dataset', () => {
    expect(getProvinceColor('Bali', index)).toBe('#82c99b');
    expect(getProvinceColor('unknown', index, ['#abc'])).toBe('#abc');
    expect(() => getProvinceColor('Bali', index, [])).toThrow(
      'map colors cannot be empty'
    );
    const summary = validateMapDataset({
      source: INDONESIA_MAP_SOURCE,
      provinces: INDONESIA_PROVINCES,
      districts: INDONESIA_DISTRICTS
    });

    expect(summary).toMatchObject({
      sourceRevision: '9469f09',
      sourceFeatureCount: 519,
      administrativeFeatureCount: 514,
      provinceCount: 38,
      districtCount: 514
    });
  });

  test('exposes a reusable map model and stable district lookups', () => {
    expect(INDONESIA_MAP_MODEL.source).toBe(INDONESIA_MAP_SOURCE);
    expect(INDONESIA_MAP_MODEL.index).toBe(INDONESIA_REGION_INDEX);
    expect(INDONESIA_MAP_GEOJSON.type).toBe('FeatureCollection');
    expect(INDONESIA_MAP_GEOJSON.features).toHaveLength(514);
    expect(INDONESIA_MAP_EXTENT).toHaveLength(4);
    expect(getIndonesiaRegions(MAP_MODES.DISTRICT, 'Bali')).toHaveLength(9);
    expect(getIndonesiaRegion({ id: index.districts[0].id }).code).toBe(
      index.districts[0].code
    );
    expect(getIndonesiaRegion({ code: '51.03' }).name).toBe('Badung');
    expect(getIndonesiaRegion({ id: 'missing' })).toBeUndefined();
    expect(getIndonesiaRegion()).toBeUndefined();
  });

  test('rejects duplicate and orphaned index records', () => {
    const province = { name: 'Test', code: '99' };
    const district = { id: 'district-1', code: '99.01', province: 'Test' };
    expect(() => createRegionIndex([province, province], [])).toThrow(
      'duplicate province'
    );
    expect(() =>
      createRegionIndex([province], [{ ...district, province: 'Missing' }])
    ).toThrow('unknown province');
    expect(() =>
      createRegionIndex(
        [province],
        [district, { ...district, id: 'district-2' }]
      )
    ).toThrow('duplicate district code');
  });

  test('rejects malformed metadata, crosswalk counts, and geometry', () => {
    const base = {
      source: INDONESIA_MAP_SOURCE,
      provinces: INDONESIA_PROVINCES,
      districts: INDONESIA_DISTRICTS
    };
    const duplicateProvinceCode = INDONESIA_PROVINCES.map((province, i) =>
      i === 1 ? { ...province, code: INDONESIA_PROVINCES[0].code } : province
    );
    expect(() =>
      validateMapDataset({ ...base, provinces: duplicateProvinceCode })
    ).toThrow('duplicate province code');

    const unpinnedSource = {
      ...INDONESIA_MAP_SOURCE,
      downloadUrl: INDONESIA_MAP_SOURCE.downloadUrl.replace('9469f09', 'main')
    };
    expect(() =>
      validateMapDataset({ ...base, source: unpinnedSource })
    ).toThrow('pinned download URL');

    const mismatchedCounts = INDONESIA_PROVINCES.map((province, i) =>
      i === 0
        ? { ...province, districtCount: province.districtCount + 1 }
        : province
    );
    expect(() =>
      validateMapDataset({ ...base, provinces: mismatchedCounts })
    ).toThrow('district count mismatch');

    const invalidDistrictCode = INDONESIA_DISTRICTS.map((district, i) =>
      i === 0 ? { ...district, code: 'invalid' } : district
    );
    expect(() =>
      validateMapDataset({ ...base, districts: invalidDistrictCode })
    ).toThrow('district code');

    const openGeometry = INDONESIA_DISTRICTS.map((district, i) => {
      if (i !== 0) return district;
      const geometry = district.geometry.map((polygon) =>
        polygon.map((ring) =>
          ring.map((point, pointIndex) =>
            pointIndex === ring.length - 1 ? [point[0] + 0.1, point[1]] : point
          )
        )
      );
      return { ...district, geometry };
    });
    expect(() =>
      validateMapDataset({ ...base, districts: openGeometry })
    ).toThrow('open ring');

    const invalidPoint = INDONESIA_DISTRICTS.map((district, i) => {
      if (i !== 0) return district;
      const geometry = district.geometry.map((polygon, polygonIndex) =>
        polygonIndex === 0
          ? polygon.map((ring, ringIndex) =>
              ringIndex === 0 ? [null, ...ring.slice(1)] : ring
            )
          : polygon
      );
      return { ...district, geometry };
    });
    expect(() =>
      validateMapDataset({ ...base, districts: invalidPoint })
    ).toThrow('invalid coordinate');
  });
});
