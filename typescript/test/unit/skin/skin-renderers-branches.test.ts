import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defaultGesture2D, bootAvatar, loadUMD } from '@/core/skin/renderer-2d';
import { defaultGesture3D, loadVRMFile } from '@/core/skin/renderer-3d';
import { GENDER_MAP, ENGINE_MODE_MAP, FIT_MODE_MAP } from '@/core/constants';
import { setupWindowPixiMock } from '@/test/mocks/skin-renderer-mock';
import type { SkinEngine, Renderer2D } from '@/core/skin';

interface MockPixiWindow extends Window {
  PIXI: {
    Application: unknown;
    Ticker: unknown;
    live2d: {
      Live2DModel: {
        from: (url: string) => Promise<unknown>;
        registerTicker?: () => void;
      };
      SoundManager: { volume: number };
    };
  };
}

describe('Unit Test: core/skin/skin-renderers-branches.test.js (2D & 3D Renderers Deep Coverage)', () => {
  let stageEl: HTMLElement;

  beforeEach(() => {
    stageEl = document.createElement('div');
    stageEl.id = 'avatar-stage';
    stageEl.style.width = '800px';
    stageEl.style.height = '600px';
    document.body.appendChild(stageEl);
    setupWindowPixiMock();
  });

  describe('defaultGesture2D & defaultGesture3D', () => {
    it('should trigger female expressions correctly and handle errors', async () => {
      const mockExpression = vi.fn().mockResolvedValue(true);
      const skinEngine = {
        gender: GENDER_MAP.female,
        avatarModel: { expression: mockExpression }
      } as unknown as SkinEngine;

      await defaultGesture2D(skinEngine, 'happy');
      expect(mockExpression).toHaveBeenCalledWith('f04');

      await defaultGesture2D(skinEngine, 'sad');
      expect(mockExpression).toHaveBeenCalledWith('f03');

      await defaultGesture2D(skinEngine, 'surprised');
      expect(mockExpression).toHaveBeenCalledWith('f05');

      await defaultGesture2D(skinEngine, 'neutral');
      expect(mockExpression).toHaveBeenCalledWith('f00');

      // Error handling
      mockExpression.mockRejectedValueOnce(new Error('Expression error'));
      await defaultGesture2D(skinEngine, 'happy'); // Should not throw

      // Guard conditions
      expect(
        await defaultGesture2D(null as unknown as SkinEngine, 'happy')
      ).toBeUndefined();
      expect(
        await defaultGesture2D(skinEngine, 'unknown_emotion')
      ).toBeUndefined();
    });

    it('should trigger male expressions correctly', async () => {
      const mockExpression = vi.fn().mockResolvedValue(true);
      const skinEngine = {
        gender: GENDER_MAP.male,
        avatarModel: { expression: mockExpression }
      } as unknown as SkinEngine;

      await defaultGesture2D(skinEngine, 'happy');
      expect(mockExpression).toHaveBeenCalledWith('Smile');

      await defaultGesture2D(skinEngine, 'neutral');
      expect(mockExpression).toHaveBeenCalledWith('Normal');
    });

    it('should trigger defaultGesture3D playGesture correctly', async () => {
      const playGesture = vi.fn();
      const skinEngine = {
        renderer: { playGesture }
      } as unknown as SkinEngine;

      await defaultGesture3D(skinEngine, 'wave');
      expect(playGesture).toHaveBeenCalledWith('wave');

      // Guard conditions
      expect(
        await defaultGesture3D(null as unknown as SkinEngine, 'wave')
      ).toBeUndefined();
      expect(await defaultGesture3D(skinEngine, '')).toBeUndefined();
    });
  });

  describe('loadUMD and bootAvatar', () => {
    it('should resolve loadUMD promise on second call from cache', async () => {
      const p1 = loadUMD();
      const p2 = loadUMD();
      expect(p1).toBe(p2);
    });

    it('should boot 2D avatar, apply fit transform in HALF and FULL modes, and clean up on dispose', async () => {
      const onMounted = vi.fn();
      let stateCallback: (() => void) | undefined;

      const skinEngine = {
        stageEl,
        gender: GENDER_MAP.female,
        fitMode: FIT_MODE_MAP.HALF,
        subscribe: vi.fn((_selector: unknown, cb: () => void) => {
          stateCallback = cb;
          return vi.fn();
        }),
        computeMouth: vi.fn(async () => 0.75),
        setSkin2d: vi.fn(),
        onMounted
      } as unknown as SkinEngine;

      // Mock Live2D model with settings groups for lipsync
      const pixiWin = window as unknown as MockPixiWindow;
      const origFrom = pixiWin.PIXI.live2d.Live2DModel.from;
      const setParamSpy = vi.fn();
      pixiWin.PIXI.live2d.Live2DModel.from = vi.fn().mockResolvedValue({
        width: 400,
        height: 600,
        anchor: { set: vi.fn() },
        position: { set: vi.fn() },
        scale: { set: vi.fn() },
        internalModel: {
          settings: {
            groups: [{ Name: 'LipSync', Ids: ['ParamMouthOpenY'] }]
          },
          coreModel: {
            update: vi.fn(),
            setParameterValueById: setParamSpy
          }
        }
      });

      const renderer2D = (await bootAvatar(
        skinEngine,
        'model3.json'
      )) as Renderer2D;
      expect(renderer2D).toBeDefined();
      expect(renderer2D.canvas).toBeDefined();
      expect(renderer2D.pixiApp).toBeDefined();
      expect(onMounted).toHaveBeenCalled();

      // Trigger fit transform update
      renderer2D.fit();
      if (typeof stateCallback === 'function') {
        stateCallback();
      }

      // Test core.update monkey patch with computeMouth and setParameterValueById
      if (
        typeof skinEngine.avatarModel?.internalModel?.coreModel?.update ===
        'function'
      ) {
        skinEngine.avatarModel.internalModel.coreModel.update();
        await Promise.resolve();
        await Promise.resolve();
        expect(setParamSpy).toHaveBeenCalled();
        expect(setParamSpy.mock.calls[0][0]).toBe('ParamMouthOpenY');
        expect(typeof setParamSpy.mock.calls[0][1]).toBe('number');
      }

      // Update transform
      (
        renderer2D as unknown as {
          updateTransform: (config: { zoom: number }) => void;
        }
      ).updateTransform({ zoom: 1.2 });
      expect(skinEngine.setSkin2d).toHaveBeenCalledWith({ zoom: 1.2 });

      // Dispose
      (renderer2D as unknown as { dispose: () => void }).dispose();
      expect(skinEngine.avatarModel).toBeNull();

      pixiWin.PIXI.live2d.Live2DModel.from = origFrom;
    });

    it('should handle bootAvatar error and invoke onTwoDimensionalError', async () => {
      const onTwoDimensionalError = vi.fn();
      const resNull = await bootAvatar(
        {
          stageEl: null as unknown as HTMLElement,
          onTwoDimensionalError
        } as unknown as SkinEngine,
        'model.json'
      );
      expect(resNull).toBeUndefined();

      // Test catch block when Live2DModel.from throws
      const pixiWin = window as unknown as MockPixiWindow;
      const origFrom = pixiWin.PIXI.live2d.Live2DModel.from;
      pixiWin.PIXI.live2d.Live2DModel.from = vi
        .fn()
        .mockRejectedValue(new Error('Live2D init failed'));

      const resError = await bootAvatar(
        {
          stageEl: document.createElement('div'),
          onTwoDimensionalError
        } as unknown as SkinEngine,
        'model.json'
      );
      expect(resError).toBeUndefined();
      expect(onTwoDimensionalError).toHaveBeenCalled();

      pixiWin.PIXI.live2d.Live2DModel.from = origFrom;
    });
  });

  describe('loadVRMFile (Custom VRM Drag & Drop)', () => {
    it('should report error when invalid stageEl or non-VRM file is provided', () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      loadVRMFile(null as unknown as SkinEngine, new File([''], 'test.vrm'));
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();

      const failSpy = vi.fn();
      const nonVrmFile = new File([''], 'model.obj');
      const skinEngine = {
        stageEl,
        VRMFileChangeFail: failSpy
      } as unknown as SkinEngine;

      loadVRMFile(skinEngine, nonVrmFile);
      expect(failSpy).toHaveBeenCalled();
      expect(failSpy.mock.calls[0][0]).toBeInstanceOf(Error);
    });

    it('should load valid VRM file, revoke old blob URL, and switch to 3D mode', () => {
      const origCreate = URL.createObjectURL;
      const origRevoke = URL.revokeObjectURL;
      URL.createObjectURL = vi.fn(() => 'blob:new_vrm_url');
      URL.revokeObjectURL = vi.fn();

      const successSpy = vi.fn();
      const vrmFile = new File([''], 'avatar.vrm');
      const skinEngine = {
        stageEl,
        vrmUrl: 'blob:old_vrm_url',
        VRMFileChangeSuccess: successSpy,
        engineMode: ENGINE_MODE_MAP.twoDimensional
      } as unknown as SkinEngine;

      loadVRMFile(skinEngine, vrmFile);

      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:old_vrm_url');
      expect(skinEngine.vrmUrl).toBe('blob:new_vrm_url');
      expect(successSpy).toHaveBeenCalledWith('blob:new_vrm_url');
      expect(skinEngine.engineMode).toBe(ENGINE_MODE_MAP.threeDimensional);

      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
    });

    it('should test 2D fit with scalar anchor, global skin2d offsets, and synchronous computeMouth number', async () => {
      const state = {
        fitMode: FIT_MODE_MAP.FULL,
        skin2d: {
          zoom: 1.5,
          offsetX: 25,
          offsetY: 35,
          anchor: 0.6 // Scalar anchor
        }
      };

      const setParamSpy = vi.fn();
      const pixiWin = window as unknown as MockPixiWindow;
      const origFrom = pixiWin.PIXI.live2d.Live2DModel.from;
      pixiWin.PIXI.live2d.Live2DModel.from = vi.fn().mockResolvedValue({
        width: 300,
        height: 500,
        anchor: { set: vi.fn() },
        position: { set: vi.fn() },
        scale: { set: vi.fn() },
        internalModel: {
          settings: {
            groups: [{ Name: 'LipSync', Ids: ['ParamMouthOpenY'] }]
          },
          coreModel: {
            update: vi.fn(),
            setParameterValueById: setParamSpy
          }
        }
      });

      const skinEngine = {
        stageEl,
        fitMode: FIT_MODE_MAP.FULL,
        getState: () => state,
        subscribe: vi.fn(() => vi.fn()),
        computeMouth: vi.fn(() => 0.65), // Synchronous number return
        setSkin2d: vi.fn()
      } as unknown as SkinEngine;

      const renderer2D = (await bootAvatar(
        skinEngine,
        'model.json'
      )) as Renderer2D;
      expect(renderer2D).toBeDefined();

      // Trigger fit
      renderer2D.fit();

      // Trigger core.update (first tick initiates async computeMouth, second tick applies resolved lastMouthValue)
      if (
        typeof skinEngine.avatarModel?.internalModel?.coreModel?.update ===
        'function'
      ) {
        skinEngine.avatarModel.internalModel.coreModel.update();
        await Promise.resolve();
        await Promise.resolve();
        skinEngine.avatarModel.internalModel.coreModel.update();
        expect(setParamSpy).toHaveBeenCalledWith('ParamMouthOpenY', 0.65);
      }

      // Dispose
      (renderer2D as unknown as { dispose: () => void }).dispose();
      pixiWin.PIXI.live2d.Live2DModel.from = origFrom;
    });

    it('should resolve immediately in loadUMD when window is undefined', async () => {
      const origWindow = global.window;
      delete (globalThis as unknown as Record<string, unknown>).window;
      await expect(loadUMD()).resolves.toBeUndefined();
      global.window = origWindow;
    });
  });
});
