/**
 * 將輸入值轉換為字串，去除前後空白，並限制最大長度。
 * @param {any} value - 要處理的值
 * @param {number} [max=240] - 字串的最大長度，預設為 240
 * @returns {string} 處理後的字串
 */
function text(value, max) {
  return String(value || '')
    .trim()
    .slice(0, max || 240);
}

/**
 * 將輸入值標準化：轉小寫、去除常見標點符號與空白，長度限制為 1200。
 * @param {any} value - 要標準化的值
 * @returns {string} 標準化後的字串
 */
function normal(value) {
  return text(value, 1200)
    .toLowerCase()
    .replace(/[\s，。、！？,.!?：:；;()（）]+/g, '');
}

/**
 * 轉義正則表達式中的特殊字元，以避免語法錯誤或非預期的比對。
 * @param {string|any} value - 需轉義的字串
 * @returns {string} 轉義後的字串
 */
function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 將字串轉換為二元字元組 (Bigrams) 陣列，用於字串相似度計算。
 * @param {any} value - 要處理的字串
 * @returns {string[]} 二元字元組陣列
 */
function bigrams(value) {
  const input = normal(value);
  const bigramList = [];
  if (input.length === 1) {
    return [input];
  }
  for (let index = 0; index < input.length - 1; index++) {
    bigramList.push(input.slice(index, index + 2));
  }
  return bigramList;
}

/**
 * 計算兩個字串基於二元字元組 (Bigrams) 的相似度。
 * @param {string} a - 第一個字串
 * @param {string} b - 第二個字串
 * @returns {number} 相似度分數，範圍為 0 到 1
 */
export function similarity(sourceString, targetString) {
  const sourceBigrams = bigrams(sourceString);
  const targetBigrams = new Set(bigrams(targetString));
  if (sourceBigrams.length === 0 || targetBigrams.size === 0) {
    return 0;
  }
  let hits = 0;
  sourceBigrams.forEach((item) => {
    if (targetBigrams.has(item) === true) {
      hits++;
    }
  });
  return hits / Math.sqrt(sourceBigrams.length * targetBigrams.size);
}

/**
 * 標準化工具的輸入綱要 (Schema)，確保其格式與屬性符合預期。
 * @param {object} schema - 原始的輸入綱要
 * @returns {object} 標準化後的輸入綱要
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
  const properties = {};
  Object.keys(schema.properties)
    .slice(0, 20)
    .forEach((name) => {
      if (/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/.test(name) === false) {
        return;
      }
      const raw = schema.properties[name] || {};
      const type = /^(string|number|integer|boolean)$/.test(raw.type)
        ? raw.type
        : 'string';
      const property = {
        type,
        title: text(raw.title || name, 80),
        description: text(raw.description, 160),
        contextKey: text(raw.contextKey, 60),
        format: /^(email|url|phone|contact)$/.test(raw.format)
          ? raw.format
          : '',
        prefixes: Array.isArray(raw.prefixes)
          ? raw.prefixes
              .slice(0, 8)
              .map((item) => text(item, 30))
              .filter(Boolean)
          : []
      };
      if (Array.isArray(raw.enum)) {
        property.enum = raw.enum
          .slice(0, 20)
          .map((item) => text(item, 80))
          .filter(Boolean);
      }
      if (Number.isFinite(Number(raw.minimum)) === true) {
        property.minimum = Number(raw.minimum);
      }
      if (Number.isFinite(Number(raw.maximum)) === true) {
        property.maximum = Number(raw.maximum);
      }
      property.maxLength = Math.max(
        1,
        Math.min(Number(raw.maxLength) || 300, 1000)
      );
      properties[name] = property;
    });
  const required = Array.isArray(schema.required)
    ? schema.required.filter((name) => properties[name]).slice(0, 20)
    : [];
  return { type: 'object', properties, required };
}

/**
 * 標準化工具定義物件，補齊預設值並確保格式正確。
 * @param {object} tool - 原始的工具定義物件
 * @returns {object} 標準化後的工具定義物件
 */
export function normaliseTool(tool) {
  tool = tool || {};
  return {
    name: text(tool.name, 64).replace(/[^a-zA-Z0-9_.-]/g, ''),
    label: text(tool.label || tool.name, 80),
    description: text(tool.description, 240),
    keywords: Array.isArray(tool.keywords)
      ? tool.keywords
          .slice(0, 30)
          .map((item) => text(item, 60).toLowerCase())
          .filter(Boolean)
      : [],
    examples: Array.isArray(tool.examples)
      ? tool.examples
          .slice(0, 20)
          .map((item) => text(item, 160))
          .filter(Boolean)
      : [],
    excludeKeywords: Array.isArray(tool.excludeKeywords)
      ? tool.excludeKeywords
          .slice(0, 20)
          .map((item) => text(item, 60).toLowerCase())
          .filter(Boolean)
      : [],
    priority: Math.max(-10, Math.min(Number(tool.priority) || 0, 10)),
    routeThreshold: Math.max(
      0.15,
      Math.min(Number(tool.routeThreshold) || 0.34, 0.95)
    ),
    requiresConfirmation: tool.requiresConfirmation !== false,
    inputSchema: normaliseSchema(tool.inputSchema)
  };
}

/**
 * 根據使用者的輸入 (Query)，為指定的工具進行評分，評估其適用性。
 * @param {object} tool - 要評分的工具定義物件 (需先標準化)
 * @param {string} query - 使用者的輸入查詢
 * @returns {{score: number, reason: string}} 包含分數 (0-1) 與評分原因的物件
 */
export function scoreTool(tool, query) {
  const normalizedQuery = normal(query);
  if (
    typeof normalizedQuery !== 'string' ||
    normalizedQuery === '' ||
    tool.excludeKeywords.some(
      (item) =>
        typeof item === 'string' &&
        item !== '' &&
        normalizedQuery.includes(normal(item))
    )
  ) {
    return { score: 0, reason: 'excluded' };
  }
  let score = 0;
  let reason = '';
  tool.keywords.forEach((keyword) => {
    const key = normal(keyword);
    if (typeof key !== 'string' || key === '') {
      return;
    }
    const current = normalizedQuery.includes(key)
      ? Math.min(0.92, 0.62 + key.length * 0.035)
      : similarity(normalizedQuery, key) * 0.62;
    if (current > score) {
      score = current;
      reason = normalizedQuery.includes(key)
        ? `keyword:${keyword}`
        : 'keyword-similarity';
    }
  });
  tool.examples.forEach((example) => {
    const similarityScore = similarity(normalizedQuery, example);
    const current = 0.18 + similarityScore * 0.72;
    if (similarityScore >= 0.28 && current > score) {
      score = current;
      reason = 'example';
    }
  });
  const labelSimilarity = similarity(normalizedQuery, tool.label);
  if (labelSimilarity >= 0.3 && 0.16 + labelSimilarity * 0.65 > score) {
    score = 0.16 + labelSimilarity * 0.65;
    reason = 'label';
  }
  const descriptionSimilarity = similarity(normalizedQuery, tool.description);
  if (
    descriptionSimilarity >= 0.34 &&
    0.1 + descriptionSimilarity * 0.52 > score
  ) {
    score = 0.1 + descriptionSimilarity * 0.52;
    reason = 'description';
  }
  score = Math.max(0, Math.min(1, score + tool.priority * 0.012));
  return { score, reason: reason || 'none' };
}

/**
 * 根據使用者輸入，在多個工具中路由出最適合的工具與候選名單。
 * @param {object[]} tools - 可用的工具清單
 * @param {string} query - 使用者的輸入查詢
 * @returns {{match: object|null, ambiguous: object[], candidates: object[]}} 路由結果，包含最佳匹配、模糊匹配選項與所有候選工具
 */
export function route(tools, query) {
  const candidates = (Array.isArray(tools) ? tools : [])
    .map(normaliseTool)
    .filter((tool) => tool.name)
    .map((tool) => {
      const scored = scoreTool(tool, query);
      return { tool, score: scored.score, reason: scored.reason };
    })
    .filter((item) => item.score >= item.tool.routeThreshold)
    .sort(
      (candidateA, candidateB) =>
        candidateB.score - candidateA.score ||
        candidateB.tool.priority - candidateA.tool.priority
    );

  const top = candidates[0] || null;
  const second = candidates[1] || null;
  const ambiguous = !!(top && second && top.score - second.score < 0.09);

  return {
    match: ambiguous ? null : top,
    ambiguous: ambiguous ? candidates.slice(0, 3) : [],
    candidates
  };
}

/**
 * 從查詢字串中，尋找符合指定前綴 (Prefixes) 之後的內容。
 * @param {string} query - 使用者查詢字串
 * @param {string[]} prefixes - 允許的前綴陣列
 * @returns {string} 匹配到的內容，若無則為空字串
 */
function findPrefixed(query, prefixes) {
  for (let index = 0; index < prefixes.length; index++) {
    const re = new RegExp(
      escapeRegExp(prefixes[index]) +
        '\\s*(?:是|為|=|:|：)?\\s*([^，。！？,!?]{1,120})',
      'i'
    );
    const match = re.exec(query);
    if (match !== null) {
      return match[1].trim();
    }
  }
  return '';
}

/**
 * 根據屬性定義，從查詢字串或上下文中提取出該屬性的值。
 * @param {string} name - 屬性名稱
 * @param {object} property - 屬性定義
 * @param {string} query - 使用者查詢字串
 * @param {object} context - 上下文資料物件
 * @param {boolean} allowWhole - 是否允許將整個查詢作為字串值
 * @returns {any} 提取出的屬性值，若無則為 undefined
 */
function valueForProperty(name, property, query, context, allowWhole) {
  if (
    typeof property.contextKey === 'string' &&
    property.contextKey !== '' &&
    typeof context === 'object' &&
    context !== null &&
    context[property.contextKey] != null
  ) {
    return context[property.contextKey];
  }
  if (
    typeof context === 'object' &&
    context !== null &&
    context[name] != null
  ) {
    return context[name];
  }

  const value = findPrefixed(
    query,
    property.prefixes.concat([property.title]).filter(Boolean)
  );

  if (Array.isArray(property.enum) === true) {
    const selected = property.enum.find((item) =>
      normal(query).includes(normal(item))
    );
    if (typeof selected !== 'undefined') {
      return selected;
    }
  }
  if (property.format === 'email') {
    const email = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.exec(query);
    if (email !== null) {
      return email[0];
    }
  }
  if (property.format === 'url') {
    const url = /https?:\/\/[^\s，。]+/i.exec(query);
    if (url !== null) {
      return url[0];
    }
  }
  if (property.format === 'phone') {
    const phone = /(?:\+?\d[\s().-]*){8,18}/.exec(query);
    if (phone !== null) {
      return phone[0].trim();
    }
  }
  if (property.format === 'contact') {
    const contactEmail = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.exec(query);
    if (contactEmail !== null) {
      return contactEmail[0];
    }
    const contactPhone = /(?:\+?\d[\s().-]*){8,18}/.exec(query);
    if (contactPhone !== null) {
      return contactPhone[0].trim();
    }
  }
  if (property.type === 'boolean') {
    if (/(不同意|不要|不用|否|不需要|false|no)/i.test(query) === true) {
      return false;
    }
    if (/(同意|要|需要|可以|是|true|yes)/i.test(query) === true) {
      return true;
    }
  }
  if (property.type === 'number' || property.type === 'integer') {
    const number = /-?\d+(?:\.\d+)?/.exec(value || query);
    if (number !== null) {
      return property.type === 'integer'
        ? Math.round(Number(number[0]))
        : Number(number[0]);
    }
  }
  if (typeof value === 'string' && value !== '') {
    return value.slice(0, property.maxLength);
  }
  if (allowWhole === true && property.type === 'string') {
    return text(query, property.maxLength);
  }

  return undefined;
}

/**
 * 驗證輸入資料是否符合指定的綱要 (Schema)。
 * @param {object} schema - 工具的輸入綱要
 * @param {object} input - 要驗證的輸入資料
 * @returns {{ok: boolean, args: object, errors: string[]}} 驗證結果，包含是否成功、有效的參數及錯誤訊息陣列
 */
export function validate(schema, input) {
  schema = normaliseSchema(schema);
  input =
    input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const args = {};
  const errors = [];

  Object.keys(schema.properties).forEach((name) => {
    if (input[name] == null || input[name] === '') {
      return;
    }
    const property = schema.properties[name];
    let value = input[name];

    if (property.type === 'integer' && !Number.isInteger(Number(value))) {
      errors.push(`${name} 必須是整數`);
      return;
    }
    if (property.type === 'number' && !Number.isFinite(Number(value))) {
      errors.push(`${name} 必須是數字`);
      return;
    }
    if (property.type === 'boolean' && typeof value !== 'boolean') {
      errors.push(`${name} 必須是布林值`);
      return;
    }

    if (property.type === 'integer' || property.type === 'number') {
      value = Number(value);
      if (property.minimum != null && value < property.minimum) {
        errors.push(`${name} 不得小於 ${property.minimum}`);
      }
      if (property.maximum != null && value > property.maximum) {
        errors.push(`${name} 不得大於 ${property.maximum}`);
      }
    } else if (property.type === 'string') {
      value = text(value, property.maxLength);
      if (
        property.format === 'email' &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      ) {
        errors.push(`${name} 電子郵件格式無效`);
      }
      if (property.format === 'url' && !/^https?:\/\//i.test(value)) {
        errors.push(`${name} 網址格式無效`);
      }
      if (property.format === 'phone' && !/(?:\d[^\d]*){8,18}/.test(value)) {
        errors.push(`${name} 電話格式無效`);
      }
      if (
        property.format === 'contact' &&
        !(
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ||
          /^(?:\+?\d[\s().-]*){8,18}$/.test(value)
        )
      ) {
        errors.push(`${name} 必須是電子郵件或電話`);
      }
    }

    if (
      Array.isArray(property.enum) === true &&
      property.enum.indexOf(String(value)) < 0
    ) {
      errors.push(`${name} 不在允許選項內`);
    }

    args[name] = value;
  });

  schema.required.forEach((name) => {
    if (args[name] == null || args[name] === '') {
      errors.push(`${name} 為必填`);
    }
  });

  return { ok: errors.length === 0, args, errors };
}

/**
 * 從使用者的查詢中提取並驗證工具所需的參數。
 * @param {object} tool - 目標工具定義
 * @param {string} query - 使用者的輸入查詢
 * @param {object} [context] - 上下文資料
 * @param {object} [existing] - 已存在的參數
 * @param {string[]} [onlyNames] - 限制只提取指定的參數名稱
 * @param {boolean} [allowWhole] - 是否允許單一字串參數吸收整個查詢
 * @returns {{args: object, missing: string[], errors: string[]}} 提取結果，包含成功提取的參數、缺失的必填參數及驗證錯誤
 */
export function extract(tool, query, context, existing, onlyNames, allowWhole) {
  tool = normaliseTool(tool);
  existing = existing && typeof existing === 'object' ? existing : {};
  const args = {};
  const properties = tool.inputSchema.properties;

  Object.keys(properties).forEach((name) => {
    if (existing[name] != null) {
      args[name] = existing[name];
    }
  });

  const names =
    Array.isArray(onlyNames) === true && onlyNames.length > 0
      ? onlyNames
      : Object.keys(properties);
  names.forEach((name) => {
    if (
      typeof properties[name] !== 'object' ||
      properties[name] === null ||
      args[name] != null
    ) {
      return;
    }
    const value = valueForProperty(
      name,
      properties[name],
      String(query || ''),
      context || {},
      !!allowWhole && names.length === 1
    );
    if (value !== undefined && value !== '') {
      args[name] = value;
    }
  });

  const validation = validate(tool.inputSchema, args);
  const invalid = validation.errors.map((error) => String(error).split(' ')[0]);
  invalid.forEach((name) => {
    delete validation.args[name];
  });

  return {
    args: validation.args,
    missing: tool.inputSchema.required.filter(
      (name) => validation.args[name] == null || validation.args[name] === ''
    ),
    errors: validation.errors
  };
}

/**
 * 產生工具參數的中文摘要，用於與使用者確認。
 * @param {object} tool - 工具定義
 * @param {object} args - 工具的參數物件
 * @returns {string} 中文參數摘要字串，以頓號分隔
 */
export function argumentSummary(tool, args) {
  tool = normaliseTool(tool);
  args = args || {};
  return Object.keys(args)
    .map((name) => {
      const property = tool.inputSchema.properties[name] || {};
      return `${property.title || name}：${String(args[name])}`;
    })
    .join('、');
}

/**
 * 初始化並建立工具執行引擎 (Tools Engine)。
 * 處理工具路由、參數收集、使用者互動 (補齊參數、選擇模糊工具、確認執行) 及最終執行邏輯。
 * @param {object} [setting={}] - 引擎設定物件，包含回呼函數與狀態讀取器
 * @returns {object} 工具引擎實體 (Tools Engine Instance)
 */
export function initToolsEngine(setting = {}) {
  function routeHostTool(text) {
    return route(toolsEngine.HOST_TOOLS, text);
  }

  function parameterPrompt(tool, name, errorText) {
    const property = tool.inputSchema.properties[name] || {};
    const label = property.title || name;
    const choices =
      property.enum && property.enum.length
        ? `（可選：${property.enum.join('、')}）`
        : '';
    return `${errorText ? errorText + '。' : ''}執行「${tool.label}」前，請提供${label}${choices}。`;
  }

  function prepareTool(tool, query, routeMeta, existingArgs) {
    const extracted = extract(tool, query, {}, existingArgs || {}, null, false);
    if (extracted.missing.length > 0) {
      toolsEngine.pendingToolInput = {
        tool,
        query,
        routeMeta,
        args: extracted.args,
        missing: extracted.missing
      };
      const prompt = parameterPrompt(
        tool,
        extracted.missing[0],
        extracted.errors[0] || ''
      );
      if (typeof toolsEngine.onAddChatMessage === 'function') {
        toolsEngine.onAddChatMessage('assistant', prompt, { source: 'tool' });
      }
      if (typeof toolsEngine.onSpeak === 'function') {
        toolsEngine.onSpeak(prompt);
      }
      return;
    }
    toolsEngine.pendingToolInput = null;
    offerHostTool(tool, query, routeMeta, extracted.args);
  }

  function continueToolInput(text) {
    if (
      typeof toolsEngine.pendingToolInput !== 'object' ||
      toolsEngine.pendingToolInput === null
    ) {
      return false;
    }
    if (/^(取消|不要|算了|cancel)$/i.test(String(text || '').trim())) {
      toolsEngine.pendingToolInput = null;
      const message = '好的，已取消這個操作。';
      if (typeof toolsEngine.onAddChatMessage === 'function') {
        toolsEngine.onAddChatMessage('assistant', message, { source: 'tool' });
      }
      if (typeof toolsEngine.onSpeak === 'function') {
        toolsEngine.onSpeak(message);
      }
      return true;
    }
    const pending = toolsEngine.pendingToolInput;
    const field = pending.missing[0];
    const extracted = extract(
      pending.tool,
      text,
      {},
      pending.args,
      [field],
      true
    );
    if (extracted.missing.length > 0) {
      pending.args = extracted.args;
      pending.missing = extracted.missing;
      const prompt = parameterPrompt(
        pending.tool,
        extracted.missing[0],
        extracted.errors[0] || '輸入格式不正確'
      );
      if (typeof toolsEngine.onAddChatMessage === 'function') {
        toolsEngine.onAddChatMessage('assistant', prompt, { source: 'tool' });
      }
      if (typeof toolsEngine.onSpeak === 'function') {
        toolsEngine.onSpeak(prompt);
      }
      return true;
    }
    prepareTool(pending.tool, pending.query, pending.routeMeta, extracted.args);
    return true;
  }

  function offerToolChoices(query, candidates) {
    const choices = candidates.slice(0, 3);
    const message = `我找到幾個可能的操作，請選擇：${choices.map((item, index) => `${index + 1}「${item.tool.label}」`).join('、')}`;

    let id;
    if (typeof toolsEngine.onAddChatMessage === 'function') {
      id = toolsEngine.onAddChatMessage('assistant', message, {
        pendingChoices: choices,
        source: 'tool'
      });
    }

    if (typeof id !== 'undefined') {
      const item = setting.getBrain().chatLog.find((entry) => entry.id === id);
      if (typeof item === 'object' && item !== null) {
        item.choiceQuery = query;
      }
    }

    toolsEngine.pendingToolChoice = { messageId: id, choices };

    if (typeof toolsEngine.onSetHistoryOpen === 'function') {
      toolsEngine.onSetHistoryOpen(true);
    }
    if (typeof toolsEngine.onSpeak === 'function') {
      toolsEngine.onSpeak(message);
    }
  }

  function continueToolChoice(text) {
    if (
      typeof toolsEngine.pendingToolChoice !== 'object' ||
      toolsEngine.pendingToolChoice === null
    ) {
      return false;
    }
    if (/^(取消|不要|算了|cancel)$/i.test(String(text || '').trim())) {
      const item = setting
        .getBrain()
        .chatLog.find(
          (entry) => entry.id === toolsEngine.pendingToolChoice.messageId
        );
      if (typeof item === 'object' && item !== null) {
        item.pendingChoices = null;
        item.text = '好的，已取消。';
      }
      toolsEngine.pendingToolChoice = null;

      if (typeof toolsEngine.onRenderHistory === 'function') {
        toolsEngine.onRenderHistory();
      }
      const message = '好的，已取消這個操作。';
      if (typeof toolsEngine.onSpeak === 'function') {
        toolsEngine.onSpeak(message);
      }
      return true;
    }

    let index = /(?:第一|1|一)/.test(text)
      ? 0
      : /(?:第二|2|二)/.test(text)
        ? 1
        : /(?:第三|3|三)/.test(text)
          ? 2
          : -1;

    if (index < 0) {
      const routed = route(
        toolsEngine.pendingToolChoice.choices.map((item) => item.tool),
        text
      );
      if (routed.match) {
        index = toolsEngine.pendingToolChoice.choices.findIndex(
          (item) => item.tool.name === routed.match.tool.name
        );
      }
    }

    if (index >= 0 && toolsEngine.pendingToolChoice.choices[index]) {
      chooseTool(toolsEngine.pendingToolChoice.messageId, index);
      return true;
    }

    const prompt = '請說「第一個、第二個、第三個」，或點選你要的操作。';
    if (typeof toolsEngine.onAddChatMessage === 'function') {
      toolsEngine.onAddChatMessage('assistant', prompt, { source: 'tool' });
    }
    if (typeof toolsEngine.onSpeak === 'function') {
      toolsEngine.onSpeak(prompt);
    }
    return true;
  }

  function chooseTool(messageId, index) {
    const item = setting
      .getBrain()
      .chatLog.find((entry) => entry.id === messageId);
    if (
      typeof item !== 'object' ||
      item === null ||
      !Array.isArray(item.pendingChoices) ||
      item.pendingChoices[index] === undefined
    ) {
      return;
    }
    const selected = item.pendingChoices[index];
    item.pendingChoices = null;
    item.text = `已選擇「${selected.tool.label}」。`;
    toolsEngine.pendingToolChoice = null;
    if (typeof toolsEngine.onRenderHistory === 'function') {
      toolsEngine.onRenderHistory();
    }
    prepareTool(
      selected.tool,
      item.choiceQuery || '',
      { confidence: selected.score, reason: 'user_choice' },
      {}
    );
  }

  function offerHostTool(tool, query, routeMeta, args) {
    const callId = `tool-${Date.now()}-${++setting.getBrain().chatSeq}`;
    const history = setting
      .getBrain()
      .chatLog.slice(-12)
      .map((item) => ({ role: item.role, text: item.text }))
      .filter((item) => item.text);

    const pending = {
      callId,
      name: tool.name,
      label: tool.label,
      input: {
        query,
        context: {},
        args: args || {},
        route: routeMeta || {},
        history
      }
    };
    const summary = argumentSummary(tool, args || {});

    if (tool.requiresConfirmation === true) {
      const confirmation = `要幫你執行「${tool.label}」嗎？${summary ? '\n' + summary : ''}`;
      if (typeof toolsEngine.onAddChatMessage === 'function') {
        toolsEngine.onAddChatMessage('assistant', confirmation, {
          id: callId,
          pendingTool: pending,
          source: 'tool'
        });
      }
      toolsEngine.pendingToolConfirmation = callId;
      if (typeof toolsEngine.onSetHistoryOpen === 'function') {
        toolsEngine.onSetHistoryOpen(true);
      }
      if (typeof toolsEngine.onSpeak === 'function') {
        toolsEngine.onSpeak(confirmation);
      }
    } else {
      if (typeof toolsEngine.onAddChatMessage === 'function') {
        toolsEngine.onAddChatMessage(
          'assistant',
          `正在執行「${tool.label}」…`,
          { id: callId, source: 'tool' }
        );
      }
      if (typeof setting.onToolCall === 'function') {
        setting.onToolCall(pending);
      }
    }
  }

  function executePendingTool(messageId) {
    const item = setting.getBrain().chatLog.find((msg) => msg.id === messageId);
    if (
      typeof item !== 'object' ||
      item === null ||
      typeof item.pendingTool !== 'object' ||
      item.pendingTool === null
    ) {
      return;
    }
    const pending = item.pendingTool;
    item.pendingTool = null;
    toolsEngine.pendingToolConfirmation = '';
    item.text = `正在執行「${pending.label}」…`;
    if (typeof toolsEngine.onRenderHistory === 'function') {
      toolsEngine.onRenderHistory();
    }
    if (typeof setting.onToolCall === 'function') {
      setting.onToolCall(pending);
    }
  }

  function cancelPendingTool(messageId) {
    const item = setting.getBrain().chatLog.find((msg) => msg.id === messageId);
    if (
      typeof item !== 'object' ||
      item === null ||
      typeof item.pendingTool !== 'object' ||
      item.pendingTool === null
    ) {
      return;
    }
    item.pendingTool = null;
    toolsEngine.pendingToolConfirmation = '';
    item.text = '好的，已取消。';
    if (typeof toolsEngine.onRenderHistory === 'function') {
      toolsEngine.onRenderHistory();
    }
    if (setting.getSpeech().convoOn === true) {
      if (typeof toolsEngine.onSpeak === 'function') {
        toolsEngine.onSpeak('好的，已取消。');
      }
    }
  }

  function continueToolConfirmation(text) {
    if (
      typeof toolsEngine.pendingToolConfirmation !== 'string' ||
      toolsEngine.pendingToolConfirmation === ''
    ) {
      return false;
    }
    const answer = String(text || '').trim();
    if (/^(確認|確定|執行|可以|好|好的|yes|ok)$/i.test(answer)) {
      executePendingTool(toolsEngine.pendingToolConfirmation);
      return true;
    }
    if (/^(取消|不要|算了|否|no|cancel)$/i.test(answer)) {
      cancelPendingTool(toolsEngine.pendingToolConfirmation);
      return true;
    }
    const prompt = '請說「確認」或「取消」，也可以點選按鈕。';
    if (typeof toolsEngine.onAddChatMessage === 'function') {
      toolsEngine.onAddChatMessage('assistant', prompt, { source: 'tool' });
    }
    if (typeof toolsEngine.onSpeak === 'function') {
      toolsEngine.onSpeak(prompt);
    }
    return true;
  }

  function handleToolResult(resultData) {
    const text =
      resultData.ok === false
        ? `執行失敗：${String(resultData.error || '未知錯誤')}`
        : String(resultData.message || '已完成。');
    const existing = setting
      .getBrain()
      .chatLog.find((msg) => msg.id === resultData.callId);

    if (typeof existing === 'object' && existing !== null) {
      if (typeof toolsEngine.onUpdateChatMessage === 'function') {
        toolsEngine.onUpdateChatMessage(existing.id, text, false);
      }
    } else {
      if (typeof toolsEngine.onAddChatMessage === 'function') {
        toolsEngine.onAddChatMessage('assistant', text, { source: 'tool' });
      }
    }
    if (typeof toolsEngine.onSpeak === 'function') {
      toolsEngine.onSpeak(text);
    }
  }

  const toolsEngine = {
    HOST_TOOLS: [],
    pendingToolInput: null,
    pendingToolChoice: null,
    pendingToolConfirmation: null,

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
    get onSpeak() {
      return setting.onSpeak;
    },

    routeHostTool,
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
    handleToolResult
  };

  return toolsEngine;
}
