import {
  DEFAULT_TOOL_RESULT_MODE,
  DEFAULT_TOOL_ROUTING_MODE,
  TOOL_RESULT_MODE_MAP,
  TOOL_ROUTING_MODE_MAP,
  TOOL_SCHEMA_TYPE_MAP
} from '@/core/constants';
import { sanitizeText } from './utils';
import type { ToolSchema, ToolSchemaProperty, ToolDefinition } from '@types';

/**
 * Normalizes a tool's input parameter schema, ensuring compliant structure, valid property types, and safety limits.
 *
 * @param schema - Raw input schema to normalize.
 * @returns Normalized JSON schema object with valid properties and required fields.
 */
export function normaliseSchema(
  schema?: ToolSchema | Record<string, unknown> | null
): ToolSchema {
  if (
    typeof schema !== 'object' ||
    schema === null ||
    schema.type !== 'object' ||
    typeof schema.properties !== 'object' ||
    schema.properties === null
  ) {
    return { type: 'object', properties: {}, required: [] };
  }
  const propertiesRecord = schema.properties as Record<string, Record<string, unknown>>;
  const normalizedProperties: Record<string, ToolSchemaProperty> = {};
  Object.keys(propertiesRecord)
    .slice(0, 20)
    .forEach((propertyName) => {
      if (/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/.test(propertyName) === false) {
        return;
      }
      const rawProperty = propertiesRecord[propertyName] || {};
      const propertyType =
        typeof rawProperty.type === 'string' &&
        /^(string|number|integer|boolean)$/.test(rawProperty.type) === true
          ? (rawProperty.type as 'string' | 'number' | 'integer' | 'boolean')
          : 'string';
      const propertyConfig: ToolSchemaProperty = {
        type: propertyType,
        title: sanitizeText(rawProperty.title || propertyName, 80),
        description: sanitizeText(rawProperty.description, 160),
        contextKey: sanitizeText(rawProperty.contextKey, 60),
        format:
          typeof rawProperty.format === 'string' &&
          /^(email|url|phone|contact)$/.test(rawProperty.format) === true
            ? (rawProperty.format as 'email' | 'url' | 'phone' | 'contact')
            : '',
        prefixes:
          Array.isArray(rawProperty.prefixes) === true
            ? rawProperty.prefixes
                .slice(0, 8)
                .map((prefixItem: unknown) => sanitizeText(prefixItem, 30))
                .filter(
                  (prefixItem: string) =>
                    typeof prefixItem === 'string' && prefixItem !== ''
                )
            : []
      };
      if (Array.isArray(rawProperty.enum) === true) {
        propertyConfig.enum = rawProperty.enum
          .slice(0, 20)
          .map((enumItem: unknown) => sanitizeText(enumItem, 80))
          .filter(
            (enumItem: string) =>
              typeof enumItem === 'string' && enumItem !== ''
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
            (requiredName: string) =>
              normalizedProperties[requiredName] !== undefined
          )
          .slice(0, 20)
      : [];
  return { type: 'object', properties: normalizedProperties, required };
}

/**
 * Normalizes a tool definition object, applying default options, sanitizing fields, and formatting input schemas.
 *
 * @param tool - Raw tool definition object.
 * @returns Fully normalized tool definition instance.
 */
export function normaliseTool(
  tool?: ToolDefinition | Record<string, unknown> | null
): ToolDefinition {
  const targetTool =
    typeof tool === 'object' && tool !== null
      ? (tool as Record<string, unknown>)
      : {};
  const rawRoutingMode = targetTool.routingMode as string;
  const routingMode =
    (Object.values(TOOL_ROUTING_MODE_MAP) as string[]).includes(rawRoutingMode) === true
      ? rawRoutingMode
      : DEFAULT_TOOL_ROUTING_MODE;

  const rawResultMode = targetTool.resultMode as string;
  const resultMode =
    (Object.values(TOOL_RESULT_MODE_MAP) as string[]).includes(rawResultMode) === true
      ? rawResultMode
      : DEFAULT_TOOL_RESULT_MODE;

  let confirmationTimeoutMs: number | null = null;
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
    typeof targetTool.execute === 'function' ? (targetTool.execute as ToolDefinition['execute']) : undefined;

  return {
    name: sanitizeText(targetTool.name, 64).replace(/[^a-zA-Z0-9_.-]/g, ''),
    label: sanitizeText(targetTool.label || targetTool.name, 80),
    description: sanitizeText(targetTool.description, 240),
    keywords:
      Array.isArray(targetTool.keywords) === true
        ? targetTool.keywords
            .slice(0, 30)
            .map((keywordItem: unknown) =>
              sanitizeText(keywordItem, 60).toLowerCase()
            )
            .filter(
              (keywordItem: string) =>
                typeof keywordItem === 'string' && keywordItem !== ''
            )
        : [],
    examples:
      Array.isArray(targetTool.examples) === true
        ? targetTool.examples
            .slice(0, 20)
            .map((exampleItem: unknown) => sanitizeText(exampleItem, 160))
            .filter(
              (exampleItem: string) =>
                typeof exampleItem === 'string' && exampleItem !== ''
            )
        : [],
    excludeKeywords:
      Array.isArray(targetTool.excludeKeywords) === true
        ? targetTool.excludeKeywords
            .slice(0, 20)
            .map((excludeItem: unknown) =>
              sanitizeText(excludeItem, 60).toLowerCase()
            )
            .filter(
              (excludeItem: string) =>
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
    inputSchema: normaliseSchema(targetTool.inputSchema as ToolSchema)
  };
}

/**
 * Filters the list of registered tools to return those callable by AI models (excluding client-only routing tools).
 *
 * @param tools - Array of tool definitions.
 * @returns Array of tools available for AI invocation.
 */
export function getAiAvailableTools(
  tools?: Array<ToolDefinition | Record<string, unknown>> | null
): ToolDefinition[] {
  return (Array.isArray(tools) === true ? tools : [])
    .map(normaliseTool)
    .filter(
      (tool) =>
        tool.name !== '' && tool.routingMode !== TOOL_ROUTING_MODE_MAP.CLIENT
    );
}

export interface OpenAIToolProperty {
  type: string;
  description: string;
  enum?: string[];
}

export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, OpenAIToolProperty>;
      required: string[];
    };
  };
}

/**
 * Transforms registered tool definitions into OpenAI-compatible JSON Schema function definitions.
 *
 * @param tools - Array of tool definitions.
 * @returns Array of OpenAI function tool schema objects.
 */
export function toOpenAiTools(
  tools?: Array<ToolDefinition | Record<string, unknown>> | null
): OpenAITool[] {
  const aiTools = getAiAvailableTools(tools);
  return aiTools.map((tool) => {
    const properties: Record<string, OpenAIToolProperty> = {};
    const schemaProperties = tool.inputSchema?.properties || {};
    Object.keys(schemaProperties).forEach((propertyKey) => {
      const propertySchema = schemaProperties[propertyKey];
      const prop: OpenAIToolProperty = {
        type: propertySchema.type || TOOL_SCHEMA_TYPE_MAP.STRING,
        description:
          propertySchema.description || propertySchema.title || propertyKey
      };
      if (
        Array.isArray(propertySchema.enum) === true &&
        propertySchema.enum.length > 0
      ) {
        prop.enum = propertySchema.enum;
      }
      properties[propertyKey] = prop;
    });

    return {
      type: 'function' as const,
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
 * @param tool - Tool definition object.
 * @param args - Tool arguments dictionary.
 * @returns Formatted parameter summary string.
 */
export function argumentSummary(
  tool: ToolDefinition | Record<string, unknown>,
  args?: Record<string, unknown> | null
): string {
  const normalizedTool = normaliseTool(tool);
  const targetArgs = typeof args === 'object' && args !== null ? args : {};
  return Object.keys(targetArgs)
    .map((propertyName) => {
      const propertySchema =
        (normalizedTool.inputSchema?.properties &&
          normalizedTool.inputSchema.properties[propertyName]) ||
        {};
      return `${propertySchema.title || propertyName}：${String(targetArgs[propertyName])}`;
    })
    .join('、');
}
