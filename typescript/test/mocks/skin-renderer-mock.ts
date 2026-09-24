import { vi, type Mock } from 'vitest';

export interface MockRenderer2D {
  canvas: HTMLCanvasElement;
  avatarModel: {
    internalModel: {
      settings: {
        motions: {
          tap_body: Array<{ File: string }>;
        };
      };
      height: number;
      width: number;
    };
    position: {
      x: number;
      y: number;
      set: Mock<(...args: unknown[]) => unknown>;
    };
    scale: { x: number; y: number; set: Mock<(...args: unknown[]) => unknown> };
    anchor: {
      x: number;
      y: number;
      set: Mock<(...args: unknown[]) => unknown>;
    };
    expression: Mock<(...args: unknown[]) => Promise<boolean>>;
    motion: Mock<(...args: unknown[]) => Promise<boolean>>;
    on: Mock<(...args: unknown[]) => unknown>;
    emit: Mock<(...args: unknown[]) => unknown>;
    destroy: Mock<(...args: unknown[]) => unknown>;
    [key: string]: unknown;
  };
  pixiApp: {
    stage: {
      addChild: Mock<(...args: unknown[]) => unknown>;
      removeChild: Mock<(...args: unknown[]) => unknown>;
    };
    renderer: {
      width: number;
      height: number;
      resize: Mock<(...args: unknown[]) => unknown>;
    };
    destroy: Mock<(...args: unknown[]) => unknown>;
    [key: string]: unknown;
  };
  fit: Mock<() => void>;
  updateTransform: Mock<(params?: unknown) => void>;
  dispose: Mock<() => void>;
  [key: string]: unknown;
}

export interface MockRenderer3D {
  canvas: HTMLCanvasElement;
  gltf: Record<string, unknown>;
  vrm: {
    scene: Record<string, unknown>;
    humanoid: {
      getNormalizedBoneNode: Mock<() => unknown>;
    };
    expressionManager: {
      setValue: Mock<(...args: unknown[]) => unknown>;
      update: Mock<() => unknown>;
    };
    lookAt: {
      target: { position: { x: number; y: number; z: number } };
      lookAt: Mock<() => unknown>;
    };
    [key: string]: unknown;
  };
  camera: {
    position: {
      x: number;
      y: number;
      z: number;
      set: Mock<(...args: unknown[]) => unknown>;
    };
    lookAt: Mock<() => unknown>;
    fov: number;
    near: number;
    far: number;
    updateProjectionMatrix: Mock<() => unknown>;
    [key: string]: unknown;
  };
  scene: {
    add: Mock<(...args: unknown[]) => unknown>;
    remove: Mock<(...args: unknown[]) => unknown>;
    [key: string]: unknown;
  };
  TAP_GESTURES: string[];
  playGesture: Mock<(gestureName?: string) => Promise<void>>;
  setPaused: Mock<(paused?: boolean) => void>;
  updateTransform: Mock<(params?: unknown) => void>;
  dispose: Mock<() => void>;
  [key: string]: unknown;
}

/**
 * 建立 Mock 2D Live2D 渲染器實例
 * @param overrides
 * @returns Mocked 2D Live2D Renderer
 */
export function createMockRenderer2D(
  overrides: Partial<MockRenderer2D> = {}
): MockRenderer2D {
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
export function createMockRenderer3D(
  overrides: Partial<MockRenderer3D> = {}
): MockRenderer3D {
  const canvas = document.createElement('canvas');
  const vrm = {
    scene: {},
    humanoid: {
      getNormalizedBoneNode: vi.fn(() => ({
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 }
      }))
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

interface WindowWithMockPixi {
  __cdnDependenciePromise__?: Promise<void>;
  PIXI?: unknown;
}

/**
 * 全域安裝 PIXI 與 Live2D Mock
 */
export function setupWindowPixiMock() {
  (window as unknown as WindowWithMockPixi).__cdnDependenciePromise__ =
    Promise.resolve();

  class MockLive2DModel {
    internalModel: Record<string, unknown>;
    position: { set: ReturnType<typeof vi.fn> };
    scale: { set: ReturnType<typeof vi.fn> };
    anchor: { set: ReturnType<typeof vi.fn> };
    expression: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    x: number;
    y: number;

    constructor() {
      this.internalModel = {
        settings: {
          motions: {
            idle: [{ File: 'idle.motion3.json', Sound: 'idle.mp3' }]
          },
          groups: [{ Name: 'Lipsync', Ids: ['ParamMouthOpenY'] }]
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
    stage: {
      addChild: ReturnType<typeof vi.fn>;
      removeChild: ReturnType<typeof vi.fn>;
    };
    renderer: {
      width: number;
      height: number;
      resize: ReturnType<typeof vi.fn>;
    };
    destroy: ReturnType<typeof vi.fn>;

    constructor() {
      this.stage = { addChild: vi.fn(), removeChild: vi.fn() };
      this.renderer = { width: 800, height: 600, resize: vi.fn() };
      this.destroy = vi.fn();
    }
  }

  (window as unknown as WindowWithMockPixi).PIXI = {
    Application: MockPIXIApplication,
    Ticker: {},
    live2d: {
      Live2DModel: MockLive2DModel,
      SoundManager: { volume: 1 }
    }
  };
}
