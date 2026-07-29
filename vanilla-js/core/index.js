import {
  AVATAR_MODE_MAP,
  DEFAULT_AVATAR_MODE,
  DEFAULT_LLM_MODEL,
  DEFAULT_AI_PROVIDER_MODEL,
  STATE_MAP,
  handleGetKnowledge,
  initBrainEngine
} from './brain';

import {
  ENGINE_MODE_MAP,
  FIT_MODE_MAP,
  DEFALUT_START_MODE,
  DEFAULT_FIT_MODE,
  DEFAULT_FEMALE_MODEL_URL,
  DEFAULT_MALE_MODEL_URL
} from './skin';

import {
  DEFAULT_TTS_ENDPOINT,
  DEFAULT_FEMALE_NEURAL_VOICE,
  DEFAULT_MALE_NEURAL_VOICE
} from './speech';

import { initUi } from './ui';

import '../style/style.scss';

// M4b：WebLLM（瀏覽器內跑小模型，零金鑰）。函式庫改成「按下🧠才動態 import」，
//    一般訪客（不啟用大腦）不會下載這包 JS。控制權掛到 window.LLM。

// skin.js | speech.js
export const GENDER_MAP = {
  female: 'female',
  male: 'male'
};
export const DEFAULT_GENDER = GENDER_MAP.female;

// export
const DEFAULT_MODEL_URL =
  DEFAULT_GENDER === GENDER_MAP.female
    ? DEFAULT_FEMALE_MODEL_URL
    : DEFAULT_MALE_MODEL_URL;

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
// 從回答文字粗判情緒（規則式、零成本；驚訝 > 難過 > 開心 > 中性）
function classifyEmotion(text) {
  const safeText = String(text || '');
  const countPattern = (regex) => (safeText.match(regex) || []).length;
  const surprised = countPattern(/哇|居然|竟然|沒想到|驚|真的嗎|！？|\?!|!\?/g);
  const sad = countPattern(
    /抱歉|對不起|可惜|遺憾|失敗|錯誤|沒辦法|不支援|不行|連不上|難過|唉/g
  );
  const happy = countPattern(
    /哈|笑|開心|太好了|好耶|讚|恭喜|歡迎|謝謝|沒問題|完成|成功|一起|囉|喔！|🎉|😊|👋/g
  );
  if (surprised && surprised >= Math.max(happy, sad)) {
    return 'surprised';
  }
  if (sad > happy) {
    return 'sad';
  }
  if (happy) {
    return 'happy';
  }
  return 'neutral';
}
// brain.js
function setEmotion(aiAvatarWidget = null, name) {
  if (name === aiAvatarWidget?.emo.name) {
    return;
  }
  aiAvatarWidget.emo.name = name;
  aiAvatarWidget.emo.target =
    { happy: 0.65, surprised: 0.6, sad: 0.5 }[name] || 0;

  handleGesture(aiAvatarWidget, name);
}
// brain.js
function setEmotionFromText(aiAvatarWidget, text) {
  setEmotion(aiAvatarWidget, classifyEmotion(text));
}

// brain.js
// ===== 大腦：M4 檢索 + M4b（WebLLM）生成 =====
// 中文不好斷詞，改用「字元 bigram（相鄰兩字）」相似度，對中文很有效、又不用任何函式庫。
function bigrams(s) {
  s = (s || '').toLowerCase().replace(/[\s，。、？！,.?!~～]/g, '');
  const g = [];
  for (let i = 0; i < s.length - 1; i++) {
    g.push(s.slice(i, i + 2));
  }
  if (s.length === 1) {
    g.push(s);
  }
  return g;
}
// brain.js
function similarity(query, text) {
  const A = bigrams(query);
  const B = new Set(bigrams(text));
  if (!A.length || !B.size) {
    return 0;
  }
  let hit = 0;
  for (const x of A) {
    if (B.has(x)) {
      hit++;
    }
  }
  return hit / Math.sqrt(A.length * B.size);
}
// brain.js
function scoreEntry(question, e) {
  let score = Math.max(
    similarity(question, e.q),
    similarity(question, e.kw || '')
  );
  const terms = (e.kw || '').split(/\s+/).filter(Boolean);
  for (const item of terms) {
    if (item.length >= 2 && question.includes(item)) {
      score = Math.max(score, 0.5 + item.length * 0.04);
    }
  }
  return score;
}
// brain.js
function topK(aiAvatarWidget = null, question, k) {
  const knowledge = aiAvatarWidget?.brainEngine?.knowledge || [];

  return knowledge
    .map((e) => ({ e, s: scoreEntry(question, e) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .filter((x) => x.s > 0.05)
    .map((x) => x.e);
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

// brain.js
async function aiProviderLLMBrain(aiAvatarWidget = null, question) {
  try {
    aiAvatarWidget.speechEngine.spokenDisplayText = '讓我想想…';

    handleGesture(aiAvatarWidget, 'thinking');

    const out = await aiAvatarWidget.brainEngine.aiProvider.chat(
      aiAvatarWidget.buildLLMMessages(aiAvatarWidget, question)
    );
    if (out.trim?.()) {
      return sayAnswer(aiAvatarWidget, out.trim());
    }
  } catch (e) {
    console.warn('Ollama error', e);
    aiAvatarWidget.brainEngine.aiProvider.ready = false;
  }
  throw new Error(
    `Ollama did not return a string or returned an empty string: ${out}`
  );
}

// skin.js
async function handleGesture(aiAvatarWidget = null, emotionName) {
  if (typeof aiAvatarWidget?.gesture !== 'function') {
    console.warn(
      '[aiAvatar handleGesture]  aiAvatarWidget.gesture is not a function',
      aiAvatarWidget
    );
    return;
  }

  if (typeof aiAvatarWidget.onGesture === 'function') {
    aiAvatarWidget.onGesture(emotionName, aiAvatarWidget);
  }
  await aiAvatarWidget.gesture(emotionName);
}

// skin.js
async function defaultGesture2D(aiAvatarWidget = null, emotionName) {
  // f00 微笑眨眼
  // f01 （與f00很像）
  // f02 困惑
  // f03 難過
  // f04 開心
  // f05 驚訝
  // f06 害羞
  // f07 傻眼
  const emotionFemaleNameMap = {
    neutral: 'f00',
    happy: 'f04',
    sad: 'f03',
    surprised: 'f05'
  };

  const emotionMaleNameMap = {
    neutral: 'Normal',
    happy: 'Smile',
    sad: 'Sad',
    surprised: 'Surprised'
  };

  const emotionNameMap =
    aiAvatarWidget.gender === GENDER_MAP.female
      ? emotionFemaleNameMap
      : emotionMaleNameMap;

  const emotionCode = emotionNameMap[emotionName];

  if (
    Object.values(emotionNameMap).includes(emotionCode) &&
    typeof aiAvatarWidget.avatarModel?.expression === 'function'
  ) {
    try {
      await aiAvatarWidget.avatarModel.expression(emotionCode);
    } catch (_error) {}
  }
}

// skin.js
// 2D 引擎相依（pixi + live2d）改成「用到才載」，3D 模式就不會下載 Live2D
function loadUMD() {
  const cdnDependencieUrlArray = [
    {
      id: 'live2dcubismcore',
      src: 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js'
    },
    {
      id: 'pixi.js@6.5.10',
      src: 'https://cdn.jsdelivr.net/npm/pixi.js@6.5.10/dist/browser/pixi.min.js'
    },
    {
      id: 'pixi-live2d-display@0.4.0',
      src: 'https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism4.min.js'
    }
  ];

  if (window.__cdnDependenciePromise__ instanceof Promise === true) {
    return window.__cdnDependenciePromise__;
  }

  window.__cdnDependenciePromise__ = cdnDependencieUrlArray.reduce(
    (cdnDependenciePromise, cdnDependencie) =>
      cdnDependenciePromise.then(
        () =>
          new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = cdnDependencie.src;
            if (cdnDependencie.id) {
              script.id = cdnDependencie.id;
            }
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          })
      ),
    Promise.resolve()
  );

  return window.__cdnDependenciePromise__;
}

// skin.js
// ===== 引擎切換外殼：每個引擎建自己的 canvas、回傳 dispose；切換＝dispose 舊的再 boot 新的 =====
function createCanvas(aiAvatarWidget = null) {
  const stageEl = aiAvatarWidget?.uiDom?.stageEl;
  if (stageEl instanceof HTMLElement === false) {
    throw new Error('[aiAvatar createCanvas] stageEl is not an HTMLElement');
  }

  stageEl
    .querySelectorAll('canvas.avatar-canvas')
    .forEach((old) => old.remove()); // 切換時保證不留舊 canvas（殘骸）
  const newCanvas = document.createElement('canvas');
  newCanvas.classList.add('avatar-canvas');
  stageEl.insertBefore(newCanvas, stageEl.firstChild); // 放最底層，UI 疊在上面
  return newCanvas;
}

// skin.js
function initSkinMode(aiAvatarWidget = null) {
  const rootContainer = aiAvatarWidget?.container;
  if (rootContainer instanceof HTMLElement === false) {
    console.error(
      '[aiAvatar initSkinMode] rootContainer is not an HTMLElement'
    );
    return;
  }

  const startMode =
    aiAvatarWidget.startMode ||
    (has2D
      ? ENGINE_MODE_MAP.twoDimensional
      : has3D
        ? ENGINE_MODE_MAP.threeDimensional
        : ENGINE_MODE_MAP.twoDimensional);

  aiAvatarWidget.startMode = startMode;
  aiAvatarWidget.engineMode = startMode;
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
        aiAvatarWidget.engineMode = ENGINE_MODE_MAP.threeDimensional
          ? ENGINE_MODE_MAP.twoDimensional
          : ENGINE_MODE_MAP.threeDimensional;
      };
    }
  }
}

// skin.js
// ===== 3D 皮：VRM（three + three-vrm，ESM 動態 import）=====
async function bootVRM(aiAvatarWidget = null, setting = {}) {
  const stageEl = aiAvatarWidget?.uiDom?.stageEl;
  const rootContainer = aiAvatarWidget?.container;
  const {
    bow = '',
    wave = '',
    thinking = '',
    look = '',
    relax = '',
    surprised = ''
  } = setting;
  try {
    if (stageEl instanceof HTMLElement === false) {
      throw new Error('[aiAvatar bootVRM] stageEl is not an HTMLElement');
    }
    const THREE = await import('three');
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const { VRMLoaderPlugin, VRMUtils } = await import('@pixiv/three-vrm');
    const { VRMAnimationLoaderPlugin, createVRMAnimationClip } =
      await import('@pixiv/three-vrm-animation');
    // const vrmaRootPath = 'https://cdn.jsdelivr.net/gh/tk256ailab/vrm-viewer@main/VRMA/';
    const vrmaRootPath = '/avatar-skin/3d-model/vrma/';
    const GESTURES = {
      // 情境手勢 + 待機變化（body-only，不碰嘴）`
      wave: wave || vrmaRootPath + 'Goodbye.vrma',
      // bow:
      //   bow ||
      //   'https://cdn.jsdelivr.net/gh/hirokazuniimoto/virtual-avatar-sdk@main/assets/animations/quick_formal_bow.vrma',
      bow: bow || vrmaRootPath + 'quick_formal_bow.vrma',
      thinking: thinking || vrmaRootPath + 'Thinking.vrma',
      look: look || vrmaRootPath + 'LookAround.vrma',
      relax: relax || vrmaRootPath + 'Relax.vrma',
      surprised: surprised || vrmaRootPath + 'Surprised.vrma' // ①情緒用：驚訝的小反應（不在點擊問候清單裡）
    };
    const TAP_GESTURES = ['wave', 'bow']; // 點一下隨機：揮手/鞠躬問候（歡迎感）

    const canvas = createCanvas(aiAvatarWidget);
    const webGLRenderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true
    });
    webGLRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    webGLRenderer.setClearColor(0x000000, 0);

    const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 20);
    camera.position.set(0, 1.4, 1.6);
    camera.lookAt(0, 1.3, 0);
    const resize = () => {
      const stageElClientWidth = stageEl.clientWidth;
      const stageElClientHeight = stageEl.clientHeight;
      webGLRenderer.setSize(stageElClientWidth, stageElClientHeight, false);
      camera.aspect = stageElClientWidth / stageElClientHeight;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);

    const scene = new THREE.Scene();
    // 調暗：原本 key=π / fill=π*0.35 / ambient=0.6 太亮（MToon 易過曝），整體降約 4 成
    const key = new THREE.DirectionalLight(0xffffff, Math.PI * 0.6);
    key.position.set(1, 1.5, 2);
    const fill = new THREE.DirectionalLight(0xfff0e8, Math.PI * 0.2);
    fill.position.set(-1.5, 0.5, 1);
    scene.add(key, fill, new THREE.AmbientLight(0xffffff, 0.38));
    const lookTarget = new THREE.Object3D();
    scene.add(lookTarget); // lookAt 目標：跟著滑鼠
    let mx = 0;
    let my = 0; // 游標相對位置 -1..1
    const onMove = (event) => {
      const stageElClientRect = stageEl.getBoundingClientRect();
      if (!stageElClientRect.width) return;
      mx = Math.max(
        -1,
        Math.min(
          1,
          ((event.clientX - stageElClientRect.left) / stageElClientRect.width) *
            2 -
            1
        )
      );
      my = Math.max(
        -1,
        Math.min(
          1,
          ((event.clientY - stageElClientRect.top) / stageElClientRect.height) *
            2 -
            1
        )
      );
    };
    rootContainer.addEventListener('pointermove', onMove);

    let nextBlink = 2 + Math.random() * 3;
    let blinkT = -1;
    let mixer = null;
    let waving = false;
    const BLINK = 0.12;
    const gestureActions = {};
    let currentGesture = null;
    let idleBreak = 0;
    const clock = new THREE.Clock();
    const loader = new GLTFLoader();
    loader.register((p) => new VRMLoaderPlugin(p));
    loader.register((p) => new VRMAnimationLoaderPlugin(p)); // 同一個 loader 也能讀 .vrma
    const gltf = await new Promise((resolve, reject) =>
      loader.load(
        aiAvatarWidget.vrmUrl,
        (gltf) => {
          resolve(gltf);
        },
        undefined,
        (error) => {
          reject(error);
        }
      )
    ).catch((error) => {
      console.error(error);
      if (typeof aiAvatarWidget.onError === 'function') {
        aiAvatarWidget.onError(error, aiAvatarWidget);
      }
    });

    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.combineSkeletons(gltf.scene);

    let vrm = gltf.userData.vrm;

    VRMUtils.combineMorphs(vrm);
    VRMUtils.rotateVRM0(vrm); // VRM0.x 轉正；VRM1 為安全 no-op

    // VRM0 被 rotateVRM0 轉 180°，手臂 z 旋轉方向會相反；VRM1 不轉 → 用版本決定正負號
    const armSign = String(vrm.meta && vrm.meta.metaVersion) === '1' ? -1 : 1;
    vrm.scene.traverse((o) => {
      o.frustumCulled = false;
    });
    scene.add(vrm.scene);

    try {
      if (vrm.lookAt) {
        vrm.lookAt.target = lookTarget;
      }
    } catch (_e) {} // 眼睛跟著滑鼠

    // VRMA 情境手勢庫（body-only，不碰嘴）：點擊/出場揮手、思考托腮、待機變化(環顧/放鬆)
    await (async () => {
      const bodyOnly = (cl) => {
        cl.tracks = cl.tracks.filter((tr) => /\.quaternion$/.test(tr.name));
        return cl;
      }; // 只留骨架旋轉、剝臉部表情與位移
      try {
        mixer = new THREE.AnimationMixer(vrm.scene);
        for (const [name, file] of Object.entries(GESTURES)) {
          try {
            const gg = await loader.loadAsync(file);
            const a = gg.userData.vrmAnimations && gg.userData.vrmAnimations[0];
            if (!a) {
              continue;
            }
            const act = mixer.clipAction(
              bodyOnly(createVRMAnimationClip(a, vrm))
            );
            act.setLoop(THREE.LoopOnce, 1);
            act.clampWhenFinished = true;
            gestureActions[name] = act;
          } catch (error) {
            console.warn('VRMA ' + name + ' 載入失敗：', error?.message);
          }
        }
        mixer.addEventListener('finished', (event) => {
          // 手勢播完 → 立刻停、交回程序化站姿（不 fadeOut，避免露出 bind T-pose）
          if (event.action === currentGesture) {
            try {
              event.action.stop();
            } catch (_error) {}
            currentGesture = null;
            waving = false;
          }
        });
        aiAvatarWidget.gesture3D = playGesture; // 對外 hook：思考等時機可從對話流程觸發
        if (gestureActions.wave) {
          setTimeout(() => playGesture('wave'), 800); // 出場招呼
        }
        idleBreak = setInterval(() => {
          // 待機變化：偶爾環顧/放鬆，不死板
          if (
            !waving &&
            !aiAvatarWidget.speechEngine.isSpeaking &&
            Math.random() < 0.65
          ) {
            playGesture(Math.random() < 0.5 ? 'look' : 'relax');
          }
        }, 15000);
      } catch (error) {
        console.warn('VRMA 手勢庫載入失敗：', error?.message);
      }
    })();

    aiAvatarWidget.speechEngine.spokenDisplayText =
      await getWelcomeText(aiAvatarWidget);
    if (typeof aiAvatarWidget.onReady === 'function') {
      aiAvatarWidget.onReady(aiAvatarWidget);
    }

    function playGesture(name) {
      // 播一個手勢（期間 mixer 控身體），平時用程序化站姿
      const act = gestureActions[name];
      if (!act || waving) return; // 一次一個，播放中不打斷
      waving = true;
      currentGesture = act;
      act.reset();
      act.setEffectiveWeight(1);
      act.play(); // 硬切，不 fadeIn（fade 低權重會露出 bind T-pose）
    }
    canvas.addEventListener('pointerdown', () => {
      playGesture(
        TAP_GESTURES[Math.floor(Math.random() * TAP_GESTURES.length)]
      );
      onTap(aiAvatarWidget);
    });

    let alive = true;
    (function loop() {
      if (!alive) return;
      const delta = clock.getDelta();
      const elapsedTime = clock.elapsedTime;
      if (vrm) {
        if (mixer) {
          mixer.update(delta); // 揮手時 mixer 控身體
        }
        const expressionManager = vrm.expressionManager;
        // 對嘴 + 眨眼（永遠歸我們，mixer 之後 vrm.update 之前）
        const mv = computeMouth(aiAvatarWidget);
        expressionManager.setValue('aa', mv);
        if (blinkT < 0) {
          nextBlink -= delta;
          if (nextBlink <= 0) {
            blinkT = 0;
            nextBlink = 2 + Math.random() * 4;
          }
        } else {
          blinkT += delta / BLINK;
          expressionManager.setValue(
            'blink',
            Math.sin(Math.min(blinkT, 1) * Math.PI)
          );
          if (blinkT >= 1) {
            blinkT = -1;
            expressionManager.setValue('blink', 0);
          }
        }

        // ①情緒表情：慢慢 ease 進／出；換情緒時把舊的歸零，缺這個 preset 的模型自動 no-op
        if (
          expressionManager &&
          (aiAvatarWidget.emo.target > 0 ||
            aiAvatarWidget.emo.weight > 0.005 ||
            aiAvatarWidget.emo.applied)
        ) {
          if (
            aiAvatarWidget.emo.applied &&
            aiAvatarWidget.emo.applied !== aiAvatarWidget.emo.name
          ) {
            try {
              expressionManager.setValue(aiAvatarWidget.emo.applied, 0);
            } catch (_error) {}
            aiAvatarWidget.emo.applied = '';
          }
          aiAvatarWidget.emo.weight +=
            (aiAvatarWidget.emo.target - aiAvatarWidget.emo.weight) *
            Math.min(1, delta * 4);
          if (
            aiAvatarWidget.emo.weight <= 0.005 &&
            aiAvatarWidget.emo.target === 0
          ) {
            aiAvatarWidget.emo.weight = 0;
            if (aiAvatarWidget.emo.applied) {
              try {
                expressionManager.setValue(aiAvatarWidget.emo.applied, 0);
              } catch (_error) {}
              aiAvatarWidget.emo.applied = '';
            }
          } else if (aiAvatarWidget.emo.name !== 'neutral') {
            try {
              const ex = expressionManager.getExpression
                ? expressionManager.getExpression(aiAvatarWidget.emo.name)
                : null;
              const weight =
                ex?.overrideMouth && String(ex.overrideMouth) !== 'none'
                  ? Math.min(aiAvatarWidget.emo.weight, 0.4)
                  : aiAvatarWidget.emo.weight; // 別把對嘴蓋死
              expressionManager.setValue(aiAvatarWidget.emo.name, weight);
              aiAvatarWidget.emo.applied = aiAvatarWidget.emo.name;
            } catch (_error) {}
          }
        }

        lookTarget.position.set(mx * 0.9, 1.42 - my * 0.55, 1.6); // 眼睛 lookAt 目標跟游標（永遠更新）
        if (!waving) {
          // 待機：直立、手放下、輕呼吸、頭跟游標
          const humanoid = vrm.humanoid;
          const lUA = humanoid.getNormalizedBoneNode('leftUpperArm');
          const rUA = humanoid.getNormalizedBoneNode('rightUpperArm');
          const sp = humanoid.getNormalizedBoneNode('spine');
          const hd = humanoid.getNormalizedBoneNode('head');
          let armL = 1.15 * armSign;
          let armR = -1.15 * armSign;
          const spX = Math.sin(elapsedTime * 0.9) * 0.018;
          let spY = Math.sin(elapsedTime * 0.5) * 0.012;
          let hdY = mx * 0.3;
          let hdX = my * 0.12 + Math.sin(elapsedTime * 0.5) * 0.01;
          if (aiAvatarWidget.speechEngine.isSpeaking) {
            // 講話時：身體/頭/手持續小動作（疊在站姿上）
            const ts = elapsedTime * 3.0;
            spY += Math.sin(ts) * 0.03;
            hdX += Math.abs(Math.sin(ts * 0.9)) * 0.045; // 點頭
            hdY += Math.sin(ts * 0.55) * 0.05; // 轉頭
            armL += Math.sin(ts * 0.7) * 0.06; // 手臂比劃
            armR -= Math.sin(ts * 0.62) * 0.06;
          }
          if (lUA) lUA.rotation.z = armL;
          if (rUA) rUA.rotation.z = armR;
          if (sp) {
            sp.rotation.x = spX;
            sp.rotation.y = spY;
          }
          if (hd) {
            hd.rotation.y = hdY;
            hd.rotation.x = hdX;
          }
        }
        vrm.update(delta); // 套用骨架/表情/springbone
      }
      webGLRenderer.render(scene, camera);

      requestAnimationFrame(loop);
    })();

    return {
      aiAvatarWidget,
      rootContainer,
      gltf,
      get vrm() {
        return vrm;
      },
      dispose() {
        alive = false;
        aiAvatarWidget.gesture3D = null;
        aiAvatarWidget.gesture2D = null;
        try {
          clearInterval(idleBreak);
        } catch (_error) {}
        rootContainer.removeEventListener('resize', resize);
        rootContainer.removeEventListener('pointermove', onMove);
        try {
          if (typeof mixer?.stopAllAction === 'function') {
            mixer.stopAllAction();
          }
        } catch (_error) {}
        try {
          if (vrm) {
            VRMUtils.deepDispose(vrm.scene);
          }
        } catch (_error) {} // 釋放 3D 幾何/材質，避免殘骸與 WebGL context 累積
        try {
          webGLRenderer.dispose();
        } catch (_error) {}
        try {
          webGLRenderer.forceContextLoss();
        } catch (_error) {}
        canvas.remove();
        vrm = null;
      }
    };
  } catch (error) {
    console.error(error);
    if (typeof aiAvatarWidget.onError === 'function') {
      aiAvatarWidget.onError(error, aiAvatarWidget);
    }
  }
}

// skin.js
// ===== 2D 皮：Live2D 載入 + 對嘴 =====
async function bootAvatar(aiAvatarWidget = null, modelUrl = DEFAULT_MODEL_URL) {
  const rootContainer = aiAvatarWidget?.container;
  if (rootContainer instanceof HTMLElement === false) {
    console.error('[aiAvatar bootAvatar] rootContainer is not an HTMLElement');
    return;
  }
  const stageEl = aiAvatarWidget?.uiDom?.stageEl;
  if (stageEl instanceof HTMLElement === false) {
    console.error('[aiAvatar bootAvatar] stageEl is not an HTMLElement');
    return;
  }
  try {
    await loadUMD(); // 用到才載 pixi + live2d
    const Live2DModel = window.PIXI.live2d.Live2DModel;
    try {
      Live2DModel.registerTicker(window.PIXI.Ticker);
    } catch (_error) {}

    const canvas = createCanvas(aiAvatarWidget);
    let pixiApp = new window.PIXI.Application({
      view: canvas,
      autoStart: true,
      backgroundAlpha: 0,
      antialias: true,
      resizeTo: stageEl
    });

    aiAvatarWidget.avatarModel = await Live2DModel.from(
      modelUrl || DEFAULT_MODEL_URL
    );
    pixiApp.stage.addChild(aiAvatarWidget.avatarModel);
    aiAvatarWidget.avatarModel.anchor.set(0.5, 1.0);

    // 關掉 Live2D 模型自帶的（日文）動作語音 — 只保留我們自己的 TTS（兩者來源不同，互不影響）
    try {
      if (window.PIXI.live2d.SoundManager) {
        window.PIXI.live2d.SoundManager.volume = 0;
      }
    } catch (_error) {}
    try {
      const ms =
        (aiAvatarWidget.avatarModel.internalModel.settings &&
          aiAvatarWidget.avatarModel.internalModel.settings.motions) ||
        {};
      for (const g of Object.keys(ms)) {
        (ms[g] || []).forEach((d) => {
          delete d.Sound;
          delete d.sound;
        });
      }
    } catch (_error) {}

    const safeFitMode = aiAvatarWidget.fitMode || DEFAULT_FIT_MODE;
    function fit() {
      const width = pixiApp.renderer.width;
      const height = pixiApp.renderer.height;
      const nativeH = aiAvatarWidget.avatarModel?.internalModel?.height || 1000;
      if (safeFitMode === FIT_MODE_MAP.HALF) {
        const ZOOM = 1.9; // 放大倍率：越大越近（半身越緊）
        const s = (height / nativeH) * 0.95 * ZOOM;
        aiAvatarWidget.avatarModel.scale.set(s);
        aiAvatarWidget.avatarModel.x = width / 2;
        aiAvatarWidget.avatarModel.y = nativeH * s + height * 0.04; // 腳推到畫面外、頭留 4% 上緣
      } else {
        aiAvatarWidget.avatarModel.scale.set((height / nativeH) * 0.95);
        aiAvatarWidget.avatarModel.x = width / 2;
        aiAvatarWidget.avatarModel.y = height;
      }
    }
    fit();
    window.addEventListener('resize', fit);

    try {
      const groups =
        aiAvatarWidget.avatarModel.internalModel.settings.groups || [];
      const g = groups.find((x) => (x.Name || '').toLowerCase() === 'lipsync');
      if (g?.Ids?.length) {
        aiAvatarWidget.lipIds = g.Ids;
      }
    } catch (_error) {}

    // 對嘴：攔截 coreModel.update（計算頂點前的最後一刻寫入嘴巴，保證不被 motion/loadParameters 洗掉）
    try {
      const core = aiAvatarWidget.avatarModel.internalModel.coreModel;
      const origUpdate = core.update.bind(core);
      core.update = function () {
        const mouth = computeMouth(aiAvatarWidget); // 共用嘴型計算（與 3D 同一套）
        for (const id of aiAvatarWidget.lipIds) {
          try {
            core.setParameterValueById(id, mouth);
          } catch (_error) {}
        }
        return origUpdate();
      };
    } catch (_error) {}

    aiAvatarWidget.avatarModel.on('hit', () => onTap(aiAvatarWidget));
    canvas.addEventListener('pointerdown', () => onTap(aiAvatarWidget));

    aiAvatarWidget.speechEngine.spokenDisplayText =
      await getWelcomeText(aiAvatarWidget);
    if (typeof aiAvatarWidget.onReady === 'function') {
      aiAvatarWidget.onReady(aiAvatarWidget);
    }

    return {
      aiAvatarWidget,
      rootContainer,
      get canvas() {
        return canvas;
      },
      get avatarModel() {
        return aiAvatarWidget.avatarModel;
      },
      get pixiApp() {
        return pixiApp;
      },
      dispose() {
        try {
          window.removeEventListener('resize', fit);
        } catch (_error) {}
        try {
          if (typeof pixiApp?.destroy === 'function') {
            pixiApp.destroy(true, {
              children: true,
              texture: true,
              baseTexture: true
            });
          }
        } catch (_error) {}
        pixiApp = null;
        aiAvatarWidget.avatarModel = null;
        canvas.remove();
      }
    };
  } catch (error) {
    console.error(error);

    const directWarnEl = aiAvatarWidget?.uiDom?.directWarnEl;
    if (
      directWarnEl instanceof HTMLParagraphElement ||
      directWarnEl instanceof HTMLDivElement
    ) {
      directWarnEl.textContent = '2D 啟動失敗：' + (error?.message || error);
      directWarnEl.style.display = 'flex';
    }
    if (typeof aiAvatarWidget.onError === 'function') {
      aiAvatarWidget.onError(error, aiAvatarWidget);
    }
  }
}

// skin.js | ui.js
// ===== 拖放自己的 VRM：把 .vrm 拖到角色上就直接換成你的 3D 角色（零改 code）=====
function loadVRMFile(aiAvatarWidget = null, file) {
  const engineButtonEl = aiAvatarWidget?.uiDom?.engineButtonEl;
  if (engineButtonEl instanceof HTMLElement === false) {
    console.error(
      '[aiAvatar loadVRMFile] aiAvatarWidget.uiDom.engineButtonEl is not an HTMLElement'
    );
    return;
  }

  if (
    file instanceof window.File === false ||
    /\.vrm$/i.test(file?.name || '') === false
  ) {
    aiAvatarWidget.speechEngine.spokenDisplayText = '請拖一個 .vrm 檔喔';
    return;
  }
  try {
    if (
      typeof aiAvatarWidget.vrmUrl === 'string' &&
      aiAvatarWidget.vrmUrl.indexOf('blob:') === 0
    ) {
      URL.revokeObjectURL(aiAvatarWidget.vrmUrl);
    }
  } catch (_error) {}
  aiAvatarWidget.vrmUrl = URL.createObjectURL(file);
  // 換上後也顯示 2D/3D 切換鈕
  if (engineButtonEl instanceof HTMLElement) {
    engineButtonEl.style.display = '';
    if (typeof engineButtonEl.onclick !== 'function') {
      engineButtonEl.onclick = () => {
        aiAvatarWidget.engineMode = ENGINE_MODE_MAP.threeDimensional
          ? ENGINE_MODE_MAP.twoDimensional
          : ENGINE_MODE_MAP.threeDimensional;
      };
    }
  }
  aiAvatarWidget.engineMode = null; // 強制重 boot（即使已在 3D）
  aiAvatarWidget.engineMode = ENGINE_MODE_MAP.threeDimensional;
  aiAvatarWidget.speechEngine.spokenDisplayText = '換上你的角色了！🎭';
}

// speech.js
// 整段文字 → 句子陣列（TTS 逐句抓、邊講邊抓下一句，長答案不用等整段）
function splitSentences(text) {
  const out = [];
  let buf = '';
  for (const ch of String(text || '')) {
    buf += ch;
    if (/[。！？!?；;\n…]/.test(ch)) {
      if (buf.trim()) {
        out.push(buf.trim());
      }
      buf = '';
    } else if (buf.length >= 80) {
      // 沒標點的長串：找逗號斷，不然硬切
      const cut = Math.max(buf.lastIndexOf('，'), buf.lastIndexOf(','));
      if (cut > 20) {
        out.push(buf.slice(0, cut + 1).trim());
        buf = buf.slice(cut + 1);
      } else {
        out.push(buf.trim());
        buf = '';
      }
    }
  }
  if (buf.trim()) {
    out.push(buf.trim());
  }
  const merged = []; // 太短的碎句併進前一句（太短的 TTS 不自然、請求也多）
  for (const s of out) {
    if (
      merged.length &&
      (s.length < 6 || merged[merged.length - 1].length < 6)
    ) {
      merged[merged.length - 1] += s;
    } else {
      merged.push(s);
    }
  }
  while (merged.length > 10) {
    // 上限 10 段：護 TTS 限流
    const m2 = [];
    for (let i = 0; i < merged.length; i += 2) {
      m2.push(merged[i] + (merged[i + 1] || ''));
    }
    merged.length = 0;
    merged.push.apply(merged, m2);
  }
  return merged;
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
// ===== TTS：開口說話 + 對嘴 =====
function loadVoice() {
  const voices = speechSynthesis.getVoices();
  const pick = (targetVoice) =>
    voices.find(
      (voice) =>
        targetVoice.test(`${voice.name} ${voice.lang}`) &&
        !/Google/i.test(voice.name)
    ); // 避開 Chrome 會靜默失敗的 Google 遠端語音

  return (
    pick(/(HsiaoChen|HsiaoYu|曉臻|曉雨).*zh/i) || // 微軟神經女聲（最自然，若有安裝）
    pick(/(Yating|Zhiwei).*zh[-_]TW/i) || // 較新、較不機械的微軟 zh-TW 女聲
    pick(/Microsoft.*zh[-_]TW/i) || // 任何微軟 zh-TW（本地、可靠）
    pick(/zh[-_]TW/i) ||
    pick(/^zh/i) ||
    voices.find((voice) => /zh/i.test(voice.lang)) ||
    null
  );
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

  setEmotion(aiAvatarWidget, 'neutral');
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
  setEmotionFromText(aiAvatarWidget, text); // ①講話帶情緒（3D 表情；要在 beginSpeech 之後，不然被 reset）
  for (const s of splitSentences(text)) {
    pushSpeech(aiAvatarWidget, sid, s);
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
    aiAvatarWidget.emo.target = 0;
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
// speech.js
function prefetchSpeech(aiAvatarWidget = null, sid) {
  // 只預抓最前面 2 句（在途 ≤2），護後端限流
  if (
    sid !== aiAvatarWidget.speechEngine.speakSeq ||
    aiAvatarWidget.speechEngine.neuralDisabled
  ) {
    return;
  }
  for (const item of aiAvatarWidget.speechEngine.speechQ.slice(0, 2)) {
    if (!item.prep && !item.err) {
      item.prep = fetchTTSBuffer(aiAvatarWidget, item.text).catch((e) => {
        item.err = e;
        return null;
      });
    }
  }
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
      setEmotion(aiAvatarWidget, 'neutral');
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
// speech.js
function handleNeuralFail(aiAvatarWidget = null, e) {
  const msg = e?.message || '';
  if (/http 429/.test(msg)) {
    console.warn('TTS 被限流，這句退瀏覽器語音');
    return;
  } // 429 是暫時的，別鎖死神經語音
  if (/http 4\d\d|Failed to fetch|NetworkError|Load failed/i.test(msg)) {
    aiAvatarWidget.speechEngine.neuralDisabled = true; // 結構性失敗(無後端/CORS/被擋)→不再試
  }
  console.warn('神經語音失敗，退回瀏覽器語音：', msg);
}

// speech.js
// edge-tts 神經語音：抓 /api/tts 的 MP3 → AudioBuffer（給佇列預抓用）
async function fetchTTSBuffer(aiAvatarWidget = null, text) {
  const safeAudioContext = window.AudioContext || window.webkitAudioContext;
  if (
    aiAvatarWidget.speechEngine.audioCtx instanceof safeAudioContext ===
    false
  ) {
    aiAvatarWidget.speechEngine.audioCtx = new safeAudioContext();
  }
  if (aiAvatarWidget.speechEngine.audioCtx.state === 'suspended') {
    try {
      await aiAvatarWidget.speechEngine.audioCtx.resume();
    } catch (_error) {}
  }
  const sep =
    aiAvatarWidget.speechEngine.ttsEndpoint.indexOf('?') < 0 ? '?' : '&';
  const response = await fetch(
    aiAvatarWidget.speechEngine.ttsEndpoint +
      sep +
      'voice=' +
      encodeURIComponent(aiAvatarWidget.speechEngine.neuralVoice) +
      '&text=' +
      encodeURIComponent(text)
  );
  if (!response.ok) {
    throw new Error('http ' + response.status);
  }
  const respArrayBuffer = await response.arrayBuffer();
  if (respArrayBuffer.byteLength < 800) {
    throw new Error('audio too small');
  }
  return aiAvatarWidget.speechEngine.audioCtx.decodeAudioData(respArrayBuffer);
}
// speech.js
// 播一句（Web Audio + AnalyserNode 以「實際音量」驅動嘴型），播完呼叫 done 換下一句
function playBuffer(aiAvatarWidget = null, audioBuf, done) {
  const src = aiAvatarWidget.speechEngine.audioCtx.createBufferSource();
  src.buffer = audioBuf;
  const analyser = aiAvatarWidget.speechEngine.audioCtx.createAnalyser();
  analyser.fftSize = 256;
  src.connect(analyser);
  analyser.connect(aiAvatarWidget.speechEngine.audioCtx.destination);
  const data = new Uint8Array(analyser.fftSize);
  aiAvatarWidget.speechEngine.currentSource = src;
  aiAvatarWidget.speechEngine.useAudioMouth = true;
  aiAvatarWidget.speechEngine.isSpeaking = true;
  if (!aiAvatarWidget.speechEngine.tapDone) {
    aiAvatarWidget.speechEngine.tapDone = true;
    if (aiAvatarWidget.avatarModel) {
      try {
        aiAvatarWidget.avatarModel.motion('Tap');
      } catch (_error) {}
    }
  } // Tap 動作一段話只做一次
  function audioLoop() {
    if (aiAvatarWidget.speechEngine.currentSource !== src) {
      return; // 不是我在播了就停
    }
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    aiAvatarWidget.speechEngine.audioMouth = Math.min(
      1,
      Math.sqrt(sum / data.length) * 3.4
    ); // RMS 音量 → 開口
    aiAvatarWidget.speechEngine.currentFps = requestAnimationFrame(audioLoop);
  }
  aiAvatarWidget.speechEngine.currentFps = requestAnimationFrame(audioLoop);
  src.onended = () => {
    // 自然播完才收尾；被打斷時 onended 已被清掉
    if (aiAvatarWidget.speechEngine.currentSource !== src) {
      return;
    }
    if (
      typeof aiAvatarWidget.speechEngine.currentFps === 'number' &&
      aiAvatarWidget.speechEngine.currentFps > 0
    ) {
      cancelAnimationFrame(aiAvatarWidget.speechEngine.currentFps);
      aiAvatarWidget.speechEngine.currentFps = 0;
    }
    aiAvatarWidget.speechEngine.isSpeaking = false;
    aiAvatarWidget.speechEngine.useAudioMouth = false;
    aiAvatarWidget.speechEngine.audioMouth = 0;
    aiAvatarWidget.speechEngine.currentSource = null;
    done();
  };
  src.start(0);
}

// speech.js
// 後備：瀏覽器內建語音(Yating) 逐句版。對嘴用「估時長」驅動，不靠 speechSynthesis.speaking 輪詢
// （Chrome 在 cancel 後常回報失準 → 第二次說話嘴巴就不動了）
function speakBrowserChunk(aiAvatarWidget = null, text, sid, done) {
  if (
    aiAvatarWidget.speechEngine.ttsMuted === true ||
    'speechSynthesis' in window === false
  ) {
    done();
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  if (
    typeof aiAvatarWidget.speechEngine.ttVoice !== 'object' ||
    aiAvatarWidget.speechEngine.ttVoice === null
  ) {
    aiAvatarWidget.speechEngine.ttVoice = loadVoice(aiAvatarWidget);
  }
  if (
    typeof aiAvatarWidget.speechEngine.ttVoice === 'object' &&
    aiAvatarWidget.speechEngine.ttVoice !== null
  ) {
    utterance.voice = aiAvatarWidget.speechEngine.ttVoice;
  }
  utterance.lang = aiAvatarWidget.speechEngine.ttVoice?.lang || 'zh-TW';
  utterance.rate = aiAvatarWidget.speechEngine.ttsRate || 1.0;
  utterance.pitch = 1.0;
  utterance.onboundary = () => {
    aiAvatarWidget.speechEngine.mouthTarget = 0.5 + Math.random() * 0.5;
  };
  let fin = false;
  const finish = () => {
    if (fin) {
      return;
    }
    fin = true;
    aiAvatarWidget.speechEngine.isSpeaking = false;
    done();
  };
  utterance.onend = finish;
  const estMs = Math.min(
    16000,
    Math.max(
      1200,
      (text.length * 130) / (aiAvatarWidget.speechEngine.ttsRate || 1)
    )
  );
  const fire = () => {
    if (sid !== aiAvatarWidget.speechEngine.speakSeq) {
      return; // 排隊期間被打斷就不講了
    }
    try {
      speechSynthesis.resume();
    } catch (_error) {} // 解 Chrome cancel 後卡住的 bug
    speechSynthesis.speak(utterance);
    aiAvatarWidget.speechEngine.isSpeaking = true;
    aiAvatarWidget.speechEngine.mouthTarget = 0.7;
    if (!aiAvatarWidget.speechEngine.tapDone) {
      aiAvatarWidget.speechEngine.tapDone = true;
      if (aiAvatarWidget.avatarModel) {
        try {
          aiAvatarWidget.avatarModel.motion('Tap');
        } catch (_error) {}
      }
    }
    clearTimeout(aiAvatarWidget.speechEngine.speakBrowserTimer);
    aiAvatarWidget.speechEngine.speakBrowserTimer = setTimeout(finish, estMs); // 保底：時間到閉嘴＋換下一句，不依賴事件
  };
  if (speechSynthesis.speaking || speechSynthesis.pending) {
    speechSynthesis.cancel();
    setTimeout(fire, 120);
  } else {
    fire();
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

// brain.js
async function getWelcomeText(aiAvatarWidget = null) {
  let welcomeText =
    '點 🎤 說話、或直接打字問我；想更聰明可按 🧠 啟用 AI 大腦 👋';

  if (typeof aiAvatarWidget?.brainEngine?.welcomeText === 'function') {
    welcomeText = await aiAvatarWidget.brainEngine.welcomeText(
      {
        isCompanion: aiAvatarWidget.brainEngine.mem.isCompanion,
        visits: aiAvatarWidget.brainEngine.mem.data.visits,
        name: aiAvatarWidget.brainEngine.mem.data.name
      },
      aiAvatarWidget
    );
  } else if (typeof aiAvatarWidget?.brainEngine?.welcomeText === 'string') {
    welcomeText = aiAvatarWidget.brainEngine.welcomeText;
  } else if (aiAvatarWidget?.avatarMode === AVATAR_MODE_MAP.companion) {
    if (
      typeof aiAvatarWidget?.brainEngine?.companionWelcomeText === 'function'
    ) {
      welcomeText =
        await aiAvatarWidget.brainEngine.companionWelcomeText(aiAvatarWidget);
    } else if (aiAvatarWidget.brainEngine.mem.data.visits > 1) {
      welcomeText =
        (aiAvatarWidget.brainEngine.mem.data.name
          ? aiAvatarWidget.brainEngine.mem.data.name + '，'
          : '') +
        '歡迎回來～這是我們第 ' +
        aiAvatarWidget.brainEngine.mem.data.visits +
        ' 次見面！點 💬 繼續聊，我記得我們聊過什麼喔';
    } else if (
      typeof aiAvatarWidget.brainEngine.companionWelcomeText === 'string'
    ) {
      welcomeText = aiAvatarWidget.brainEngine.companionWelcomeText;
    } else {
      welcomeText =
        '嗨～我是這裡的陪聊虛擬人！點 💬 就能連續對話，我會記得你說過的話（只存在你這台瀏覽器，說『忘記我』就清掉）';
    }
  } else if (
    typeof aiAvatarWidget?.brainEngine?.assistantWelcomeText === 'function'
  ) {
    welcomeText =
      await aiAvatarWidget.brainEngine.assistantWelcomeText(aiAvatarWidget);
  } else if (
    typeof aiAvatarWidget?.brainEngine?.assistantWelcomeText === 'string'
  ) {
    welcomeText = aiAvatarWidget.brainEngine.assistantWelcomeText;
  }

  return welcomeText;
}

// brain.js | speech.js
async function webLLMBrain(aiAvatarWidget = null, question) {
  try {
    aiAvatarWidget.speechEngine.spokenDisplayText = '讓我想想…';

    handleGesture(aiAvatarWidget, 'thinking');

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
          setEmotionFromText(aiAvatarWidget, sofar);
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
  throw new Error(
    `WebLLM did not return a string or returned an empty string: ${out}`
  );
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
  console.log(aiAvatarWidget.brainEngine.aiProvider);
  try {
    // 1) Ollama 伺服器大腦（最聰明，優先；整段生成後逐句講）
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
  } catch (_error) {}

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

// skin.js | speech.js
// ===== 共用：每幀算出嘴巴開合 0..1（2D 寫 ParamMouthOpenY、3D 寫 aa 表情，共用同一套計算）=====
function computeMouth(aiAvatarWidget = null) {
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

// speech.js | brain.js | skin.js
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
  if (aiAvatarWidget.avatarModel) {
    try {
      aiAvatarWidget.avatarModel.motion('Tap');
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

// brain.js
// 啟用本機 Ollama 時：開機 ping 一下，連上就把 🧠 切成「本機大腦」狀態
async function initOllama(aiAvatarWidget = null) {
  if (aiAvatarWidget?.container instanceof HTMLElement === false) {
    console.error(
      '[aiAvatar initOllama] aiAvatarWidget.container is not an HTMLElement'
    );
    return;
  }

  if (aiAvatarWidget.brainEngine.aiProvider?.enabled !== true) {
    return;
  }

  // aiAvatarWidget.brainEngine.connecting = true;
  // const btnLlm = aiAvatarWidget.uiDom.btnLlmEl;
  // if (btnLlm instanceof HTMLElement) {
  //   btnLlm.textContent = '🧠…';
  //   btnLlm.title = 'Ollama 伺服器大腦（連線中）';
  // }
  // const ok = await aiAvatarWidget.brainEngine.aiProvider.ping();
  await aiAvatarWidget.brainEngine.aiProvider.ping();

  // aiAvatarWidget.brainEngine.connecting = false;
  // aiAvatarWidget.brainEngine.connected = ok;

  // if (btnLlm instanceof HTMLElement) {
  //   btnLlm.textContent = ok ? '🧠本機' : '🧠✗';
  //   btnLlm.classList.toggle('llm-on', ok);
  //   btnLlm.setAttribute('aria-pressed', String(ok));
  //   btnLlm.title = ok
  //     ? 'Ollama 伺服器：已連線 ' + aiAvatarWidget.brainEngine.aiProvider.model
  //     : 'Ollama 伺服器連不上（檢查 Ollama 是否在跑 / CORS）';
  // }
  // if (ok === true) {
  //   setTimeout(() => {
  //     aiAvatarWidget.speechEngine.spokenDisplayText =
  //       '已接上 Ollama 伺服器大腦（' +
  //       aiAvatarWidget.brainEngine.aiProvider.model +
  //       '）🧠 問我問題吧！';
  //   }, 1300);
  // }
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

      // 啟用本機 Ollama 模式時：🧠 用來顯示狀態 / 重新連線，不下載 WebLLM
      if (aiAvatarWidget.brainEngine.aiProvider?.enabled === true) {
        const ok =
          aiAvatarWidget.brainEngine.aiProvider.ready ||
          (await aiAvatarWidget.brainEngine.aiProvider.ping());
        // el.textContent = ok ? '🧠本機' : '🧠✗';
        el.textContent = ok ? '🧠✓' : '🧠✗';
        el.classList.toggle('llm-on', ok);
        el.setAttribute('aria-pressed', String(ok));
        aiAvatarWidget.speechEngine.spokenDisplayText = ok
          ? 'Ollama 伺服器 AI 大腦運作中（' +
            aiAvatarWidget.brainEngine.aiProvider.model +
            '）🧠'
          : 'Ollama 伺服器連不上：確認 Ollama 在跑、且 AI_PROVIDER_ORIGINS 已允許這個網站。';

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
    neuralVoice = '',
    knowledgeUrl = '',
    companionKnowledgeUrl = '',
    modelUrl = '',
    ttsEndpoint = DEFAULT_TTS_ENDPOINT, // 沒設→試同站相對路徑；抓不到→自動退回瀏覽器語音（純前端可用）
    llmModel = DEFAULT_LLM_MODEL,
    avatarMode = DEFAULT_AVATAR_MODE,
    knowledge = null,
    companionKnowledge = null,
    startMode = DEFALUT_START_MODE,
    fitMode = DEFAULT_FIT_MODE,
    vrmUrl = '',
    gesture2D = null,
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

  const safeModelUrl =
    modelUrl ||
    (safeGender === GENDER_MAP.female
      ? DEFAULT_FEMALE_MODEL_URL
      : DEFAULT_MALE_MODEL_URL);

  const safeGesture2D =
    gesture2D ||
    ([DEFAULT_FEMALE_MODEL_URL, DEFAULT_MALE_MODEL_URL].includes(safeModelUrl)
      ? defaultGesture2D
      : null);

  const safeVrmUrl =
    vrmUrl || (/\.vrm($|\?)/i.test(safeModelUrl) ? safeModelUrl : '');
  const uiDom = initUi(container);

  let brainEngine = null;
  let speechEngine = null;

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

    get DEFAULT_MODEL_URL() {
      return DEFAULT_MODEL_URL;
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
    get setEmotion() {
      return setEmotion;
    },

    get setEmotionFromText() {
      return setEmotionFromText;
    },

    get isIframe() {
      return isIframe;
    },

    // ①情緒表情狀態：speak 時從文字判斷 → 3D 表情 preset 慢慢 ease 進、講完 ease 回中性（2D 模型表情規格不一，先不套）
    emo: { name: 'neutral', target: 0, weight: 0, applied: '' },

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
      this.uiDom.stageEl.style.left = '100vw';
      this.uiDom.stageEl.style.opacity = 0;
      this.uiDom.stageEl.style.userSelect = 'none';
      // this.uiDom.stageEl.style.display = "none";
      this.uiDom.minimalEl.style.display = 'flex';
    },
    hiddenMinimalEl() {
      this.uiDom.stageEl.style.left = '';
      this.uiDom.stageEl.style.opacity = 1;
      this.uiDom.stageEl.style.userSelect = 'auto';
      // this.uiDom.stageEl.style.display = "block";
      this.uiDom.minimalEl.style.display = 'none';
    },

    // 狀態
    // 皮的引擎判斷：data-vrm 指向 .vrm → 走 3D(VRM)；否則 data-model(.model3.json) → 走 2D(Live2D)
    _vrmUrl: safeVrmUrl, // let：拖放自己的 VRM 時可換,
    get vrmUrl() {
      return this._vrmUrl;
    },
    set vrmUrl(newVrmUrl = '') {
      if (typeof newVrmUrl === 'string' && newVrmUrl !== '') {
        this._vrmUrl = newVrmUrl;
      }
    },

    get has2D() {
      return !!this.modelUrl;
    },

    get has3D() {
      return !!this.vrmUrl;
    },

    _startMode: startMode || DEFALUT_START_MODE,
    get startMode() {
      return this._startMode;
    },
    set startMode(newStartMode = '') {
      if (typeof newStartMode === 'string' && newStartMode !== '') {
        this._startMode = newStartMode;
      }
    },

    _fitMode: fitMode || DEFAULT_FIT_MODE,
    get fitMode() {
      return this._fitMode;
    },
    set fitMode(newFitMode = '') {
      if (typeof newFitMode === 'string' && newFitMode !== '') {
        if (Object.values(this.FIT_MODE_MAP).includes(newFitMode)) {
          this._fitMode = newFitMode;
        } else {
          this._fitMode = DEFAULT_FIT_MODE;
        }
      }
    },

    _switching: null,
    get switching() {
      return this._switching;
    },
    set switching(newSwitching = null) {
      if (typeof newSwitching === 'boolean') {
        this._switching = newSwitching;
      }
    },

    _renderer: null,
    get renderer() {
      return this._renderer;
    },
    set renderer(newRenderer = null) {
      this._renderer = newRenderer;
    },

    _engineMode: null,
    get engineMode() {
      return this._engineMode;
    },
    set engineMode(newEngineMode = '') {
      if (this.switching === true || newEngineMode === this.engineMode) {
        return;
      }

      if (
        (typeof newEngineMode === 'string' && newEngineMode !== '') ||
        newEngineMode === null
      ) {
        this._engineMode = newEngineMode;

        this.uiDom.engineButtonEl.textContent =
          newEngineMode === this.ENGINE_MODE_MAP.threeDimensional ? '3D' : '2D';

        (async () => {
          this.switching = true;

          if (typeof this?.renderer?.dispose === 'function') {
            try {
              this.renderer.dispose();
            } catch (_error) {}
            this.renderer = null;
          }
          try {
            this.renderer =
              newEngineMode === this.ENGINE_MODE_MAP.threeDimensional
                ? await bootVRM(this, this.modelSettings)
                : await bootAvatar(this, this.modelUrl);
          } catch (error) {
            console.error(error);
          }

          this.switching = false;
        })();
      }
    },

    _lipIds: ['ParamMouthOpenY'],
    get lipIds() {
      return this._lipIds;
    },
    set lipIds(newLipIds) {
      if (Array.isArray(newLipIds) || newLipIds === null) {
        this._lipIds = newLipIds;
      }
    },

    // 3D 手勢觸發 hook（bootVRM 設定；2D 模式為 null → 自動 no-op）
    _gesture3D: null,
    get gesture3D() {
      return this._gesture3D;
    },
    set gesture3D(newGesture3D) {
      if (typeof newGesture3D === 'function' || newGesture3D === null) {
        this._gesture3D = newGesture3D;
      }
    },

    _gesture2D: null,
    get gesture2D() {
      return this._gesture2D;
    },
    set gesture2D(newGesture2D) {
      if (typeof newGesture2D === 'function' || newGesture2D === null) {
        this._gesture2D = newGesture2D;
      }
    },

    get gesture() {
      if (this.engineMode === ENGINE_MODE_MAP.threeDimensional) {
        return this.gesture3D;
      } else if (this.engineMode === ENGINE_MODE_MAP.twoDimensional) {
        return this.gesture2D;
      }
      return null;
    },

    _modelUrl: safeModelUrl,
    get modelUrl() {
      return this._modelUrl;
    },
    set modelUrl(newModelUrl = '') {
      if (typeof newModelUrl === 'string' && newModelUrl !== '') {
        this._modelUrl = newModelUrl;
      }
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
          this.modelUrl = DEFAULT_FEMALE_MODEL_URL;
        } else if (newGender === GENDER_MAP.male) {
          this.speechEngine.neuralVoice = DEFAULT_MALE_NEURAL_VOICE;
          this.modelUrl = DEFAULT_MALE_MODEL_URL;
        }
      }
    },

    _llmModel: llmModel || DEFAULT_LLM_MODEL,
    get llmModel() {
      return this._llmModel;
    },
    set llmModel(newLlmModel = '') {
      if (typeof newLlmModel === 'string' && newLlmModel !== '') {
        this._llmModel = newLlmModel;
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

    onTapTimer: false
  };

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
          btnLlmEl.title = 'Ollama 伺服器大腦（連線中）';
        }
      },
      onAiProviderConnected(response) {
        const ok = response?.ok || false;
        const btnLlmEl = uiDom.btnLlmEl;

        if (btnLlmEl instanceof HTMLElement) {
          btnLlmEl.textContent = ok ? '🧠✓' : '🧠✗';
          btnLlmEl.classList.toggle('llm-on', ok);
          btnLlmEl.setAttribute('aria-pressed', String(ok));
          btnLlmEl.title = ok
            ? 'Ollama 伺服器：已連線 ' +
              aiAvatarWidget.brainEngine.aiProvider.model
            : 'Ollama 伺服器連不上（檢查 Ollama 是否在跑 / CORS）';
        }
        if (ok === true) {
          setTimeout(() => {
            aiAvatarWidget.speechEngine.spokenDisplayText =
              '已接上 Ollama 伺服器大腦（' +
              aiAvatarWidget.brainEngine.aiProvider.model +
              '）🧠 問我問題吧！';
          }, 1300);
        }
      }
    },
    aiAvatarWidget
  );

  speechEngine = {
    avatarMode: '', // 不確定？

    _mouthTarget: 0.7, // 可能要歸在 skin ?
    get mouthTarget() {
      return this._mouthTarget;
    },
    set mouthTarget(newMouthTarget) {
      if (typeof newMouthTarget === 'number' || newMouthTarget === null) {
        this._mouthTarget = newMouthTarget;
      }
    },

    _mouthValue: 0, // 可能要歸在 skin ?
    get mouthValue() {
      return this._mouthValue;
    },
    set mouthValue(newMouthValue) {
      if (typeof newMouthValue === 'number' || newMouthValue === null) {
        this._mouthValue = newMouthValue;
      }
    },

    _speakSeq: 0,
    get speakSeq() {
      return this._speakSeq;
    },
    set speakSeq(newSpeakSeq) {
      if (typeof newSpeakSeq === 'number' || newSpeakSeq === null) {
        this._speakSeq = newSpeakSeq;
      }
    },

    // ②逐句開講的佇列狀態（var：這檔案有「宣告前就被呼叫」的前例，避 TDZ）
    speechQ: [],
    speechEnded: false,
    isSpeechPlaying: false,
    tapDone: false,

    speakBrowserTimer: 0,
    spokenDisplayTextTimer: 0,

    // 控制「點第二下打斷第一下」
    _currentFps: 0,
    get currentFps() {
      return this._currentFps;
    },
    set currentFps(newCurrentFps) {
      if (typeof newCurrentFps === 'number' || newCurrentFps === null) {
        this._currentFps = newCurrentFps;
      }
    },

    _currentSource: null,
    get currentSource() {
      return this._currentSource;
    },
    set currentSource(newCurrentSource) {
      if (typeof newCurrentSource === 'object') {
        this._currentSource = newCurrentSource;
      }
    },

    _isSpeaking: false,
    get isSpeaking() {
      return this._isSpeaking;
    },
    set isSpeaking(newIsSpeaking) {
      if (typeof newIsSpeaking === 'boolean' || newIsSpeaking === null) {
        this._isSpeaking = newIsSpeaking;
      }
    },

    _useAudioMouth: false,
    get useAudioMouth() {
      return this._useAudioMouth;
    },
    set useAudioMouth(newUseAudioMouth) {
      if (typeof newUseAudioMouth === 'boolean' || newUseAudioMouth === null) {
        this._newUseAudioMouth = newUseAudioMouth;
      }
    },

    _audioMouth: 0,
    get audioMouth() {
      return this._audioMouth;
    },
    set audioMouth(newAudioMouth) {
      if (typeof newAudioMouth === 'number' || newAudioMouth === null) {
        this._audioMouth = newAudioMouth;
      }
    },

    _ttsMuted: false,
    get ttsMuted() {
      return this._ttsMuted;
    },
    set ttsMuted(newTtsMuted) {
      if (typeof newTtsMuted === 'boolean' || newTtsMuted === null) {
        this._ttsMuted = newTtsMuted;
      }
    },

    // 連續對話（陪伴模式）：她講完 → 自動重開麥。她講話期間不開麥（會聽到自己的聲音）
    convoOn: false,
    noSpeechRuns: 0,

    isListening: false,

    // 抓不到神經語音後端就鎖定瀏覽器語音，避免每句都打 404
    _neuralDisabled: false,
    get neuralDisabled() {
      return this._neuralDisabled;
    },
    set neuralDisabled(newNeuralDisabled) {
      if (
        typeof newNeuralDisabled === 'boolean' ||
        newNeuralDisabled === null
      ) {
        this._neuralDisabled = newNeuralDisabled;
      }
    },

    _audioCtx: null,
    get audioCtx() {
      return this._audioCtx;
    },
    set audioCtx(newAudioCtx = null) {
      if (typeof newAudioCtx === 'object') {
        this._audioCtx = newAudioCtx;
      }
    },

    _ttsEndpoint: ttsEndpoint || DEFAULT_TTS_ENDPOINT,
    get ttsEndpoint() {
      return this._ttsEndpoint;
    },
    set ttsEndpoint(newTtsEndpoint = '') {
      if (typeof newTtsEndpoint === 'string' && newTtsEndpoint !== '') {
        this._ttsEndpoint = newTtsEndpoint;
      }
    },

    _neuralVoice: safeNeuralVoice,
    get neuralVoice() {
      return this._neuralVoice; // 神經語音
    },
    set neuralVoice(newNeuralVoice = '') {
      if (typeof newNeuralVoice === 'string' || newNeuralVoice === null) {
        this._neuralVoice = newNeuralVoice;
      }
    },

    _ttVoice: null,
    get ttVoice() {
      return this._ttVoice;
    },
    set ttVoice(newTtVoice) {
      if (typeof newTtVoice === 'object') {
        this._ttVoice = newTtVoice;
      }
    },

    _ttsRate: 1.0,
    get ttsRate() {
      return this._ttsRate;
    },
    set ttsRate(newTtsRate) {
      if (typeof newTtsRate === 'number' || newTtsRate === null) {
        this._ttsRate = newTtsRate;
      }
    },

    _spokenDisplayText: '',
    get spokenDisplayText() {
      return this._spokenDisplayText;
    },
    set spokenDisplayText(newSpeakingLabel) {
      if (typeof newSpeakingLabel === 'string' || newSpeakingLabel === null) {
        this._spokenDisplayText = newSpeakingLabel;

        if (typeof this.onSpokenDisplayTextChange === 'function') {
          this.onSpokenDisplayTextChange(newSpeakingLabel, aiAvatarWidget);
        }
      }
    },
    get speak() {
      return function _speak(text) {
        return speak(aiAvatarWidget, String(text || '').slice(0, 600));
      };
    },
    _spokenAudioText: '',
    get spokenAudioText() {
      return this._spokenAudioText;
    },
    set spokenAudioText(newSpeakingSounds) {
      if (typeof newSpeakingSounds === 'string' || newSpeakingSounds === null) {
        this._spokenAudioText = newSpeakingSounds;

        this.spokenDisplayText = newSpeakingSounds;
        if (typeof this.onSpeaking === 'function') {
          this.onSpeaking(newSpeakingSounds, aiAvatarWidget);
        }
        this.speak(newSpeakingSounds);
      }
    },

    _recognition: null,
    get recognition() {
      return this._recognition;
    },
    set recognition(newRecognition) {
      if (typeof newRecognition === 'object') {
        this._recognition = newRecognition;
      }
    },

    get onSpeaking() {
      return function (text, currentAiAvatar, ...args) {
        if (typeof optiopns.onSpeaking === 'function') {
          return optiopns.onSpeaking.call(
            currentAiAvatar,
            text,
            currentAiAvatar,
            ...args
          );
        }
      };
    },
    get onSpeakingEnd() {
      return function (text, currentAiAvatar, ...args) {
        if (typeof optiopns.onSpeakingEnd === 'function') {
          return optiopns.onSpeakingEnd.call(
            currentAiAvatar,
            text,
            currentAiAvatar,
            ...args
          );
        }
      };
    },
    get onSpokenDisplayTextChange() {
      return function _onSpokenDisplayTextChange(
        newSpeakingLabel,
        currentAiAvatar,
        ...args
      ) {
        uiDom.bubbleEl.textContent = newSpeakingLabel;
        uiDom.bubbleEl.classList.add('show');
        clearTimeout(this.spokenDisplayTextTimer);
        this.spokenDisplayTextTimer = setTimeout(
          () => uiDom.bubbleEl.classList.remove('show'),
          6000
        );

        if (typeof optiopns.onSpokenDisplayTextChange === 'function') {
          return optiopns.onSpokenDisplayTextChange.call(
            currentAiAvatar,
            newSpeakingLabel,
            currentAiAvatar,
            ...args
          );
        }
      };
    },

    _greeting: null, // function
    get greeting() {
      return this._greeting;
    },
    set greeting(newGreeting) {
      if (typeof newGreeting === 'function' || newGreeting === null) {
        this._greeting = newGreeting;
      }
    },

    _companionGreeting: null, // function | string
    get companionGreeting() {
      return this._companionGreeting;
    },
    set companionGreeting(newCompanionGreeting) {
      if (
        typeof newCompanionGreeting === 'function' ||
        typeof newCompanionGreeting === 'string' ||
        newCompanionGreeting === null
      ) {
        this._companionGreeting = newCompanionGreeting;
      }
    },

    _assistantGreeting: null, // function | string
    get assistantGreeting() {
      return this._assistantGreeting;
    },
    set assistantGreeting(newAssistantGreeting) {
      if (
        typeof newAssistantGreeting === 'function' ||
        typeof newAssistantGreeting === 'string' ||
        newAssistantGreeting === null
      ) {
        this._assistantGreeting = newAssistantGreeting;
      }
    },
    isProcessing: false
  };

  if (typeof optiopns.greeting === 'function') {
    speechEngine.greeting = optiopns.greeting.bind(aiAvatarWidget);
  }
  if (typeof optiopns.companionGreeting === 'function') {
    speechEngine.companionGreeting =
      optiopns.companionGreeting.bind(aiAvatarWidget);
  } else if (typeof optiopns.companionGreeting === 'string') {
    speechEngine.companionGreeting = optiopns.companionGreeting;
  }
  if (typeof optiopns.assistantGreeting === 'function') {
    speechEngine.assistantGreeting =
      optiopns.assistantGreeting.bind(aiAvatarWidget);
  } else if (typeof optiopns.assistantGreeting === 'string') {
    speechEngine.assistantGreeting = optiopns.assistantGreeting;
  }

  // speech.js
  if ('speechSynthesis' in window) {
    speechSynthesis.onvoiceschanged = () => {
      speechEngine.ttVoice = loadVoice(aiAvatarWidget);
    };
    speechEngine.ttVoice = loadVoice(aiAvatarWidget);
  }

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

  if (typeof safeGesture2D === 'function') {
    aiAvatarWidget.gesture2D = async function gesture2D(emotionName) {
      await safeGesture2D.call(this, this, emotionName);
    }.bind(aiAvatarWidget);
  }
  if (typeof optiopns.onGesture === 'function') {
    aiAvatarWidget.onGesture = optiopns.onGesture.bind(aiAvatarWidget);
  }

  initSkinMode(aiAvatarWidget);
  initSkinModeChangeButton(
    aiAvatarWidget,
    aiAvatarWidget.has2D,
    aiAvatarWidget.has3D
  );

  renderSuggestions(aiAvatarWidget);
  bindTyping(aiAvatarWidget);
  setMic(aiAvatarWidget, false); // 依模式套按鈕字樣（🎤 說話 / 💬 對話）

  ['dragenter', 'dragover'].forEach((eventName) =>
    container.addEventListener(eventName, (event) => {
      event.preventDefault();
    })
  );
  container.addEventListener('drop', (event) => {
    event.preventDefault();
    const file = event?.dataTransfer?.files?.[0];
    if (file instanceof window.File) {
      loadVRMFile(aiAvatarWidget, file);
    }
  });
  bindUiEvent(aiAvatarWidget);

  await initOllama(aiAvatarWidget);

  if (aiAvatarWidget.isIframe === true) {
    aiAvatarWidget.onMinimalTrigger(isMinimal, aiAvatarWidget);
    aiAvatarWidget.hiddenMinimalEl();
  } else {
    aiAvatarWidget.isMinimal = isMinimal;
  }

  return aiAvatarWidget;
}

export default initAvatarBot;
