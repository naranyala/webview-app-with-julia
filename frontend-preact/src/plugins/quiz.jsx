import { useEffect, useMemo, useState } from 'preact/hooks';
import { backend, backendError } from '../backend.js';
import { parseQuizCollectionList } from '../schemas.js';
import { styles, sx, toneStyle } from '../stylex-styles.js';
import { quizCollections } from './quiz-data.js';

function scoreLabel(score, total) {
  if (score === total) return 'Perfect recall';
  if (score >= Math.ceil(total * 0.7)) return 'Strong session';
  if (score > 0) return 'Good foundation';
  return 'Ready when you are';
}

// Bundled decks ship with the app and stay read-only; user decks live in
// the native quiz store (or the browser mock) and are fully editable.
function withIds(collections, readOnly) {
  return (collections || []).map((collection) => ({
    ...collection,
    readOnly,
    questions: (collection.questions || []).map((item, index) => ({
      ...item,
      id: item.id || `${collection.id}-q-${index + 1}`
    }))
  }));
}

const emptyQuestionDraft = {
  topic: '',
  question: '',
  answer: '',
  explanation: '',
  difficulty: '',
  tags: ''
};

function QuizEditor({
  collections,
  storageError,
  onCreateCollection,
  onUpdateCollection,
  onDeleteCollection,
  onCreateQuestion,
  onUpdateQuestion,
  onDeleteQuestion
}) {
  const [collectionId, setCollectionId] = useState(collections[0]?.id || '');
  const [query, setQuery] = useState('');
  const [collectionTitle, setCollectionTitle] = useState('');
  const [collectionDescription, setCollectionDescription] = useState('');
  const [newCollectionTitle, setNewCollectionTitle] = useState('');
  const [newCollectionDescription, setNewCollectionDescription] = useState('');
  const [questionDraft, setQuestionDraft] = useState({ ...emptyQuestionDraft });
  const [editingQuestionId, setEditingQuestionId] = useState(null);

  const collection =
    collections.find((item) => item.id === collectionId) || collections[0];
  const filteredQuestions = useMemo(() => {
    if (!collection) return [];
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return collection.questions;
    return collection.questions.filter((item) =>
      `${item.question} ${item.answer} ${(item.tags || []).join(' ')}`
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [collection, query]);

  useEffect(() => {
    if (collection) {
      setCollectionTitle(collection.title);
      setCollectionDescription(collection.description || '');
    }
  }, [collection]);

  if (!collection) {
    return (
      <main className={sx('quiz-shell')}>
        <p className={sx('quiz-empty')}>No decks available.</p>
      </main>
    );
  }

  function startEditingQuestion(item) {
    setEditingQuestionId(item.id);
    setQuestionDraft({
      topic: item.topic || '',
      question: item.question,
      answer: item.answer,
      explanation: item.explanation || '',
      difficulty: item.difficulty || '',
      tags: (item.tags || []).join(', ')
    });
  }

  function cancelEditingQuestion() {
    setEditingQuestionId(null);
    setQuestionDraft({ ...emptyQuestionDraft });
  }

  async function saveQuestion() {
    if (!questionDraft.question.trim() || !questionDraft.answer.trim()) return;
    let saved = null;
    if (editingQuestionId) {
      saved = await onUpdateQuestion(
        collection.id,
        editingQuestionId,
        questionDraft.topic,
        questionDraft.question,
        questionDraft.answer,
        questionDraft.explanation,
        questionDraft.difficulty,
        questionDraft.tags
      );
    } else {
      saved = await onCreateQuestion(
        collection.id,
        questionDraft.topic,
        questionDraft.question,
        questionDraft.answer
      );
    }
    if (saved) cancelEditingQuestion();
  }

  return (
    <main className={sx('quiz-shell')}>
      <div className={sx('quiz-layout')}>
        <header className={sx('quiz-header')}>
          <div>
            <p className={sx('eyebrow')}>Deck workshop</p>
            <h1 className={sx('quiz-title')}>Quiz editor</h1>
            <p className={sx('lede')}>
              Bundled decks are read-only references. Your own decks support
              full create, edit, and delete.
            </p>
          </div>
          <div className={sx('quiz-editor-badge')}>
            {collection.readOnly ? 'Read only' : 'Editable'}
          </div>
        </header>

        {storageError && (
          <p className={sx('error')} role="alert">
            {storageError}
          </p>
        )}

        <section className={sx('quiz-toolbar')} aria-label="Editor controls">
          <div className={sx('selectWrap')}>
            <label
              className={sx('select-label')}
              htmlFor="quiz-editor-collection"
            >
              Collection
            </label>
            <select
              className={sx('select')}
              id="quiz-editor-collection"
              value={collection.id}
              onChange={(event) => {
                setCollectionId(event.currentTarget.value);
                setQuery('');
                cancelEditingQuestion();
              }}
            >
              {collections.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.title}
                  {item.readOnly ? ' (bundled)' : ''}
                </option>
              ))}
            </select>
          </div>
          <label className={sx('quiz-editor-search')}>
            <span className={sx('sr-only')}>Search questions</span>
            <input
              className={sx('search-input')}
              type="search"
              placeholder="Find a prompt or topic..."
              value={query}
              onInput={(event) => setQuery(event.currentTarget.value)}
            />
          </label>
        </section>

        <section className={sx('quiz-summary')}>
          <div
            className={sx('quiz-mark', toneStyle(collection.tone, true))}
            aria-hidden="true"
          >
            {collection.icon}
          </div>
          <div className={sx('quiz-summary-copy')}>
            <p className={sx('panel-label')}>Active deck</p>
            <h2 className={sx('quiz-summary-title')}>{collection.title}</h2>
            <p className={sx('quiz-summary-description')}>
              {collection.description}
            </p>
          </div>
          <span className={sx('quiz-count')}>
            {collection.questions.length} prompts
          </span>
        </section>

        {!collection.readOnly && (
          <section className={sx('quiz-toolbar')} aria-label="Edit collection">
            <div className={sx('selectWrap')}>
              <label className={sx('select-label')} htmlFor="quiz-edit-title">
                Deck title
              </label>
              <input
                className={sx('search-input')}
                id="quiz-edit-title"
                value={collectionTitle}
                onInput={(event) =>
                  setCollectionTitle(event.currentTarget.value)
                }
              />
            </div>
            <label className={sx('quiz-editor-search')}>
              <span className={sx('sr-only')}>Deck description</span>
              <input
                className={sx('search-input')}
                placeholder="Deck description"
                value={collectionDescription}
                onInput={(event) =>
                  setCollectionDescription(event.currentTarget.value)
                }
              />
            </label>
            <button
              type="button"
              className={sx('quiz-button', 'quiz-secondary')}
              onClick={() =>
                onUpdateCollection(
                  collection.id,
                  collectionTitle,
                  collectionDescription
                )
              }
            >
              Save deck
            </button>
            <button
              type="button"
              className={sx('quiz-button', 'quiz-secondary')}
              onClick={async () => {
                const deleted = await onDeleteCollection(collection.id);
                if (deleted) setCollectionId('');
              }}
            >
              Delete deck
            </button>
          </section>
        )}

        {!collection.readOnly && (
          <section
            className={sx('quiz-editor-list')}
            aria-label="Question form"
          >
            <article className={sx('quiz-editor-row')}>
              <span className={sx('quiz-number')}>
                {editingQuestionId ? '✎' : '+'}
              </span>
              <div>
                <input
                  className={sx('search-input')}
                  placeholder="Topic (optional)"
                  value={questionDraft.topic}
                  onInput={(event) =>
                    setQuestionDraft((current) => ({
                      ...current,
                      topic: event.currentTarget.value
                    }))
                  }
                  aria-label="Question topic"
                />
                <input
                  className={sx('search-input')}
                  placeholder="Prompt"
                  value={questionDraft.question}
                  onInput={(event) =>
                    setQuestionDraft((current) => ({
                      ...current,
                      question: event.currentTarget.value
                    }))
                  }
                  aria-label="Question prompt"
                />
                <input
                  className={sx('search-input')}
                  placeholder="Answer"
                  value={questionDraft.answer}
                  onInput={(event) =>
                    setQuestionDraft((current) => ({
                      ...current,
                      answer: event.currentTarget.value
                    }))
                  }
                  aria-label="Question answer"
                />
                {editingQuestionId && (
                  <input
                    className={sx('search-input')}
                    placeholder="Explanation (optional)"
                    value={questionDraft.explanation}
                    onInput={(event) =>
                      setQuestionDraft((current) => ({
                        ...current,
                        explanation: event.currentTarget.value
                      }))
                    }
                    aria-label="Question explanation"
                  />
                )}
                {editingQuestionId && (
                  <input
                    className={sx('search-input')}
                    placeholder="Difficulty (optional)"
                    value={questionDraft.difficulty}
                    onInput={(event) =>
                      setQuestionDraft((current) => ({
                        ...current,
                        difficulty: event.currentTarget.value
                      }))
                    }
                    aria-label="Question difficulty"
                  />
                )}
                {editingQuestionId && (
                  <input
                    className={sx('search-input')}
                    placeholder="Tags, comma separated"
                    value={questionDraft.tags}
                    onInput={(event) =>
                      setQuestionDraft((current) => ({
                        ...current,
                        tags: event.currentTarget.value
                      }))
                    }
                    aria-label="Question tags"
                  />
                )}
              </div>
              <div>
                <button
                  type="button"
                  className={sx('quiz-button', 'quiz-primary')}
                  onClick={saveQuestion}
                >
                  {editingQuestionId ? 'Save' : 'Add'}
                </button>
                {editingQuestionId && (
                  <button
                    type="button"
                    className={sx('quiz-button', 'quiz-secondary')}
                    onClick={cancelEditingQuestion}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </article>
          </section>
        )}

        <section
          className={sx('quiz-editor-list')}
          aria-label={`${collection.title} prompts`}
        >
          {filteredQuestions.map((item) => (
            <article className={sx('quiz-editor-row')} key={item.id}>
              <span className={sx('quiz-number')}>
                {String(collection.questions.indexOf(item) + 1).padStart(
                  2,
                  '0'
                )}
              </span>
              <div>
                <h3 className={sx('quiz-row-title')}>{item.question}</h3>
                <p className={sx('quiz-row-text')}>{item.answer}</p>
              </div>
              {!collection.readOnly && (
                <div>
                  <button
                    type="button"
                    className={sx('quiz-button', 'quiz-secondary')}
                    onClick={() => startEditingQuestion(item)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={sx('quiz-button', 'quiz-secondary')}
                    onClick={() => onDeleteQuestion(collection.id, item.id)}
                  >
                    Delete
                  </button>
                </div>
              )}
              {collection.readOnly && (
                <span className={sx('difficulty', toneStyle(collection.tone))}>
                  {item.difficulty}
                </span>
              )}
            </article>
          ))}
          {filteredQuestions.length === 0 && (
            <p className={sx('quiz-empty')}>No prompts match that search.</p>
          )}
        </section>

        <section className={sx('quiz-toolbar')} aria-label="New collection">
          <div className={sx('selectWrap')}>
            <label className={sx('select-label')} htmlFor="quiz-new-title">
              New deck title
            </label>
            <input
              className={sx('search-input')}
              id="quiz-new-title"
              placeholder="My deck"
              value={newCollectionTitle}
              onInput={(event) =>
                setNewCollectionTitle(event.currentTarget.value)
              }
            />
          </div>
          <label className={sx('quiz-editor-search')}>
            <span className={sx('sr-only')}>New deck description</span>
            <input
              className={sx('search-input')}
              placeholder="What is this deck about?"
              value={newCollectionDescription}
              onInput={(event) =>
                setNewCollectionDescription(event.currentTarget.value)
              }
            />
          </label>
          <button
            type="button"
            className={sx('quiz-button', 'quiz-primary')}
            onClick={async () => {
              const created = await onCreateCollection(
                newCollectionTitle,
                newCollectionDescription
              );
              if (created) {
                setNewCollectionTitle('');
                setNewCollectionDescription('');
                setCollectionId(created.id);
              }
            }}
          >
            + New deck
          </button>
        </section>
      </div>
    </main>
  );
}

export function Quiz({ mode = 'session' }) {
  const [userCollections, setUserCollections] = useState([]);
  const [storageError, setStorageError] = useState('');

  useEffect(() => {
    let cancelled = false;
    backend
      .quizList()
      .then((loaded) => {
        if (cancelled) return;
        setUserCollections(parseQuizCollectionList(loaded));
      })
      .catch((error) => {
        if (!cancelled) setStorageError(backendError(error));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const collections = useMemo(
    () => [
      ...withIds(quizCollections, true),
      ...withIds(userCollections, false)
    ],
    [userCollections]
  );

  function replaceCollection(stored) {
    if (!stored?.id) return null;
    setUserCollections((current) =>
      current.some((item) => item.id === stored.id)
        ? current.map((item) => (item.id === stored.id ? stored : item))
        : [...current, stored]
    );
    return stored;
  }

  async function runGuarded(label, call) {
    setStorageError('');
    try {
      return await call();
    } catch (error) {
      setStorageError(`${label}: ${backendError(error)}`);
      return null;
    }
  }

  async function createCollection(title, description) {
    if (!title.trim()) {
      setStorageError('Collection title is required.');
      return null;
    }
    const stored = await runGuarded('Create deck failed', () =>
      backend.quizCreateCollection(title, description, 'gold', 'Custom')
    );
    return replaceCollection(stored);
  }

  async function updateCollection(id, title, description) {
    const stored = await runGuarded('Save deck failed', () =>
      backend.quizUpdateCollection(id, title, description)
    );
    return replaceCollection(stored);
  }

  async function deleteCollection(id) {
    const ok = await runGuarded('Delete deck failed', () =>
      backend.quizDeleteCollection(id)
    );
    if (ok !== null) {
      setUserCollections((current) => current.filter((item) => item.id !== id));
      return true;
    }
    return false;
  }

  async function createQuestion(collectionId, topic, question, answer) {
    const stored = await runGuarded('Add prompt failed', () =>
      backend.quizCreateQuestion(collectionId, topic, question, answer)
    );
    if (!stored) return null;
    setUserCollections((current) =>
      current.map((item) =>
        item.id === collectionId
          ? { ...item, questions: [...item.questions, stored] }
          : item
      )
    );
    return stored;
  }

  async function updateQuestion(
    collectionId,
    id,
    topic,
    question,
    answer,
    explanation,
    difficulty,
    tagsCsv
  ) {
    const stored = await runGuarded('Save prompt failed', () =>
      backend.quizUpdateQuestion(
        collectionId,
        id,
        topic,
        question,
        answer,
        explanation,
        difficulty,
        tagsCsv
      )
    );
    if (!stored) return null;
    setUserCollections((current) =>
      current.map((item) =>
        item.id === collectionId
          ? {
              ...item,
              questions: item.questions.map((entry) =>
                entry.id === id ? stored : entry
              )
            }
          : item
      )
    );
    return stored;
  }

  async function deleteQuestion(collectionId, id) {
    const ok = await runGuarded('Delete prompt failed', () =>
      backend.quizDeleteQuestion(collectionId, id)
    );
    if (ok !== null) {
      setUserCollections((current) =>
        current.map((item) =>
          item.id === collectionId
            ? {
                ...item,
                questions: item.questions.filter((entry) => entry.id !== id)
              }
            : item
        )
      );
      return true;
    }
    return false;
  }

  if (mode === 'editor') {
    return (
      <QuizEditor
        collections={collections}
        storageError={storageError}
        onCreateCollection={createCollection}
        onUpdateCollection={updateCollection}
        onDeleteCollection={deleteCollection}
        onCreateQuestion={createQuestion}
        onUpdateQuestion={updateQuestion}
        onDeleteQuestion={deleteQuestion}
      />
    );
  }

  return <QuizSession collections={collections} storageError={storageError} />;
}

function QuizSession({ collections, storageError }) {
  const [collectionId, setCollectionId] = useState(
    () => collections[0]?.id || ''
  );
  const [questionIndex, setQuestionIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [known, setKnown] = useState(() => new Set());
  const [query, setQuery] = useState('');

  const collection =
    collections.find((item) => item.id === collectionId) || collections[0];
  const question = collection?.questions[questionIndex];
  const progress = collection
    ? Math.round(((questionIndex + 1) / collection.questions.length) * 100)
    : 0;
  const filteredQuestions = useMemo(() => {
    if (!collection) return [];
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return collection.questions;
    return collection.questions.filter((item) =>
      `${item.question} ${item.answer} ${(item.tags || []).join(' ')}`
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [collection, query]);

  function selectCollection(event) {
    setCollectionId(event.currentTarget.value);
    setQuestionIndex(0);
    setRevealed(false);
    setKnown(new Set());
    setQuery('');
  }

  function showQuestion(index) {
    setQuestionIndex(index);
    setRevealed(false);
  }

  function markKnown() {
    if (!question) return;
    setKnown((current) => {
      const next = new Set(current);
      next.add(question.id);
      return next;
    });
    setRevealed(true);
  }

  function nextQuestion() {
    if (!collection) return;
    setQuestionIndex((current) => (current + 1) % collection.questions.length);
    setRevealed(false);
  }

  function resetSession() {
    setQuestionIndex(0);
    setRevealed(false);
    setKnown(new Set());
  }

  if (!collection || collection.questions.length === 0) {
    return (
      <main className={sx('quiz-shell')}>
        <div className={sx('quiz-layout')}>
          <p className={sx('quiz-empty')}>
            No prompts here yet. Add some in the Quiz Editor.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className={sx('quiz-shell')}>
      <div className={sx('quiz-layout')}>
        <header className={sx('quiz-header')}>
          <div>
            <p className={sx('eyebrow')}>Recall lab</p>
            <h1 className={sx('quiz-title')}>Quiz decks</h1>
            <p className={sx('lede')}>
              Short prompts for learning tools, techniques, and the ideas behind
              them.
            </p>
          </div>
          <div className={sx('quiz-score')}>
            <strong className={sx('quiz-score-strong')}>{known.size}</strong>
            <span>known</span>
          </div>
        </header>

        {storageError && (
          <p className={sx('error')} role="alert">
            {storageError}
          </p>
        )}

        <section
          className={sx('quiz-collection')}
          aria-label="Quiz collections"
        >
          <div className={sx('selectWrap')}>
            <label className={sx('select-label')} htmlFor="quiz-collection">
              Collection
            </label>
            <select
              className={sx('select')}
              id="quiz-collection"
              value={collection.id}
              onChange={selectCollection}
            >
              {collections.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.title}
                  {item.readOnly ? '' : ' (yours)'}
                </option>
              ))}
            </select>
          </div>
          <div
            className={sx('quiz-mark', toneStyle(collection.tone, true))}
            aria-hidden="true"
          >
            {collection.icon}
          </div>
          <div className={sx('quiz-copy')}>
            <strong className={sx('quiz-copy-strong')}>
              {collection.shortTitle}
            </strong>
            <span className={sx('quiz-copy-span')}>
              {collection.description}
            </span>
          </div>
          <button
            type="button"
            className={sx('quiz-button', 'quiz-secondary')}
            onClick={resetSession}
          >
            Reset
          </button>
        </section>

        <div className={sx('quiz-progress')}>
          <div className={sx('quiz-progress-track')}>
            <span
              className={sx('quiz-progress-fill')}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span>
            {String(questionIndex + 1).padStart(2, '0')} /{' '}
            {String(collection.questions.length).padStart(2, '0')}
          </span>
        </div>

        <section className={sx('quiz-grid')}>
          <article className={sx('quiz-card', 'panel')} aria-live="polite">
            <div className={sx('quiz-topline')}>
              <span className={sx('difficulty', toneStyle(collection.tone))}>
                {question.difficulty}
              </span>
              <span>{(question.tags || []).join(' / ')}</span>
            </div>
            <p className={sx('quiz-kicker')}>
              Prompt {String(questionIndex + 1).padStart(2, '0')}
            </p>
            <h2 className={sx('quiz-question-title')}>{question.question}</h2>
            {revealed ? (
              <div className={sx('quiz-answer')} role="status">
                <p className={sx('quiz-answer-label')}>Answer</p>
                <p className={sx('quiz-answer-text')}>{question.answer}</p>
                <p className={sx('quiz-explanation')}>{question.explanation}</p>
              </div>
            ) : (
              <button
                type="button"
                className={sx('quiz-button', 'quiz-primary')}
                onClick={() => setRevealed(true)}
              >
                Reveal answer
                <span aria-hidden="true">↗</span>
              </button>
            )}
            <div className={sx('quiz-actions')}>
              <button
                type="button"
                className={sx('quiz-button', 'quiz-secondary')}
                onClick={() =>
                  showQuestion(
                    (questionIndex - 1 + collection.questions.length) %
                      collection.questions.length
                  )
                }
              >
                Previous
              </button>
              {revealed && (
                <button
                  type="button"
                  className={sx('quiz-button', 'quiz-known')}
                  onClick={markKnown}
                >
                  {known.has(question.id) ? 'Marked known' : 'I knew this'}
                </button>
              )}
              <button
                type="button"
                className={sx('quiz-button', 'quiz-primary')}
                onClick={nextQuestion}
              >
                Next question <span aria-hidden="true">→</span>
              </button>
            </div>
          </article>

          <aside
            className={sx('quiz-index', 'panel')}
            aria-label="Question index"
          >
            <div className={sx('quiz-index-heading')}>
              <div>
                <p className={sx('panel-label')}>Deck index</p>
                <strong className={sx('quiz-index-title')}>
                  {scoreLabel(known.size, collection.questions.length)}
                </strong>
              </div>
              <span>{collection.questions.length} cards</span>
            </div>
            <label className={sx('quiz-search')}>
              <span className={sx('sr-only')}>Search questions</span>
              <input
                className={sx('search-input')}
                type="search"
                placeholder="Search this deck..."
                value={query}
                onInput={(event) => setQuery(event.currentTarget.value)}
              />
            </label>
            <div className={sx('quiz-question-list')}>
              {filteredQuestions.map((item) => {
                const index = collection.questions.indexOf(item);
                return (
                  <button
                    type="button"
                    className={sx(
                      'quiz-question',
                      index === questionIndex && styles.quizQuestionActive
                    )}
                    onClick={() => showQuestion(index)}
                    key={item.id}
                  >
                    <span className={sx('quiz-question-number')}>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <strong className={sx('quiz-question-text')}>
                      {item.question}
                    </strong>
                    {known.has(item.id) && (
                      <b className={sx('quiz-known-mark')} title="Known">
                        ✓
                      </b>
                    )}
                  </button>
                );
              })}
              {filteredQuestions.length === 0 && (
                <p className={sx('quiz-empty')}>
                  No prompts match that search.
                </p>
              )}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
