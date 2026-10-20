import { describe, it, expect } from 'vitest';
import {
  resolveCascadeValue,
  resolve2DMotion,
  resolve2DExpression,
  normalize3DActionItem,
  resolve3DAction,
  resolve3DActionPool,
  resolveAll3DPools
} from '@/core/skin/resolver';
import { DEFAULT_VRMA_ROOT_PATH, DEFAULT_3D_POOLS } from '@/core/constants';

describe('Skin Cascade & Fallback Resolver', () => {
  describe('resolveCascadeValue', () => {
    it('should return undefined if cascade is empty or invalid', () => {
      expect(resolveCascadeValue(undefined, 'female', 'tap')).toBeUndefined();
      expect(resolveCascadeValue(null, 'male', 'tap')).toBeUndefined();
      expect(resolveCascadeValue({}, 'female', '')).toBeUndefined();
    });

    it('should resolve gender-specific override with priority over base dictionary', () => {
      const cascade = {
        wave: 'common_wave',
        female: { wave: 'cute_wave' },
        male: { wave: 'cool_wave' }
      };

      expect(resolveCascadeValue(cascade, 'female', 'wave')).toBe('cute_wave');
      expect(resolveCascadeValue(cascade, 'male', 'wave')).toBe('cool_wave');
      expect(resolveCascadeValue(cascade, undefined, 'wave')).toBe('common_wave');
    });

    it('should fall back to base dictionary if gender override does not contain the key', () => {
      const cascade = {
        tap: 'base_tap',
        female: { dance: 'girl_dance' }
      };

      expect(resolveCascadeValue(cascade, 'female', 'tap')).toBe('base_tap');
      expect(resolveCascadeValue(cascade, 'male', 'tap')).toBe('base_tap');
    });

    it('should match keys case-insensitively', () => {
      const cascade = {
        greetingMotion: 'base_greeting',
        female: { specialPose: 'girl_pose' }
      };

      expect(resolveCascadeValue(cascade, 'female', 'SPECIALPOSE')).toBe('girl_pose');
      expect(resolveCascadeValue(cascade, 'male', 'GREETINGMOTION')).toBe('base_greeting');
    });
  });

  describe('resolve2DMotion', () => {
    it('should normalize string motion item with pointerLook default to true', () => {
      const motionMap = {
        tap: 'TapMotion'
      };

      const result = resolve2DMotion(motionMap, 'female', 'tap');
      expect(result).toEqual({
        motion: 'TapMotion',
        pointerLook: true
      });
    });

    it('should resolve option object motion item respecting pointerLook false', () => {
      const motionMap = {
        shy: { motion: 'ShyTurnAway', pointerLook: false },
        happy: { motion: 'HappyJump', pointerLook: true }
      };

      expect(resolve2DMotion(motionMap, 'female', 'shy')).toEqual({
        motion: 'ShyTurnAway',
        pointerLook: false
      });
      expect(resolve2DMotion(motionMap, 'female', 'happy')).toEqual({
        motion: 'HappyJump',
        pointerLook: true
      });
    });

    it('should support gender-specific motion overrides with pointerLook', () => {
      const motionMap = {
        greeting: 'CommonGreeting',
        female: { greeting: { motion: 'FemaleBow', pointerLook: false } },
        male: { greeting: 'MaleSalute' }
      };

      expect(resolve2DMotion(motionMap, 'female', 'greeting')).toEqual({
        motion: 'FemaleBow',
        pointerLook: false
      });
      expect(resolve2DMotion(motionMap, 'male', 'greeting')).toEqual({
        motion: 'MaleSalute',
        pointerLook: true
      });
    });

    it('should return undefined when key is not found', () => {
      expect(resolve2DMotion({}, 'female', 'nonexistent')).toBeUndefined();
    });
  });

  describe('resolve2DExpression', () => {
    it('should resolve expression respecting gender overrides', () => {
      const expressionMap = {
        smile: 'base_smile',
        female: { smile: 'cute_smile' },
        male: { smile: 'cool_smile' }
      };

      expect(resolve2DExpression(expressionMap, 'female', 'smile')).toBe('cute_smile');
      expect(resolve2DExpression(expressionMap, 'male', 'smile')).toBe('cool_smile');
      expect(resolve2DExpression(expressionMap, undefined, 'smile')).toBe('base_smile');
    });

    it('should return undefined when expression is not found or empty', () => {
      expect(resolve2DExpression({}, 'female', 'angry')).toBeUndefined();
      expect(resolve2DExpression({ empty: '' }, 'female', 'empty')).toBeUndefined();
    });
  });

  describe('normalize3DActionItem', () => {
    it('should normalize string item with pointerLook: true', () => {
      expect(normalize3DActionItem('idle-1')).toEqual({
        name: 'idle-1',
        pointerLook: true
      });
    });

    it('should preserve option object properties', () => {
      const option = {
        name: 'idle-female-1' as const,
        url: 'https://cdn.example.com/custom.vrma',
        pointerLook: false
      };
      expect(normalize3DActionItem(option)).toEqual(option);
    });
  });

  describe('resolve3DAction', () => {
    it('should resolve standard action from DEFAULT_3D_GESTURE_MAP', () => {
      const action = resolve3DAction('idle-1');
      expect(action).toEqual({
        name: 'idle-1',
        url: `${DEFAULT_VRMA_ROOT_PATH}common/idle-1.vrma`,
        pointerLook: true
      });

      const bowAction = resolve3DAction('bow');
      expect(bowAction).toEqual({
        name: 'bow',
        url: `${DEFAULT_VRMA_ROOT_PATH}common/bow.vrma`,
        pointerLook: false
      });

      const nailAction = resolve3DAction('idle-female-1');
      expect(nailAction).toEqual({
        name: 'idle-female-1',
        url: `${DEFAULT_VRMA_ROOT_PATH}female/idle-female-1.vrma`,
        pointerLook: false
      });
    });

    it('should respect custom vrmaRootPath', () => {
      const action = resolve3DAction('idle-1', {
        vrmaRootPath: 'https://assets.my-avatar.com/vrma/'
      });
      expect(action.url).toBe('https://assets.my-avatar.com/vrma/common/idle-1.vrma');
    });

    it('should allow user custom gestures cascade override', () => {
      const action = resolve3DAction('bow', {
        gestures: {
          bow: { url: 'https://custom.com/my-bow.vrma', pointerLook: true }
        }
      });
      expect(action).toEqual({
        name: 'bow',
        url: 'https://custom.com/my-bow.vrma',
        pointerLook: true
      });
    });

    it('should allow user gender-specific gestures override', () => {
      const action = resolve3DAction('salute', {
        gender: 'female',
        gestures: {
          salute: 'common_salute.vrma',
          female: { salute: { url: 'girl_salute.vrma', pointerLook: false } }
        }
      });
      expect(action).toEqual({
        name: 'salute',
        url: 'girl_salute.vrma',
        pointerLook: false
      });
    });

    it('should allow top-level property override (e.g. config.bow, config.waiting)', () => {
      const bowAction = resolve3DAction('bow', {
        topLevelOverrides: {
          bow: 'https://cdn.com/top-bow.vrma'
        }
      });
      expect(bowAction.url).toBe('https://cdn.com/top-bow.vrma');

      const waitingAction = resolve3DAction('waiting', {
        gender: 'female',
        topLevelOverrides: {
          waiting: { female: 'girl_waiting.vrma', male: 'boy_waiting.vrma' }
        }
      });
      expect(waitingAction.url).toBe('girl_waiting.vrma');
    });

    it('should fallback to common/{key}.vrma for unknown custom keys', () => {
      const custom = resolve3DAction('my-dance');
      expect(custom).toEqual({
        name: 'my-dance',
        url: `${DEFAULT_VRMA_ROOT_PATH}common/my-dance.vrma`,
        pointerLook: true
      });
    });
  });

  describe('resolve3DActionPool', () => {
    it('should resolve default pool if userPool is empty or undefined', () => {
      const pool = resolve3DActionPool(undefined, DEFAULT_3D_POOLS.idlePool);
      expect(pool).toHaveLength(DEFAULT_3D_POOLS.idlePool.length);
      expect(pool[0].name).toBe('idle-1');
      expect(pool[1].name).toBe('idle-2');
    });

    it('should resolve custom pool with mixed strings and option objects', () => {
      const userPool = [
        'idle-1',
        { name: 'idle-female-1' as const, pointerLook: false },
        { name: 'custom-stretch', url: 'https://cdn.com/stretch.vrma' }
      ];

      const pool = resolve3DActionPool(userPool, DEFAULT_3D_POOLS.idlePool);
      expect(pool).toHaveLength(3);
      expect(pool[0]).toEqual({
        name: 'idle-1',
        url: `${DEFAULT_VRMA_ROOT_PATH}common/idle-1.vrma`,
        pointerLook: true
      });
      expect(pool[1]).toEqual({
        name: 'idle-female-1',
        url: `${DEFAULT_VRMA_ROOT_PATH}female/idle-female-1.vrma`,
        pointerLook: false
      });
      expect(pool[2]).toEqual({
        name: 'custom-stretch',
        url: 'https://cdn.com/stretch.vrma',
        pointerLook: true
      });
    });
  });

  describe('resolveAll3DPools', () => {
    it('should resolve full default 3D action pools for female avatar', () => {
      const pools = resolveAll3DPools({}, 'female');

      expect(pools.idlePool.map((a) => a.name)).toEqual(['idle-1', 'idle-2']);
      expect(pools.talkingPool.map((a) => a.name)).toEqual([
        'talking-1',
        'talking-2',
        'talking-3',
        'talking-4'
      ]);
      expect(pools.idleVariants.map((a) => a.name)).toEqual([
        'idle-female-1',
        'idle-female-2'
      ]);
      expect(pools.greeting.name).toBe('standing-greeting');
      expect(pools.tapGestures.map((a) => a.name)).toEqual([
        'goodbye',
        'bow',
        'waiting'
      ]);
    });

    it('should resolve full default 3D action pools for male avatar', () => {
      const pools = resolveAll3DPools({}, 'male');

      expect(pools.idleVariants.map((a) => a.name)).toEqual([
        'idle-male-1',
        'idle-male-2'
      ]);
      expect(pools.greeting.name).toBe('salute');
    });

    it('should seamlessly incorporate partial user overrides', () => {
      const config = {
        talkingPool: ['talking-1', { name: 'talking-2' as const, pointerLook: false }],
        greetings: {
          female: { name: 'standing-greeting' as const, pointerLook: false }
        }
      };

      const femalePools = resolveAll3DPools(config, 'female');
      expect(femalePools.talkingPool).toHaveLength(2);
      expect(femalePools.talkingPool[1].pointerLook).toBe(false);
      expect(femalePools.greeting.pointerLook).toBe(false);
      // idlePool was omitted, should safely fall back to default
      expect(femalePools.idlePool).toHaveLength(2);
    });

    it('should correctly resolve default greetings when configured as option objects', () => {
      const femalePools = resolveAll3DPools({}, 'female');
      expect(femalePools.greeting.name).toBe('standing-greeting');
      expect(typeof femalePools.greeting.pointerLook).toBe('boolean');

      const malePools = resolveAll3DPools({}, 'male');
      expect(malePools.greeting.name).toBe('salute');
      expect(typeof malePools.greeting.pointerLook).toBe('boolean');
    });
  });
});
