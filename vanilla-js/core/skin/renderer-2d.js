import {
  FIT_MODE_MAP,
  DEFAULT_FIT_MODE,
  GENDER_MAP,
  DEFAULT_2D_HALF_ZOOM,
  DEFAULT_2D_FULL_ZOOM,
  DEFAULT_2D_OFFSET_X,
  DEFAULT_2D_OFFSET_Y,
  DEFAULT_2D_HALF_ANCHOR,
  DEFAULT_2D_FULL_ANCHOR
} from '@/core/constants';
import { createCanvas } from './canvas';

/**
 * 2D Live2D renderer controller instance.
 * @typedef {import('../../index.d.ts').Renderer2D} Renderer2D
 */

// 2D engine dependencies (pixi + live2d) are lazy-loaded on demand to avoid downloading Live2D in 3D mode
/**
 * Dynamically loads external UMD scripts required by the 2D engine (pixi.js and live2d cubism core).
 * @returns {Promise<void>} Resolves once all dependencies are loaded onto window.
 */
export function loadUMD() {
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

  if (
    window.__cdnDependenciePromise__ instanceof Promise === true ||
    (typeof window.__cdnDependenciePromise__ === 'object' &&
      window.__cdnDependenciePromise__ !== null &&
      typeof window.__cdnDependenciePromise__.then === 'function')
  ) {
    return window.__cdnDependenciePromise__;
  }

  window.__cdnDependenciePromise__ = cdnDependencyUrlArray.reduce(
    (dependencyPromise, cdnDependency) =>
      dependencyPromise.then(
        () =>
          new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = cdnDependency.src;
            if (
              typeof cdnDependency.id === 'string' &&
              cdnDependency.id !== ''
            ) {
              script.id = cdnDependency.id;
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

/**
 * Executes the default 2D emotion expression / gesture corresponding to avatar gender.
 * @param {import('../../index.d.ts').SkinEngine | Record<string, any> | null} [skinEngine=null] - Skin engine instance.
 * @param {string} emotionName - Emotion name to express (e.g., 'neutral', 'happy', 'sad', 'surprised').
 * @returns {Promise<void>}
 */
export async function defaultGesture2D(skinEngine = null, emotionName) {
  if (typeof skinEngine !== 'object' || skinEngine === null) {
    return;
  }

  // f00 smile & blink
  // f01 similar to f00
  // f02 confused
  // f03 sad
  // f04 happy
  // f05 surprised
  // f06 shy
  // f07 dumbfounded
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
    skinEngine.gender === GENDER_MAP.female
      ? emotionFemaleNameMap
      : emotionMaleNameMap;

  const emotionCode = emotionNameMap[emotionName];

  if (
    Object.values(emotionNameMap).includes(emotionCode) &&
    typeof skinEngine?.avatarModel?.expression === 'function'
  ) {
    try {
      await skinEngine.avatarModel.expression(emotionCode);
    } catch (error) {
      console.error(error);
    }
  }
}

// ===== 2D Skin: Live2D Loading & Lip Sync =====
/**
 * Initializes and boots the 2D Live2D avatar model within PIXI Application.
 * @param {import('../../index.d.ts').SkinEngine | Record<string, any>} skinEngine - Skin engine instance.
 * @param {string} modelUrl - URL to the Live2D model configuration file (.model3.json).
 * @returns {Promise<import('../../index.d.ts').Renderer2D | void>} Initialized 2D renderer instance, or void on error.
 */
export async function bootAvatar(skinEngine, modelUrl) {
  const stageEl = skinEngine?.stageEl;
  if (stageEl instanceof HTMLElement === false) {
    console.error('[aiAvatar bootAvatar] stageEl is not an HTMLElement');
    return;
  }
  try {
    await loadUMD(); // Lazy-load pixi + live2d on demand
    const Live2DModel = window.PIXI.live2d.Live2DModel;
    try {
      Live2DModel.registerTicker(window.PIXI.Ticker);
    } catch (_error) {}

    const canvas = createCanvas(skinEngine);
    let pixiApp = new window.PIXI.Application({
      view: canvas,
      autoStart: true,
      backgroundAlpha: 0,
      antialias: true,
      resizeTo: stageEl
    });

    skinEngine.avatarModel = await Live2DModel.from(modelUrl);
    pixiApp.stage.addChild(skinEngine.avatarModel);

    // Disable built-in Live2D motion sound to keep only our TTS audio output
    try {
      if (
        typeof window.PIXI.live2d.SoundManager === 'object' &&
        window.PIXI.live2d.SoundManager !== null
      ) {
        window.PIXI.live2d.SoundManager.volume = 0;
      }
    } catch (_error) {}
    try {
      const motions =
        typeof skinEngine.avatarModel.internalModel.settings?.motions ===
          'object' &&
        skinEngine.avatarModel.internalModel.settings.motions !== null
          ? skinEngine.avatarModel.internalModel.settings.motions
          : {};
      for (const groupName of Object.keys(motions)) {
        (motions[groupName] || []).forEach((motionData) => {
          delete motionData.Sound;
          delete motionData.sound;
        });
      }
    } catch (_error) {}

    /**
     * Re-calculates and applies 2D model scale and position to fit the canvas based on fitMode and skin2d config.
     * In HALF mode, model is magnified and repositioned for a portrait view.
     * @returns {void}
     */
    function fit() {
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
        typeof skinEngine.getState === 'function' ? skinEngine.getState() : {};
      const currentFitMode =
        state.fitMode || skinEngine.fitMode || DEFAULT_FIT_MODE;
      const skin2d =
        typeof state.skin2d === 'object' && state.skin2d !== null
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
          ? (modeConfig?.anchor?.x ?? skin2d.anchor?.x)
          : defaultAnchor.x;
      const anchorY =
        typeof (modeConfig?.anchor?.y ?? skin2d.anchor?.y) === 'number' &&
        Number.isFinite(modeConfig?.anchor?.y ?? skin2d.anchor?.y)
          ? (modeConfig?.anchor?.y ?? skin2d.anchor?.y)
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

    let unsubscribeSkin2d = null;
    let unsubscribeFitMode = null;
    if (typeof skinEngine.subscribe === 'function') {
      unsubscribeSkin2d = skinEngine.subscribe(
        (state) => state.skin2d,
        () => {
          fit();
        }
      );
      unsubscribeFitMode = skinEngine.subscribe(
        (state) => state.fitMode,
        () => {
          fit();
        }
      );
    }

    try {
      const groups = skinEngine.avatarModel.internalModel.settings.groups || [];
      const lipsyncGroup = groups.find(
        (group) => (group.Name || '').toLowerCase() === 'lipsync'
      );
      if (Array.isArray(lipsyncGroup?.Ids) && lipsyncGroup.Ids.length > 0) {
        skinEngine.lipIds = lipsyncGroup.Ids;
      }
    } catch (_error) {}

    // Lip sync: Intercept coreModel.update at vertex calculation to prevent motion/loadParameters override
    try {
      const core = skinEngine.avatarModel.internalModel.coreModel;
      const originalUpdate = core.update.bind(core);
      let lastMouthValue = 0;
      let isComputingMouth = false;
      core.update = function () {
        if (
          typeof skinEngine.computeMouth === 'function' &&
          isComputingMouth === false
        ) {
          isComputingMouth = true;
          (async function () {
            try {
              const mouthValue = await skinEngine.computeMouth(skinEngine);
              if (typeof mouthValue === 'number') {
                lastMouthValue = mouthValue;
              }
            } catch (_error) {
            } finally {
              isComputingMouth = false;
            }
          })();
        }

        for (const lipId of skinEngine.lipIds) {
          try {
            core.setParameterValueById(lipId, lastMouthValue);
          } catch (_error) {}
        }

        return originalUpdate();
      };
    } catch (_error) {}

    if (typeof skinEngine.onMounted === 'function') {
      skinEngine.onMounted();
    }

    return {
      get canvas() {
        return canvas;
      },
      get avatarModel() {
        return skinEngine.avatarModel;
      },
      get pixiApp() {
        return pixiApp;
      },
      fit() {
        fit();
      },
      updateTransform(config) {
        if (typeof skinEngine.setSkin2d === 'function') {
          skinEngine.setSkin2d(config);
        }
      },
      dispose() {
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
  } catch (error) {
    console.error(error);

    if (typeof skinEngine?.onTwoDimensionalError === 'function') {
      skinEngine.onTwoDimensionalError(error, skinEngine);
    }
  }
}
