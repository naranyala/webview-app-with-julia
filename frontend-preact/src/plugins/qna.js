const STORED_QNA = /^\s*Question:\s*\n([\s\S]*?)\n+Answer:\s*\n([\s\S]*)$/i;
const QUESTION_LABEL = /^\s*(?:\*\*)?(?:question|q|user)(?:\*\*)?\s*:\s?(.*)$/i;
const ANSWER_LABEL =
  /^\s*(?:\*\*)?(?:answer|a|assistant|ai)(?:\*\*)?\s*:\s?(.*)$/i;

export function serializeQna(question, answer) {
  return `Question:\n${question.trim()}\n\nAnswer:\n${answer.trim()}`;
}

export function parseStoredQna(body) {
  const match = STORED_QNA.exec(body || '');
  if (!match) return { question: '', answer: body || '' };
  return { question: match[1].trim(), answer: match[2].trim() };
}

export function parseExternalChat(text) {
  const normalized = (text || '').replace(/\r\n?/g, '\n').trim();
  if (!normalized) return null;

  const lines = normalized.split('\n');
  const questionIndex = lines.findIndex((line) => QUESTION_LABEL.test(line));
  const answerIndex = lines.findIndex(
    (line, index) => index > questionIndex && ANSWER_LABEL.test(line)
  );

  if (questionIndex >= 0 && answerIndex > questionIndex) {
    const questionLine = QUESTION_LABEL.exec(lines[questionIndex]);
    const answerLine = ANSWER_LABEL.exec(lines[answerIndex]);
    const question = [
      questionLine?.[1] || '',
      ...lines.slice(questionIndex + 1, answerIndex)
    ]
      .join('\n')
      .trim();
    const answer = [answerLine?.[1] || '', ...lines.slice(answerIndex + 1)]
      .join('\n')
      .trim();
    if (question && answer) return { question, answer };
  }

  const blocks = normalized.split(/\n\s*\n/).filter(Boolean);
  if (blocks.length >= 2) {
    return {
      question: blocks[0].trim(),
      answer: blocks.slice(1).join('\n\n').trim()
    };
  }

  return { question: '', answer: normalized };
}
