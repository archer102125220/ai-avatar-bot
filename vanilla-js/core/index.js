import {
  AVATAR_MODE_MAP,
  DEFAULT_AVATAR_MODE,
  DEFAULT_LLM_MODEL,
  DEFAULT_AI_PROVIDER_MODEL,
  STATE_MAP,
  classifyEmotion,
  scoreEntry,
  topK,
  getWelcomeText,
  initBrainEngine
} from './brain';

import {
  ENGINE_MODE_MAP,
  FIT_MODE_MAP,
  DEFALUT_START_MODE,
  DEFAULT_FIT_MODE,
  DEFAULT_FEMALE_MODEL_URL,
  DEFAULT_MALE_MODEL_URL,
  GENDER_MAP,
  DEFAULT_GENDER,
  DEFAULT_MODEL_URL,
  initSkinEngine
} from './skin';

import {
  DEFAULT_TTS_ENDPOINT,
  DEFAULT_FEMALE_NEURAL_VOICE,
  DEFAULT_MALE_NEURAL_VOICE,
  prefetchSpeech,
  splitSentences,
  playBuffer,
  fetchTTSBuffer,
  handleNeuralFail,
  speakBrowserChunk,
  loadVoice,
  initSpeechEngine
} from './speech';

import { initUi } from './ui';

import '../style/style.scss';

// M4b：WebLLM（瀏覽器內跑小模型，零金鑰）。函式庫改成「按下🧠才動態 import」，
//    一般訪客（不啟用大腦）不會下載這包 JS。控制權掛到 window.LLM。

// speech.js
export const DEFAULT_NEURAL_VOICE =
  DEFAULT_GENDER === GENDER_MAP.female
    ? DEFAULT_FEMALE_NEURAL_VOICE
    : DEFAULT_MALE_NEURAL_VOICE;

export {
  STATE_MAP,
  AVATAR_MODE_MAP,
  DEFAULT_LLM_MODEL,
  DEFAULT_AI_PROVIDER_MODEL,
  ENGINE_MODE_MAP,
  FIT_MODE_MAP,
  GENDER_MAP,
  DEFAULT_GENDER,
  DEFALUT_START_MODE,
  DEFAULT_AVATAR_MODE,
  DEFAULT_FIT_MODE,
  DEFAULT_MODEL_URL,
  DEFAULT_FEMALE_MODEL_URL,
  DEFAULT_MALE_MODEL_URL,
  DEFAULT_TTS_ENDPOINT,
  DEFAULT_FEMALE_NEURAL_VOICE,
  DEFAULT_MALE_NEURAL_VOICE
};

// brain.js
function setEmotionFromText(aiAvatarWidget, text) {
  aiAvatarWidget.skinEngine.gestureName = classifyEmotion(text);
}

// brain.js
// 檢索式回答（零金鑰、即時、永遠可用的後備）
function bestOf(knowledgeList = [], question) {
  let e = null;
  let s = 0;
  for (const x of knowledgeList || []) {
    const v = scoreEntry(question, x);
    if (v > s) {
      s = v;
      e = x;
    }
  }
  return { e, s };
}
// brain.js
function brainCompanionFallback(aiAvatarWidget = null, question) {
  if (typeof aiAvatarWidget?.companionFallbackContext === 'function') {
    return aiAvatarWidget.companionFallbackContext(question, aiAvatarWidget);
  } else if (typeof aiAvatarWidget?.companionFallbackContext === 'string') {
    return aiAvatarWidget.companionFallbackContext;
  }

  // 陪聊版兜底：輪流換句，不推銷產品題
  const name = aiAvatarWidget.brainEngine.mem.data.name;
  const companionFallbackList =
    Array.isArray(aiAvatarWidget.brainEngine.companionFallback) === true &&
    aiAvatarWidget.brainEngine.companionFallback.length > 0
      ? aiAvatarWidget.brainEngine.companionFallback
      : [
          (name ? name + '，' : '') +
            '這個我還不太會聊，但我想聽你說——多講一點？',
          '嗯嗯，我在聽。後來呢？',
          '哈，這題有點考倒我了，你怎麼看？',
          '我還在學著聊這個～對了，按 🧠 開 AI 大腦，我會聊得更順喔。'
        ];

  return companionFallbackList[
    aiAvatarWidget.brainEngine.companionFallbackIdx++ %
      companionFallbackList.length
  ];
}
// brain.js
function handleThinking(aiAvatarWidget = null, rawQuestion) {
  const question = (rawQuestion || '').trim();
  if (!question) {
    return '我好像沒聽清楚，可以再說一次嗎？';
  }
  const site = bestOf(aiAvatarWidget.brainEngine.knowledge, question);
  if (aiAvatarWidget.avatarMode === AVATAR_MODE_MAP.companion) {
    // 陪伴模式：聊天題給陪聊腦、網站/產品題照答
    const chat = bestOf(
      aiAvatarWidget.brainEngine.companionKnowledge,
      question
    );
    if (chat.e && chat.s >= 0.16 && chat.s + 0.05 >= site.s) {
      return chat.e.a;
    }
    if (site.e && site.s >= 0.16) {
      return site.e.a;
    }
    return brainCompanionFallback(aiAvatarWidget, question);
  }
  if (site.e && site.s >= 0.16) {
    return site.e.a;
  }

  if (typeof aiAvatarWidget?.assistantFallbackContext === 'function') {
    return aiAvatarWidget.assistantFallbackContext(question, aiAvatarWidget);
  } else if (typeof aiAvatarWidget?.assistantFallbackContext === 'string') {
    return aiAvatarWidget.assistantFallbackContext;
  }

  return (
    '你問的是「' +
    question +
    '」對吧？這題我的知識庫還沒收錄～你可以問我「怎麼安裝」「怎麼換成我的角色」「要不要錢」「麥克風怎麼用」這些喔。'
  );
}

// ui.js | history logic
function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText)
    return navigator.clipboard.writeText(text);
  const box = document.createElement('textarea');
  box.value = text;
  box.style.position = 'fixed';
  box.style.opacity = '0';
  document.body.appendChild(box);
  box.select();
  try {
    document.execCommand('copy');
  } finally {
    box.remove();
  }
  return Promise.resolve();
}

export function setHistoryOpen(aiAvatarWidget, open) {
  const panel = aiAvatarWidget.uiDom.historyPanelEl;
  const btn = aiAvatarWidget.uiDom.historyButtonEl;
  const suggestions = aiAvatarWidget.uiDom.suggestionsEl;
  const bubble = aiAvatarWidget.uiDom.bubbleEl;

  if (panel instanceof HTMLElement && btn instanceof HTMLElement) {
    if (open) {
      panel.setAttribute('css-is-open', 'true');
    } else {
      panel.removeAttribute('css-is-open');
    }
    panel.setAttribute('aria-hidden', String(!open));
    btn.setAttribute('aria-expanded', String(!!open));
  }

  if (suggestions instanceof HTMLElement) {
    suggestions.style.display = open
      ? 'none'
      : aiAvatarWidget.speechEngine.isListening ||
          aiAvatarWidget.speechEngine.convoOn
        ? 'none'
        : 'flex';
  }

  if (bubble instanceof HTMLElement) {
    if (open) {
      bubble.style.opacity = '0';
      bubble.style.pointerEvents = 'none';
      renderHistory(aiAvatarWidget);
    } else {
      bubble.style.opacity = '';
      bubble.style.pointerEvents = '';
    }
  }
}

export function renderHistory(aiAvatarWidget) {
  const list =
    aiAvatarWidget.uiDom.historyPanelEl?.querySelector('#history-list');
  if (!list) return;

  list.replaceChildren();

  if (!aiAvatarWidget.chatLog || !aiAvatarWidget.chatLog.length) {
    const empty = document.createElement('div');
    empty.className = 'history-empty';
    empty.textContent = '還沒有對話。問我一個問題，紀錄會出現在這裡。';
    list.appendChild(empty);
    return;
  }

  aiAvatarWidget.chatLog.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'history-item ' + item.role;

    const msg = document.createElement('div');
    msg.className = 'history-message';
    msg.textContent = item.text || (item.streaming ? '…' : '');
    row.appendChild(msg);

    if (item.pendingTool) {
      const confirm = document.createElement('div');
      confirm.className = 'history-confirm';
      const yes = document.createElement('button');
      yes.type = 'button';
      yes.className = 'confirm';
      yes.textContent = '確認執行';
      const no = document.createElement('button');
      no.type = 'button';
      no.className = 'cancel';
      no.textContent = '取消';
      yes.onclick = () => executePendingTool(aiAvatarWidget, item.id);
      no.onclick = () => cancelPendingTool(aiAvatarWidget, item.id);
      confirm.append(yes, no);
      row.appendChild(confirm);
    } else if (item.pendingChoices && item.pendingChoices.length) {
      const choices = document.createElement('div');
      choices.className = 'history-confirm';
      item.pendingChoices.forEach((choice, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'confirm';
        button.textContent = choice.tool.label;
        button.onclick = () => chooseTool(aiAvatarWidget, item.id, index);
        choices.appendChild(button);
      });
      row.appendChild(choices);
    }

    if (item.role === 'assistant' && item.text && !item.streaming) {
      const tools = document.createElement('div');
      tools.className = 'history-tools';
      const copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'history-tool';
      copy.textContent = '複製';
      const replay = document.createElement('button');
      replay.type = 'button';
      replay.className = 'history-tool';
      replay.textContent = '重播';

      copy.onclick = () => {
        copyText(item.text).then(() => {
          aiAvatarWidget.speechEngine.spokenDisplayText = '已複製回答';
        });
      };
      replay.onclick = () => {
        aiAvatarWidget.speechEngine.speak(item.text);
      };

      tools.append(copy, replay);
      row.appendChild(tools);
    }

    list.appendChild(row);
  });

  list.scrollTop = list.scrollHeight;
}

export function addChatMessage(aiAvatarWidget, role, text, options = {}) {
  const item = {
    id: options.id || 'm' + ++aiAvatarWidget.chatSeq,
    role: role === 'user' ? 'user' : 'assistant',
    text: String(text || '').slice(0, 4000),
    streaming: !!options.streaming,
    pendingTool: options.pendingTool || null,
    pendingChoices: options.pendingChoices || null
  };
  aiAvatarWidget.chatLog.push(item);
  if (aiAvatarWidget.chatLog.length > 80) aiAvatarWidget.chatLog.shift();

  if (aiAvatarWidget.uiDom.historyPanelEl?.classList.contains('open')) {
    renderHistory(aiAvatarWidget);
  }
  return item.id;
}

export function updateChatMessage(aiAvatarWidget, id, text, streaming) {
  const item = aiAvatarWidget.chatLog.find((m) => m.id === id);
  if (!item) {
    return addChatMessage(aiAvatarWidget, 'assistant', text, { id, streaming });
  }
  item.text = String(text || '').slice(0, 4000);
  item.streaming = !!streaming;
  if (aiAvatarWidget.uiDom.historyPanelEl?.classList.contains('open')) {
    renderHistory(aiAvatarWidget);
  }
  return item.id;
}

// Tool router core logic
export function routeHostTool(aiAvatarWidget, text) {
  if (!window.AvatarToolRouter) return { match: null, ambiguous: [] };
  return window.AvatarToolRouter.route(aiAvatarWidget.HOST_TOOLS, text);
}

function parameterPrompt(tool, name, errorText) {
  const property = tool.inputSchema.properties[name] || {};
  const label = property.title || name;
  const choices =
    property.enum && property.enum.length
      ? '（可選：' + property.enum.join('、') + '）'
      : '';
  return (
    (errorText ? errorText + '。' : '') +
    '執行「' +
    tool.label +
    '」前，請提供' +
    label +
    choices +
    '。'
  );
}

function prepareTool(aiAvatarWidget, tool, query, routeMeta, existingArgs) {
  const extracted = window.AvatarToolRouter.extract(
    tool,
    query,
    {},
    existingArgs || {},
    null,
    false
  );
  if (extracted.missing.length) {
    aiAvatarWidget.pendingToolInput = {
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
    addChatMessage(aiAvatarWidget, 'assistant', prompt, { source: 'tool' });
    aiAvatarWidget.speechEngine.speak(prompt);
    return;
  }
  aiAvatarWidget.pendingToolInput = null;
  offerHostTool(aiAvatarWidget, tool, query, routeMeta, extracted.args);
}

export function continueToolInput(aiAvatarWidget, text) {
  if (!aiAvatarWidget.pendingToolInput) return false;
  if (/^(取消|不要|算了|cancel)$/i.test(String(text || '').trim())) {
    aiAvatarWidget.pendingToolInput = null;
    const message = '好的，已取消這個操作。';
    addChatMessage(aiAvatarWidget, 'assistant', message, { source: 'tool' });
    aiAvatarWidget.speechEngine.speak(message);
    return true;
  }
  const pending = aiAvatarWidget.pendingToolInput;
  const field = pending.missing[0];
  const extracted = window.AvatarToolRouter.extract(
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
    addChatMessage(aiAvatarWidget, 'assistant', prompt, { source: 'tool' });
    aiAvatarWidget.speechEngine.speak(prompt);
    return true;
  }
  prepareTool(
    aiAvatarWidget,
    pending.tool,
    pending.query,
    pending.routeMeta,
    extracted.args
  );
  return true;
}

export function offerToolChoices(aiAvatarWidget, query, candidates) {
  const choices = candidates.slice(0, 3);
  const message =
    '我找到幾個可能的操作，請選擇：' +
    choices
      .map((item, index) => index + 1 + '「' + item.tool.label + '」')
      .join('、');
  const id = addChatMessage(aiAvatarWidget, 'assistant', message, {
    pendingChoices: choices,
    source: 'tool'
  });
  const item = aiAvatarWidget.chatLog.find((entry) => entry.id === id);
  if (item) item.choiceQuery = query;
  aiAvatarWidget.pendingToolChoice = { messageId: id, choices };
  setHistoryOpen(aiAvatarWidget, true);
  aiAvatarWidget.speechEngine.speak(message);
}

export function continueToolChoice(aiAvatarWidget, text) {
  if (!aiAvatarWidget.pendingToolChoice) return false;
  if (/^(取消|不要|算了|cancel)$/i.test(String(text || '').trim())) {
    const item = aiAvatarWidget.chatLog.find(
      (entry) => entry.id === aiAvatarWidget.pendingToolChoice.messageId
    );
    if (item) {
      item.pendingChoices = null;
      item.text = '好的，已取消。';
    }
    aiAvatarWidget.pendingToolChoice = null;
    renderHistory(aiAvatarWidget);
    const message = '好的，已取消這個操作。';
    aiAvatarWidget.speechEngine.speak(message);
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
    const routed = window.AvatarToolRouter.route(
      aiAvatarWidget.pendingToolChoice.choices.map((item) => item.tool),
      text
    );
    if (routed.match)
      index = aiAvatarWidget.pendingToolChoice.choices.findIndex(
        (item) => item.tool.name === routed.match.tool.name
      );
  }
  if (index >= 0 && aiAvatarWidget.pendingToolChoice.choices[index]) {
    chooseTool(
      aiAvatarWidget,
      aiAvatarWidget.pendingToolChoice.messageId,
      index
    );
    return true;
  }
  const prompt = '請說「第一個、第二個、第三個」，或點選你要的操作。';
  addChatMessage(aiAvatarWidget, 'assistant', prompt, { source: 'tool' });
  aiAvatarWidget.speechEngine.speak(prompt);
  return true;
}

export function chooseTool(aiAvatarWidget, messageId, index) {
  const item = aiAvatarWidget.chatLog.find((entry) => entry.id === messageId);
  if (!item || !item.pendingChoices || !item.pendingChoices[index]) return;
  const selected = item.pendingChoices[index];
  item.pendingChoices = null;
  item.text = '已選擇「' + selected.tool.label + '」。';
  aiAvatarWidget.pendingToolChoice = null;
  renderHistory(aiAvatarWidget);
  prepareTool(
    aiAvatarWidget,
    selected.tool,
    item.choiceQuery || '',
    { confidence: selected.score, reason: 'user_choice' },
    {}
  );
}

function offerHostTool(aiAvatarWidget, tool, query, routeMeta, args) {
  const callId = 'tool-' + Date.now() + '-' + ++aiAvatarWidget.chatSeq;
  const history = aiAvatarWidget.chatLog
    .slice(-12)
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
  const summary = window.AvatarToolRouter.argumentSummary(tool, args || {});

  if (tool.requiresConfirmation) {
    const confirmation =
      '要幫你執行「' + tool.label + '」嗎？' + (summary ? '\n' + summary : '');
    addChatMessage(aiAvatarWidget, 'assistant', confirmation, {
      id: callId,
      pendingTool: pending,
      source: 'tool'
    });
    aiAvatarWidget.pendingToolConfirmation = callId;
    setHistoryOpen(aiAvatarWidget, true);
    aiAvatarWidget.speechEngine.speak(confirmation);
  } else {
    addChatMessage(
      aiAvatarWidget,
      'assistant',
      '正在執行「' + tool.label + '」…',
      { id: callId, source: 'tool' }
    );
    if (typeof aiAvatarWidget.optiopns.onToolCall === 'function') {
      aiAvatarWidget.optiopns.onToolCall(pending, aiAvatarWidget);
    }
  }
}

export function executePendingTool(aiAvatarWidget, messageId) {
  const item = aiAvatarWidget.chatLog.find((m) => m.id === messageId);
  if (!item || !item.pendingTool) return;
  const pending = item.pendingTool;
  item.pendingTool = null;
  aiAvatarWidget.pendingToolConfirmation = '';
  item.text = '正在執行「' + pending.label + '」…';
  renderHistory(aiAvatarWidget);
  if (typeof aiAvatarWidget.optiopns.onToolCall === 'function') {
    aiAvatarWidget.optiopns.onToolCall(pending, aiAvatarWidget);
  }
}

export function cancelPendingTool(aiAvatarWidget, messageId) {
  const item = aiAvatarWidget.chatLog.find((m) => m.id === messageId);
  if (!item || !item.pendingTool) return;
  item.pendingTool = null;
  aiAvatarWidget.pendingToolConfirmation = '';
  item.text = '好的，已取消。';
  renderHistory(aiAvatarWidget);
  if (aiAvatarWidget.speechEngine.convoOn) {
    aiAvatarWidget.speechEngine.speak('好的，已取消。');
  }
}

export function continueToolConfirmation(aiAvatarWidget, text) {
  if (!aiAvatarWidget.pendingToolConfirmation) return false;
  const answer = String(text || '').trim();
  if (/^(確認|確定|執行|可以|好|好的|yes|ok)$/i.test(answer)) {
    executePendingTool(aiAvatarWidget, aiAvatarWidget.pendingToolConfirmation);
    return true;
  }
  if (/^(取消|不要|算了|否|no|cancel)$/i.test(answer)) {
    cancelPendingTool(aiAvatarWidget, aiAvatarWidget.pendingToolConfirmation);
    return true;
  }
  const prompt = '請說「確認」或「取消」，也可以點選按鈕。';
  addChatMessage(aiAvatarWidget, 'assistant', prompt, { source: 'tool' });
  aiAvatarWidget.speechEngine.speak(prompt);
  return true;
}

export function handleToolResult(aiAvatarWidget, d) {
  const text =
    d.ok === false
      ? '執行失敗：' + String(d.error || '未知錯誤')
      : String(d.message || '已完成。');
  const existing = aiAvatarWidget.chatLog.find((m) => m.id === d.callId);
  if (existing) {
    updateChatMessage(aiAvatarWidget, existing.id, text, false);
  } else {
    addChatMessage(aiAvatarWidget, 'assistant', text, { source: 'tool' });
  }
  aiAvatarWidget.speechEngine.speak(text);
}

// brain.js | speech.js
async function aiProviderLLMBrain(aiAvatarWidget = null, question) {
  try {
    aiAvatarWidget.speechEngine.spokenDisplayText = '讓我想想…';

    aiAvatarWidget.skinEngine.gestureName = 'thinking';

    const out = await aiAvatarWidget.brainEngine.aiProvider.chat(
      aiAvatarWidget.buildLLMMessages(aiAvatarWidget, question)
    );
    if (out.trim?.()) {
      return sayAnswer(aiAvatarWidget, out.trim());
    }
  } catch (e) {
    console.warn('AI Provider error', e);
  }
  // TODO: 這位置應該取不到 out 才對
  // throw new Error(
  //   `AI Provider did not return a string or returned an empty string: ${out}`
  // );
}

// ui.js
// 切換用：兩個皮都給(data-model + data-vrm) → 長出 2D/3D 切換鈕。
// 預設引擎：data-engine 優先；否則有明確 2D 皮就 2D、只有 3D 就 3D。
function initSkinModeChangeButton(aiAvatarWidget = null, has2D, has3D) {
  const engineButtonEl = aiAvatarWidget?.uiDom?.engineButtonEl;
  if (engineButtonEl instanceof HTMLElement === false) {
    console.error(
      '[aiAvatar initSkinModeChangeButton] engineButtonEl is not an HTMLElement'
    );
    return;
  }

  if (
    typeof has2D === 'string' &&
    has2D !== '' &&
    typeof has3D === 'string' &&
    has3D !== ''
  ) {
    // 兩個皮都給 → 顯示切換鈕，讓使用者即時切
    if (engineButtonEl instanceof HTMLElement) {
      engineButtonEl.style.display = '';
      engineButtonEl.onclick = () => {
        aiAvatarWidget.skinEngine.engineMode = ENGINE_MODE_MAP.threeDimensional
          ? ENGINE_MODE_MAP.twoDimensional
          : ENGINE_MODE_MAP.threeDimensional;
      };
    }
  }
}

// skin.js | speech.js
// 思索很久，考量到計算嘴型的位置是在 skin.js 中的一個動畫循環位置
// 而計算所需的核心數值卻是在 speech.js 中，因此放在整合檔內是目前的最佳解
// ===== 共用：每幀算出嘴巴開合 0..1（2D 寫 ParamMouthOpenY、3D 寫 aa 表情，共用同一套計算）=====
export function computeMouth(aiAvatarWidget = null) {
  if (
    aiAvatarWidget.speechEngine.isSpeaking &&
    aiAvatarWidget.speechEngine.useAudioMouth
  ) {
    aiAvatarWidget.speechEngine.mouthValue +=
      (aiAvatarWidget.speechEngine.audioMouth -
        aiAvatarWidget.speechEngine.mouthValue) *
      0.5; // 神經語音：跟真實音量精準對嘴
  } else if (aiAvatarWidget.speechEngine.isSpeaking) {
    const t = performance.now() / 1000;
    aiAvatarWidget.speechEngine.mouthValue =
      0.12 +
      0.83 *
        aiAvatarWidget.speechEngine.mouthTarget *
        Math.abs(Math.sin(t * 9)); // 瀏覽器語音：假開合
  } else {
    aiAvatarWidget.speechEngine.mouthValue = Math.max(
      0,
      aiAvatarWidget.speechEngine.mouthValue - 0.18
    );
  }
  return aiAvatarWidget.speechEngine.mouthValue;
}

// speech.js
// 串流版切句：state.buf 累積 token，切得出完整句就吐出（force＝收尾把殘句也吐）
function drainSentences(state, force) {
  const out = [];
  let i;
  while ((i = state.buf.search(/[。！？!?；;\n…]/)) >= 0) {
    const s = state.buf.slice(0, i + 1).trim();
    state.buf = state.buf.slice(i + 1);
    if (s) {
      out.push(s);
    }
  }
  if (force && state.buf.trim()) {
    out.push(state.buf.trim());
    state.buf = '';
  }
  return out;
}

// speech.js | brain.js
// 共用：檢索到的資料 + 問題 → 給 llm 的訊息（Ollama 與 WebLLM 共用同一套 RAG 提示）
function defaultBuildLLMMessages(aiAvatarWidget = null, question) {
  const context = topK(aiAvatarWidget, question, 3)
    .map((e) => 'Q：' + e.q + '\nA：' + e.a)
    .join('\n---\n');
  const RAG =
    '優先依據【參考資料】回答；資料沒有的就用常識簡短回應，不確定就老實說不知道。\n\n【參考資料】\n' +
    (context || '（無）');
  const systemContext =
    aiAvatarWidget?.avatarMode === AVATAR_MODE_MAP.companion
      ? '你是這個網站的陪伴型語音虛擬人，親切、口語、繁體中文、每次最多兩三句。你記得訪客先前的對話' +
        (aiAvatarWidget?.brainEngine?.mem?.data?.name
          ? '，訪客叫「' +
            aiAvatarWidget.brainEngine.mem.data.name +
            '」，可自然稱呼'
          : '') +
        '。' +
        RAG
      : '你是「可嵌入任何網站的語音虛擬人元件」的示範助手。主題是教人「怎麼把這個元件裝到自己的網站、怎麼換成自己的角色、怎麼使用」。請用繁體中文、口語、最多兩三句話簡短回答。' +
        RAG;
  const msgs = [{ role: 'system', content: systemContext }];
  if (aiAvatarWidget?.brainEngine?.mem?.isCompanion === true) {
    for (const h of aiAvatarWidget.brainEngine.mem.data.history) {
      msgs.push({ role: h.role, content: h.content });
    }
  }
  msgs.push({ role: 'user', content: question });
  return msgs;
}

// speech.js
// 中止目前正在講的（逐句佇列 + 神經語音音檔 + 瀏覽器 TTS + 對嘴），給「點第二下打斷第一下」用
function stopSpeaking(aiAvatarWidget = null) {
  aiAvatarWidget.speechEngine.speakSeq++; // 作廢所有在跑的逐句鏈（pump 看序號就會停）
  aiAvatarWidget.speechEngine.speechQ = [];
  aiAvatarWidget.speechEngine.speechEnded = true;
  aiAvatarWidget.speechEngine.isSpeechPlaying = false;
  try {
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
  } catch (_error) {}
  try {
    clearTimeout(aiAvatarWidget.speechEngine.speakBrowserTimer);
  } catch (_error) {}
  if (
    typeof aiAvatarWidget.speechEngine.currentFps === 'number' &&
    aiAvatarWidget.speechEngine.currentFps > 0
  ) {
    cancelAnimationFrame(aiAvatarWidget.speechEngine.currentFps);
    aiAvatarWidget.speechEngine.currentFps = 0;
  }
  if (aiAvatarWidget.speechEngine.currentSource) {
    try {
      aiAvatarWidget.speechEngine.currentSource.onended = null;
      aiAvatarWidget.speechEngine.currentSource.stop();
    } catch (_error) {}
    aiAvatarWidget.speechEngine.currentSource = null;
  }
  aiAvatarWidget.speechEngine.isSpeaking = false;
  aiAvatarWidget.speechEngine.useAudioMouth = false;
  aiAvatarWidget.speechEngine.audioMouth = 0;

  aiAvatarWidget.skinEngine.gestureName = 'neutral';
}

// speech.js
// 對外入口：整段文字 → 切句進逐句佇列（②講第 1 句時預抓第 2 句 → 長答案幾乎立刻開口）
function speak(aiAvatarWidget = null, text, options) {
  const rootContainer = aiAvatarWidget?.container;
  if (rootContainer instanceof HTMLElement === false) {
    console.error(
      '[aiAvatar speak] aiAvatarWidget.container is not an HTMLElement'
    );
    return;
  }

  if (aiAvatarWidget.speechEngine.ttsMuted === true) {
    onUtteranceEnd(aiAvatarWidget); // 靜音：沒語音可收尾，直接觸發對話迴圈 hook
    return;
  }

  const sid = beginSpeech(aiAvatarWidget);
  aiAvatarWidget.setEmotionFromText(text); // ①講話帶情緒（3D 表情；要在 beginSpeech 之後，不然被 reset）
  for (const sentences of splitSentences(text)) {
    pushSpeech(aiAvatarWidget, sid, sentences, options);
  }
  endSpeech(aiAvatarWidget, sid);
}

// speech.js
// ===== ②逐句開講引擎：一次一個 session；句子依序講，神經語音在背景先抓下一句 =====
function beginSpeech(aiAvatarWidget = null) {
  stopSpeaking(aiAvatarWidget); // 打斷上一段（含清佇列、表情回中性）
  aiAvatarWidget.speechEngine.assistantSpeechStartedAt = performance.now();
  if (aiAvatarWidget.speechEngine.convoOn) {
    aiAvatarWidget.uiDom.updateVoiceStatus(
      aiAvatarWidget.speechEngine.convoOn,
      '正在回答，可以直接插話…',
      'speaking',
      0
    );
  }
  aiAvatarWidget.speechEngine.speechQ = [];
  aiAvatarWidget.speechEngine.speechEnded = false;
  aiAvatarWidget.speechEngine.isSpeechPlaying = false;
  aiAvatarWidget.speechEngine.tapDone = false;
  return ++aiAvatarWidget.speechEngine.speakSeq;
}
// speech.js
function pushSpeech(aiAvatarWidget = null, sid, text, options) {
  if (sid !== aiAvatarWidget.speechEngine.speakSeq) {
    return;
  }
  const safeText = String(text || '').trim();
  if (!safeText) {
    return;
  }
  aiAvatarWidget.speechEngine.speechQ.push({
    text: safeText,
    prep: null,
    err: null,
    instant: !!(options && options.instant)
  });
  prefetchSpeech(aiAvatarWidget, sid);
  pumpSpeech(aiAvatarWidget, sid);
}
// speech.js
function endSpeech(aiAvatarWidget = null, sid) {
  if (sid === aiAvatarWidget.speechEngine.speakSeq) {
    aiAvatarWidget.speechEngine.speechEnded = true;
    // aiAvatarWidget.speechEngine.spokenDisplayText = "";
    aiAvatarWidget.skinEngine.emo.target = 0;
    pumpSpeech(aiAvatarWidget, sid);
  }
}

// speech.js
function onUtteranceEnd(aiAvatarWidget = null) {
  aiAvatarWidget.speechEngine.isProcessing = false;
  if (
    aiAvatarWidget.speechEngine.convoOn === true &&
    aiAvatarWidget.avatarMode === AVATAR_MODE_MAP.companion
  ) {
    aiAvatarWidget.uiDom.updateVoiceStatus(
      aiAvatarWidget.speechEngine.convoOn,
      '準備繼續聆聽…',
      'thinking',
      0
    );
    setTimeout(() => {
      if (
        aiAvatarWidget.speechEngine.convoOn === true &&
        aiAvatarWidget.speechEngine.isListening === false &&
        aiAvatarWidget.speechEngine.isSpeaking === false &&
        aiAvatarWidget.speechEngine.isSpeechPlaying === false
      ) {
        aiAvatarWidget.speechEngine.noSpeechRuns = 0;
        startListening(aiAvatarWidget);
      }
    }, 450);
  } else {
    stopVoiceSession(aiAvatarWidget);
  }
}

// ui.js
// 範例提示清單：一進站就告訴使用者「可以說什麼」，點任一項＝直接問（語音/打字都不用先猜）
function renderSuggestions(aiAvatarWidget = null) {
  const suggestions = aiAvatarWidget.uiDom.suggestionsEl;
  if (suggestions instanceof HTMLElement === false) {
    console.warn(
      '[aiAvatar renderSuggestions] aiAvatarWidget.suggestionsEl is not an HTMLElement'
    );
    return;
  }

  const SUGGESTIONS =
    Array.isArray(aiAvatarWidget.suggestedQuestions) &&
    aiAvatarWidget.suggestedQuestions.length > 0
      ? aiAvatarWidget.suggestedQuestions
      : aiAvatarWidget.avatarMode === AVATAR_MODE_MAP.companion
        ? Array.isArray(aiAvatarWidget.companionSuggestedQuestions) &&
          aiAvatarWidget.companionSuggestedQuestions.length > 0
          ? aiAvatarWidget.companionSuggestedQuestions
          : ['今天過得好嗎？', '跟我聊聊天', '說個笑話', '你會記得我嗎？']
        : Array.isArray(aiAvatarWidget.assistantSuggestedQuestions) &&
            aiAvatarWidget.assistantSuggestedQuestions.length > 0
          ? aiAvatarWidget.assistantSuggestedQuestions
          : [
              '怎麼安裝？',
              '怎麼換成我的角色？',
              '要不要錢？',
              '麥克風怎麼用？',
              '我可以說什麼？'
            ];

  const label = document.createElement('p');
  label.classList.add('sg-label');
  label.textContent =
    aiAvatarWidget.suggestedTitle ||
    (aiAvatarWidget.avatarMode === AVATAR_MODE_MAP.companion
      ? aiAvatarWidget.companionSuggestedTitle || '💬 可以跟我聊：'
      : aiAvatarWidget.assistantSuggestedTitle || '💬 你可以問我：');

  suggestions.appendChild(label);
  SUGGESTIONS.forEach((suggestion) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.classList.add('sugg');
    button.textContent = suggestion;
    button.onclick = () => {
      handleUser(aiAvatarWidget, suggestion.replace(/？$/, ''));
    };
    suggestions.appendChild(button);
  });
}

// ui.js
// 打字輸入：Enter 或 ➤ 送出。組字中（注音/拼音選字）按的 Enter 不送，避免誤發半成品
function bindTyping(aiAvatarWidget = null) {
  const typeInput = aiAvatarWidget?.uiDom?.questionInputEl;
  if (typeInput instanceof HTMLElement === false) {
    console.error(
      '[aiAvatar bindTyping] aiAvatarWidget?.uiDom?.questionInputEl is not an HTMLElement'
    );
    return;
  }

  const send = () => {
    const text = typeInput.value.trim();
    if (typeof text !== 'string' || text === '') {
      return;
    }
    typeInput.value = '';
    handleUser(aiAvatarWidget, text);
  };
  aiAvatarWidget.uiDom.sendButtonEl.onclick = send;
  typeInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.isComposing && event.keyCode !== 229) {
      event.preventDefault();
      send();
    }
  });
}

// speech.js
async function pumpSpeech(aiAvatarWidget = null, sid) {
  if (
    aiAvatarWidget.speechEngine.isSpeechPlaying ||
    sid !== aiAvatarWidget.speechEngine.speakSeq
  ) {
    return;
  }
  const item = aiAvatarWidget.speechEngine.speechQ.shift();
  if (!item) {
    if (aiAvatarWidget.speechEngine.speechEnded) {
      aiAvatarWidget.skinEngine.gestureName = 'neutral';
      onUtteranceEnd(aiAvatarWidget);
    }
    return;
  } // 整段講完 → 表情回中性＋(陪伴)重開麥
  aiAvatarWidget.speechEngine.isSpeechPlaying = true;
  const done = () => {
    if (sid !== aiAvatarWidget.speechEngine.speakSeq) {
      return;
    }
    aiAvatarWidget.speechEngine.isSpeechPlaying = false;
    prefetchSpeech(aiAvatarWidget, sid);
    pumpSpeech(aiAvatarWidget, sid);
  };

  if (
    item.instant &&
    item.text === getGreetingText(aiAvatarWidget) &&
    !aiAvatarWidget.speechEngine.tapGreetingBuffer
  ) {
    preloadTapGreeting(aiAvatarWidget);
    speakBrowserChunk(aiAvatarWidget, item.text, sid, done);
    return;
  }

  let buf = null;
  if (!aiAvatarWidget.speechEngine.neuralDisabled && !item.err) {
    if (!item.prep) {
      item.prep = fetchTTSBuffer(aiAvatarWidget, item.text).catch((e) => {
        item.err = e;
        return null;
      });
    }
    buf = await item.prep;
  }
  if (sid !== aiAvatarWidget.speechEngine.speakSeq) {
    return; // 等音檔期間被新的說話打斷 → 整條放棄
  }
  if (buf) {
    prefetchSpeech(aiAvatarWidget, sid);
    playBuffer(aiAvatarWidget, buf, done);
  } else {
    if (item.err) {
      handleNeuralFail(aiAvatarWidget, item.err);
    }
    speakBrowserChunk(aiAvatarWidget, item.text, sid, done);
  }
}

// brain.js | speech.js
async function webLLMBrain(aiAvatarWidget = null, question) {
  try {
    aiAvatarWidget.speechEngine.spokenDisplayText = '讓我想想…';

    aiAvatarWidget.skinEngine.gestureName = 'thinking';

    const sid = aiAvatarWidget.speechEngine.ttsMuted
      ? 0
      : beginSpeech(aiAvatarWidget); // 靜音時只更新字幕、不進語音佇列
    const st = { buf: '' };
    const streamMessageId = 'stream-' + Date.now();
    const out = await aiAvatarWidget.brainEngine.llm.chat(
      aiAvatarWidget.buildLLMMessages(aiAvatarWidget, question),
      (delta, sofar) => {
        aiAvatarWidget.speechEngine.spokenDisplayText = sofar; // 邊生成邊更新字幕
        updateChatMessage(aiAvatarWidget, streamMessageId, sofar, true);
        if (sid) {
          if (sid !== aiAvatarWidget.speechEngine.speakSeq) {
            return; // 中途被打斷 → 剩下的只當字幕
          }
          aiAvatarWidget.setEmotionFromText(sofar);
          st.buf += delta;
          for (const s of drainSentences(st, false)) {
            pushSpeech(aiAvatarWidget, sid, s);
          }
        }
      }
    );
    if (out?.trim?.()) {
      aiAvatarWidget.brainEngine.mem.addTurn('assistant', out.trim());
      updateChatMessage(aiAvatarWidget, streamMessageId, out.trim(), false);
      if (sid && sid === aiAvatarWidget.speechEngine.speakSeq) {
        for (const s of drainSentences(st, true)) {
          pushSpeech(aiAvatarWidget, sid, s);
        }
        endSpeech(aiAvatarWidget, sid);
      } else if (!sid) {
        onUtteranceEnd(aiAvatarWidget); // 靜音：沒有語音收尾 → 手動觸發對話迴圈 hook
      }
      if (typeof aiAvatarWidget?.speechEngine.onSpeakingEnd === 'function') {
        aiAvatarWidget.speechEngine.onSpeakingEnd(out.trim(), aiAvatarWidget);
      }
      return;
    }
    if (sid) {
      endSpeech(aiAvatarWidget, sid); // 空回答：收掉這條 session，往下走檢索
    }
  } catch (e) {
    console.warn('llm error', e);
  }

  // TODO: 這位置應該取不到 out 才對
  // throw new Error(
  //   `WebLLM did not return a string or returned an empty string: ${out}`
  // );
}

// speech.js | brain.js
// 有大腦時生成更自然的回答；WebLLM 走串流「邊生成邊講」，Ollama／檢索為整段後逐句講
function sayAnswer(aiAvatarWidget = null, t) {
  aiAvatarWidget.brainEngine.mem.addTurn('assistant', t);
  addChatMessage(aiAvatarWidget, 'assistant', t);
  aiAvatarWidget.speechEngine.spokenAudioText = t;
}
// speech.js | brain.js
// 回答統一走這：陪伴模式順手寫進記憶
async function handleAnswer(aiAvatarWidget = null, question) {
  const safeQuestion = (question || '').trim();
  if (!safeQuestion) {
    aiAvatarWidget.speechEngine.spokenAudioText =
      '我好像沒聽清楚，可以再說一次嗎？';
    return;
  }
  try {
    // 1) AI 伺服器大腦（最聰明，優先；整段生成後逐句講）
    if (
      aiAvatarWidget.brainEngine.aiProvider?.enabled &&
      aiAvatarWidget.brainEngine.aiProvider.ready
    ) {
      return await aiProviderLLMBrain(aiAvatarWidget, question);
    }
    // 2) 瀏覽器內 WebLLM：串流 → 每切出一個完整句就丟進逐句佇列開講（首句延遲大幅縮短）
    if (
      aiAvatarWidget.brainEngine.llm?.state === aiAvatarWidget.STATE_MAP.READY
    ) {
      return await webLLMBrain(aiAvatarWidget, question);
    }
  } catch (_error) {
    console.error(_error);
  }

  // 3) 檢索式後備（零金鑰、永遠可用）
  sayAnswer(aiAvatarWidget, handleThinking(aiAvatarWidget, safeQuestion));
}

// speech.js | brain.js
async function handleUser(aiAvatarWidget = null, text = '') {
  const rootContainer = aiAvatarWidget?.container;
  if (rootContainer instanceof HTMLElement === false) {
    console.error('[aiAvatar handleUser] rootContainer is not an HTMLElement');
    return;
  }

  if (typeof text === 'string' && text !== '') {
    addChatMessage(aiAvatarWidget, 'user', text);
    aiAvatarWidget.speechEngine.spokenDisplayText = '你：' + text;
  }

  if (
    text &&
    aiAvatarWidget.pendingToolConfirmation &&
    continueToolConfirmation(aiAvatarWidget, text)
  )
    return;
  if (
    text &&
    aiAvatarWidget.pendingToolChoice &&
    continueToolChoice(aiAvatarWidget, text)
  )
    return;
  if (
    text &&
    aiAvatarWidget.pendingToolInput &&
    continueToolInput(aiAvatarWidget, text)
  )
    return;

  if (aiAvatarWidget.brainEngine.mem.isCompanion && text) {
    if (/忘記我|清除記憶|forget me/i.test(text)) {
      aiAvatarWidget.brainEngine.mem.wipe();
      aiAvatarWidget.speechEngine.spokenAudioText =
        '好，我把記憶都清掉了，我們重新認識吧！';
      return;
    }
    aiAvatarWidget.brainEngine.mem.captureName(text);
    aiAvatarWidget.brainEngine.mem.addTurn('user', text);
  }

  const routedTool = routeHostTool(aiAvatarWidget, text);
  if (routedTool.ambiguous && routedTool.ambiguous.length) {
    aiAvatarWidget.speechEngine.isProcessing = false;
    offerToolChoices(aiAvatarWidget, text, routedTool.ambiguous);
    return;
  }
  if (routedTool.match) {
    aiAvatarWidget.speechEngine.isProcessing = false;
    prepareTool(
      aiAvatarWidget,
      routedTool.match.tool,
      text,
      { confidence: routedTool.match.score, reason: routedTool.match.reason },
      {}
    );
    return;
  }

  // aiAvatarWidget.speechEngine.isSpeaking = true;
  aiAvatarWidget.speechEngine.isProcessing = true; // 回答完成前不要自動重開麥（onUtteranceEnd 會清）

  if (
    aiAvatarWidget.skinEngine &&
    aiAvatarWidget.skinEngine.gestureName !== undefined
  ) {
    aiAvatarWidget.skinEngine.gestureName = 'thinking';
  }

  handleAnswer(aiAvatarWidget, text);
}

export async function ensureMicMonitor(aiAvatarWidget) {
  if (aiAvatarWidget.speechEngine.micStream) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)
    throw new Error('media-not-supported');

  aiAvatarWidget.speechEngine.micStream =
    await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    });
  aiAvatarWidget.speechEngine.micAudioCtx = new (
    window.AudioContext || window.webkitAudioContext
  )();
  if (aiAvatarWidget.speechEngine.micAudioCtx.state === 'suspended') {
    try {
      await aiAvatarWidget.speechEngine.micAudioCtx.resume();
    } catch (_e) {}
  }

  aiAvatarWidget.speechEngine.micAnalyser =
    aiAvatarWidget.speechEngine.micAudioCtx.createAnalyser();
  aiAvatarWidget.speechEngine.micAnalyser.fftSize = 256;
  aiAvatarWidget.speechEngine.micAnalyser.smoothingTimeConstant = 0.35;
  aiAvatarWidget.speechEngine.micAudioCtx
    .createMediaStreamSource(aiAvatarWidget.speechEngine.micStream)
    .connect(aiAvatarWidget.speechEngine.micAnalyser);
  aiAvatarWidget.speechEngine.micData = new Uint8Array(
    aiAvatarWidget.speechEngine.micAnalyser.fftSize
  );

  aiAvatarWidget.speechEngine.micNoiseFloor = 0;
  aiAvatarWidget.speechEngine.voiceFrames = 0;
  aiAvatarWidget.speechEngine.lastBargeIn = 0;

  monitorMicLevel(aiAvatarWidget);
}

export function monitorMicLevel(aiAvatarWidget) {
  if (
    !aiAvatarWidget.speechEngine.micAnalyser ||
    !aiAvatarWidget.speechEngine.micData
  ) {
    return;
  }
  aiAvatarWidget.speechEngine.micAnalyser.getByteTimeDomainData(
    aiAvatarWidget.speechEngine.micData
  );
  let sum = 0;
  for (let i = 0; i < aiAvatarWidget.speechEngine.micData.length; i++) {
    const value = (aiAvatarWidget.speechEngine.micData[i] - 128) / 128;
    sum += value * value;
  }
  const rms = Math.sqrt(sum / aiAvatarWidget.speechEngine.micData.length);

  const isSpeaking =
    aiAvatarWidget.speechEngine.isSpeaking ||
    aiAvatarWidget.speechEngine.isSpeechPlaying;
  const isListening = aiAvatarWidget.speechEngine.isListening;
  const assistantActive =
    isSpeaking || aiAvatarWidget.speechEngine.isProcessing;

  if (!assistantActive && !isListening) {
    aiAvatarWidget.speechEngine.micNoiseFloor =
      aiAvatarWidget.speechEngine.micNoiseFloor * 0.96 + rms * 0.04;
  }

  const showVoiceUI =
    aiAvatarWidget.speechEngine.convoOn || isListening || assistantActive;

  aiAvatarWidget.uiDom.updateVoiceStatus(
    showVoiceUI,
    aiAvatarWidget.uiDom.voiceStatusEl?.textContent,
    isListening ? 'listening' : isSpeaking ? 'speaking' : 'thinking',
    rms * 650
  );

  const threshold = Math.max(
    0.085,
    aiAvatarWidget.speechEngine.micNoiseFloor * 5.5
  );
  const speechDuration =
    performance.now() -
    (aiAvatarWidget.speechEngine.assistantSpeechStartedAt || performance.now());

  if (
    aiAvatarWidget.speechEngine.convoOn &&
    assistantActive &&
    speechDuration > 550 &&
    rms > threshold
  ) {
    aiAvatarWidget.speechEngine.voiceFrames++;
  } else {
    aiAvatarWidget.speechEngine.voiceFrames = Math.max(
      0,
      (aiAvatarWidget.speechEngine.voiceFrames || 0) - 2
    );
  }

  if (
    aiAvatarWidget.speechEngine.voiceFrames >= 9 &&
    performance.now() - aiAvatarWidget.speechEngine.lastBargeIn > 1400
  ) {
    interruptForVoice(aiAvatarWidget);
  }

  aiAvatarWidget.speechEngine.micRaf = requestAnimationFrame(() =>
    monitorMicLevel(aiAvatarWidget)
  );
}

export function stopMicMonitor(aiAvatarWidget) {
  if (aiAvatarWidget.speechEngine.micRaf)
    cancelAnimationFrame(aiAvatarWidget.speechEngine.micRaf);
  aiAvatarWidget.speechEngine.micRaf = 0;

  if (aiAvatarWidget.speechEngine.micStream) {
    aiAvatarWidget.speechEngine.micStream
      .getTracks()
      .forEach((track) => track.stop());
  }
  aiAvatarWidget.speechEngine.micStream = null;
  aiAvatarWidget.speechEngine.micAnalyser = null;
  aiAvatarWidget.speechEngine.micData = null;

  if (aiAvatarWidget.speechEngine.micAudioCtx) {
    try {
      aiAvatarWidget.speechEngine.micAudioCtx.close();
    } catch (_e) {}
  }
  aiAvatarWidget.speechEngine.micAudioCtx = null;
  if (aiAvatarWidget.uiDom.voiceLevelEl)
    aiAvatarWidget.uiDom.voiceLevelEl.style.width = '0';
}

export function stopVoiceSession(aiAvatarWidget, message) {
  aiAvatarWidget.speechEngine.convoOn = false;
  clearTimeout(aiAvatarWidget.speechEngine.recognitionSilenceTimer);
  aiAvatarWidget.speechEngine.recognitionText = '';
  aiAvatarWidget.speechEngine.recognitionSubmitted = true;
  aiAvatarWidget.speechEngine.recognitionError = 'aborted';
  try {
    if (typeof aiAvatarWidget.speechEngine?.recognition?.abort === 'function') {
      aiAvatarWidget.speechEngine.recognition.abort();
    }
  } catch (_error) {}
  aiAvatarWidget.speechEngine.recognition = null;
  aiAvatarWidget.speechEngine.isListening = false;
  setMic(aiAvatarWidget, false);
  stopMicMonitor(aiAvatarWidget);

  aiAvatarWidget.uiDom.updateVoiceStatus(false, '', '', 0);
  if (message) {
    aiAvatarWidget.speechEngine.spokenDisplayText = message;
  }
}

export function interruptForVoice(aiAvatarWidget) {
  aiAvatarWidget.speechEngine.lastBargeIn = performance.now();
  aiAvatarWidget.speechEngine.voiceFrames = 0;

  aiAvatarWidget.speechEngine.speakSeq++;
  if (
    typeof aiAvatarWidget.brainEngine?.llm?.controller?.abort === 'function'
  ) {
    try {
      aiAvatarWidget.brainEngine.llm.controller.abort();
    } catch (_error) {}
  }

  stopSpeaking(aiAvatarWidget);
  aiAvatarWidget.speechEngine.isProcessing = false;

  aiAvatarWidget.uiDom.updateVoiceStatus(
    aiAvatarWidget.speechEngine.convoOn,
    '已停止回答，請繼續說…',
    'listening',
    0
  );

  setTimeout(() => {
    if (
      aiAvatarWidget.speechEngine.convoOn &&
      !aiAvatarWidget.speechEngine.isListening
    ) {
      startListening(aiAvatarWidget);
    }
  }, 100);
}

// ===== STT：聽你說話 =====
function setMic(aiAvatarWidget = null, isListening = false) {
  const rootContainer = aiAvatarWidget?.container;
  if (rootContainer instanceof HTMLElement === false) {
    console.error('[aiAvatar setMic] rootContainer is not an HTMLElement');
    return;
  }

  const btnMic = aiAvatarWidget.uiDom.micButtonEl;
  if (isListening === true) {
    btnMic.setAttribute('css-state', 'listening');
  } else {
    btnMic.removeAttribute('css-state');
  }

  const convoOn = aiAvatarWidget.speechEngine.convoOn;
  btnMic.setAttribute('aria-pressed', String(!!convoOn));

  btnMic.textContent =
    isListening === true
      ? aiAvatarWidget.avatarMode === aiAvatarWidget.AVATAR_MODE_MAP.companion
        ? '● 對話中'
        : '● 聆聽中'
      : convoOn
        ? '◌ 對話中'
        : '🎙️ 即時';

  const suggestions = aiAvatarWidget.uiDom.suggestionsEl;
  if (suggestions instanceof HTMLElement) {
    suggestions.style.display = isListening || convoOn ? 'none' : 'flex';
  } // 聆聽中收起清單
}

// speech.js | brain.js
async function startListening(aiAvatarWidget = null) {
  const rootContainer = aiAvatarWidget?.container;
  if (rootContainer instanceof HTMLElement === false) {
    console.error(
      '[aiAvatar startListening] rootContainer is not an HTMLElement'
    );
    return;
  }

  const SafeSpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SafeSpeechRecognition) {
    aiAvatarWidget.speechEngine.spokenAudioText =
      '你的瀏覽器不支援語音辨識，建議用 Chrome 開喔。';
    aiAvatarWidget.speechEngine.convoOn = false;
    return;
  }
  if (
    aiAvatarWidget.speechEngine.isListening &&
    aiAvatarWidget.speechEngine.recognition
  ) {
    aiAvatarWidget.speechEngine.recognition.stop();
    return;
  }

  if (!aiAvatarWidget.speechEngine.micStream) {
    setMic(aiAvatarWidget, false);
    aiAvatarWidget.uiDom.updateVoiceStatus(
      true,
      '正在取得麥克風權限…',
      'thinking',
      0
    );
  }
  try {
    await ensureMicMonitor(aiAvatarWidget);
    if (
      aiAvatarWidget.speechEngine.isSpeechPlaying ||
      aiAvatarWidget.speechEngine.isProcessing
    ) {
      stopSpeaking(aiAvatarWidget);
    }
  } catch (e) {
    aiAvatarWidget.speechEngine.convoOn = false;
    setMic(aiAvatarWidget, false);
    const message = '無法啟動語音功能，請檢查麥克風與瀏覽器設定。';
    aiAvatarWidget.speechEngine.spokenAudioText = message;
    aiAvatarWidget.uiDom.updateVoiceStatus(true, message, '', 0);
    console.warn('mic monitor error', e);
    return;
  }

  try {
    aiAvatarWidget.speechEngine.recognition = new SafeSpeechRecognition();
  } catch (error) {
    aiAvatarWidget.speechEngine.spokenAudioText =
      '語音辨識啟動失敗：' + error.message;
    aiAvatarWidget.speechEngine.convoOn = false;
    return;
  }

  aiAvatarWidget.speechEngine.recognitionSilenceTimer = null;
  aiAvatarWidget.speechEngine.recognition.lang = 'zh-TW';
  aiAvatarWidget.speechEngine.recognition.interimResults = true;
  aiAvatarWidget.speechEngine.recognition.continuous = true;
  aiAvatarWidget.speechEngine.recognition.maxAlternatives = 1;
  aiAvatarWidget.speechEngine.recognition.onstart = () => {
    aiAvatarWidget.speechEngine.isListening = true;
    setMic(aiAvatarWidget, true);
    aiAvatarWidget.uiDom.updateVoiceStatus(
      true,
      '請說話，可以隨時插話…',
      'listening',
      0
    );
  };
  aiAvatarWidget.speechEngine.recognition.onresult = (event) => {
    let finalText = '',
      interimText = '';
    for (const result of event.results) {
      if (result.isFinal) finalText += result[0].transcript + ' ';
      else interimText += result[0].transcript + ' ';
    }
    const txt = (finalText + interimText).trim();
    if (!txt) return;

    aiAvatarWidget.speechEngine.noSpeechRuns = 0;
    aiAvatarWidget.speechEngine.spokenDisplayText =
      '你：' + txt + (interimText ? '…' : '');
    aiAvatarWidget.uiDom.updateVoiceStatus(
      aiAvatarWidget.speechEngine.convoOn,
      interimText ? '正在辨識：' + txt : '收到語音，準備送出…',
      'listening',
      0
    );

    clearTimeout(aiAvatarWidget.speechEngine.recognitionSilenceTimer);
    aiAvatarWidget.speechEngine.recognitionSilenceTimer = setTimeout(
      () => {
        try {
          if (aiAvatarWidget.speechEngine.recognition)
            aiAvatarWidget.speechEngine.recognition.stop();
        } catch (_error) {}
      },
      interimText ? 900 : 420
    );

    const last = event.results[event.results.length - 1];
    if (last.isFinal) {
      handleUser(aiAvatarWidget, txt);
    }
  };
  aiAvatarWidget.speechEngine.recognition.onerror = (event) => {
    aiAvatarWidget.speechEngine.isListening = false;
    setMic(aiAvatarWidget, false);
    if (event.error === 'not-allowed') {
      aiAvatarWidget.speechEngine.convoOn = false;
      aiAvatarWidget.speechEngine.spokenDisplayText =
        '我需要麥克風權限才能聽你說話喔。';
      stopMicMonitor(aiAvatarWidget);
      aiAvatarWidget.uiDom.updateVoiceStatus(true, '麥克風權限被拒絕', '', 0);
      return;
    }
    if (event.error === 'aborted') {
      return; // 手動中止不需顯示錯誤，保留 stopVoiceSession 寫入的文字
    }
    if (
      aiAvatarWidget.speechEngine.convoOn === true &&
      event.error === 'no-speech'
    ) {
      return; // 交給 onend 的續聽邏輯
    }

    aiAvatarWidget.speechEngine.spokenDisplayText =
      '沒聽清楚（' + event.error + '），再試一次。';
  };
  aiAvatarWidget.speechEngine.recognition.onend = () => {
    aiAvatarWidget.speechEngine.isListening = false;
    setMic(aiAvatarWidget, false);
    // 連續對話：靜默結束（沒觸發回答）→ 自動再聽；連 3 次沒聲音就休息，避免無限開麥
    if (
      aiAvatarWidget.speechEngine.convoOn === true &&
      !aiAvatarWidget.speechEngine.isProcessing &&
      !aiAvatarWidget.speechEngine.isSpeaking &&
      !aiAvatarWidget.speechEngine.isSpeechPlaying
    ) {
      if (++aiAvatarWidget.speechEngine.noSpeechRuns >= 3) {
        stopVoiceSession(
          aiAvatarWidget,
          '連續幾次沒有聽到聲音，即時對話已暫停。'
        );
        return;
      }
      setTimeout(() => {
        if (
          aiAvatarWidget.speechEngine.convoOn === true &&
          !aiAvatarWidget.speechEngine.isListening &&
          !aiAvatarWidget.speechEngine.isSpeaking &&
          !aiAvatarWidget.speechEngine.isSpeechPlaying &&
          !aiAvatarWidget.speechEngine.isProcessing
        ) {
          startListening(aiAvatarWidget);
        }
      }, 350);
    }
  };
  try {
    aiAvatarWidget.speechEngine.recognition.start();
  } catch (_error) {}
}

// speech.js | brain.js | skin.js
// TODO: onTap 留在這份檔案，畢竟有複雜交互的邏輯，但是內部的邏輯要再深入研究是否應該細部拆分出去
// onTap 內主要就呼叫那些被細拆的邏輯
function onTap(aiAvatarWidget = null) {
  if (
    typeof aiAvatarWidget !== 'object' ||
    aiAvatarWidget === null ||
    aiAvatarWidget?.onTapTimer === true
  ) {
    return; // 去抖：hit 事件與 pointerdown 可能同時觸發
  }
  aiAvatarWidget.onTapTimer = true;
  setTimeout(() => {
    aiAvatarWidget.onTapTimer = false;
  }, 400);
  if (aiAvatarWidget.skinEngine.avatarModel) {
    try {
      aiAvatarWidget.skinEngine.avatarModel.motion('Tap');
    } catch (_error) {}
  }

  let greeting = '你好～';

  if (typeof aiAvatarWidget.speechEngine.greeting === 'function') {
    greeting = aiAvatarWidget.speechEngine.greeting(
      {
        isCompanion: aiAvatarWidget.brainEngine.mem.isCompanion,
        visits: aiAvatarWidget.brainEngine.mem.data.visits,
        name: aiAvatarWidget.brainEngine.mem.data.name
      },
      aiAvatarWidget
    );
  } else if (typeof aiAvatarWidget.speechEngine.greeting === 'string') {
    greeting = aiAvatarWidget.speechEngine.greeting;
  } else if (aiAvatarWidget.avatarMode === AVATAR_MODE_MAP.companion) {
    greeting =
      (aiAvatarWidget.brainEngine.mem.data.name
        ? aiAvatarWidget.brainEngine.mem.data.name + '～'
        : '你好～') + '想聊什麼都可以，點 💬 我們就開始！';

    if (typeof aiAvatarWidget.speechEngine.companionGreeting === 'function') {
      greeting = aiAvatarWidget.speechEngine.companionGreeting(
        {
          isCompanion: aiAvatarWidget.brainEngine.mem.isCompanion,
          visits: aiAvatarWidget.brainEngine.mem.data.visits,
          name: aiAvatarWidget.brainEngine.mem.data.name
        },
        aiAvatarWidget
      );
    } else if (
      typeof aiAvatarWidget.speechEngine.companionGreeting === 'string'
    ) {
      greeting = aiAvatarWidget.speechEngine.companionGreeting;
    }
  } else if (aiAvatarWidget.avatarMode === AVATAR_MODE_MAP.assistant) {
    greeting =
      '你好～我是可以嵌入任何網站的語音虛擬人，問我怎麼安裝、怎麼換成你的角色都行！';

    if (typeof aiAvatarWidget.speechEngine.assistantGreeting === 'function') {
      greeting = aiAvatarWidget.speechEngine.assistantGreeting(
        {
          isCompanion: aiAvatarWidget.brainEngine.mem.isCompanion,
          visits: aiAvatarWidget.brainEngine.mem.data.visits,
          name: aiAvatarWidget.brainEngine.mem.data.name
        },
        aiAvatarWidget
      );
    } else if (
      typeof aiAvatarWidget.speechEngine.assistantGreeting === 'string'
    ) {
      greeting = aiAvatarWidget.speechEngine.assistantGreeting;
    }
  }

  aiAvatarWidget.speechEngine.spokenAudioText = greeting;
}

// ui.js
export function bindUiEvent(aiAvatarWidget = null) {
  const uiDom = aiAvatarWidget?.uiDom || {};

  if (uiDom.minimalEl instanceof HTMLElement) {
    uiDom.minimalEl.onclick = function () {
      aiAvatarWidget.isMinimal = false;
    };
  }

  // ===== 控制列 =====
  if (uiDom.closeButtonEl instanceof HTMLElement) {
    uiDom.closeButtonEl.onclick = () => {
      if (aiAvatarWidget.isIframe === true) {
        aiAvatarWidget.onMinimalTrigger(true, aiAvatarWidget);
      } else {
        aiAvatarWidget.isMinimal = true;
      }
    };
  }

  if (uiDom.micButtonEl instanceof HTMLElement) {
    uiDom.micButtonEl.onclick = () => {
      if (aiAvatarWidget.avatarMode !== 'companion') {
        const isActive =
          aiAvatarWidget.speechEngine.isListening ||
          aiAvatarWidget.speechEngine.isProcessing ||
          aiAvatarWidget.speechEngine.isSpeaking;
        if (isActive) {
          stopVoiceSession(aiAvatarWidget, '即時語音對話已結束。');
        } else {
          startListening(aiAvatarWidget);
        }
        return;
      }
      aiAvatarWidget.speechEngine.convoOn =
        !aiAvatarWidget.speechEngine.convoOn; // 陪伴模式：一鍵開/關「連續對話」
      if (aiAvatarWidget.speechEngine.convoOn === true) {
        aiAvatarWidget.speechEngine.noSpeechRuns = 0;
        startListening(aiAvatarWidget);
      } else {
        stopVoiceSession(aiAvatarWidget, '即時語音對話已結束。');
      }
    };
  }

  if (uiDom.muteButtonEl instanceof HTMLElement) {
    uiDom.muteButtonEl.onclick = (event) => {
      const el = event.target;
      aiAvatarWidget.speechEngine.ttsMuted =
        !aiAvatarWidget.speechEngine.ttsMuted;
      el.textContent = aiAvatarWidget.speechEngine.ttsMuted ? '🔇' : '🔊';
      el.setAttribute(
        'aria-pressed',
        String(aiAvatarWidget.speechEngine.ttsMuted)
      );
      if (aiAvatarWidget.speechEngine.ttsMuted === true) {
        stopSpeaking(aiAvatarWidget); // 立刻停掉正在播的（神經語音 + 瀏覽器語音）
      }
      aiAvatarWidget.speechEngine.spokenDisplayText = aiAvatarWidget
        .speechEngine.ttsMuted
        ? '已靜音'
        : '已開啟語音';
    };
  }

  if (uiDom.speedButtonEl instanceof HTMLElement) {
    uiDom.speedButtonEl.onclick = (event) => {
      const el = event.target;
      const steps = [0.9, 1.0, 1.2, 1.4];
      aiAvatarWidget.speechEngine.ttsRate =
        steps[
          (steps.indexOf(aiAvatarWidget.speechEngine.ttsRate) + 1) %
            steps.length
        ] || 1.0;
      el.textContent = aiAvatarWidget.speechEngine.ttsRate.toFixed(1) + '×';
      aiAvatarWidget.speechEngine.spokenDisplayText =
        '語速：' + aiAvatarWidget.speechEngine.ttsRate.toFixed(1) + '×';
    };
  }

  if (uiDom.langButtonEl instanceof HTMLElement) {
    uiDom.langButtonEl.onclick = () => {
      const locales = ['zh-TW', 'en-US', 'ja-JP', 'ko-KR'];
      const current = aiAvatarWidget.speechEngine.currentLocale || 'zh-TW';
      const next = locales[(locales.indexOf(current) + 1) % locales.length];
      setLocale(aiAvatarWidget, next);

      let msg = '語言：繁體中文';
      if (next === 'en-US') msg = 'Language: English';
      else if (next === 'ja-JP') msg = '言語：日本語';
      else if (next === 'ko-KR') msg = '언어: 한국어';

      aiAvatarWidget.speechEngine.spokenDisplayText = msg;
    };
  }

  if (uiDom.historyButtonEl instanceof HTMLElement) {
    uiDom.historyButtonEl.onclick = () => {
      const isOpen = uiDom.historyPanelEl?.classList.contains('open');
      setHistoryOpen(aiAvatarWidget, !isOpen);
    };
  }

  if (uiDom.historyPanelEl instanceof HTMLElement) {
    const btnHistoryClose =
      uiDom.historyPanelEl.querySelector('#btn-history-close');
    const btnHistoryClear =
      uiDom.historyPanelEl.querySelector('#btn-history-clear');

    if (btnHistoryClose) {
      btnHistoryClose.onclick = () => setHistoryOpen(aiAvatarWidget, false);
    }
    if (btnHistoryClear) {
      btnHistoryClear.onclick = () => {
        aiAvatarWidget.chatLog.length = 0;
        renderHistory(aiAvatarWidget);
        aiAvatarWidget.speechEngine.spokenDisplayText = '已清除這次的聊天紀錄';
      };
    }
  }

  if (uiDom.btnLlmEl instanceof HTMLElement) {
    uiDom.btnLlmEl.onclick = async (event) => {
      const el = event.target;

      // 啟用 AI 伺服器模式時：🧠 用來顯示狀態 / 重新連線，不下載 WebLLM
      if (aiAvatarWidget.brainEngine.aiProvider?.enabled === true) {
        const ok =
          aiAvatarWidget.brainEngine.aiProvider.ready ||
          (await aiAvatarWidget.brainEngine.aiProvider.ping());
        // el.textContent = ok ? '🧠本機' : '🧠✗';
        el.textContent = ok ? '🧠✓' : '🧠✗';
        if (ok) {
          el.setAttribute('css-llm-on', 'true');
        } else {
          el.removeAttribute('css-llm-on');
        }
        el.setAttribute('aria-pressed', String(ok));
        aiAvatarWidget.speechEngine.spokenDisplayText = ok
          ? 'AI 伺服器大腦運作中（' +
            aiAvatarWidget.brainEngine.aiProvider.model +
            '）🧠'
          : 'AI 伺服器連不上：確認 AI 伺服器在跑、且 AI_PROVIDER_ORIGINS 已允許這個網站。';

        return;
      }
      if (aiAvatarWidget.brainEngine.llm?.supported !== true) {
        aiAvatarWidget.speechEngine.spokenDisplayText =
          '這個裝置不支援 WebGPU，先用知識庫模式就好（功能一樣可用）。';
        return;
      }
      if (aiAvatarWidget.brainEngine.llm?.state === STATE_MAP.READY) {
        aiAvatarWidget.speechEngine.spokenDisplayText =
          'AI 大腦已啟用，問我問題吧 🧠';
        return;
      } else if (aiAvatarWidget.brainEngine.llm?.state === STATE_MAP.LOADING) {
        aiAvatarWidget.speechEngine.spokenDisplayText =
          'AI 大腦載入中… ' +
          Math.round(aiAvatarWidget.brainEngine.llm.progress * 100) +
          '%';
        return;
      }

      await aiAvatarWidget.brainEngine.llm.load();
    };
  }
}

// index.js
export async function initAvatarBot(optiopns = {}) {
  if (typeof window !== 'object') return;

  const {
    container = null,
    aiProviderBaseUrl = '',
    aiProviderModel = DEFAULT_AI_PROVIDER_MODEL,
    aiProviderCreatedFetchSetting,
    aiProviderCreatedFetchPayload,
    aiProviderMaxTokens,
    aiProviderStream,
    neuralVoice = '',
    knowledgeUrl = '',
    companionKnowledgeUrl = '',
    modelUrl,
    ttsEndpoint = DEFAULT_TTS_ENDPOINT, // 沒設→試同站相對路徑；抓不到→自動退回瀏覽器語音（純前端可用）
    llmModel = DEFAULT_LLM_MODEL,
    avatarMode = DEFAULT_AVATAR_MODE,
    knowledge = null,
    companionKnowledge = null,
    startMode,
    fitMode,
    vrmUrl,
    gesture2D,
    isMinimal = false,
    isIframe = false,
    gender = '',
    companionFallback = []
  } = optiopns;

  if (container instanceof HTMLElement === false) {
    throw new Error('container must be an HTMLElement');
  }

  const safeGender =
    gender === GENDER_MAP.female || gender === GENDER_MAP.male
      ? gender
      : DEFAULT_GENDER;
  const safeNeuralVoice =
    neuralVoice ||
    (safeGender === GENDER_MAP.female
      ? DEFAULT_FEMALE_NEURAL_VOICE
      : DEFAULT_MALE_NEURAL_VOICE);

  let uiDom = null;

  let brainEngine = null;
  let speechEngine = null;
  let skinEngine = null;

  const aiAvatarWidget = {
    get optiopns() {
      return optiopns;
    },

    get DEFAULT_LLM_MODEL() {
      return DEFAULT_LLM_MODEL;
    },
    get STATE_MAP() {
      return STATE_MAP;
    },
    get ENGINE_MODE_MAP() {
      return ENGINE_MODE_MAP;
    },
    get AVATAR_MODE_MAP() {
      return AVATAR_MODE_MAP;
    },
    get FIT_MODE_MAP() {
      return FIT_MODE_MAP;
    },

    get container() {
      return container;
    },

    get uiDom() {
      return uiDom;
    },

    get classifyEmotion() {
      return classifyEmotion;
    },

    get setEmotionFromText() {
      return function _setEmotionFromText(...args) {
        return setEmotionFromText(this, ...args);
      };
    },

    get isIframe() {
      return isIframe;
    },

    _isMinimal: isIframe === true ? false : isMinimal || false,
    get isMinimal() {
      return this._isMinimal;
    },
    set isMinimal(newIsMinimal) {
      if (typeof newIsMinimal === 'boolean') {
        this._isMinimal = newIsMinimal;

        if (typeof this.onMinimalTrigger === 'function') {
          this.onMinimalTrigger(newIsMinimal, this);
        }

        if (newIsMinimal === false) {
          this.hiddenMinimalEl();
        } else {
          this.showMinimalEl();
        }
      }
    },
    showMinimalEl() {
      this.skinEngine.stageEl.style.left = '100vw';
      this.skinEngine.stageEl.style.opacity = 0;
      this.skinEngine.stageEl.style.userSelect = 'none';
      // this.skinEngine.stageEl.style.display = "none";
      this.uiDom.minimalEl.style.display = 'flex';
    },
    hiddenMinimalEl() {
      this.skinEngine.stageEl.style.left = '';
      this.skinEngine.stageEl.style.opacity = 1;
      this.skinEngine.stageEl.style.userSelect = 'auto';
      // this.skinEngine.stageEl.style.display = "block";
      this.uiDom.minimalEl.style.display = 'none';
    },

    _gender: safeGender,
    get gender() {
      return this._gender;
    },
    set gender(newGender = '') {
      if (Object.values(GENDER_MAP).includes(newGender)) {
        this._gender = newGender;
        if (newGender === GENDER_MAP.female) {
          this.speechEngine.neuralVoice = DEFAULT_FEMALE_NEURAL_VOICE;
          this.skinEngine.modelUrl = DEFAULT_FEMALE_MODEL_URL;
        } else if (newGender === GENDER_MAP.male) {
          this.speechEngine.neuralVoice = DEFAULT_MALE_NEURAL_VOICE;
          this.skinEngine.modelUrl = DEFAULT_MALE_MODEL_URL;
        }
      }
    },

    _avatarMode: avatarMode || DEFAULT_AVATAR_MODE,
    get avatarMode() {
      return this._avatarMode;
    },
    set avatarMode(newAvatarMode = '') {
      if (typeof newAvatarMode === 'string' && newAvatarMode !== '') {
        if (Object.values(AVATAR_MODE_MAP).includes(newAvatarMode)) {
          this._avatarMode = newAvatarMode;
        } else {
          this._avatarMode = AVATAR_MODE_MAP.assistant;
        }
      }
    },

    get brainEngine() {
      return brainEngine;
    },
    get speechEngine() {
      return speechEngine;
    },
    get skinEngine() {
      return skinEngine;
    },

    chatLog: [],
    chatSeq: 0,
    HOST_TOOLS: [],
    pendingToolInput: null,
    pendingToolChoice: null,
    pendingToolConfirmation: null,

    onTapTimer: false
  };

  const stageEl = document.createElement('div');
  stageEl.setAttribute('id', 'stage');

  brainEngine = await initBrainEngine(
    {
      llmModel,
      avatarMode,
      knowledgeUrl,
      companionKnowledgeUrl,
      knowledge,
      companionKnowledge,
      companionFallback,
      aiProviderBaseUrl,
      aiProviderModel,
      aiProviderCreatedFetchSetting,
      aiProviderCreatedFetchPayload,
      aiProviderMaxTokens,
      aiProviderStream,

      welcomeText: optiopns.welcomeText,
      companionWelcomeText: optiopns.companionWelcomeText,
      assistantWelcomeText: optiopns.assistantWelcomeText,

      onLlmLoading() {
        aiAvatarWidget.speechEngine.spokenDisplayText =
          '開始下載 AI 大腦（約 1GB，只需第一次）…';
      },
      onLlmLoadProgress(p) {
        uiDom.btnLlmEl.textContent =
          '🧠 ' + Math.round((p.progress || 0) * 100) + '%';
      },
      onLlmLoaded() {
        uiDom.btnLlmEl.textContent = '🧠✓';
        uiDom.btnLlmEl.setAttribute('css-llm-on', 'true');
        aiAvatarWidget.speechEngine.spokenAudioText =
          'AI 大腦啟用完成，現在我可以聊得更自然囉！';
        aiAvatarWidget.speechEngine.spokenDisplayText =
          'AI 大腦啟用完成，現在我可以聊得更自然囉！';
      },
      onLlmLoadError(error) {
        uiDom.btnLlmEl.textContent = '🧠✗';
        aiAvatarWidget.speechEngine.spokenDisplayText =
          'AI 大腦載入失敗：' + (error?.message || error);
      },
      onAiProviderConnecting() {
        const btnLlmEl = uiDom.btnLlmEl;
        if (btnLlmEl instanceof HTMLElement) {
          btnLlmEl.textContent = '🧠…';
          btnLlmEl.title = 'AI 伺服器大腦（連線中）';
        }
      },
      onAiProviderConnected(response, _fetchSetting, aiProvider) {
        const ok = response?.ok || false;
        const btnLlmEl = uiDom.btnLlmEl;

        if (btnLlmEl instanceof HTMLElement) {
          btnLlmEl.textContent = ok ? '🧠✓' : '🧠✗';
          if (ok) {
            btnLlmEl.setAttribute('css-llm-on', 'true');
          } else {
            btnLlmEl.removeAttribute('css-llm-on');
          }
          btnLlmEl.setAttribute('aria-pressed', String(ok));
          btnLlmEl.title = ok
            ? 'AI 伺服器：已連線 ' + aiProvider.model
            : 'AI 伺服器連不上（檢查 AI 伺服器是否在跑 / CORS）';
        }
        if (ok === true) {
          setTimeout(() => {
            aiAvatarWidget.speechEngine.spokenDisplayText =
              '已接上 AI 伺服器大腦（' +
              aiAvatarWidget.brainEngine.aiProvider.model +
              '）🧠 問我問題吧！';
          }, 1300);
        }
      }
    },
    aiAvatarWidget
  );

  speechEngine = initSpeechEngine(
    {
      ttsEndpoint: ttsEndpoint || DEFAULT_TTS_ENDPOINT,
      neuralVoice: safeNeuralVoice,
      greeting: optiopns.greeting,
      companionGreeting: optiopns.companionGreeting,
      assistantGreeting: optiopns.assistantGreeting,
      onSpokenDisplayTextChange(newSpeakingLabel) {
        uiDom.bubbleEl.textContent = newSpeakingLabel;
        uiDom.bubbleEl.setAttribute('css-is-show', 'true');
      },
      onSpokenDisplayTextTimeout() {
        uiDom.bubbleEl.removeAttribute('css-is-show');
      },

      // TODO: 待 speak 與其他方法耦合拆解完後改為直接放到 speech.js 檔案中
      speak
    },
    aiAvatarWidget
  );

  skinEngine = initSkinEngine(
    {
      stageEl,
      modelUrl,
      startMode,
      fitMode,
      vrmUrl,
      gesture2D,
      get gender() {
        return aiAvatarWidget.gender;
      },
      computeMouth() {
        return computeMouth(aiAvatarWidget);
      },
      async onMounted() {
        aiAvatarWidget.speechEngine.spokenDisplayText =
          await getWelcomeText(aiAvatarWidget);
        if (typeof aiAvatarWidget.onReady === 'function') {
          aiAvatarWidget.onReady(aiAvatarWidget);
        }
      },
      onThreeDimensionalError(error) {
        if (typeof aiAvatarWidget.onError === 'function') {
          aiAvatarWidget.onError(error, aiAvatarWidget);
        }
      },
      onTwoDimensionalError(error) {
        const directWarnEl = aiAvatarWidget?.uiDom?.directWarnEl;
        if (
          directWarnEl instanceof HTMLParagraphElement ||
          directWarnEl instanceof HTMLDivElement
        ) {
          directWarnEl.textContent =
            '2D 啟動失敗：' + (error?.message || error);
          directWarnEl.style.display = 'flex';
        }
        if (typeof aiAvatarWidget.onError === 'function') {
          aiAvatarWidget.onError(error, aiAvatarWidget);
        }
      },
      VRMFileChangeFail(error) {
        console.error(error);
        aiAvatarWidget.speechEngine.spokenDisplayText = error.message;
        if (typeof aiAvatarWidget.onError === 'function') {
          aiAvatarWidget.onError(error, aiAvatarWidget);
        }
      },
      VRMFileChangeSuccess() {
        const engineButtonEl = aiAvatarWidget?.uiDom?.engineButtonEl;

        // 換上後也顯示 2D/3D 切換鈕
        if (engineButtonEl instanceof HTMLElement) {
          engineButtonEl.style.display = '';
          if (typeof engineButtonEl.onclick !== 'function') {
            engineButtonEl.onclick = () => {
              aiAvatarWidget.skinEngine.engineMode =
                ENGINE_MODE_MAP.threeDimensional
                  ? ENGINE_MODE_MAP.twoDimensional
                  : ENGINE_MODE_MAP.threeDimensional;
            };
          }
        }
        aiAvatarWidget.speechEngine.spokenDisplayText = '換上你的角色了！🎭';
      },
      onModelChange(newEngineMode) {
        if (aiAvatarWidget.uiDom?.engineButtonEl instanceof HTMLElement) {
          aiAvatarWidget.uiDom.engineButtonEl.textContent =
            newEngineMode === ENGINE_MODE_MAP.threeDimensional ? '3D' : '2D';
        }
      },
      onModelChangeEnd() {
        aiAvatarWidget.uiDom.engineButtonEl.textContent =
          aiAvatarWidget.skinEngine.engineMode ===
          ENGINE_MODE_MAP.threeDimensional
            ? '3D'
            : '2D';

        aiAvatarWidget.skinEngine.avatarModel.on('hit', () =>
          onTap(aiAvatarWidget)
        );
        if (
          aiAvatarWidget.skinEngine.engineMode ===
          ENGINE_MODE_MAP.threeDimensional
        ) {
          aiAvatarWidget.skinEngine.renderer.canvas.addEventListener(
            'pointerdown',
            () => {
              aiAvatarWidget.skinEngine.renderer.playGesture(
                aiAvatarWidget.skinEngine.renderer.TAP_GESTURES[
                  Math.floor(
                    Math.random() *
                      aiAvatarWidget.skinEngine.renderer.TAP_GESTURES.length
                  )
                ]
              );
              onTap(aiAvatarWidget);
            }
          );
        } else {
          aiAvatarWidget.skinEngine.renderer.canvas.addEventListener(
            'pointerdown',
            () => onTap(aiAvatarWidget)
          );
        }
      }
    },
    aiAvatarWidget
  );

  uiDom = initUi(container, stageEl);

  // 初始化 UI 語音狀態
  uiDom.updateVoiceStatus(
    aiAvatarWidget.speechEngine.convoOn,
    '即時語音待命',
    '',
    0
  );

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && aiAvatarWidget.speechEngine.convoOn) {
      stopVoiceSession(aiAvatarWidget, '頁面進入背景，即時語音已停止。');
    }
  });

  if (typeof optiopns.onReady === 'function') {
    aiAvatarWidget.onReady = optiopns.onReady.bind(aiAvatarWidget);
  }

  if (typeof optiopns.buildLLMMessages === 'function') {
    aiAvatarWidget.buildLLMMessages =
      optiopns.buildLLMMessages.bind(aiAvatarWidget);
  } else {
    aiAvatarWidget.buildLLMMessages =
      defaultBuildLLMMessages.bind(aiAvatarWidget);
  }

  if (typeof optiopns.onMinimalTrigger === 'function') {
    aiAvatarWidget.onMinimalTrigger =
      optiopns.onMinimalTrigger.bind(aiAvatarWidget);
  }

  initSkinModeChangeButton(aiAvatarWidget, skinEngine.has2D, skinEngine.has3D);
  renderSuggestions(aiAvatarWidget);
  bindTyping(aiAvatarWidget);
  setMic(aiAvatarWidget, false); // 依模式套按鈕字樣（🎤 說話 / 💬 對話）

  bindUiEvent(aiAvatarWidget);

  ['dragenter', 'dragover'].forEach((eventName) =>
    container.addEventListener(eventName, (event) => {
      event.preventDefault();
    })
  );
  container.addEventListener('drop', (event) => {
    event.preventDefault();
    const file = event?.dataTransfer?.files?.[0];
    if (file instanceof window.File) {
      skinEngine.loadVRMFile(file);
    }
  });

  if (aiAvatarWidget.isIframe === true) {
    aiAvatarWidget.onMinimalTrigger(isMinimal, aiAvatarWidget);
    aiAvatarWidget.hiddenMinimalEl();
  } else {
    aiAvatarWidget.isMinimal = isMinimal;
  }

  return aiAvatarWidget;
}

export default initAvatarBot;

export function getGreetingText(aiAvatarWidget) {
  if (aiAvatarWidget.speechEngine.greeting) {
    const text = aiAvatarWidget.speechEngine.greeting(aiAvatarWidget);
    if (text) return text;
  }

  if (aiAvatarWidget.avatarMode === aiAvatarWidget.AVATAR_MODE_MAP.companion) {
    if (aiAvatarWidget.speechEngine.companionGreeting) {
      if (typeof aiAvatarWidget.speechEngine.companionGreeting === 'function') {
        const text =
          aiAvatarWidget.speechEngine.companionGreeting(aiAvatarWidget);
        if (text) return text;
      } else {
        return aiAvatarWidget.speechEngine.companionGreeting;
      }
    }
    const name = aiAvatarWidget.brainEngine?.mem?.data?.name || '';
    return (
      (name ? name + '～' : '你好～') + '想聊什麼都可以，點 💬 我們就開始！'
    );
  } else {
    if (aiAvatarWidget.speechEngine.assistantGreeting) {
      if (typeof aiAvatarWidget.speechEngine.assistantGreeting === 'function') {
        const text =
          aiAvatarWidget.speechEngine.assistantGreeting(aiAvatarWidget);
        if (text) return text;
      } else {
        return aiAvatarWidget.speechEngine.assistantGreeting;
      }
    }
    return (
      aiAvatarWidget.brainEngine?.KBM?.greeting ||
      '你好～我是可以嵌入任何網站的語音虛擬人，問我怎麼安裝、怎麼換成你的角色都行！'
    );
  }
}

export function preloadTapGreeting(aiAvatarWidget) {
  if (aiAvatarWidget.speechEngine.neuralDisabled) return Promise.resolve(null);

  const text = getGreetingText(aiAvatarWidget);
  const key = aiAvatarWidget.speechEngine.neuralVoice + '\n' + text;

  if (
    aiAvatarWidget.speechEngine.tapGreetingPrep &&
    aiAvatarWidget.speechEngine.tapGreetingCacheKey === key
  ) {
    return aiAvatarWidget.speechEngine.tapGreetingPrep;
  }

  aiAvatarWidget.speechEngine.tapGreetingCacheKey = key;
  aiAvatarWidget.speechEngine.tapGreetingBuffer = null;
  aiAvatarWidget.speechEngine.tapGreetingPrep = fetchTTSBuffer(
    aiAvatarWidget,
    text,
    true
  )
    .then((buffer) => {
      if (aiAvatarWidget.speechEngine.tapGreetingCacheKey === key) {
        aiAvatarWidget.speechEngine.tapGreetingBuffer = buffer;
      }
      return buffer;
    })
    .catch((error) => {
      if (aiAvatarWidget.speechEngine.tapGreetingCacheKey === key) {
        aiAvatarWidget.speechEngine.tapGreetingPrep = null;
        aiAvatarWidget.speechEngine.tapGreetingBuffer = null;
      }
      throw error;
    });

  return aiAvatarWidget.speechEngine.tapGreetingPrep;
}

export function localeLabel(locale) {
  return /^en/i.test(locale)
    ? 'EN'
    : /^ja/i.test(locale)
      ? '日'
      : /^ko/i.test(locale)
        ? '한'
        : '中';
}

export function localeVoice(locale) {
  return /^en/i.test(locale)
    ? 'en-US-JennyNeural'
    : /^ja/i.test(locale)
      ? 'ja-JP-NanamiNeural'
      : /^ko/i.test(locale)
        ? 'ko-KR-SunHiNeural'
        : 'zh-TW-HsiaoChenNeural';
}

export function setLocale(aiAvatarWidget, locale) {
  const matched =
    ['zh-TW', 'en-US', 'ja-JP', 'ko-KR'].find(
      (l) => l.toLowerCase() === (locale || '').toLowerCase()
    ) || 'zh-TW';
  aiAvatarWidget.speechEngine.currentLocale = matched;
  // Note: Only fallback neural voice if the developer didn't set a hardcoded voice in config
  if (!aiAvatarWidget.config?.voice) {
    aiAvatarWidget.speechEngine.neuralVoice = localeVoice(matched);
  }

  if (aiAvatarWidget.uiDom.langButtonEl) {
    aiAvatarWidget.uiDom.langButtonEl.textContent = localeLabel(matched);
  }

  if (aiAvatarWidget.speechEngine.recognition) {
    aiAvatarWidget.speechEngine.recognition.lang = matched;
  }

  loadVoice(aiAvatarWidget);
}
