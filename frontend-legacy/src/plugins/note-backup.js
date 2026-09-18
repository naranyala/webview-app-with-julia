// Versioned JSON backup for Chain Notes (Phase 7 backup/restore).
//
// The envelope carries a schema version so future formats can be detected
// instead of misparsed. Transport (native `writeText` vs browser download)
// lives in `chain-notes.jsx`; this module only builds and validates the
// payload, and plans restores against the current note list. Framework-free
// so it runs under node (`check-note-backup.mjs`).

export const NOTE_BACKUP_SCHEMA_VERSION = 1;
export const NOTE_BACKUP_APP = 'chain-notes';
// Bounds mirror `src/Backend.jl` validation; oversized entries are skipped
// on import rather than failing the whole restore.
export const NOTE_BACKUP_MAX_NOTES = 5000;
const MAX_ID = 200;
const MAX_TITLE = 200;
const MAX_TAG = 64;
const MAX_NOTE_BODY = 512 * 1024;

function cleanString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

export function backupFileName(now = new Date()) {
  const stamp = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}-${pad2(now.getHours())}${pad2(now.getMinutes())}`;
  return `chain-notes-backup-${stamp}.json`;
}

function normalizeExportedNote(note) {
  return {
    id: cleanString(note?.id).slice(0, MAX_ID),
    title: cleanString(note?.title).slice(0, MAX_TITLE),
    tag: cleanString(note?.tag).slice(0, MAX_TAG),
    updated: cleanString(note?.updated),
    body: typeof note?.body === 'string' ? note.body : ''
  };
}

export function serializeNotesBackup(notes, now = new Date()) {
  const list = (Array.isArray(notes) ? notes : []).slice(
    0,
    NOTE_BACKUP_MAX_NOTES
  );
  const payload = {
    schemaVersion: NOTE_BACKUP_SCHEMA_VERSION,
    app: NOTE_BACKUP_APP,
    exportedAt: now.toISOString(),
    count: list.length,
    notes: list.map(normalizeExportedNote)
  };
  return { filename: backupFileName(now), json: JSON.stringify(payload) };
}

function invalidEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return true;
  if (typeof entry.id !== 'string' || entry.id.length === 0) return true;
  if (entry.id.length > MAX_ID) return true;
  if (typeof entry.body !== 'string') return true;
  if (entry.body.length > MAX_NOTE_BODY) return true;
  if (typeof entry.title === 'string' && entry.title.length > MAX_TITLE)
    return true;
  if (typeof entry.tag === 'string' && entry.tag.length > MAX_TAG) return true;
  return false;
}

// Parse and validate a backup file. Returns `{ notes, skipped, exportedAt }`.
// Throws an Error with a display-ready message for malformed files; single
// bad entries are counted in `skipped` instead of failing the restore.
export function parseNotesBackup(text) {
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('Backup file is not valid JSON.');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Backup file is not a Chain Notes backup.');
  }
  if (value.schemaVersion !== NOTE_BACKUP_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported backup version ${String(value.schemaVersion ?? 'unknown')}; expected ${NOTE_BACKUP_SCHEMA_VERSION}.`
    );
  }
  if (!Array.isArray(value.notes)) {
    throw new Error('Backup file has no notes to restore.');
  }
  const notes = [];
  let skipped = 0;
  for (const entry of value.notes.slice(0, NOTE_BACKUP_MAX_NOTES)) {
    if (invalidEntry(entry)) {
      skipped += 1;
      continue;
    }
    notes.push({
      id: entry.id,
      title:
        typeof entry.title === 'string' && entry.title.trim()
          ? entry.title.slice(0, MAX_TITLE)
          : 'Untitled note',
      tag: cleanString(entry.tag).slice(0, MAX_TAG),
      updated: cleanString(entry.updated),
      body: entry.body
    });
  }
  return {
    notes,
    skipped,
    exportedAt: cleanString(value.exportedAt)
  };
}

// Split backup notes into creates vs updates against the current list.
// Identical notes are counted as unchanged so restores avoid useless writes.
export function planNotesRestore(backupNotes, existingNotes) {
  const current = new Map(
    (Array.isArray(existingNotes) ? existingNotes : []).map((note) => [
      note?.id,
      note
    ])
  );
  const toCreate = [];
  const toUpdate = [];
  let unchanged = 0;
  for (const note of backupNotes) {
    const prev = current.get(note.id);
    if (!prev) {
      toCreate.push(note);
    } else if (
      prev.title !== note.title ||
      prev.tag !== note.tag ||
      prev.body !== note.body
    ) {
      toUpdate.push(note);
    } else {
      unchanged += 1;
    }
  }
  return { toCreate, toUpdate, unchanged };
}
