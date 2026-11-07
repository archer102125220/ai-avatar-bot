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

      await defaultGesture3D(skinEngine, 'goodbye');
      expect(playGestureMock).toHaveBeenCalledWith('goodbye');

      await defaultGesture3D(skinEngine, 'bow');
      expect(playGestureMock).toHaveBeenCalledWith('bow');
    });

    it('should handle null engine or empty emotion gracefully', async () => {
      await expect(
        defaultGesture3D(null as unknown as SkinEngine, 'goodbye')
      ).resolves.toBeUndefined();
      await expect(
        defaultGesture3D({} as unknown as SkinEngine, '')
      ).resolves.toBeUndefined();
    });
  });

  describe('gesture property dynamic routing & gestureName event pipeline', () => {
    it('should route gesture execution via unified gesture handler', async () => {
      const unifiedGestureMock = vi.fn();

      const engine = initSkinEngine({
        stageEl,
        startMode: ENGINE_MODE_MAP.twoDimensional,
        gesture: unifiedGestureMock
      }) as SkinEngine;

      expect(engine.engineMode).toBe(ENGINE_MODE_MAP.twoDimensional);
      await engine.playGesture?.('happy');
      expect(unifiedGestureMock).toHaveBeenCalledWith(
        engine,
        'happy',
        expect.objectContaining({ mode: '2d' })
      );
    });

    it('should trigger onGesture, execute gesture function, and trigger onGestureEnd upon setting gestureName', async () => {
      const onGesture = vi.fn();
      const onGestureEnd = vi.fn();
      const unifiedGestureMock = vi.fn().mockResolvedValue(undefined);

      const engine: SkinEngine = initSkinEngine({
        stageEl,
        startMode: ENGINE_MODE_MAP.twoDimensional,
        gesture: unifiedGestureMock,
        onGesture,
        onGestureEnd
      }) as SkinEngine;

      engine.gestureName = 'happy';

      // 等待非同步手勢管線完成
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onGesture).toHaveBeenCalledWith('happy', engine);
      expect(unifiedGestureMock).toHaveBeenCalledWith(
        engine,
        'happy',
        expect.anything()
      );
      expect(onGestureEnd).toHaveBeenCalledWith('happy', engine);
    });

    it('should trigger onGestureError when gesture execution fails', async () => {
      const onGestureError = vi.fn();
      const onGestureEnd = vi.fn();
      const gestureError = new Error('Gesture animation failed');
      const unifiedGestureMock = vi.fn().mockRejectedValue(gestureError);

      const engine: SkinEngine = initSkinEngine({
        stageEl,
        startMode: ENGINE_MODE_MAP.twoDimensional,
        gesture: unifiedGestureMock,
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

    it('should ignore invalid gestureName setter', () => {
      const engine = initSkinEngine({ stageEl }) as unknown as SkinEngine & {
        _engineMode: string | null;
        gestureName: string | null;
      };

      const initialGesture = engine.gestureName;
      engine.gestureName = '';
      expect(engine.gestureName).toBe(initialGesture);
      engine.gestureName = null as unknown as string;
      expect(engine.gestureName).toBe(initialGesture);
    });
  });
});
