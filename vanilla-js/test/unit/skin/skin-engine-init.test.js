import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  initSkinEngine,
  validateSkinEngine,
  createCanvas,
  initSkinMode
} from '../../../core/skin';
import {
  ENGINE_MODE_MAP,
  FIT_MODE_MAP,
  DEFAULT_GENDER,
  DEFAULT_FEMALE_2D_MODEL_URL,
  DEFAULT_FEMALE_3D_MODEL_URL,
  DEFAULT_MALE_2D_MODEL_URL,
  DEFAULT_MALE_3D_MODEL_URL
} from '../../../core/constants';

describe('Unit Test: core/skin/skin-engine-init.js (Init & DOM Setup)', () => {
  let stageEl;

  beforeEach(() => {
    stageEl = document.createElement('div');
    stageEl.id = 'avatar-stage';
    document.body.appendChild(stageEl);
  });

  describe('validateSkinEngine', () => {
    it('should return isValid true when skinEngine has all required properties and methods', () => {
      const mockEngine = {
        setGender: vi.fn(),
        loadVRMFile: vi.fn(),
        has2D: true,
        has3D: true,
        stageEl
      };

      const result = validateSkinEngine(mockEngine);
      expect(result.isValid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('should return isValid false with list of missing properties when invalid', () => {
      const result = validateSkinEngine({});
      expect(result.isValid).toBe(false);
      expect(result.missing).toContain('setGender()');
      expect(result.missing).toContain('loadVRMFile()');
      expect(result.missing).toContain('has2D');
      expect(result.missing).toContain('has3D');
      expect(result.missing).toContain('stageEl');

      const nullResult = validateSkinEngine(null);
      expect(nullResult.isValid).toBe(false);
      expect(nullResult.missing).toContain('engine instance');
    });
  });

  describe('createCanvas', () => {
    it('should throw error if stageEl is not an HTMLElement', () => {
      expect(() => createCanvas(null)).toThrow('[aiAvatar createCanvas] stageEl is not an HTMLElement');
      expect(() => createCanvas({})).toThrow('[aiAvatar createCanvas] stageEl is not an HTMLElement');
    });

    it('should create avatar canvas, insert into stageEl as first child, and remove legacy canvases', () => {
      const oldCanvas = document.createElement('canvas');
      oldCanvas.classList.add('avatar-canvas');
      stageEl.appendChild(oldCanvas);

      const uiOverlay = document.createElement('div');
      uiOverlay.id = 'ui-overlay';
      stageEl.appendChild(uiOverlay);

      const newCanvas = createCanvas({ stageEl });

      expect(newCanvas.tagName.toLowerCase()).toBe('canvas');
      expect(newCanvas.classList.contains('avatar-canvas')).toBe(true);
      expect(stageEl.firstChild).toBe(newCanvas);
      expect(stageEl.contains(oldCanvas)).toBe(false);
    });
  });

  describe('initSkinMode', () => {
    it('should resolve startMode and engineMode to twoDimensional if has2D is true', () => {
      const engine = { has2D: true, has3D: false };
      initSkinMode(engine);
      expect(engine.startMode).toBe(ENGINE_MODE_MAP.twoDimensional);
      expect(engine.engineMode).toBe(ENGINE_MODE_MAP.twoDimensional);
    });

    it('should resolve to threeDimensional if has3D is true and has2D is false', () => {
      const engine = { has2D: false, has3D: true };
      initSkinMode(engine);
      expect(engine.startMode).toBe(ENGINE_MODE_MAP.threeDimensional);
      expect(engine.engineMode).toBe(ENGINE_MODE_MAP.threeDimensional);
    });

    it('should prioritize explicit startMode when specified', () => {
      const engine = {
        startMode: ENGINE_MODE_MAP.threeDimensional,
        has2D: true,
        has3D: true
      };
      initSkinMode(engine);
      expect(engine.startMode).toBe(ENGINE_MODE_MAP.threeDimensional);
      expect(engine.engineMode).toBe(ENGINE_MODE_MAP.threeDimensional);
    });
  });

  describe('initSkinEngine', () => {
    it('should return undefined and log error if stageEl is invalid', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const engine = initSkinEngine({ stageEl: null });
      expect(engine).toBeUndefined();
      expect(consoleErrorSpy).toHaveBeenCalledWith('[aiAvatar initSkinMode] stageEl is not an HTMLElement');
      consoleErrorSpy.mockRestore();
    });

    it('should initialize skin engine with default female 2D and 3D assets', () => {
      const engine = initSkinEngine({ stageEl });

      expect(engine).toBeDefined();
      expect(engine.stageEl).toBe(stageEl);
      expect(engine.modelUrl).toBe(DEFAULT_FEMALE_2D_MODEL_URL);
      expect(engine.vrmUrl).toBe(DEFAULT_FEMALE_3D_MODEL_URL);
      expect(engine.has2D).toBe(true);
      expect(engine.has3D).toBe(true);
      expect(engine.fitMode).toBe(FIT_MODE_MAP.FULL);
      expect(typeof engine.skin2d).toBe('object');
      expect(typeof engine.skin3d).toBe('object');
    });

    it('should resolve male default URLs when gender is male', () => {
      const engine = initSkinEngine({ stageEl, gender: 'male' });

      expect(engine.modelUrl).toBe(DEFAULT_MALE_2D_MODEL_URL);
      expect(engine.vrmUrl).toBe(DEFAULT_MALE_3D_MODEL_URL);
    });
  });
});
