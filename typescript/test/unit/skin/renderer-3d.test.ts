/**
 * [3D-MOTION-BENCHMARK-BASELINE]
 * 此測試為 3D 人像動作之現行基準規格（Baseline）。
 * 保留原本 Vanilla JS 的完整測試邏輯與斷言。
 * 後續若有升級或調整 3D 動作（如新增手勢或調整動畫骨骼驅動），本檔案將作為專屬對照組同步更新。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FIT_MODE_MAP, ENGINE_MODE_MAP } from '@/core/constants';
import {
  defaultGesture3D,
  bootVRM,
  loadVRMFile
} from '@/core/skin/renderer-3d';
import { GestureNotFoundError } from '@/core/skin/types';
import type { SkinEngine, Renderer3D } from '@core';

interface MockClipActionRecord {
  clip: { name?: string; tracks: Array<{ name: string }> };
  action: {
    setLoop: ReturnType<typeof vi.fn>;
    clampWhenFinished: boolean;
    reset: ReturnType<typeof vi.fn>;
    setEffectiveWeight: ReturnType<typeof vi.fn>;
    setEffectiveTimeScale: ReturnType<typeof vi.fn>;
    crossFadeTo: ReturnType<typeof vi.fn>;
    fadeIn: ReturnType<typeof vi.fn>;
    fadeOut: ReturnType<typeof vi.fn>;
    play: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  };
}

interface MockMixerTracker {
  instances: Array<{
    listeners: Record<string, (e: { action: unknown }) => void>;
  }>;
  actions: MockClipActionRecord[];
}

const mockMixerState: MockMixerTracker = vi.hoisted(() => {
  const instances: Array<{
    listeners: Record<string, (e: { action: unknown }) => void>;
  }> = [];
  const actions: MockClipActionRecord[] = [];
  return { instances, actions };
});

// Mock Three.js and VRM packages
vi.mock('three', () => {
  class MockVector3 {
    x: number;
    y: number;
    z: number;
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
    set(x: number, y: number, z: number) {
      this.x = x;
      this.y = y;
      this.z = z;
      return this;
    }
  }

  class MockEuler {
    x: number;
    y: number;
    z: number;
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
    set(x: number, y: number, z: number) {
      this.x = x;
      this.y = y;
      this.z = z;
      return this;
    }
  }

  class MockObject3D {
    position: MockVector3;
    rotation: MockEuler;
    scale: MockVector3;
    children: unknown[];
    frustumCulled: boolean;
    constructor() {
      this.position = new MockVector3();
      this.rotation = new MockEuler();
      this.scale = new MockVector3(1, 1, 1);
      this.children = [];
      this.frustumCulled = true;
    }
    add(...objs: unknown[]) {
      this.children.push(...objs);
    }
    traverse(cb: (obj: unknown) => void) {
      cb(this);
    }
  }

  class MockPerspectiveCamera extends MockObject3D {
    fov: number;
    aspect: number;
    near: number;
    far: number;
    lookAtTarget: unknown;
    constructor(fov = 50, aspect = 1, near = 0.1, far = 1000) {
      super();
      this.fov = fov;
      this.aspect = aspect;
      this.near = near;
      this.far = far;
    }
    lookAt(v: unknown) {
      this.lookAtTarget = v;
    }
    updateProjectionMatrix() {}
  }

  class MockWebGLRenderer {
    domElement: HTMLCanvasElement;
    constructor() {
      this.domElement = document.createElement('canvas');
    }
    setPixelRatio() {}
    setClearColor() {}
    setSize() {}
    render() {}
    dispose() {}
    forceContextLoss() {}
  }

  class MockClock {
    elapsedTime: number;
    constructor() {
      this.elapsedTime = 1.0;
    }
    getDelta() {
      return 0.016;
    }
  }

  class MockAnimationMixer {
    listeners: Record<string, (e: { action: unknown }) => void>;
    constructor() {
      this.listeners = {};
      mockMixerState.instances.push(this);
    }
    addEventListener(event: string, fn: (e: { action: unknown }) => void) {
      this.listeners[event] = fn;
    }
    clipAction(clip: { tracks: Array<{ name: string }> }) {
      const action = {
        setLoop: vi.fn(),
        clampWhenFinished: true,
        reset: vi.fn(),
        setEffectiveWeight: vi.fn(),
        setEffectiveTimeScale: vi.fn(),
        crossFadeTo: vi.fn(),
        fadeIn: vi.fn(),
        fadeOut: vi.fn(),
        play: vi.fn(),
        stop: vi.fn()
      };
      mockMixerState.actions.push({ clip, action });
      return action;
    }
    update() {}
    stopAllAction() {}
  }

  return {
    Vector3: MockVector3,
    Euler: MockEuler,
    Object3D: MockObject3D,
    PerspectiveCamera: MockPerspectiveCamera,
    WebGLRenderer: MockWebGLRenderer,
    Scene: MockObject3D,
    DirectionalLight: class MockLight extends MockObject3D {},
    AmbientLight: class MockAmbient extends MockObject3D {},
    Clock: MockClock,
    AnimationMixer: MockAnimationMixer,
    LoopOnce: 2200,
    LoopRepeat: 2201
  };
});

vi.mock('three/addons/loaders/GLTFLoader.js', () => {
  class GLTFLoader {
    register() {}
    load(
      url: string,
      onLoad: (gltf: unknown) => void,
      _onProgress: (p: unknown) => void,
      onError: (err: unknown) => void
    ) {
      if (url === 'error.vrm') {
        onError(new Error('Load VRM failed'));
        return;
      }
      setTimeout(() => {
        const vrmScene = {
          position: { set: vi.fn() },
          rotation: { set: vi.fn() },
          scale: { set: vi.fn() },
          traverse: (cb: (item: unknown) => void) => cb({ frustumCulled: true })
        };
        const expressionManager = {
          setValue: vi.fn(),
          getExpression: vi.fn((name: string) => ({
            overrideMouth: name === 'surprised' ? 'none' : 'block'
          }))
        };
        const humanoid = {
          getNormalizedBoneNode: vi.fn(() => ({
            rotation: { x: 0, y: 0, z: 0 }
          }))
        };
        const vrm = {
          meta: { metaVersion: '1' },
          scene: vrmScene,
          expressionManager,
          humanoid,
          lookAt: { target: null },
          update: vi.fn()
        };
        onLoad({
          scene: vrmScene,
          userData: { vrm }
        });
      }, 0);
    }
    async loadAsync(url: string) {
      if (url.includes('error')) {
        throw new Error('Animation load fail');
      }
      return {
        userData: {
          vrmAnimations: [{ name: 'anim' }]
        }
      };
    }
  }

  return { GLTFLoader };
});

vi.mock('@pixiv/three-vrm', () => {
  return {
    VRMLoaderPlugin: class VRMLoaderPlugin {},
    VRMUtils: {
      removeUnnecessaryVertices: vi.fn(),
      combineSkeletons: vi.fn(),
      combineMorphs: vi.fn(),
      rotateVRM0: vi.fn(),
      deepDispose: vi.fn()
    }
  };
});

vi.mock('@pixiv/three-vrm-animation', () => {
  return {
    VRMAnimationLoaderPlugin: class VRMAnimationLoaderPlugin {},
    createVRMAnimationClip: vi.fn(() => ({
      tracks: [
        { name: 'spine.quaternion' },
        { name: 'spine.position' },
        { name: 'head.quaternion' },
        { name: 'neck.quaternion' }
      ]
    }))
  };
});

describe('Unit Test: core/skin/renderer-3d.js', () => {
  let stageEl: HTMLElement;

  beforeEach(() => {
    stageEl = document.createElement('div');
    stageEl.id = 'stage';
    mockMixerState.instances.length = 0;
    mockMixerState.actions.length = 0;
    Object.defineProperty(stageEl, 'clientWidth', {
      value: 640,
      configurable: true
    });
    Object.defineProperty(stageEl, 'clientHeight', {
      value: 480,
      configurable: true
    });
    stageEl.getBoundingClientRect = vi.fn(() => ({
      left: 0,
      top: 0,
      width: 640,
      height: 480,
      right: 640,
      bottom: 480,
      x: 0,
      y: 0,
      toJSON: () => {}
    }));
    document.body.appendChild(stageEl);
  });

  afterEach(() => {
    stageEl.remove();
    vi.restoreAllMocks();
  });

  describe('defaultGesture3D', () => {
    it('should safely return on invalid arguments', async () => {
      await expect(
        defaultGesture3D(null as unknown as SkinEngine, 'goodbye')
      ).resolves.toBeUndefined();
      await expect(
        defaultGesture3D({} as unknown as SkinEngine, '')
      ).resolves.toBeUndefined();
      await expect(
        defaultGesture3D({} as unknown as SkinEngine, null as unknown as string)
      ).resolves.toBeUndefined();
    });

    it('should invoke renderer.playGesture and catch errors', async () => {
      const playGesture = vi.fn();
      const skinEngine = { renderer: { playGesture } } as unknown as SkinEngine;

      await defaultGesture3D(skinEngine, 'goodbye');
      expect(playGesture).toHaveBeenCalledWith('goodbye');

      playGesture.mockImplementationOnce(() => {
        throw new Error('Play gesture fail');
      });
      await expect(
        defaultGesture3D(skinEngine, 'bow')
      ).resolves.toBeUndefined();
    });
  });

  describe('loadVRMFile', () => {
    it('should log error when stageEl is not an HTMLElement', () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      loadVRMFile(
        { stageEl: null } as unknown as SkinEngine,
        new File(['dummy'], 'model.vrm')
      );
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should trigger VRMFileChangeFail when file is not a .vrm file', () => {
      const VRMFileChangeFail = vi.fn();
      const skinEngine = {
        stageEl,
        VRMFileChangeFail
      } as unknown as SkinEngine;

      loadVRMFile(skinEngine, new File(['dummy'], 'model.png'));
      expect(VRMFileChangeFail).toHaveBeenCalledWith(expect.any(Error));

      loadVRMFile(skinEngine, null as unknown as File);
      expect(VRMFileChangeFail).toHaveBeenCalledTimes(2);
    });

    it('should revoke previous blob url, create new object url and switch engine mode on valid .vrm file', () => {
      const VRMFileChangeSuccess = vi.fn();
      const revokeSpy = vi
        .spyOn(URL, 'revokeObjectURL')
        .mockImplementation(() => {});
      const createSpy = vi
        .spyOn(URL, 'createObjectURL')
        .mockReturnValue('blob:http://localhost/new-model');

      const skinEngine = {
        stageEl,
        vrmUrl: 'blob:http://localhost/old-model',
        _engineMode: 'threeDimensional',
        engineMode: null as unknown as string,
        VRMFileChangeSuccess
      } as unknown as SkinEngine & {
        _engineMode: string;
        vrmUrl: string;
        engineMode: unknown;
      };

      const validFile = new File(['content'], 'avatar.vrm', {
        type: 'model/vrm'
      });
      loadVRMFile(skinEngine as unknown as SkinEngine, validFile);

      expect(revokeSpy).toHaveBeenCalledWith('blob:http://localhost/old-model');
      expect(createSpy).toHaveBeenCalledWith(validFile);
      expect(skinEngine.vrmUrl).toBe('blob:http://localhost/new-model');
      expect(VRMFileChangeSuccess).toHaveBeenCalledWith(
        'blob:http://localhost/new-model'
      );
      expect(skinEngine.engineMode).toBe(ENGINE_MODE_MAP.threeDimensional);

      revokeSpy.mockRestore();
      createSpy.mockRestore();
    });
  });

  describe('bootVRM', () => {
    it('should catch error and trigger onThreeDimensionalError when stageEl is missing', async () => {
      const onThreeDimensionalError = vi.fn();
      const skinEngine = {
        stageEl: null as unknown as HTMLElement,
        onThreeDimensionalError
      } as unknown as SkinEngine;

      await bootVRM(skinEngine);
      expect(onThreeDimensionalError).toHaveBeenCalledWith(
        expect.any(Error),
        skinEngine
      );
    });

    it('should initialize VRM, setup cameras, gestures, subscribers and animation loop', async () => {
      const currentState = {
        fitMode: FIT_MODE_MAP.FULL,
        isSpeaking: false,
        skin3d: {
          pointerLook: true,
          camera: {
            fov: 45,
            near: 0.2,
            far: 500,
            position: [0, 1.4, 2.5],
            lookAt: { x: 0, y: 1.3, z: 0 }
          },
          model: {
            position: [0, -0.2, 0],
            scale: 1.1,
            rotation: [0, 0, 0]
          },
          half: {
            camera: {
              fov: 35,
              near: 0.1,
              far: 300,
              position: { x: 0, y: 1.5, z: 1.8 },
              lookAt: [0, 1.4, 0]
            },
            model: {
              position: { x: 0, y: -0.5, z: 0 },
              scale: [1, 1, 1],
              rotation: { x: 0, y: 0, z: 0 }
            }
          },
          full: {
            camera: {
              fov: 50,
              near: 0.1,
              far: 500,
              position: [0, 1.0, 3.0],
              lookAt: [0, 0.9, 0]
            },
            model: { position: [0, 0, 0], scale: 1.0, rotation: [0, 0, 0] }
          }
        }
      };

      const callbacks: Record<string, (val: unknown) => void> = {};
      const skinEngine = {
        stageEl,
        vrmUrl: 'valid.vrm',
        getState: () => currentState,
        subscribe: vi.fn(
          (
            selector: (s: typeof currentState) => unknown,
            cb: (val: unknown) => void
          ) => {
            const key =
              selector(currentState) === currentState.skin3d
                ? 'skin3d'
                : 'fitMode';
            callbacks[key] = cb;
            return vi.fn();
          }
        ),
        setSkin3d: vi.fn(),
        onMounted: vi.fn(),
        computeMouth: vi.fn().mockResolvedValue(0.6),
        emo: {
          target: 1.0,
          weight: 0.1,
          name: 'surprised',
          applied: ''
        }
      } as unknown as SkinEngine & {
        emo: { target: number; weight: number; name: string; applied: string };
        computeMouth: unknown;
      };

      const renderer = (await bootVRM(skinEngine as unknown as SkinEngine, {
        vrmaRootPath: 'https://custom.vrma.com/',
        goodbye: 'https://custom.vrma.com/goodbye.vrma',
        appearing: 'https://custom.vrma.com/appearing.vrma',
        liked: 'https://custom.vrma.com/liked.vrma',
        waiting: 'https://custom.vrma.com/waiting.vrma'
      })) as Required<Renderer3D>;

      expect(renderer).toBeDefined();
      expect(renderer.gltf).toBeDefined();
      expect(renderer.vrm).toBeDefined();
      expect(renderer.TAP_GESTURES).toEqual(['goodbye', 'bow', 'waiting']);
      expect(renderer.canvas).toBeInstanceOf(HTMLCanvasElement);
      expect(renderer.camera).toBeDefined();
      expect(renderer.scene).toBeDefined();
      expect(skinEngine.onMounted).toHaveBeenCalled();

      // Test pointermove
      const pointerEvent = new MouseEvent('pointermove', {
        clientX: 320,
        clientY: 240
      });
      stageEl.dispatchEvent(pointerEvent);

      // Test window resize
      window.dispatchEvent(new Event('resize'));

      // Test subscribers
      if (typeof callbacks.skin3d === 'function') {
        callbacks.skin3d(currentState.skin3d);
      }
      if (typeof callbacks.fitMode === 'function') {
        callbacks.fitMode(FIT_MODE_MAP.HALF);
      }

      // Test playGesture
      renderer.playGesture('goodbye');
      // Already waving -> ignores second play
      renderer.playGesture('bow');

      // Test computeMouth as synchronous number
      skinEngine.computeMouth = vi.fn(() => 0.4);
      currentState.isSpeaking = true;

      // Test emotion transition
      skinEngine.emo.target = 0;
      skinEngine.emo.weight = 0.002;
      skinEngine.emo.applied = 'surprised';

      // Test setPaused
      renderer.setPaused(true);
      renderer.setPaused(false);

      // Test updateTransform
      renderer.updateTransform({ camera: { fov: 60 } });
      expect(skinEngine.setSkin3d).toHaveBeenCalledWith({
        camera: { fov: 60 }
      });

      // Test dispose
      renderer.dispose();
    });

    it('should cover pointerLook false, partial vectors/scales, and animation mixer finished event', async () => {
      const currentState = {
        fitMode: FIT_MODE_MAP.HALF,
        isSpeaking: true,
        skin3d: {
          pointerLook: false,
          camera: {
            fov: null as unknown as number,
            near: null as unknown as number,
            far: null as unknown as number,
            position: [1, 2], // Array < 3 -> default fallback
            lookAt: null
          },
          model: {
            position: { x: 5 }, // Partial object
            scale: 2.0, // Scalar number
            rotation: { x: 0.1, y: 0.2, z: 0.3 }
          },
          half: {
            camera: { position: null, lookAt: { x: 1 } },
            model: { position: null, scale: null, rotation: null }
          }
        }
      };

      const skinEngine = {
        stageEl,
        vrmUrl: 'valid.vrm',
        getState: () => currentState,
        subscribe: vi.fn(),
        setSkin3d: vi.fn(),
        computeMouth: vi.fn(() => 0.5),
        emo: {
          target: 0.5,
          weight: 0.4,
          name: 'happy',
          applied: 'surprised' // Different applied emotion -> resets previous
        }
      } as unknown as SkinEngine;

      const renderer = (await bootVRM(skinEngine, {
        vrmaRootPath: 'https://vrma.test/'
      })) as Required<Renderer3D>;

      expect(renderer).toBeDefined();

      // Trigger gesture finished event
      renderer.playGesture('goodbye');

      // Test dispose cleanup
      renderer.dispose();
    });

    it('should execute animationLoop ticks covering lip sync, blink, emotions, speaking procedural motions, and pause/resume', async () => {
      vi.useFakeTimers();
      let mouthResolve!: (val: number) => void;
      const mouthPromise = new Promise<number>((resolve) => {
        mouthResolve = resolve;
      });

      const currentState = {
        fitMode: FIT_MODE_MAP.FULL,
        isSpeaking: true,
        skin3d: {
          pointerLook: true,
          camera: {},
          model: {}
        }
      };

      const skinEngine = {
        stageEl,
        vrmUrl: 'valid.vrm',
        getState: () => currentState,
        subscribe: vi.fn(),
        setSkin3d: vi.fn(),
        onMounted: vi.fn(),
        computeMouth: vi
          .fn()
          .mockImplementationOnce(() => mouthPromise)
          .mockImplementation(() => 0.7),
        emo: {
          target: 0.8,
          weight: 0.001,
          name: 'surprised',
          applied: 'happy'
        }
      } as unknown as SkinEngine & {
        emo: { target: number; weight: number; name: string; applied: string };
        computeMouth: unknown;
      };

      const rendererPromise = bootVRM(skinEngine as unknown as SkinEngine);
      await vi.runOnlyPendingTimersAsync();
      const renderer = (await rendererPromise) as Required<Renderer3D>;

      expect(renderer).toBeDefined();

      // Tick 1: trigger computeMouth promise branch
      await vi.advanceTimersByTimeAsync(20);
      mouthResolve(0.85);
      await vi.advanceTimersByTimeAsync(20);

      // Tick 2: test emotion reset and easing
      skinEngine.emo.target = 0;
      skinEngine.emo.weight = 0.002;
      skinEngine.emo.applied = 'surprised';
      await vi.advanceTimersByTimeAsync(50);

      // Tick 3: test computeMouth rejected promise
      skinEngine.computeMouth = vi.fn(() =>
        Promise.reject(new Error('Mouth fail'))
      );
      await vi.advanceTimersByTimeAsync(50);

      // Tick 4: test blink progression
      await vi.advanceTimersByTimeAsync(3000);

      // Tick 5: test pause and resume
      renderer.setPaused(true);
      await vi.advanceTimersByTimeAsync(50);
      renderer.setPaused(false);
      await vi.advanceTimersByTimeAsync(50);

      renderer.dispose();
      vi.useRealTimers();
    });

    it('should test pointermove clamping, expression overrideMouth clamping, neutral emotion, and speech animation procedural calculations', async () => {
      vi.useFakeTimers();

      let isSpeaking = true;
      const currentState = {
        fitMode: FIT_MODE_MAP.FULL,
        get isSpeaking() {
          return isSpeaking;
        },
        skin3d: {
          pointerLook: true,
          camera: {},
          model: {}
        }
      };

      const skinEngine = {
        stageEl,
        vrmUrl: 'valid.vrm',
        getState: () => currentState,
        subscribe: vi.fn(),
        setSkin3d: vi.fn(),
        onMounted: vi.fn(),
        computeMouth: vi.fn(() => 0.4),
        emo: {
          target: 0.9,
          weight: 0.8,
          name: 'happy',
          applied: ''
        }
      } as unknown as SkinEngine & {
        emo: { target: number; weight: number; name: string; applied: string };
      };

      // Mock getBoundingClientRect on stageEl
      stageEl.getBoundingClientRect = () => ({
        left: 0,
        top: 0,
        width: 800,
        height: 600,
        right: 800,
        bottom: 600,
        x: 0,
        y: 0,
        toJSON: () => {}
      });

      const rendererPromise = bootVRM(skinEngine as unknown as SkinEngine);
      await vi.runOnlyPendingTimersAsync();
      const renderer = (await rendererPromise) as Required<Renderer3D>;

      expect(renderer).toBeDefined();

      // 1. Dispatch pointermove event with extreme coordinates to test clamping
      const moveEvent = new MouseEvent('pointermove', {
        clientX: 1200, // Beyond width -> clamped to 1
        clientY: -200 // Above top -> clamped to -1
      });
      stageEl.dispatchEvent(moveEvent);

      // Advance timers to trigger animation loop with pointerLook true and isSpeaking true
      await vi.advanceTimersByTimeAsync(100);

      // 2. Test emotion with overrideMouth !== 'none'
      const vrm = renderer.vrm as {
        expressionManager?: {
          getExpression: ReturnType<typeof vi.fn>;
        };
      };
      if (vrm?.expressionManager) {
        vrm.expressionManager.getExpression = vi.fn((name: string) => ({
          name,
          overrideMouth: 'block'
        }));
      }
      skinEngine.emo.target = 0.8;
      skinEngine.emo.weight = 0.7;
      skinEngine.emo.name = 'happy';
      await vi.advanceTimersByTimeAsync(50);

      // 3. Test emotion with name = 'neutral'
      skinEngine.emo.name = 'neutral';
      await vi.advanceTimersByTimeAsync(50);

      // 4. Test speaking = false and trigger blink cycles / idleBreak
      isSpeaking = false;
      await vi.advanceTimersByTimeAsync(16000);

      renderer.dispose();
      vi.useRealTimers();
    });
  });

  describe('Unified Gestures & Expressions', () => {
    let stageEl: HTMLElement;

    beforeEach(() => {
      stageEl = document.createElement('div');
      stageEl.style.width = '800px';
      stageEl.style.height = '600px';
      document.body.appendChild(stageEl);
    });

    afterEach(() => {
      stageEl.remove();
      vi.restoreAllMocks();
    });

    it('should resolve TAP_GESTURES dynamically from skin3d.tapGestures with default fallback', async () => {
      const currentState: { skin3d: { tapGestures?: string[] } } = {
        skin3d: {}
      };
      const skinEngine = {
        stageEl,
        fitMode: FIT_MODE_MAP.FULL,
        getState: () => currentState,
        onMounted: vi.fn(),
        subscribe: vi.fn(() => vi.fn())
      } as unknown as SkinEngine;

      const renderer = (await bootVRM(skinEngine)) as Required<Renderer3D>;
      expect(renderer.TAP_GESTURES).toEqual(['goodbye', 'bow', 'waiting']);

      currentState.skin3d = { tapGestures: ['wave', 'cheer'] };
      expect(renderer.TAP_GESTURES).toEqual(['wave', 'cheer']);

      renderer.dispose();
    });

    it('should support VRMA gesture playback, custom gestures, expression aliases fallback, and throw GestureNotFoundError on unmatched', async () => {
      const currentState: {
        skin3d: {
          expressionMap?: Record<string, string>;
        };
      } = {
        skin3d: {
          expressionMap: {
            custom_happy: 'happy'
          }
        }
      };

      const skinEngine = {
        stageEl,
        fitMode: FIT_MODE_MAP.FULL,
        getState: () => currentState,
        onMounted: vi.fn(),
        subscribe: vi.fn(() => vi.fn()),
        emo: { name: 'neutral', target: 0, weight: 0, applied: '' }
      } as unknown as SkinEngine;

      const renderer = (await bootVRM(skinEngine, {
        gestures: {
          special_dance: 'https://example.com/dance.vrma'
        }
      })) as Required<Renderer3D>;

      const vrm = renderer.vrm as {
        expressionManager?: {
          setValue: ReturnType<typeof vi.fn>;
          update: ReturnType<typeof vi.fn>;
        };
      };

      // 1. VRMA motion match (case-insensitive)
      await expect(renderer.playGesture('GOODBYE')).resolves.not.toThrow();

      // 2. Custom VRMA motion from setting.gestures
      await expect(
        renderer.playGesture('special_dance')
      ).resolves.not.toThrow();

      // 3. Expression fallback: standard preset alias
      if (vrm?.expressionManager) {
        vrm.expressionManager.setValue = vi.fn();
      }
      await renderer.playGesture('happy');
      expect(skinEngine.emo.name).toBe('happy');
      expect(skinEngine.emo.target).toBe(1);
      if (vrm?.expressionManager) {
        expect(vrm.expressionManager.setValue).toHaveBeenCalledWith('happy', 1);
      }

      // 4. Expression fallback: custom expressionMap
      if (vrm?.expressionManager) {
        vrm.expressionManager.setValue = vi.fn();
      }
      await renderer.playGesture('custom_happy');
      expect(skinEngine.emo.name).toBe('happy');
      if (vrm?.expressionManager) {
        expect(vrm.expressionManager.setValue).toHaveBeenCalledWith('happy', 1);

        // Expression update and error handling branches
        const updateMock = vi.fn();
        vrm.expressionManager.update = updateMock;
        await renderer.playGesture('custom_happy');
        expect(updateMock).toHaveBeenCalled();

        vrm.expressionManager.setValue = vi.fn().mockImplementation(() => {
          throw new Error('Expression setValue failed');
        });
        await renderer.playGesture('custom_happy');
      }

      // 5. Unmatched gesture throws GestureNotFoundError
      await expect(
        renderer.playGesture('completely_unknown_3d_gesture')
      ).rejects.toThrow(GestureNotFoundError);
      try {
        await renderer.playGesture('completely_unknown_3d_gesture');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(GestureNotFoundError);
        const gestureErr = err as GestureNotFoundError;
        expect(gestureErr.code).toBe('ERR_GESTURE_NOT_FOUND');
        expect(gestureErr.mode).toBe('3d');
        expect(gestureErr.gestureName).toBe('completely_unknown_3d_gesture');
      }

      // Empty string throws GestureNotFoundError
      await expect(renderer.playGesture('')).rejects.toThrow(
        GestureNotFoundError
      );

      renderer.dispose();
    });

    it('should decouple head/neck tracks for base idle, crossfade on playGesture, and handle pointerLook suspension', async () => {
      const currentState = {
        fitMode: FIT_MODE_MAP.FULL,
        isSpeaking: false,
        skin3d: {
          pointerLook: true,
          crossfadeDuration: 0.25
        }
      };

      const skinEngine = {
        stageEl,
        fitMode: FIT_MODE_MAP.FULL,
        gender: 'female',
        getState: () => currentState,
        onMounted: vi.fn(),
        subscribe: vi.fn(() => vi.fn()),
        emo: { name: 'neutral', target: 0, weight: 0, applied: '' }
      } as unknown as SkinEngine;

      const renderer = (await bootVRM(skinEngine)) as Required<Renderer3D>;
      expect(renderer).toBeDefined();

      // 1. Verify track decoupling: first loaded action is baseIdleAction (idle-female-1 or idle-1)
      const baseActionRecord = mockMixerState.actions[0];
      expect(baseActionRecord).toBeDefined();
      // Base idle clip should have head/neck tracks stripped
      const baseTrackNames = baseActionRecord.clip.tracks.map((t) => t.name);
      expect(baseTrackNames).toContain('spine.quaternion');
      expect(baseTrackNames).not.toContain('head.quaternion');
      expect(baseTrackNames).not.toContain('neck.quaternion');

      // 2. Play gesture with pointerLook: false (bow)
      await renderer.playGesture('bow');

      // 3. Play another gesture (goodbye) while waving -> should crossfade to next gesture
      await renderer.playGesture('goodbye');

      // 4. Trigger mixer finished event for goodbye action
      const mixerInstance =
        mockMixerState.instances[mockMixerState.instances.length - 1];

      expect(mixerInstance.listeners['finished']).toBeDefined();

      // Get the goodbye action
      const goodbyeRecord = mockMixerState.actions.find((item) =>
        item.clip.tracks.some((t) => t.name === 'head.quaternion')
      );

      if (goodbyeRecord !== undefined) {
        mixerInstance.listeners['finished']({ action: goodbyeRecord.action });
      }

      renderer.dispose();
    });

    it('should handle greeting timeout, talking pool cycling on isSpeaking, and idle variant scheduling', async () => {
      vi.useFakeTimers();

      const callbackHolder: { fn?: (isSpeaking: boolean) => void } = {};
      const currentState = {
        skin3d: {},
        fitMode: FIT_MODE_MAP.FULL,
        gender: 'female',
        isSpeaking: false
      };

      const skinEngine = {
        stageEl,
        vrmUrl: '/test.vrm',
        fitMode: FIT_MODE_MAP.FULL,
        gender: 'female',
        getState: () => currentState,
        onMounted: vi.fn(),
        subscribe: vi.fn(
          (
            selector: (state: Record<string, unknown>) => unknown,
            callback: (val: unknown) => void
          ) => {
            const probeState = {
              isSpeaking: true,
              skin3d: {},
              fitMode: FIT_MODE_MAP.FULL
            };
            if (selector(probeState) === true) {
              callbackHolder.fn = callback as (isSpeaking: boolean) => void;
            }
            return vi.fn();
          }
        ),
        emo: { name: 'neutral', target: 0, weight: 0, applied: '' }
      } as unknown as SkinEngine;

      const bootPromise = bootVRM(skinEngine);
      await vi.advanceTimersByTimeAsync(0);
      const renderer = (await bootPromise) as Required<Renderer3D>;
      expect(renderer).toBeDefined();

      // 1. Initial Greeting Trigger: after 800ms, greetingTimeout should play greeting ('standing-greeting' for female)
      await vi.advanceTimersByTimeAsync(850);
      expect(mockMixerState.actions.length).toBeGreaterThan(0);

      // 2. Speaking cycle: trigger isSpeaking = true
      expect(typeof callbackHolder.fn).toBe('function');
      if (typeof callbackHolder.fn === 'function') {
        currentState.isSpeaking = true;
        callbackHolder.fn(true);
      }

      // Check that a talking action started playing
      const mixerInstance =
        mockMixerState.instances[mockMixerState.instances.length - 1];
      expect(mixerInstance.listeners['finished']).toBeDefined();

      // 3. Finished event when isSpeaking is true -> should cycle to next talking action
      const currentActionRecord =
        mockMixerState.actions[mockMixerState.actions.length - 1];
      mixerInstance.listeners['finished']({ action: currentActionRecord.action });

      // 4. End speaking: trigger isSpeaking = false
      if (typeof callbackHolder.fn === 'function') {
        currentState.isSpeaking = false;
        callbackHolder.fn(false);
      }

      // 5. Idle Variant Scheduler: advance time by 21000ms
      await vi.advanceTimersByTimeAsync(21000);

      // 6. Dispose cleanup
      renderer.dispose();
      vi.useRealTimers();
    });

    it('should keep base idle active and avoid procedural bone overrides when baseIdleAction exists', async () => {
      const currentState = {
        skin3d: {},
        fitMode: FIT_MODE_MAP.FULL,
        gender: 'female',
        isSpeaking: false
      };

      const skinEngine = {
        stageEl,
        vrmUrl: '/test.vrm',
        fitMode: FIT_MODE_MAP.FULL,
        gender: 'female',
        getState: () => currentState,
        onMounted: vi.fn(),
        subscribe: vi.fn(() => vi.fn()),
        emo: { name: 'neutral', target: 0, weight: 0, applied: '' }
      } as unknown as SkinEngine;

      const renderer = (await bootVRM(skinEngine)) as Required<Renderer3D>;
      expect(renderer).toBeDefined();

      // Ensure base idle action was played
      expect(mockMixerState.actions.length).toBeGreaterThan(0);
      const baseAction = mockMixerState.actions[0];
      expect(baseAction.action.play).toHaveBeenCalled();

      renderer.dispose();
    });

    it('should respect pointerLook: false configured in pools.greetings during greeting playback', async () => {
      vi.useFakeTimers();
      const currentState = {
        fitMode: FIT_MODE_MAP.FULL,
        gender: 'female',
        isSpeaking: false,
        skin3d: {
          pointerLook: true,
          greetings: {
            female: {
              name: 'standing-greeting',
              pointerLook: false
            }
          }
        }
      };

      const skinEngine = {
        stageEl,
        fitMode: FIT_MODE_MAP.FULL,
        gender: 'female',
        getState: () => currentState,
        onMounted: vi.fn(),
        subscribe: vi.fn(() => vi.fn()),
        emo: { name: 'neutral', target: 0, weight: 0, applied: '' }
      } as unknown as SkinEngine;

      const bootPromise = bootVRM(skinEngine);
      await vi.advanceTimersByTimeAsync(0);
      const renderer = (await bootPromise) as Required<Renderer3D>;
      expect(renderer).toBeDefined();

      // Verify that standing-greeting was preloaded with head/neck tracks preserved
      const standingGreetingRecord = mockMixerState.actions.find(
        (item) => item.clip.name === 'standing-greeting'
      );
      if (standingGreetingRecord !== undefined) {
        const trackNames = standingGreetingRecord.clip.tracks.map((t) => t.name);
        expect(trackNames).toContain('head.quaternion');
        expect(trackNames).toContain('neck.quaternion');
      }

      // Advance by 800ms to trigger greeting timeout
      await vi.advanceTimersByTimeAsync(800);

      // Trigger animationLoop tick while cursor has moved
      const mouseEvent = new MouseEvent('pointermove', {
        clientX: 200,
        clientY: 200
      });
      window.dispatchEvent(mouseEvent);

      // Since standing-greeting has pointerLook: false, lookTarget should be centered at (0, 1.42, 1.6)
      const vrmInstance = renderer.vrm as {
        lookAt?: { target?: { position: { x: number; y: number; z: number } } };
      };
      expect(vrmInstance.lookAt?.target?.position.x).toBe(0);
      expect(vrmInstance.lookAt?.target?.position.y).toBe(1.42);
      expect(vrmInstance.lookAt?.target?.position.z).toBe(1.6);

      renderer.dispose();
      vi.useRealTimers();
    });
  });
});
