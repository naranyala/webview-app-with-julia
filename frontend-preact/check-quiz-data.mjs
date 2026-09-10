import { getQuizCollection, quizCollections } from './src/plugins/quiz-data.js';

let failures = 0;

function check(name, condition) {
  if (condition) {
    console.log(`ok: ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL: ${name}`);
  }
}

check('three starter collections exist', quizCollections.length === 3);
check('Blender collection exists', Boolean(getQuizCollection('blender-3d')));
check('audio collection exists', Boolean(getQuizCollection('audio-programming')));
check('mir collection exists', Boolean(getQuizCollection('mir-fundamentals')));

for (const collection of quizCollections) {
  check(`${collection.id} has eight questions`, collection.questions.length === 8);
  const ids = new Set(collection.questions.map((question) => question.id));
  check(`${collection.id} question ids are unique`, ids.size === collection.questions.length);
  for (const question of collection.questions) {
    check(`${question.id} has prompt`, question.question.length > 0);
    check(`${question.id} has answer`, question.answer.length > 0);
    check(`${question.id} has explanation`, question.explanation.length > 0);
    check(`${question.id} has tags`, question.tags.length > 0);
  }
}

if (failures > 0) {
  console.error(`${failures} quiz data test(s) failed`);
  process.exit(1);
}

console.log('quiz data: all tests passed');
