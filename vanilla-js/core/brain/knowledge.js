/**
 * 知識庫項目
 * @typedef {Object} KnowledgeEntry
 * @property {string} [q] - 項目問題
 * @property {string} [kw] - 項目關鍵字
 * @property {string} [a] - 項目回答
 * @property {Object} [source] - 項目來源資料
 * @property {string} [source.title] - 來源標題
 * @property {string} [source.url] - 來源連結
 */

/**
 * 取得知識庫內容
 * @param {string} [knowledgeUrl=''] - 知識庫的 URL
 * @returns {Promise<Array<KnowledgeEntry>>} 知識庫陣列資料
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
 * 相容別名：handleGetKnowledge -> fetchKnowledge
 */
export const handleGetKnowledge = fetchKnowledge;

// ===== 大腦：知識檢索演算法 =====
// 中文不好斷詞，改用「字元 bigram（相鄰兩字）」相似度，對中文很有效、又不用任何外部函式庫。
/**
 * 將字串轉換為相鄰兩字元（bigram）陣列
 * @param {string} text - 要處理的字串
 * @returns {string[]} bigram 陣列
 */
export function getBigrams(text) {
  const normalizedText = (text || '')
    .toLowerCase()
    .replace(/[\s，。、？！,.?!~～]/g, '');
  const grams = [];
  for (
    let charIndex = 0;
    charIndex < normalizedText.length - 1;
    charIndex++
  ) {
    grams.push(normalizedText.slice(charIndex, charIndex + 2));
  }
  if (normalizedText.length === 1) {
    grams.push(normalizedText);
  }
  return grams;
}

/**
 * 相容別名：bigrams -> getBigrams
 */
export const bigrams = getBigrams;

/**
 * 計算兩個字串基於 bigram 的知識庫相似度
 * @param {string} query - 查詢字串
 * @param {string} text - 目標文本字串
 * @returns {number} 相似度分數 (0 到 1)
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
 * 通用別名：calculateBigramSimilarity -> calculateKnowledgeSimilarity
 */
export const calculateBigramSimilarity = calculateKnowledgeSimilarity;

/**
 * 相容別名：similarity -> calculateKnowledgeSimilarity
 */
export const similarity = calculateKnowledgeSimilarity;

/**
 * 評分知識庫項目與問題的相關性
 * @param {string|Array} question - 使用者問題
 * @param {KnowledgeEntry} entry - 知識庫項目
 * @returns {number} 相關性分數
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
 * 相容別名：scoreEntry -> scoreKnowledgeEntry
 */
export const scoreEntry = scoreKnowledgeEntry;

/**
 * 取得與問題最相關的 Top K 知識庫項目
 * @param {Object} brainEngine - 大腦引擎實例
 * @param {string|Array} question - 使用者問題
 * @param {number} limit - 擷取數量
 * @returns {Array<KnowledgeEntry>} 相關的知識庫項目陣列
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
 * 相容別名：topK -> getTopKnowledge
 */
export const topK = getTopKnowledge;

/**
 * 找出知識庫中得分最高的項目
 * @param {Array<KnowledgeEntry>} [knowledgeList=[]] - 知識庫陣列
 * @param {string} question - 使用者問題
 * @returns {{entry: KnowledgeEntry|null, score: number}} 最佳符合項目與分數 { entry, score }
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

/**
 * 相容別名：bestOf -> findBestMatch
 */
export const bestOf = findBestMatch;
