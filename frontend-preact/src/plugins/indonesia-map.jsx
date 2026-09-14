import L from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import 'leaflet/dist/leaflet.css';
import { styles, sx } from '../stylex-styles.js';
import {
  INDONESIA_MAP_MODEL,
  INDONESIA_REGION_INDEX
} from './indonesia-map-api.js';
import {
  extentForRegions,
  formatRegionLabel,
  getProvinceColor,
  regionsForMode,
  regionsToFeatureCollection
} from './indonesia-map-utils.js';

const INDONESIA_CENTER = [-2.3, 118];
const INDONESIA_ZOOM = 4;

const { districts: INDONESIA_DISTRICTS, provinces: INDONESIA_PROVINCES } =
  INDONESIA_MAP_MODEL;
const regionIndex = INDONESIA_REGION_INDEX;

export function IndonesiaMap({
  mode = 'province',
  selectedProvince = '',
  onModeChange,
  onProvinceChange
}) {
  const [query, setQuery] = useState('');
  const [selectedDistrictId, setSelectedDistrictId] = useState('');
  const [mapReady, setMapReady] = useState(false);
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  const activeProvince =
    selectedProvince ||
    (mode === 'district' ? INDONESIA_PROVINCES[0]?.name : '');
  const focusedDistricts =
    regionIndex.districtsByProvince.get(activeProvince) || [];
  const mapDistricts = useMemo(
    () =>
      regionsForMode(regionIndex, mode, activeProvince).filter(
        (district) => district.geometry
      ),
    [activeProvince, mode]
  );
  const selectedDistrict = INDONESIA_DISTRICTS.find(
    (district) => district.id === selectedDistrictId
  );
  const selectedProvinceRecord = regionIndex.provinceByName.get(activeProvince);
  const mapViewRegions = useMemo(() => {
    if (mode === 'district' && selectedDistrict) return [selectedDistrict];
    if (mode === 'province' && activeProvince) return focusedDistricts;
    return mapDistricts;
  }, [activeProvince, focusedDistricts, mapDistricts, mode, selectedDistrict]);
  const tableRows = selectedDistrict
    ? [selectedDistrict]
    : activeProvince
      ? focusedDistricts
      : INDONESIA_PROVINCES;
  const tableScope = selectedDistrict
    ? 'selected'
    : activeProvince
      ? 'districts'
      : 'provinces';
  const tableLabel =
    tableScope === 'selected'
      ? 'Selected area data'
      : tableScope === 'districts'
        ? `${activeProvince} area data`
        : 'Province data';
  const normalizedQuery = query.trim().toLocaleLowerCase('id-ID');
  const visibleList = useMemo(() => {
    if (mode === 'province') {
      return INDONESIA_PROVINCES.filter((province) =>
        normalizedQuery
          ? province.name.toLocaleLowerCase('id-ID').includes(normalizedQuery)
          : true
      );
    }
    return focusedDistricts.filter((district) => {
      if (!normalizedQuery) return true;
      return `${district.name} ${district.type}`
        .toLocaleLowerCase('id-ID')
        .includes(normalizedQuery);
    });
  }, [focusedDistricts, mode, normalizedQuery]);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return undefined;

    const map = L.map(container, {
      center: INDONESIA_CENTER,
      zoom: INDONESIA_ZOOM,
      zoomControl: true,
      attributionControl: false,
      preferCanvas: false
    });
    mapRef.current = map;
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
    L.control
      .attribution({ prefix: 'Leaflet' })
      .addAttribution(`Boundary data: ${INDONESIA_MAP_MODEL.source.source}`)
      .addTo(map);
    const invalidateSize = () => map.invalidateSize({ pan: false });
    const resizeObserver =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(invalidateSize)
        : null;
    resizeObserver?.observe(container);
    window.addEventListener('resize', invalidateSize);
    setMapReady(true);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', invalidateSize);
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return undefined;

    const layer = L.geoJSON(regionsToFeatureCollection(mapDistricts), {
      style: (feature) => {
        const region = feature.properties;
        const provinceIsSelected =
          activeProvince && region.province === activeProvince;
        const isSelected = region.id === selectedDistrictId;
        const fillColor = isSelected
          ? '#f7c66b'
          : mode === 'district'
            ? '#77a6d8'
            : getProvinceColor(region.province, regionIndex);
        return {
          color: isSelected ? '#f7c66b' : '#111214',
          weight: isSelected ? 2.5 : 0.8,
          fillColor,
          fillOpacity:
            mode === 'province' && activeProvince && !provinceIsSelected
              ? 0.42
              : 0.82,
          opacity: 1,
          lineJoin: 'round',
          lineCap: 'round'
        };
      },
      onEachFeature: (feature, regionLayer) => {
        const region = feature.properties;
        regionLayer.bindTooltip(formatRegionLabel(region), { sticky: true });
        regionLayer.on({
          click: () => {
            if (mode === 'province') chooseProvince(region.province);
            else chooseDistrict(region);
          },
          mouseover: (event) => {
            event.target.setStyle({
              weight: mode === 'district' ? 2.5 : 1.4,
              fillOpacity: 0.95
            });
            event.target.bringToFront();
          },
          mouseout: (event) => layer.resetStyle(event.target)
        });
      }
    }).addTo(map);

    const extent = extentForRegions(mapViewRegions);
    if (extent) {
      map.fitBounds(
        [
          [extent[1], extent[0]],
          [extent[3], extent[2]]
        ],
        {
          padding: [18, 18],
          maxZoom: mode === 'district' ? 9 : 5,
          animate: false
        }
      );
    } else {
      map.setView(INDONESIA_CENTER, INDONESIA_ZOOM, { animate: false });
    }
    map.invalidateSize();

    return () => {
      if (map.hasLayer(layer)) map.removeLayer(layer);
    };
  }, [
    activeProvince,
    mapDistricts,
    mapReady,
    mapViewRegions,
    mode,
    selectedDistrictId
  ]);

  useEffect(() => {
    if (selectedDistrict && selectedDistrict.province !== activeProvince) {
      setSelectedDistrictId('');
    }
  }, [activeProvince, selectedDistrict]);

  function changeMode(nextMode) {
    setSelectedDistrictId('');
    setQuery('');
    onModeChange?.(nextMode);
    if (nextMode === 'district' && !selectedProvince) {
      onProvinceChange?.(INDONESIA_PROVINCES[0]?.name || '');
    }
  }

  function chooseProvince(name) {
    setSelectedDistrictId('');
    setQuery('');
    if (mode === 'district' && !name) onModeChange?.('province');
    onProvinceChange?.(name);
  }

  function chooseDistrict(district) {
    setSelectedDistrictId(district.id);
    setQuery('');
    onModeChange?.('district');
    onProvinceChange?.(district.province);
  }

  function resetView() {
    setQuery('');
    setSelectedDistrictId('');
    onModeChange?.('province');
    onProvinceChange?.('');
  }

  function handleRegionKeyDown(event, region, kind) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    if (kind === 'province') chooseProvince(region.name);
    else chooseDistrict(region);
  }

  return (
    <section className={sx('tool-page', 'map-page')}>
      <div className={sx('tool-heading')}>
        <div>
          <p className={sx('eyebrow')}>Places</p>
          <h1 className={sx('page-title')}>Indonesia Atlas</h1>
          <p className={sx('lede')}>
            A focused, offline-friendly boundary map for provinces and
            kabupaten/kota.
          </p>
        </div>
        <span className={sx('mock-badge')}>
          38 provinces · {INDONESIA_DISTRICTS.length} areas
        </span>
      </div>

      <div className={sx('map-frame')}>
        <section
          className={sx('frame-pane')}
          aria-label="Indonesia boundary map"
        >
          <div className={sx('map-panel-heading')}>
            <div>
              <p className={sx('panel-label')}>Boundary view</p>
              <h2 className={sx('panel-title')}>
                {mode === 'province'
                  ? selectedProvince || 'All provinces'
                  : selectedProvinceRecord?.name || 'Choose a province'}
              </h2>
            </div>
            <div className={sx('map-panel-actions')}>
              <span className={sx('map-count')}>
                {mode === 'province'
                  ? activeProvince
                    ? `${focusedDistricts.length} areas in focus`
                    : `${INDONESIA_PROVINCES.length} provinces`
                  : `${focusedDistricts.length} areas`}
              </span>
              <button
                type="button"
                className={sx('text-button', 'map-reset')}
                onClick={resetView}
              >
                Reset view
              </button>
            </div>
          </div>

          <div className={sx('map-toolbar')}>
            <fieldset className={sx('map-mode')}>
              <legend className={sx('sr-only')}>Map level</legend>
              <button
                type="button"
                className={sx(
                  'map-mode-button',
                  mode === 'province' && styles.mapModeActive
                )}
                onClick={() => changeMode('province')}
                aria-pressed={mode === 'province'}
              >
                Provinces
              </button>
              <button
                type="button"
                className={sx(
                  'map-mode-button',
                  mode === 'district' && styles.mapModeActive
                )}
                onClick={() => changeMode('district')}
                aria-pressed={mode === 'district'}
              >
                Kabupaten / Kota
              </button>
            </fieldset>
            <label className={sx('map-select-wrap')}>
              <span className={sx('sr-only')}>Focus province</span>
              <select
                className={sx('map-select')}
                value={activeProvince}
                onChange={(event) => chooseProvince(event.currentTarget.value)}
                aria-label="Focus province"
              >
                <option value="">
                  {mode === 'district'
                    ? 'All provinces · overview'
                    : 'All provinces'}
                </option>
                {INDONESIA_PROVINCES.map((province) => (
                  <option key={province.name} value={province.name}>
                    {province.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className={sx('map-canvas')}>
            <section
              ref={mapContainerRef}
              className={sx('map-leaflet')}
              aria-label={
                mode === 'province'
                  ? 'Clickable map of Indonesian provinces'
                  : `Clickable map of ${activeProvince} kabupaten and kota`
              }
            />
            <div className={sx('map-overlay')}>
              <span className={sx('map-overlay-kicker')}>INDONESIA</span>
              <span>
                {mode === 'province' ? 'Province level' : 'ADM2 level'}
              </span>
            </div>
          </div>

          <div className={sx('map-footer')}>
            <span>
              {mapDistricts.length} mapped shapes · tap a shape or use the
              browser/table to select it
            </span>
            <span className={sx('map-source-mark')}>WGS84</span>
          </div>
        </section>

        <div className={sx('frame-divider')} aria-hidden="true" />

        <aside className={sx('frame-pane')} aria-label="Map region browser">
          <div className={sx('map-browser-heading')}>
            <div>
              <p className={sx('panel-label')}>Browse</p>
              <h2 className={sx('panel-title')}>
                {mode === 'province'
                  ? 'Provinces'
                  : selectedProvinceRecord?.name || 'Areas'}
              </h2>
            </div>
            <span className={sx('map-count')}>
              {mode === 'province'
                ? INDONESIA_PROVINCES.length
                : focusedDistricts.length}
            </span>
          </div>
          <label className={sx('map-search-wrap')}>
            <span className={sx('sr-only')}>
              Search {mode === 'province' ? 'provinces' : 'kabupaten and kota'}
            </span>
            <input
              className={sx('map-search')}
              type="search"
              value={query}
              onInput={(event) => setQuery(event.currentTarget.value)}
              placeholder={
                mode === 'province'
                  ? 'Find a province'
                  : 'Find a kabupaten or kota'
              }
            />
          </label>
          <div className={sx('map-list')}>
            {visibleList.map((region) => {
              const isProvince = mode === 'province';
              const name = isProvince ? region.name : region.name;
              const isActive = isProvince
                ? region.name === activeProvince
                : region.id === selectedDistrictId;
              return (
                <button
                  type="button"
                  key={isProvince ? region.name : region.id}
                  className={sx(
                    'map-list-item',
                    isActive && styles.mapListItemActive
                  )}
                  onClick={() =>
                    isProvince
                      ? chooseProvince(region.name)
                      : chooseDistrict(region)
                  }
                  onKeyDown={(event) =>
                    handleRegionKeyDown(
                      event,
                      region,
                      isProvince ? 'province' : 'district'
                    )
                  }
                  aria-current={isActive ? 'true' : undefined}
                >
                  <span
                    className={sx('map-list-color')}
                    style={{
                      backgroundColor: isProvince
                        ? getProvinceColor(region.name, regionIndex)
                        : '#77a6d8'
                    }}
                  />
                  <span className={sx('map-list-copy')}>
                    <strong>{name}</strong>
                    <small>
                      {isProvince
                        ? `${region.districtCount} kabupaten/kota`
                        : `${region.type} · ${region.province}`}
                    </small>
                  </span>
                  <span className={sx('map-list-chevron')} aria-hidden="true">
                    ›
                  </span>
                </button>
              );
            })}
            {visibleList.length === 0 && (
              <p className={sx('map-empty')}>No matching region.</p>
            )}
          </div>
        </aside>
      </div>

      <section className={sx('map-data-panel')} aria-label={tableLabel}>
        <div className={sx('map-data-heading')}>
          <div>
            <p className={sx('panel-label')}>Data table</p>
            <h2 className={sx('panel-title')}>
              {tableScope === 'selected'
                ? 'Selected area data'
                : tableScope === 'districts'
                  ? `${activeProvince} areas`
                  : 'Province overview'}
            </h2>
          </div>
          <span className={sx('map-count')}>
            {tableRows.length}{' '}
            {tableScope === 'provinces' ? 'provinces' : 'areas'}
          </span>
        </div>
        <div className={sx('map-table-scroll')}>
          <table className={sx('map-table')} aria-label={tableLabel}>
            <caption className={sx('sr-only')}>{tableLabel}</caption>
            <thead>
              <tr>
                <th className={sx('map-table-head')} scope="col">
                  {tableScope === 'provinces' ? 'Province' : 'Area'}
                </th>
                <th className={sx('map-table-head')} scope="col">
                  {tableScope === 'provinces' ? 'BPS code' : 'Type'}
                </th>
                <th className={sx('map-table-head')} scope="col">
                  {tableScope === 'provinces' ? 'Areas' : 'Code'}
                </th>
                <th className={sx('map-table-head')} scope="col">
                  {tableScope === 'provinces' ? 'Mappable' : 'Province'}
                </th>
                {tableScope !== 'provinces' && (
                  <th
                    className={sx('map-table-head', styles.mapTableDetail)}
                    scope="col"
                  >
                    Boundary ID
                  </th>
                )}
                {tableScope !== 'provinces' && (
                  <th
                    className={sx('map-table-head', styles.mapTableDetail)}
                    scope="col"
                  >
                    Geometry parts
                  </th>
                )}
                <th className={sx('map-table-head')} scope="col">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((region) => {
                const isProvince = tableScope === 'provinces';
                const isSelected = selectedDistrict?.id === region.id;
                const actionLabel = isProvince
                  ? `Focus ${region.name}`
                  : isSelected
                    ? `Selected ${region.name}`
                    : `Select ${region.name}`;
                return (
                  <tr
                    className={sx('map-table-row')}
                    key={isProvince ? region.name : region.id}
                  >
                    <th className={sx('map-table-cell')} scope="row">
                      {region.name}
                    </th>
                    <td className={sx('map-table-cell')}>
                      {isProvince ? region.code : region.type}
                    </td>
                    <td className={sx('map-table-cell')}>
                      {isProvince ? region.districtCount : region.code}
                    </td>
                    <td className={sx('map-table-cell')}>
                      {isProvince ? region.mappableCount : region.province}
                    </td>
                    {!isProvince && (
                      <td
                        className={sx('map-table-cell', styles.mapTableDetail)}
                      >
                        {region.id}
                      </td>
                    )}
                    {!isProvince && (
                      <td
                        className={sx('map-table-cell', styles.mapTableDetail)}
                      >
                        {region.geometry.length}
                      </td>
                    )}
                    <td className={sx('map-table-cell')}>
                      <button
                        type="button"
                        className={sx('map-table-action')}
                        onClick={() =>
                          isProvince
                            ? chooseProvince(region.name)
                            : chooseDistrict(region)
                        }
                        aria-label={actionLabel}
                        aria-pressed={
                          tableScope === 'selected' ? isSelected : undefined
                        }
                      >
                        {isProvince
                          ? 'Focus'
                          : isSelected
                            ? 'Selected'
                            : 'Select'}
                        <span className={sx('map-table-action-name')}>
                          {' '}
                          {region.name}
                        </span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {tableRows.length === 0 && (
            <p className={sx('map-table-empty')}>
              No mapped data for this selection.
            </p>
          )}
        </div>
      </section>

      {selectedDistrict && (
        <section className={sx('map-selection')} aria-live="polite">
          <div>
            <p className={sx('map-selection-type')}>{selectedDistrict.type}</p>
            <h2 className={sx('map-selection-name')}>
              {selectedDistrict.name}
            </h2>
            <p className={sx('muted')}>
              {selectedDistrict.province} · code{' '}
              {selectedDistrict.code || 'not available'}
            </p>
          </div>
          <button
            type="button"
            className={sx('text-button')}
            onClick={() => setSelectedDistrictId('')}
          >
            Clear selection
          </button>
        </section>
      )}

      <p className={sx('map-source')}>
        Boundary source: {INDONESIA_MAP_MODEL.source.source}. This bundled
        snapshot is simplified for the offline WebView and retains province,
        kabupaten, and kota names/codes.
      </p>
    </section>
  );
}
