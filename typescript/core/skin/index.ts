import { createBaseStore } from '@/core/store';
import {
  EMOTION_TARGET_MAP,
  ENGINE_MODE_MAP,
  DEFAULT_START_MODE,
  FIT_MODE_MAP,
  DEFAULT_FIT_MODE,
  DEFAULT_GENDER,
  DEFAULT_FEMALE_2D_MODEL_URL,
  DEFAULT_MALE_2D_MODEL_URL,
  DEFAULT_FEMALE_3D_MODEL_URL,
  DEFAULT_MALE_3D_MODEL_URL,
  getDefault2DModelUrl,
  getDefault3DModelUrl,
  DEFAULT_2D_OFFSET_X,
  DEFAULT_2D_OFFSET_Y,
  DEFAULT_3D_CAMERA_NEAR,
  DEFAULT_3D_CAMERA_FAR,
  DEFAULT_3D_MODEL_POSITION,
  DEFAULT_3D_MODEL_SCALE,
  DEFAULT_3D_MODEL_ROTATION,
  DEFAULT_3D_POINTER_LOOK
} from '@/core/constants';
import { initSkinMode } from './canvas';
import { defaultGesture2D, bootAvatar } from './renderer-2d';
import { defaultGesture3D, loadVRMFile, bootVRM } from './renderer-3d';
import type {
  SkinEngine,
  SkinEngineOptions,
  Skin2DConfig,
  Skin3DConfig,
  Renderer2D,
  Renderer3D
} from '@types';

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

/**
 * Factory function to initialize and create a new SkinEngine controller instance.
 *
 * @param setting - Skin engine initialization options.
 * @returns Initialized skin engine instance, or void on error.
 */
export function initSkinEngine(setting: SkinEngineOptions | any = {}): SkinEngine | void {
  const {
    stageEl,
    modelUrl = '',
    startMode = DEFAULT_START_MODE,
    fitMode = DEFAULT_FIT_MODE,
    vrmUrl = '',
    gesture3D = null,
    gesture2D = null,
    computeMouth = null,
    onThreeDimensionalError,
    onTwoDimensionalError,
    VRMFileChangeFail,
    VRMFileChangeSuccess,
    onMounted
  } = setting;

  if (stageEl instanceof HTMLElement === false) {
    console.error('[aiAvatar initSkinMode] stageEl is not an HTMLElement');
    return;
  }

  const safeModelUrl =
    typeof modelUrl === 'string' && modelUrl !== ''
      ? modelUrl
      : getDefault2DModelUrl(setting.gender || DEFAULT_GENDER);

  const safeGesture2D =
    typeof gesture2D === 'function'
      ? gesture2D
      : [DEFAULT_FEMALE_2D_MODEL_URL, DEFAULT_MALE_2D_MODEL_URL].includes(
            safeModelUrl
          )
        ? defaultGesture2D
        : null;

  const safeVrmUrl =
    typeof vrmUrl === 'string' && vrmUrl !== ''
      ? vrmUrl
      : /\.vrm($|\?)/i.test(safeModelUrl)
        ? safeModelUrl
        : getDefault3DModelUrl(setting.gender || DEFAULT_GENDER);

  const safeGesture3D =
    typeof gesture3D === 'function'
      ? gesture3D
      : [DEFAULT_FEMALE_3D_MODEL_URL, DEFAULT_MALE_3D_MODEL_URL].includes(
            safeVrmUrl
          )
        ? defaultGesture3D
        : null;

  const skin2dOption =
    typeof setting.skin2d === 'object' && setting.skin2d !== null
      ? setting.skin2d
      : {};

  const initialSkin2d: Skin2DConfig = {
    ...skin2dOption,
    zoom:
      typeof skin2dOption.zoom === 'number' &&
      Number.isFinite(skin2dOption.zoom)
        ? skin2dOption.zoom
        : typeof setting.zoom === 'number' && Number.isFinite(setting.zoom)
          ? setting.zoom
          : undefined,
    offsetX:
      typeof skin2dOption.offsetX === 'number' &&
      Number.isFinite(skin2dOption.offsetX)
        ? skin2dOption.offsetX
        : typeof setting.offsetX === 'number' &&
            Number.isFinite(setting.offsetX)
          ? setting.offsetX
          : DEFAULT_2D_OFFSET_X,
    offsetY:
      typeof skin2dOption.offsetY === 'number' &&
      Number.isFinite(skin2dOption.offsetY)
        ? skin2dOption.offsetY
        : typeof setting.offsetY === 'number' &&
            Number.isFinite(setting.offsetY)
          ? setting.offsetY
          : DEFAULT_2D_OFFSET_Y,
    anchor: {
      ...(typeof skin2dOption.anchor === 'object' &&
      skin2dOption.anchor !== null
        ? skin2dOption.anchor
        : typeof setting.anchor === 'object' && setting.anchor !== null
          ? setting.anchor
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
  const cameraOption = skin3dOption.camera || setting.camera || {};
  const modelOption = skin3dOption.model || setting.modelTransform || {};

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
    model: {
      position: modelOption.position || DEFAULT_3D_MODEL_POSITION,
      scale: modelOption.scale ?? DEFAULT_3D_MODEL_SCALE,
      rotation: modelOption.rotation || DEFAULT_3D_MODEL_ROTATION
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
      typeof (skin3dOption.pointerLook ?? setting.pointerLook) === 'boolean'
        ? (skin3dOption.pointerLook ?? setting.pointerLook)
        : DEFAULT_3D_POINTER_LOOK,
    bow: skin3dOption.bow || setting.bow || '',
    wave: skin3dOption.wave || setting.wave || '',
    thinking: skin3dOption.thinking || setting.thinking || '',
    look: skin3dOption.look || setting.look || '',
    relax: skin3dOption.relax || setting.relax || '',
    surprised: skin3dOption.surprised || setting.surprised || '',
    vrmaRootPath: skin3dOption.vrmaRootPath || setting.vrmaRootPath || ''
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

  const skinEngine: any = {
    // --- Store Pattern Methods ---
    getState: store.getState,
    setState: store.setState,
    subscribe: store.subscribe,
    setGender: (gender: string) => {
      store.setState({ gender });
      skinEngine.modelUrl = getDefault2DModelUrl(gender);
      skinEngine.vrmUrl = getDefault3DModelUrl(gender);
    },
    setEmotion: (emotion: string) => {
      store.setState({ emotion });
      skinEngine.gestureName = emotion;

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
        Object.values(FIT_MODE_MAP).includes(newFitMode as any) === true
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
            model: {
              ...prevState.skin3d?.model,
              ...(typeof partialConfig.model === 'object' &&
              partialConfig.model !== null
                ? partialConfig.model
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
      return setting.gender;
    },

    _modelUrl: safeModelUrl,
    get modelUrl(): string {
      return this._modelUrl;
    },
    set modelUrl(newModelUrl: string) {
      if (typeof newModelUrl === 'string' && newModelUrl !== '') {
        this._modelUrl = newModelUrl;
      }
    },

    get loadVRMFile() {
      return function _loadVRMFile(...args: any[]) {
        return (loadVRMFile as any)(skinEngine, ...args);
      };
    },

    get computeMouth() {
      return function _computeMouth(...args: any[]) {
        if (typeof computeMouth === 'function') {
          return computeMouth(...args);
        }
      };
    },

    get onMounted() {
      return function _onMounted(...args: any[]) {
        if (typeof onMounted === 'function') {
          return onMounted(...args);
        }
      };
    },

    get onThreeDimensionalError() {
      return function _onThreeDimensionalError(...args: any[]) {
        if (typeof onThreeDimensionalError === 'function') {
          return onThreeDimensionalError(...args);
        }
      };
    },
    get onTwoDimensionalError() {
      return function _onTwoDimensionalError(...args: any[]) {
        if (typeof onTwoDimensionalError === 'function') {
          return onTwoDimensionalError(...args);
        }
      };
    },

    get VRMFileChangeFail() {
      return function _VRMFileChangeFail(...args: any[]) {
        if (typeof VRMFileChangeFail === 'function') {
          return VRMFileChangeFail(...args);
        }
      };
    },

    get VRMFileChangeSuccess() {
      return function _VRMFileChangeSuccess(...args: any[]) {
        if (typeof VRMFileChangeSuccess === 'function') {
          return VRMFileChangeSuccess(...args);
        }
      };
    },

    emo: {
      _name: 'neutral',
      get name(): string {
        return this._name;
      },
      set name(newName: string) {
        const newTarget = (EMOTION_TARGET_MAP as Record<string, number>)[newName];

        if (
          (typeof newTarget !== 'number' && newName !== 'neutral') ||
          this._name === newName
        ) {
          return;
        }

        this._name = newName;
        this.target = newTarget || 0;
      },
      target: 0,
      weight: 0,
      applied: ''
    },

    get has2D(): boolean {
      return typeof this.modelUrl === 'string' && this.modelUrl !== '';
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

    get onGesture() {
      return function (...args: any[]) {
        if (typeof setting.onGesture === 'function') {
          return setting.onGesture(...args);
        }
      };
    },
    get onGestureError() {
      return function (...args: any[]) {
        if (typeof setting.onGestureError === 'function') {
          return setting.onGestureError(...args);
        }
      };
    },
    get onGestureEnd() {
      return function (...args: any[]) {
        if (typeof setting.onGestureEnd === 'function') {
          return setting.onGestureEnd(...args);
        }
      };
    },

    get onModelChangeStart() {
      return function (...args: any[]) {
        if (typeof setting.onModelChangeStart === 'function') {
          return setting.onModelChangeStart(...args);
        }
      };
    },
    get onModelChange() {
      return function (...args: any[]) {
        if (typeof setting.onModelChange === 'function') {
          return setting.onModelChange(...args);
        }
      };
    },
    get onModelChangeEnd() {
      return function (...args: any[]) {
        if (typeof setting.onModelChangeEnd === 'function') {
          return setting.onModelChangeEnd(...args);
        }
      };
    },
    get onModelChangeError() {
      return function (...args: any[]) {
        if (typeof setting.onModelChangeError === 'function') {
          return setting.onModelChangeError(...args);
        }
      };
    },

    _engineMode: null,
    get engineMode(): string {
      return this._engineMode;
    },
    set engineMode(newEngineMode: string) {
      if (this.switching === true || newEngineMode === this.engineMode) {
        return;
      }

      if (
        (typeof newEngineMode === 'string' && newEngineMode !== '') ||
        newEngineMode === null
      ) {
        this._engineMode = newEngineMode;

        if (typeof this.onModelChangeStart === 'function') {
          this.onModelChangeStart(newEngineMode);
        }
        if (typeof this.onModelChange === 'function') {
          this.onModelChange(newEngineMode);
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
            this.renderer =
              newEngineMode === ENGINE_MODE_MAP.threeDimensional
                ? await bootVRM(this, setting)
                : await bootAvatar(this, this.modelUrl);
          } catch (error) {
            console.error(error);

            if (typeof this.onModelChangeError === 'function') {
              this.onModelChangeError(error as Error);
            }
          }

          if (typeof this.onModelChangeEnd === 'function') {
            this.onModelChangeEnd(this.renderer, newEngineMode);
          }
          this.switching = false;
        })();
      }
    },

    _gesture3D: safeGesture3D,
    get gesture3D() {
      return function _gesture3D(this: any, emotionName: string) {
        if (typeof this._gesture3D !== 'function') {
          console.warn('3D hand movement function is not registered');
          return () => {
            console.warn('gesture3D is not registered');
          };
        }
        return this._gesture3D.call(this, this, emotionName);
      };
    },
    set gesture3D(newGesture3D: any) {
      if (typeof newGesture3D === 'function' || newGesture3D === null) {
        this._gesture3D = newGesture3D;
      }
    },

    _gesture2D: safeGesture2D,
    get gesture2D() {
      return function _gesture2D(this: any, emotionName: string) {
        if (typeof this._gesture2D !== 'function') {
          console.warn('2D hand movement function is not registered');
          return () => {
            console.warn('gesture2D is not registered');
          };
        }
        return this._gesture2D.call(this, this, emotionName);
      };
    },
    set gesture2D(newGesture2D: any) {
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

    _gestureName: 'neutral',
    get gestureName(): string {
      return this._gestureName;
    },
    set gestureName(newGestureName: string) {
      if (typeof newGestureName === 'string' && newGestureName !== '') {
        this.emo.name = newGestureName;
        this._gestureName = newGestureName;

        (async () => {
          try {
            if (typeof this.onGesture === 'function') {
              this.onGesture(newGestureName, this);
            }

            if (typeof this.gesture === 'function') {
              await this.gesture(newGestureName);
            }
          } catch (error) {
            console.error(error);
            if (typeof this.onGestureError === 'function') {
              this.onGestureError(error as Error, newGestureName, this);
            }
          } finally {
            if (typeof this.onGestureEnd === 'function') {
              this.onGestureEnd(newGestureName, this);
            }
          }
        })();
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
        if (Object.values(FIT_MODE_MAP).includes(newFitMode as any)) {
          store.setState({ fitMode: newFitMode });
        } else {
          store.setState({ fitMode: DEFAULT_FIT_MODE });
        }
      }
    }
  };

  initSkinMode(skinEngine);

  return skinEngine as SkinEngine;
}
