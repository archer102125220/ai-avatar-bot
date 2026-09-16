import { TOOL_ROUTING_MODE_MAP } from '../constants';
import { normalizeText, similarity } from './utils';
import { normaliseTool } from './schema';

/**
 * Scoring evaluation result for a tool against a user query.
 * @typedef {import('../../index.d.ts').ToolScoreResult} ToolScoreResult
 */

/**
 * Evaluates and scores a tool definition against a user query string based on keywords, examples, labels, and descriptions.
 *
 * @param {import('../../index.d.ts').ToolDefinition} tool - Target tool definition to score.
 * @param {string} query - User natural language query string.
 * @returns {ToolScoreResult} Object containing confidence score (0 to 1) and match reason.
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
 * Candidate tool matched during routing evaluation.
 * @typedef {import('../../index.d.ts').ToolRouteCandidate} ToolRouteCandidate
 */

/**
 * Result of tool intent routing.
 * @typedef {import('../../index.d.ts').ToolRouteResult} ToolRouteResult
 */

/**
 * Routes user query across available tools to determine the best candidate match or ambiguous choices.
 *
 * @param {Array<import('../../index.d.ts').ToolDefinition | Record<string, any>>} tools - Array of available tool definitions.
 * @param {string} query - User natural language query string.
 * @returns {ToolRouteResult} Routing result containing best match, ambiguous candidate list, and all candidates.
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
      (candidateItem) =>
        candidateItem.score >= candidateItem.tool.routeThreshold
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
