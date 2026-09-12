import { useMemo, useRef, useState } from 'preact/hooks';
import { styles, sx } from '../stylex-styles.js';

const STORAGE_KEY = 'tab-vault.collections';

function loadVaults() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveVaults(vaults) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(vaults));
}

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function inferShape(data) {
  if (data === null || data === undefined) return 'null';
  if (Array.isArray(data)) return `array[${data.length}]`;
  if (typeof data === 'object') return `object{${Object.keys(data).length}}`;
  return typeof data;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

function countKeys(data, depth = 0) {
  if (depth > 4 || data === null || typeof data !== 'object') return 0;
  const keys = Array.isArray(data) ? data : Object.keys(data);
  let count = Array.isArray(data) ? 0 : keys.length;
  const values = Array.isArray(data) ? data : Object.values(data);
  for (const v of values) {
    count += countKeys(v, depth + 1);
  }
  return count;
}

function previewValue(data, maxLen = 60) {
  if (data === null) return 'null';
  if (data === undefined) return 'undefined';
  if (typeof data === 'string') {
    const s = data.length > maxLen ? `${data.slice(0, maxLen)}…` : data;
    return `"${s}"`;
  }
  if (typeof data === 'number' || typeof data === 'boolean')
    return String(data);
  if (Array.isArray(data)) return `[${data.length} items]`;
  if (typeof data === 'object') return `{${Object.keys(data).length} keys}`;
  return String(data);
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── JSON Tree Node ──────────────────────────────────────────────────────────

function JsonNode({ keyName, value, depth, path, onEdit, renamedPath }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const isObject =
    value !== null && typeof value === 'object' && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const isExpandable = isObject || isArray;

  const entries = useMemo(() => {
    if (isArray) return value.map((v, i) => [i, v]);
    if (isObject) return Object.entries(value);
    return [];
  }, [value, isObject, isArray]);

  const displayKey =
    renamedPath && renamedPath === path
      ? renamedPath.split('.').pop()
      : keyName;

  return (
    <div className="jv-node">
      <div className="jv-row" style={{ paddingLeft: `${depth * 16}px` }}>
        {isExpandable ? (
          <button
            type="button"
            className="jv-toggle"
            onClick={() => setExpanded((e) => !e)}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? '▾' : '▸'}
          </button>
        ) : (
          <span className="jv-toggle jv-leaf" />
        )}
        <span className="jv-key">{displayKey}</span>
        {!isExpandable && (
          <>
            <span className="jv-colon">:</span>
            <button
              type="button"
              className={`jv-value jv-${typeof value}`}
              onClick={() => onEdit(path)}
              title="Click to edit"
            >
              {previewValue(value)}
            </button>
          </>
        )}
        {isExpandable && (
          <span className="jv-meta">
            {isArray ? `[${value.length}]` : `{${Object.keys(value).length}}`}
          </span>
        )}
      </div>
      {isExpandable && expanded && (
        <div className="jv-children">
          {entries.map(([k, v]) => (
            <JsonNode
              key={k}
              keyName={String(k)}
              value={v}
              depth={depth + 1}
              path={path ? `${path}.${k}` : String(k)}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Edit Modal ──────────────────────────────────────────────────────────────

function EditModal({ path, value, onSave, onCancel }) {
  const [text, setText] = useState(
    typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  );
  const [error, setError] = useState('');
  const ref = useRef(null);

  function handleSave() {
    try {
      const parsed = JSON.parse(text);
      onSave(path, parsed);
      onCancel();
    } catch {
      setError('Invalid JSON');
    }
  }

  return (
    <section
      className="jv-modal-overlay"
      aria-label="Edit dialog overlay"
      onClick={onCancel}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel();
      }}
    >
      <div
        className="jv-modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Edit ${path}`}
      >
        <div className="jv-modal-header">
          <span className="jv-modal-path">{path}</span>
          <button type="button" className="jv-modal-close" onClick={onCancel}>
            ×
          </button>
        </div>
        <textarea
          ref={ref}
          className="jv-modal-input"
          value={text}
          onInput={(e) => {
            setText(e.currentTarget.value);
            setError('');
          }}
          spellCheck={false}
        />
        {error && <p className="jv-modal-error">{error}</p>}
        <div className="jv-modal-actions">
          <button
            type="button"
            className="jv-btn jv-btn-secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="jv-btn jv-btn-primary"
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>
    </section>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function TabVault() {
  const [vaults, setVaults] = useState(loadVaults);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState('');
  const [editTarget, setEditTarget] = useState(null);
  const [viewMode, setViewMode] = useState('tree');
  const [importError, setImportError] = useState('');
  const fileRef = useRef(null);
  const dropRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const selected = vaults.find((v) => v.id === selectedId);

  const filtered = useMemo(() => {
    if (!query.trim()) return vaults;
    const q = query.trim().toLowerCase();
    return vaults.filter(
      (v) =>
        v.name.toLowerCase().includes(q) || v.fileName.toLowerCase().includes(q)
    );
  }, [vaults, query]);

  function persist(next) {
    setVaults(next);
    saveVaults(next);
  }

  function importJson(name, fileName, data) {
    const vault = {
      id: createId(),
      name: name || fileName.replace(/\.json$/i, ''),
      fileName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      data
    };
    const next = [vault, ...vaults];
    persist(next);
    setSelectedId(vault.id);
  }

  function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        importJson(file.name.replace(/\.json$/i, ''), file.name, data);
        setImportError('');
      } catch {
        setImportError('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  }

  function handlePaste() {
    const text = prompt('Paste JSON content:');
    if (!text) return;
    try {
      const data = JSON.parse(text);
      const name =
        prompt('Name for this vault:', 'Pasted JSON') || 'Pasted JSON';
      importJson(name, 'clipboard.json', data);
      setImportError('');
    } catch {
      setImportError('Invalid JSON — could not parse pasted content');
    }
  }

  function deleteVault(id) {
    const next = vaults.filter((v) => v.id !== id);
    persist(next);
    if (selectedId === id) setSelectedId(null);
  }

  function renameVault(id, newName) {
    const next = vaults.map((v) =>
      v.id === id ? { ...v, name: newName, updatedAt: Date.now() } : v
    );
    persist(next);
  }

  function handleEdit(path, newValue) {
    if (!selected) return;
    const parts = path.split('.');
    const newData = JSON.parse(JSON.stringify(selected.data));
    let cursor = newData;
    for (let i = 0; i < parts.length - 1; i++) {
      const num = Number(parts[i]);
      const key = Number.isNaN(num) ? parts[i] : num;
      cursor = cursor[key];
    }
    const lastNum = Number(parts.at(-1));
    const lastKey = Number.isNaN(lastNum) ? parts.at(-1) : lastNum;
    cursor[lastKey] = newValue;
    const next = vaults.map((v) =>
      v.id === selected.id ? { ...v, data: newData, updatedAt: Date.now() } : v
    );
    persist(next);
  }

  function exportVault(vault) {
    downloadJson(`${vault.name}.json`, vault.data);
  }

  function exportAll() {
    downloadJson(
      'tab-vault-export.json',
      vaults.map((v) => ({
        name: v.name,
        fileName: v.fileName,
        createdAt: v.createdAt,
        data: v.data
      }))
    );
  }

  // ─── List View ───────────────────────────────────────────────────────────

  if (!selected) {
    return (
      <section className={sx('tool-page')}>
        <div className={sx('tool-heading')}>
          <div>
            <p className={sx('eyebrow')}>Browser data</p>
            <h1 className={sx('pageTitle')}>Tab Vault</h1>
            <p className={sx('lede')}>
              Import JSON tab backups. Inspect, edit, and re-export any shape.
            </p>
          </div>
          <span className={sx('badge')}>{vaults.length} vaults</span>
        </div>

        <div className={sx('tool-panel')}>
          <div className={sx('notes-list-heading')}>
            <input
              className={sx('search-field')}
              type="search"
              placeholder="Search vaults..."
              value={query}
              onInput={(e) => setQuery(e.currentTarget.value)}
              aria-label="Search vaults"
            />
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                type="button"
                className={sx('action')}
                onClick={() => fileRef.current?.click()}
              >
                + Import JSON
              </button>
              <button
                type="button"
                className={sx('text-button')}
                onClick={handlePaste}
              >
                Paste
              </button>
              {vaults.length > 0 && (
                <button
                  type="button"
                  className={sx('text-button')}
                  onClick={exportAll}
                >
                  Export all
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => handleFile(e.currentTarget.files?.[0])}
            />
          </div>

          {importError && (
            <p className={sx('error')} role="alert">
              {importError}
            </p>
          )}

          <section
            ref={dropRef}
            aria-label="Drop JSON files here"
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{
              border: dragOver
                ? '2px dashed var(--wb-accent)'
                : '2px dashed transparent',
              borderRadius: 12,
              padding: dragOver ? '1rem' : 0,
              transition: 'all 150ms ease'
            }}
          >
            {filtered.length === 0 && (
              <p className={sx('empty')}>
                {vaults.length === 0
                  ? 'No vaults yet. Import a JSON file or paste content.'
                  : 'No vaults match your search.'}
              </p>
            )}

            <div className={sx('notes-list')}>
              {filtered.map((vault) => (
                <button
                  type="button"
                  key={vault.id}
                  className={sx('note-list-item')}
                  onClick={() => setSelectedId(vault.id)}
                >
                  <span className={sx('note-list-meta')}>
                    <span>{inferShape(vault.data)}</span>
                    <span className={sx('note-list-updated')}>
                      {new Date(vault.updatedAt).toLocaleDateString()}
                    </span>
                  </span>
                  <strong className={sx('note-title')}>{vault.name}</strong>
                  <span className={sx('note-body')}>
                    {vault.fileName} ·{' '}
                    {formatBytes(new Blob([JSON.stringify(vault.data)]).size)} ·{' '}
                    {countKeys(vault.data)} keys
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </section>
    );
  }

  // ─── Detail View ─────────────────────────────────────────────────────────

  return (
    <section className={sx('tool-page')}>
      {editTarget && (
        <EditModal
          path={editTarget.path}
          value={editTarget.value}
          onSave={handleEdit}
          onCancel={() => setEditTarget(null)}
        />
      )}

      <div className={sx('tool-heading')}>
        <div>
          <p className={sx('eyebrow')}>Inspecting</p>
          <h1 className={sx('pageTitle')}>{selected.name}</h1>
          <p className={sx('lede')}>
            {selected.fileName} · {inferShape(selected.data)} · last modified{' '}
            {new Date(selected.updatedAt).toLocaleString()}
          </p>
        </div>
        <span className={sx('badge')}>{countKeys(selected.data)} keys</span>
      </div>

      <div className={sx('tool-panel')}>
        <div className={sx('notes-list-heading')}>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              type="button"
              className={sx('text-button')}
              onClick={() => setSelectedId(null)}
            >
              ← Back
            </button>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              type="button"
              className={sx(
                'chip',
                viewMode === 'tree' && styles.sideItemActive
              )}
              onClick={() => setViewMode('tree')}
            >
              Tree
            </button>
            <button
              type="button"
              className={sx(
                'chip',
                viewMode === 'raw' && styles.sideItemActive
              )}
              onClick={() => setViewMode('raw')}
            >
              Raw
            </button>
            <button
              type="button"
              className={sx('action')}
              onClick={() => exportVault(selected)}
            >
              Export
            </button>
            <button
              type="button"
              className={sx('text-button')}
              onClick={() => {
                const name = prompt('Rename vault:', selected.name);
                if (name) renameVault(selected.id, name);
              }}
            >
              Rename
            </button>
            <button
              type="button"
              className={sx('text-button', styles.red)}
              onClick={() => {
                if (confirm(`Delete "${selected.name}"?`))
                  deleteVault(selected.id);
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      <div className={sx('tool-panel')}>
        {viewMode === 'tree' ? (
          <div className="jv-tree">
            <JsonNode
              keyName="$"
              value={selected.data}
              depth={0}
              path="$"
              onEdit={(path) => {
                const value = path.split('.').reduce((o, k) => {
                  const n = Number(k);
                  return o?.[Number.isNaN(n) ? k : n];
                }, selected.data);
                setEditTarget({ path, value });
              }}
            />
          </div>
        ) : (
          <pre className="jv-raw">{JSON.stringify(selected.data, null, 2)}</pre>
        )}
      </div>
    </section>
  );
}
