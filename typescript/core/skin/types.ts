import type {
  SubscribableStore,
  Point2D,
  Vector3Input,
  Vector3Scale,
  Gender,
  FitMode,
  EngineMode
} from '@/core/types';

export type { EngineMode };

/**
 * 2D visual transformation settings for a specific display mode (half / full).
 */
export interface Skin2DModeConfig {
  /** Zoom scale multiplier (e.g., 1.9 for half-body, 1.0 for full-body). */
  zoom?: number;
  /** Horizontal offset in pixels. */
  offsetX?: number;
  /** Vertical offset in pixels. */
  offsetY?: number;
  /** Model anchor point { x, y } (e.g., { x: 0.5, y: 1.0 } for half, { x: 0.5, y: 3.0 } for full). */
  anchor?: Point2D;
}

/**
 * Cascade inheritance container type supporting gender-specific overrides.
 * Resolves priority: config[gender]?.field ➜ config.field ➜ default Fallback.
 */
export type SkinGenderCascade<T> = {
  /** Female-specific overrides. */
  female?: T;
  /** Male-specific overrides. */
  male?: T;
} & {
  [key: string]: unknown;
};

/**
 * Cascade dictionary mapping arbitrary keys to item type T, with optional female and male nested dictionaries.
 */
export type SkinCascadeMap<T> = {
  /** Female-specific overrides. */
  female?: Record<string, T>;
  /** Male-specific overrides. */
  male?: Record<string, T>;
  [key: string]: T | Record<string, T> | undefined;
};

/**
 * 2D motion configuration item: can be a motion group string or an option object with pointerLook.
 */
export type Skin2DMotionItem =
  | string
  | {
      /** Live2D motion group name or file name. */
      motion: string;
      /** Whether to enable mouse cursor gaze/focus tracking during motion playback. Default: true. */
      pointerLook?: boolean;
    };

/**
 * Comprehensive 2D visual configuration object.
 */
export interface Skin2DConfig {
  /** Default zoom multiplier when mode-specific override is not provided. */
  zoom?: number;
  /** Default horizontal offset in pixels. */
  offsetX?: number;
  /** Default vertical offset in pixels. */
  offsetY?: number;
  /** Default model anchor point. */
  anchor?: Point2D;
  /** Half-body mode specific overrides. */
  half?: Skin2DModeConfig;
  /** Full-body mode specific overrides. */
  full?: Skin2DModeConfig;
  /** Tap / click motion keys triggered randomly when avatar is clicked. Default: ['tap'] */
  tapMotions?: string[];
  /** Alias for tapMotions. */
  tapGestures?: string[];
  /** Semantic motion mapping from action names to Live2D motion group names (supports cascade gender overrides). */
  motionMap?: SkinCascadeMap<Skin2DMotionItem>;
  /** Custom semantic expression mapping to Live2D expression names (supports cascade gender overrides). */
  expressionMap?: SkinCascadeMap<string>;
}

/**
 * 3D camera transformation and field-of-view configuration.
 */
export interface Skin3DCameraConfig {
  /** Camera field of view (FOV in degrees, e.g., 26 for half, 30 for full). */
  fov?: number;
  /** Near clipping plane distance. */
  near?: number;
  /** Far clipping plane distance. */
  far?: number;
  /** World position coordinates { x, y, z } or [x, y, z] array. */
  position?: Vector3Input;
  /** Look-at target coordinates { x, y, z } or [x, y, z] array. */
  lookAt?: Vector3Input;
}

/**
 * 3D VRM model spatial transformation configuration.
 */
export interface Skin3DModelConfig {
  /** World position offset coordinates. */
  position?: Vector3Input;
  /** Model scale multiplier or { x, y, z } axes vector. */
  scale?: Vector3Scale;
  /** Model rotation Euler angles in radians. */
  rotation?: Vector3Input;
}

/**
 * 3D visual configuration for a specific display mode (half / full).
 */
export interface Skin3DModeConfig {
  /** Camera configuration overrides for this mode. */
  camera?: Skin3DCameraConfig;
  /** Model transformation overrides for this mode. */
  model?: Skin3DModelConfig;
}

/**
 * Standard built-in 3D gesture and animation action names.
 * Ensures typo prevention in IDE autocompletion.
 */
export type StandardSkin3DGestureName =
  | 'idle-1'
  | 'idle-2'
  | 'idle-female-1'
  | 'idle-female-2'
  | 'idle-male-1'
  | 'idle-male-2'
  | 'talking-1'
  | 'talking-2'
  | 'talking-3'
  | 'talking-4'
  | 'standing-greeting'
  | 'salute'
  | 'bow'
  | 'goodbye'
  | 'thankful'
  | 'thinking'
  | 'look-around'
  | 'relax'
  | 'surprised'
  | 'appearing'
  | 'liked'
  | 'waiting'
  // Legacy alias keys for backwards compatibility
  | 'look'
  | 'idle_v01'
  | 'idle_v02'
  | 'idleFemale1'
  | 'idleFemale2'
  | 'idleMale1'
  | 'idleMale2'
  | 'standingGreeting'
  | 'talking_v01'
  | 'talking_v02'
  | 'talking_v03'
  | 'talking_v04';

/**
 * 3D gesture name type that combines built-in standard names for autocomplete and string for custom extensions.
 */
export type Skin3DGestureName = StandardSkin3DGestureName | (string & {});

/**
 * Detailed configuration option for a 3D animation action.
 */
export interface Skin3DActionOption {
  /** Action identifier key matching StandardSkin3DGestureName or custom string. */
  name: Skin3DGestureName;
  /** Explicit URL to the .vrma animation file. */
  url?: string;
  /**
   * Whether to enable mouse cursor gaze/head tracking during this action's playback.
   * Default: true (actions like inspecting nails or bowing can be set to false).
   */
  pointerLook?: boolean;
  /** Optional custom crossfade duration in seconds for this specific action. */
  crossfadeDuration?: number;
}

/**
 * Single item in a 3D animation pool: can be a simple action name string or a detailed option object.
 */
export type Skin3DActionItem = Skin3DGestureName | Skin3DActionOption;

/**
 * Gesture option object in gestures dictionary.
 */
export interface Skin3DGestureOption {
  /** Explicit URL to the .vrma animation file. */
  url?: string;
  /** Whether to enable mouse cursor gaze/head tracking during this action. Default: true. */
  pointerLook?: boolean;
  /** Optional custom crossfade duration in seconds for this specific gesture. */
  crossfadeDuration?: number;
}

/**
 * Custom gesture library dictionary mapping gesture names to VRMA URLs or option objects.
 */
export type Skin3DGesturesMap = {
  [K in StandardSkin3DGestureName]?: string | Skin3DGestureOption;
} & {
  [customName: string]: string | Skin3DGestureOption | undefined;
};

/**
 * Comprehensive 3D VRM visual and animation configuration object.
 */
export interface Skin3DConfig {
  /** Global camera configuration. */
  camera?: Skin3DCameraConfig;
  /** Global model spatial transformation. */
  model?: Skin3DModelConfig;
  /** Half-body mode specific overrides. */
  half?: Skin3DModeConfig;
  /** Full-body mode specific overrides. */
  full?: Skin3DModeConfig;
  /** Whether to enable 3D eye gaze and head tracking towards the mouse cursor globally. Default: true. */
  pointerLook?: boolean;
  /** Animation crossfade transition duration in seconds. Default: 0.3s. */
  crossfadeDuration?: number;
  /** Base idle loop animation pool. Default: ['idle-1', 'idle-2']. */
  idlePool?: Skin3DActionItem[];
  /** Speaking speech motion animation pool. Default: ['talking-1', 'talking-2', 'talking-3', 'talking-4']. */
  talkingPool?: Skin3DActionItem[];
  /** Occasional gender-specific idle variant animation pool (triggered randomly every 10~20s). */
  idleVariants?: {
    female?: Skin3DActionItem[];
    male?: Skin3DActionItem[];
  };
  /** Model mount initial greeting animation action (supports cascade gender overrides). */
  greetings?: {
    female?: Skin3DActionItem;
    male?: Skin3DActionItem;
  };
  /** URL to bow animation file (.vrma). */
  bow?: string;
  /** URL to goodbye animation file (.vrma). */
  goodbye?: string;
  /** URL to thinking animation file (.vrma). */
  thinking?: string;
  /** URL to look-around animation file (.vrma). */
  look?: string;
  /** URL to relax / idle animation file (.vrma). */
  relax?: string;
  /** URL to surprised animation file (.vrma). */
  surprised?: string;
  /** URL to appearing animation file (.vrma). */
  appearing?: string;
  /** URL to liked animation file (.vrma). */
  liked?: string;
  /** URL to waiting animation file (.vrma). */
  waiting?: string | { female?: string; male?: string };
  /** Root directory URL path for VRMA animation files. */
  vrmaRootPath?: string;
  /** Gesture action keys triggered randomly when 3D avatar is clicked. Default: ['goodbye', 'bow', 'waiting'] */
  tapGestures?: Skin3DActionItem[];
  /** Custom gesture library dictionary mapping gesture names to VRMA URLs or options. */
  gestures?: SkinCascadeMap<string | Skin3DGestureOption>;
  /** Custom semantic expression mapping to VRM morph/expression names. */
  expressionMap?: SkinCascadeMap<string>;
}

/**
 * VRM settings and animation URL configuration.
 */
export type VRMSettings = Skin3DConfig;

/**
 * Live2D eye gaze and head look-at controller (maps to underlying Cubism FocusController).
 */
export interface Live2DLookAtController {
  targetX: number;
  targetY: number;
  x: number;
  y: number;
  focus: (x: number, y: number, instant?: boolean) => void;
}

/**
 * Internal model structure of Live2D model instance.
 */
export interface Live2DInternalModel {
  width?: number;
  height?: number;
  settings?: {
    motions?: Record<string, Array<Record<string, unknown>>>;
    groups?: Array<{ Name?: string; Ids?: string[] }>;
  };
  coreModel?: {
    update?: () => unknown;
    setParameterValueById: (id: string, value: number) => void;
    getParameterValueById?: (id: string) => number;
  };
  /** Look-at gaze controller (underlying Live2D focusController). */
  focusController?: Live2DLookAtController;
}

/**
 * 2D Live2D model instance loaded inside PIXI.
 */
export interface Live2DModelInstance {
  width?: number;
  height?: number;
  x: number;
  y: number;
  anchor: { x?: number; y?: number; set: (x: number, y?: number) => void };
  scale: { x?: number; y?: number; set: (x: number, y?: number) => void };
  internalModel?: Live2DInternalModel;
  expression?: (name: string) => Promise<void> | void;
  destroy?: (options?: unknown) => void;
  [key: string]: unknown;
}

/**
 * 2D Live2D renderer controller instance.
 */
export interface Renderer2D<TModel = Live2DModelInstance, TApp = unknown> {
  /** Canvas element used for rendering. */
  readonly canvas: HTMLCanvasElement;
  /** Live2D model instance. */
  readonly avatarModel: TModel | null | unknown;
  /** PIXI Application instance. */
  readonly pixiApp: TApp;
  /** Supported tap gesture action keys. */
  readonly TAP_GESTURES?: string[];
  /** Plays a named 2D gesture motion or expression. */
  readonly playGesture?: (gestureName: string) => void | Promise<void>;
  /** Re-calculates and applies fitting transform. */
  fit(): void;
  /** Updates 2D visual transformation configuration. */
  updateTransform(config: Partial<Skin2DConfig>): void;
  /** Disposes resources, listeners, and PIXI application. */
  dispose(): void;
}

/**
 * 3D VRM renderer controller instance.
 */
export interface Renderer3D<
  TVrm = unknown,
  TCamera = unknown,
  TScene = unknown,
  TGltf = unknown
> {
  /** Loaded GLTF object instance. */
  readonly gltf: TGltf;
  /** Loaded VRM model instance. */
  readonly vrm: TVrm;
  /** Supported tap gesture action keys. */
  readonly TAP_GESTURES: string[];
  /** Canvas element used for rendering. */
  readonly canvas: HTMLCanvasElement;
  /** THREE.PerspectiveCamera instance. */
  readonly camera: TCamera;
  /** THREE.Scene instance. */
  readonly scene: TScene;
  /** Plays a named 3D gesture animation (e.g. 'goodbye', 'bow'). */
  readonly playGesture?: (
    gestureName: string,
    optionOverride?: Skin3DActionOption
  ) => void | Promise<void>;
  /** Pauses or resumes animation rendering loop. */
  setPaused(isPaused: boolean): void;
  /** Updates 3D visual transformation configuration. */
  updateTransform(config: Partial<Skin3DConfig>): void;
  /** Disposes resources, WebGL context, and scene meshes. */
  dispose(): void;
}

/**
 * Reactive state stored in SkinEngine.
 */
export interface SkinEngineState {
  gender: Gender;
  emotion: string;
  isSpeaking: boolean;
  fitMode: FitMode;
  skin2d: Skin2DConfig;
  skin3d: Skin3DConfig;
}

/**
 * Function type for computing mouth open amplitude during lip sync.
 */
export type SkinComputeMouthFn = (
  skinEngine?: SkinEngine
) => number | Promise<number> | undefined;

/**
 * Trigger function for invoking a named 2D or 3D gesture.
 */
export type SkinGestureTrigger = (
  emotionName: string
) => Promise<void> | unknown;

/**
 * Handler function registered for executing 2D or 3D gestures.
 */
export type SkinGestureHandler = (
  skinEngine: SkinEngine,
  emotionName: string
) => void;

/**
 * Callback fired when a gesture starts or ends playing.
 */
export type SkinGestureCallback = (
  gestureName?: string,
  skinEngine?: SkinEngine
) => void;

/**
 * Callback fired when a gesture encounters an error.
 */
export type SkinGestureErrorCallback = (
  error?: Error,
  gestureName?: string,
  skinEngine?: SkinEngine
) => void;

/**
 * Error thrown when a requested gesture or motion name is not found in the active model/library.
 */
export class GestureNotFoundError extends Error {
  readonly code = 'ERR_GESTURE_NOT_FOUND';
  readonly gestureName: string;
  readonly mode: EngineMode | null;

  constructor(gestureName: string, mode: EngineMode | null) {
    super(
      `[aiAvatar] Gesture "${gestureName}" not found on ${mode !== null && typeof mode === 'string' && mode !== '' ? mode : 'unknown'} mode`
    );
    this.name = 'GestureNotFoundError';
    this.gestureName = gestureName;
    this.mode = mode;
  }
}

/**
 * Execution context passed to global unified gesture interceptor.
 */
export interface SkinGestureContext {
  /** Current active engine rendering mode ('2d' | '3d' | null). */
  readonly mode: EngineMode | null;
  /** Direct native 2D gesture motion/expression trigger (bypasses global interceptor to prevent recursion). */
  readonly gesture2D: (name?: string) => Promise<void> | void;
  /** Direct native 3D VRMA gesture trigger (bypasses global interceptor to prevent recursion). */
  readonly gesture3D: (name?: string) => Promise<void> | void;
  /** Currently active renderer instance (Renderer2D | Renderer3D | null). */
  readonly renderer: Renderer2D | Renderer3D | null;
}

/**
 * Global unified gesture handler interceptor registered by developer.
 */
export type SkinUnifiedGestureHandler = (
  skinEngine: SkinEngine,
  gestureName: string,
  context: SkinGestureContext
) => Promise<void> | void;

/**
 * Callback fired when engine mode switch starts or updates.
 */
export type SkinModelChangeStartCallback = (mode: EngineMode) => void;

/**
 * Callback fired when engine mode switch finishes.
 */
export type SkinModelChangeEndCallback = (
  renderer?: Renderer2D | Renderer3D | null,
  mode?: EngineMode
) => void;

/**
 * Callback fired when engine mode switch fails.
 */
export type SkinModelChangeErrorCallback = (error?: Error) => void;

/**
 * Callback fired on engine-specific errors (2D or 3D).
 */
export type SkinErrorCallback = (
  error?: Error,
  skinEngine?: SkinEngine
) => void;

/**
 * Callback fired when VRM file loading fails.
 */
export type SkinVRMFileFailCallback = (error?: Error) => void;

/**
 * Callback fired when VRM file loading succeeds.
 */
export type SkinVRMFileSuccessCallback = (vrmUrl?: string) => void;

/**
 * Callback fired when avatar model finishes mounting.
 */
export type SkinMountedCallback = (...args: unknown[]) => void;

/**
 * Type Guard to check if a renderer instance is Renderer3D.
 */
export function isRenderer3D(renderer: unknown): renderer is Renderer3D {
  return (
    typeof renderer === 'object' &&
    renderer !== null &&
    'playGesture' in renderer
  );
}

/**
 * Type Guard to check if a renderer instance is Renderer2D.
 */
export function isRenderer2D(renderer: unknown): renderer is Renderer2D {
  return (
    typeof renderer === 'object' &&
    renderer !== null &&
    'avatarModel' in renderer
  );
}

/**
 * Initialization options for creating a SkinEngine.
 */
export interface SkinEngineOptions {
  /** HTML container element where canvas will be mounted. */
  stageEl: HTMLElement;
  /** URL to the 2D Live2D model (.model3.json). */
  modelUrl?: string;
  /** Initial engine rendering mode ('2d' | '3d'). */
  startMode?: EngineMode;
  /** Initial container fitting mode ('half' | 'full'). */
  fitMode?: FitMode;
  /** 2D visual transformation configuration. */
  skin2d?: Skin2DConfig;
  /** Alias for skin2d.zoom. */
  zoom?: number;
  /** Alias for skin2d.offsetX. */
  offsetX?: number;
  /** Alias for skin2d.offsetY. */
  offsetY?: number;
  /** Alias for skin2d.anchor. */
  anchor?: Point2D;
  /** URL to the 3D VRM model (.vrm). */
  vrmUrl?: string;
  /** 3D visual and animation configuration. */
  skin3d?: Skin3DConfig;
  /** Alias for skin3d.camera. */
  camera?: Skin3DCameraConfig;
  /** Alias for skin3d.model. */
  modelTransform?: Skin3DModelConfig;
  /** Alias for skin3d.pointerLook. */
  pointerLook?: boolean;
  /** Custom 3D gesture handler or config map. */
  gesture3D?: SkinGestureHandler | Record<string, unknown> | null;
  /** Custom 2D gesture handler or config map. */
  gesture2D?: SkinGestureHandler | Record<string, unknown> | null;
  /** Function to compute mouth open amplitude for lip sync. */
  computeMouth?: SkinComputeMouthFn | null;
  /** Callback fired when 3D initialization encounters an error. */
  onThreeDimensionalError?: SkinErrorCallback;
  /** Callback fired when 2D initialization encounters an error. */
  onTwoDimensionalError?: SkinErrorCallback;
  /** Callback fired when loading a custom dropped VRM file fails. */
  VRMFileChangeFail?: SkinVRMFileFailCallback;
  /** Callback fired when loading a custom dropped VRM file succeeds. */
  VRMFileChangeSuccess?: SkinVRMFileSuccessCallback;
  /** Callback fired when avatar model is mounted and rendered. */
  onMounted?: SkinMountedCallback;
  /** Default avatar gender ('female' | 'male'). */
  gender?: Gender;
  /** Callback fired when a gesture starts playing. */
  onGesture?: SkinGestureCallback;
  /** Callback fired when a gesture encounters an error. */
  onGestureError?: SkinGestureErrorCallback;
  /** Callback fired when a gesture completes. */
  onGestureEnd?: SkinGestureCallback;
  /** Callback fired when model mode switch begins. */
  onModelChangeStart?: SkinModelChangeStartCallback;
  /** Alias for onModelChangeStart. */
  onModelChange?: SkinModelChangeStartCallback;
  /** Callback fired when model mode switch finishes. */
  onModelChangeEnd?: SkinModelChangeEndCallback;
  /** Callback fired when model mode switch fails. */
  onModelChangeError?: SkinModelChangeErrorCallback;
  /** URL to bow animation file (.vrma). */
  bow?: string;
  /** URL to goodbye animation file (.vrma). */
  goodbye?: string;
  /** URL to thinking animation file (.vrma). */
  thinking?: string;
  /** URL to look-around animation file (.vrma). */
  look?: string;
  /** URL to relax / idle animation file (.vrma). */
  relax?: string;
  /** URL to surprised animation file (.vrma). */
  surprised?: string;
  /** URL to appearing animation file (.vrma). */
  appearing?: string;
  /** URL to liked animation file (.vrma). */
  liked?: string;
  /** URL to waiting animation file (.vrma). */
  waiting?: string;
  /** Root directory URL path for VRMA animation files. */
  vrmaRootPath?: string;
  /** Global unified gesture handler interceptor. */
  gesture?: SkinUnifiedGestureHandler | null;
  /** List of gesture keys triggered randomly when 3D avatar is tapped. */
  tapGestures?: string[] | Skin3DActionItem[];
  /** List of motion keys triggered randomly when 2D avatar is tapped. */
  tapMotions?: string[];
  /** Semantic motion mapping from action names to Live2D motion group names. */
  motionMap?: Record<string, string>;
  /** Custom semantic expression mapping to expression names. */
  expressionMap?: Record<string, string>;
}

/**
 * Emotion animation blend state.
 */
export interface SkinEmotionBlendState {
  _name?: string;
  name: string;
  target: number;
  weight: number;
  applied: string;
}

/**
 * Skin Engine controller for managing 2D Live2D and 3D VRM avatar rendering.
 */
export interface SkinEngine extends SubscribableStore<SkinEngineState> {
  /** HTML container element. */
  readonly stageEl: HTMLElement;
  /** Whether 2D model URL is configured. */
  readonly has2D: boolean;
  /** Whether 3D model URL is configured. */
  readonly has3D: boolean;
  /** Current engine mode ('2d' | '3d' | null). Setter triggers asynchronous renderer switch. */
  engineMode: EngineMode | null;
  /** Internal engine mode identifier used for forced reloads. */
  _engineMode?: string | null;
  /** Loaded avatar model instance. */
  avatarModel?: Live2DModelInstance | null;
  /** Active renderer instance (Renderer2D or Renderer3D). */
  renderer: Renderer2D | Renderer3D | null;
  /** Switches avatar gender and updates default model URLs. */
  setGender(gender: Gender): void;
  /** Loads and replaces active VRM model with a local File object. */
  loadVRMFile(file: File): void;
  /** Sets active facial emotion and auto-resets after timeout. */
  setEmotion(emotion: string): void;
  /** Updates speaking status for lip sync and emotion reset. */
  setIsSpeaking(isSpeaking: boolean): void;
  /** Sets container fit mode ('half' | 'full'). */
  setFitMode(fitMode: FitMode): void;
  /** Partially updates 2D visual configuration. */
  setSkin2d(updates: Partial<Skin2DConfig>): void;
  /** Partially updates 3D visual configuration. */
  setSkin3d(updates: Partial<Skin3DConfig>): void;
  /** Current 2D visual configuration. */
  readonly skin2d: Skin2DConfig;
  /** Current 3D visual configuration. */
  readonly skin3d: Skin3DConfig;
  /** Current gender setting. */
  readonly gender: Gender;
  /** 2D model URL. */
  modelUrl: string;
  /** 3D VRM model URL. */
  vrmUrl: string;
  /** Triggers a 3D gesture / emotion motion, or registers a custom handler. */
  gesture3D: SkinGestureTrigger | null;
  /** Triggers a 2D gesture / emotion motion, or registers a custom handler. */
  gesture2D: SkinGestureTrigger | null;
  /** Plays a gesture on the current active engine (2D or 3D). */
  gesture?: SkinGestureTrigger | null;
  /** Plays tap gesture randomly from TAP_GESTURES on active engine. */
  playTapGesture?(): Promise<void> | void;
  /** Plays a gesture on the current active engine (2D or 3D). */
  playGesture?(
    name: string,
    optionOverride?: Skin3DActionOption
  ): Promise<void> | void;
  /** Current active gesture / emotion name. Setting triggers onGesture lifecycle. */
  gestureName: string;
  /** Initial rendering start mode. */
  startMode: EngineMode;
  /** Active fitting mode ('half' | 'full'). */
  fitMode: FitMode;
  /** Emotion blend weight state for animation loop easing. */
  emo: SkinEmotionBlendState;
  /** Function to compute mouth open amplitude. */
  computeMouth?: SkinComputeMouthFn;
  /** Callback fired when avatar is mounted. */
  onMounted?: SkinMountedCallback;
  /** Callback fired on 3D error. */
  onThreeDimensionalError?: SkinErrorCallback;
  /** Callback fired on 2D error. */
  onTwoDimensionalError?: SkinErrorCallback;
  /** Callback fired on VRM file load failure. */
  VRMFileChangeFail?: SkinVRMFileFailCallback;
  /** Callback fired on VRM file load success. */
  VRMFileChangeSuccess?: SkinVRMFileSuccessCallback;
  /** Callback fired on gesture start. */
  onGesture?: SkinGestureCallback;
  /** Callback fired on gesture error. */
  onGestureError?: SkinGestureErrorCallback;
  /** Callback fired on gesture end. */
  onGestureEnd?: SkinGestureCallback;
  /** Callback fired when mode change starts. */
  onModelChangeStart?: SkinModelChangeStartCallback;
  /** Alias for onModelChangeStart. */
  onModelChange?: SkinModelChangeStartCallback;
  /** Callback fired when mode change ends. */
  onModelChangeEnd?: SkinModelChangeEndCallback;
  /** Callback fired on mode change error. */
  onModelChangeError?: SkinModelChangeErrorCallback;
  /** Whether engine is currently switching between 2D and 3D. */
  switching?: boolean | null;
  /** List of Live2D lip sync parameter IDs. */
  lipIds?: string[];
}
