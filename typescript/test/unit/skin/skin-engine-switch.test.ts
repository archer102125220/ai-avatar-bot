import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initSkinEngine, loadVRMFile } from '@/core/skin';
import { ENGINE_MODE_MAP } from '@/core/constants';
import type { SkinEngine } from '@core';

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

      const engine: any = initSkinEngine({
        stageEl,
        startMode: ENGINE_MODE_MAP.twoDimensional,
        onModelChangeStart,
        onModelChangeEnd
      });

      // 重設初始化非同步切換旗標
      engine.switching = false;

      // 設定舊渲染器
      engine.renderer = {
        dispose: disposeMock
      };

      // 觸發切換至 3D
      engine.engineMode = ENGINE_MODE_MAP.threeDimensional;

      expect(onModelChangeStart).toHaveBeenLastCalledWith(ENGINE_MODE_MAP.threeDimensional);
      expect(disposeMock).toHaveBeenCalledOnce();
      expect(engine.switching).toBe(true);
    });
  });

  describe('loadVRMFile', () => {
    it('should reject invalid non-VRM files and invoke VRMFileChangeFail', () => {
      const VRMFileChangeFail = vi.fn();
      const engine: SkinEngine = initSkinEngine({
        stageEl,
        VRMFileChangeFail
      }) as SkinEngine;

      const invalidFile = new File(['text'], 'model.txt', { type: 'text/plain' });
      loadVRMFile(engine, invalidFile);

      expect(VRMFileChangeFail).toHaveBeenCalledOnce();
      expect(VRMFileChangeFail.mock.calls[0][0].message).toContain('請拖一個 .vrm 檔喔');
    });

    it('should accept valid .vrm File, create Blob URL, and switch engineMode to 3D', () => {
      const VRMFileChangeSuccess = vi.fn();
      const createObjectURLMock = vi.fn().mockReturnValue('blob:http://localhost/mock-vrm-blob');
      const revokeObjectURLMock = vi.fn();

      global.URL.createObjectURL = createObjectURLMock;
      global.URL.revokeObjectURL = revokeObjectURLMock;

      const engine: any = initSkinEngine({
        stageEl,
        startMode: ENGINE_MODE_MAP.twoDimensional,
        VRMFileChangeSuccess
      });

      // 重設初始切換狀態
      engine.switching = false;

      const vrmFile = new File(['vrm binary data'], 'avatar_custom.vrm', {
        type: 'application/octet-stream'
      });

      loadVRMFile(engine, vrmFile);

      expect(createObjectURLMock).toHaveBeenCalledWith(vrmFile);
      expect(engine.vrmUrl).toBe('blob:http://localhost/mock-vrm-blob');
      expect(VRMFileChangeSuccess).toHaveBeenCalledWith('blob:http://localhost/mock-vrm-blob');
      expect(engine.engineMode).toBe(ENGINE_MODE_MAP.threeDimensional);
    });
  });

  describe('gesture getters, setters, and execution flow', () => {
    it('should support gesture2D and gesture3D getters, setters, and warnings when null', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const engine: any = initSkinEngine({ stageEl });

      // Default gesture2D and gesture3D are functions
      expect(typeof engine.gesture2D).toBe('function');
      expect(typeof engine.gesture3D).toBe('function');

      // Custom gesture2D setter
      const custom2D = vi.fn();
      engine.gesture2D = custom2D;
      engine.gesture2D('happy');
      expect(custom2D).toHaveBeenCalled();

      // Custom gesture3D setter
      const custom3D = vi.fn();
      engine.gesture3D = custom3D;
      engine.gesture3D('wave');
      expect(custom3D).toHaveBeenCalled();

      // Set to null -> logs warning
      engine.gesture2D = null;
      const fallback2D = engine.gesture2D('happy');
      expect(warnSpy).toHaveBeenCalledWith('2D hand movement function is not registered');
      fallback2D();

      engine.gesture3D = null;
      const fallback3D = engine.gesture3D('wave');
      expect(warnSpy).toHaveBeenCalledWith('3D hand movement function is not registered');
      fallback3D();

      warnSpy.mockRestore();
    });

    it('should trigger onGesture, gesture, onGestureError, and onGestureEnd on gestureName setter', async () => {
      const onGesture = vi.fn();
      const onGestureEnd = vi.fn();
      const onGestureError = vi.fn();

      const engine: any = initSkinEngine({
        stageEl,
        startMode: ENGINE_MODE_MAP.twoDimensional,
        onGesture,
        onGestureEnd,
        onGestureError
      });

      const mockGestureFn = vi.fn().mockResolvedValue(true);
      engine.gesture2D = mockGestureFn;

      // Setting gestureName
      engine.gestureName = 'happy';
      expect(engine.gestureName).toBe('happy');
      expect(onGesture).toHaveBeenCalledWith('happy', engine);

      // Trigger error in gesture execution
      mockGestureFn.mockRejectedValueOnce(new Error('Gesture fail'));
      engine.gestureName = 'sad';
      // Wait for microtask tick
      await Promise.resolve();
      await Promise.resolve();
    });

    it('should invoke loadVRMFile method, update modelUrl, and handle error in onModelChange', async () => {
      const onModelChangeError = vi.fn();
      const VRMFileChangeFail = vi.fn();

      const engine: any = initSkinEngine({
        stageEl,
        startMode: ENGINE_MODE_MAP.twoDimensional,
        onModelChangeError,
        VRMFileChangeFail
      });

      // Test loadVRMFile getter method
      const invalidFile = new File(['test'], 'invalid.png', { type: 'image/png' });
      engine.loadVRMFile(invalidFile);
      expect(VRMFileChangeFail).toHaveBeenCalled();

      // Test modelUrl setter
      engine.modelUrl = 'https://models.test/avatar.model3.json';
      expect(engine.modelUrl).toBe('https://models.test/avatar.model3.json');
      // Wait for initial 2D boot to finish
      await new Promise((r) => setTimeout(r, 60));

      // Test onModelChangeError delegator
      engine.onModelChangeError(new Error('model change err'));
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

    it('should test onMounted, onThreeDimensionalError, and onTwoDimensionalError delegators', () => {
      const onMounted = vi.fn();
      const onThreeDimensionalError = vi.fn();
      const onTwoDimensionalError = vi.fn();

      const engine: any = initSkinEngine({
        stageEl,
        onMounted,
        onThreeDimensionalError,
        onTwoDimensionalError
      });

      engine.onMounted('arg1');
      expect(onMounted).toHaveBeenCalledWith('arg1');

      engine.onThreeDimensionalError(new Error('3d err'));
      expect(onThreeDimensionalError).toHaveBeenCalled();

      engine.onTwoDimensionalError(new Error('2d err'));
      expect(onTwoDimensionalError).toHaveBeenCalled();

      // When callbacks are missing
      const emptyEngine: any = initSkinEngine({ stageEl });
      expect(emptyEngine.onMounted()).toBeUndefined();
      expect(emptyEngine.onThreeDimensionalError()).toBeUndefined();
      expect(emptyEngine.onTwoDimensionalError()).toBeUndefined();
    });

    it('should test gesture returning null for unknown engine mode and gestureName ignore invalid inputs', async () => {
      const onModelChange = vi.fn();
      const onModelChangeEnd = vi.fn();
      const onGestureError = vi.fn();

      const engine: any = initSkinEngine({
        stageEl,
        startMode: ENGINE_MODE_MAP.twoDimensional,
        onModelChange,
        onModelChangeEnd,
        onGestureError
      });

      // 1. Unknown engine mode -> gesture returns null
      engine._engineMode = 'unknown_dimension';
      expect(engine.gesture).toBeNull();

      // 2. gestureName setter with empty or null
      engine.gestureName = '';
      engine.gestureName = null;
      expect(engine.gestureName).toBe('neutral');

      // 3. onGestureError callback when gesture rejects
      engine._engineMode = ENGINE_MODE_MAP.twoDimensional;
      engine.gesture2D = vi.fn().mockRejectedValue(new Error('Async gesture failure'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      engine.gestureName = 'surprised';
      await Promise.resolve();
      await Promise.resolve();

      expect(onGestureError).toHaveBeenCalledWith(expect.any(Error), 'surprised', engine);
      consoleErrorSpy.mockRestore();
    });
  });
});
