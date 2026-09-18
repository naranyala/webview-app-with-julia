// Source of truth for brainstorming seed data: core ideas + elaborated essays.
// Backed by `seed/chain-essays.json` so Node checks, Julia seeding, and the
// browser mock all read identical fixtures.
import seedEssays from '../../seed/chain-essays.json' with { type: 'json' };
import { serializeQna } from './qna.js';

export const SEED_IDEAS = Object.freeze(seedEssays);

export function seedIdeasToNotes() {
  return SEED_IDEAS.map((idea, index) => ({
    id: `note-seed-${String(index + 1).padStart(2, '0')}`,
    title: idea.title,
    tag: idea.tag,
    updated: 'Seeded essay',
    body: serializeQna(idea.question, idea.answer)
  }));
}

export function seedIdeasToPdfEntries() {
  return SEED_IDEAS.map((idea) => ({
    title: idea.title,
    question: idea.question,
    answer: idea.answer,
    date: '2026-09-12'
  }));
}
