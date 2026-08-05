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
function speak(aiAvatarWidget = null, text) {
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
    pushSpeech(aiAvatarWidget, sid, sentences);
  }
  endSpeech(aiAvatarWidget, sid);
}

// speech.js
// ===== ②逐句開講引擎：一次一個 session；句子依序講，神經語音在背景先抓下一句 =====
function beginSpeech(aiAvatarWidget = null) {
  stopSpeaking(aiAvatarWidget); // 打斷上一段（含清佇列、表情回中性）
  aiAvatarWidget.speechEngine.speechQ = [];
  aiAvatarWidget.speechEngine.speechEnded = false;
  aiAvatarWidget.speechEngine.isSpeechPlaying = false;
  aiAvatarWidget.speechEngine.tapDone = false;
  return ++aiAvatarWidget.speechEngine.speakSeq;
}
// speech.js
function pushSpeech(aiAvatarWidget = null, sid, text) {
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
    err: null
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
    const out = await aiAvatarWidget.brainEngine.llm.chat(
      aiAvatarWidget.buildLLMMessages(aiAvatarWidget, question),
      (delta, sofar) => {
        aiAvatarWidget.speechEngine.spokenDisplayText = sofar; // 邊生成邊更新字幕
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
    aiAvatarWidget.speechEngine.spokenDisplayText = '你：' + text;
  }

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

  // aiAvatarWidget.speechEngine.isSpeaking = true;
  aiAvatarWidget.speechEngine.isProcessing = true; // 回答完成前不要自動重開麥（onUtteranceEnd 會清）
  handleAnswer(aiAvatarWidget, text);
}

// speech.js | brain.js | ui.js
// ===== STT：聽你說話 =====
function setMic(aiAvatarWidget = null, isListening = false) {
  const rootContainer = aiAvatarWidget?.container;
  if (rootContainer instanceof HTMLElement === false) {
    console.error('[aiAvatar setMic] rootContainer is not an HTMLElement');
    return;
  }

  const btnMic = aiAvatarWidget.uiDom.micButtonEl;
  btnMic.classList.toggle('listening', isListening);
  btnMic.textContent = isListening
    ? aiAvatarWidget.avatarMode === aiAvatarWidget.AVATAR_MODE_MAP.companion
      ? '● 對話中'
      : '● 聆聽中'
    : aiAvatarWidget.avatarMode === aiAvatarWidget.AVATAR_MODE_MAP.companion
      ? '💬 對話'
      : '🎤 說話';

  const suggestions = aiAvatarWidget.uiDom.suggestionsEl;
  if (suggestions instanceof HTMLElement) {
    suggestions.style.display = isListening ? 'none' : 'flex';
  } // 聆聽中收起清單
}

// async function startVoiceSession() {
//   if (!SR) {
//     showBubble('這個瀏覽器不支援語音辨識，建議使用最新版 Chrome 或 Edge。');
//     return;
//   }
//   convoOn = true;
//   noSpeechRuns = 0;
//   setMic(false);
//   setVoiceStatus('正在取得麥克風權限…', 'thinking', 0);
//   try {
//     await ensureMicMonitor();
//     if (isSpeaking || speechPlaying) stopSpeaking();
//     setVoiceStatus('麥克風已就緒', 'listening', 0);
//     startListening();
//     emitEvent('voice_session_start', {});
//   } catch (error) {
//     convoOn = false;
//     setMic(false);
//     stopMicMonitor();
//     const message = microphoneErrorMessage(error);
//     showBubble(message);
//     setVoiceStatus(message, '', 0);
//   }
// }

// function stopVoiceSession(message) {
//   convoOn = false;
//   clearTimeout(recognitionSilenceTimer);
//   recognitionText = '';
//   recognitionSubmitted = true;
//   recognitionError = 'aborted';
//   try {
//     if (recognition) recognition.abort();
//   } catch (e) {}
//   recognition = null;
//   listening = false;
//   setMic(false);
//   stopMicMonitor();
//   setVoiceStatus('', '', 0);
//   showBubble(message || '即時語音對話已結束。');
//   emitEvent('voice_session_end', {});
// }

// speech.js | brain.js

function startListening(aiAvatarWidget = null) {
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
  try {
    aiAvatarWidget.speechEngine.recognition = new SafeSpeechRecognition();
  } catch (error) {
    aiAvatarWidget.speechEngine.spokenAudioText =
      '語音辨識啟動失敗：' + error.message;
    aiAvatarWidget.speechEngine.convoOn = false;
    return;
  }
  aiAvatarWidget.speechEngine.recognition.lang = 'zh-TW';
  aiAvatarWidget.speechEngine.recognition.interimResults = true;
  aiAvatarWidget.speechEngine.recognition.continuous = false;
  aiAvatarWidget.speechEngine.recognition.maxAlternatives = 1;
  aiAvatarWidget.speechEngine.recognition.onstart = () => {
    aiAvatarWidget.speechEngine.isListening = true;
    setMic(aiAvatarWidget, true);
    aiAvatarWidget.speechEngine.spokenDisplayText =
      aiAvatarWidget.speechEngine.convoOn === true
        ? '聊吧，我在聽 🎙️（再點一下按鈕結束）'
        : '聆聽中…請說話 🎙️';
  };
  aiAvatarWidget.speechEngine.recognition.onresult = (event) => {
    let txt = '';
    for (const result of event.results) {
      txt += result[0].transcript;
    }
    const last = event.results[event.results.length - 1];
    if (last.isFinal) {
      aiAvatarWidget.speechEngine.noSpeechRuns = 0;
      handleUser(aiAvatarWidget, txt.trim());
    } else {
      aiAvatarWidget.speechEngine.spokenDisplayText = '「' + txt + '」…';
    }
  };
  aiAvatarWidget.speechEngine.recognition.onerror = (event) => {
    aiAvatarWidget.speechEngine.isListening = false;
    setMic(aiAvatarWidget, false);
    if (event.error === 'not-allowed') {
      aiAvatarWidget.speechEngine.convoOn = false;
      aiAvatarWidget.speechEngine.spokenDisplayText =
        '我需要麥克風權限才能聽你說話喔。';
      return;
    }
    if (
      aiAvatarWidget.speechEngine.convoOn === true &&
      (event.error === 'no-speech' || event.error === 'aborted')
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
        aiAvatarWidget.speechEngine.convoOn = false;
        aiAvatarWidget.speechEngine.spokenDisplayText =
          '好像沒聽到聲音，我先休息～要聊再點 💬';
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
        startListening(aiAvatarWidget);
        return;
      }
      aiAvatarWidget.speechEngine.convoOn =
        !aiAvatarWidget.speechEngine.convoOn; // 陪伴模式：一鍵開/關「連續對話」
      if (aiAvatarWidget.speechEngine.convoOn === true) {
        aiAvatarWidget.speechEngine.noSpeechRuns = 0;
        startListening(aiAvatarWidget);
      } else {
        try {
          aiAvatarWidget.speechEngine.recognition &&
            aiAvatarWidget.speechEngine.recognition.stop();
        } catch (_error) {}
        setMic(aiAvatarWidget, false);
        aiAvatarWidget.speechEngine.spokenDisplayText =
          '對話先到這～要聊再點 💬';
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
        el.classList.toggle('llm-on', ok);
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
        uiDom.btnLlmEl.classList.add('llm-on');
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
          btnLlmEl.classList.toggle('llm-on', ok);
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
        uiDom.bubbleEl.classList.add('show');
      },
      onSpokenDisplayTextTimeout() {
        uiDom.bubbleEl.classList.remove('show');
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
