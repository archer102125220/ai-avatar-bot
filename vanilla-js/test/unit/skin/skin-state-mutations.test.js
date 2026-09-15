import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initSkinEngine } from '@/core/skin';
import {
  FIT_MODE_MAP,
  GENDER_MAP,
  EMOTION_TARGET_MAP,
  DEFAULT_FEMALE_2D_MODEL_URL,
  DEFAULT_FEMALE_3D_MODEL_URL,
  DEFAULT_MALE_2D_MODEL_URL,
  DEFAULT_MALE_3D_MODEL_URL
} from '@/core/constants';


describe('Unit Test: core/skin/skin-state-mutations.js (State & Parameter Updates)', () => {
  let stageEl;

  beforeEach(() => {
    vi.useFakeTimers();
    stageEl = document.createElement('div');
    document.body.appendChild(stageEl);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('setGender', () => {
    it('should update gender state and synchronize 2D and 3D default model assets', () => {
      const engine = initSkinEngine({ stageEl, gender: GENDER_MAP.female });
      expect(engine.modelUrl).toBe(DEFAULT_FEMALE_2D_MODEL_URL);
      expect(engine.vrmUrl).toBe(DEFAULT_FEMALE_3D_MODEL_URL);

      engine.setGender(GENDER_MAP.male);
      expect(engine.getState().gender).toBe(GENDER_MAP.male);
      expect(engine.modelUrl).toBe(DEFAULT_MALE_2D_MODEL_URL);
      expect(engine.vrmUrl).toBe(DEFAULT_MALE_3D_MODEL_URL);
    });
  });

  describe('setFitMode', () => {
    it('should update fitMode in state store when valid FIT_MODE is provided', () => {
      const engine = initSkinEngine({ stageEl, fitMode: FIT_MODE_MAP.HALF });
      expect(engine.fitMode).toBe(FIT_MODE_MAP.HALF);

      engine.setFitMode(FIT_MODE_MAP.FULL);
      expect(engine.getState().fitMode).toBe(FIT_MODE_MAP.FULL);
      expect(engine.fitMode).toBe(FIT_MODE_MAP.FULL);

      // 無效模式應被忽略
      engine.setFitMode('invalid-mode');
      expect(engine.getState().fitMode).toBe(FIT_MODE_MAP.FULL);
    });
  });

  describe('setSkin2d', () => {
    it('should deeply merge partial 2D configuration including mode overrides', () => {
      const engine = initSkinEngine({
        stageEl,
        skin2d: { zoom: 1.5, offsetX: 10 }
      });

      engine.setSkin2d({
        offsetY: 25,
        anchor: { x: 0.5, y: 0.8 },
        half: { zoom: 2.2 }
      });

      const updated = engine.skin2d;
      expect(updated.zoom).toBe(1.5);
      expect(updated.offsetX).toBe(10);
      expect(updated.offsetY).toBe(25);
      expect(updated.anchor).toEqual({ x: 0.5, y: 0.8 });
      expect(updated.half.zoom).toBe(2.2);
    });
  });

  describe('setSkin3d', () => {
    it('should deeply merge partial 3D camera and model spatial configurations', () => {
      const engine = initSkinEngine({ stageEl });

      engine.setSkin3d({
        camera: { fov: 35, near: 0.05 },
        model: { position: { x: 0, y: -0.5, z: 0 }, scale: 1.2 },
        pointerLook: false
      });

      const updated = engine.skin3d;
      expect(updated.camera.fov).toBe(35);
      expect(updated.camera.near).toBe(0.05);
      expect(updated.model.position).toEqual({ x: 0, y: -0.5, z: 0 });
      expect(updated.model.scale).toBe(1.2);
      expect(updated.pointerLook).toBe(false);
    });
  });

  describe('setEmotion & setIsSpeaking (Auto-restore Lifecycle)', () => {
    it('should set emotion, trigger target weight, and auto-restore to neutral after 3 seconds if not speaking', () => {
      const engine = initSkinEngine({ stageEl });
      expect(engine.getState().emotion).toBe('neutral');

      engine.setEmotion('happy');
      expect(engine.getState().emotion).toBe('happy');
      expect(engine.emo.name).toBe('happy');
      expect(engine.emo.target).toBe(EMOTION_TARGET_MAP.happy);

      // 前進 2.9 秒：仍為 happy
      vi.advanceTimersByTime(2900);
      expect(engine.getState().emotion).toBe('happy');

      // 前進至 3.0 秒：自動恢復 neutral
      vi.advanceTimersByTime(200);
      expect(engine.getState().emotion).toBe('neutral');
    });

    it('should maintain emotion while speaking and restore immediately when speaking ends', () => {
      const engine = initSkinEngine({ stageEl });

      engine.setIsSpeaking(true);
      engine.setEmotion('surprised');

      // 說話中超過 3 秒不應被自動恢復中性
      vi.advanceTimersByTime(4000);
      expect(engine.getState().emotion).toBe('surprised');

      // 說話結束立即復原
      engine.setIsSpeaking(false);
      expect(engine.getState().emotion).toBe('neutral');
    });
  });

  describe('computeMouth and Property Setters', () => {
    it('should bind custom computeMouth function and evaluate amplitude', async () => {
      const computeMouthMock = vi.fn().mockReturnValue(0.75);
      const engine = initSkinEngine({
        stageEl,
        computeMouth: computeMouthMock
      });

      const val = await engine.computeMouth(engine);
      expect(val).toBe(0.75);
      expect(computeMouthMock).toHaveBeenCalledWith(engine);
    });

    it('should handle switching, lipIds, startMode, fitMode setters and edge branches', () => {
      const engine = initSkinEngine({ stageEl });

      expect(typeof engine.switching).toBe('boolean');
      engine.switching = true;
      expect(engine.switching).toBe(true);
      engine.switching = false;
      expect(engine.switching).toBe(false);
      engine.switching = 'invalid';
      expect(engine.switching).toBe(false);

      expect(engine.lipIds).toEqual(['ParamMouthOpenY']);
      engine.lipIds = ['ParamA', 'ParamI'];
      expect(engine.lipIds).toEqual(['ParamA', 'ParamI']);
      engine.lipIds = null;
      expect(engine.lipIds).toBeNull();

      expect(engine.startMode).toBe('2d');
      engine.startMode = '3d';
      expect(engine.startMode).toBe('3d');
      engine.startMode = '';
      expect(engine.startMode).toBe('3d');

      engine.fitMode = FIT_MODE_MAP.HALF;
      expect(engine.fitMode).toBe(FIT_MODE_MAP.HALF);
      engine.fitMode = 'unknown_fit';
      expect(engine.fitMode).toBe(FIT_MODE_MAP.FULL); // DEFAULT_FIT_MODE is full
    });

    it('should invoke VRMFileChangeFail, VRMFileChangeSuccess and handle emo.name branch conditions', () => {
      const VRMFileChangeFail = vi.fn();
      const VRMFileChangeSuccess = vi.fn();

      const engine = initSkinEngine({
        stageEl,
        VRMFileChangeFail,
        VRMFileChangeSuccess
      });

      const mockError = new Error('VRM file invalid');
      engine.VRMFileChangeFail(mockError);
      expect(VRMFileChangeFail).toHaveBeenCalledWith(mockError);

      engine.VRMFileChangeSuccess('blob:http://localhost/new_vrm');
      expect(VRMFileChangeSuccess).toHaveBeenCalledWith('blob:http://localhost/new_vrm');

      // Test emo.name branches
      expect(engine.emo.name).toBe('neutral');
      // 1. same name
      engine.emo.name = 'neutral';
      expect(engine.emo.target).toBe(0);

      // 2. valid target emotion
      engine.emo.name = 'happy';
      expect(engine.emo.name).toBe('happy');
      expect(engine.emo.target).toBe(EMOTION_TARGET_MAP.happy);

      // 3. invalid emotion name (not in map and not neutral)
      engine.emo.name = 'non_existent_emo';
      expect(engine.emo.name).toBe('happy');

      // 4. reset back to neutral
      engine.emo.name = 'neutral';
      expect(engine.emo.name).toBe('neutral');
      expect(engine.emo.target).toBe(0);
    });
  });
});
