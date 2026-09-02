import {
  CHAT_SOURCE_MAP,
  DEFAULT_TOOL_CONFIRMATION_TIMEOUT_MS,
  DEFAULT_TOOL_RESULT_MODE,
  DEFAULT_TOOL_ROUTING_MODE,
  TOOL_CANCEL_REASON_MAP,
  TOOL_RESULT_MODE_MAP,
  TOOL_ROUTING_MODE_MAP,
  TOOL_SCHEMA_TYPE_MAP
} from './constants';

/**
 * @typedef {object} ToolSchemaProperty
 * @property {string} type - 屬性型別 (如 'string', 'number', 'boolean')
 * @property {string} title - 屬性名稱標題
 * @property {string} description - 屬性描述
 * @property {string} contextKey - 上下文中對應的鍵值
 * @property {string} format - 格式限制 (如 'email', 'url', 'phone', 'contact')
 * @property {string[]} prefixes - 允許的前綴陣列
 * @property {string[]} [enum] - 允許的列舉值
 * @property {number} [minimum] - 數值下限
 * @property {number} [maximum] - 數值上限
 * @property {number} maxLength - 字串最大長度
 */

/**
 * @typedef {object} ToolSchema
 * @property {string} type - 類型，通常為 'object'
 * @property {Record<string, ToolSchemaProperty>} properties - 屬性定義集合
 * @property {string[]} required - 必填屬性名稱陣列
 */

/**
 * @typedef {object} ToolDefinition
 * @property {string} name - 工具名稱
 * @property {string} label - 工具顯示名稱
 * @property {string} description - 工具描述
 * @property {string[]} keywords - 觸發工具的關鍵字
 * @property {string[]} examples - 觸發工具的範例語句
 * @property {string[]} excludeKeywords - 排除的關鍵字
 * @property {number} priority - 工具優先權 (-10 ~ 10)
 * @property {number} routeThreshold - 路由的門檻分數 (0.15 ~ 0.95)
 * @property {boolean} requiresConfirmation - 執行前是否需要確認
 * @property {'client'|'ai'|'hybrid'} [routingMode] - 路由決策模式 (client: 純前端, ai: 純AI, hybrid: 雙軌)
 * @property {'ai_summary'|'direct'} [resultMode] - 執行結果處理模式 (ai_summary: AI總結, direct: 直接輸出)
 * @property {number} [confirmationTimeoutMs] - 工具確認的逾時毫秒數
 * @property {number} [timeoutMs] - 相容舊版的逾時毫秒數
 * @property {function({args: Record<string, any>, context: any, query: string}): (Promise<any>|any)} [execute] - 工具執行函式
 * @property {ToolSchema} inputSchema - 工具參數的輸入綱要
 */

/**
 * 將輸入值轉換為字串，去除前後空白，並限制最大長度。
 * @param {any} value - 要處理的值
 * @param {number} [maxLength=240] - 字串的最大長度，預設為 240
 * @returns {string} 處理後的字串
 */
function sanitizeText(value, maxLength = 240) {
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
function normalizeText(value) {
  return sanitizeText(value, 1200)
    .toLowerCase()
    .replace(/[\s，。、！？,.!?：:；;()（）]+/g, '');
}

/**
 * 轉義正則表達式中的特殊字元，以避免語法錯誤或非預期的比對。
 * @param {string|any} patternString - 需轉義的字串
 * @returns {string} 轉義後的字串
 */
function escapeRegExp(patternString) {
  return String(patternString).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 將字串轉換為二元字元組 (Bigrams) 陣列，用於字串相似度計算。
 * @param {any} textValue - 要處理的字串
 * @returns {string[]} 二元字元組陣列
 */
function generateBigrams(textValue) {
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
 * 標準化工具的輸入綱要 (Schema)，確保其格式與屬性符合預期。
 * @param {object|ToolSchema} schema - 原始的輸入綱要
 * @returns {ToolSchema} 標準化後的輸入綱要
 */
export function normaliseSchema(schema) {
  if (
    typeof schema !== 'object' ||
    schema === null ||
    schema.type !== 'object' ||
    typeof schema.properties !== 'object' ||
    schema.properties === null
  ) {
    return { type: 'object', properties: {}, required: [] };
  }
  const normalizedProperties = {};
  Object.keys(schema.properties)
    .slice(0, 20)
    .forEach((propertyName) => {
      if (/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/.test(propertyName) === false) {
        return;
      }
      const rawProperty = schema.properties[propertyName] || {};
      const propertyType =
        /^(string|number|integer|boolean)$/.test(rawProperty.type) === true
          ? rawProperty.type
          : 'string';
      const propertyConfig = {
        type: propertyType,
        title: sanitizeText(rawProperty.title || propertyName, 80),
        description: sanitizeText(rawProperty.description, 160),
        contextKey: sanitizeText(rawProperty.contextKey, 60),
        format:
          /^(email|url|phone|contact)$/.test(rawProperty.format) === true
            ? rawProperty.format
            : '',
        prefixes:
          Array.isArray(rawProperty.prefixes) === true
            ? rawProperty.prefixes
                .slice(0, 8)
                .map((prefixItem) => sanitizeText(prefixItem, 30))
                .filter(
                  (prefixItem) =>
                    typeof prefixItem === 'string' && prefixItem !== ''
                )
            : []
      };
      if (Array.isArray(rawProperty.enum) === true) {
        propertyConfig.enum = rawProperty.enum
          .slice(0, 20)
          .map((enumItem) => sanitizeText(enumItem, 80))
          .filter(
            (enumItem) => typeof enumItem === 'string' && enumItem !== ''
          );
      }
      if (
        typeof rawProperty.minimum === 'number' &&
        Number.isFinite(rawProperty.minimum) === true
      ) {
        propertyConfig.minimum = rawProperty.minimum;
      } else if (
        typeof rawProperty.minimum === 'string' &&
        Number.isFinite(Number(rawProperty.minimum)) === true
      ) {
        propertyConfig.minimum = Number(rawProperty.minimum);
      }

      if (
        typeof rawProperty.maximum === 'number' &&
        Number.isFinite(rawProperty.maximum) === true
      ) {
        propertyConfig.maximum = rawProperty.maximum;
      } else if (
        typeof rawProperty.maximum === 'string' &&
        Number.isFinite(Number(rawProperty.maximum)) === true
      ) {
        propertyConfig.maximum = Number(rawProperty.maximum);
      }

      propertyConfig.maxLength = Math.max(
        1,
        Math.min(Number(rawProperty.maxLength) || 300, 1000)
      );
      normalizedProperties[propertyName] = propertyConfig;
    });
  const required =
    Array.isArray(schema.required) === true
      ? schema.required
          .filter(
            (requiredName) => normalizedProperties[requiredName] !== undefined
          )
          .slice(0, 20)
      : [];
  return { type: 'object', properties: normalizedProperties, required };
}

/**
 * 標準化工具定義物件，補齊預設值並確保格式正確。
 * @param {object|ToolDefinition} tool - 原始的工具定義物件
 * @returns {ToolDefinition} 標準化後的工具定義物件
 */
export function normaliseTool(tool) {
  const targetTool = typeof tool === 'object' && tool !== null ? tool : {};
  const rawRoutingMode = targetTool.routingMode;
  const routingMode =
    Object.values(TOOL_ROUTING_MODE_MAP).includes(rawRoutingMode) === true
      ? rawRoutingMode
      : DEFAULT_TOOL_ROUTING_MODE;

  const rawResultMode = targetTool.resultMode;
  const resultMode =
    Object.values(TOOL_RESULT_MODE_MAP).includes(rawResultMode) === true
      ? rawResultMode
      : DEFAULT_TOOL_RESULT_MODE;

  let confirmationTimeoutMs = null;
  if (
    typeof targetTool.confirmationTimeoutMs === 'number' &&
    Number.isFinite(targetTool.confirmationTimeoutMs) === true &&
    targetTool.confirmationTimeoutMs > 0
  ) {
    confirmationTimeoutMs = targetTool.confirmationTimeoutMs;
  } else if (
    typeof targetTool.timeoutMs === 'number' &&
    Number.isFinite(targetTool.timeoutMs) === true &&
    targetTool.timeoutMs > 0
  ) {
    confirmationTimeoutMs = targetTool.timeoutMs;
  }

  const execute =
    typeof targetTool.execute === 'function' ? targetTool.execute : null;

  return {
    name: sanitizeText(targetTool.name, 64).replace(/[^a-zA-Z0-9_.-]/g, ''),
    label: sanitizeText(targetTool.label || targetTool.name, 80),
    description: sanitizeText(targetTool.description, 240),
    keywords:
      Array.isArray(targetTool.keywords) === true
        ? targetTool.keywords
            .slice(0, 30)
            .map((keywordItem) => sanitizeText(keywordItem, 60).toLowerCase())
            .filter(
              (keywordItem) =>
                typeof keywordItem === 'string' && keywordItem !== ''
            )
        : [],
    examples:
      Array.isArray(targetTool.examples) === true
        ? targetTool.examples
            .slice(0, 20)
            .map((exampleItem) => sanitizeText(exampleItem, 160))
            .filter(
              (exampleItem) =>
                typeof exampleItem === 'string' && exampleItem !== ''
            )
        : [],
    excludeKeywords:
      Array.isArray(targetTool.excludeKeywords) === true
        ? targetTool.excludeKeywords
            .slice(0, 20)
            .map((excludeItem) => sanitizeText(excludeItem, 60).toLowerCase())
            .filter(
              (excludeItem) =>
                typeof excludeItem === 'string' && excludeItem !== ''
            )
        : [],
    priority: Math.max(-10, Math.min(Number(targetTool.priority) || 0, 10)),
    routeThreshold: Math.max(
      0.15,
      Math.min(Number(targetTool.routeThreshold) || 0.34, 0.95)
    ),
    requiresConfirmation: targetTool.requiresConfirmation !== false,
    routingMode,
    resultMode,
    confirmationTimeoutMs,
    execute,
    inputSchema: normaliseSchema(targetTool.inputSchema)
  };
}

/**
 * 取得可供 AI 大模型呼叫的工具清單 (過濾掉純前端模式的工具)
 * @param {Array<object|ToolDefinition>} tools - 工具清單
 * @returns {ToolDefinition[]} 可供 AI 使用的工具清單
 */
export function getAiAvailableTools(tools) {
  return (Array.isArray(tools) === true ? tools : [])
    .map(normaliseTool)
    .filter(
      (tool) =>
        tool.name !== '' && tool.routingMode !== TOOL_ROUTING_MODE_MAP.CLIENT
    );
}

/**
 * 將工具定義轉換為 OpenAI 相容的 JSON Schema tools 格式
 * @param {Array<object|ToolDefinition>} tools - 工具清單
 * @returns {Array<object>} OpenAI 相容的 tools 陣列
 */
export function toOpenAiTools(tools) {
  const aiTools = getAiAvailableTools(tools);
  return aiTools.map((tool) => {
    const properties = {};
    const schemaProperties = tool.inputSchema?.properties || {};
    Object.keys(schemaProperties).forEach((propertyKey) => {
      const propertySchema = schemaProperties[propertyKey];
      properties[propertyKey] = {
        type: propertySchema.type || TOOL_SCHEMA_TYPE_MAP.STRING,
        description:
          propertySchema.description || propertySchema.title || propertyKey
      };
      if (
        Array.isArray(propertySchema.enum) === true &&
        propertySchema.enum.length > 0
      ) {
        properties[propertyKey].enum = propertySchema.enum;
      }
    });

    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description || tool.label || tool.name,
        parameters: {
          type: TOOL_SCHEMA_TYPE_MAP.OBJECT,
          properties,
          required:
            Array.isArray(tool.inputSchema?.required) === true
              ? tool.inputSchema.required
              : []
        }
      }
    };
  });
}

/**
 * @typedef {object} ToolScoreResult
 * @property {number} score - 評分分數 (0-1)
 * @property {string} reason - 評分原因 (如 keyword, example, label, description 等)
 */

/**
 * 根據使用者的輸入 (Query)，為指定的工具進行評分，評估其適用性。
 * @param {ToolDefinition} tool - 要評分的工具定義物件 (需先標準化)
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
 * @property {ToolDefinition} tool - 候選工具
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
 * @param {Array<object|ToolDefinition>} tools - 可用的工具清單
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
    .filter((candidateItem) => candidateItem.score >= candidateItem.tool.routeThreshold)
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

/**
 * 從查詢字串中，尋找符合指定前綴 (Prefixes) 之後的內容。
 * @param {string} query - 使用者查詢字串
 * @param {string[]} prefixes - 允許的前綴陣列
 * @returns {string} 匹配到的內容，若無則為空字串
 */
function findPrefixedValue(query, prefixes) {
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

/**
 * 根據屬性定義，從查詢字串或上下文中提取出該屬性的值。
 * @param {string} propertyName - 屬性名稱
 * @param {ToolSchemaProperty} propertySchema - 屬性定義
 * @param {string} query - 使用者查詢字串
 * @param {Record<string, any>} context - 上下文資料物件
 * @param {boolean} allowWhole - 是否允許將整個查詢作為字串值
 * @returns {any} 提取出的屬性值，若無則為 undefined
 */
function extractPropertyValue(
  propertyName,
  propertySchema,
  query,
  context,
  allowWhole
) {
  if (
    typeof propertySchema.contextKey === 'string' &&
    propertySchema.contextKey !== '' &&
    typeof context === 'object' &&
    context !== null &&
    context[propertySchema.contextKey] !== undefined &&
    context[propertySchema.contextKey] !== null
  ) {
    return context[propertySchema.contextKey];
  }
  if (
    typeof context === 'object' &&
    context !== null &&
    context[propertyName] !== undefined &&
    context[propertyName] !== null
  ) {
    return context[propertyName];
  }

  const prefixedValue = findPrefixedValue(
    query,
    propertySchema.prefixes
      .concat([propertySchema.title])
      .filter((prefixItem) => typeof prefixItem === 'string' && prefixItem !== '')
  );

  if (Array.isArray(propertySchema.enum) === true) {
    const matchedOption = propertySchema.enum.find((enumItem) =>
      normalizeText(query).includes(normalizeText(enumItem))
    );
    if (typeof matchedOption !== 'undefined') {
      return matchedOption;
    }
  }
  if (propertySchema.format === 'email') {
    const emailMatch = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.exec(query);
    if (emailMatch !== null) {
      return emailMatch[0];
    }
  }
  if (propertySchema.format === 'url') {
    const urlMatch = /https?:\/\/[^\s，。]+/i.exec(query);
    if (urlMatch !== null) {
      return urlMatch[0];
    }
  }
  if (propertySchema.format === 'phone') {
    const phoneMatch = /(?:\+?\d[\s().-]*){8,18}/.exec(query);
    if (phoneMatch !== null) {
      return phoneMatch[0].trim();
    }
  }
  if (propertySchema.format === 'contact') {
    const contactEmailMatch = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.exec(query);
    if (contactEmailMatch !== null) {
      return contactEmailMatch[0];
    }
    const contactPhoneMatch = /(?:\+?\d[\s().-]*){8,18}/.exec(query);
    if (contactPhoneMatch !== null) {
      return contactPhoneMatch[0].trim();
    }
  }
  if (propertySchema.type === 'boolean') {
    if (/(不同意|不要|不用|否|不需要|false|no)/i.test(query) === true) {
      return false;
    }
    if (/(同意|要|需要|可以|是|true|yes)/i.test(query) === true) {
      return true;
    }
  }
  if (propertySchema.type === 'number' || propertySchema.type === 'integer') {
    const numberMatch = /-?\d+(?:\.\d+)?/.exec(prefixedValue || query);
    if (numberMatch !== null) {
      return propertySchema.type === 'integer'
        ? Math.round(Number(numberMatch[0]))
        : Number(numberMatch[0]);
    }
  }
  if (typeof prefixedValue === 'string' && prefixedValue !== '') {
    return prefixedValue.slice(0, propertySchema.maxLength);
  }
  if (allowWhole === true && propertySchema.type === 'string') {
    return sanitizeText(query, propertySchema.maxLength);
  }

  return undefined;
}

/**
 * @typedef {object} ToolValidationResult
 * @property {boolean} ok - 驗證是否成功
 * @property {Record<string, any>} args - 驗證通過的參數
 * @property {string[]} errors - 錯誤訊息陣列
 */

/**
 * 驗證輸入資料是否符合指定的綱要 (Schema)。
 * @param {object|ToolSchema} schema - 工具的輸入綱要
 * @param {Record<string, any>} input - 要驗證的輸入資料
 * @returns {ToolValidationResult} 驗證結果，包含是否成功、有效的參數及錯誤訊息陣列
 */
export function validate(schema, input) {
  const normalizedSchema = normaliseSchema(schema);
  const targetInput =
    typeof input === 'object' && input !== null && Array.isArray(input) === false
      ? input
      : {};
  const validatedArgs = {};
  const validationErrors = [];

  Object.keys(normalizedSchema.properties).forEach((propertyName) => {
    if (
      targetInput[propertyName] === undefined ||
      targetInput[propertyName] === null ||
      targetInput[propertyName] === ''
    ) {
      return;
    }
    const propertySchema = normalizedSchema.properties[propertyName];
    let propertyValue = targetInput[propertyName];

    if (
      propertySchema.type === 'integer' &&
      Number.isInteger(Number(propertyValue)) === false
    ) {
      validationErrors.push(`${propertyName} 必須是整數`);
      return;
    }
    if (
      propertySchema.type === 'number' &&
      Number.isFinite(Number(propertyValue)) === false
    ) {
      validationErrors.push(`${propertyName} 必須是數字`);
      return;
    }
    if (
      propertySchema.type === 'boolean' &&
      typeof propertyValue !== 'boolean'
    ) {
      validationErrors.push(`${propertyName} 必須是布林值`);
      return;
    }

    if (
      propertySchema.type === 'integer' ||
      propertySchema.type === 'number'
    ) {
      propertyValue = Number(propertyValue);
      if (
        typeof propertySchema.minimum === 'number' &&
        Number.isFinite(propertySchema.minimum) === true &&
        propertyValue < propertySchema.minimum
      ) {
        validationErrors.push(`${propertyName} 不得小於 ${propertySchema.minimum}`);
      }
      if (
        typeof propertySchema.maximum === 'number' &&
        Number.isFinite(propertySchema.maximum) === true &&
        propertyValue > propertySchema.maximum
      ) {
        validationErrors.push(`${propertyName} 不得大於 ${propertySchema.maximum}`);
      }
    } else if (propertySchema.type === 'string') {
      propertyValue = sanitizeText(propertyValue, propertySchema.maxLength);
      if (
        propertySchema.format === 'email' &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(propertyValue) === false
      ) {
        validationErrors.push(`${propertyName} 電子郵件格式無效`);
      }
      if (
        propertySchema.format === 'url' &&
        /^https?:\/\//i.test(propertyValue) === false
      ) {
        validationErrors.push(`${propertyName} 網址格式無效`);
      }
      if (
        propertySchema.format === 'phone' &&
        /(?:\d[^\d]*){8,18}/.test(propertyValue) === false
      ) {
        validationErrors.push(`${propertyName} 電話格式無效`);
      }
      if (
        propertySchema.format === 'contact' &&
        (
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(propertyValue) === false &&
          /(?:\+?\d[\s().-]*){8,18}/.test(propertyValue) === false
        )
      ) {
        validationErrors.push(`${propertyName} 必須是電子郵件或電話`);
      }
    }

    if (
      Array.isArray(propertySchema.enum) === true &&
      propertySchema.enum.includes(String(propertyValue)) === false
    ) {
      validationErrors.push(`${propertyName} 不在允許選項內`);
    }

    validatedArgs[propertyName] = propertyValue;
  });

  normalizedSchema.required.forEach((requiredName) => {
    if (
      validatedArgs[requiredName] === undefined ||
      validatedArgs[requiredName] === null ||
      validatedArgs[requiredName] === ''
    ) {
      validationErrors.push(`${requiredName} 為必填`);
    }
  });

  return { ok: validationErrors.length === 0, args: validatedArgs, errors: validationErrors };
}

/**
 * @typedef {object} ToolExtractResult
 * @property {Record<string, any>} args - 成功提取的參數
 * @property {string[]} missing - 缺失的必填參數名稱
 * @property {string[]} errors - 驗證錯誤訊息陣列
 */

/**
 * 從使用者的查詢中提取並驗證工具所需的參數。
 * @param {object|ToolDefinition} tool - 目標工具定義
 * @param {string} query - 使用者的輸入查詢
 * @param {Record<string, any>} [context] - 上下文資料
 * @param {Record<string, any>} [existing] - 已存在的參數
 * @param {string[]} [onlyNames] - 限制只提取指定的參數名稱
 * @param {boolean} [allowWhole] - 是否允許單一字串參數吸收整個查詢
 * @returns {ToolExtractResult} 提取結果，包含成功提取的參數、缺失的必填參數及驗證錯誤
 */
export function extract(tool, query, context, existing, onlyNames, allowWhole) {
  const normalizedTool = normaliseTool(tool);
  const existingArgs =
    typeof existing === 'object' && existing !== null ? existing : {};
  const extractedArgs = {};
  const schemaProperties = normalizedTool.inputSchema.properties;

  Object.keys(schemaProperties).forEach((propertyName) => {
    if (
      existingArgs[propertyName] !== undefined &&
      existingArgs[propertyName] !== null
    ) {
      extractedArgs[propertyName] = existingArgs[propertyName];
    }
  });

  const propertyNames =
    Array.isArray(onlyNames) === true && onlyNames.length > 0
      ? onlyNames
      : Object.keys(schemaProperties);
  propertyNames.forEach((propertyName) => {
    if (
      typeof schemaProperties[propertyName] !== 'object' ||
      schemaProperties[propertyName] === null ||
      (extractedArgs[propertyName] !== undefined &&
        extractedArgs[propertyName] !== null)
    ) {
      return;
    }
    const extractedValue = extractPropertyValue(
      propertyName,
      schemaProperties[propertyName],
      String(query || ''),
      context || {},
      Boolean(allowWhole) === true && propertyNames.length === 1
    );
    if (extractedValue !== undefined && extractedValue !== '') {
      extractedArgs[propertyName] = extractedValue;
    }
  });

  const validationResult = validate(normalizedTool.inputSchema, extractedArgs);
  const invalidPropertyNames = validationResult.errors.map(
    (errorMessage) => String(errorMessage).split(' ')[0]
  );
  invalidPropertyNames.forEach((invalidPropertyName) => {
    delete validationResult.args[invalidPropertyName];
  });

  return {
    args: validationResult.args,
    missing: normalizedTool.inputSchema.required.filter(
      (requiredName) =>
        validationResult.args[requiredName] === undefined ||
        validationResult.args[requiredName] === null ||
        validationResult.args[requiredName] === ''
    ),
    errors: validationResult.errors
  };
}

/**
 * 產生工具參數的中文摘要，用於與使用者確認。
 * @param {object|ToolDefinition} tool - 工具定義
 * @param {Record<string, any>} args - 工具的參數物件
 * @returns {string} 中文參數摘要字串，以頓號分隔
 */
export function argumentSummary(tool, args) {
  const normalizedTool = normaliseTool(tool);
  const targetArgs = typeof args === 'object' && args !== null ? args : {};
  return Object.keys(targetArgs)
    .map((propertyName) => {
      const propertySchema =
        normalizedTool.inputSchema.properties[propertyName] || {};
      return `${propertySchema.title || propertyName}：${String(targetArgs[propertyName])}`;
    })
    .join('、');
}

/**
 * @typedef {object} PendingToolInput
 * @property {ToolDefinition} tool - 執行中的工具
 * @property {string} query - 使用者查詢字串
 * @property {object} routeMeta - 路由相關資訊
 * @property {Record<string, any>} args - 目前已收集的參數
 * @property {string[]} missing - 尚未收集的必填參數
 */

/**
 * @typedef {object} PendingToolChoice
 * @property {string} messageId - 選擇訊息的 ID
 * @property {ToolRouteCandidate[]} choices - 提供給使用者的選項清單
 */

/**
 * @typedef {object} ToolResultData
 * @property {boolean} [ok] - 執行是否成功
 * @property {string} [error] - 錯誤訊息
 * @property {string} [message] - 成功訊息
 * @property {string} callId - 呼叫 ID
 * @property {string} [name] - 工具名稱
 */

/**
 * @typedef {object} ToolsEngineSetting
 * @property {number} [confirmationTimeoutMs] - 工具確認的逾時毫秒數
 * @property {function} [onAddChatMessage] - 新增對話訊息的回呼函數
 * @property {function} [onUpdateChatMessage] - 更新對話訊息的回呼函數
 * @property {function} [onSetHistoryOpen] - 設定歷史紀錄面板開啟狀態的回呼函數
 * @property {function} [onRenderHistory] - 觸發重新渲染歷史紀錄的回呼函數
 * @property {function} [onSpokenAudioPlayNow] - 語音播放回呼函數
 * @property {function} [onToolCall] - 工具準備執行時的回呼函數
 * @property {(offer: object) => void} [onToolOffer] - 工具發起確認或準備執行時的回呼函式
 * @property {(confirm: object) => void} [onToolConfirm] - 工具確認執行時的回呼函式
 * @property {(cancel: object) => void} [onToolCancel] - 工具取消時的回呼函式
 * @property {() => Array<object>} getChatLog - 取得對話紀錄陣列
 * @property {() => number} getChatSeq - 取得目前對話序號
 * @property {() => boolean} isConvoOn - 取得是否開啟連續對話
 */

/**
 * @typedef {object} ToolsEngine
 * @property {ToolDefinition[]} HOST_TOOLS - 註冊的宿主工具清單
 * @property {PendingToolInput | null} pendingToolInput - 待補齊參數的工具狀態
 * @property {PendingToolChoice | null} pendingToolChoice - 待選擇的模糊匹配狀態
 * @property {string | null} pendingToolConfirmation - 待確認執行的工具訊息 ID
 * @property {number} confirmationTimeoutMs - 工具確認逾時毫秒數
 * @property {function} onAddChatMessage - 來自 setting 的對應方法
 * @property {function} onUpdateChatMessage - 來自 setting 的對應方法
 * @property {function} onSetHistoryOpen - 來自 setting 的對應方法
 * @property {function} onRenderHistory - 來自 setting 的對應方法
 * @property {function} onSpokenAudioPlayNow - 來自 setting 的對應方法
 * @property {(text: string) => ToolRouteResult} routeHostTool - 路由宿主工具
 * @property {() => ToolDefinition[]} getAiAvailableTools - 取得可供 AI 呼叫的工具清單
 * @property {() => Array<object>} toOpenAiTools - 取得 OpenAI 相容 tools 格式清單
 * @property {(tool: ToolDefinition, propertyName: string, errorText?: string) => string} parameterPrompt - 產生補齊參數的提示語
 * @property {(tool: ToolDefinition, query: string, routeMeta?: object, existingArgs?: Record<string, any>) => void} prepareTool - 準備執行工具
 * @property {(inputText: string) => boolean} continueToolInput - 繼續處理工具參數輸入
 * @property {(query: string, candidates: ToolRouteCandidate[]) => void} offerToolChoices - 處理工具模糊匹配
 * @property {(inputText: string) => boolean} continueToolChoice - 繼續處理工具選擇
 * @property {(messageId: string, choiceIndex: number) => void} chooseTool - 選擇工具
 * @property {(tool: ToolDefinition, query: string, routeMeta?: object, args?: Record<string, any>, options?: object) => void} offerHostTool - 準備確認執行宿主工具
 * @property {(messageId: string) => void} executePendingTool - 執行待確認工具
 * @property {(messageId: string, options?: { reason?: string }) => void} cancelPendingTool - 取消待確認工具
 * @property {(inputText: string) => boolean} continueToolConfirmation - 繼續處理確認結果
 * @property {(resultData: ToolResultData) => void} handleToolResult - 處理工具執行完畢的回應
 * @property {(tool: ToolDefinition, args: Record<string, any>, pendingToolData: object) => Promise<any>} executeToolDirectly - 直接執行工具
 */

/**
 * 初始化並建立工具執行引擎 (Tools Engine)。
 * 處理工具路由、參數收集、使用者互動 (補齊參數、選擇模糊工具、確認執行) 及最終執行邏輯。
 * @param {ToolsEngineSetting} [setting={}] - 引擎設定物件，包含回呼函數與狀態讀取器
 * @returns {ToolsEngine} 工具引擎實體 (Tools Engine Instance)
 */
export function initToolsEngine(setting = {}) {
  function routeHostTool(queryText) {
    return route(toolsEngine.HOST_TOOLS, queryText);
  }

  function parameterPrompt(tool, propertyName, errorText) {
    const propertySchema = tool.inputSchema.properties[propertyName] || {};
    const label = propertySchema.title || propertyName;
    const choices =
      Array.isArray(propertySchema.enum) === true &&
      propertySchema.enum.length > 0
        ? `（可選：${propertySchema.enum.join('、')}）`
        : '';
    const errorPrefix =
      typeof errorText === 'string' && errorText !== '' ? `${errorText}。` : '';
    return `${errorPrefix}執行「${tool.label}」前，請提供${label}${choices}。`;
  }

  function prepareTool(tool, query, routeMeta, existingArgs) {
    const extractedParams = extract(
      tool,
      query,
      {},
      existingArgs || {},
      null,
      false
    );
    if (extractedParams.missing.length > 0) {
      toolsEngine.pendingToolInput = {
        tool,
        query,
        routeMeta: routeMeta || {},
        args: extractedParams.args,
        missing: extractedParams.missing
      };
      const promptMessage = parameterPrompt(
        tool,
        extractedParams.missing[0],
        extractedParams.errors[0] || ''
      );
      if (typeof toolsEngine.onAddChatMessage === 'function') {
        toolsEngine.onAddChatMessage('assistant', promptMessage, {
          source: 'tool'
        });
      }
      if (typeof toolsEngine.onSpokenAudioPlayNow === 'function') {
        toolsEngine.onSpokenAudioPlayNow(promptMessage);
      }
      return;
    }
    toolsEngine.pendingToolInput = null;
    offerHostTool(tool, query, routeMeta, extractedParams.args);
  }

  function continueToolInput(inputText) {
    if (
      typeof toolsEngine.pendingToolInput !== 'object' ||
      toolsEngine.pendingToolInput === null
    ) {
      return false;
    }
    if (/^(取消|不要|算了|cancel)$/i.test(String(inputText || '').trim()) === true) {
      toolsEngine.pendingToolInput = null;
      const cancelMessage = '好的，已取消這個操作。';
      if (typeof toolsEngine.onAddChatMessage === 'function') {
        toolsEngine.onAddChatMessage('assistant', cancelMessage, {
          source: 'tool'
        });
      }
      if (typeof toolsEngine.onSpokenAudioPlayNow === 'function') {
        toolsEngine.onSpokenAudioPlayNow(cancelMessage);
      }
      return true;
    }
    const pendingInput = toolsEngine.pendingToolInput;
    const missingField = pendingInput.missing[0];
    const extractedParams = extract(
      pendingInput.tool,
      inputText,
      {},
      pendingInput.args,
      [missingField],
      true
    );
    if (extractedParams.missing.length > 0) {
      pendingInput.args = extractedParams.args;
      pendingInput.missing = extractedParams.missing;
      const promptMessage = parameterPrompt(
        pendingInput.tool,
        extractedParams.missing[0],
        extractedParams.errors[0] || '輸入格式不正確'
      );
      if (typeof toolsEngine.onAddChatMessage === 'function') {
        toolsEngine.onAddChatMessage('assistant', promptMessage, {
          source: 'tool'
        });
      }
      if (typeof toolsEngine.onSpokenAudioPlayNow === 'function') {
        toolsEngine.onSpokenAudioPlayNow(promptMessage);
      }
      return true;
    }
    prepareTool(
      pendingInput.tool,
      pendingInput.query,
      pendingInput.routeMeta,
      extractedParams.args
    );
    return true;
  }

  function offerToolChoices(query, candidates) {
    const candidateChoices = candidates.slice(0, 3);
    const choiceMessage = `我找到幾個可能的操作，請選擇：${candidateChoices
      .map(
        (choiceItem, choiceIndex) =>
          `${choiceIndex + 1}「${choiceItem.tool.label}」`
      )
      .join('、')}`;

    let messageId;
    if (typeof toolsEngine.onAddChatMessage === 'function') {
      messageId = toolsEngine.onAddChatMessage('assistant', choiceMessage, {
        pendingChoices: candidateChoices,
        source: 'tool'
      });
    }

    if (typeof messageId !== 'undefined') {
      const chatMessage = setting
        .getChatLog()
        .find((entry) => entry.id === messageId);
      if (typeof chatMessage === 'object' && chatMessage !== null) {
        chatMessage.choiceQuery = query;
      }
    }

    toolsEngine.pendingToolChoice = { messageId, choices: candidateChoices };

    if (typeof toolsEngine.onSetHistoryOpen === 'function') {
      toolsEngine.onSetHistoryOpen(true);
    }
    if (typeof toolsEngine.onSpokenAudioPlayNow === 'function') {
      toolsEngine.onSpokenAudioPlayNow(choiceMessage);
    }
  }

  function continueToolChoice(inputText) {
    if (
      typeof toolsEngine.pendingToolChoice !== 'object' ||
      toolsEngine.pendingToolChoice === null
    ) {
      return false;
    }
    if (/^(取消|不要|算了|cancel)$/i.test(String(inputText || '').trim()) === true) {
      const chatMessage = setting
        .getChatLog()
        .find((entry) => entry.id === toolsEngine.pendingToolChoice.messageId);
      if (typeof chatMessage === 'object' && chatMessage !== null) {
        chatMessage.pendingChoices = null;
        chatMessage.text = '好的，已取消。';
      }
      toolsEngine.pendingToolChoice = null;

      if (typeof toolsEngine.onRenderHistory === 'function') {
        toolsEngine.onRenderHistory();
      }
      const cancelMessage = '好的，已取消這個操作。';
      if (typeof toolsEngine.onSpokenAudioPlayNow === 'function') {
        toolsEngine.onSpokenAudioPlayNow(cancelMessage);
      }
      return true;
    }

    let choiceIndex =
      /(?:第一|1|一)/.test(inputText) === true
        ? 0
        : /(?:第二|2|二)/.test(inputText) === true
          ? 1
          : /(?:第三|3|三)/.test(inputText) === true
            ? 2
            : -1;

    if (choiceIndex < 0) {
      const routedResult = route(
        toolsEngine.pendingToolChoice.choices.map(
          (candidateItem) => candidateItem.tool
        ),
        inputText
      );
      if (routedResult.match !== null) {
        choiceIndex = toolsEngine.pendingToolChoice.choices.findIndex(
          (candidateItem) => candidateItem.tool.name === routedResult.match.tool.name
        );
      }
    }

    if (
      choiceIndex >= 0 &&
      toolsEngine.pendingToolChoice.choices[choiceIndex] !== undefined
    ) {
      chooseTool(toolsEngine.pendingToolChoice.messageId, choiceIndex);
      return true;
    }

    const promptMessage = '請說「第一個、第二個、第三個」，或點選你要的操作。';
    if (typeof toolsEngine.onAddChatMessage === 'function') {
      toolsEngine.onAddChatMessage('assistant', promptMessage, { source: 'tool' });
    }
    if (typeof toolsEngine.onSpokenAudioPlayNow === 'function') {
      toolsEngine.onSpokenAudioPlayNow(promptMessage);
    }
    return true;
  }

  function chooseTool(messageId, choiceIndex) {
    const chatMessage = setting.getChatLog().find((entry) => entry.id === messageId);
    if (
      typeof chatMessage !== 'object' ||
      chatMessage === null ||
      Array.isArray(chatMessage.pendingChoices) === false ||
      chatMessage.pendingChoices[choiceIndex] === undefined
    ) {
      return;
    }
    const selectedChoice = chatMessage.pendingChoices[choiceIndex];
    chatMessage.pendingChoices = null;
    chatMessage.text = `已選擇「${selectedChoice.tool.label}」。`;
    toolsEngine.pendingToolChoice = null;
    if (typeof toolsEngine.onRenderHistory === 'function') {
      toolsEngine.onRenderHistory();
    }
    prepareTool(
      selectedChoice.tool,
      chatMessage.choiceQuery || '',
      { confidence: selectedChoice.score, reason: 'user_choice' },
      {}
    );
  }

  function offerHostTool(tool, query, routeMeta, args, options) {
    const callId =
      typeof options?.callId === 'string' && options.callId !== ''
        ? options.callId
        : `tool-${Date.now()}-${setting.getChatSeq()}`;
    const history = setting
      .getChatLog()
      .slice(-12)
      .map((chatItem) => ({ role: chatItem.role, text: chatItem.text }))
      .filter(
        (chatItem) =>
          typeof chatItem.text === 'string' && chatItem.text !== ''
      );

    const source =
      typeof options?.source === 'string' && options.source !== ''
        ? options.source
        : CHAT_SOURCE_MAP.TOOL;

    const pendingToolData = {
      callId,
      name: tool.name,
      label: tool.label,
      tool,
      input: {
        query,
        context: {},
        args: args || {},
        route: routeMeta || {},
        history
      },
      source,
      toolCallId: options?.toolCallId || null,
      onConfirmResume:
        typeof options?.onConfirmResume === 'function'
          ? options.onConfirmResume
          : null
    };
    const summary = argumentSummary(tool, args || {});

    if (tool.requiresConfirmation === true) {
      const confirmationMessage = `要幫你執行「${tool.label}」嗎？${summary !== '' ? '\n' + summary : ''}`;
      if (typeof toolsEngine.onAddChatMessage === 'function') {
        toolsEngine.onAddChatMessage('assistant', confirmationMessage, {
          id: callId,
          pendingTool: pendingToolData,
          source
        });
      }
      toolsEngine.pendingToolConfirmation = callId;
      startConfirmationTimer(callId, tool.confirmationTimeoutMs);

      if (typeof toolsEngine.onSetHistoryOpen === 'function') {
        toolsEngine.onSetHistoryOpen(true);
      }
      if (typeof toolsEngine.onSpokenAudioPlayNow === 'function') {
        toolsEngine.onSpokenAudioPlayNow(confirmationMessage);
      }
      if (typeof setting.onToolOffer === 'function') {
        setting.onToolOffer({
          name: tool.name,
          confirmation: true,
          toolCallId: options?.toolCallId || null
        });
      }
    } else {
      if (typeof toolsEngine.onAddChatMessage === 'function') {
        toolsEngine.onAddChatMessage(
          'assistant',
          `正在執行「${tool.label}」…`,
          { id: callId, source }
        );
      }
      if (typeof tool.execute === 'function') {
        executeToolDirectly(tool, args || {}, pendingToolData);
      } else if (typeof setting.onToolCall === 'function') {
        setting.onToolCall(pendingToolData);
      }
      if (typeof setting.onToolOffer === 'function') {
        setting.onToolOffer({
          name: tool.name,
          confirmation: false,
          toolCallId: options?.toolCallId || null
        });
      }
    }
  }

  async function executeToolDirectly(tool, args, pendingToolData) {
    if (typeof tool?.execute !== 'function') {
      return null;
    }
    try {
      const result = await tool.execute({
        args,
        context: pendingToolData.input.context,
        query: pendingToolData.input.query
      });

      if (typeof pendingToolData.onConfirmResume === 'function') {
        pendingToolData.onConfirmResume(result);
      } else if (tool.resultMode !== TOOL_RESULT_MODE_MAP.AI_SUMMARY) {
        const message =
          typeof result === 'string'
            ? result
            : typeof result?.message === 'string' && result.message !== ''
              ? result.message
              : '已完成。';
        handleToolResult({
          ok: true,
          message,
          callId: pendingToolData.callId,
          name: tool.name
        });
      }
      return result;
    } catch (error) {
      const errorMessage = String(error?.message || error || '執行錯誤');
      if (typeof pendingToolData.onConfirmResume === 'function') {
        pendingToolData.onConfirmResume({ ok: false, error: errorMessage });
      } else if (tool.resultMode !== TOOL_RESULT_MODE_MAP.AI_SUMMARY) {
        handleToolResult({
          ok: false,
          error: errorMessage,
          callId: pendingToolData.callId,
          name: tool.name
        });
      }
      return { ok: false, error: errorMessage };
    }
  }

  function executePendingTool(messageId) {
    clearConfirmationTimer();
    const chatMessage = setting.getChatLog().find((msg) => msg.id === messageId);
    if (
      typeof chatMessage !== 'object' ||
      chatMessage === null ||
      typeof chatMessage.pendingTool !== 'object' ||
      chatMessage.pendingTool === null
    ) {
      return;
    }
    const pendingToolData = chatMessage.pendingTool;
    chatMessage.pendingTool = null;
    toolsEngine.pendingToolConfirmation = '';
    chatMessage.text = `正在執行「${pendingToolData.label}」…`;
    if (typeof toolsEngine.onRenderHistory === 'function') {
      toolsEngine.onRenderHistory();
    }

    if (typeof pendingToolData.tool?.execute === 'function') {
      executeToolDirectly(
        pendingToolData.tool,
        pendingToolData.input.args,
        pendingToolData
      );
    } else if (typeof setting.onToolCall === 'function') {
      setting.onToolCall(pendingToolData);
    }

    if (typeof setting.onToolConfirm === 'function') {
      setting.onToolConfirm({
        name: pendingToolData.name,
        toolCallId: pendingToolData.toolCallId
      });
    }
  }

  function cancelPendingTool(messageId, options) {
    clearConfirmationTimer();
    const chatMessage = setting.getChatLog().find((msg) => msg.id === messageId);
    if (
      typeof chatMessage !== 'object' ||
      chatMessage === null ||
      typeof chatMessage.pendingTool !== 'object' ||
      chatMessage.pendingTool === null
    ) {
      return;
    }
    const pendingToolData = chatMessage.pendingTool;
    const cancelReason = options?.reason || TOOL_CANCEL_REASON_MAP.USER_CANCEL;
    chatMessage.pendingTool = null;
    toolsEngine.pendingToolConfirmation = '';

    if (cancelReason === TOOL_CANCEL_REASON_MAP.TIMEOUT) {
      chatMessage.text = '操作已逾時失效。';
      chatMessage.timedOut = true;
    } else if (cancelReason === TOOL_CANCEL_REASON_MAP.NEW_INPUT) {
      chatMessage.text = '已取消（已轉移話題）。';
      chatMessage.cancelled = true;
    } else {
      chatMessage.text = '好的，已取消。';
      if (
        typeof setting.isConvoOn === 'function' &&
        setting.isConvoOn() === true
      ) {
        if (typeof toolsEngine.onSpokenAudioPlayNow === 'function') {
          toolsEngine.onSpokenAudioPlayNow('好的，已取消。');
        }
      }
    }

    if (typeof toolsEngine.onRenderHistory === 'function') {
      toolsEngine.onRenderHistory();
    }

    if (typeof pendingToolData.onConfirmResume === 'function') {
      pendingToolData.onConfirmResume({
        cancelled: true,
        reason: cancelReason
      });
    }

    if (typeof setting.onToolCancel === 'function') {
      setting.onToolCancel({
        name: pendingToolData.name,
        reason: cancelReason,
        toolCallId: pendingToolData.toolCallId
      });
    }
  }

  function continueToolConfirmation(inputText) {
    if (
      typeof toolsEngine.pendingToolConfirmation !== 'string' ||
      toolsEngine.pendingToolConfirmation === ''
    ) {
      return false;
    }
    const trimmedAnswer = String(inputText || '').trim();
    if (/^(確認|確定|執行|可以|好|好的|yes|ok)$/i.test(trimmedAnswer) === true) {
      executePendingTool(toolsEngine.pendingToolConfirmation);
      return true;
    }
    if (/^(取消|不要|算了|否|no|cancel)$/i.test(trimmedAnswer) === true) {
      cancelPendingTool(toolsEngine.pendingToolConfirmation, {
        reason: TOOL_CANCEL_REASON_MAP.USER_CANCEL
      });
      return true;
    }

    // 若使用者輸入其他全新訊息，自動取消前次未完成之操作，並允許主流程繼續處理新訊息
    cancelPendingTool(toolsEngine.pendingToolConfirmation, {
      reason: TOOL_CANCEL_REASON_MAP.NEW_INPUT
    });
    return false;
  }

  function handleToolResult(resultData) {
    const messageText =
      resultData.ok === false
        ? `執行失敗：${String(resultData.error || '未知錯誤')}`
        : String(resultData.message || '已完成。');
    const existingMessage = setting
      .getChatLog()
      .find((msg) => msg.id === resultData.callId);

    if (typeof existingMessage === 'object' && existingMessage !== null) {
      if (typeof toolsEngine.onUpdateChatMessage === 'function') {
        toolsEngine.onUpdateChatMessage(existingMessage.id, messageText, false);
      }
    } else {
      if (typeof toolsEngine.onAddChatMessage === 'function') {
        toolsEngine.onAddChatMessage('assistant', messageText, {
          source: CHAT_SOURCE_MAP.TOOL
        });
      }
    }
    if (typeof toolsEngine.onSpokenAudioPlayNow === 'function') {
      toolsEngine.onSpokenAudioPlayNow(messageText);
    }
  }

  let currentConfirmationTimeoutMs =
    typeof setting.confirmationTimeoutMs === 'number' &&
    Number.isFinite(setting.confirmationTimeoutMs) === true &&
    setting.confirmationTimeoutMs > 0
      ? setting.confirmationTimeoutMs
      : DEFAULT_TOOL_CONFIRMATION_TIMEOUT_MS;

  let confirmationTimer = null;

  function clearConfirmationTimer() {
    if (confirmationTimer !== null) {
      clearTimeout(confirmationTimer);
      confirmationTimer = null;
    }
  }

  function startConfirmationTimer(messageId, timeoutMs) {
    clearConfirmationTimer();
    const durationMs =
      typeof timeoutMs === 'number' &&
      Number.isFinite(timeoutMs) === true &&
      timeoutMs > 0
        ? timeoutMs
        : currentConfirmationTimeoutMs;

    if (durationMs > 0) {
      confirmationTimer = setTimeout(() => {
        cancelPendingTool(messageId, {
          reason: TOOL_CANCEL_REASON_MAP.TIMEOUT
        });
      }, durationMs);
    }
  }

  const toolsEngine = {
    HOST_TOOLS: [],
    pendingToolInput: null,
    pendingToolChoice: null,
    pendingToolConfirmation: null,

    get confirmationTimeoutMs() {
      return currentConfirmationTimeoutMs;
    },
    set confirmationTimeoutMs(value) {
      if (
        typeof value === 'number' &&
        Number.isFinite(value) === true &&
        value > 0
      ) {
        currentConfirmationTimeoutMs = value;
      }
    },

    get onAddChatMessage() {
      return setting.onAddChatMessage;
    },
    get onUpdateChatMessage() {
      return setting.onUpdateChatMessage;
    },
    get onSetHistoryOpen() {
      return setting.onSetHistoryOpen;
    },
    get onRenderHistory() {
      return setting.onRenderHistory;
    },
    get onSpokenAudioPlayNow() {
      return setting.onSpokenAudioPlayNow;
    },

    routeHostTool,
    getAiAvailableTools: () => getAiAvailableTools(toolsEngine.HOST_TOOLS),
    toOpenAiTools: () => toOpenAiTools(toolsEngine.HOST_TOOLS),
    parameterPrompt,
    prepareTool,
    continueToolInput,
    offerToolChoices,
    continueToolChoice,
    chooseTool,
    offerHostTool,
    executePendingTool,
    cancelPendingTool,
    continueToolConfirmation,
    handleToolResult,
    executeToolDirectly
  };

  return toolsEngine;
}

/**
 * 驗證自訂 Tools Engine 是否實作了必要的介面
 * @param {object} engine - 待驗證的引擎實例
 * @returns {{isValid: boolean, missing: string[]}} 驗證結果與缺少的實作名稱
 */
export function validateToolsEngine(engine) {
  if (typeof engine !== 'object' || engine === null) {
    return { isValid: false, missing: ['engine object'] };
  }
  const requiredMethods = [
    'routeHostTool',
    'prepareTool',
    'continueToolInput',
    'offerToolChoices',
    'continueToolChoice',
    'chooseTool',
    'offerHostTool',
    'executePendingTool',
    'cancelPendingTool',
    'continueToolConfirmation',
    'handleToolResult'
  ];
  const missingMethods = [];
  requiredMethods.forEach((methodName) => {
    if (typeof engine[methodName] !== 'function') {
      missingMethods.push(methodName);
    }
  });
  return { isValid: missingMethods.length === 0, missing: missingMethods };
}
