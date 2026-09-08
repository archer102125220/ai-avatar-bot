import { TOOL_ROUTING_MODE_MAP } from '../constants';
import { normalizeText, similarity } from './utils';
import { normaliseTool } from './schema';

/**
 * @typedef {object} ToolScoreResult
 * @property {number} score - 評分分數 (0-1)
 * @property {string} reason - 評分原因 (如 keyword, example, label, description 等)
 */

/**
 * 根據使用者的輸入 (Query)，為指定的工具進行評分，評估其適用性。
 * @param {import('./schema').ToolDefinition} tool - 要評分的工具定義物件 (需先標準化)
 * @param {string} query - 使用者的輸入查詢
 * @returns {ToolScoreResult} 包含分數 (0-1) 與評分原因的物件
 */
export function scoreTool(tool, query) {
  const normalizedQuery = normalizeText(query);
  if (
    typeof normalizedQuery !== 'string' ||
    normalizedQuery === '' ||
    tool.excludeKeywords.some(
      (excludeItem) =>
        typeof excludeItem === 'string' &&
        excludeItem !== '' &&
        normalizedQuery.includes(normalizeText(excludeItem))
    )
  ) {
    return { score: 0, reason: 'excluded' };
  }
  let totalScore = 0;
  let matchReason = '';
  tool.keywords.forEach((keyword) => {
    const normalizedKeyword = normalizeText(keyword);
    if (typeof normalizedKeyword !== 'string' || normalizedKeyword === '') {
      return;
    }
    const keywordScore = normalizedQuery.includes(normalizedKeyword)
      ? Math.min(0.92, 0.62 + normalizedKeyword.length * 0.035)
      : similarity(normalizedQuery, normalizedKeyword) * 0.62;
    if (keywordScore > totalScore) {
      totalScore = keywordScore;
      matchReason = normalizedQuery.includes(normalizedKeyword)
        ? `keyword:${keyword}`
        : 'keyword-similarity';
    }
  });
  tool.examples.forEach((example) => {
    const similarityScore = similarity(normalizedQuery, example);
    const exampleScore = 0.18 + similarityScore * 0.72;
    if (similarityScore >= 0.28 && exampleScore > totalScore) {
      totalScore = exampleScore;
      matchReason = 'example';
    }
  });
  const labelSimilarity = similarity(normalizedQuery, tool.label);
  const labelScore = 0.16 + labelSimilarity * 0.65;
  if (labelSimilarity >= 0.3 && labelScore > totalScore) {
    totalScore = labelScore;
    matchReason = 'label';
  }
  const descriptionSimilarity = similarity(normalizedQuery, tool.description);
  const descriptionScore = 0.1 + descriptionSimilarity * 0.52;
  if (descriptionSimilarity >= 0.34 && descriptionScore > totalScore) {
    totalScore = descriptionScore;
    matchReason = 'description';
  }
  totalScore = Math.max(0, Math.min(1, totalScore + tool.priority * 0.012));
  return { score: totalScore, reason: matchReason || 'none' };
}

/**
 * @typedef {object} ToolRouteCandidate
 * @property {import('./schema').ToolDefinition} tool - 候選工具
 * @property {number} score - 評分分數
 * @property {string} reason - 評分原因
 */

/**
 * @typedef {object} ToolRouteResult
 * @property {ToolRouteCandidate|null} match - 最佳匹配工具
 * @property {ToolRouteCandidate[]} ambiguous - 模糊匹配選項
 * @property {ToolRouteCandidate[]} candidates - 所有候選工具
 */

/**
 * 根據使用者輸入，在多個工具中路由出最適合的工具與候選名單。
 * @param {Array<object|import('./schema').ToolDefinition>} tools - 可用的工具清單
 * @param {string} query - 使用者的輸入查詢
 * @returns {ToolRouteResult} 路由結果，包含最佳匹配、模糊匹配選項與所有候選工具
 */
export function route(tools, query) {
  const candidateList = (Array.isArray(tools) === true ? tools : [])
    .map(normaliseTool)
    .filter(
      (tool) =>
        tool.name !== '' && tool.routingMode !== TOOL_ROUTING_MODE_MAP.AI
    )
    .map((tool) => {
      const scoredResult = scoreTool(tool, query);
      return { tool, score: scoredResult.score, reason: scoredResult.reason };
    })
    .filter(
      (candidateItem) => candidateItem.score >= candidateItem.tool.routeThreshold
    )
    .sort(
      (candidateA, candidateB) =>
        candidateB.score - candidateA.score ||
        candidateB.tool.priority - candidateA.tool.priority
    );

  const topCandidate = candidateList[0] || null;
  const secondCandidate = candidateList[1] || null;
  const isAmbiguous =
    typeof topCandidate === 'object' &&
    topCandidate !== null &&
    typeof secondCandidate === 'object' &&
    secondCandidate !== null &&
    topCandidate.score - secondCandidate.score < 0.09;

  return {
    match: isAmbiguous === true ? null : topCandidate,
    ambiguous: isAmbiguous === true ? candidateList.slice(0, 3) : [],
    candidates: candidateList
  };
}
