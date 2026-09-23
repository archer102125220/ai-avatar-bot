import type { I18nEngine } from '@/core/i18n';
import type { SpeechEngine } from '@/core/speech';
import type { ToolsEngine } from '@/core/tools';
import type { LocalizableOrResolver, AvatarMode } from '@/core/types';
import type { BrainEngine } from '@/core/brain';
import type { SkinEngine } from '@/core/skin';

/**
 * Avatar frontend UI DOM elements and controller methods.
 */
export interface UiDom {
  /** 3D or 2D avatar viewport stage container element. */
  readonly stageEl: HTMLElement;
  /** Dialogue text bubble element. */
  readonly bubbleEl: HTMLElement;
  /** Suggested questions list container element. */
  readonly suggestionsEl: HTMLElement;
  /** Chat history slide-out panel element. */
  readonly historyPanelEl: HTMLElement;
  /** Real-time voice conversation status bar container element. */
  readonly voiceLiveEl: HTMLElement;
  /** Real-time voice state label element. */
  readonly voiceStatusEl: HTMLElement;
  /** Audio volume level meter indicator element. */
  readonly voiceLevelEl: HTMLElement;
  /** Updates voice conversation status bar and volume meter. */
  updateVoiceStatus(
    convoOn: boolean,
    text?: string,
    state?: string,
    level?: number,
    i18n?: I18nEngine | null
  ): void;
  /** Updates microphone button UI state and label. */
  updateMicState(
    isListening?: boolean,
    convoOn?: boolean,
    isCompanion?: boolean,
    i18n?: I18nEngine | null
  ): void;
  /** Main control bar container. */
  readonly controlBarEl: HTMLElement;
  /** Text input dock row. */
  readonly dockRow1El: HTMLElement;
  /** Toolbar buttons dock row. */
  readonly dockRow2El: HTMLElement;
  /** Text input field element. */
  readonly questionInputEl: HTMLInputElement;
  /** Message send button element. */
  readonly sendButtonEl: HTMLButtonElement;
  /** Voice conversation microphone button element. */
  readonly micButtonEl: HTMLButtonElement;
  /** 2D / 3D model engine switch button element. */
  readonly engineButtonEl: HTMLButtonElement;
  /** TTS mute toggle button element. */
  readonly muteButtonEl: HTMLButtonElement;
  /** In-browser WebLLM AI brain load/status button element. */
  readonly btnLlmEl: HTMLButtonElement;
  /** Speech rate cycle button element. */
  readonly speedButtonEl: HTMLButtonElement;
  /** Interface language switch button element. */
  readonly langButtonEl: HTMLButtonElement;
  /** Chat history open button element. */
  readonly historyButtonEl: HTMLButtonElement;
  /** Minimize widget close button element. */
  readonly closeButtonEl: HTMLButtonElement;
  /** Direct open warning banner element. */
  readonly directWarnEl: HTMLElement;
  /** Floating circular wake-up trigger button element when minimized. */
  readonly minimalEl: HTMLElement;
  /** Tap timer tracking state. */
  onTapTimer: boolean;
}

/**
 * Contextual state and engine references passed into UI event and rendering handlers.
 */
export interface UiContext {
  /** UI DOM elements and controller methods. */
  uiDom: UiDom;
  /** Speech STT / TTS engine coordinator. */
  speechEngine?: SpeechEngine | null;
  /** AI Brain LLM and conversation memory engine coordinator. */
  brainEngine?: BrainEngine | null;
  /** Function Calling and tools engine coordinator. */
  toolsEngine?: ToolsEngine | null;
  /** Live2D / VRM rendering engine coordinator. */
  skinEngine?: SkinEngine | null;
  /** Internationalization (i18n) engine instance. */
  i18nEngine?: I18nEngine | null;
  /** Current active locale code. */
  locale?: string;
  /** Suggested questions list or resolver. */
  suggestedQuestions?: LocalizableOrResolver<string[]>;
  /** Suggested title text or resolver. */
  suggestedTitle?: LocalizableOrResolver<string>;
  /** Companion mode suggested questions list or resolver. */
  companionSuggestedQuestions?: LocalizableOrResolver<string[]>;
  /** Companion mode suggested title text or resolver. */
  companionSuggestedTitle?: LocalizableOrResolver<string>;
  /** Assistant mode suggested questions list or resolver. */
  assistantSuggestedQuestions?: LocalizableOrResolver<string[]>;
  /** Assistant mode suggested title text or resolver. */
  assistantSuggestedTitle?: LocalizableOrResolver<string>;
  /** Current avatar personality mode ('companion' | 'assistant'). */
  avatarMode?: AvatarMode;
  /** Avatar mode constant mapping. */
  AVATAR_MODE_MAP?: Record<string, string>;
  /** Engine mode constant mapping. */
  ENGINE_MODE_MAP?: Record<string, string>;
  /** Lifecycle state constant mapping. */
  STATE_MAP?: Record<string, string>;
  /** Whether the widget is currently minimized. */
  isMinimal?: boolean;
  /** Whether widget is running inside an iframe embedding container. */
  isIframe?: boolean;
  /** Main handler function for processing user input text. */
  handleUser?: (text: string) => Promise<void> | void;
  /** Callback fired when minimal mode is toggled. */
  onMinimalTrigger?: (isMinimal: boolean, context: UiContext) => void;
}
