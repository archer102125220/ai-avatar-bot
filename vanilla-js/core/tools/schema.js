import {
  DEFAULT_TOOL_RESULT_MODE,
  DEFAULT_TOOL_ROUTING_MODE,
  TOOL_RESULT_MODE_MAP,
  TOOL_ROUTING_MODE_MAP,
  TOOL_SCHEMA_TYPE_MAP
} from '@/core/constants';
import { sanitizeText } from './utils';

/**
 * Property definition inside a tool's JSON input schema.
 * @typedef {import('@types').ToolSchemaProperty} ToolSchemaProperty
 */

/**
 * JSON input schema for tool parameters.
 * @typedef {import('@types').ToolSchema} ToolSchema
 */

/**
 * Declarative definition of a tool callable by the AI or client rules.
 * @typedef {import('@types').ToolDefinition} ToolDefinition
 */

/**
 * Normalizes a tool's input parameter schema, ensuring compliant structure, valid property types, and safety limits.
 *
 * @param {ToolSchema | Record<string, any>} schema - Raw input schema to normalize.
 * @returns {ToolSchema} Normalized JSON schema object with valid properties and required fields.
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
 * Normalizes a tool definition object, applying default options, sanitizing fields, and formatting input schemas.
 *
 * @param {ToolDefinition | Record<string, any>} tool - Raw tool definition object.
 * @returns {ToolDefinition} Fully normalized tool definition instance.
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
 * Filters the list of registered tools to return those callable by AI models (excluding client-only routing tools).
 *
 * @param {Array<ToolDefinition | Record<string, any>>} tools - Array of tool definitions.
 * @returns {ToolDefinition[]} Array of tools available for AI invocation.
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
 * Transforms registered tool definitions into OpenAI-compatible JSON Schema function definitions.
 *
 * @param {Array<ToolDefinition | Record<string, any>>} tools - Array of tool definitions.
 * @returns {Array<Record<string, any>>} Array of OpenAI function tool schema objects.
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
 * Generates a human-readable argument summary string for user confirmation dialogue.
 *
 * @param {ToolDefinition | Record<string, any>} tool - Tool definition object.
 * @param {Record<string, any>} args - Tool arguments dictionary.
 * @returns {string} Formatted parameter summary string.
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
