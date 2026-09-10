export const MAP_MODES = Object.freeze({
  PROVINCE: 'province',
  DISTRICT: 'district'
});

export const MAP_COLORS = Object.freeze([
  '#77a6d8',
  '#82c99b',
  '#c39af3',
  '#f7c66b',
  '#f06b4f',
  '#72c7c5',
  '#d39a70',
  '#a7b9e8'
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function createRegionIndex(provinces, districts) {
  const provinceByName = new Map();
  const provinceIndex = new Map();
  const districtsByProvince = new Map();
  const districtById = new Map();
  const districtByCode = new Map();

  provinces.forEach((province, index) => {
    assert(
      !provinceByName.has(province.name),
      `duplicate province: ${province.name}`
    );
    provinceByName.set(province.name, province);
    provinceIndex.set(province.name, index);
    districtsByProvince.set(province.name, []);
  });

  for (const district of districts) {
    assert(
      provinceByName.has(district.province),
      `unknown province: ${district.province}`
    );
    assert(
      !districtById.has(district.id),
      `duplicate district id: ${district.id}`
    );
    assert(
      !districtByCode.has(district.code),
      `duplicate district code: ${district.code}`
    );
    districtById.set(district.id, district);
    districtByCode.set(district.code, district);
    districtsByProvince.get(district.province).push(district);
  }

  return {
    provinces,
    districts,
    provinceByName,
    provinceIndex,
    districtsByProvince,
    districtById,
    districtByCode
  };
}

export function regionsForMode(index, mode, selectedProvince = '') {
  assert(
    mode === MAP_MODES.PROVINCE || mode === MAP_MODES.DISTRICT,
    `unknown map mode: ${mode}`
  );
  if (mode === MAP_MODES.DISTRICT) {
    return index.districtsByProvince.get(selectedProvince) || [];
  }
  return index.districts;
}

export function regionToFeature(region) {
  return {
    type: 'Feature',
    id: region.id,
    properties: {
      id: region.id,
      province: region.province,
      provinceCode: region.provinceCode,
      name: region.name,
      type: region.type,
      code: region.code
    },
    geometry: {
      type: 'MultiPolygon',
      coordinates: region.geometry
    }
  };
}

export function regionsToFeatureCollection(regions) {
  return {
    type: 'FeatureCollection',
    features: regions.map(regionToFeature)
  };
}

export function extentForRegions(regions) {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  for (const region of regions) {
    for (const polygon of region.geometry || []) {
      for (const ring of polygon) {
        for (const [longitude, latitude] of ring) {
          west = Math.min(west, longitude);
          south = Math.min(south, latitude);
          east = Math.max(east, longitude);
          north = Math.max(north, latitude);
        }
      }
    }
  }

  return west === Infinity ? null : [west, south, east, north];
}

export function formatRegionLabel(region) {
  return `${region.type} ${region.name}, ${region.province}`;
}

export function getProvinceColor(provinceName, index, colors = MAP_COLORS) {
  assert(colors.length > 0, 'map colors cannot be empty');
  const position = index.provinceIndex.get(provinceName) || 0;
  return colors[position % colors.length];
}

export function validateMapDataset(
  { source, provinces, districts },
  expected = {}
) {
  const target = {
    sourceRevision: '9469f09',
    sourceFeatureCount: 519,
    administrativeFeatureCount: 514,
    excludedNonAdministrativeFeatureCount: 5,
    provinceCount: 38,
    districtCount: 514,
    simplificationTolerance: 0.03,
    license: 'CC BY 3.0 IGO',
    ...expected
  };

  assert(source && typeof source === 'object', 'source metadata');
  assert(source.sourceRevision === target.sourceRevision, 'source revision');
  assert(
    source.sourceFeatureCount === target.sourceFeatureCount,
    'source feature count'
  );
  assert(
    source.administrativeFeatureCount === target.administrativeFeatureCount,
    'administrative feature count'
  );
  assert(
    source.excludedNonAdministrativeFeatureCount ===
      target.excludedNonAdministrativeFeatureCount,
    'excluded feature count'
  );
  assert(
    source.simplificationTolerance === target.simplificationTolerance,
    'simplification tolerance'
  );
  assert(source.license === target.license, 'license');
  assert(
    typeof source.downloadUrl === 'string' &&
      source.downloadUrl.includes(source.sourceRevision),
    'pinned download URL'
  );
  assert(Array.isArray(provinces), 'province list');
  assert(Array.isArray(districts), 'district list');
  assert(provinces.length === target.provinceCount, 'province count');
  assert(districts.length === target.districtCount, 'district count');

  const provinceCodes = new Map();
  for (const province of provinces) {
    assert(
      typeof province.name === 'string' && province.name.length > 0,
      'province name'
    );
    assert(
      typeof province.code === 'string' && /^\d{2}$/.test(province.code),
      `province code: ${province.name}`
    );
    assert(
      !provinceCodes.has(province.code),
      `duplicate province code: ${province.code}`
    );
    assert(
      Number.isInteger(province.districtCount) && province.districtCount >= 0,
      `province district count: ${province.name}`
    );
    assert(
      Number.isInteger(province.mappableCount) && province.mappableCount >= 0,
      `province mappable count: ${province.name}`
    );
    provinceCodes.set(province.code, province);
  }

  const index = createRegionIndex(provinces, districts);
  for (const province of provinces) {
    const mappedCount = index.districtsByProvince.get(province.name).length;
    assert(
      province.districtCount === mappedCount,
      `district count mismatch: ${province.name}`
    );
    assert(
      province.mappableCount === mappedCount,
      `mappable count mismatch: ${province.name}`
    );
  }

  for (const district of districts) {
    assert(
      typeof district.name === 'string' && district.name.length > 0,
      'district name'
    );
    assert(
      district.type === 'Kabupaten' || district.type === 'Kota',
      `district type: ${district.name}`
    );
    assert(
      typeof district.code === 'string' && /^\d{2}\.\d{2}$/.test(district.code),
      `district code: ${district.name}`
    );
    assert(
      provinceCodes.has(district.provinceCode),
      `unknown province code: ${district.name}`
    );
    assert(district.geometry?.length > 0, `missing geometry: ${district.name}`);
    for (const polygon of district.geometry) {
      assert(
        Array.isArray(polygon) && polygon.length > 0,
        `empty polygon: ${district.name}`
      );
      for (const ring of polygon) {
        assert(Array.isArray(ring), `invalid ring: ${district.name}`);
        assert(ring.length >= 4, `short ring: ${district.name}`);
        for (const point of ring) {
          assert(
            Array.isArray(point) && point.length >= 2,
            `invalid coordinate: ${district.name}`
          );
        }
        const first = ring[0];
        const last = ring[ring.length - 1];
        assert(
          first[0] === last[0] && first[1] === last[1],
          `open ring: ${district.name}`
        );
        for (const point of ring) {
          const [longitude, latitude] = point;
          assert(
            Number.isFinite(longitude),
            `invalid longitude: ${district.name}`
          );
          assert(
            Number.isFinite(latitude),
            `invalid latitude: ${district.name}`
          );
          assert(
            longitude >= 94 && longitude <= 142,
            `longitude out of range: ${district.name}`
          );
          assert(
            latitude >= -12 && latitude <= 8,
            `latitude out of range: ${district.name}`
          );
        }
      }
    }
  }

  return {
    sourceRevision: source.sourceRevision,
    sourceFeatureCount: source.sourceFeatureCount,
    administrativeFeatureCount: source.administrativeFeatureCount,
    excludedNonAdministrativeFeatureCount:
      source.excludedNonAdministrativeFeatureCount,
    provinceCount: provinces.length,
    districtCount: districts.length,
    index
  };
}
