/**
 * Converts an arbitrary input value to a trimmed string, bounded by a maximum character length.
 *
 * @param {any} value - Input value to sanitize.
 * @param {number} [maxLength=240] - Maximum allowed character length (default 240).
 * @returns {string} Sanitized string.
 */
export function sanitizeText(value, maxLength = 240) {
  const safeMaxLength =
    typeof maxLength === 'number' &&
    Number.isFinite(maxLength) === true &&
    maxLength > 0
      ? maxLength
      : 240;

  return String(value || '')
    .trim()
    .slice(0, safeMaxLength);
}

/**
 * Normalizes an input string: converts to lowercase, strips common punctuation and whitespace, capped at 1200 characters.
 *
 * @param {any} value - Value to normalize.
 * @returns {string} Normalized plain text.
 */
export function normalizeText(value) {
  return sanitizeText(value, 1200)
    .toLowerCase()
    .replace(/[\s，。、！？,.!?：:；;()（）]+/g, '');
}

/**
 * Escapes special regex metacharacters in a string to safely embed it in dynamic Regular Expressions.
 *
 * @param {string | any} patternString - Pattern string to escape.
 * @returns {string} Escaped regex-safe string.
 */
export function escapeRegExp(patternString) {
  return String(patternString).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Converts a string into an array of character bigrams (2-grams) for similarity matching.
 *
 * @param {any} textValue - String to extract bigrams from.
 * @returns {string[]} Array of 2-character bigrams.
 */
export function generateBigrams(textValue) {
  const normalizedText = normalizeText(textValue);
  const bigramList = [];
  if (normalizedText.length === 1) {
    return [normalizedText];
  }
  for (let index = 0; index < normalizedText.length - 1; index++) {
    bigramList.push(normalizedText.slice(index, index + 2));
  }
  return bigramList;
}

/**
 * Computes Dice/Sørensen-like similarity coefficient between two strings based on bigram overlap.
 *
 * @param {string} sourceString - First comparison string.
 * @param {string} targetString - Second comparison string.
 * @returns {number} Similarity score ranging from 0 to 1.
 */
export function similarity(sourceString, targetString) {
  const sourceBigrams = generateBigrams(sourceString);
  const targetBigrams = new Set(generateBigrams(targetString));
  if (sourceBigrams.length === 0 || targetBigrams.size === 0) {
    return 0;
  }
  let matchCount = 0;
  sourceBigrams.forEach((bigramItem) => {
    if (targetBigrams.has(bigramItem) === true) {
      matchCount++;
    }
  });
  return matchCount / Math.sqrt(sourceBigrams.length * targetBigrams.size);
}

/**
 * Searches user query text for parameter values following designated keyword prefixes (e.g. "地點是", "name:").
 *
 * @param {string} query - User natural language query string.
 * @param {string[]} prefixes - Array of prefix strings to look for.
 * @returns {string} Extracted parameter value string, or empty string if no match found.
 */
export function findPrefixedValue(query, prefixes) {
  for (let index = 0; index < prefixes.length; index++) {
    const prefixPattern = new RegExp(
      escapeRegExp(prefixes[index]) +
        '\\s*(?:是|為|=|:|：)?\\s*([^，。！？,!?]{1,120})',
      'i'
    );
    const regexMatch = prefixPattern.exec(query);
    if (regexMatch !== null) {
      return regexMatch[1].trim();
    }
  }
  return '';
}
