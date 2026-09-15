import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  initSkinEngine,
  defaultGesture2D,
  defaultGesture3D
} from '../../../core/skin';
import { ENGINE_MODE_MAP, GENDER_MAP } from '../../../core/constants';

describe('Unit Test: core/skin/gesture-dispatch.js (Gesture Routing & Event Flow)', () => {
  let stageEl;

  beforeEach(() => {
    stageEl = document.createElement('div');
    document.body.appendChild(stageEl);
  });

  describe('defaultGesture2D', () => {
    it('should map female expressions and trigger avatarModel.expression', async () => {
      const expressionMock = vi.fn().mockResolvedValue();
      const skinEngine = {
        gender: GENDER_MAP.female,
        avatarModel: { expression: expressionMock }
      };

      await defaultGesture2D(skinEngine, 'happy');
      expect(expressionMock).toHaveBeenCalledWith('f04');

      await defaultGesture2D(skinEngine, 'sad');
      expect(expressionMock).toHaveBeenCalledWith('f03');
    });

    it('should map male expressions and trigger avatarModel.expression', async () => {
      const expressionMock = vi.fn().mockResolvedValue();
      const skinEngine = {
        gender: GENDER_MAP.male,
        avatarModel: { expression: expressionMock }
      };

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
      };

      await defaultGesture3D(skinEngine, 'wave');
      expect(playGestureMock).toHaveBeenCalledWith('wave');

      await defaultGesture3D(skinEngine, 'bow');
      expect(playGestureMock).toHaveBeenCalledWith('bow');
    });

    it('should handle null engine or empty emotion gracefully', async () => {
      await expect(defaultGesture3D(null, 'wave')).resolves.toBeUndefined();
      await expect(defaultGesture3D({}, '')).resolves.toBeUndefined();
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
      });

      expect(engine.engineMode).toBe(ENGINE_MODE_MAP.twoDimensional);
      expect(typeof engine.gesture).toBe('function');
      engine.gesture('happy');
      expect(gesture2DMock).toHaveBeenCalledWith(engine, 'happy');

      engine._engineMode = ENGINE_MODE_MAP.threeDimensional;
      expect(typeof engine.gesture).toBe('function');
      engine.gesture('wave');
      expect(gesture3DMock).toHaveBeenCalledWith(engine, 'wave');
    });

    it('should trigger onGesture, execute gesture function, and trigger onGestureEnd upon setting gestureName', async () => {
      const onGesture = vi.fn();
      const onGestureEnd = vi.fn();
      const gesture2DMock = vi.fn().mockResolvedValue();

      const engine = initSkinEngine({
        stageEl,
        startMode: ENGINE_MODE_MAP.twoDimensional,
        gesture2D: gesture2DMock,
        onGesture,
        onGestureEnd
      });

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

      const engine = initSkinEngine({
        stageEl,
        startMode: ENGINE_MODE_MAP.twoDimensional,
        gesture2D: gesture2DMock,
        onGestureError,
        onGestureEnd
      });

      engine.gestureName = 'surprised';

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onGestureError).toHaveBeenCalledWith(gestureError, 'surprised', engine);
      expect(onGestureEnd).toHaveBeenCalledWith('surprised', engine);
    });
  });
});
