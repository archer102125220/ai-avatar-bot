import './demo.scss';
import packageInfo from '../package.json';
import {
  initAvatarBot,
  GENDER_MAP,
  ENGINE_MODE_MAP,
  FIT_MODE_MAP,
  REASONING_MODE_MAP,
  AI_PROVIDER_STATUS_MAP,
  AI_PROVIDER_PING_STRATEGY_MAP,
  type AiAvatarWidget,
  type AvatarBotOptions,
  type EngineMode,
  type FitMode,
  type Gender,
  type ToolDefinition
} from '@/core';
import { KNOWLEDGE, COMPANION_KNOWLEDGE } from '@/example/knowledge';

declare global {
  interface Window {
    aiAvatarWidget?: AiAvatarWidget;
    playGesture?: (gestureName: string) => void;
    pingAiProvider?: (fetchSetting?: RequestInit | null) => Promise<boolean>;
  }
}

type PackageManagerKey = 'npm' | 'yarn' | 'pnpm' | 'sync';

function isRecord(val: unknown): val is Record<string, unknown> {
  return (
    typeof val === 'object' && val !== null && Array.isArray(val) === false
  );
}

const ACCENT_PRESET_MAP: Readonly<Record<string, string>> = Object.freeze({
  靛藍: 'indigo',
  薄荷綠: 'mint',
  琥珀金: 'amber',
  櫻花粉: 'sakura'
});

const DEMO_SYSTEM_CONTEXT_BY_LOCALE: Readonly<Record<string, string>> =
  Object.freeze({
    'zh-TW':
      '你是「可嵌入任何網站的語音虛擬人元件 @ai-avatar-bot/sdk」的示範助手。主題是教人「怎麼把這個元件裝到自己的網站、怎麼換成自己的角色、怎麼使用」。請口語、最多兩三句話簡短回答，說完請直接結束，切勿重複說明或重頭再次解釋。{{RAG}}\n{{styleRule}}',
    'en-US':
      'You are a demo assistant for "@ai-avatar-bot/sdk, an embeddable voice AI avatar widget". Your topic is teaching users "how to install this widget, how to customize the avatar character, and how to use it". Please answer concisely in natural, spoken English within 2-3 sentences. Stop immediately after answering; do not repeat or restart the explanation.{{RAG}}\n{{styleRule}}',
    'ja-JP':
      'あなたは「Webサイトに埋め込み可能な音声AIアバターSDK @ai-avatar-bot/sdk」のデモアシスタントです。テーマは「ウィジェットの導入方法、アバターのカスタマイズ方法、使い方」を教えることです。自然で簡潔な日本語で、2〜3文程度で1回だけ回答し、回答後は直ちに終了してください。同じ説明を繰り返さないでください。{{RAG}}\n{{styleRule}}',
    'ko-KR':
      '당신은 "웹사이트에 임베드 가능한 음성 AI 아바타 SDK @ai-avatar-bot/sdk"의 데모 어시스턴트입니다. 주제는 "위젯 설치 방법, 아바타 캐릭터 변경 방법, 사용법"을 알려주는 것입니다. 자연스럽고 간결한 한국어로 2~3문장 이내로 한 번만 답변하고 즉시 종료하세요. 동일한 설명을 반복하지 마세요.{{RAG}}\n{{styleRule}}'
  });

const sdkVersion =
  typeof packageInfo.version === 'string' && packageInfo.version !== ''
    ? packageInfo.version
    : '1.0.0-beta.0';
const isPrerelease = sdkVersion.includes('-');
const distTagSuffix = isPrerelease === true ? '@beta' : '';
const scopedPkgWithTag = `@ai-avatar-bot/sdk${distTagSuffix}`;

const INSTALL_COMMANDS: Readonly<Record<PackageManagerKey, string>> =
  Object.freeze({
    npm: `npm install ${scopedPkgWithTag}`,
    yarn: `yarn add ${scopedPkgWithTag}`,
    pnpm: `pnpm add ${scopedPkgWithTag}`,
    sync: `npx --package=${scopedPkgWithTag} ai-avatar-bot sync`
  });

const currentHostname = window.location.hostname;
const isLocalLoopback =
  currentHostname === 'localhost' ||
  currentHostname === '127.0.0.1' ||
  currentHostname === '[::1]';

function setLiveAnnouncement(message: string): void {
  const liveEl = document.getElementById('demo-live-region');
  if (
    liveEl instanceof HTMLElement &&
    typeof message === 'string' &&
    message !== ''
  ) {
    liveEl.textContent = message;
  }
}

function appendPlaygroundLog(text: string): void {
  const logEl = document.getElementById('playground-log-text');
  if (logEl instanceof HTMLElement && typeof text === 'string' && text !== '') {
    logEl.textContent = text;
  }
}

function updateActiveChips(groupSelector: string, activeValue: string): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>(groupSelector);
  buttons.forEach((btn) => {
    const val = btn.dataset.value;
    const isMatch = typeof val === 'string' && val === activeValue;
    if (isMatch === true) {
      btn.setAttribute('css-is-active', 'true');
      btn.setAttribute('aria-pressed', 'true');
    } else {
      btn.removeAttribute('css-is-active');
      btn.setAttribute('aria-pressed', 'false');
    }
  });
}

function syncVersionBadges(): void {
  const versionBadge = document.getElementById('demo-sdk-version');
  if (versionBadge instanceof HTMLElement) {
    versionBadge.textContent = `v${sdkVersion}`;
  }

  const installCmdCode = document.getElementById('install-cmd-code');
  if (installCmdCode instanceof HTMLElement) {
    installCmdCode.textContent = INSTALL_COMMANDS.npm;
  }
}

function initThemeToggle(): void {
  const toggleBtn = document.getElementById('btn-theme-toggle');
  const metaScheme = document.querySelector<HTMLMetaElement>(
    'meta[name="color-scheme"]'
  );
  if (
    toggleBtn instanceof HTMLButtonElement === false ||
    metaScheme instanceof HTMLMetaElement === false
  ) {
    return;
  }

  const applyStoredScheme = (storedValue: string | null): void => {
    const validOverride =
      storedValue === 'light' || storedValue === 'dark' ? storedValue : null;
    metaScheme.content = validOverride !== null ? validOverride : 'light dark';
  };

  toggleBtn.addEventListener('click', () => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem('color-scheme');
    } catch (err) {
      console.warn('[demo] localStorage read skipped:', err);
    }

    const systemIsDark = window.matchMedia(
      '(prefers-color-scheme: dark)'
    ).matches;
    const systemScheme = systemIsDark === true ? 'dark' : 'light';
    const currentRendered =
      stored === 'light' || stored === 'dark' ? stored : systemScheme;
    const targetScheme = currentRendered === 'dark' ? 'light' : 'dark';

    try {
      if (targetScheme === systemScheme) {
        window.localStorage.removeItem('color-scheme');
        applyStoredScheme(null);
      } else {
        window.localStorage.setItem('color-scheme', targetScheme);
        applyStoredScheme(targetScheme);
      }
    } catch (err) {
      console.warn('[demo] localStorage write skipped:', err);
      metaScheme.content = targetScheme;
    }

    setLiveAnnouncement(
      targetScheme === 'dark' ? '已切換至深色主題' : '已切換至淺色主題'
    );
  });

  window.addEventListener('storage', (event: StorageEvent) => {
    if (event.key === 'color-scheme') {
      applyStoredScheme(event.newValue);
    }
  });
}

async function copyTextWithFeedback(
  text: string,
  buttonEl: HTMLButtonElement,
  defaultLabel: string
): Promise<void> {
  if (typeof text !== 'string' || text === '') {
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    buttonEl.setAttribute('css-is-copied', 'true');
    buttonEl.textContent = '✓ 已複製';
    setLiveAnnouncement('程式碼已複製到剪貼簿');
    window.setTimeout(() => {
      buttonEl.removeAttribute('css-is-copied');
      buttonEl.textContent = defaultLabel;
    }, 1800);
  } catch (err) {
    console.warn('[demo] clipboard write failed:', err);
  }
}

function initInstallBar(): void {
  const pmButtons =
    document.querySelectorAll<HTMLButtonElement>('[data-pm-tab]');
  const cmdCodeEl = document.getElementById('install-cmd-code');
  const copyBtn = document.getElementById('btn-copy-install');

  let currentPm: PackageManagerKey = 'npm';

  pmButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const pmKey = btn.dataset.pmTab as PackageManagerKey | undefined;
      if (
        pmKey !== 'npm' &&
        pmKey !== 'yarn' &&
        pmKey !== 'pnpm' &&
        pmKey !== 'sync'
      ) {
        return;
      }
      currentPm = pmKey;
      pmButtons.forEach((candidate) => {
        if (candidate === btn) {
          candidate.setAttribute('css-is-active', 'true');
          candidate.setAttribute('aria-pressed', 'true');
        } else {
          candidate.removeAttribute('css-is-active');
          candidate.setAttribute('aria-pressed', 'false');
        }
      });
      if (cmdCodeEl instanceof HTMLElement) {
        cmdCodeEl.textContent = INSTALL_COMMANDS[currentPm];
      }
    });
  });

  if (copyBtn instanceof HTMLButtonElement) {
    copyBtn.addEventListener('click', () => {
      void copyTextWithFeedback(
        INSTALL_COMMANDS[currentPm],
        copyBtn,
        '複製指令'
      );
    });
  }
}

function initCodeTabs(): void {
  const tabList = document.querySelector<HTMLElement>('[role="tablist"]');
  if (tabList instanceof HTMLElement === false) {
    return;
  }

  const tabs = Array.from(
    tabList.querySelectorAll<HTMLButtonElement>('[role="tab"]')
  );
  if (Array.isArray(tabs) === false || tabs.length === 0) {
    return;
  }

  const activateTab = (targetTab: HTMLButtonElement, moveFocus: boolean) => {
    const targetPanelId = targetTab.getAttribute('aria-controls') ?? '';
    tabs.forEach((tab) => {
      const isSelected = tab === targetTab;
      tab.setAttribute('aria-selected', isSelected === true ? 'true' : 'false');
      tab.tabIndex = isSelected === true ? 0 : -1;

      const panelId = tab.getAttribute('aria-controls') ?? '';
      if (panelId !== '') {
        const panel = document.getElementById(panelId);
        if (panel instanceof HTMLElement) {
          panel.hidden = panelId !== targetPanelId;
        }
      }
    });
    if (moveFocus === true) {
      targetTab.focus();
    }
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      activateTab(tab, false);
    });

    tab.addEventListener('keydown', (event: KeyboardEvent) => {
      let nextIndex = -1;
      if (event.key === 'ArrowRight') {
        nextIndex = (index + 1) % tabs.length;
      } else if (event.key === 'ArrowLeft') {
        nextIndex = (index - 1 + tabs.length) % tabs.length;
      } else if (event.key === 'Home') {
        nextIndex = 0;
      } else if (event.key === 'End') {
        nextIndex = tabs.length - 1;
      }

      if (nextIndex >= 0) {
        event.preventDefault();
        const nextTab = tabs[nextIndex];
        if (nextTab instanceof HTMLButtonElement) {
          activateTab(nextTab, true);
        }
      }
    });
  });

  const copyCodeButtons =
    document.querySelectorAll<HTMLButtonElement>('[data-copy-target]');
  copyCodeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.copyTarget ?? '';
      if (targetId === '') {
        return;
      }
      const codeEl = document.getElementById(targetId);
      const rawCode = codeEl?.textContent ?? '';
      if (rawCode !== '') {
        void copyTextWithFeedback(rawCode.trim(), btn, '複製程式碼');
      }
    });
  });
}

function buildDemoTools(): ToolDefinition[] {
  const showQuickStartTool: ToolDefinition = {
    name: 'show_quick_start',
    label: '前往快速開始教學',
    description: '將頁面平滑捲動至快速開始與程式碼整合區塊',
    keywords: ['快速開始', '安裝教學', '程式碼範例', '怎麼寫'],
    examples: ['帶我看快速開始', '跳到安裝程式碼區塊'],
    requiresConfirmation: false,
    priority: 3,
    execute: () => {
      const section = document.getElementById('quick-start');
      if (section instanceof HTMLElement) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      appendPlaygroundLog('[Tool] 執行 show_quick_start ➔ 捲動至快速開始');
      return '已經帶你來到快速開始與程式碼範例區塊囉！';
    }
  };

  const changeAccentTool: ToolDefinition = {
    name: 'change_demo_accent',
    label: '切換展示頁主題強調色',
    description: '將示範網站的主題強調色切換為靛藍、薄荷綠、琥珀金或櫻花粉',
    keywords: ['主題色', '強調色', '換顏色', '頁面配色', '換主題'],
    examples: [
      '把主題色換成薄荷綠',
      '幫我把頁面配色改成櫻花粉',
      '換成琥珀金主題'
    ],
    excludeKeywords: ['角色顏色', '衣服顏色'],
    requiresConfirmation: true,
    inputSchema: {
      type: 'object',
      properties: {
        theme: {
          type: 'string',
          title: '主題強調色',
          description: '要套用的頁面主題強調色名稱',
          enum: ['靛藍', '薄荷綠', '琥珀金', '櫻花粉'],
          prefixes: ['換成', '改成', '套用', '顏色']
        }
      },
      required: ['theme']
    },
    execute: (payload) => {
      const extractedArgs =
        isRecord(payload) && 'args' in payload && isRecord(payload.args)
          ? payload.args
          : isRecord(payload)
            ? payload
            : {};

      const chosenName =
        typeof extractedArgs.theme === 'string' && extractedArgs.theme !== ''
          ? extractedArgs.theme
          : '靛藍';
      const presetKey = ACCENT_PRESET_MAP[chosenName] ?? 'indigo';

      if (presetKey === 'indigo') {
        document.documentElement.removeAttribute('css-accent-preset');
      } else {
        document.documentElement.setAttribute('css-accent-preset', presetKey);
      }

      appendPlaygroundLog(
        `[Tool] 已授權執行 change_demo_accent ➔ ${chosenName} (${presetKey})`
      );
      return `沒問題，已將展示頁主題強調色切換為「${chosenName}」！`;
    }
  };

  const bowGreetingTool: ToolDefinition = {
    name: 'perform_avatar_bow',
    label: '虛擬人禮貌鞠躬致意',
    description: '觸發虛擬人播放鞠躬動作並向訪客致意',
    keywords: ['鞠躬', '敬禮致意', '行禮'],
    examples: ['請幫我鞠躬致意', '表演一個鞠躬動作'],
    requiresConfirmation: false,
    priority: 2,
    execute: () => {
      if (typeof window.aiAvatarWidget?.playGesture === 'function') {
        window.aiAvatarWidget.playGesture('bow');
      }
      appendPlaygroundLog(
        '[Tool] 執行 perform_avatar_bow ➔ playGesture("bow")'
      );
      return '非常榮幸為您展示 @ai-avatar-bot/sdk，請多指教！';
    }
  };

  const expressEmotionTool: ToolDefinition = {
    name: 'express_emotion',
    label: '自主情緒與動作驅動',
    description:
      '當語境需要表達感謝、開心、思考或道別時，自主調用對應表情或動作',
    keywords: ['謝謝', '感謝', '太厲害', '再見', '辛苦了'],
    examples: ['太厲害了，非常感謝你的詳細解說！', '很高興認識你，辛苦了！'],
    requiresConfirmation: false,
    priority: 3,
    execute: (payload) => {
      const extractedArgs =
        isRecord(payload) && 'args' in payload && isRecord(payload.args)
          ? payload.args
          : isRecord(payload)
            ? payload
            : {};
      const emotion =
        typeof extractedArgs.emotion === 'string' &&
        extractedArgs.emotion !== ''
          ? extractedArgs.emotion
          : 'thankful';
      if (typeof window.aiAvatarWidget?.skinEngine?.setEmotion === 'function') {
        window.aiAvatarWidget.skinEngine.setEmotion('happy');
      }
      if (typeof window.aiAvatarWidget?.playGesture === 'function') {
        window.aiAvatarWidget.playGesture(emotion);
      }
      appendPlaygroundLog(
        `[Tool] 執行 express_emotion ➔ emotion: "${emotion}"`
      );
      return `收到，已為您展現由衷感謝的「${emotion}」肢體回饋！`;
    }
  };

  return [
    showQuickStartTool,
    changeAccentTool,
    bowGreetingTool,
    expressEmotionTool
  ];
}

function markTelemetryWidgetReady(): void {
  const widgetDot = document.getElementById('stat-widget-dot');
  const widgetText = document.getElementById('stat-widget-text');
  if (widgetDot instanceof HTMLElement) {
    widgetDot.setAttribute('css-status', 'ready');
  }
  if (widgetText instanceof HTMLElement) {
    widgetText.textContent = 'Ready';
  }
}

function syncGestureControlsAvailability(mode: '2d' | '3d'): void {
  const is3D = mode === '3d';
  const controls3D = document.querySelectorAll<HTMLButtonElement>(
    '[data-gesture], [data-engine-required="3d"]'
  );
  controls3D.forEach((btn) => {
    btn.disabled = is3D === false;
    if (is3D === false) {
      const isGesture = btn.hasAttribute('data-gesture');
      btn.title =
        isGesture === true
          ? '此全身動作僅支援 3D VRM 引擎，請先切換至 3D 模式體驗'
          : '此表情僅支援 3D VRM 引擎，請先切換至 3D 模式體驗';
    } else {
      btn.removeAttribute('title');
    }
  });
}

function updateTelemetryEngine(mode: string): void {
  const normalizedMode: '2d' | '3d' = mode === '2d' ? '2d' : '3d';
  const engineStatEl = document.getElementById('stat-engine-text');
  if (engineStatEl instanceof HTMLElement) {
    engineStatEl.textContent = normalizedMode === '2d' ? '2D Live2D' : '3D VRM';
  }
  updateActiveChips('[data-engine-mode]', normalizedMode);
  syncGestureControlsAvailability(normalizedMode);
}

function updateTelemetryProvider(status: string): void {
  const dotEl = document.getElementById('stat-provider-dot');
  const textEl = document.getElementById('stat-provider-text');
  if (dotEl instanceof HTMLElement) {
    dotEl.setAttribute('css-status', status);
  }
  if (textEl instanceof HTMLElement) {
    const labelMap: Record<string, string> = {
      idle: 'Manual / RAG',
      connecting: 'Connecting…',
      connected: 'Online',
      error: 'Fallback (RAG)'
    };
    textEl.textContent = labelMap[status] ?? status;
  }
}

function bindPlaygroundControls(
  widget: AiAvatarWidget,
  appEl: HTMLElement
): void {
  // Hero summon button (expands widget if minimized & triggers greeting tap)
  const summonBtn = document.getElementById('btn-hero-summon');
  if (summonBtn instanceof HTMLButtonElement) {
    summonBtn.addEventListener('click', () => {
      if (widget.isMinimal === true) {
        widget.isMinimal = false;
      }
      if (typeof widget.tap === 'function') {
        widget.tap();
      }
      appendPlaygroundLog('👆 觸發虛擬人問候互動 (widget.tap())');
    });
  }

  // 1. Render Engine (3D VRM / 2D Live2D)
  document
    .querySelectorAll<HTMLButtonElement>('[data-engine-mode]')
    .forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetMode = btn.dataset.value as EngineMode | undefined;
        if (targetMode !== '2d' && targetMode !== '3d') {
          return;
        }
        if (widget.isMinimal === true) {
          widget.isMinimal = false;
        }
        if (
          typeof widget.skinEngine === 'object' &&
          widget.skinEngine !== null
        ) {
          widget.skinEngine.engineMode = targetMode;
          updateTelemetryEngine(targetMode);
          appendPlaygroundLog(
            `🎭 切換渲染引擎: skinEngine.engineMode = "${targetMode}"`
          );
        }
      });
    });

  // 2. Gender Switch (male / female)
  document
    .querySelectorAll<HTMLButtonElement>('[data-gender]')
    .forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetGender = btn.dataset.value as Gender | undefined;
        if (
          targetGender !== GENDER_MAP.male &&
          targetGender !== GENDER_MAP.female
        ) {
          return;
        }
        if (widget.isMinimal === true) {
          widget.isMinimal = false;
        }
        widget.gender = targetGender;
        updateActiveChips('[data-gender]', targetGender);
        appendPlaygroundLog(
          `👤 切換角色性別: widget.gender = "${targetGender}"`
        );
      });
    });

  // 3. Framing Fit Mode (half / full)
  document
    .querySelectorAll<HTMLButtonElement>('[data-fit-mode]')
    .forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetFit = btn.dataset.value as FitMode | undefined;
        if (
          targetFit !== FIT_MODE_MAP.HALF &&
          targetFit !== FIT_MODE_MAP.FULL
        ) {
          return;
        }
        if (widget.isMinimal === true) {
          widget.isMinimal = false;
        }
        widget.setFitMode(targetFit);
        updateActiveChips('[data-fit-mode]', targetFit);
        appendPlaygroundLog(
          `📐 切換鏡頭構圖: widget.setFitMode("${targetFit}")`
        );
      });
    });

  // 4. Stage Backdrop Style (card / transparent) + VRM Drop Toggle + Minimal Toggle
  const backdropBtn = document.getElementById('btn-toggle-backdrop');
  if (backdropBtn instanceof HTMLButtonElement) {
    backdropBtn.addEventListener('click', () => {
      const isCard = appEl.getAttribute('css-stage-backdrop') === 'card';
      if (isCard === true) {
        appEl.setAttribute('css-stage-backdrop', 'transparent');
        backdropBtn.removeAttribute('css-is-active');
        backdropBtn.setAttribute('aria-pressed', 'false');
        backdropBtn.textContent = '🪟 透明懸浮模式';
        appendPlaygroundLog('🪟 舞台切換為純透明網頁疊加模式');
      } else {
        appEl.setAttribute('css-stage-backdrop', 'card');
        backdropBtn.setAttribute('css-is-active', 'true');
        backdropBtn.setAttribute('aria-pressed', 'true');
        backdropBtn.textContent = '✨ 舞台背板模式';
        appendPlaygroundLog('✨ 舞台切換為毛玻璃光暈背板模式');
      }
    });
  }

  const dropBtn = document.getElementById('btn-toggle-vrm-drop');
  if (dropBtn instanceof HTMLButtonElement) {
    dropBtn.addEventListener('click', () => {
      const nextDrop = widget.enableModelDrop !== true;
      widget.enableModelDrop = nextDrop;
      if (nextDrop === true) {
        dropBtn.setAttribute('css-is-active', 'true');
        dropBtn.setAttribute('aria-pressed', 'true');
        appendPlaygroundLog(
          '📦 已開啟 VRM 拖放換裝 (可將本地 .vrm 檔直接拖入右下角舞台)'
        );
      } else {
        dropBtn.removeAttribute('css-is-active');
        dropBtn.setAttribute('aria-pressed', 'false');
        appendPlaygroundLog('🔒 已關閉 VRM 拖放換裝');
      }
    });
  }

  const minimalBtn = document.getElementById('btn-toggle-minimal');
  if (minimalBtn instanceof HTMLButtonElement) {
    minimalBtn.addEventListener('click', () => {
      widget.isMinimal = widget.isMinimal !== true;
    });
  }

  // 5.Persona Mode (assistant / companion / mentor)
  document
    .querySelectorAll<HTMLButtonElement>('[data-avatar-mode]')
    .forEach((btn) => {
      btn.addEventListener('click', () => {
        const modeVal = btn.dataset.value ?? '';
        if (modeVal === '') {
          return;
        }
        if (widget.isMinimal === true) {
          widget.isMinimal = false;
        }
        widget.avatarMode = modeVal;
        updateActiveChips('[data-avatar-mode]', modeVal);
        const modeStatEl = document.getElementById('stat-mode-text');
        if (modeStatEl instanceof HTMLElement) {
          modeStatEl.textContent = modeVal;
        }
        appendPlaygroundLog(
          `🧠 切換人格模式: widget.avatarMode = "${modeVal}"`
        );
      });
    });

  // 6. Locale Switch (zh-TW / en-US / ja-JP / ko-KR / zh-CN)
  document
    .querySelectorAll<HTMLButtonElement>('[data-locale]')
    .forEach((btn) => {
      btn.addEventListener('click', () => {
        const localeVal = btn.dataset.value ?? '';
        if (localeVal === '') {
          return;
        }
        widget.locale = localeVal;
        updateActiveChips('[data-locale]', localeVal);
        appendPlaygroundLog(`🌐 切換語系: widget.locale = "${localeVal}"`);
      });
    });

  // 7. Interactive Tap Gesture (btn-tap-gesture)
  const tapGestureBtn = document.getElementById('btn-tap-gesture');
  if (tapGestureBtn instanceof HTMLButtonElement) {
    tapGestureBtn.addEventListener('click', () => {
      if (widget.isMinimal === true) {
        widget.isMinimal = false;
      }
      if (typeof widget.tap === 'function') {
        widget.tap();
      } else if (
        typeof widget.skinEngine === 'object' &&
        widget.skinEngine !== null &&
        typeof widget.skinEngine.playTapGesture === 'function'
      ) {
        void widget.skinEngine.playTapGesture();
      }
      appendPlaygroundLog('👆 觸發虛擬人互動反應 (tap)');
    });
  }

  // 8. Gestures (playGesture - 3D specific with 2D defensive feedback)
  document
    .querySelectorAll<HTMLButtonElement>('[data-gesture]')
    .forEach((btn) => {
      btn.addEventListener('click', () => {
        const gestureName = btn.dataset.gesture ?? '';
        if (gestureName === '') {
          return;
        }
        if (widget.isMinimal === true) {
          widget.isMinimal = false;
        }
        const currentMode =
          widget.skinEngine?.engineMode === '2d' ? '2d' : '3d';
        if (currentMode === '2d') {
          appendPlaygroundLog(
            `⚠️ 3D 專屬動作: "${gestureName}" 僅支援 3D VRM 引擎，請先點擊上方切換為 3D 模式`
          );
          return;
        }
        if (typeof widget.playGesture === 'function') {
          widget.playGesture(gestureName);
          appendPlaygroundLog(`🎬 播放動作: playGesture("${gestureName}")`);
        }
      });
    });

  // 9. Emotions (setEmotion - 2D & 3D Universal)
  document
    .querySelectorAll<HTMLButtonElement>('[data-emotion]')
    .forEach((btn) => {
      btn.addEventListener('click', () => {
        const emotionName = btn.dataset.emotion ?? '';
        if (emotionName === '') {
          return;
        }
        const requiredEngine = btn.dataset.engineRequired ?? '';
        if (
          requiredEngine === '3d' &&
          typeof widget.skinEngine === 'object' &&
          widget.skinEngine !== null &&
          widget.skinEngine.engineMode === '2d'
        ) {
          appendPlaygroundLog(
            `⚠️ 3D 專屬表情: "${emotionName}" 僅支援 3D VRM 引擎，請先切換至 3D 模式`
          );
          return;
        }
        if (widget.isMinimal === true) {
          widget.isMinimal = false;
        }
        if (
          typeof widget.skinEngine === 'object' &&
          widget.skinEngine !== null
        ) {
          widget.skinEngine.setEmotion(emotionName);
          appendPlaygroundLog(
            `🎭 切換臉部表情: skinEngine.setEmotion("${emotionName}")`
          );
          if (
            widget.skinEngine.engineMode === '3d' &&
            widget.gender === GENDER_MAP.male
          ) {
            appendPlaygroundLog(
              'ℹ️ 提示：當前範例 3D 男角 (Rockman) 資產未內建表情 BlendShape，切換至 3D 女角 (Miku) 可觀察完整表情過渡'
            );
          }
        }
      });
    });

  const speakBtn = document.getElementById('btn-test-speak');
  if (speakBtn instanceof HTMLButtonElement) {
    speakBtn.addEventListener('click', () => {
      if (widget.isMinimal === true) {
        widget.isMinimal = false;
      }
      const sampleLine =
        '嗨！這是 @ai-avatar-bot/sdk 的即時語音對嘴展示，無論是神經網路語音或瀏覽器原生語音都能流暢驅動嘴型喔！';
      if (
        typeof widget.speechEngine === 'object' &&
        widget.speechEngine !== null
      ) {
        widget.speechEngine.spokenAudioText = sampleLine;
        widget.uiDom?.updateBubble?.(sampleLine, true, false);
        appendPlaygroundLog('🗣️ 觸發語音朗讀與即時對嘴 (Lip Sync)');
      }
    });
  }

  const pingBtn = document.getElementById('btn-ping-provider');
  if (pingBtn instanceof HTMLButtonElement) {
    pingBtn.addEventListener('click', async () => {
      pingBtn.disabled = true;
      appendPlaygroundLog('📡 發起 AI Provider 健康探活 (pingAiProvider)…');
      try {
        const ok = await widget.pingAiProvider();
        appendPlaygroundLog(
          ok === true
            ? '✅ AI Provider 探活連線成功！'
            : 'ℹ️ 未偵測到遠端 AI 伺服器，自動維持本機知識庫 / WebLLM 模式'
        );
      } finally {
        pingBtn.disabled = false;
      }
    });
  }

  // 9. One-click Tool Calling Prompts
  document
    .querySelectorAll<HTMLButtonElement>('[data-tool-prompt]')
    .forEach((btn) => {
      btn.addEventListener('click', () => {
        const promptText = btn.dataset.toolPrompt ?? '';
        if (promptText === '') {
          return;
        }
        if (widget.isMinimal === true) {
          widget.isMinimal = false;
        }
        appendPlaygroundLog(`🛠️ 發送工具測試指令: 「${promptText}」`);
        void widget.handleUser(promptText);
      });
    });

  // Reactive Store synchronization (keeps UI chips synced when changed inside widget dock!)
  widget.store.subscribe('gender', (genderVal: unknown) => {
    if (typeof genderVal === 'string' && genderVal !== '') {
      updateActiveChips('[data-gender]', genderVal);
    }
  });

  widget.store.subscribe('avatarMode', (modeVal: unknown) => {
    if (typeof modeVal === 'string' && modeVal !== '') {
      updateActiveChips('[data-avatar-mode]', modeVal);
      const modeStatEl = document.getElementById('stat-mode-text');
      if (modeStatEl instanceof HTMLElement) {
        modeStatEl.textContent = modeVal;
      }
    }
  });

  widget.store.subscribe('locale', (localeVal: unknown) => {
    if (typeof localeVal === 'string' && localeVal !== '') {
      updateActiveChips('[data-locale]', localeVal);
    }
  });

  widget.store.subscribe('aiProviderStatus', (statusVal: unknown) => {
    if (typeof statusVal === 'string' && statusVal !== '') {
      console.log(
        `[avatar] 📡 Store 狀態變更 (aiProviderStatus): ${statusVal}`
      );
      updateTelemetryProvider(statusVal);
    }
  });

  if (
    typeof widget.skinEngine === 'object' &&
    widget.skinEngine !== null &&
    typeof widget.skinEngine.subscribe === 'function'
  ) {
    widget.skinEngine.subscribe('fitMode', (fitVal: unknown) => {
      if (typeof fitVal === 'string' && fitVal !== '') {
        updateActiveChips('[data-fit-mode]', fitVal);
      }
    });
  }
}

async function bootstrapDemo(): Promise<void> {
  syncVersionBadges();
  initThemeToggle();
  initInstallBar();
  initCodeTabs();

  const app = document.getElementById('app');
  if (app instanceof HTMLElement === false) {
    console.error('[demo] Missing #app container element');
    return;
  }

  // Narrow mobile screens start collapsed so visitors can read the hero unobstructed first
  const startCollapsedOnMobile =
    window.matchMedia('(max-width: 720px)').matches;
  app.setAttribute(
    'css-is-minimal',
    startCollapsedOnMobile === true ? 'true' : 'false'
  );

  const options: AvatarBotOptions = {
    container: app,
    isMinimal: startCollapsedOnMobile,
    // 本地端 WebGPU WebLLM 旗艦模型與兩階段 OOM 降級設定
    webLlmModel: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', // 行動設備用太高規格會死當
    // webLlmModel: 'Hermes-3-Llama-3.1-8B-q4f32_1-MLC', // 預設 8B 旗艦模型（支援完整 Function Calling 與推論思考鏈）
    webLlmFallbackModel: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', // 低配備設備（如 8GB 記憶體）自動 OOM 降級保底模型
    enableOomFallback: true, // 啟用 WebGPU 顯存不足自動降級
    aiProviderModel: 'gemma4:12b',
    // 本地開發時透過 Vite 代理連本機 Ollama；部署至公開網域（如 Vercel Demo）時停用預設本地端點，避免觸發瀏覽器 Loopback 權限提示或連線錯誤
    aiProviderBaseUrl:
      isLocalLoopback === true ? `${window.location.origin}/api/ollama` : '',
    // AI Provider 探活策略與自訂端點（非阻塞背景探活，首頁秒開；公開線上環境改為 manual 優先走內建知識庫與純前端 WebLLM）
    aiProviderAutoPing:
      isLocalLoopback === true
        ? AI_PROVIDER_PING_STRATEGY_MAP.EAGER
        : AI_PROVIDER_PING_STRATEGY_MAP.MANUAL,
    // ⚠️ [實驗性 Experimental] 推論思考過程設定
    reasoning: {
      mode: REASONING_MODE_MAP.always,
      showThinkingInBubble: true
    },
    aiProviderIsStream: true,
    assistantKnowledge: KNOWLEDGE,
    companionKnowledge: COMPANION_KNOWLEDGE,
    startMode: ENGINE_MODE_MAP.threeDimensional, // 預設以 3D VRM 模式啟動展示 VRMA 動作池
    fitMode: FIT_MODE_MAP.HALF, // 半身特寫構圖
    gender: GENDER_MAP.female,
    enableMemory: true,
    tools: buildDemoTools(),
    modes: {
      mentor: {
        name: {
          'zh-TW': '架構導師',
          'en-US': 'Tech Mentor',
          'ja-JP': 'テックメンター',
          'ko-KR': '테크 멘토'
        },
        systemPrompt:
          '你是專精 TypeScript 與前端架構的技術導師，請用簡潔、親切且具條理的兩三句口語回答開發問題。{{RAG}}\n{{styleRule}}',
        welcomeText:
          '嗨！我是 TypeScript 架構導師模式，想聊 Subpath 打包、Peer 依賴瘦身或多引擎狀態設計都可以問我！',
        greeting: '你好！今天想探討哪個前端架構或 SDK 整合細節呢？',
        knowledge: KNOWLEDGE
      }
    },
    // 示範教學提示詞（依當前語系動態解析，教導訪客如何安裝與自訂元件）
    systemContextTemplate: (ctx) => {
      const activeLocale =
        typeof ctx.locale === 'string' && ctx.locale !== ''
          ? ctx.locale
          : 'zh-TW';
      return (
        DEMO_SYSTEM_CONTEXT_BY_LOCALE[activeLocale] ??
        DEMO_SYSTEM_CONTEXT_BY_LOCALE['zh-TW']
      );
    },

    onReady(aiAvatar) {
      console.log('[avatar] widget ready:', aiAvatar);
      console.log(
        '%c[3D 動作與 AI 連線測試指南]',
        'color: #5b54e8; font-weight: bold; font-size: 14px;'
      );
      console.log('可直接在 Console 執行下列指令進行測試：');
      console.log('▶ playGesture("goodbye")    // 動作測試：goodbye.vrma');
      console.log('▶ playGesture("appearing")  // appearing.vrma');
      console.log('▶ playGesture("liked")      // liked.vrma');
      console.log('▶ playGesture("waiting")    // waiting.vrma');
      console.log(
        '▶ await pingAiProvider()   // 探活/重試遠端 AI Provider 連線'
      );

      markTelemetryWidgetReady();
      appendPlaygroundLog(
        '✨ 虛擬人引擎已就緒，點擊上方按鈕或直接與右下角助理對話！'
      );
    },
    onModelChangeEnd() {
      const activeMode =
        window.aiAvatarWidget?.skinEngine?.engineMode === '2d' ? '2d' : '3d';
      updateTelemetryEngine(activeMode);
    },
    onSpeaking(text) {
      console.log('[avatar] speaking:', text);
      if (typeof text === 'string' && text !== '') {
        appendPlaygroundLog(`🔊 語音播報: ${text}`);
      }
    },
    onStreamChunk(chunkDelta) {
      console.log('[avatar] stream chunk (TTS active):', chunkDelta);
    },
    onAiProviderConnecting() {
      console.log('[avatar] 🧠 AI Provider 連線探活中 (connecting)...');
    },
    onAiProviderConnected(_response, _fetchSetting, aiProvider) {
      const providerObj =
        typeof aiProvider === 'object' && aiProvider !== null
          ? (aiProvider as { model?: unknown })
          : null;
      const modelName =
        typeof providerObj?.model === 'string' ? providerObj.model : '';
      console.log('[avatar] 🧠✓ AI Provider 連線成功 (connected):', modelName);
    },
    onAiProviderError(error) {
      console.warn('[avatar] 🧠✗ AI Provider 連線失敗 (error):', error);
    },
    onReasoningStart(info) {
      console.log(
        '[avatar] 🧠 [Experimental] reasoning started (silent track):',
        info
      );
      appendPlaygroundLog('💭 AI 思考鏈靜默推論中 (<think>)…');
    },
    onReasoningChunk(_info, chunkDelta) {
      console.log('[avatar] 💭 [Experimental] reasoning chunk:', chunkDelta);
    },
    onReasoningEnd(_info, _fullReasoning, durationMs) {
      console.log(
        `[avatar] 💡 [Experimental] reasoning finished in ${durationMs}ms`
      );
      appendPlaygroundLog(`💡 思考鏈推論完成 (${durationMs}ms)，開始串流回答`);
    },
    onLlmOomFallback(_info, primaryModel, fallbackModel, error) {
      console.warn(
        `[avatar] ⚠️ WebGPU OOM detected: Falling back from ${primaryModel} to ${fallbackModel}`,
        error
      );
      appendPlaygroundLog(
        `⚠️ WebGPU 顯存不足，已自動降級至輕量模型 ${fallbackModel}`
      );
    },
    onMinimalTrigger(newIsMinimal) {
      console.log('[avatar] minimal toggled:', newIsMinimal);
      app.setAttribute(
        'css-is-minimal',
        newIsMinimal === true ? 'true' : 'false'
      );
      const minimalBtn = document.getElementById('btn-toggle-minimal');
      if (minimalBtn instanceof HTMLButtonElement) {
        minimalBtn.textContent =
          newIsMinimal === true ? '💬 展開虛擬人視窗' : '↘ 收合為懸浮泡泡';
      }
    },
    onError(error) {
      console.warn('[avatar] widget error:', error);
    }
  };

  const widget = await initAvatarBot(options);
  if (typeof widget !== 'object' || widget === null) {
    return;
  }
  window.aiAvatarWidget = widget;

  markTelemetryWidgetReady();
  updateTelemetryEngine(widget.skinEngine?.engineMode === '2d' ? '2d' : '3d');
  updateTelemetryProvider(
    widget.store.getState().aiProviderStatus ?? AI_PROVIDER_STATUS_MAP.IDLE
  );
  bindPlaygroundControls(widget, app);

  // 掛載全域便捷函式供開發者工具直接呼叫
  window.playGesture = (gestureName: string) => {
    if (typeof window.aiAvatarWidget?.playGesture === 'function') {
      window.aiAvatarWidget.playGesture(gestureName);
      console.log(`[playGesture] 播放動作: ${gestureName}`);
    } else {
      console.warn('[playGesture] aiAvatarWidget 尚未就緒或未提供 playGesture');
    }
  };

  window.pingAiProvider = async (fetchSetting?: RequestInit | null) => {
    if (typeof window.aiAvatarWidget?.pingAiProvider === 'function') {
      console.log('[pingAiProvider] 發起連線探活...');
      const ok = await window.aiAvatarWidget.pingAiProvider(fetchSetting);
      console.log(
        `[pingAiProvider] 探活結果: ${ok === true ? '成功' : '失敗'}`
      );
      return ok;
    }
    console.warn('[pingAiProvider] aiAvatarWidget 尚未就緒');
    return false;
  };
}

void bootstrapDemo();
