import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  initSkinEngine,
  validateSkinEngine,
  createCanvas,
  initSkinMode,
  GestureNotFoundError,
  type Renderer2D,
  type Renderer3D
} from '@/core/skin';
import {
  ENGINE_MODE_MAP,
  FIT_MODE_MAP,
  DEFAULT_FEMALE_2D_MODEL_URL,
  DEFAULT_FEMALE_3D_MODEL_URL,
  DEFAULT_MALE_2D_MODEL_URL,
  DEFAULT_MALE_3D_MODEL_URL
} from '@/core/constants';
import type { SkinEngine } from '@core';

describe('Unit Test: core/skin/skin-engine-init.js (Init & DOM Setup)', () => {
  let stageEl: HTMLElement;

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

      const result = validateSkinEngine(
        mockEngine as unknown as Parameters<typeof validateSkinEngine>[0]
      );
      expect(result.isValid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('should return isValid false with list of missing properties when invalid', () => {
      const result = validateSkinEngine(
        {} as unknown as Parameters<typeof validateSkinEngine>[0]
      );
      expect(result.isValid).toBe(false);
      expect(result.missing).toContain('setGender()');
      expect(result.missing).toContain('loadVRMFile()');
      expect(result.missing).toContain('has2D');
      expect(result.missing).toContain('has3D');
      expect(result.missing).toContain('stageEl');

      const nullResult = validateSkinEngine(
        null as unknown as Parameters<typeof validateSkinEngine>[0]
      );
      expect(nullResult.isValid).toBe(false);
      expect(nullResult.missing).toContain('engine instance');
    });
  });

  describe('createCanvas', () => {
    it('should throw error if stageEl is not an HTMLElement', () => {
      expect(() =>
        createCanvas(null as unknown as Parameters<typeof createCanvas>[0])
      ).toThrow('[aiAvatar createCanvas] stageEl is not an HTMLElement');
      expect(() =>
        createCanvas({} as unknown as Parameters<typeof createCanvas>[0])
      ).toThrow('[aiAvatar createCanvas] stageEl is not an HTMLElement');
    });

    it('should create avatar canvas, insert into stageEl as first child, and remove legacy canvases', () => {
      const oldCanvas = document.createElement('canvas');
      oldCanvas.classList.add('avatar-canvas');
      stageEl.appendChild(oldCanvas);

      const uiOverlay = document.createElement('div');
      uiOverlay.id = 'ui-overlay';
      stageEl.appendChild(uiOverlay);

      const newCanvas = createCanvas({
        stageEl
      } as unknown as Parameters<typeof createCanvas>[0]);

      expect(newCanvas.tagName.toLowerCase()).toBe('canvas');
      expect(newCanvas.classList.contains('avatar-canvas')).toBe(true);
      expect(stageEl.firstChild).toBe(newCanvas);
      expect(stageEl.contains(oldCanvas)).toBe(false);
    });
  });

  describe('initSkinMode', () => {
    it('should resolve startMode and engineMode to twoDimensional if has2D is true', () => {
      const engine = { has2D: true, has3D: false } as unknown as SkinEngine;
      initSkinMode(engine);
      expect(engine.startMode).toBe(ENGINE_MODE_MAP.twoDimensional);
      expect(engine.engineMode).toBe(ENGINE_MODE_MAP.twoDimensional);
    });

    it('should resolve to threeDimensional if has3D is true and has2D is false', () => {
      const engine = { has2D: false, has3D: true } as unknown as SkinEngine;
      initSkinMode(engine);
      expect(engine.startMode).toBe(ENGINE_MODE_MAP.threeDimensional);
      expect(engine.engineMode).toBe(ENGINE_MODE_MAP.threeDimensional);
    });

    it('should prioritize explicit startMode when specified', () => {
      const engine = {
        startMode: ENGINE_MODE_MAP.threeDimensional,
        has2D: true,
        has3D: true
      } as unknown as SkinEngine;
      initSkinMode(engine);
      expect(engine.startMode).toBe(ENGINE_MODE_MAP.threeDimensional);
      expect(engine.engineMode).toBe(ENGINE_MODE_MAP.threeDimensional);
    });
  });

  describe('initSkinEngine', () => {
    it('should return undefined and log error if stageEl is invalid', () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const engine = initSkinEngine({
        stageEl: null as unknown as HTMLElement
      });
      expect(engine).toBeUndefined();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[aiAvatar initSkinMode] stageEl is not an HTMLElement'
      );
      consoleErrorSpy.mockRestore();
    });

    it('should initialize skin engine with default female 2D and 3D assets', () => {
      const engine = initSkinEngine({ stageEl }) as SkinEngine;

      expect(engine).toBeDefined();
      expect(engine.stageEl).toBe(stageEl);
      expect(engine.live2dUrl).toBe(DEFAULT_FEMALE_2D_MODEL_URL);
      expect(engine.vrmUrl).toBe(DEFAULT_FEMALE_3D_MODEL_URL);
      expect(engine.has2D).toBe(true);
      expect(engine.has3D).toBe(true);
      expect(engine.fitMode).toBe(FIT_MODE_MAP.FULL);
      expect(typeof engine.skin2d).toBe('object');
      expect(typeof engine.skin3d).toBe('object');
    });

    it('should resolve male default URLs when gender is male', () => {
      const engine = initSkinEngine({ stageEl, gender: 'male' }) as SkinEngine;

      expect(engine.live2dUrl).toBe(DEFAULT_MALE_2D_MODEL_URL);
      expect(engine.vrmUrl).toBe(DEFAULT_MALE_3D_MODEL_URL);
    });

    it('should invoke onModelChangeStart, onModelChangeEnd, and onModelChangeError callbacks', () => {
      const onModelChangeStart = vi.fn();
      const onModelChangeEnd = vi.fn();
      const onModelChangeError = vi.fn();

      const engine: SkinEngine = initSkinEngine({
        stageEl,
        onModelChangeStart,
        onModelChangeEnd,
        onModelChangeError
      }) as SkinEngine;

      engine.onModelChangeStart?.('2d');
      expect(onModelChangeStart).toHaveBeenCalledWith('2d');

      engine.onModelChangeEnd?.(null, '2d');
      expect(onModelChangeEnd).toHaveBeenCalledWith(null, '2d');

      const mockErr = new Error('Model error');
      engine.onModelChangeError?.(mockErr);
      expect(onModelChangeError).toHaveBeenCalledWith(mockErr);
    });

    it('should invoke onMounted, on2DError, and on3DError callbacks when provided and return undefined when not provided', () => {
      const onMounted = vi.fn();
      const on2DError = vi.fn();
      const on3DError = vi.fn();

      const engineWithCallbacks: SkinEngine = initSkinEngine({
        stageEl,
        onMounted,
        on2DError,
        on3DError
      }) as SkinEngine;

      engineWithCallbacks.onMounted?.('mounted');
      expect(onMounted).toHaveBeenCalledWith('mounted');

      const err2d = new Error('2D Error');
      engineWithCallbacks.on2DError?.(err2d);
      expect(on2DError).toHaveBeenCalledWith(err2d);

      const err3d = new Error('3D Error');
      engineWithCallbacks.on3DError?.(err3d);
      expect(on3DError).toHaveBeenCalledWith(err3d);

      // Default engine without callbacks
      const engineWithoutCallbacks: SkinEngine = initSkinEngine({
        stageEl
      }) as SkinEngine;
      expect(engineWithoutCallbacks.onMounted?.()).toBeUndefined();
      expect(engineWithoutCallbacks.on2DError?.()).toBeUndefined();
      expect(
        engineWithoutCallbacks.on3DError?.()
      ).toBeUndefined();
    });

    it('should reject when playing an empty gesture name', async () => {
      const engine: SkinEngine = initSkinEngine({ stageEl }) as SkinEngine;
      await expect(engine.playGesture?.('')).rejects.toThrow();
    });

    it('should early-return when engineMode is set to the current engineMode', () => {
      const onModelChangeStartSpy = vi.fn();
      const engine: SkinEngine = initSkinEngine({
        stageEl,
        onModelChangeStart: onModelChangeStartSpy
      }) as SkinEngine;
      const currentMode = engine.engineMode;
      onModelChangeStartSpy.mockClear();

      engine.engineMode = currentMode;
      expect(onModelChangeStartSpy).not.toHaveBeenCalled();
    });

    it('should handle defensive guards and 3D mode resolution in initSkinMode', () => {
      expect(() => initSkinMode(null as unknown as SkinEngine)).not.toThrow();

      const mockEngine3DOnly = {
        has2D: false,
        has3D: true,
        startMode: null as unknown as typeof ENGINE_MODE_MAP.threeDimensional
      } as unknown as SkinEngine;

      initSkinMode(mockEngine3DOnly);
      expect(mockEngine3DOnly.startMode).toBe(ENGINE_MODE_MAP.threeDimensional);
    });
  });

  describe('Unified Gesture Interceptor & Tap Gestures', () => {
    it('should configure structured skin2d and skin3d visual and gesture maps', () => {
      const engine = initSkinEngine({
        stageEl,
        skin2d: {
          tapMotions: ['tap_motion_01'],
          motionMap: { wave: 'SpecialWave' },
          expressionMap: { joy: 'happy' }
        },
        skin3d: {
          tapGestures: ['tap_gesture_01'],
          expressionMap: { joy: 'happy' }
        }
      }) as SkinEngine;

      const state = engine.getState();
      expect(state.skin2d.tapMotions).toEqual(['tap_motion_01']);
      expect(state.skin2d.motionMap).toEqual({ wave: 'SpecialWave' });
      expect(state.skin2d.expressionMap).toEqual({ joy: 'happy' });

      expect(state.skin3d.tapGestures).toEqual(['tap_gesture_01']);
      expect(state.skin3d.expressionMap).toEqual({ joy: 'happy' });
    });

    it('should trigger custom unified gesture interceptor and allow context delegation', async () => {
      const mockPlayGesture = vi.fn().mockResolvedValue(undefined);
      const interceptor = vi.fn(async (_engine, _gestureName, context) => {
        if (context.mode === '2d') {
          await context.gesture2D('intercepted_2d_motion');
        } else {
          await context.gesture3D('intercepted_3d_motion');
        }
      });

      const engine = initSkinEngine({
        stageEl,
        startMode: ENGINE_MODE_MAP.twoDimensional,
        gesture: interceptor
      }) as SkinEngine;

      engine.renderer = {
        avatarModel: {},
        playGesture: mockPlayGesture,
        TAP_GESTURES: ['tap']
      } as unknown as Renderer2D;

      await engine.playGesture?.('greet');

      expect(interceptor).toHaveBeenCalledWith(
        engine,
        'greet',
        expect.objectContaining({
          mode: '2d',
          gesture2D: expect.any(Function),
          gesture3D: expect.any(Function),
          renderer: engine.renderer
        })
      );
      expect(mockPlayGesture).toHaveBeenCalledWith('intercepted_2d_motion');

      // Test error propagation from interceptor
      interceptor.mockRejectedValueOnce(new Error('Interceptor failure'));
      await expect(engine.playGesture?.('greet')).rejects.toThrow(
        'Interceptor failure'
      );
    });

    it('should pick random tap gesture from renderer.TAP_GESTURES and execute via playGesture', async () => {
      const playGestureSpy = vi.fn().mockResolvedValue(undefined);
      const engine = initSkinEngine({
        stageEl,
        startMode: ENGINE_MODE_MAP.twoDimensional
      }) as SkinEngine;

      engine.renderer = {
        TAP_GESTURES: ['tap_body', 'tap_head']
      } as unknown as Renderer2D;

      engine.playGesture = playGestureSpy;

      await engine.playTapGesture?.();
      expect(playGestureSpy).toHaveBeenCalled();
      const calledGesture = playGestureSpy.mock.calls[0][0];
      expect(['tap_body', 'tap_head']).toContain(calledGesture);

      // Fallback when TAP_GESTURES is missing or empty
      engine.renderer = null;
      playGestureSpy.mockClear();
      await engine.playTapGesture?.();
      expect(playGestureSpy).toHaveBeenCalledWith('tap');

      // 3D mode fallback
      engine._engineMode = ENGINE_MODE_MAP.threeDimensional;
      playGestureSpy.mockClear();
      await engine.playTapGesture?.();
      expect(playGestureSpy).toHaveBeenCalledWith('goodbye');
    });

    it('should throw GestureNotFoundError on empty string in playGesture', async () => {
      const engine = initSkinEngine({
        stageEl,
        startMode: ENGINE_MODE_MAP.twoDimensional
      }) as SkinEngine;

      await expect(engine.playGesture?.('')).rejects.toThrow(
        GestureNotFoundError
      );
    });

    it('should dispatch to context.gesture3D in 3D mode without interceptor', async () => {
      const engine = initSkinEngine({
        stageEl,
        startMode: ENGINE_MODE_MAP.threeDimensional
      }) as SkinEngine;

      const mock3DPlay = vi.fn().mockResolvedValue(undefined);
      engine.renderer = {
        playGesture: mock3DPlay
      } as unknown as Renderer2D;

      await engine.playGesture?.('bow');
      expect(mock3DPlay).toHaveBeenCalledWith('bow');
    });

    it('should delegate context.gesture2D and context.gesture3D to active renderer', async () => {
      const mockRenderer2D = {
        canvas: document.createElement('canvas'),
        avatarModel: {},
        pixiApp: {},
        playGesture: vi.fn(async () => {})
      } as unknown as Renderer2D;
      const mockRenderer3D = {
        canvas: document.createElement('canvas'),
        gltf: {},
        vrm: {},
        TAP_GESTURES: ['goodbye'],
        camera: {},
        scene: {},
        playGesture: vi.fn(async () => {})
      } as unknown as Renderer3D;

      const engine = initSkinEngine({
        stageEl,
        startMode: ENGINE_MODE_MAP.twoDimensional,
        gesture: async (_eng, _name, ctx) => {
          await ctx.gesture2D('override2D');
          await ctx.gesture3D('override3D');
        }
      }) as SkinEngine;

      // 2D renderer delegation
      engine.renderer = mockRenderer2D;
      await engine.playGesture?.('test');
      expect(mockRenderer2D.playGesture).toHaveBeenCalledWith('override2D');

      // 3D renderer delegation
      engine.renderer = mockRenderer3D;
      await engine.playGesture?.('test');
      expect(mockRenderer3D.playGesture).toHaveBeenCalledWith('override3D');
    });
  });
});
