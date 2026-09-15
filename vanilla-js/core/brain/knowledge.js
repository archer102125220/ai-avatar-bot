/**
 * Knowledge base entry item.
 * @typedef {Object} KnowledgeEntry
 * @property {string} [q] - Question or prompt text.
 * @property {string} [kw] - Keywords associated with the entry.
 * @property {string} [a] - Answer or response text.
 * @property {Object} [source] - Optional source attribution data.
 * @property {string} [source.title] - Source title.
 * @property {string} [source.url] - Source URL.
 */

/**
 * Fetches knowledge base JSON entries from a URL.
 *
 * @param {string} [knowledgeUrl=''] - Knowledge base JSON endpoint URL.
 * @returns {Promise<Array<KnowledgeEntry>>} Promise resolving to knowledge entries array.
 */
export async function fetchKnowledge(knowledgeUrl = '') {
  try {
    if (typeof knowledgeUrl === 'string' && knowledgeUrl !== '') {
      const knowledge = await fetch(knowledgeUrl).then((response) => {
        if (typeof response?.json === 'function') {
          return response.json();
        }
        return response || [];
      });
      if (Array.isArray(knowledge) === false) {
        throw new Error('[aiAvatar fetchKnowledge] Knowledge is not an array');
      }
      return knowledge;
    }
  } catch (_error) {}
  return [];
}

/**
 * Splits text into adjacent two-character bigrams for lightweight character-level similarity calculation.
 *
 * @param {string} text - Input text.
 * @returns {string[]} Array of character bigrams.
 */
export function getBigrams(text) {
  const normalizedText = (text || '')
    .toLowerCase()
    .replace(/[\s，。、？！,.?!~～]/g, '');
  const grams = [];
  for (let charIndex = 0; charIndex < normalizedText.length - 1; charIndex++) {
    grams.push(normalizedText.slice(charIndex, charIndex + 2));
  }
  if (normalizedText.length === 1) {
    grams.push(normalizedText);
  }
  return grams;
}

/**
 * Computes Cosine-like similarity score between two strings using bigram token sets.
 *
 * @param {string} query - Query string.
 * @param {string} text - Target text string.
 * @returns {number} Similarity score between 0 and 1.
 */
export function calculateKnowledgeSimilarity(query, text) {
  const queryBigrams = getBigrams(query);
  const textBigramsSet = new Set(getBigrams(text));
  if (queryBigrams.length === 0 || textBigramsSet.size === 0) {
    return 0;
  }
  let hit = 0;
  for (const gram of queryBigrams) {
    if (textBigramsSet.has(gram) === true) {
      hit++;
    }
  }
  return hit / Math.sqrt(queryBigrams.length * textBigramsSet.size);
}

/**
 * Scores the relevance of a knowledge entry against a user question.
 *
 * @param {string | Array<any>} question - User query or chat history array.
 * @param {KnowledgeEntry} entry - Candidate knowledge entry.
 * @returns {number} Relevance score.
 */
export function scoreKnowledgeEntry(question, entry) {
  const safeQuestion =
    typeof question === 'string'
      ? question
      : Array.isArray(question) === true
        ? question[question.length - 1]?.content || ''
        : String(question || '');
  const targetQuestion =
    typeof entry.q === 'string' ? entry.q : String(entry.q || '');
  const targetKeyword =
    typeof entry.kw === 'string' ? entry.kw : String(entry.kw || '');
  let score = Math.max(
    calculateKnowledgeSimilarity(safeQuestion, targetQuestion),
    calculateKnowledgeSimilarity(safeQuestion, targetKeyword)
  );
  const terms = targetKeyword.split(/\s+/).filter(Boolean);
  for (const term of terms) {
    if (term.length >= 2 && safeQuestion.includes(term) === true) {
      score = Math.max(score, 0.5 + term.length * 0.04);
    }
  }
  return score;
}

/**
 * Retrieves top K relevant knowledge entries matching the user question.
 *
 * @param {import('../../index.d.ts').BrainEngine | Object} brainEngine - Brain engine instance.
 * @param {string | Array<any>} question - User question text or messages array.
 * @param {number} limit - Maximum number of knowledge items to return.
 * @returns {Array<KnowledgeEntry>} Array of ranked matching knowledge entries.
 */
export function getTopKnowledge(brainEngine, question, limit) {
  const knowledge = brainEngine?.knowledge || [];

  return knowledge
    .map((entry) => ({ entry, score: scoreKnowledgeEntry(question, entry) }))
    .sort((firstItem, secondItem) => secondItem.score - firstItem.score)
    .slice(0, limit)
    .filter((item) => item.score > 0.05)
    .map((item) => item.entry);
}

/**
 * Finds the highest-scoring knowledge entry matching a question.
 *
 * @param {Array<KnowledgeEntry>} [knowledgeList=[]] - List of candidate knowledge entries.
 * @param {string} question - User question text.
 * @returns {{ entry: KnowledgeEntry | null, score: number }} Best matching entry and score.
 */
export function findBestMatch(knowledgeList = [], question) {
  let bestEntry = null;
  let bestScore = 0;
  for (const entry of knowledgeList || []) {
    const score = scoreKnowledgeEntry(question, entry);
    if (score > bestScore) {
      bestScore = score;
      bestEntry = entry;
    }
  }
  return { entry: bestEntry, score: bestScore };
}

