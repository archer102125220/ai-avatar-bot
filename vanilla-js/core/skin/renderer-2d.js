import { FIT_MODE_MAP, DEFAULT_FIT_MODE, GENDER_MAP } from '../constants';
import { createCanvas } from './canvas';

/**
 * 2D 渲染器實例
 * @typedef {Object} Renderer2D
 * @property {HTMLCanvasElement} canvas - 渲染用畫布
 * @property {Object} avatarModel - Live2D 模型實例
 * @property {Object} pixiApp - PIXI Application 實例
 * @property {() => void} dispose - 清除並釋放記憶體的方法
 */

// 2D 引擎相依（pixi + live2d）改成「用到才載」，3D 模式就不會下載 Live2D
/**
 * 動態載入 2D 引擎所需的 UMD 相依套件（pixi.js 與 live2d）。
 * @returns {Promise<void>} 所有的相依套件載入完成後會 resolve 的 Promise。
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

  if (window.__cdnDependenciePromise__ instanceof Promise === true) {
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
 * 根據虛擬人物的性別，執行預設的 2D 手勢（情緒表情）。
 * @param {Object|null} [skinEngine=null] - 引擎實例。
 * @param {string} emotionName - 準備表達的情緒名稱（例如：'neutral'、'happy'）。
 * @returns {Promise<void>}
 */
export async function defaultGesture2D(skinEngine = null, emotionName) {
  if (typeof skinEngine !== 'object' || skinEngine === null) {
    return;
  }

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

// ===== 2D 皮：Live2D 載入 + 對嘴 =====
/**
 * 初始化並啟動 2D Live2D 虛擬人物模型。
 * @param {Object} skinEngine - 引擎實例。
 * @param {string} modelUrl - Live2D 模型檔案的 URL。
 * @returns {Promise<Renderer2D|void>} 初始化後的 2D 渲染器實例，發生錯誤時則為 void。
 */
export async function bootAvatar(skinEngine, modelUrl) {
  const stageEl = skinEngine?.stageEl;
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
    skinEngine.avatarModel.anchor.set(0.5, 1.0);

    // 關掉 Live2D 模型自帶的（日文）動作語音 — 只保留我們自己的 TTS（兩者來源不同，互不影響）
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

    const safeFitMode = skinEngine.fitMode || DEFAULT_FIT_MODE;
    /**
     * 根據設定的模式 (fitMode) 調整 2D 虛擬人的縮放與位置，使其適應畫布尺寸。
     * 若模式為 HALF，則會放大並將位置下移以呈現半身特寫。
     */
    function fit() {
      const width = pixiApp.renderer.width;
      const height = pixiApp.renderer.height;
      const nativeHeight =
        skinEngine.avatarModel?.internalModel?.height || 1000;
      if (safeFitMode === FIT_MODE_MAP.HALF) {
        const ZOOM = 1.9; // 放大倍率：越大越近（半身越緊）
        const scale = (height / nativeHeight) * 0.95 * ZOOM;
        skinEngine.avatarModel.scale.set(scale);
        skinEngine.avatarModel.x = width / 2;
        skinEngine.avatarModel.y = nativeHeight * scale + height * 0.04; // 腳推到畫面外、頭留 4% 上緣
      } else {
        skinEngine.avatarModel.scale.set((height / nativeHeight) * 0.95);
        skinEngine.avatarModel.x = width / 2;
        skinEngine.avatarModel.y = height;
      }
    }
    fit();
    window.addEventListener('resize', fit);

    try {
      const groups = skinEngine.avatarModel.internalModel.settings.groups || [];
      const lipsyncGroup = groups.find(
        (group) => (group.Name || '').toLowerCase() === 'lipsync'
      );
      if (Array.isArray(lipsyncGroup?.Ids) && lipsyncGroup.Ids.length > 0) {
        skinEngine.lipIds = lipsyncGroup.Ids;
      }
    } catch (_error) {}

    // 對嘴：攔截 coreModel.update（計算頂點前的最後一刻寫入嘴巴，保證不被 motion/loadParameters 洗掉）
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
