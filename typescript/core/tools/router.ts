import { TOOL_ROUTING_MODE_MAP } from '@/core/constants';
import { normalizeText, similarity } from './utils';
import { normaliseTool } from './schema';
import type {
  ToolDefinition,
  ToolScoreResult,
  ToolRouteCandidate,
  ToolRouteResult
} from '@types';

/**
 * Evaluates and scores a tool definition against a user query string based on keywords, examples, labels, and descriptions.
 *
 * @param tool - Target tool definition to score.
 * @param query - User natural language query string.
 * @returns Object containing confidence score (0 to 1) and match reason.
 */
export function scoreTool(tool: ToolDefinition, query: string): ToolScoreResult {
  const normalizedQuery = normalizeText(query);
  const excludeKeywords = Array.isArray(tool.excludeKeywords) ? tool.excludeKeywords : [];
  if (
    typeof normalizedQuery !== 'string' ||
    normalizedQuery === '' ||
    excludeKeywords.some(
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

  const keywords = Array.isArray(tool.keywords) ? tool.keywords : [];
  keywords.forEach((keyword) => {
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

  const examples = Array.isArray(tool.examples) ? tool.examples : [];
  examples.forEach((example) => {
    const similarityScore = similarity(normalizedQuery, example);
    const exampleScore = 0.18 + similarityScore * 0.72;
    if (similarityScore >= 0.28 && exampleScore > totalScore) {
      totalScore = exampleScore;
      matchReason = 'example';
    }
  });

  const label = tool.label || tool.name;
  const labelSimilarity = similarity(normalizedQuery, label);
  const labelScore = 0.16 + labelSimilarity * 0.65;
  if (labelSimilarity >= 0.3 && labelScore > totalScore) {
    totalScore = labelScore;
    matchReason = 'label';
  }

  const description = tool.description || '';
  const descriptionSimilarity = similarity(normalizedQuery, description);
  const descriptionScore = 0.1 + descriptionSimilarity * 0.52;
  if (descriptionSimilarity >= 0.34 && descriptionScore > totalScore) {
    totalScore = descriptionScore;
    matchReason = 'description';
  }

  const priority = typeof tool.priority === 'number' ? tool.priority : 0;
  totalScore = Math.max(0, Math.min(1, totalScore + priority * 0.012));
  return { score: totalScore, reason: matchReason || 'none' };
}

/**
 * Routes user query across available tools to determine the best candidate match or ambiguous choices.
 *
 * @param tools - Array of available tool definitions.
 * @param query - User natural language query string.
 * @returns Routing result containing best match, ambiguous candidate list, and all candidates.
 */
export function route(
  tools: Array<ToolDefinition | Record<string, any>>,
  query: string
): ToolRouteResult {
  const candidateList: ToolRouteCandidate[] = (Array.isArray(tools) === true ? tools : [])
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
        candidateItem.score >= (candidateItem.tool.routeThreshold ?? 0.34)
    )
    .sort(
      (candidateA, candidateB) =>
        candidateB.score - candidateA.score ||
        (candidateB.tool.priority ?? 0) - (candidateA.tool.priority ?? 0)
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
