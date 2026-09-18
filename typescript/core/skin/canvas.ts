import { ENGINE_MODE_MAP } from '@/core/constants';
import type { SkinEngine } from '@types';

/**
 * Validates whether the provided engine object complies with the SkinEngine interface specification.
 *
 * @param engine - Engine instance to validate.
 * @returns Object containing validation result and missing properties array.
 */
export function validateSkinEngine(engine: any): { isValid: boolean; missing: string[] } {
  const missing: string[] = [];

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
 * Creates a new canvas element and prepends it to the stage container for avatar rendering.
 *
 * @param skinEngine - Skin engine instance containing the stage element.
 * @returns Newly created canvas element.
 * @throws Error If stageEl is not an HTMLElement instance.
 */
export function createCanvas(skinEngine: SkinEngine | any = null): HTMLCanvasElement {
  const stageEl = skinEngine?.stageEl;
  if (stageEl instanceof HTMLElement === false) {
    throw new Error('[aiAvatar createCanvas] stageEl is not an HTMLElement');
  }

  stageEl
    .querySelectorAll('canvas.avatar-canvas')
    .forEach((oldCanvas: Element) => oldCanvas.remove()); // Ensure no old canvas residue on switch
  const newCanvas = document.createElement('canvas');
  newCanvas.classList.add('avatar-canvas');
  stageEl.insertBefore(newCanvas, stageEl.firstChild); // Place at bottom layer below UI
  return newCanvas;
}

/**
 * Resolves and initializes the starting rendering mode (2D or 3D) on the skin engine instance.
 *
 * @param skinEngine - Skin engine instance.
 */
export function initSkinMode(skinEngine: SkinEngine | any = null): void {
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
