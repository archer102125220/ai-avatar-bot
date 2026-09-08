import {
  DEFAULT_TOOL_RESULT_MODE,
  DEFAULT_TOOL_ROUTING_MODE,
  TOOL_RESULT_MODE_MAP,
  TOOL_ROUTING_MODE_MAP,
  TOOL_SCHEMA_TYPE_MAP
} from '../constants';
import { sanitizeText } from './utils';

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
