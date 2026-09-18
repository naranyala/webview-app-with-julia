import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addSection,
  createPaperProjectDraft,
  moveSection,
  removeSection,
  updateFirstSection,
  updatePaperField,
  updateSection,
  updateTableOfContentsEntry,
} from '../src/paper-project-draft.js';

test('edits a paper draft without discarding unedited project content', () => {
  const loaded = {
    ...createPaperProjectDraft(),
    id: 'existing-paper',
    authors: [{ name: 'Ada' }, { name: 'Grace' }],
    sections: [
      { id: 'intro', title: 'Introduction', body: 'First section' },
      { id: 'methods', title: 'Methods', body: 'Second section' },
    ],
    references: [{ key: 'smith2026' }],
    figures: [{ id: 'figure-1', caption: 'A figure' }],
    extensionState: { reviewerNotes: 'Keep this' },
  };

  const titleEdited = updatePaperField(loaded, 'title', 'Revised title');
  const saved = updateFirstSection(
    titleEdited,
    'body',
    'Revised first section',
  );

  assert.equal(saved.id, 'existing-paper');
  assert.deepEqual(saved.authors, loaded.authors);
  assert.deepEqual(saved.references, loaded.references);
  assert.deepEqual(saved.figures, loaded.figures);
  assert.deepEqual(saved.extensionState, loaded.extensionState);
  assert.equal(saved.sections[0].body, 'Revised first section');
  assert.deepEqual(saved.sections[1], loaded.sections[1]);
});

test('edits every section and keeps the table of contents aligned', () => {
  const draft = createPaperProjectDraft();
  const added = addSection(draft);
  const second = added.sections[1];
  const edited = updateSection(added, second.id, 'body', 'Methods content');
  const tocEdited = updateTableOfContentsEntry(
    edited,
    edited.tableOfContents.entries[1].id,
    'visible',
    false,
  );

  assert.equal(tocEdited.sections[1].body, 'Methods content');
  assert.equal(tocEdited.tableOfContents.entries[1].visible, false);

  const removed = removeSection(tocEdited, second.id);
  assert.equal(removed.sections.length, 1);
  assert.equal(
    removed.tableOfContents.entries.some(
      (entry) => entry.sectionId === second.id,
    ),
    false,
  );
});

test('moving a section also updates TOC order', () => {
  const draft = addSection(createPaperProjectDraft());
  const moved = moveSection(draft, draft.sections[1].id, -1);
  assert.equal(moved.sections[0].id, draft.sections[1].id);
  assert.equal(
    moved.tableOfContents.entries[0].sectionId,
    draft.sections[1].id,
  );
  assert.equal(moved.tableOfContents.entries[0].order, 1);
});
