import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FIT_MODE_MAP, ENGINE_MODE_MAP } from '../../../core/constants';
import {
  defaultGesture3D,
  bootVRM,
  loadVRMFile
} from '../../../core/skin/renderer-3d';

// Mock Three.js and VRM packages
vi.mock('three', () => {
  class MockVector3 {
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
    set(x, y, z) {
      this.x = x;
      this.y = y;
      this.z = z;
      return this;
    }
  }

  class MockEuler {
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
    set(x, y, z) {
      this.x = x;
      this.y = y;
      this.z = z;
      return this;
    }
  }

  class MockObject3D {
    constructor() {
      this.position = new MockVector3();
      this.rotation = new MockEuler();
      this.scale = new MockVector3(1, 1, 1);
      this.children = [];
      this.frustumCulled = true;
    }
    add(...objs) {
      this.children.push(...objs);
    }
    traverse(cb) {
      cb(this);
    }
  }

  class MockPerspectiveCamera extends MockObject3D {
    constructor(fov = 50, aspect = 1, near = 0.1, far = 1000) {
      super();
      this.fov = fov;
      this.aspect = aspect;
      this.near = near;
      this.far = far;
    }
    lookAt(v) {
      this.lookAtTarget = v;
    }
    updateProjectionMatrix() {}
  }

  class MockWebGLRenderer {
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
    constructor() {
      this.elapsedTime = 1.0;
    }
    getDelta() {
      return 0.016;
    }
  }

  class MockAnimationMixer {
    constructor() {
      this.listeners = {};
    }
    addEventListener(event, fn) {
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
    load(url, onLoad, onProgress, onError) {
      if (url === 'error.vrm') {
        onError(new Error('Load VRM failed'));
        return;
      }
      setTimeout(() => {
        const vrmScene = {
          position: { set: vi.fn() },
          rotation: { set: vi.fn() },
          scale: { set: vi.fn() },
          traverse: (cb) => cb({ frustumCulled: true })
        };
        const expressionManager = {
          setValue: vi.fn(),
          getExpression: vi.fn((name) => ({ overrideMouth: name === 'surprised' ? 'none' : 'block' }))
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
    async loadAsync(url) {
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
        { name: 'spine.position' }
      ]
    }))
  };
});

describe('Unit Test: core/skin/renderer-3d.js', () => {
  let stageEl;

  beforeEach(() => {
    stageEl = document.createElement('div');
    stageEl.id = 'stage';
    Object.defineProperty(stageEl, 'clientWidth', { value: 640, configurable: true });
    Object.defineProperty(stageEl, 'clientHeight', { value: 480, configurable: true });
    stageEl.getBoundingClientRect = vi.fn(() => ({
      left: 0,
      top: 0,
      width: 640,
      height: 480
    }));
    document.body.appendChild(stageEl);
  });

  afterEach(() => {
    stageEl.remove();
    vi.restoreAllMocks();
  });

  describe('defaultGesture3D', () => {
    it('should safely return on invalid arguments', async () => {
      await expect(defaultGesture3D(null, 'wave')).resolves.toBeUndefined();
      await expect(defaultGesture3D({}, '')).resolves.toBeUndefined();
      await expect(defaultGesture3D({}, null)).resolves.toBeUndefined();
    });

    it('should invoke renderer.playGesture and catch errors', async () => {
      const playGesture = vi.fn();
      const skinEngine = { renderer: { playGesture } };

      await defaultGesture3D(skinEngine, 'wave');
      expect(playGesture).toHaveBeenCalledWith('wave');

      playGesture.mockImplementationOnce(() => {
        throw new Error('Play gesture fail');
      });
      await expect(defaultGesture3D(skinEngine, 'bow')).resolves.toBeUndefined();
    });
  });

  describe('loadVRMFile', () => {
    it('should log error when stageEl is not an HTMLElement', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      loadVRMFile({ stageEl: null }, new File(['dummy'], 'model.vrm'));
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should trigger VRMFileChangeFail when file is not a .vrm file', () => {
      const VRMFileChangeFail = vi.fn();
      const skinEngine = { stageEl, VRMFileChangeFail };

      loadVRMFile(skinEngine, new File(['dummy'], 'model.png'));
      expect(VRMFileChangeFail).toHaveBeenCalledWith(expect.any(Error));

      loadVRMFile(skinEngine, null);
      expect(VRMFileChangeFail).toHaveBeenCalledTimes(2);
    });

    it('should revoke previous blob url, create new object url and switch engine mode on valid .vrm file', () => {
      const VRMFileChangeSuccess = vi.fn();
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/new-model');

      const skinEngine = {
        stageEl,
        vrmUrl: 'blob:http://localhost/old-model',
        _engineMode: 'threeDimensional',
        engineMode: null,
        VRMFileChangeSuccess
      };

      const validFile = new File(['content'], 'avatar.vrm', { type: 'model/vrm' });
      loadVRMFile(skinEngine, validFile);

      expect(revokeSpy).toHaveBeenCalledWith('blob:http://localhost/old-model');
      expect(createSpy).toHaveBeenCalledWith(validFile);
      expect(skinEngine.vrmUrl).toBe('blob:http://localhost/new-model');
      expect(VRMFileChangeSuccess).toHaveBeenCalledWith('blob:http://localhost/new-model');
      expect(skinEngine.engineMode).toBe(ENGINE_MODE_MAP.threeDimensional);

      revokeSpy.mockRestore();
      createSpy.mockRestore();
    });
  });

  describe('bootVRM', () => {
    it('should catch error and trigger onThreeDimensionalError when stageEl is missing', async () => {
      const onThreeDimensionalError = vi.fn();
      const skinEngine = {
        stageEl: null,
        onThreeDimensionalError
      };

      await bootVRM(skinEngine);
      expect(onThreeDimensionalError).toHaveBeenCalledWith(expect.any(Error), skinEngine);
    });

    it('should initialize VRM, setup cameras, gestures, subscribers and animation loop', async () => {
      let currentState = {
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
            camera: { fov: 35, near: 0.1, far: 300, position: { x: 0, y: 1.5, z: 1.8 }, lookAt: [0, 1.4, 0] },
            model: { position: { x: 0, y: -0.5, z: 0 }, scale: [1, 1, 1], rotation: { x: 0, y: 0, z: 0 } }
          },
          full: {
            camera: { fov: 50, near: 0.1, far: 500, position: [0, 1.0, 3.0], lookAt: [0, 0.9, 0] },
            model: { position: [0, 0, 0], scale: 1.0, rotation: [0, 0, 0] }
          }
        }
      };

      const callbacks = {};
      const skinEngine = {
        stageEl,
        vrmUrl: 'valid.vrm',
        getState: () => currentState,
        subscribe: vi.fn((selector, cb) => {
          const key = selector(currentState) === currentState.skin3d ? 'skin3d' : 'fitMode';
          callbacks[key] = cb;
          return vi.fn();
        }),
        setSkin3d: vi.fn(),
        onMounted: vi.fn(),
        computeMouth: vi.fn().mockResolvedValue(0.6),
        emo: {
          target: 1.0,
          weight: 0.1,
          name: 'surprised',
          applied: ''
        }
      };

      const renderer = await bootVRM(skinEngine, {
        vrmaRootPath: 'https://custom.vrma.com/',
        wave: 'https://custom.vrma.com/wave.vrma'
      });

      expect(renderer).toBeDefined();
      expect(renderer.gltf).toBeDefined();
      expect(renderer.vrm).toBeDefined();
      expect(renderer.TAP_GESTURES).toEqual(['wave', 'bow']);
      expect(renderer.canvas).toBeInstanceOf(HTMLCanvasElement);
      expect(renderer.camera).toBeDefined();
      expect(renderer.scene).toBeDefined();
      expect(skinEngine.onMounted).toHaveBeenCalled();

      // Test pointermove
      const pointerEvent = new MouseEvent('pointermove', { clientX: 320, clientY: 240 });
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
      expect(skinEngine.setSkin3d).toHaveBeenCalledWith({ camera: { fov: 60 } });

      // Test dispose
      renderer.dispose();
    });

    it('should cover pointerLook false, partial vectors/scales, and animation mixer finished event', async () => {
      let currentState = {
        fitMode: FIT_MODE_MAP.HALF,
        isSpeaking: true,
        skin3d: {
          pointerLook: false,
          camera: {
            fov: null,
            near: null,
            far: null,
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

      let capturedMixer = null;
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
      };

      const renderer = await bootVRM(skinEngine, {
        vrmaRootPath: 'https://vrma.test/'
      });

      expect(renderer).toBeDefined();

      // Trigger gesture finished event
      renderer.playGesture('wave');

      // Test dispose cleanup
      renderer.dispose();
    });
  });
});
