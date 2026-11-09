import { createBaseStore } from '@/core/store';
import {
  EMOTION_TARGET_MAP,
  ENGINE_MODE_MAP,
  DEFAULT_START_MODE,
  FIT_MODE_MAP,
  DEFAULT_FIT_MODE,
  DEFAULT_GENDER,
  getDefault2DModelUrl,
  getDefault3DModelUrl,
  DEFAULT_2D_OFFSET_X,
  DEFAULT_2D_OFFSET_Y,
  DEFAULT_3D_CAMERA_NEAR,
  DEFAULT_3D_CAMERA_FAR,
  DEFAULT_3D_MODEL_POSITION,
  DEFAULT_3D_MODEL_SCALE,
  DEFAULT_3D_POINTER_LOOK,
  getDefault3DModelRotation
} from '@/core/constants';
import { initSkinMode } from './canvas';
import { defaultGesture2D, bootAvatar } from './renderer-2d';
import { loadVRMFile, bootVRM } from './renderer-3d';
import {
  GestureNotFoundError,
  isRenderer2D,
  isRenderer3D,
  type EngineMode,
  type SkinEngine,
  type SkinEngineOptions,
  type Skin2DConfig,
  type Skin3DConfig,
  type Skin3DActionOption,
  type SkinEmotionBlendState,
  type Renderer2D,
  type Renderer3D,
  type SkinComputeMouthFn,
  type SkinMountedCallback,
  type SkinErrorCallback,
  type SkinVRMFileFailCallback,
  type SkinVRMFileSuccessCallback,
  type SkinGestureCallback,
  type SkinGestureErrorCallback,
  type SkinModelChangeStartCallback,
  type SkinModelChangeEndCallback,
  type SkinModelChangeErrorCallback,
  type SkinGestureContext,
  type SkinUnifiedGestureHandler
} from './types';

export * from './types';
export * from './canvas';
export * from './renderer-2d';
export * from './renderer-3d';

/**
 * Extended internal interface for SkinEngine state store.
 */
export interface InternalSkinStoreState {
  gender: string;
  emotion: string;
  isSpeaking: boolean;
  fitMode: string;
  skin2d: Skin2DConfig;
  skin3d: Skin3DConfig;
}

interface InternalSkinEngine extends SkinEngine {
  _live2dUrl: string;
  _renderer: Renderer2D | Renderer3D | null;
  _engineMode: string | null;
  _customUnifiedGesture?: SkinUnifiedGestureHandler | null;
  _gestureName: string;
  _vrmUrl: string;
  _switching: boolean | null;
  _lipIds: string[];
  _startMode: string;
  emotionBlend: SkinEmotionBlendState;
  playGesture: (
    gestureName: string,
    optionOverride?: Skin3DActionOption
  ) => Promise<void> | void;
  playTapGesture: () => Promise<void>;
}

/**
 * Factory function to initialize and create a new SkinEngine controller instance.
 *
 * @param setting - Skin engine initialization options.
 * @returns Initialized skin engine instance, or void on error.
 */
export function initSkinEngine(
  setting: Partial<SkinEngineOptions> = {}
): SkinEngine | void {
  const {
    stageEl,
    live2dUrl = '',
    startMode = DEFAULT_START_MODE,
    fitMode = DEFAULT_FIT_MODE,
    vrmUrl = '',
    computeMouth = null,
    gesture = null,
    on3DError,
    on2DError,
    onVrmFileChangeFail,
    onVrmFileChangeSuccess,
    onMounted,
    onGesture,
    onGestureEnd,
    onGestureError,
    onModelChangeStart,
    onModelChangeEnd,
    onModelChangeError
  } = setting;

  if (stageEl instanceof HTMLElement === false) {
    console.error('[aiAvatar initSkinMode] stageEl is not an HTMLElement');
    return;
  }

  const safeLive2dUrl =
    typeof live2dUrl === 'string' && live2dUrl !== ''
      ? live2dUrl
      : getDefault2DModelUrl(setting.gender || DEFAULT_GENDER);

  const safeVrmUrl =
    typeof vrmUrl === 'string' && vrmUrl !== ''
      ? vrmUrl
      : /\.vrm($|\?)/i.test(safeLive2dUrl)
        ? safeLive2dUrl
        : getDefault3DModelUrl(setting.gender || DEFAULT_GENDER);

  const skin2dOption =
    typeof setting.skin2d === 'object' && setting.skin2d !== null
      ? setting.skin2d
      : {};

  const initialSkin2d: Skin2DConfig = {
    ...skin2dOption,
    offsetX:
      typeof skin2dOption.offsetX === 'number' &&
      Number.isFinite(skin2dOption.offsetX)
        ? skin2dOption.offsetX
        : DEFAULT_2D_OFFSET_X,
    offsetY:
      typeof skin2dOption.offsetY === 'number' &&
      Number.isFinite(skin2dOption.offsetY)
        ? skin2dOption.offsetY
        : DEFAULT_2D_OFFSET_Y,
    anchor: {
      ...(typeof skin2dOption.anchor === 'object' &&
      skin2dOption.anchor !== null
        ? skin2dOption.anchor
        : {})
    },
    half: {
      ...(typeof skin2dOption.half === 'object' && skin2dOption.half !== null
        ? skin2dOption.half
        : {})
    },
    full: {
      ...(typeof skin2dOption.full === 'object' && skin2dOption.full !== null
        ? skin2dOption.full
        : {})
    }
  };

  const skin3dOption =
    typeof setting.skin3d === 'object' && setting.skin3d !== null
      ? setting.skin3d
      : {};
  const cameraOption = skin3dOption.camera || {};
  const modelTransformOption = skin3dOption.modelTransform || {};

  const initialSkin3d: Skin3DConfig = {
    ...skin3dOption,
    camera: {
      fov:
        typeof cameraOption.fov === 'number' &&
        Number.isFinite(cameraOption.fov)
          ? cameraOption.fov
          : undefined,
      near:
        typeof cameraOption.near === 'number' &&
        Number.isFinite(cameraOption.near)
          ? cameraOption.near
          : DEFAULT_3D_CAMERA_NEAR,
      far:
        typeof cameraOption.far === 'number' &&
        Number.isFinite(cameraOption.far)
          ? cameraOption.far
          : DEFAULT_3D_CAMERA_FAR,
      position: cameraOption.position || undefined,
      lookAt: cameraOption.lookAt || undefined
    },
    modelTransform: {
      position: modelTransformOption.position || DEFAULT_3D_MODEL_POSITION,
      scale: modelTransformOption.scale ?? DEFAULT_3D_MODEL_SCALE,
      rotation:
        modelTransformOption.rotation ||
        getDefault3DModelRotation(setting.gender || DEFAULT_GENDER)
    },
    half: {
      ...(typeof skin3dOption.half === 'object' && skin3dOption.half !== null
        ? skin3dOption.half
        : {})
    },
    full: {
      ...(typeof skin3dOption.full === 'object' && skin3dOption.full !== null
        ? skin3dOption.full
        : {})
    },
    pointerLook:
      typeof skin3dOption.pointerLook === 'boolean'
        ? skin3dOption.pointerLook
        : DEFAULT_3D_POINTER_LOOK
  };

  const store = createBaseStore<InternalSkinStoreState>({
    gender: setting.gender || DEFAULT_GENDER,
    emotion: 'neutral',
    isSpeaking: false,
    fitMode: fitMode || DEFAULT_FIT_MODE,
    skin2d: initialSkin2d,
    skin3d: initialSkin3d
  });

  let emotionAutoRestoreTimer: ReturnType<typeof setTimeout> | null = null;

  const clearEmotionAutoRestoreTimer = (): void => {
    if (emotionAutoRestoreTimer !== null) {
      clearTimeout(emotionAutoRestoreTimer);
      emotionAutoRestoreTimer = null;
    }
  };

  const skinEngine: InternalSkinEngine = {
    // --- Store Pattern Methods ---
    getState: store.getState,
    setState: store.setState,
    subscribe: store.subscribe,
    setGender: (gender: string) => {
      store.setState({ gender });
      skinEngine.live2dUrl = getDefault2DModelUrl(gender);
      skinEngine.vrmUrl = getDefault3DModelUrl(gender);
    },
    setEmotion: (emotion: string) => {
      store.setState({ emotion });
      skinEngine.emotionBlend.name = emotion;

      if (skinEngine.engineMode === ENGINE_MODE_MAP.twoDimensional) {
        void defaultGesture2D(skinEngine, emotion);
      }

      clearEmotionAutoRestoreTimer();
      if (
        typeof emotion === 'string' &&
        emotion !== 'neutral' &&
        emotion !== ''
      ) {
        emotionAutoRestoreTimer = setTimeout(() => {
          if (store.getState().isSpeaking !== true) {
            skinEngine.setEmotion('neutral');
          }
        }, 3000);
      }
    },
    setIsSpeaking: (isSpeaking: boolean) => {
      store.setState({ isSpeaking });
      if (isSpeaking === false) {
        clearEmotionAutoRestoreTimer();
        skinEngine.setEmotion('neutral');
      }
    },
    setFitMode: (newFitMode: string) => {
      if (
        typeof newFitMode === 'string' &&
        (Object.values(FIT_MODE_MAP) as string[]).includes(newFitMode) === true
      ) {
        store.setState({ fitMode: newFitMode });
      }
    },
    setSkin2d: (partialConfig: Partial<Skin2DConfig> = {}) => {
      if (typeof partialConfig === 'object' && partialConfig !== null) {
        store.setState((prevState) => ({
          skin2d: {
            ...prevState.skin2d,
            ...partialConfig,
            anchor: {
              ...prevState.skin2d?.anchor,
              ...(typeof partialConfig.anchor === 'object' &&
              partialConfig.anchor !== null
                ? partialConfig.anchor
                : {})
            },
            half: {
              ...prevState.skin2d?.half,
              ...(typeof partialConfig.half === 'object' &&
              partialConfig.half !== null
                ? partialConfig.half
                : {})
            },
            full: {
              ...prevState.skin2d?.full,
              ...(typeof partialConfig.full === 'object' &&
              partialConfig.full !== null
                ? partialConfig.full
                : {})
            }
          }
        }));
      }
    },
    setSkin3d: (partialConfig: Partial<Skin3DConfig> = {}) => {
      if (typeof partialConfig === 'object' && partialConfig !== null) {
        store.setState((prevState) => ({
          skin3d: {
            ...prevState.skin3d,
            ...partialConfig,
            camera: {
              ...prevState.skin3d?.camera,
              ...(typeof partialConfig.camera === 'object' &&
              partialConfig.camera !== null
                ? partialConfig.camera
                : {})
            },
            modelTransform: {
              ...prevState.skin3d?.modelTransform,
              ...(typeof partialConfig.modelTransform === 'object' &&
              partialConfig.modelTransform !== null
                ? partialConfig.modelTransform
                : {})
            },
            half: {
              ...prevState.skin3d?.half,
              ...(typeof partialConfig.half === 'object' &&
              partialConfig.half !== null
                ? partialConfig.half
                : {})
            },
            full: {
              ...prevState.skin3d?.full,
              ...(typeof partialConfig.full === 'object' &&
              partialConfig.full !== null
                ? partialConfig.full
                : {})
            }
          }
        }));
      }
    },
    get skin2d(): Skin2DConfig {
      return store.getState().skin2d;
    },
    get skin3d(): Skin3DConfig {
      return store.getState().skin3d;
    },

    get stageEl(): HTMLElement {
      return stageEl;
    },

    get gender(): string {
      return setting.gender || DEFAULT_GENDER;
    },

    _live2dUrl: safeLive2dUrl,
    get live2dUrl(): string {
      return this._live2dUrl;
    },
    set live2dUrl(newLive2dUrl: string) {
      if (typeof newLive2dUrl === 'string' && newLive2dUrl !== '') {
        this._live2dUrl = newLive2dUrl;
      }
    },

    get loadVRMFile() {
      return function _loadVRMFile(file: File) {
        return loadVRMFile(skinEngine, file);
      };
    },

    get computeMouth(): SkinComputeMouthFn {
      return (...args: Parameters<SkinComputeMouthFn>) => {
        if (typeof computeMouth === 'function') {
          return computeMouth(...args);
        }
      };
    },

    get onMounted(): SkinMountedCallback {
      return (...args: unknown[]) => {
        if (typeof onMounted === 'function') {
          return onMounted(...args);
        }
      };
    },

    get on3DError(): SkinErrorCallback {
      return (...args: Parameters<SkinErrorCallback>) => {
        if (typeof on3DError === 'function') {
          return on3DError(...args);
        }
      };
    },

    get on2DError(): SkinErrorCallback {
      return (...args: Parameters<SkinErrorCallback>) => {
        if (typeof on2DError === 'function') {
          return on2DError(...args);
        }
      };
    },

    get onVrmFileChangeFail(): SkinVRMFileFailCallback {
      return (...args: Parameters<SkinVRMFileFailCallback>) => {
        if (typeof onVrmFileChangeFail === 'function') {
          return onVrmFileChangeFail(...args);
        }
      };
    },

    get onVrmFileChangeSuccess(): SkinVRMFileSuccessCallback {
      return (...args: Parameters<SkinVRMFileSuccessCallback>) => {
        if (typeof onVrmFileChangeSuccess === 'function') {
          return onVrmFileChangeSuccess(...args);
        }
      };
    },

    emotionBlend: {
      _name: 'neutral',
      get name(): string {
        return this._name || 'neutral';
      },
      set name(newName: string) {
        const newTarget = (EMOTION_TARGET_MAP as Record<string, number>)[
          newName
        ];

        if (
          (typeof newTarget !== 'number' && newName !== 'neutral') ||
          this._name === newName
        ) {
          return;
        }

        this._name = newName;
        this.target = typeof newTarget === 'number' ? newTarget : 0;
      },
      target: 0,
      weight: 0,
      applied: ''
    },

    get has2D(): boolean {
      return typeof this.live2dUrl === 'string' && this.live2dUrl !== '';
    },

    get has3D(): boolean {
      return typeof this.vrmUrl === 'string' && this.vrmUrl !== '';
    },

    _renderer: null,
    get renderer(): Renderer2D | Renderer3D | null {
      return this._renderer;
    },
    set renderer(newRenderer: Renderer2D | Renderer3D | null) {
      this._renderer = newRenderer;
    },

    get onGesture(): SkinGestureCallback {
      return (...args: Parameters<SkinGestureCallback>) => {
        if (typeof onGesture === 'function') {
          return onGesture(...args);
        }
      };
    },
    get onGestureError(): SkinGestureErrorCallback {
      return (...args: Parameters<SkinGestureErrorCallback>) => {
        if (typeof onGestureError === 'function') {
          return onGestureError(...args);
        }
      };
    },
    get onGestureEnd(): SkinGestureCallback {
      return (...args: Parameters<SkinGestureCallback>) => {
        if (typeof onGestureEnd === 'function') {
          return onGestureEnd(...args);
        }
      };
    },

    get onModelChangeStart(): SkinModelChangeStartCallback {
      return (...args: Parameters<SkinModelChangeStartCallback>) => {
        if (typeof onModelChangeStart === 'function') {
          return onModelChangeStart(...args);
        }
      };
    },
    get onModelChangeEnd(): SkinModelChangeEndCallback {
      return (...args: Parameters<SkinModelChangeEndCallback>) => {
        if (typeof onModelChangeEnd === 'function') {
          return onModelChangeEnd(...args);
        }
      };
    },
    get onModelChangeError(): SkinModelChangeErrorCallback {
      return (...args: Parameters<SkinModelChangeErrorCallback>) => {
        if (typeof onModelChangeError === 'function') {
          return onModelChangeError(...args);
        }
      };
    },

    _engineMode: null,
    get engineMode(): string | null {
      return this._engineMode;
    },
    set engineMode(newEngineMode: string | null) {
      if (this.switching === true || newEngineMode === this.engineMode) {
        return;
      }

      if (
        (typeof newEngineMode === 'string' && newEngineMode !== '') ||
        newEngineMode === null
      ) {
        this._engineMode = newEngineMode;

        if (typeof this.onModelChangeStart === 'function') {
          this.onModelChangeStart(newEngineMode ?? '');
        }

        (async () => {
          this.switching = true;

          if (typeof this.renderer?.dispose === 'function') {
            try {
              this.renderer.dispose();
            } catch (_error) {}
            this.renderer = null;
          }
          try {
            const booted =
              newEngineMode === ENGINE_MODE_MAP.threeDimensional
                ? await bootVRM(this, this.skin3d)
                : await bootAvatar(this, this.live2dUrl);
            this.renderer = booted || null;
          } catch (error) {
            console.error(error);

            if (typeof this.onModelChangeError === 'function') {
              const normalizedError =
                error instanceof Error ? error : new Error(String(error));
              this.onModelChangeError(normalizedError);
            }
          }

          if (typeof this.onModelChangeEnd === 'function') {
            this.onModelChangeEnd(this.renderer, newEngineMode ?? '');
          }
          this.switching = false;
        })();
      }
    },

    _customUnifiedGesture: typeof gesture === 'function' ? gesture : null,

    async playGesture(
      gestureName: string,
      optionOverride?: Skin3DActionOption
    ): Promise<void> {
      const currentMode: EngineMode | null =
        this.engineMode === ENGINE_MODE_MAP.twoDimensional
          ? '2d'
          : this.engineMode === ENGINE_MODE_MAP.threeDimensional
            ? '3d'
            : null;

      if (typeof gestureName !== 'string' || gestureName === '') {
        const error = new GestureNotFoundError(
          String(gestureName),
          currentMode
        );
        if (typeof this.onGestureError === 'function') {
          this.onGestureError(error, String(gestureName), this);
        }
        throw error;
      }

      this._gestureName = gestureName;

      if (typeof this.onGesture === 'function') {
        this.onGesture(gestureName, this);
      }

      try {
        const context: SkinGestureContext = {
          mode: currentMode,
          renderer: this.renderer,
          gesture2D: (name?: string): Promise<void> | void => {
            const target =
              typeof name === 'string' && name !== '' ? name : gestureName;
            if (
              isRenderer2D(this.renderer) &&
              typeof this.renderer.playGesture === 'function'
            ) {
              return this.renderer.playGesture(target);
            }
          },
          gesture3D: (name?: string): Promise<void> | void => {
            const target =
              typeof name === 'string' && name !== '' ? name : gestureName;
            if (
              isRenderer3D(this.renderer) &&
              typeof this.renderer.playGesture === 'function'
            ) {
              return typeof optionOverride !== 'undefined'
                ? this.renderer.playGesture(target, optionOverride)
                : this.renderer.playGesture(target);
            }
          }
        };

        if (typeof this._customUnifiedGesture === 'function') {
          await this._customUnifiedGesture(this, gestureName, context);
          return;
        }

        if (currentMode === '2d') {
          await context.gesture2D(gestureName);
        } else if (currentMode === '3d') {
          await context.gesture3D(gestureName);
        }
      } catch (error) {
        const normalizedError =
          error instanceof Error ? error : new Error(String(error));
        if (typeof this.onGestureError === 'function') {
          this.onGestureError(normalizedError, gestureName, this);
        }
        throw normalizedError;
      } finally {
        if (typeof this.onGestureEnd === 'function') {
          this.onGestureEnd(gestureName, this);
        }
      }
    },

    async playTapGesture(): Promise<void> {
      const currentMode: '2d' | '3d' =
        this.engineMode === ENGINE_MODE_MAP.twoDimensional ? '2d' : '3d';
      const tapGestures = this.renderer?.TAP_GESTURES;
      let selectedGesture = '';

      if (Array.isArray(tapGestures) && tapGestures.length > 0) {
        const randomIndex = Math.floor(Math.random() * tapGestures.length);
        selectedGesture = tapGestures[randomIndex];
      } else {
        selectedGesture = currentMode === '2d' ? 'tap' : 'goodbye';
      }

      await this.playGesture(selectedGesture);
    },

    _gestureName: 'neutral',
    get gestureName(): string {
      return this._gestureName;
    },
    set gestureName(newGestureName: string) {
      if (typeof newGestureName === 'string' && newGestureName !== '') {
        this._gestureName = newGestureName;
        const gesturePromise = this.playGesture(newGestureName);
        if (gesturePromise instanceof Promise) {
          gesturePromise.catch((error: unknown) => {
            console.error(error);
          });
        }
      }
    },

    _vrmUrl: safeVrmUrl,
    get vrmUrl(): string {
      return this._vrmUrl;
    },
    set vrmUrl(newVrmUrl: string) {
      if (typeof newVrmUrl === 'string' && newVrmUrl !== '') {
        this._vrmUrl = newVrmUrl;
      }
    },

    _switching: null,
    get switching(): boolean | null {
      return this._switching;
    },
    set switching(newSwitching: boolean | null) {
      if (typeof newSwitching === 'boolean' || newSwitching === null) {
        this._switching = newSwitching;
      }
    },

    _lipIds: ['ParamMouthOpenY'],
    get lipIds(): string[] {
      return this._lipIds;
    },
    set lipIds(newLipIds: string[]) {
      if (Array.isArray(newLipIds) || newLipIds === null) {
        this._lipIds = newLipIds;
      }
    },

    _startMode: startMode || DEFAULT_START_MODE,
    get startMode(): string {
      return this._startMode;
    },
    set startMode(newStartMode: string) {
      if (typeof newStartMode === 'string' && newStartMode !== '') {
        this._startMode = newStartMode;
      }
    },

    get fitMode(): string {
      return store.getState().fitMode || DEFAULT_FIT_MODE;
    },
    set fitMode(newFitMode: string) {
      if (typeof newFitMode === 'string' && newFitMode !== '') {
        if ((Object.values(FIT_MODE_MAP) as string[]).includes(newFitMode)) {
          store.setState({ fitMode: newFitMode });
        } else {
          store.setState({ fitMode: DEFAULT_FIT_MODE });
        }
      }
    }
  };

  initSkinMode(skinEngine);

  return skinEngine;
}

export {
  resolveCascadeValue,
  resolve2DMotion,
  resolve2DExpression,
  normalize3DActionItem,
  resolve3DAction,
  resolve3DActionPool,
  resolveAll3DPools,
  type Resolved2DMotion,
  type Resolved3DAction
} from './resolver';
