import { ENGINE_MODE_MAP } from '../constants';

/**
 * 驗證傳入的引擎物件是否符合 SkinEngine 介面規範。
 * @param {Object|null} engine - 準備驗證的引擎實例。
 * @returns {{isValid: boolean, missing: string[]}} 包含驗證結果 (isValid) 以及缺少的屬性陣列 (missing) 的物件。
 */
export function validateSkinEngine(engine) {
  const missing = [];

  if (typeof engine !== 'object' || engine === null) {
    missing.push('engine instance');
  } else {
    if (typeof engine.setGender !== 'function') {
      missing.push('setGender()');
    }
    if (typeof engine.loadVRMFile !== 'function') {
      missing.push('loadVRMFile()');
    }
    if (typeof engine.has2D !== 'boolean') {
      missing.push('has2D');
    }
    if (typeof engine.has3D !== 'boolean') {
      missing.push('has3D');
    }
    if (engine.stageEl instanceof HTMLElement === false) {
      missing.push('stageEl');
    }
  }

  return {
    isValid: missing.length === 0,
    missing
  };
}

/**
 * 建立一個全新的 canvas 元素並插入到舞台 (stage) 中準備進行渲染。
 * @param {Object|null} [skinEngine=null] - 引擎實例。
 * @returns {HTMLCanvasElement} 新建立的 canvas 元素。
 * @throws {Error} 如果 stageEl 不是一個 HTMLElement 時會拋出錯誤。
 */
export function createCanvas(skinEngine = null) {
  const stageEl = skinEngine?.stageEl;
  if (stageEl instanceof HTMLElement === false) {
    throw new Error('[aiAvatar createCanvas] stageEl is not an HTMLElement');
  }

  stageEl
    .querySelectorAll('canvas.avatar-canvas')
    .forEach((oldCanvas) => oldCanvas.remove()); // 切換時保證不留舊 canvas（殘骸）
  const newCanvas = document.createElement('canvas');
  newCanvas.classList.add('avatar-canvas');
  stageEl.insertBefore(newCanvas, stageEl.firstChild); // 放最底層，UI 疊在上面
  return newCanvas;
}

/**
 * 判斷並初始化皮 (skin) 引擎的起始渲染模式（2D 或 3D）。
 * @param {Object|null} [skinEngine=null] - 引擎實例。
 */
export function initSkinMode(skinEngine = null) {
  if (typeof skinEngine !== 'object' || skinEngine === null) {
    return;
  }

  const startMode =
    skinEngine.startMode ||
    (skinEngine.has2D === true
      ? ENGINE_MODE_MAP.twoDimensional
      : skinEngine.has3D === true
        ? ENGINE_MODE_MAP.threeDimensional
        : ENGINE_MODE_MAP.twoDimensional);

  skinEngine.startMode = startMode;
  skinEngine.engineMode = startMode;
}
