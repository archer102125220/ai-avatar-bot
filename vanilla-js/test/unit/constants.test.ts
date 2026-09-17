import { describe, it, expect } from 'vitest';
import {
  STATE_MAP,
  AVATAR_MODE_MAP,
  DEFAULT_AVATAR_MODE,
  COMPRESSION_STRATEGY_MAP,
  DEFAULT_COMPRESSION_STRATEGY,
  EMOTION_TARGET_MAP,
  EMO_TARGET_MAP,
  ENGINE_MODE_MAP,
  DEFAULT_START_MODE,
  FIT_MODE_MAP,
  DEFAULT_FIT_MODE,
  DEFAULT_2D_HALF_ZOOM,
  DEFAULT_2D_FULL_ZOOM,
  DEFAULT_2D_OFFSET_X,
  DEFAULT_2D_OFFSET_Y,
  DEFAULT_2D_HALF_ANCHOR,
  DEFAULT_2D_FULL_ANCHOR,
  DEFAULT_3D_HALF_CAMERA_FOV,
  DEFAULT_3D_FULL_CAMERA_FOV,
  DEFAULT_3D_CAMERA_NEAR,
  DEFAULT_3D_CAMERA_FAR,
  DEFAULT_3D_HALF_CAMERA_POSITION,
  DEFAULT_3D_FULL_CAMERA_POSITION,
  DEFAULT_3D_HALF_CAMERA_LOOK_AT,
  DEFAULT_3D_FULL_CAMERA_LOOK_AT,
  DEFAULT_3D_MODEL_POSITION,
  DEFAULT_3D_MODEL_SCALE,
  DEFAULT_3D_MODEL_ROTATION,
  GENDER_MAP,
  DEFAULT_GENDER,
  DEFAULT_FEMALE_2D_MODEL_URL,
  DEFAULT_MALE_2D_MODEL_URL,
  DEFAULT_2D_MODEL_URL,
  DEFAULT_FEMALE_3D_MODEL_URL,
  DEFAULT_MALE_3D_MODEL_URL,
  DEFAULT_3D_MODEL_URL,
  DEFAULT_VRM_URL,
  DEFAULT_MODEL_URL,
  DEFAULT_FEMALE_NEURAL_VOICE,
  DEFAULT_MALE_NEURAL_VOICE,
  DEFAULT_NEURAL_VOICE,
  getDefaultNeuralVoice,
  getDefault2DModelUrl,
  getDefault3DModelUrl,
  getDefaultModelUrl,
  getDefault2DConfig,
  getDefault3DCameraConfig,
  TOOL_ROUTING_MODE_MAP,
  DEFAULT_TOOL_ROUTING_MODE,
  TOOL_RESULT_MODE_MAP,
  DEFAULT_TOOL_RESULT_MODE,
  DEFAULT_TOOL_CONFIRMATION_TIMEOUT_MS,
  TOOL_CANCEL_REASON_MAP,
  isWebLLMFunctionCallingSupported
} from '@/core/constants';

describe('Unit Test: core/constants.js (TypeScript)', () => {
  describe('Enums and Maps Integrity', () => {
    it('should have correct STATE_MAP values', () => {
      expect(STATE_MAP).toEqual({
        IDLE: 'idle',
        LOADING: 'loading',
        READY: 'ready',
        ERROR: 'error'
      });
    });

    it('should have correct AVATAR_MODE_MAP values', () => {
      expect(AVATAR_MODE_MAP).toEqual({
        companion: 'companion',
        assistant: 'assistant'
      });
      expect(DEFAULT_AVATAR_MODE).toBe(AVATAR_MODE_MAP.assistant);
    });

    it('should have correct COMPRESSION_STRATEGY_MAP values', () => {
      expect(COMPRESSION_STRATEGY_MAP).toEqual({
        SLIDING_WINDOW: 'sliding-window',
        ROLLING_SUMMARY: 'rolling-summary',
        NONE: 'none'
      });
      expect(DEFAULT_COMPRESSION_STRATEGY).toBe(
        COMPRESSION_STRATEGY_MAP.SLIDING_WINDOW
      );
    });

    it('should have correct ENGINE_MODE_MAP values', () => {
      expect(ENGINE_MODE_MAP).toEqual({
        twoDimensional: '2d',
        threeDimensional: '3d'
      });
      expect(DEFAULT_START_MODE).toBe(ENGINE_MODE_MAP.twoDimensional);
    });

    it('should have correct FIT_MODE_MAP values', () => {
      expect(FIT_MODE_MAP).toEqual({
        HALF: 'half',
        FULL: 'full'
      });
      expect(DEFAULT_FIT_MODE).toBe(FIT_MODE_MAP.FULL);
    });

    it('should have correct GENDER_MAP values', () => {
      expect(GENDER_MAP).toEqual({
        female: 'female',
        male: 'male'
      });
      expect(DEFAULT_GENDER).toBe(GENDER_MAP.female);
    });

    it('should have correct EMOTION_TARGET_MAP values', () => {
      expect(EMOTION_TARGET_MAP).toEqual({
        happy: 0.65,
        surprised: 0.6,
        sad: 0.5
      });
      expect(EMO_TARGET_MAP).toBe(EMOTION_TARGET_MAP);
    });

    it('should have correct TOOL maps', () => {
      expect(TOOL_ROUTING_MODE_MAP).toEqual({
        CLIENT: 'client',
        AI: 'ai',
        HYBRID: 'hybrid'
      });
      expect(DEFAULT_TOOL_ROUTING_MODE).toBe(TOOL_ROUTING_MODE_MAP.HYBRID);

      expect(TOOL_RESULT_MODE_MAP).toEqual({
        AI_SUMMARY: 'ai_summary',
        DIRECT: 'direct'
      });
      expect(DEFAULT_TOOL_RESULT_MODE).toBe(TOOL_RESULT_MODE_MAP.AI_SUMMARY);

      expect(TOOL_CANCEL_REASON_MAP).toEqual({
        USER_CANCEL: 'user_cancel',
        TIMEOUT: 'timeout',
        NEW_INPUT: 'new_input',
        CONSENT_DECLINED: 'consent_declined'
      });
      expect(DEFAULT_TOOL_CONFIRMATION_TIMEOUT_MS).toBe(60000);
    });
  });

  describe('Frozen Objects and Immutability', () => {
    it('should freeze anchor and 3D transform constants', () => {
      expect(Object.isFrozen(DEFAULT_2D_HALF_ANCHOR)).toBe(true);
      expect(Object.isFrozen(DEFAULT_2D_FULL_ANCHOR)).toBe(true);
      expect(Object.isFrozen(DEFAULT_3D_HALF_CAMERA_POSITION)).toBe(true);
      expect(Object.isFrozen(DEFAULT_3D_FULL_CAMERA_POSITION)).toBe(true);
      expect(Object.isFrozen(DEFAULT_3D_HALF_CAMERA_LOOK_AT)).toBe(true);
      expect(Object.isFrozen(DEFAULT_3D_FULL_CAMERA_LOOK_AT)).toBe(true);
      expect(Object.isFrozen(DEFAULT_3D_MODEL_POSITION)).toBe(true);
      expect(Object.isFrozen(DEFAULT_3D_MODEL_SCALE)).toBe(true);
      expect(Object.isFrozen(DEFAULT_3D_MODEL_ROTATION)).toBe(true);
    });
  });

  describe('Helper Functions for Resolution', () => {
    it('getDefaultNeuralVoice should return voice based on gender', () => {
      expect(getDefaultNeuralVoice('female')).toBe(DEFAULT_FEMALE_NEURAL_VOICE);
      expect(getDefaultNeuralVoice('male')).toBe(DEFAULT_MALE_NEURAL_VOICE);
      expect(getDefaultNeuralVoice()).toBe(DEFAULT_NEURAL_VOICE);
    });

    it('getDefault2DModelUrl should return 2D model URL based on gender', () => {
      expect(getDefault2DModelUrl('female')).toBe(DEFAULT_FEMALE_2D_MODEL_URL);
      expect(getDefault2DModelUrl('male')).toBe(DEFAULT_MALE_2D_MODEL_URL);
      expect(getDefault2DModelUrl()).toBe(DEFAULT_2D_MODEL_URL);
    });

    it('getDefault3DModelUrl should return 3D model URL based on gender', () => {
      expect(getDefault3DModelUrl('female')).toBe(DEFAULT_FEMALE_3D_MODEL_URL);
      expect(getDefault3DModelUrl('male')).toBe(DEFAULT_MALE_3D_MODEL_URL);
      expect(getDefault3DModelUrl()).toBe(DEFAULT_3D_MODEL_URL);
      expect(DEFAULT_VRM_URL).toBe(DEFAULT_3D_MODEL_URL);
    });

    it('getDefaultModelUrl should return URL based on gender and engineMode', () => {
      expect(
        getDefaultModelUrl('female', ENGINE_MODE_MAP.twoDimensional)
      ).toBe(DEFAULT_FEMALE_2D_MODEL_URL);
      expect(
        getDefaultModelUrl('male', ENGINE_MODE_MAP.twoDimensional)
      ).toBe(DEFAULT_MALE_2D_MODEL_URL);
      expect(
        getDefaultModelUrl('female', ENGINE_MODE_MAP.threeDimensional)
      ).toBe(DEFAULT_FEMALE_3D_MODEL_URL);
      expect(
        getDefaultModelUrl('male', ENGINE_MODE_MAP.threeDimensional)
      ).toBe(DEFAULT_MALE_3D_MODEL_URL);
      expect(getDefaultModelUrl()).toBe(DEFAULT_MODEL_URL);
    });

    it('getDefault2DConfig should return correct zoom and anchor based on fitMode', () => {
      const halfConfig = getDefault2DConfig(FIT_MODE_MAP.HALF);
      expect(halfConfig.zoom).toBe(DEFAULT_2D_HALF_ZOOM);
      expect(halfConfig.anchor).toEqual(DEFAULT_2D_HALF_ANCHOR);
      expect(halfConfig.offsetX).toBe(DEFAULT_2D_OFFSET_X);
      expect(halfConfig.offsetY).toBe(DEFAULT_2D_OFFSET_Y);

      const fullConfig = getDefault2DConfig(FIT_MODE_MAP.FULL);
      expect(fullConfig.zoom).toBe(DEFAULT_2D_FULL_ZOOM);
      expect(fullConfig.anchor).toEqual(DEFAULT_2D_FULL_ANCHOR);
    });

    it('getDefault3DCameraConfig should return correct camera settings based on fitMode', () => {
      const halfCamera = getDefault3DCameraConfig(FIT_MODE_MAP.HALF);
      expect(halfCamera.fov).toBe(DEFAULT_3D_HALF_CAMERA_FOV);
      expect(halfCamera.position).toEqual(DEFAULT_3D_HALF_CAMERA_POSITION);
      expect(halfCamera.lookAt).toEqual(DEFAULT_3D_HALF_CAMERA_LOOK_AT);
      expect(halfCamera.near).toBe(DEFAULT_3D_CAMERA_NEAR);
      expect(halfCamera.far).toBe(DEFAULT_3D_CAMERA_FAR);

      const fullCamera = getDefault3DCameraConfig(FIT_MODE_MAP.FULL);
      expect(fullCamera.fov).toBe(DEFAULT_3D_FULL_CAMERA_FOV);
      expect(fullCamera.position).toEqual(DEFAULT_3D_FULL_CAMERA_POSITION);
      expect(fullCamera.lookAt).toEqual(DEFAULT_3D_FULL_CAMERA_LOOK_AT);
    });

    it('isWebLLMFunctionCallingSupported should return true for hermes models and false otherwise', () => {
      expect(
        isWebLLMFunctionCallingSupported('Hermes-2-Pro-Llama-3-8B-q4f16_1-MLC')
      ).toBe(true);
      expect(
        isWebLLMFunctionCallingSupported('Nous-Hermes-2-Mistral-7B-DPO-q4f16_1-MLC')
      ).toBe(true);
      expect(
        isWebLLMFunctionCallingSupported('Qwen2.5-1.5B-Instruct-q4f16_1-MLC')
      ).toBe(false);
      expect(isWebLLMFunctionCallingSupported('')).toBe(false);
      // @ts-ignore: Defensive runtime type checking test for null input
      expect(isWebLLMFunctionCallingSupported(null)).toBe(false);
    });
  });
});
