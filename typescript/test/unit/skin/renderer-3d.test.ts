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
import type { SkinEngine, Renderer3D } from '@core';

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
    listeners: Record<string, (e: unknown) => void>;
    constructor() {
      this.listeners = {};
    }
    addEventListener(event: string, fn: (e: unknown) => void) {
      this.listeners[event] = fn;
    }
    clipAction() {
      return {
        setLoop: vi.fn(),
        clampWhenFinished: true,
        reset: vi.fn(),
        setEffectiveWeight: vi.fn(),
        play: vi.fn(),
        stop: vi.fn()
      };
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
    LoopOnce: 2200
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
      tracks: [{ name: 'spine.quaternion' }, { name: 'spine.position' }]
    }))
  };
});

describe('Unit Test: core/skin/renderer-3d.js', () => {
  let stageEl: HTMLElement;

  beforeEach(() => {
    stageEl = document.createElement('div');
    stageEl.id = 'stage';
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
        defaultGesture3D(null as unknown as SkinEngine, 'wave')
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

      await defaultGesture3D(skinEngine, 'wave');
      expect(playGesture).toHaveBeenCalledWith('wave');

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
        wave: 'https://custom.vrma.com/wave.vrma'
      })) as Required<Renderer3D>;

      expect(renderer).toBeDefined();
      expect(renderer.gltf).toBeDefined();
      expect(renderer.vrm).toBeDefined();
      expect(renderer.TAP_GESTURES).toEqual(['wave', 'bow']);
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
      renderer.playGesture('wave');
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
      renderer.playGesture('wave');

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

      // 4. Test speaking = false
      isSpeaking = false;
      await vi.advanceTimersByTimeAsync(50);

      renderer.dispose();
      vi.useRealTimers();
    });
  });
});
