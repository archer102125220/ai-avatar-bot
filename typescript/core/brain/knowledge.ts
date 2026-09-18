import type { KnowledgeEntry, BrainEngine } from '@types';

/**
 * Fetches knowledge base JSON entries from a URL.
 *
 * @param knowledgeUrl - Knowledge base JSON endpoint URL.
 * @returns Promise resolving to knowledge entries array.
 */
export async function fetchKnowledge(
  knowledgeUrl = ''
): Promise<KnowledgeEntry[]> {
  try {
    if (typeof knowledgeUrl === 'string' && knowledgeUrl !== '') {
      const response = await fetch(knowledgeUrl);
      const knowledge =
        typeof response?.json === 'function' ? await response.json() : [];
      if (Array.isArray(knowledge) === false) {
        throw new Error('[aiAvatar fetchKnowledge] Knowledge is not an array');
      }
      return knowledge as KnowledgeEntry[];
    }
  } catch (_error) {
    // Return empty array on network/fetch failure
  }
  return [];
}

/**
 * Splits text into adjacent two-character bigrams for lightweight character-level similarity calculation.
 *
 * @param text - Input text.
 * @returns Array of character bigrams.
 */
export function getBigrams(text?: string | null): string[] {
  const normalizedText = (text || '')
    .toLowerCase()
    .replace(/[\s，。、？！,.?!~～]/g, '');
  const grams: string[] = [];
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
 * @param query - Query string.
 * @param text - Target text string.
 * @returns Similarity score between 0 and 1.
 */
export function calculateKnowledgeSimilarity(
  query: string,
  text: string
): number {
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
 * @param question - User query or chat history array.
 * @param entry - Candidate knowledge entry.
 * @returns Relevance score.
 */
export function scoreKnowledgeEntry(
  question: string | Array<{ content?: string }>,
  entry: KnowledgeEntry
): number {
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
  const terms = targetKeyword.split(/\s+/).filter((item) => item !== '');
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
 * @param brainEngine - Brain engine instance.
 * @param question - User question text or messages array.
 * @param limit - Maximum number of knowledge items to return.
 * @returns Array of ranked matching knowledge entries.
 */
export function getTopKnowledge(
  brainEngine: BrainEngine | Record<string, unknown> | null | undefined,
  question: string | Array<{ content?: string }>,
  limit: number
): KnowledgeEntry[] {
  const knowledge =
    brainEngine && Array.isArray((brainEngine as { knowledge?: KnowledgeEntry[] }).knowledge)
      ? (brainEngine as { knowledge: KnowledgeEntry[] }).knowledge
      : [];

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
 * @param knowledgeList - List of candidate knowledge entries.
 * @param question - User question text.
 * @returns Best matching entry and score.
 */
export function findBestMatch(
  knowledgeList: KnowledgeEntry[] = [],
  question: string
): { entry: KnowledgeEntry | null; score: number } {
  let bestEntry: KnowledgeEntry | null = null;
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
