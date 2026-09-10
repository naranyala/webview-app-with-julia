// Payload validators for backend data, in the codebase's hand-rolled style
// (no schema library: the limits mirror `src/backend/quiz_storage.zig` and
// `src/backend.js` so malformed native payloads degrade to safe defaults
// instead of crashing renderers). Each parser returns a normalized copy or
// null; list parsers drop invalid entries like `parseStoredQna` tolerates
// legacy note bodies.
const MAX_ID = 200;
const MAX_TITLE = 200;
const MAX_TEXT = 20000;
const MAX_TOPIC = 200;
const MAX_DIFFICULTY = 64;
const MAX_TAG = 64;
const MAX_TAGS = 16;

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function cleanString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function cleanTags(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((tag) => typeof tag === 'string')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0 && tag.length <= MAX_TAG)
    .slice(0, MAX_TAGS);
}

export function parseQuizQuestion(value) {
  if (!value || typeof value !== 'object') return null;
  if (typeof value.id !== 'string' || value.id.length === 0) return null;
  if (value.id.length > MAX_ID) return null;
  if (!isNonEmptyString(value.question) || !isNonEmptyString(value.answer)) {
    return null;
  }
  if (value.question.length > MAX_TEXT || value.answer.length > MAX_TEXT) {
    return null;
  }
  return {
    id: value.id,
    topic: cleanString(value.topic).slice(0, MAX_TOPIC),
    question: value.question,
    answer: value.answer,
    explanation: cleanString(value.explanation).slice(0, MAX_TEXT),
    difficulty: cleanString(value.difficulty).slice(0, MAX_DIFFICULTY),
    tags: cleanTags(value.tags)
  };
}

export function parseQuizCollection(value) {
  if (!value || typeof value !== 'object') return null;
  if (typeof value.id !== 'string' || value.id.length === 0) return null;
  if (value.id.length > MAX_ID) return null;
  if (!isNonEmptyString(value.title) || value.title.length > MAX_TITLE) {
    return null;
  }
  return {
    id: value.id,
    title: value.title,
    shortTitle: cleanString(value.shortTitle, value.title),
    description: cleanString(value.description).slice(0, MAX_TEXT),
    tone: cleanString(value.tone, 'gold'),
    icon: cleanString(value.icon),
    level: cleanString(value.level, 'Custom'),
    questions: Array.isArray(value.questions)
      ? value.questions.map(parseQuizQuestion).filter(Boolean)
      : []
  };
}

export function parseQuizCollectionList(value) {
  if (!Array.isArray(value)) return [];
  return value.map(parseQuizCollection).filter(Boolean);
}
