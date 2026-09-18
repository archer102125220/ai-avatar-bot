import { vi } from 'vitest';

/**
 * 建立 Mock 2D Live2D 渲染器實例
 * @param overrides
 * @returns Mocked 2D Live2D Renderer
 */
export function createMockRenderer2D(overrides: Record<string, any> = {}): Record<string, any> {
  const canvas = document.createElement('canvas');
  const avatarModel = {
    internalModel: {
      settings: {
        motions: {
          tap_body: [{ File: 'motions/tap.motion3.json' }]
        }
      },
      height: 1000,
      width: 800
    },
    position: { x: 0, y: 0, set: vi.fn() },
    scale: { x: 1, y: 1, set: vi.fn() },
    anchor: { x: 0.5, y: 1, set: vi.fn() },
    expression: vi.fn(() => Promise.resolve(true)),
    motion: vi.fn(() => Promise.resolve(true)),
    on: vi.fn(),
    emit: vi.fn(),
    destroy: vi.fn()
  };

  const pixiApp = {
    stage: {
      addChild: vi.fn(),
      removeChild: vi.fn()
    },
    renderer: {
      width: 800,
      height: 600,
      resize: vi.fn()
    },
    destroy: vi.fn()
  };

  return {
    canvas,
    avatarModel,
    pixiApp,
    fit: vi.fn(),
    updateTransform: vi.fn(),
    dispose: vi.fn(),
    ...overrides
  };
}

/**
 * 建立 Mock 3D VRM 渲染器實例
 * @param overrides
 * @returns Mocked 3D VRM Renderer
 */
export function createMockRenderer3D(overrides: Record<string, any> = {}): Record<string, any> {
  const canvas = document.createElement('canvas');
  const vrm = {
    scene: {},
    humanoid: {
      getNormalizedBoneNode: vi.fn(() => ({ position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }))
    },
    expressionManager: {
      setValue: vi.fn(),
      update: vi.fn()
    },
    lookAt: {
      target: { position: { x: 0, y: 0, z: 0 } },
      lookAt: vi.fn()
    }
  };

  const camera = {
    position: { x: 0, y: 1.4, z: 2.5, set: vi.fn() },
    lookAt: vi.fn(),
    fov: 26,
    near: 0.1,
    far: 20,
    updateProjectionMatrix: vi.fn()
  };

  const scene = {
    add: vi.fn(),
    remove: vi.fn()
  };

  return {
    canvas,
    gltf: {},
    vrm,
    camera,
    scene,
    TAP_GESTURES: ['wave', 'bow', 'thinking', 'surprised', 'relax', 'look'],
    playGesture: vi.fn((_gestureName?: string) => Promise.resolve()),
    setPaused: vi.fn(),
    updateTransform: vi.fn(),
    dispose: vi.fn(),
    ...overrides
  };
}

/**
 * 全域安裝 PIXI 與 Live2D Mock
 */
export function setupWindowPixiMock() {
  (window as any).__cdnDependenciePromise__ = Promise.resolve();

  class MockLive2DModel {
    internalModel: any;
    position: any;
    scale: any;
    anchor: any;
    expression: any;
    on: any;
    x: number;
    y: number;

    constructor() {
      this.internalModel = {
        settings: {
          motions: {
            idle: [{ File: 'idle.motion3.json', Sound: 'idle.mp3' }]
          },
          groups: [
            { Name: 'Lipsync', Ids: ['ParamMouthOpenY'] }
          ]
        },
        coreModel: {
          update: vi.fn(),
          setParameterValueById: vi.fn()
        },
        height: 1000
      };
      this.position = { set: vi.fn() };
      this.scale = { set: vi.fn() };
      this.anchor = { set: vi.fn() };
      this.expression = vi.fn(() => Promise.resolve(true));
      this.on = vi.fn();
      this.x = 0;
      this.y = 0;
    }
    static from() {
      return Promise.resolve(new MockLive2DModel());
    }
    static registerTicker() {}
  }

  class MockPIXIApplication {
    stage: { addChild: any; removeChild: any };
    renderer: { width: number; height: number; resize: any };
    destroy: any;

    constructor() {
      this.stage = { addChild: vi.fn(), removeChild: vi.fn() };
      this.renderer = { width: 800, height: 600, resize: vi.fn() };
      this.destroy = vi.fn();
    }
  }

  (window as any).PIXI = {
    Application: MockPIXIApplication,
    Ticker: {},
    live2d: {
      Live2DModel: MockLive2DModel,
      SoundManager: { volume: 1 }
    }
  };
}
