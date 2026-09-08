import { sanitizeText, normalizeText, findPrefixedValue } from './utils';
import { normaliseSchema, normaliseTool } from './schema';

/**
 * 根據屬性定義，從查詢字串或上下文中提取出該屬性的值。
 * @param {string} propertyName - 屬性名稱
 * @param {import('./schema').ToolSchemaProperty} propertySchema - 屬性定義
 * @param {string} query - 使用者查詢字串
 * @param {Record<string, any>} context - 上下文資料物件
 * @param {boolean} allowWhole - 是否允許將整個查詢作為字串值
 * @returns {any} 提取出的屬性值，若無則為 undefined
 */
export function extractPropertyValue(
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
 * @param {object|import('./schema').ToolSchema} schema - 工具的輸入綱要
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
 * @param {object|import('./schema').ToolDefinition} tool - 目標工具定義
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
