/**
 * [3D-MOTION-BENCHMARK-BASELINE]
 * 此測試為 3D/2D 人像動作手勢分發之現行基準規格（Baseline）。
 * 保留原本 Vanilla JS 的完整測試邏輯與斷言。
 * 後續若有升級或調整 3D 動作（如新增手勢或調整動畫骨骼驅動），本檔案將作為專屬對照組同步更新。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  initSkinEngine,
  defaultGesture2D,
  defaultGesture3D
} from '@/core/skin';
import { ENGINE_MODE_MAP, GENDER_MAP } from '@/core/constants';
import type { SkinEngine } from '@core';

describe('Unit Test: core/skin/gesture-dispatch.js (Gesture Routing & Event Flow)', () => {
  let stageEl: HTMLElement;

  beforeEach(() => {
    stageEl = document.createElement('div');
    document.body.appendChild(stageEl);
  });

  describe('defaultGesture2D', () => {
    it('should map female expressions and trigger avatarModel.expression', async () => {
      const expressionMock = vi.fn().mockResolvedValue(undefined);
      const skinEngine = {
        gender: GENDER_MAP.female,
        avatarModel: { expression: expressionMock }
      } as unknown as SkinEngine;

      await defaultGesture2D(skinEngine, 'happy');
      expect(expressionMock).toHaveBeenCalledWith('f04');

      await defaultGesture2D(skinEngine, 'sad');
      expect(expressionMock).toHaveBeenCalledWith('f03');
    });

    it('should map male expressions and trigger avatarModel.expression', async () => {
      const expressionMock = vi.fn().mockResolvedValue(undefined);
      const skinEngine = {
        gender: GENDER_MAP.male,
        avatarModel: { expression: expressionMock }
      } as unknown as SkinEngine;

      await defaultGesture2D(skinEngine, 'happy');
      expect(expressionMock).toHaveBeenCalledWith('Smile');

      await defaultGesture2D(skinEngine, 'surprised');
      expect(expressionMock).toHaveBeenCalledWith('Surprised');
    });
  });

  describe('defaultGesture3D', () => {
    it('should invoke renderer.playGesture with target gesture name', async () => {
      const playGestureMock = vi.fn();
      const skinEngine = {
        renderer: { playGesture: playGestureMock }
      } as unknown as SkinEngine;

      await defaultGesture3D(skinEngine, 'wave');
      expect(playGestureMock).toHaveBeenCalledWith('wave');

      await defaultGesture3D(skinEngine, 'bow');
      expect(playGestureMock).toHaveBeenCalledWith('bow');
    });

    it('should handle null engine or empty emotion gracefully', async () => {
      await expect(
        defaultGesture3D(null as unknown as SkinEngine, 'wave')
      ).resolves.toBeUndefined();
      await expect(
        defaultGesture3D({} as unknown as SkinEngine, '')
      ).resolves.toBeUndefined();
    });
  });

  describe('gesture property dynamic routing & gestureName event pipeline', () => {
    it('should route gesture getter to gesture2D in 2D mode and gesture3D in 3D mode', async () => {
      const gesture2DMock = vi.fn();
      const gesture3DMock = vi.fn();

      const engine = initSkinEngine({
        stageEl,
        startMode: ENGINE_MODE_MAP.twoDimensional,
        gesture2D: gesture2DMock,
        gesture3D: gesture3DMock
      }) as SkinEngine & {
        _engineMode: string | null;
        gesture: ((emotion: string) => void) | null;
      };

      expect(engine.engineMode).toBe(ENGINE_MODE_MAP.twoDimensional);
      expect(typeof engine.gesture).toBe('function');
      engine.gesture?.('happy');
      expect(gesture2DMock).toHaveBeenCalledWith(engine, 'happy');

      engine._engineMode = ENGINE_MODE_MAP.threeDimensional;
      expect(typeof engine.gesture).toBe('function');
      engine.gesture?.('wave');
      expect(gesture3DMock).toHaveBeenCalledWith(engine, 'wave');
    });

    it('should trigger onGesture, execute gesture function, and trigger onGestureEnd upon setting gestureName', async () => {
      const onGesture = vi.fn();
      const onGestureEnd = vi.fn();
      const gesture2DMock = vi.fn().mockResolvedValue(undefined);

      const engine: SkinEngine = initSkinEngine({
        stageEl,
        startMode: ENGINE_MODE_MAP.twoDimensional,
        gesture2D: gesture2DMock,
        onGesture,
        onGestureEnd
      }) as SkinEngine;

      engine.gestureName = 'happy';

      // 等待非同步手勢管線完成
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(engine.emo.name).toBe('happy');
      expect(onGesture).toHaveBeenCalledWith('happy', engine);
      expect(gesture2DMock).toHaveBeenCalledWith(engine, 'happy');
      expect(onGestureEnd).toHaveBeenCalledWith('happy', engine);
    });

    it('should trigger onGestureError when gesture execution fails', async () => {
      const onGestureError = vi.fn();
      const onGestureEnd = vi.fn();
      const gestureError = new Error('Gesture animation failed');
      const gesture2DMock = vi.fn().mockRejectedValue(gestureError);

      const engine: SkinEngine = initSkinEngine({
        stageEl,
        startMode: ENGINE_MODE_MAP.twoDimensional,
        gesture2D: gesture2DMock,
        onGestureError,
        onGestureEnd
      }) as SkinEngine;

      engine.gestureName = 'surprised';

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onGestureError).toHaveBeenCalledWith(
        gestureError,
        'surprised',
        engine
      );
      expect(onGestureEnd).toHaveBeenCalledWith('surprised', engine);
    });

    it('should handle unassigned gesture2D and gesture3D warning fallbacks and null engineMode', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const engine = initSkinEngine({ stageEl }) as unknown as SkinEngine & {
        gesture2D: ((emotion: string) => unknown) | null;
        gesture3D: ((emotion: string) => unknown) | null;
        _engineMode: string | null;
        gesture: ((emotion: string) => unknown) | null;
        gestureName: string | null;
      };
      engine.gesture2D = null;
      engine.gesture3D = null;

      // calling unassigned gesture getters
      const g2 = (engine.gesture2D as ((emotion: string) => unknown) | null)?.(
        'smile'
      );
      expect(warnSpy).toHaveBeenCalledWith(
        '2D hand movement function is not registered'
      );
      if (typeof g2 === 'function') {
        g2();
        expect(warnSpy).toHaveBeenCalledWith('gesture2D is not registered');
      }

      const g3 = (engine.gesture3D as ((emotion: string) => unknown) | null)?.(
        'wave'
      );
      expect(warnSpy).toHaveBeenCalledWith(
        '3D hand movement function is not registered'
      );
      if (typeof g3 === 'function') {
        g3();
        expect(warnSpy).toHaveBeenCalledWith('gesture3D is not registered');
      }

      // null engineMode
      engine._engineMode = null;
      expect(engine.gesture).toBeNull();

      // invalid gestureName
      engine.gestureName = '';
      engine.gestureName = null as unknown as string;

      warnSpy.mockRestore();
    });
  });
});
