import { sanitizeText, normalizeText, findPrefixedValue } from './utils';
import { normaliseSchema, normaliseTool } from './schema';
import type {
  ToolSchema,
  ToolSchemaProperty,
  ToolValidationResult,
  ToolExtractResult,
  ToolDefinition
} from '@types';

/**
 * Extracts a property value from a query string or execution context based on its schema definition.
 *
 * @param propertyName - Property field name.
 * @param propertySchema - Property schema definition.
 * @param query - User natural language query.
 * @param context - Execution context object.
 * @param allowWhole - Whether to allow absorbing the entire query as a single string parameter.
 * @returns Extracted property value, or undefined if no value could be extracted.
 */
export function extractPropertyValue(
  propertyName: string,
  propertySchema: ToolSchemaProperty,
  query: string,
  context?: Record<string, any> | null,
  allowWhole?: boolean
): any {
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

  const prefixList = (
    Array.isArray(propertySchema.prefixes) ? propertySchema.prefixes : []
  )
    .concat([propertySchema.title || ''])
    .filter(
      (prefixItem: string) =>
        typeof prefixItem === 'string' && prefixItem !== ''
    );

  const prefixedValue = findPrefixedValue(query, prefixList);

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
    const contactEmailMatch = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.exec(
      query
    );
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
    return prefixedValue.slice(0, propertySchema.maxLength || 240);
  }
  if (allowWhole === true && propertySchema.type === 'string') {
    return sanitizeText(query, propertySchema.maxLength || 240);
  }

  return undefined;
}

/**
 * Validates an input arguments dictionary against the tool parameter schema.
 *
 * @param schema - Tool parameter schema.
 * @param input - Input arguments dictionary to validate.
 * @returns Validation result containing status, sanitized arguments, and error list.
 */
export function validate(
  schema?: ToolSchema | Record<string, any> | null,
  input?: Record<string, any> | null
): ToolValidationResult {
  const normalizedSchema = normaliseSchema(schema);
  const targetInput =
    typeof input === 'object' &&
    input !== null &&
    Array.isArray(input) === false
      ? input
      : {};
  const validatedArgs: Record<string, any> = {};
  const validationErrors: string[] = [];

  const schemaProperties = normalizedSchema.properties || {};

  Object.keys(schemaProperties).forEach((propertyName) => {
    if (
      targetInput[propertyName] === undefined ||
      targetInput[propertyName] === null ||
      targetInput[propertyName] === ''
    ) {
      return;
    }
    const propertySchema = schemaProperties[propertyName];
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

    if (propertySchema.type === 'integer' || propertySchema.type === 'number') {
      propertyValue = Number(propertyValue);
      if (
        typeof propertySchema.minimum === 'number' &&
        Number.isFinite(propertySchema.minimum) === true &&
        propertyValue < propertySchema.minimum
      ) {
        validationErrors.push(
          `${propertyName} 不得小於 ${propertySchema.minimum}`
        );
      }
      if (
        typeof propertySchema.maximum === 'number' &&
        Number.isFinite(propertySchema.maximum) === true &&
        propertyValue > propertySchema.maximum
      ) {
        validationErrors.push(
          `${propertyName} 不得大於 ${propertySchema.maximum}`
        );
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
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(propertyValue) === false &&
        /(?:\+?\d[\s().-]*){8,18}/.test(propertyValue) === false
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

  const requiredList = Array.isArray(normalizedSchema.required)
    ? normalizedSchema.required
    : [];

  requiredList.forEach((requiredName) => {
    if (
      validatedArgs[requiredName] === undefined ||
      validatedArgs[requiredName] === null ||
      validatedArgs[requiredName] === ''
    ) {
      validationErrors.push(`${requiredName} 為必填`);
    }
  });

  return {
    ok: validationErrors.length === 0,
    args: validatedArgs,
    errors: validationErrors
  };
}

/**
 * Extracts and validates parameters for a specific tool from user natural language query and context.
 *
 * @param tool - Target tool definition.
 * @param query - User input query string.
 * @param context - Session context dictionary.
 * @param existing - Existing/previously collected arguments.
 * @param onlyNames - Filter list of specific property names to extract.
 * @param allowWhole - Whether to allow single string parameter to absorb entire query.
 * @returns Extraction result containing extracted args, missing required fields, and errors.
 */
export function extract(
  tool: ToolDefinition | Record<string, any>,
  query: string,
  context?: Record<string, any> | null,
  existing?: Record<string, any> | null,
  onlyNames?: string[] | null,
  allowWhole?: boolean
): ToolExtractResult {
  const normalizedTool = normaliseTool(tool);
  const existingArgs =
    typeof existing === 'object' && existing !== null ? existing : {};
  const extractedArgs: Record<string, any> = {};
  const schemaProperties = normalizedTool.inputSchema?.properties || {};

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

  const requiredList = Array.isArray(normalizedTool.inputSchema?.required)
    ? normalizedTool.inputSchema.required
    : [];

  return {
    args: validationResult.args,
    missing: requiredList.filter(
      (requiredName) =>
        validationResult.args[requiredName] === undefined ||
        validationResult.args[requiredName] === null ||
        validationResult.args[requiredName] === ''
    ),
    errors: validationResult.errors
  };
}
