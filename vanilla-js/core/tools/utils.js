/**
 * 將輸入值轉換為字串，去除前後空白，並限制最大長度。
 * @param {any} value - 要處理的值
 * @param {number} [maxLength=240] - 字串的最大長度，預設為 240
 * @returns {string} 處理後的字串
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
 * 將輸入值標準化：轉小寫、去除常見標點符號與空白，長度限制為 1200。
 * @param {any} value - 要標準化的值
 * @returns {string} 標準化後的字串
 */
export function normalizeText(value) {
  return sanitizeText(value, 1200)
    .toLowerCase()
    .replace(/[\s，。、！？,.!?：:；;()（）]+/g, '');
}

/**
 * 轉義正則表達式中的特殊字元，以避免語法錯誤或非預期的比對。
 * @param {string|any} patternString - 需轉義的字串
 * @returns {string} 轉義後的字串
 */
export function escapeRegExp(patternString) {
  return String(patternString).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 將字串轉換為二元字元組 (Bigrams) 陣列，用於字串相似度計算。
 * @param {any} textValue - 要處理的字串
 * @returns {string[]} 二元字元組陣列
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
 * 計算兩個字串基於二元字元組 (Bigrams) 的相似度。
 * @param {string} sourceString - 第一個字串
 * @param {string} targetString - 第二個字串
 * @returns {number} 相似度分數，範圍為 0 到 1
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
 * 從查詢字串中，尋找符合指定前綴 (Prefixes) 之後的內容。
 * @param {string} query - 使用者查詢字串
 * @param {string[]} prefixes - 允許的前綴陣列
 * @returns {string} 匹配到的內容，若無則為空字串
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
