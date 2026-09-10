import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import L from 'leaflet';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { IndonesiaMap } from './indonesia-map.jsx';
import { INDONESIA_DISTRICTS } from './indonesia-map-data.js';

const originalClientWidth = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'clientWidth'
);
const originalClientHeight = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'clientHeight'
);
const originalResizeObserver = globalThis.ResizeObserver;
let resizeObserverCallback;
let invalidateSizeSpy;

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => 640
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => 360
  });
  globalThis.ResizeObserver = class {
    constructor(callback) {
      resizeObserverCallback = callback;
    }

    observe() {}

    disconnect() {}
  };
  invalidateSizeSpy = vi.spyOn(L.Map.prototype, 'invalidateSize');
});

afterEach(() => {
  cleanup();
  if (originalClientWidth)
    Object.defineProperty(
      HTMLElement.prototype,
      'clientWidth',
      originalClientWidth
    );
  if (originalClientHeight)
    Object.defineProperty(
      HTMLElement.prototype,
      'clientHeight',
      originalClientHeight
    );
  globalThis.ResizeObserver = originalResizeObserver;
  invalidateSizeSpy.mockRestore();
  resizeObserverCallback = undefined;
});

describe('IndonesiaMap', () => {
  test('initializes Leaflet with bundled boundary layers', () => {
    const onProvinceChange = vi.fn();
    render(<IndonesiaMap onProvinceChange={onProvinceChange} />);

    expect(document.querySelector('h1')?.textContent).toBe('Indonesia Atlas');
    expect(document.querySelector('.leaflet-container')).toBeTruthy();
    expect(document.querySelectorAll('.leaflet-interactive')).toHaveLength(514);
    expect(document.querySelector('.leaflet-control-zoom')).toBeTruthy();
    expect(document.querySelector('.leaflet-control-scale')).toBeTruthy();
    expect(document.querySelector('.leaflet-control-attribution')).toBeTruthy();
    const provinceTable = document.querySelector(
      'table[aria-label="Province data"]'
    );
    expect(provinceTable).toBeTruthy();
    expect(provinceTable.querySelectorAll('tr')).toHaveLength(39);

    const firstRegion = document.querySelector('.leaflet-interactive');
    fireEvent.mouseOver(firstRegion);
    expect(document.querySelector('.leaflet-tooltip')).toBeTruthy();
    fireEvent.click(firstRegion);
    expect(onProvinceChange).toHaveBeenCalledWith('Aceh');
  });

  test('invalidates the map when its container resizes', () => {
    render(<IndonesiaMap />);

    expect(resizeObserverCallback).toBeTypeOf('function');
    const callsBeforeResize = invalidateSizeSpy.mock.calls.length;
    resizeObserverCallback();

    expect(invalidateSizeSpy.mock.calls.length).toBeGreaterThan(
      callsBeforeResize
    );
  });

  test('switches levels and selects a province from the region browser', () => {
    const onModeChange = vi.fn();
    const onProvinceChange = vi.fn();
    render(
      <IndonesiaMap
        onModeChange={onModeChange}
        onProvinceChange={onProvinceChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Kabupaten / Kota' }));
    expect(onModeChange).toHaveBeenCalledWith('district');

    fireEvent.click(screen.getByRole('button', { name: /^Jawa Barat/ }));
    expect(onProvinceChange).toHaveBeenCalledWith('Jawa Barat');
  });

  test('filters regions, supports keyboard selection, and changes focus', () => {
    const onProvinceChange = vi.fn();
    render(<IndonesiaMap onProvinceChange={onProvinceChange} />);

    fireEvent.input(screen.getByRole('searchbox'), {
      currentTarget: { value: 'Papua Selatan' },
      target: { value: 'Papua Selatan' }
    });
    const result = screen.getByRole('button', { name: /^Papua Selatan/ });
    expect(result).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Aceh/ })).toBeNull();

    fireEvent.keyDown(result, { key: 'Enter' });
    expect(onProvinceChange).toHaveBeenCalledWith('Papua Selatan');

    fireEvent.change(screen.getByRole('combobox', { name: 'Focus province' }), {
      currentTarget: { value: 'Bali' },
      target: { value: 'Bali' }
    });
    expect(onProvinceChange).toHaveBeenCalledWith('Bali');
  });

  test('shows a province area table and narrows it to one selected area', () => {
    const onModeChange = vi.fn();
    const onProvinceChange = vi.fn();
    render(
      <IndonesiaMap
        mode="province"
        selectedProvince="Bali"
        onModeChange={onModeChange}
        onProvinceChange={onProvinceChange}
      />
    );

    const provinceTable = document.querySelector(
      'table[aria-label="Bali area data"]'
    );
    expect(provinceTable).toBeTruthy();
    expect(provinceTable.querySelectorAll('tr')).toHaveLength(10);
    expect(provinceTable.textContent).toContain('Badung');
    fireEvent.click(
      provinceTable.querySelector('[aria-label="Select Badung"]')
    );

    const selectedTable = document.querySelector(
      'table[aria-label="Selected area data"]'
    );
    expect(selectedTable).toBeTruthy();
    expect(selectedTable.querySelectorAll('tr')).toHaveLength(2);
    expect(selectedTable.textContent).toContain('51.03');
    expect(selectedTable.textContent).toContain(
      INDONESIA_DISTRICTS.find(({ name }) => name === 'Badung').id
    );
    expect(screen.getByRole('heading', { name: 'Badung' })).toBeTruthy();
    expect(onModeChange).toHaveBeenCalledWith('district');
    expect(onProvinceChange).toHaveBeenCalledWith('Bali');

    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    const restoredTable = document.querySelector(
      'table[aria-label="Bali area data"]'
    );
    expect(restoredTable.textContent).toContain('Kota Denpasar');
    fireEvent.click(
      restoredTable.querySelector('[aria-label="Select Kota Denpasar"]')
    );
    const cityTable = document.querySelector(
      'table[aria-label="Selected area data"]'
    );
    expect(cityTable.textContent).toContain('Kota');
    expect(cityTable.textContent).toContain('51.71');

    fireEvent.click(screen.getByRole('button', { name: 'Reset view' }));
    expect(onModeChange).toHaveBeenLastCalledWith('province');
    expect(onProvinceChange).toHaveBeenLastCalledWith('');
  });

  test('returns from district mode to the overview selector', () => {
    const onModeChange = vi.fn();
    const onProvinceChange = vi.fn();
    render(
      <IndonesiaMap
        mode="district"
        selectedProvince="Bali"
        onModeChange={onModeChange}
        onProvinceChange={onProvinceChange}
      />
    );

    fireEvent.change(screen.getByRole('combobox', { name: 'Focus province' }), {
      currentTarget: { value: '' },
      target: { value: '' }
    });

    expect(onModeChange).toHaveBeenCalledWith('province');
    expect(onProvinceChange).toHaveBeenCalledWith('');
  });

  test('renders a focused district layer and handles a district click', () => {
    const onProvinceChange = vi.fn();
    const district = INDONESIA_DISTRICTS.find(
      ({ province }) => province === 'Bali'
    );
    render(
      <IndonesiaMap
        mode="district"
        selectedProvince="Bali"
        onProvinceChange={onProvinceChange}
      />
    );

    expect(document.querySelectorAll('.leaflet-interactive')).toHaveLength(9);
    fireEvent.click(document.querySelector('.leaflet-interactive'));

    expect(onProvinceChange).toHaveBeenCalledWith('Bali');
    expect(screen.getByRole('heading', { name: district.name })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(
      screen.queryByRole('button', { name: 'Clear selection' })
    ).toBeNull();
  });

  test('does not create a tile layer or request network resources', () => {
    const originalFetch = globalThis.fetch;
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    try {
      render(<IndonesiaMap />);

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(document.querySelector('.leaflet-tile-container')).toBeNull();
      expect(document.querySelector('.leaflet-container img')).toBeNull();
      expect(document.querySelectorAll('.leaflet-interactive')).toHaveLength(
        514
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
