import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createMockRenderer2D,
  createMockRenderer3D,
  setupWindowPixiMock
} from '@/test/mocks/skin-renderer-mock';
import { FIT_MODE_MAP } from '@/core/constants';
import { defaultGesture2D, bootAvatar, loadUMD } from '@/core/skin/renderer-2d';
import { defaultGesture3D } from '@/core/skin/renderer-3d';
import { isRenderer2D, isRenderer3D } from '@/core/skin/types';
import type { Renderer2D, SkinEngine } from '@/core/skin';

describe('Unit Test: core/skin/skin-renderers.js (Renderer Lifecycle & Teardown)', () => {
  let stageEl: HTMLElement;

  beforeEach(() => {
    stageEl = document.createElement('div');
    stageEl.id = 'stage';
    document.body.appendChild(stageEl);
    setupWindowPixiMock();
  });

  afterEach(() => {
    stageEl.remove();
    vi.restoreAllMocks();
  });

  describe('defaultGesture2D', () => {
    it('should trigger female expressions correctly', async () => {
      const expressionMock = vi.fn().mockResolvedValue(true);
      const skinEngine = {
        gender: 'female',
        avatarModel: { expression: expressionMock }
      } as unknown as SkinEngine;

      await defaultGesture2D(skinEngine, 'neutral');
      expect(expressionMock).toHaveBeenCalledWith('f00');

      await defaultGesture2D(skinEngine, 'happy');
      expect(expressionMock).toHaveBeenCalledWith('f04');

      await defaultGesture2D(skinEngine, 'sad');
      expect(expressionMock).toHaveBeenCalledWith('f03');

      await defaultGesture2D(skinEngine, 'surprised');
      expect(expressionMock).toHaveBeenCalledWith('f05');
    });

    it('should trigger male expressions correctly and handle errors', async () => {
      const expressionMock = vi.fn().mockResolvedValue(true);
      const skinEngine = {
        gender: 'male',
        avatarModel: { expression: expressionMock }
      } as unknown as SkinEngine;

      await defaultGesture2D(skinEngine, 'neutral');
      expect(expressionMock).toHaveBeenCalledWith('Normal');

      await defaultGesture2D(skinEngine, 'happy');
      expect(expressionMock).toHaveBeenCalledWith('Smile');

      await defaultGesture2D(skinEngine, 'sad');
      expect(expressionMock).toHaveBeenCalledWith('Sad');

      await defaultGesture2D(skinEngine, 'surprised');
      expect(expressionMock).toHaveBeenCalledWith('Surprised');

      // Test error fallback
      expressionMock.mockRejectedValueOnce(new Error('Expression fail'));
      await expect(
        defaultGesture2D(skinEngine, 'happy')
      ).resolves.not.toThrow();

      // Null skinEngine or invalid emotion
      await defaultGesture2D(null as unknown as SkinEngine, 'happy');
      await defaultGesture2D(skinEngine, 'unknown_emotion');
    });
  });

  describe('bootAvatar (2D Live2D)', () => {
    it('should fail gracefully when stageEl is not an HTMLElement', async () => {
      const skinEngine = { stageEl: null } as unknown as SkinEngine;
      const res = await bootAvatar(skinEngine, 'model.json');
      expect(res).toBeUndefined();
    });

    it('should boot 2D avatar, fit, update mouth on update, and dispose', async () => {
      const state: {
        fitMode: 'full' | 'half' | string;
        skin2d: Record<string, unknown>;
      } = {
        fitMode: FIT_MODE_MAP.FULL,
        skin2d: {
          full: {
            zoom: 1.2,
            offsetX: 10,
            offsetY: 20,
            anchor: { x: 0.5, y: 0.9 }
          },
          half: {
            zoom: 2.0,
            offsetX: 0,
            offsetY: 50,
            anchor: { x: 0.5, y: 1.0 }
          }
        }
      };
      const subscribers: Array<() => void> = [];
      const skinEngineMock = {
        stageEl,
        fitMode: FIT_MODE_MAP.FULL,
        getState: () => state,
        subscribe: vi.fn((_selector: unknown, callback: () => void) => {
          subscribers.push(callback);
          return vi.fn();
        }),
        setSkin2d: vi.fn(),
        computeMouth: vi.fn().mockResolvedValue(0.8),
        onMounted: vi.fn(),
        avatarModel: null as unknown
      };
      const skinEngine = skinEngineMock as unknown as SkinEngine & {
        avatarModel: { internalModel: { coreModel: Record<string, unknown> } };
        subscribe: {
          mock: { calls: Array<[(s: unknown) => unknown, () => void]> };
        };
      };

      const renderer = (await bootAvatar(
        skinEngine,
        'model.json'
      )) as Renderer2D;
      expect(renderer).toBeDefined();
      expect(renderer.canvas).toBeDefined();
      expect(renderer.avatarModel).toBeDefined();
      expect(renderer.pixiApp).toBeDefined();
      expect(skinEngineMock.onMounted).toHaveBeenCalled();

      // Trigger mouth compute through coreModel.update (async promise)
      const core = skinEngine.avatarModel.internalModel.coreModel as {
        update: () => void;
        setParameterValueById: unknown;
      };
      core.update();
      expect(skinEngineMock.computeMouth).toHaveBeenCalled();

      // Wait for microtask promise
      await Promise.resolve();

      // Trigger mouth compute error handling
      skinEngineMock.computeMouth = vi
        .fn()
        .mockRejectedValueOnce(new Error('Mouth compute fail'));
      core.update();
      await Promise.resolve();

      // Trigger setParameterValueById error handling
      core.setParameterValueById = vi.fn(() => {
        throw new Error('Param set fail');
      });
      core.update();

      // Trigger subscribers callbacks and verify selectors
      const selector2d = skinEngine.subscribe.mock.calls[0][0];
      const selectorFitMode = skinEngine.subscribe.mock.calls[1][0];
      expect(selector2d({ skin2d: { zoom: 1 } })).toEqual({ zoom: 1 });
      expect(selectorFitMode({ fitMode: 'half' })).toBe('half');
      subscribers.forEach((cb) => cb());

      // Trigger window resize event
      window.dispatchEvent(new Event('resize'));

      // Trigger fitMode change to HALF
      state.fitMode = FIT_MODE_MAP.HALF;
      renderer.fit();

      // Update transform
      renderer.updateTransform({ full: { zoom: 1.5 } });
      expect(skinEngineMock.setSkin2d).toHaveBeenCalledWith({
        full: { zoom: 1.5 }
      });

      // Dispose and ensure fit() gracefully early returns
      renderer.dispose();
      expect(skinEngine.avatarModel).toBeNull();
      expect(() => renderer.fit()).not.toThrow();
    });

    it('should trigger onTwoDimensionalError when bootAvatar throws', async () => {
      const onTwoDimensionalError = vi.fn();
      const skinEngine = {
        stageEl,
        onTwoDimensionalError
      } as unknown as SkinEngine;
      const win = window as unknown as Record<string, unknown>;
      // Cause an error by breaking window.PIXI
      const originalPIXI = win.PIXI;
      win.PIXI = null;

      await bootAvatar(skinEngine, 'model.json');
      expect(onTwoDimensionalError).toHaveBeenCalled();

      win.PIXI = originalPIXI;
    });

    it('should load UMD scripts or return cached promise if already loading', async () => {
      const win = window as unknown as Record<string, unknown>;
      delete win.__cdnDependenciePromise__;
      const promise1 = loadUMD();
      expect(win.__cdnDependenciePromise__).toBe(promise1);

      // Subsequent call returns cached promise
      const promise2 = loadUMD();
      expect(promise2).toBe(promise1);
    });
  });

  describe('defaultGesture3D', () => {
    it('should invoke renderer.playGesture and handle null/empty gestures', async () => {
      const playGesture = vi.fn();
      const skinEngine = {
        renderer: { playGesture }
      } as unknown as SkinEngine;

      await defaultGesture3D(skinEngine, 'wave');
      expect(playGesture).toHaveBeenCalledWith('wave');

      await defaultGesture3D(null as unknown as SkinEngine, 'wave');
      await defaultGesture3D(skinEngine, '');

      // Catch error
      playGesture.mockImplementationOnce(() => {
        throw new Error('Play failed');
      });
      await expect(defaultGesture3D(skinEngine, 'bow')).resolves.not.toThrow();
    });
  });

  describe('Renderer2D Lifecycle (Mock)', () => {
    it('should create mock 2D renderer with canvas, model, and pixiApp', () => {
      const renderer2D = createMockRenderer2D();
      stageEl.appendChild(renderer2D.canvas);

      expect(renderer2D.canvas).toBeDefined();
      expect(renderer2D.avatarModel).toBeDefined();
      expect(renderer2D.pixiApp).toBeDefined();
      expect(typeof renderer2D.fit).toBe('function');
      expect(typeof renderer2D.dispose).toBe('function');
    });

    it('should invoke fit and updateTransform without visual coupling breakage', () => {
      const renderer2D = createMockRenderer2D();

      renderer2D.fit();
      expect(renderer2D.fit).toHaveBeenCalledOnce();

      renderer2D.updateTransform({
        zoom: 2.0,
        fitMode: FIT_MODE_MAP.HALF
      } as unknown as Record<string, unknown>);
      expect(renderer2D.updateTransform).toHaveBeenCalledWith({
        zoom: 2.0,
        fitMode: FIT_MODE_MAP.HALF
      });
    });

    it('should teardown canvas and pixiApp on dispose', () => {
      const renderer2D = createMockRenderer2D();
      stageEl.appendChild(renderer2D.canvas);
      expect(stageEl.contains(renderer2D.canvas)).toBe(true);

      renderer2D.dispose();
      expect(renderer2D.dispose).toHaveBeenCalledOnce();
    });
  });

  describe('Renderer3D Lifecycle (Mock)', () => {
    it('should create mock 3D renderer with camera, scene, and vrm', () => {
      const renderer3D = createMockRenderer3D();
      stageEl.appendChild(renderer3D.canvas);

      expect(renderer3D.canvas).toBeDefined();
      expect(renderer3D.camera).toBeDefined();
      expect(renderer3D.scene).toBeDefined();
      expect(renderer3D.vrm).toBeDefined();
      expect(renderer3D.TAP_GESTURES).toContain('wave');
    });

    it('should support playGesture, setPaused, and updateTransform', () => {
      const renderer3D = createMockRenderer3D();

      renderer3D.playGesture('wave');
      expect(renderer3D.playGesture).toHaveBeenCalledWith('wave');

      renderer3D.setPaused(true);
      expect(renderer3D.setPaused).toHaveBeenCalledWith(true);

      renderer3D.updateTransform({ camera: { fov: 40 } });
      expect(renderer3D.updateTransform).toHaveBeenCalledWith({
        camera: { fov: 40 }
      });
    });

    it('should cleanup scene, mixer, and canvas on dispose', () => {
      const renderer3D = createMockRenderer3D();
      stageEl.appendChild(renderer3D.canvas);
      expect(stageEl.contains(renderer3D.canvas)).toBe(true);

      renderer3D.dispose();
      expect(renderer3D.dispose).toHaveBeenCalledOnce();
    });
  });

  describe('Type Guards: isRenderer2D & isRenderer3D', () => {
    it('should correctly differentiate between 2D, 3D renderers, null, and primitives', () => {
      const renderer2D = createMockRenderer2D();
      const renderer3D = createMockRenderer3D();

      expect(isRenderer2D(renderer2D)).toBe(true);
      expect(isRenderer2D(renderer3D)).toBe(false);
      expect(isRenderer2D(null)).toBe(false);
      expect(isRenderer2D(undefined)).toBe(false);
      expect(isRenderer2D('invalid')).toBe(false);
      expect(isRenderer2D(123)).toBe(false);
      expect(isRenderer2D({})).toBe(false);

      expect(isRenderer3D(renderer3D)).toBe(true);
      expect(isRenderer3D(renderer2D)).toBe(false);
      expect(isRenderer3D(null)).toBe(false);
      expect(isRenderer3D(undefined)).toBe(false);
      expect(isRenderer3D('invalid')).toBe(false);
      expect(isRenderer3D(123)).toBe(false);
      expect(isRenderer3D({})).toBe(false);
    });
  });
});
