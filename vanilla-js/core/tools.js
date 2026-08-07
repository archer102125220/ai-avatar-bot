function text(value, max) {
  return String(value || '')
    .trim()
    .slice(0, max || 240);
}

function normal(value) {
  return text(value, 1200)
    .toLowerCase()
    .replace(/[\s，。、！？,.!?：:；;()（）]+/g, '');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function bigrams(value) {
  const input = normal(value);
  const out = [];
  if (input.length === 1) return [input];
  for (let i = 0; i < input.length - 1; i++) {
    out.push(input.slice(i, i + 2));
  }
  return out;
}

export function similarity(a, b) {
  const aa = bigrams(a);
  const bb = new Set(bigrams(b));
  if (!aa.length || !bb.size) return 0;
  let hits = 0;
  aa.forEach((item) => {
    if (bb.has(item)) hits++;
  });
  return hits / Math.sqrt(aa.length * bb.size);
}

export function normaliseSchema(schema) {
  if (
    !schema ||
    schema.type !== 'object' ||
    !schema.properties ||
    typeof schema.properties !== 'object'
  ) {
    return { type: 'object', properties: {}, required: [] };
  }
  const properties = {};
  Object.keys(schema.properties)
    .slice(0, 20)
    .forEach((name) => {
      if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/.test(name)) return;
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
      if (Number.isFinite(Number(raw.minimum)))
        property.minimum = Number(raw.minimum);
      if (Number.isFinite(Number(raw.maximum)))
        property.maximum = Number(raw.maximum);
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

export function scoreTool(tool, query) {
  const q = normal(query);
  if (
    !q ||
    tool.excludeKeywords.some((item) => item && q.includes(normal(item)))
  ) {
    return { score: 0, reason: 'excluded' };
  }
  let score = 0;
  let reason = '';
  tool.keywords.forEach((keyword) => {
    const key = normal(keyword);
    if (!key) return;
    const current = q.includes(key)
      ? Math.min(0.92, 0.62 + key.length * 0.035)
      : similarity(q, key) * 0.62;
    if (current > score) {
      score = current;
      reason = q.includes(key) ? `keyword:${keyword}` : 'keyword-similarity';
    }
  });
  tool.examples.forEach((example) => {
    const sim = similarity(q, example);
    const current = 0.18 + sim * 0.72;
    if (sim >= 0.28 && current > score) {
      score = current;
      reason = 'example';
    }
  });
  const labelSimilarity = similarity(q, tool.label);
  if (labelSimilarity >= 0.3 && 0.16 + labelSimilarity * 0.65 > score) {
    score = 0.16 + labelSimilarity * 0.65;
    reason = 'label';
  }
  const descriptionSimilarity = similarity(q, tool.description);
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

export function route(tools, query) {
  const candidates = (Array.isArray(tools) ? tools : [])
    .map(normaliseTool)
    .filter((tool) => tool.name)
    .map((tool) => {
      const scored = scoreTool(tool, query);
      return { tool, score: scored.score, reason: scored.reason };
    })
    .filter((item) => item.score >= item.tool.routeThreshold)
    .sort((a, b) => b.score - a.score || b.tool.priority - a.tool.priority);

  const top = candidates[0] || null;
  const second = candidates[1] || null;
  const ambiguous = !!(top && second && top.score - second.score < 0.09);

  return {
    match: ambiguous ? null : top,
    ambiguous: ambiguous ? candidates.slice(0, 3) : [],
    candidates
  };
}

function findPrefixed(query, prefixes) {
  for (let i = 0; i < prefixes.length; i++) {
    const re = new RegExp(
      escapeRegExp(prefixes[i]) +
        '\\s*(?:是|為|=|:|：)?\\s*([^，。！？,!?]{1,120})',
      'i'
    );
    const match = re.exec(query);
    if (match) return match[1].trim();
  }
  return '';
}

function valueForProperty(name, property, query, context, allowWhole) {
  if (property.contextKey && context && context[property.contextKey] != null) {
    return context[property.contextKey];
  }
  if (context && context[name] != null) return context[name];

  const value = findPrefixed(
    query,
    property.prefixes.concat([property.title]).filter(Boolean)
  );

  if (property.enum) {
    const selected = property.enum.find((item) =>
      normal(query).includes(normal(item))
    );
    if (selected) return selected;
  }
  if (property.format === 'email') {
    const email = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.exec(query);
    if (email) return email[0];
  }
  if (property.format === 'url') {
    const url = /https?:\/\/[^\s，。]+/i.exec(query);
    if (url) return url[0];
  }
  if (property.format === 'phone') {
    const phone = /(?:\+?\d[\s().-]*){8,18}/.exec(query);
    if (phone) return phone[0].trim();
  }
  if (property.format === 'contact') {
    const contactEmail = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.exec(query);
    if (contactEmail) return contactEmail[0];
    const contactPhone = /(?:\+?\d[\s().-]*){8,18}/.exec(query);
    if (contactPhone) return contactPhone[0].trim();
  }
  if (property.type === 'boolean') {
    if (/(不同意|不要|不用|否|不需要|false|no)/i.test(query)) return false;
    if (/(同意|要|需要|可以|是|true|yes)/i.test(query)) return true;
  }
  if (property.type === 'number' || property.type === 'integer') {
    const number = /-?\d+(?:\.\d+)?/.exec(value || query);
    if (number)
      return property.type === 'integer'
        ? Math.round(Number(number[0]))
        : Number(number[0]);
  }
  if (value) return value.slice(0, property.maxLength);
  if (allowWhole && property.type === 'string')
    return text(query, property.maxLength);

  return undefined;
}

export function validate(schema, input) {
  schema = normaliseSchema(schema);
  input =
    input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const args = {};
  const errors = [];

  Object.keys(schema.properties).forEach((name) => {
    if (input[name] == null || input[name] === '') return;
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
      if (property.minimum != null && value < property.minimum)
        errors.push(`${name} 不得小於 ${property.minimum}`);
      if (property.maximum != null && value > property.maximum)
        errors.push(`${name} 不得大於 ${property.maximum}`);
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

    if (property.enum && property.enum.indexOf(String(value)) < 0) {
      errors.push(`${name} 不在允許選項內`);
    }

    args[name] = value;
  });

  schema.required.forEach((name) => {
    if (args[name] == null || args[name] === '') errors.push(`${name} 為必填`);
  });

  return { ok: errors.length === 0, args, errors };
}

export function extract(tool, query, context, existing, onlyNames, allowWhole) {
  tool = normaliseTool(tool);
  existing = existing && typeof existing === 'object' ? existing : {};
  const args = {};
  const properties = tool.inputSchema.properties;

  Object.keys(properties).forEach((name) => {
    if (existing[name] != null) args[name] = existing[name];
  });

  const names =
    Array.isArray(onlyNames) && onlyNames.length
      ? onlyNames
      : Object.keys(properties);
  names.forEach((name) => {
    if (!properties[name] || args[name] != null) return;
    const value = valueForProperty(
      name,
      properties[name],
      String(query || ''),
      context || {},
      !!allowWhole && names.length === 1
    );
    if (value !== undefined && value !== '') args[name] = value;
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
    if (extracted.missing.length) {
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
    if (!toolsEngine.pendingToolInput) return false;
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
    if (extracted.missing.length) {
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

    if (id) {
      const item = setting.getBrain().chatLog.find((entry) => entry.id === id);
      if (item) item.choiceQuery = query;
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
    if (!toolsEngine.pendingToolChoice) return false;
    if (/^(取消|不要|算了|cancel)$/i.test(String(text || '').trim())) {
      const item = setting
        .getBrain()
        .chatLog.find(
          (entry) => entry.id === toolsEngine.pendingToolChoice.messageId
        );
      if (item) {
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
    if (!item || !item.pendingChoices || !item.pendingChoices[index]) return;
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

    if (tool.requiresConfirmation) {
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
    const item = setting.getBrain().chatLog.find((m) => m.id === messageId);
    if (!item || !item.pendingTool) return;
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
    const item = setting.getBrain().chatLog.find((m) => m.id === messageId);
    if (!item || !item.pendingTool) return;
    item.pendingTool = null;
    toolsEngine.pendingToolConfirmation = '';
    item.text = '好的，已取消。';
    if (typeof toolsEngine.onRenderHistory === 'function') {
      toolsEngine.onRenderHistory();
    }
    if (setting.getSpeech().convoOn) {
      if (typeof toolsEngine.onSpeak === 'function') {
        toolsEngine.onSpeak('好的，已取消。');
      }
    }
  }

  function continueToolConfirmation(text) {
    if (!toolsEngine.pendingToolConfirmation) return false;
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

  function handleToolResult(d) {
    const text =
      d.ok === false
        ? `執行失敗：${String(d.error || '未知錯誤')}`
        : String(d.message || '已完成。');
    const existing = setting.getBrain().chatLog.find((m) => m.id === d.callId);

    if (existing) {
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
