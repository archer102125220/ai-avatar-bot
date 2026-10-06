import {
  FIT_MODE_MAP,
  DEFAULT_FIT_MODE,
  GENDER_MAP,
  DEFAULT_2D_HALF_ZOOM,
  DEFAULT_2D_FULL_ZOOM,
  DEFAULT_2D_OFFSET_X,
  DEFAULT_2D_OFFSET_Y,
  DEFAULT_2D_HALF_ANCHOR,
  DEFAULT_2D_FULL_ANCHOR,
  DEFAULT_2D_FEMALE_EXPRESSION_MAP,
  DEFAULT_2D_MALE_EXPRESSION_MAP,
  DEFAULT_2D_MOTION_ALIASES
} from '@/core/constants';
import { createCanvas } from './canvas';
import {
  GestureNotFoundError,
  type Renderer2D,
  type SkinEngine,
  type Skin2DConfig,
  type SkinEngineState,
  type Live2DModelInstance
} from './types';

interface PixiAppInstance {
  view: HTMLCanvasElement;
  renderer: {
    width: number;
    height: number;
  };
  stage: {
    addChild: (child: unknown) => void;
  };
  destroy: (
    removeView?: boolean,
    stageOptions?: {
      children?: boolean;
      texture?: boolean;
      baseTexture?: boolean;
    }
  ) => void;
}

interface WindowWithPixi extends Window {
  PIXI?: {
    Application: new (options?: Record<string, unknown>) => PixiAppInstance;
    Ticker?: unknown;
    live2d?: {
      Live2DModel: {
        from: (url: string) => Promise<Live2DModelInstance>;
        registerTicker: (ticker: unknown) => void;
      };
      SoundManager?: {
        volume: number;
      };
    };
  };
  __cdnDependenciePromise__?: Promise<void>;
}

// 2D engine dependencies (pixi + live2d) are lazy-loaded on demand to avoid downloading Live2D in 3D mode
/**
 * Dynamically loads external UMD scripts required by the 2D engine (pixi.js and live2d cubism core).
 *
 * @returns Resolves once all dependencies are loaded onto window.
 */
export function loadUMD(): Promise<void> {
  const cdnDependencyUrlArray = [
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

  const win =
    typeof window !== 'undefined'
      ? (window as unknown as WindowWithPixi)
      : undefined;

  if (!win) {
    return Promise.resolve();
  }

  if (win.__cdnDependenciePromise__ instanceof Promise) {
    return win.__cdnDependenciePromise__;
  }

  win.__cdnDependenciePromise__ = cdnDependencyUrlArray.reduce(
    (dependencyPromise: Promise<void>, cdnDependency) =>
      dependencyPromise.then(
        () =>
          new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = cdnDependency.src;
            if (
              typeof cdnDependency.id === 'string' &&
              cdnDependency.id !== ''
            ) {
              script.id = cdnDependency.id;
            }
            script.onload = () => resolve();
            script.onerror = reject;
            document.head.appendChild(script);
          })
      ),
    Promise.resolve()
  );

  return win.__cdnDependenciePromise__;
}

/**
 * Helper to look up a string value from a dictionary map ignoring case.
 */
function findInMap(
  map: Record<string, string> | undefined,
  key: string
): string | undefined {
  if (
    typeof map !== 'object' ||
    map === null ||
    typeof key !== 'string' ||
    key === ''
  ) {
    return undefined;
  }
  if (typeof map[key] === 'string' && map[key] !== '') {
    return map[key];
  }
  const lowerKey = key.toLowerCase();
  if (typeof map[lowerKey] === 'string' && map[lowerKey] !== '') {
    return map[lowerKey];
  }
  const matchedKey = Object.keys(map).find(
    (mapKey) => mapKey.toLowerCase() === lowerKey
  );
  if (
    matchedKey !== undefined &&
    typeof map[matchedKey] === 'string' &&
    map[matchedKey] !== ''
  ) {
    return map[matchedKey];
  }
  return undefined;
}

/**
 * Executes the default 2D emotion expression / gesture corresponding to avatar gender.
 *
 * @param skinEngine - Skin engine instance.
 * @param emotionName - Emotion name to express (e.g., 'neutral', 'happy', 'sad', 'surprised').
 */
export async function defaultGesture2D(
  skinEngine: SkinEngine | null = null,
  emotionName?: string
): Promise<void> {
  if (typeof skinEngine !== 'object' || skinEngine === null) {
    return;
  }

  const targetEmotion = typeof emotionName === 'string' ? emotionName : '';
  if (targetEmotion === '') {
    return;
  }

  const state =
    typeof skinEngine.getState === 'function' ? skinEngine.getState() : null;
  const skin2d: Skin2DConfig =
    typeof state?.skin2d === 'object' && state.skin2d !== null
      ? state.skin2d
      : typeof skinEngine.skin2d === 'object' && skinEngine.skin2d !== null
        ? skinEngine.skin2d
        : {};

  const defaultEmotionMap =
    skinEngine.gender === GENDER_MAP.female
      ? DEFAULT_2D_FEMALE_EXPRESSION_MAP
      : DEFAULT_2D_MALE_EXPRESSION_MAP;

  const emotionCode =
    findInMap(skin2d.expressionMap, targetEmotion) ??
    findInMap(defaultEmotionMap, targetEmotion);

  if (
    typeof emotionCode === 'string' &&
    emotionCode !== '' &&
    typeof skinEngine?.avatarModel?.expression === 'function'
  ) {
    try {
      await skinEngine.avatarModel.expression(emotionCode);
    } catch (error) {
      console.error(error);
    }
  }
}

/**
 * Initializes and boots the 2D Live2D avatar model within PIXI Application.
 *
 * @param skinEngine - Skin engine instance.
 * @param modelUrl - URL to the Live2D model configuration file (.model3.json).
 * @returns Initialized 2D renderer instance, or void on error.
 */
export async function bootAvatar(
  skinEngine: SkinEngine,
  modelUrl?: string
): Promise<Renderer2D | void> {
  const stageEl = skinEngine?.stageEl;
  if (stageEl instanceof HTMLElement === false) {
    console.error('[aiAvatar bootAvatar] stageEl is not an HTMLElement');
    return;
  }
  try {
    await loadUMD(); // Lazy-load pixi + live2d on demand
    const win = window as unknown as WindowWithPixi;
    const PIXI = win.PIXI;
    if (!PIXI?.live2d?.Live2DModel) {
      throw new Error('[aiAvatar bootAvatar] PIXI.live2d is not available');
    }
    const Live2DModel = PIXI.live2d.Live2DModel;
    if (PIXI.Ticker) {
      try {
        Live2DModel.registerTicker(PIXI.Ticker);
      } catch (_error) {}
    }

    const canvas = createCanvas(skinEngine);
    let pixiApp: PixiAppInstance | null = new PIXI.Application({
      view: canvas,
      autoStart: true,
      backgroundAlpha: 0,
      antialias: true,
      resizeTo: stageEl
    });

    const targetUrl =
      typeof modelUrl === 'string' ? modelUrl : skinEngine.modelUrl;
    skinEngine.avatarModel = await Live2DModel.from(targetUrl);
    pixiApp.stage.addChild(skinEngine.avatarModel);

    // Disable built-in Live2D motion sound to keep only our TTS audio output
    try {
      if (
        typeof win.PIXI?.live2d?.SoundManager === 'object' &&
        win.PIXI.live2d.SoundManager !== null
      ) {
        win.PIXI.live2d.SoundManager.volume = 0;
      }
    } catch (_error) {}
    try {
      const avatarModel = skinEngine.avatarModel as Live2DModelInstance | null;
      const motions =
        typeof avatarModel?.internalModel?.settings?.motions === 'object' &&
        avatarModel.internalModel.settings.motions !== null
          ? avatarModel.internalModel.settings.motions
          : {};
      for (const groupName of Object.keys(motions)) {
        (motions[groupName] || []).forEach(
          (motionData: Record<string, unknown>) => {
            delete motionData.Sound;
            delete motionData.sound;
          }
        );
      }
    } catch (_error) {}

    /**
     * Re-calculates and applies 2D model scale and position to fit the canvas based on fitMode and skin2d config.
     */
    function fit(): void {
      if (
        pixiApp === null ||
        typeof pixiApp !== 'object' ||
        skinEngine.avatarModel === null ||
        typeof skinEngine.avatarModel !== 'object'
      ) {
        return;
      }
      const width = pixiApp.renderer.width;
      const height = pixiApp.renderer.height;
      const nativeHeight =
        skinEngine.avatarModel?.internalModel?.height || 1000;

      const state =
        typeof skinEngine.getState === 'function'
          ? skinEngine.getState()
          : null;
      const currentFitMode =
        state?.fitMode || skinEngine.fitMode || DEFAULT_FIT_MODE;
      const skin2d: Skin2DConfig =
        typeof state?.skin2d === 'object' && state.skin2d !== null
          ? state.skin2d
          : {};

      const isHalf = currentFitMode === FIT_MODE_MAP.HALF;
      const modeConfig = isHalf ? skin2d.half : skin2d.full;
      const defaultZoom = isHalf ? DEFAULT_2D_HALF_ZOOM : DEFAULT_2D_FULL_ZOOM;
      const defaultAnchor = isHalf
        ? DEFAULT_2D_HALF_ANCHOR
        : DEFAULT_2D_FULL_ANCHOR;

      const zoom =
        typeof modeConfig?.zoom === 'number' && Number.isFinite(modeConfig.zoom)
          ? modeConfig.zoom
          : typeof skin2d.zoom === 'number' && Number.isFinite(skin2d.zoom)
            ? skin2d.zoom
            : defaultZoom;
      const offsetX =
        typeof modeConfig?.offsetX === 'number' &&
        Number.isFinite(modeConfig.offsetX)
          ? modeConfig.offsetX
          : typeof skin2d.offsetX === 'number' &&
              Number.isFinite(skin2d.offsetX)
            ? skin2d.offsetX
            : DEFAULT_2D_OFFSET_X;
      const offsetY =
        typeof modeConfig?.offsetY === 'number' &&
        Number.isFinite(modeConfig.offsetY)
          ? modeConfig.offsetY
          : typeof skin2d.offsetY === 'number' &&
              Number.isFinite(skin2d.offsetY)
            ? skin2d.offsetY
            : DEFAULT_2D_OFFSET_Y;
      const anchorX =
        typeof (modeConfig?.anchor?.x ?? skin2d.anchor?.x) === 'number' &&
        Number.isFinite(modeConfig?.anchor?.x ?? skin2d.anchor?.x)
          ? (modeConfig?.anchor?.x ?? skin2d.anchor?.x)!
          : defaultAnchor.x;
      const anchorY =
        typeof (modeConfig?.anchor?.y ?? skin2d.anchor?.y) === 'number' &&
        Number.isFinite(modeConfig?.anchor?.y ?? skin2d.anchor?.y)
          ? (modeConfig?.anchor?.y ?? skin2d.anchor?.y)!
          : defaultAnchor.y;

      skinEngine.avatarModel.anchor.set(anchorX, anchorY);

      if (isHalf === true) {
        const scale = (height / nativeHeight) * 0.95 * zoom;
        skinEngine.avatarModel.scale.set(scale);
        skinEngine.avatarModel.x = width * anchorX + offsetX;
        skinEngine.avatarModel.y =
          nativeHeight * scale + height * 0.04 + offsetY;
      } else {
        const scale = (height / nativeHeight) * 0.95 * zoom;
        skinEngine.avatarModel.scale.set(scale);
        skinEngine.avatarModel.x = width * anchorX + offsetX;
        skinEngine.avatarModel.y = height * anchorY + offsetY;
      }
    }
    fit();
    window.addEventListener('resize', fit);

    let unsubscribeSkin2d: (() => void) | null = null;
    let unsubscribeFitMode: (() => void) | null = null;
    if (typeof skinEngine.subscribe === 'function') {
      unsubscribeSkin2d = skinEngine.subscribe(
        (state: SkinEngineState) => state.skin2d,
        () => {
          fit();
        }
      );
      unsubscribeFitMode = skinEngine.subscribe(
        (state: SkinEngineState) => state.fitMode,
        () => {
          fit();
        }
      );
    }

    try {
      const avatarModel = skinEngine.avatarModel as Live2DModelInstance | null;
      const groups = avatarModel?.internalModel?.settings?.groups || [];
      const lipsyncGroup = groups.find(
        (group: { Name?: string; Ids?: string[] }) =>
          (group.Name || '').toLowerCase() === 'lipsync'
      );
      if (Array.isArray(lipsyncGroup?.Ids) && lipsyncGroup.Ids.length > 0) {
        skinEngine.lipIds = lipsyncGroup.Ids;
      }
    } catch (_error) {}

    // Lip sync: Intercept coreModel.update at vertex calculation to prevent motion/loadParameters override
    try {
      const avatarModel = skinEngine.avatarModel;
      const core = avatarModel?.internalModel?.coreModel;
      if (core && typeof core.update === 'function') {
        const originalUpdate = core.update.bind(core);
        let lastMouthValue = 0;
        let isComputingMouth = false;
        core.update = function () {
          const computeFn = skinEngine.computeMouth;
          if (typeof computeFn === 'function' && isComputingMouth === false) {
            isComputingMouth = true;
            (async function () {
              try {
                const mouthValue = await computeFn(skinEngine);
                if (typeof mouthValue === 'number') {
                  lastMouthValue = mouthValue;
                }
              } catch (_error) {
              } finally {
                isComputingMouth = false;
              }
            })();
          }

          const lipIds = Array.isArray(skinEngine.lipIds)
            ? skinEngine.lipIds
            : ['ParamMouthOpenY'];
          for (const lipId of lipIds) {
            try {
              core.setParameterValueById(lipId, lastMouthValue);
            } catch (_error) {}
          }

          return originalUpdate();
        };
      }
    } catch (_error) {}

    function getSkin2dConfig(): Skin2DConfig {
      const state =
        typeof skinEngine.getState === 'function' ? skinEngine.getState() : null;
      return typeof state?.skin2d === 'object' && state.skin2d !== null
        ? state.skin2d
        : typeof skinEngine.skin2d === 'object' && skinEngine.skin2d !== null
          ? skinEngine.skin2d
          : {};
    }

    async function playGesture(gestureName: string): Promise<void> {
      if (typeof gestureName !== 'string' || gestureName === '') {
        throw new GestureNotFoundError(String(gestureName), '2d');
      }

      const avatarModel = skinEngine.avatarModel as Live2DModelInstance | null;
      const motions: Record<string, unknown> =
        typeof avatarModel?.internalModel?.settings?.motions === 'object' &&
        avatarModel.internalModel.settings.motions !== null
          ? avatarModel.internalModel.settings.motions
          : {};
      const motionKeys = Object.keys(motions);
      const skin2d = getSkin2dConfig();

      // 1. 自訂 motionMap 優先
      const customMotion = findInMap(skin2d.motionMap, gestureName);
      if (typeof customMotion === 'string' && customMotion !== '') {
        const directMatch = motionKeys.find(
          (motionKey) => motionKey.toLowerCase() === customMotion.toLowerCase()
        );
        const targetMotion =
          directMatch !== undefined ? directMatch : customMotion;
        if (typeof avatarModel?.motion === 'function') {
          await avatarModel.motion(targetMotion);
          return;
        }
      }

      // 2. 直接比對 Live2D 內建動作名稱 (大小寫不拘)
      const directMatch = motionKeys.find(
        (motionKey) => motionKey.toLowerCase() === gestureName.toLowerCase()
      );
      if (
        directMatch !== undefined &&
        typeof avatarModel?.motion === 'function'
      ) {
        await avatarModel.motion(directMatch);
        return;
      }

      // 3. 預設別名庫比對 (DEFAULT_2D_MOTION_ALIASES)
      const aliases = DEFAULT_2D_MOTION_ALIASES[gestureName.toLowerCase()];
      if (Array.isArray(aliases) && typeof avatarModel?.motion === 'function') {
        for (const alias of aliases) {
          const aliasMatch = motionKeys.find(
            (motionKey) => motionKey.toLowerCase() === alias.toLowerCase()
          );
          if (aliasMatch !== undefined) {
            await avatarModel.motion(aliasMatch);
            return;
          }
        }
      }

      // 4. 表情 fallback (Expression Fallback)
      const defaultEmotionMap =
        skinEngine.gender === GENDER_MAP.female
          ? DEFAULT_2D_FEMALE_EXPRESSION_MAP
          : DEFAULT_2D_MALE_EXPRESSION_MAP;
      const targetExpression =
        findInMap(skin2d.expressionMap, gestureName) ??
        findInMap(defaultEmotionMap, gestureName);

      if (
        typeof targetExpression === 'string' &&
        targetExpression !== '' &&
        typeof avatarModel?.expression === 'function'
      ) {
        await defaultGesture2D(skinEngine, gestureName);
        return;
      }

      // 5. 若模型未暴露 motions metadata，但有 motion 函式，做盲調嘗試
      if (motionKeys.length === 0 && typeof avatarModel?.motion === 'function') {
        const motionResult = await avatarModel.motion(gestureName);
        if (motionResult !== false) {
          return;
        }
      }

      // 6. 完全未命中
      throw new GestureNotFoundError(gestureName, '2d');
    }

    if (typeof skinEngine.onMounted === 'function') {
      skinEngine.onMounted();
    }

    return {
      get canvas(): HTMLCanvasElement {
        return canvas;
      },
      get avatarModel(): unknown {
        return skinEngine.avatarModel;
      },
      get pixiApp(): unknown {
        return pixiApp;
      },
      get TAP_GESTURES(): string[] {
        const config = getSkin2dConfig();
        if (
          Array.isArray(config.tapMotions) &&
          config.tapMotions.length > 0
        ) {
          return config.tapMotions;
        }
        if (
          Array.isArray(config.tapGestures) &&
          config.tapGestures.length > 0
        ) {
          return config.tapGestures;
        }
        return ['tap'];
      },
      playGesture,
      fit(): void {
        fit();
      },
      updateTransform(config: Partial<Skin2DConfig>): void {
        if (typeof skinEngine.setSkin2d === 'function') {
          skinEngine.setSkin2d(config);
        }
      },
      dispose(): void {
        if (typeof unsubscribeSkin2d === 'function') {
          unsubscribeSkin2d();
          unsubscribeSkin2d = null;
        }
        if (typeof unsubscribeFitMode === 'function') {
          unsubscribeFitMode();
          unsubscribeFitMode = null;
        }
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
        skinEngine.avatarModel = null;
        canvas.remove();
      }
    };
  } catch (error: unknown) {
    console.error(error);

    const normalizedError = error instanceof Error ? error : new Error(String(error));
    if (typeof skinEngine?.onTwoDimensionalError === 'function') {
      skinEngine.onTwoDimensionalError(normalizedError, skinEngine);
    }
  }
}
