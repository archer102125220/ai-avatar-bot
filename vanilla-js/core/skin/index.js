import { createBaseStore } from '../store';
import {
  EMOTION_TARGET_MAP,
  ENGINE_MODE_MAP,
  DEFAULT_START_MODE,
  FIT_MODE_MAP,
  DEFAULT_FIT_MODE,
  GENDER_MAP,
  DEFAULT_GENDER,
  DEFAULT_FEMALE_2D_MODEL_URL,
  DEFAULT_MALE_2D_MODEL_URL,
  DEFAULT_FEMALE_3D_MODEL_URL,
  DEFAULT_MALE_3D_MODEL_URL,
  DEFAULT_2D_HALF_ZOOM,
  DEFAULT_2D_FULL_ZOOM,
  DEFAULT_2D_OFFSET_X,
  DEFAULT_2D_OFFSET_Y,
  DEFAULT_2D_ANCHOR,
  DEFAULT_3D_CAMERA_FOV,
  DEFAULT_3D_CAMERA_NEAR,
  DEFAULT_3D_CAMERA_FAR,
  DEFAULT_3D_CAMERA_POSITION,
  DEFAULT_3D_CAMERA_LOOK_AT,
  DEFAULT_3D_MODEL_POSITION,
  DEFAULT_3D_MODEL_SCALE,
  DEFAULT_3D_MODEL_ROTATION,
  DEFAULT_3D_POINTER_LOOK
} from '../constants';
import { initSkinMode } from './canvas';
import { defaultGesture2D, bootAvatar } from './renderer-2d';
import { defaultGesture3D, loadVRMFile, bootVRM } from './renderer-3d';

export * from './canvas';
export * from './renderer-2d';
export * from './renderer-3d';

/**
 * 2D 視覺變換設定
 * @typedef {Object} Skin2DConfig
 * @property {number} [zoom] - 縮放倍率（HALF 預設 1.9，FULL 預設 1.0）
 * @property {number} [offsetX] - 水平偏移像素（預設 0）
 * @property {number} [offsetY] - 垂直偏移像素（預設 0）
 * @property {{x: number, y: number}} [anchor] - 模型錨點（預設 { x: 0.5, y: 1.0 }）
 */

/**
 * 3D 攝影機設定
 * @typedef {Object} Skin3DCameraConfig
 * @property {number} [fov] - 視野 (FOV，預設 26)
 * @property {number} [near] - 近裁剪面 (預設 0.1)
 * @property {number} [far] - 遠裁剪面 (預設 20)
 * @property {{x: number, y: number, z: number} | [number, number, number]} [position] - 相機世界座標
 * @property {{x: number, y: number, z: number} | [number, number, number]} [lookAt] - 相機注視焦點座標
 */

/**
 * 3D 模型變換設定
 * @typedef {Object} Skin3DModelConfig
 * @property {{x: number, y: number, z: number} | [number, number, number]} [position] - 模型世界座標偏移
 * @property {{x: number, y: number, z: number} | [number, number, number] | number} [scale] - 模型縮放比例
 * @property {{x: number, y: number, z: number} | [number, number, number]} [rotation] - 模型旋轉角度 (Euler)
 */

/**
 * 3D 視覺與行為設定
 * @typedef {Object} Skin3DConfig
 * @property {Skin3DCameraConfig} [camera] - 攝影機設定
 * @property {Skin3DModelConfig} [model] - 模型空間變換設定
 * @property {boolean} [pointerLook] - 是否啟用眼睛跟隨滑鼠游標
 * @property {string} [bow] - 鞠躬動畫 URL
 * @property {string} [wave] - 揮手動畫 URL
 * @property {string} [thinking] - 思考動畫 URL
 * @property {string} [look] - 環顧動畫 URL
 * @property {string} [relax] - 放鬆動畫 URL
 * @property {string} [surprised] - 驚訝動畫 URL
 * @property {string} [vrmaRootPath] - VRMA 動畫根目錄 URL
 */

/**
 * @typedef {Object} SkinEngine
 * @property {HTMLElement} stageEl - 渲染的容器元素
 * @property {boolean} has2D - 是否支援 2D
 * @property {boolean} has3D - 是否支援 3D
 * @property {string} engineMode - 目前的模式 (2D/3D)
 * @property {Object} avatarModel - 模型實例，需實作 .on('hit', callback)
 * @property {import('./renderer-2d').Renderer2D|import('./renderer-3d').Renderer3D|null} renderer - 渲染器實例
 * @property {(gender: string) => void} setGender - 切換性別的方法
 * @property {(file: File) => void} loadVRMFile - 載入模型檔案的方法
 * @property {() => Object} getState - 取得狀態的方法
 * @property {(updates: Object | ((state: Object) => Object)) => void} setState - 更新狀態的方法
 * @property {(listener: Function) => () => void} subscribe - 訂閱狀態更新的方法
 * @property {(emotion: string) => void} setEmotion - 設定情緒的方法
 * @property {(isSpeaking: boolean) => void} setIsSpeaking - 設定說話狀態的方法
 * @property {(fitMode: string) => void} setFitMode - 設定尺寸適應模式的方法
 * @property {(updates: Partial<Skin2DConfig>) => void} setSkin2d - 更新 2D 視覺變換狀態的方法
 * @property {(updates: Partial<Skin3DConfig>) => void} setSkin3d - 更新 3D 視覺變換狀態的方法
 * @property {Skin2DConfig} skin2d - 當前 2D 視覺變換狀態
 * @property {Skin3DConfig} skin3d - 當前 3D 視覺變換狀態
 * @property {string} gender - 虛擬人物性別
 * @property {string} modelUrl - 2D 模型網址
 * @property {string} vrmUrl - 3D 模型網址
 * @property {(emotionName: string) => void} gesture3D - 3D 手勢方法
 * @property {(emotionName: string) => void} gesture2D - 2D 手勢方法
 * @property {(emotionName: string) => Promise<void>} gesture - 根據模式執行手勢的方法
 * @property {string} gestureName - 當前手勢名稱
 * @property {string} startMode - 起始渲染模式
 * @property {string} fitMode - 2D 尺寸適應模式
 * @property {{name: string, target: number, weight: number, applied: string}} emo - 情緒狀態物件
 * @property {(skinEngine: SkinEngine) => number|Promise<number>} [computeMouth] - 計算嘴型數值的方法
 * @property {() => void} [onMounted] - 虛擬人物掛載完成回呼
 * @property {(error: Error, skinEngine: SkinEngine) => void} [onThreeDimensionalError] - 3D 初始化錯誤回呼
 * @property {(error: Error, skinEngine: SkinEngine) => void} [onTwoDimensionalError] - 2D 初始化錯誤回呼
 * @property {(error: Error) => void} [VRMFileChangeFail] - 載入自訂 VRM 失敗回呼
 * @property {(vrmUrl: string) => void} [VRMFileChangeSuccess] - 載入自訂 VRM 成功回呼
 * @property {(gestureName: string, skinEngine: SkinEngine) => void} [onGesture] - 手勢開始播放回呼
 * @property {(error: Error, gestureName: string, skinEngine: SkinEngine) => void} [onGestureError] - 手勢播放錯誤回呼
 * @property {(gestureName: string, skinEngine: SkinEngine) => void} [onGestureEnd] - 手勢播放結束回呼
 * @property {(mode: string) => void} [onModelChange] - 引擎模式準備切換回呼
 * @property {(renderer: import('./renderer-2d').Renderer2D|import('./renderer-3d').Renderer3D, mode: string) => void} [onModelChangeEnd] - 引擎模式切換完成回呼
 * @property {(error: Error) => void} [onModelChangeError] - 引擎模式切換錯誤回呼
 * @property {boolean|null} [switching] - 是否正在切換模式中
 * @property {string[]} [lipIds] - 2D Live2D 口型參數 ID 清單
 */

/**
 * 初始化 SkinEngine 的設定選項
 * @typedef {Object} SkinEngineOptions
 * @property {HTMLElement} stageEl - 用來渲染虛擬人物的容器 DOM 元素。
 * @property {string} [modelUrl] - 2D 模型檔案的 URL。
 * @property {string} [startMode] - 初始渲染模式（2D / 3D）。
 * @property {string} [fitMode] - 2D 模型的初始適應模式 (fit mode)。
 * @property {Skin2DConfig} [skin2d] - 2D 視覺變換設定。
 * @property {number} [zoom] - 2D 縮放倍率 (skin2d.zoom 的別名)。
 * @property {number} [offsetX] - 2D 水平偏移像素 (skin2d.offsetX 的別名)。
 * @property {number} [offsetY] - 2D 垂直偏移像素 (skin2d.offsetY 的別名)。
 * @property {{x: number, y: number}} [anchor] - 2D 模型錨點 (skin2d.anchor 的別名)。
 * @property {string} [vrmUrl] - 3D VRM 模型檔案的 URL。
 * @property {Skin3DConfig} [skin3d] - 3D 視覺與行為設定。
 * @property {Skin3DCameraConfig} [camera] - 3D 攝影機設定 (skin3d.camera 的別名)。
 * @property {Skin3DModelConfig} [modelTransform] - 3D 模型變換設定 (skin3d.model 的別名)。
 * @property {boolean} [pointerLook] - 是否啟用 3D 眼睛跟隨滑鼠游標 (skin3d.pointerLook 的別名)。
 * @property {(skinEngine: SkinEngine, emotionName: string) => void} [gesture3D] - 自訂的 3D 手勢處理函式。
 * @property {(skinEngine: SkinEngine, emotionName: string) => void} [gesture2D] - 自訂的 2D 手勢處理函式。
 * @property {(skinEngine: SkinEngine) => number|Promise<number>} [computeMouth] - 用於計算嘴型數值的函式。
 * @property {(error: Error, skinEngine: SkinEngine) => void} [onThreeDimensionalError] - 初始化 3D 發生錯誤時的回呼函式。
 * @property {(error: Error, skinEngine: SkinEngine) => void} [onTwoDimensionalError] - 初始化 2D 發生錯誤時的回呼函式。
 * @property {(error: Error) => void} [VRMFileChangeFail] - 載入自訂 VRM 檔案失敗時的回呼函式。
 * @property {(vrmUrl: string) => void} [VRMFileChangeSuccess] - 載入自訂 VRM 檔案成功時的回呼函式。
 * @property {() => void} [onMounted] - 虛擬人物掛載成功時的回呼函式。
 * @property {string} [gender] - 虛擬人物的性別。
 * @property {(gestureName: string, skinEngine: SkinEngine) => void} [onGesture] - 手勢開始播放時的回呼函式。
 * @property {(error: Error, gestureName: string, skinEngine: SkinEngine) => void} [onGestureError] - 手勢播放失敗時的回呼函式。
 * @property {(gestureName: string, skinEngine: SkinEngine) => void} [onGestureEnd] - 手勢播放結束時的回呼函式。
 * @property {(mode: string) => void} [onModelChange] - 引擎模式準備切換時的回呼函式。
 * @property {(renderer: import('./renderer-2d').Renderer2D|import('./renderer-3d').Renderer3D, mode: string) => void} [onModelChangeEnd] - 引擎模式切換完畢時的回呼函式。
 * @property {(error: Error) => void} [onModelChangeError] - 引擎模式切換發生錯誤時的回呼函式。
 */

/**
 * 初始化並建立新的皮 (skin) 引擎實例的工廠函式。
 * @param {SkinEngineOptions} [setting={}] - 引擎的設定選項。
 * @returns {SkinEngine|void} 建立完成的引擎實例，發生錯誤時則為 void。
 */
export function initSkinEngine(setting = {}) {
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
      : setting.gender === GENDER_MAP.female
        ? DEFAULT_FEMALE_2D_MODEL_URL
        : DEFAULT_MALE_2D_MODEL_URL;

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
        : setting.gender === GENDER_MAP.female
          ? DEFAULT_FEMALE_3D_MODEL_URL
          : DEFAULT_MALE_3D_MODEL_URL;

  const safeGesture3D =
    typeof gesture3D === 'function'
      ? gesture3D
      : [DEFAULT_FEMALE_3D_MODEL_URL, DEFAULT_MALE_3D_MODEL_URL].includes(
            safeVrmUrl
          )
        ? defaultGesture3D
        : null;

  const initialSkin2d = {
    zoom:
      typeof setting.skin2d?.zoom === 'number' &&
      Number.isFinite(setting.skin2d.zoom)
        ? setting.skin2d.zoom
        : typeof setting.zoom === 'number' && Number.isFinite(setting.zoom)
          ? setting.zoom
          : fitMode === FIT_MODE_MAP.HALF
            ? DEFAULT_2D_HALF_ZOOM
            : DEFAULT_2D_FULL_ZOOM,
    offsetX:
      typeof setting.skin2d?.offsetX === 'number' &&
      Number.isFinite(setting.skin2d.offsetX)
        ? setting.skin2d.offsetX
        : typeof setting.offsetX === 'number' &&
            Number.isFinite(setting.offsetX)
          ? setting.offsetX
          : DEFAULT_2D_OFFSET_X,
    offsetY:
      typeof setting.skin2d?.offsetY === 'number' &&
      Number.isFinite(setting.skin2d.offsetY)
        ? setting.skin2d.offsetY
        : typeof setting.offsetY === 'number' &&
            Number.isFinite(setting.offsetY)
          ? setting.offsetY
          : DEFAULT_2D_OFFSET_Y,
    anchor: {
      x:
        typeof (setting.skin2d?.anchor?.x ?? setting.anchor?.x) === 'number' &&
        Number.isFinite(setting.skin2d?.anchor?.x ?? setting.anchor?.x)
          ? (setting.skin2d?.anchor?.x ?? setting.anchor?.x)
          : DEFAULT_2D_ANCHOR.x,
      y:
        typeof (setting.skin2d?.anchor?.y ?? setting.anchor?.y) === 'number' &&
        Number.isFinite(setting.skin2d?.anchor?.y ?? setting.anchor?.y)
          ? (setting.skin2d?.anchor?.y ?? setting.anchor?.y)
          : DEFAULT_2D_ANCHOR.y
    }
  };

  const cameraOption = setting.skin3d?.camera || setting.camera || {};
  const modelOption = setting.skin3d?.model || setting.modelTransform || {};

  const initialSkin3d = {
    camera: {
      fov:
        typeof cameraOption.fov === 'number' &&
        Number.isFinite(cameraOption.fov)
          ? cameraOption.fov
          : DEFAULT_3D_CAMERA_FOV,
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
      position: cameraOption.position || DEFAULT_3D_CAMERA_POSITION,
      lookAt: cameraOption.lookAt || DEFAULT_3D_CAMERA_LOOK_AT
    },
    model: {
      position: modelOption.position || DEFAULT_3D_MODEL_POSITION,
      scale: modelOption.scale ?? DEFAULT_3D_MODEL_SCALE,
      rotation: modelOption.rotation || DEFAULT_3D_MODEL_ROTATION
    },
    pointerLook:
      typeof (setting.skin3d?.pointerLook ?? setting.pointerLook) === 'boolean'
        ? (setting.skin3d?.pointerLook ?? setting.pointerLook)
        : DEFAULT_3D_POINTER_LOOK,
    bow: setting.skin3d?.bow || setting.bow || '',
    wave: setting.skin3d?.wave || setting.wave || '',
    thinking: setting.skin3d?.thinking || setting.thinking || '',
    look: setting.skin3d?.look || setting.look || '',
    relax: setting.skin3d?.relax || setting.relax || '',
    surprised: setting.skin3d?.surprised || setting.surprised || '',
    vrmaRootPath: setting.skin3d?.vrmaRootPath || setting.vrmaRootPath || ''
  };

  const store = createBaseStore({
    gender: setting.gender || DEFAULT_GENDER,
    emotion: 'neutral',
    isSpeaking: false,
    fitMode: fitMode || DEFAULT_FIT_MODE,
    skin2d: initialSkin2d,
    skin3d: initialSkin3d
  });

  let emotionAutoRestoreTimer = null;

  const clearEmotionAutoRestoreTimer = () => {
    if (emotionAutoRestoreTimer !== null) {
      clearTimeout(emotionAutoRestoreTimer);
      emotionAutoRestoreTimer = null;
    }
  };

  const skinEngine = {
    // --- Store Pattern Methods ---
    getState: store.getState,
    setState: store.setState,
    subscribe: store.subscribe,
    setGender: (gender) => {
      store.setState({ gender });
      // Sync internal logic
      if (gender === GENDER_MAP.female) {
        skinEngine.modelUrl = DEFAULT_FEMALE_2D_MODEL_URL;
      } else if (gender === GENDER_MAP.male) {
        skinEngine.modelUrl = DEFAULT_MALE_2D_MODEL_URL;
      }
    },
    setEmotion: (emotion) => {
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
    setIsSpeaking: (isSpeaking) => {
      store.setState({ isSpeaking });
      if (isSpeaking === false) {
        clearEmotionAutoRestoreTimer();
        skinEngine.setEmotion('neutral');
      }
    },
    setFitMode: (newFitMode) => {
      if (
        typeof newFitMode === 'string' &&
        Object.values(FIT_MODE_MAP).includes(newFitMode) === true
      ) {
        store.setState({ fitMode: newFitMode });
      }
    },
    setSkin2d: (partialConfig = {}) => {
      if (typeof partialConfig === 'object' && partialConfig !== null) {
        store.setState((prevState) => ({
          skin2d: {
            ...prevState.skin2d,
            ...partialConfig,
            anchor: {
              ...prevState.skin2d?.anchor,
              ...(partialConfig.anchor || {})
            }
          }
        }));
      }
    },
    setSkin3d: (partialConfig = {}) => {
      if (typeof partialConfig === 'object' && partialConfig !== null) {
        store.setState((prevState) => ({
          skin3d: {
            ...prevState.skin3d,
            ...partialConfig,
            camera: {
              ...prevState.skin3d?.camera,
              ...(partialConfig.camera || {})
            },
            model: {
              ...prevState.skin3d?.model,
              ...(partialConfig.model || {})
            }
          }
        }));
      }
    },
    get skin2d() {
      return store.getState().skin2d;
    },
    get skin3d() {
      return store.getState().skin3d;
    },
    // ----------------------------

    get stageEl() {
      return stageEl;
    },

    get gender() {
      return setting.gender;
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

    get loadVRMFile() {
      return function _loadVRMFile(...args) {
        return loadVRMFile(skinEngine, ...args);
      };
    },

    get computeMouth() {
      return function _computeMouth(...args) {
        return computeMouth(...args);
      };
    },

    get onMounted() {
      return function _onMounted(...args) {
        if (typeof onMounted === 'function') {
          return onMounted(...args);
        }
      };
    },

    get onThreeDimensionalError() {
      return function _onThreeDimensionalError(...args) {
        if (typeof onThreeDimensionalError === 'function') {
          return onThreeDimensionalError(...args);
        }
      };
    },
    get onTwoDimensionalError() {
      return function _onTwoDimensionalError(...args) {
        if (typeof onTwoDimensionalError === 'function') {
          return onTwoDimensionalError(...args);
        }
      };
    },

    get VRMFileChangeFail() {
      return function _VRMFileChangeFail(...args) {
        if (typeof VRMFileChangeFail === 'function') {
          return VRMFileChangeFail(...args);
        }
      };
    },

    get VRMFileChangeSuccess() {
      return function _VRMFileChangeSuccess(...args) {
        if (typeof VRMFileChangeSuccess === 'function') {
          return VRMFileChangeSuccess(...args);
        }
      };
    },

    // 主要是 animationLoop 時使用
    // ①情緒表情狀態：speak 時從文字判斷 → 3D 表情 preset 慢慢 ease 進、講完 ease 回中性（2D 模型表情規格不一，先不套）
    emo: {
      _name: 'neutral',
      get name() {
        return this._name;
      },
      set name(newName) {
        const newTarget = EMOTION_TARGET_MAP[newName];

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

    get has2D() {
      return typeof this.modelUrl === 'string' && this.modelUrl !== '';
    },

    get has3D() {
      return typeof this.vrmUrl === 'string' && this.vrmUrl !== '';
    },

    _renderer: null,
    get renderer() {
      return this._renderer;
    },
    set renderer(newRenderer = null) {
      this._renderer = newRenderer;
    },

    get onGesture() {
      return function (...args) {
        if (typeof setting.onGesture === 'function') {
          return setting.onGesture(...args);
        }
      };
    },
    get onGestureError() {
      return function (...args) {
        if (typeof setting.onGestureError === 'function') {
          return setting.onGestureError(...args);
        }
      };
    },
    get onGestureEnd() {
      return function (...args) {
        if (typeof setting.onGestureEnd === 'function') {
          return setting.onGestureEnd(...args);
        }
      };
    },

    get onModelChange() {
      return function (...args) {
        if (typeof setting.onModelChange === 'function') {
          return setting.onModelChange(...args);
        }
      };
    },
    get onModelChangeEnd() {
      return function (...args) {
        if (typeof setting.onModelChangeEnd === 'function') {
          return setting.onModelChangeEnd(...args);
        }
      };
    },
    get onModelChangeError() {
      return function (...args) {
        if (typeof setting.onModelChangeError === 'function') {
          return setting.onModelChangeError(...args);
        }
      };
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
              this.onModelChangeError(error);
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
      return function _gesture3D(emotionName) {
        if (typeof this._gesture3D !== 'function') {
          console.warn('3D hand movement function is not registered');
          return () => {
            console.warn('gesture3D is not registered');
          };
        }
        return this._gesture3D.call(this, this, emotionName);
      };
    },
    set gesture3D(newGesture3D) {
      if (typeof newGesture3D === 'function' || newGesture3D === null) {
        this._gesture3D = newGesture3D;
      }
    },

    _gesture2D: safeGesture2D,
    get gesture2D() {
      return function _gesture2D(emotionName) {
        if (typeof this._gesture2D !== 'function') {
          console.warn('2D hand movement function is not registered');
          return () => {
            console.warn('gesture2D is not registered');
          };
        }
        return this._gesture2D.call(this, this, emotionName);
      };
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

    _gestureName: 'neutral',
    get gestureName() {
      return this._gestureName;
    },
    set gestureName(newGestureName = null) {
      if (typeof newGestureName === 'string' && newGestureName !== '') {
        this.emo.name = newGestureName;
        this._gestureName = newGestureName;

        (async () => {
          try {
            if (typeof this.onGesture === 'function') {
              this.onGesture(newGestureName, this);
            }

            await this.gesture(newGestureName);
          } catch (error) {
            console.error(error);
            if (typeof this.onGestureError === 'function') {
              this.onGestureError(error, newGestureName, this);
            }
          } finally {
            if (typeof this.onGestureEnd === 'function') {
              this.onGestureEnd(newGestureName, this);
            }
          }
        })();
      }
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

    _switching: null,
    get switching() {
      return this._switching;
    },
    set switching(newSwitching = null) {
      if (typeof newSwitching === 'boolean') {
        this._switching = newSwitching;
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

    _startMode: startMode || DEFAULT_START_MODE,
    get startMode() {
      return this._startMode;
    },
    set startMode(newStartMode = '') {
      if (typeof newStartMode === 'string' && newStartMode !== '') {
        this._startMode = newStartMode;
      }
    },

    get fitMode() {
      return store.getState().fitMode || DEFAULT_FIT_MODE;
    },
    set fitMode(newFitMode = '') {
      if (typeof newFitMode === 'string' && newFitMode !== '') {
        if (Object.values(FIT_MODE_MAP).includes(newFitMode)) {
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
