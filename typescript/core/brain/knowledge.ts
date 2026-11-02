import { AVATAR_MODE_MAP, DEFAULT_AVATAR_MODE } from '@/core/constants';
import type { KnowledgeEntry, BrainEngine, CustomModeConfig } from './types';

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
 * Retrieves top K relevant knowledge entries matching the user question using multi-knowledge tiered RAG.
 *
 * @param brainEngine - Brain engine instance.
 * @param question - User question text or messages array.
 * @param limit - Maximum number of knowledge items to return (defaults to engine.knowledgeLimit ?? 3).
 * @returns Array of ranked matching knowledge entries tagged with tier attribution ('mode' | 'shared').
 */
export function getTopKnowledge(
  brainEngine: BrainEngine | Record<string, unknown> | null | undefined,
  question: string | Array<{ content?: string }>,
  limit?: number
): KnowledgeEntry[] {
  if (typeof brainEngine !== 'object' || brainEngine === null) {
    return [];
  }

  const engine = brainEngine as Partial<BrainEngine> & Record<string, unknown>;

  const resolvedLimit =
    typeof limit === 'number' && Number.isFinite(limit) === true
      ? Math.max(0, limit)
      : typeof engine.knowledgeLimit === 'number' &&
          Number.isFinite(engine.knowledgeLimit) === true
        ? Math.max(0, engine.knowledgeLimit)
        : typeof (engine as { ragTopK?: number }).ragTopK === 'number' &&
            Number.isFinite((engine as { ragTopK: number }).ragTopK) === true
          ? Math.max(0, (engine as { ragTopK: number }).ragTopK)
          : 3;

  if (resolvedLimit === 0) {
    return [];
  }

  const currentMode =
    typeof engine.avatarMode === 'string' && engine.avatarMode !== ''
      ? engine.avatarMode
      : DEFAULT_AVATAR_MODE;

  // 1. 動態解析雙層知識庫
  // 1.1 當前模式專屬庫 (Mode-Specific Knowledge)
  let modeKnowledge: KnowledgeEntry[] = [];
  if (currentMode === AVATAR_MODE_MAP.companion) {
    if (Array.isArray(engine.companionKnowledge) === true) {
      modeKnowledge = engine.companionKnowledge;
    }
  } else if (
    typeof engine.modes === 'object' &&
    engine.modes !== null &&
    typeof (engine.modes as Record<string, CustomModeConfig>)[currentMode] ===
      'object' &&
    (engine.modes as Record<string, CustomModeConfig>)[currentMode] !== null
  ) {
    const customConfig = (
      engine.modes as Record<string, CustomModeConfig>
    )[currentMode];
    if (Array.isArray(customConfig?.knowledge) === true) {
      modeKnowledge = customConfig.knowledge as KnowledgeEntry[];
    }
  } else {
    // Assistant 模式或預設
    if (Array.isArray(engine.assistantKnowledge) === true) {
      modeKnowledge = engine.assistantKnowledge as KnowledgeEntry[];
    }
  }

  // 1.2 通用常識庫 (General / Shared Knowledge)
  let sharedKnowledge: KnowledgeEntry[] = [];
  if (Array.isArray(engine.sharedKnowledge) === true) {
    sharedKnowledge = engine.sharedKnowledge as KnowledgeEntry[];
  } else if (Array.isArray(engine.knowledge) === true) {
    sharedKnowledge = engine.knowledge as KnowledgeEntry[];
  }

  const getEntryKey = (item: KnowledgeEntry): string => {
    const q = typeof item.q === 'string' ? item.q : String(item.q || '');
    const a = typeof item.a === 'string' ? item.a : String(item.a || '');
    return `${q}:::${a}`;
  };

  // 2. 判斷過濾模式 (knowledgeFilter)
  const filterSetting = engine.knowledgeFilter;
  const isBypass = filterSetting === false;

  // 若 knowledgeFilter === false (全權推論模式)：跳過相似度計算與門檻，直接合併專屬庫與通用庫
  if (isBypass === true) {
    const results: KnowledgeEntry[] = [];
    const seenKeys = new Set<string>();

    for (const entry of modeKnowledge) {
      const key = getEntryKey(entry);
      if (seenKeys.has(key) === false) {
        seenKeys.add(key);
        results.push({ ...entry, tier: 'mode' });
        if (results.length >= resolvedLimit) {
          return results;
        }
      }
    }

    for (const entry of sharedKnowledge) {
      const key = getEntryKey(entry);
      if (seenKeys.has(key) === false) {
        seenKeys.add(key);
        results.push({ ...entry, tier: 'shared' });
        if (results.length >= resolvedLimit) {
          return results;
        }
      }
    }

    return results;
  }

  // 3. 相似度排序模式 (knowledgeFilter === true 或自訂過濾函數)
  const safeQuestion =
    typeof question === 'string'
      ? question
      : Array.isArray(question) === true
        ? question[question.length - 1]?.content || ''
        : String(question || '');

  const customFilterFn =
    typeof filterSetting === 'function' ? filterSetting : null;

  // 3.1 評分與合格篩選
  const filterAndScore = (
    entries: KnowledgeEntry[]
  ): Array<{ entry: KnowledgeEntry; score: number }> => {
    return entries
      .filter((entry) => {
        if (customFilterFn !== null) {
          return customFilterFn(entry, safeQuestion) === true;
        }
        return true;
      })
      .map((entry) => ({ entry, score: scoreKnowledgeEntry(question, entry) }))
      .filter((item) => (customFilterFn !== null ? true : item.score > 0.05))
      .sort((a, b) => b.score - a.score);
  };

  const rankedMode = filterAndScore(modeKnowledge);
  const rankedShared = filterAndScore(sharedKnowledge);

  // 3.2 階梯式槽位保護 (專屬庫優先，未滿 limit 則由通用庫補齊)
  const results: KnowledgeEntry[] = [];
  const seenKeys = new Set<string>();

  for (const item of rankedMode) {
    const key = getEntryKey(item.entry);
    if (seenKeys.has(key) === false) {
      seenKeys.add(key);
      results.push({ ...item.entry, tier: 'mode' });
      if (results.length >= resolvedLimit) {
        return results;
      }
    }
  }

  for (const item of rankedShared) {
    const key = getEntryKey(item.entry);
    if (seenKeys.has(key) === false) {
      seenKeys.add(key);
      results.push({ ...item.entry, tier: 'shared' });
      if (results.length >= resolvedLimit) {
        return results;
      }
    }
  }

  return results;
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
