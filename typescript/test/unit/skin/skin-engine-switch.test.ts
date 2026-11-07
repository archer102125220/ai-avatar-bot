import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initSkinEngine, loadVRMFile } from '@/core/skin';
import * as renderer3d from '@/core/skin/renderer-3d';
import * as renderer2d from '@/core/skin/renderer-2d';
import { ENGINE_MODE_MAP } from '@/core/constants';
import type {
  SkinEngine,
  Renderer2D
} from '@/core/skin/types';

describe('Unit Test: core/skin/skin-engine-switch.js (2D/3D Mode Switching & VRM Drop)', () => {
  let stageEl: HTMLElement;

  beforeEach(() => {
    stageEl = document.createElement('div');
    stageEl.id = 'stage';
    document.body.appendChild(stageEl);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    stageEl.remove();
  });

  describe('engineMode setter & switching concurrency guard', () => {
    it('should ignore duplicate mode assignments or concurrent switching', () => {
      const onModelChangeStart = vi.fn();
      const engine: SkinEngine = initSkinEngine({
        stageEl,
        startMode: ENGINE_MODE_MAP.twoDimensional,
        onModelChangeStart
      }) as SkinEngine;

      expect(engine.engineMode).toBe(ENGINE_MODE_MAP.twoDimensional);
      // 初始化時觸發 1 次
      expect(onModelChangeStart).toHaveBeenCalledTimes(1);

      // 設定相同模式不應觸發重複切換
      engine.engineMode = ENGINE_MODE_MAP.twoDimensional;
      expect(onModelChangeStart).toHaveBeenCalledTimes(1);

      // 當 switching 為 true 時應略過切換
      engine.switching = true;
      engine.engineMode = ENGINE_MODE_MAP.threeDimensional;
      expect(onModelChangeStart).toHaveBeenCalledTimes(1);
    });

    it('should invoke dispose on prior renderer when switching modes', async () => {
      const disposeMock = vi.fn();
      const onModelChangeStart = vi.fn();
      const onModelChangeEnd = vi.fn();

      const engine: SkinEngine = initSkinEngine({
        stageEl,
        startMode: ENGINE_MODE_MAP.twoDimensional,
        onModelChangeStart,
        onModelChangeEnd
      }) as SkinEngine;

      // 重設初始化非同步切換旗標
      engine.switching = false;

      // 設定舊渲染器
      engine.renderer = {
        dispose: disposeMock
      } as unknown as Renderer2D;

      // 觸發切換至 3D
      engine.engineMode = ENGINE_MODE_MAP.threeDimensional;

      expect(onModelChangeStart).toHaveBeenLastCalledWith(
        ENGINE_MODE_MAP.threeDimensional
      );
      expect(disposeMock).toHaveBeenCalledOnce();
      expect(engine.switching).toBe(true);
    });
  });

  describe('loadVRMFile', () => {
    it('should reject invalid non-VRM files and invoke onVrmFileChangeFail', () => {
      const onVrmFileChangeFail = vi.fn();
      const engine: SkinEngine = initSkinEngine({
        stageEl,
        onVrmFileChangeFail
      }) as SkinEngine;

      const invalidFile = new File(['text'], 'model.txt', {
        type: 'text/plain'
      });
      loadVRMFile(engine, invalidFile);

      expect(onVrmFileChangeFail).toHaveBeenCalledOnce();
      expect(onVrmFileChangeFail.mock.calls[0][0].message).toContain(
        '請拖一個 .vrm 檔喔'
      );
    });

    it('should accept valid .vrm File, create Blob URL, and switch engineMode to 3D', () => {
      const onVrmFileChangeSuccess = vi.fn();
      const createObjectURLMock = vi
        .fn()
        .mockReturnValue('blob:http://localhost/mock-vrm-blob');
      const revokeObjectURLMock = vi.fn();

      global.URL.createObjectURL = createObjectURLMock;
      global.URL.revokeObjectURL = revokeObjectURLMock;

      const engine: SkinEngine = initSkinEngine({
        stageEl,
        startMode: ENGINE_MODE_MAP.twoDimensional,
        onVrmFileChangeSuccess
      }) as SkinEngine;

      // 重設初始切換狀態
      engine.switching = false;

      const vrmFile = new File(['vrm binary data'], 'avatar_custom.vrm', {
        type: 'application/octet-stream'
      });

      loadVRMFile(engine, vrmFile);

      expect(createObjectURLMock).toHaveBeenCalledWith(vrmFile);
      expect(engine.vrmUrl).toBe('blob:http://localhost/mock-vrm-blob');
      expect(onVrmFileChangeSuccess).toHaveBeenCalledWith(
        'blob:http://localhost/mock-vrm-blob'
      );
      expect(engine.engineMode).toBe(ENGINE_MODE_MAP.threeDimensional);
    });
  });

  describe('gesture getters, setters, and execution flow', () => {
    it('should route playGesture to unified gesture handler with context mode', async () => {
      const mockGesture = vi.fn();
      const engine: SkinEngine = initSkinEngine({
        stageEl,
        startMode: ENGINE_MODE_MAP.twoDimensional,
        gesture: mockGesture
      }) as SkinEngine;

      await engine.playGesture?.('happy');
      expect(mockGesture).toHaveBeenCalledWith(
        engine,
        'happy',
        expect.objectContaining({ mode: '2d' })
      );

      engine._engineMode = ENGINE_MODE_MAP.threeDimensional;
      await engine.playGesture?.('goodbye');
      expect(mockGesture).toHaveBeenCalledWith(
        engine,
        'goodbye',
        expect.objectContaining({ mode: '3d' })
      );
    });

    it('should trigger onGesture, gesture, onGestureError, and onGestureEnd on gestureName setter', async () => {
      const onGesture = vi.fn();
      const onGestureEnd = vi.fn();
      const onGestureError = vi.fn();
      const mockGestureFn = vi.fn().mockResolvedValue(undefined);

      const engine: SkinEngine = initSkinEngine({
        stageEl,
        startMode: ENGINE_MODE_MAP.twoDimensional,
        gesture: mockGestureFn,
        onGesture,
        onGestureEnd,
        onGestureError
      }) as SkinEngine;

      // Setting gestureName
      engine.gestureName = 'happy';
      expect(engine.gestureName).toBe('happy');
      expect(onGesture).toHaveBeenCalledWith('happy', engine);

      // Trigger error in gesture execution
      mockGestureFn.mockRejectedValueOnce(new Error('Gesture fail'));
      engine.gestureName = 'sad';
      await new Promise((r) => setTimeout(r, 60));
      expect(onGestureError).toHaveBeenCalledWith(
        expect.any(Error),
        'sad',
        engine
      );
    });

    it('should invoke loadVRMFile method, update live2dUrl, and handle error in onModelChange', async () => {
      const onModelChangeError = vi.fn();
      const onVrmFileChangeFail = vi.fn();

      const engine: SkinEngine = initSkinEngine({
        stageEl,
        startMode: ENGINE_MODE_MAP.twoDimensional,
        onModelChangeError,
        onVrmFileChangeFail
      }) as SkinEngine;

      // Test loadVRMFile getter method
      const invalidFile = new File(['test'], 'invalid.png', {
        type: 'image/png'
      });
      engine.loadVRMFile(invalidFile);
      expect(onVrmFileChangeFail).toHaveBeenCalled();

      // Test live2dUrl setter
      engine.live2dUrl = 'https://models.test/avatar.model3.json';
      expect(engine.live2dUrl).toBe('https://models.test/avatar.model3.json');
      // Wait for initial 2D boot to finish
      await new Promise((r) => setTimeout(r, 60));

      // Test onModelChangeError delegator
      engine.onModelChangeError?.(new Error('model change err'));
      expect(onModelChangeError).toHaveBeenCalled();

      // Trigger switch to 3D mode
      engine.switching = false;
      engine.engineMode = ENGINE_MODE_MAP.threeDimensional;
      expect(engine.engineMode).toBe(ENGINE_MODE_MAP.threeDimensional);

      // Trigger switch back to 2D mode
      engine.switching = false;
      engine.engineMode = ENGINE_MODE_MAP.twoDimensional;
      expect(engine.engineMode).toBe(ENGINE_MODE_MAP.twoDimensional);
    });

    it('should test onMounted, on3DError, and on2DError delegators', () => {
      const onMounted = vi.fn();
      const on3DError = vi.fn();
      const on2DError = vi.fn();

      const engine: SkinEngine = initSkinEngine({
        stageEl,
        onMounted,
        on3DError,
        on2DError
      }) as SkinEngine;

      engine.onMounted?.('arg1');
      expect(onMounted).toHaveBeenCalledWith('arg1');

      engine.on3DError?.(new Error('3d err'));
      expect(on3DError).toHaveBeenCalled();

      engine.on2DError?.(new Error('2d err'));
      expect(on2DError).toHaveBeenCalled();

      // When callbacks are missing
      const emptyEngine: SkinEngine = initSkinEngine({ stageEl }) as SkinEngine;
      expect(emptyEngine.onMounted?.()).toBeUndefined();
      expect(emptyEngine.on3DError?.()).toBeUndefined();
      expect(emptyEngine.on2DError?.()).toBeUndefined();
    });

    it('should test gestureName setter with invalid inputs and onGestureError on failure', async () => {
      const onModelChangeStart = vi.fn();
      const onModelChangeEnd = vi.fn();
      const onGestureError = vi.fn();
      const mockCustomGesture = vi
        .fn()
        .mockRejectedValue(new Error('Async gesture failure'));

      const engine: SkinEngine = initSkinEngine({
        stageEl,
        startMode: ENGINE_MODE_MAP.twoDimensional,
        gesture: mockCustomGesture,
        onModelChangeStart,
        onModelChangeEnd,
        onGestureError
      }) as SkinEngine;

      // 1. gestureName setter with empty or null
      engine.gestureName = '';
      engine.gestureName = null as unknown as string;
      expect(engine.gestureName).toBe('neutral');

      // 2. onGestureError callback when gesture rejects
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      engine.gestureName = 'surprised';
      await new Promise((r) => setTimeout(r, 60));

      expect(onGestureError).toHaveBeenCalledWith(
        expect.any(Error),
        'surprised',
        engine
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('switchEngineMode error handling and edge cases', () => {
    it('should catch error when renderer.dispose throws during mode switch', async () => {
      const engine: SkinEngine = initSkinEngine({
        stageEl,
        startMode: ENGINE_MODE_MAP.twoDimensional
      }) as SkinEngine;

      engine.switching = false;
      engine.renderer = {
        dispose: () => {
          throw new Error('Dispose failure');
        }
      } as unknown as Renderer2D;

      engine.engineMode = ENGINE_MODE_MAP.threeDimensional;
      expect(engine.switching).toBe(true);
      await Promise.resolve();
    });

    it('should handle bootVRM error with Error instance in switchEngineMode', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const bootSpy = vi
        .spyOn(renderer3d, 'bootVRM')
        .mockRejectedValueOnce(new Error('VRM boot failed'));
      const onModelChangeError = vi.fn();
      const onModelChangeEnd = vi.fn();

      const engine: SkinEngine = initSkinEngine({
        stageEl,
        startMode: ENGINE_MODE_MAP.twoDimensional,
        onModelChangeError,
        onModelChangeEnd
      }) as SkinEngine;

      engine.switching = false;
      engine.engineMode = ENGINE_MODE_MAP.threeDimensional;

      await vi.waitFor(() => {
        expect(onModelChangeError).toHaveBeenCalledWith(expect.any(Error));
        expect(onModelChangeEnd).toHaveBeenCalledWith(
          null,
          ENGINE_MODE_MAP.threeDimensional
        );
      });

      bootSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should handle bootVRM error with non-Error string in switchEngineMode', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const bootSpy = vi
        .spyOn(renderer3d, 'bootVRM')
        .mockRejectedValueOnce('raw string error');
      const onModelChangeError = vi.fn();

      const engine: SkinEngine = initSkinEngine({
        stageEl,
        startMode: ENGINE_MODE_MAP.twoDimensional,
        onModelChangeError
      }) as SkinEngine;

      engine.switching = false;
      engine.engineMode = ENGINE_MODE_MAP.threeDimensional;

      await vi.waitFor(() => {
        expect(onModelChangeError).toHaveBeenCalled();
        const callArg = onModelChangeError.mock.calls[0][0];
        expect(callArg).toBeInstanceOf(Error);
        expect(callArg.message).toBe('raw string error');
      });

      bootSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should handle bootAvatar error in switchEngineMode without onModelChangeError', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const boot2dSpy = vi
        .spyOn(renderer2d, 'bootAvatar')
        .mockRejectedValueOnce(new Error('2D boot failure'));

      const engine: SkinEngine = initSkinEngine({
        stageEl,
        startMode: ENGINE_MODE_MAP.threeDimensional
      }) as SkinEngine;

      engine.switching = false;
      engine.engineMode = ENGINE_MODE_MAP.twoDimensional;

      await vi.waitFor(() => {
        expect(engine.switching).toBe(false);
      });

      boot2dSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should fallback this.renderer to null when booted is falsy', async () => {
      const boot2dSpy = vi
        .spyOn(renderer2d, 'bootAvatar')
        .mockResolvedValueOnce(null as unknown as Renderer2D);

      const engine: SkinEngine = initSkinEngine({
        stageEl,
        startMode: ENGINE_MODE_MAP.threeDimensional
      }) as SkinEngine;

      engine.switching = false;
      engine.engineMode = ENGINE_MODE_MAP.twoDimensional;

      await vi.waitFor(() => {
        expect(engine.switching).toBe(false);
        expect(engine.renderer).toBeNull();
      });

      boot2dSpy.mockRestore();
    });
  });
});
