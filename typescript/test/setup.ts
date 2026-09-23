import { vi } from 'vitest';

declare global {
  interface Navigator {
    gpu?: {
      requestAdapter: (options?: unknown) => Promise<{
        requestDevice: (options?: unknown) => Promise<{
          queue: {
            submit: (commandBuffers: unknown[]) => void;
            writeBuffer: (...args: unknown[]) => void;
          };
          createShaderModule: (descriptor: unknown) => unknown;
          createBindGroupLayout: (descriptor: unknown) => unknown;
          createPipelineLayout: (descriptor: unknown) => unknown;
          createComputePipeline: (descriptor: unknown) => unknown;
          createBuffer: (descriptor: unknown) => unknown;
        } | null>;
      } | null>;
    };
  }

  var global: typeof globalThis;
}

const globalScope = globalThis as unknown as Record<string, unknown>;

// 1. Mock Canvas 2D & WebGL Context
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = vi.fn((type: string) => {
    if (type === '2d') {
      return {
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
        putImageData: vi.fn(),
        createImageData: vi.fn(() => []),
        setTransform: vi.fn(),
        drawImage: vi.fn(),
        save: vi.fn(),
        fillText: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        stroke: vi.fn(),
        translate: vi.fn(),
        scale: vi.fn(),
        rotate: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        measureText: vi.fn(() => ({ width: 0 })),
        transform: vi.fn(),
        rect: vi.fn(),
        clip: vi.fn(),
        canvas: { width: 800, height: 600 }
      } as unknown as CanvasRenderingContext2D;
    }
    if (
      type === 'webgl' ||
      type === 'webgl2' ||
      type === 'experimental-webgl'
    ) {
      return {
        getExtension: vi.fn(),
        getParameter: vi.fn(() => 0),
        createTexture: vi.fn(),
        bindTexture: vi.fn(),
        texParameteri: vi.fn(),
        texImage2D: vi.fn(),
        clearColor: vi.fn(),
        clear: vi.fn(),
        enable: vi.fn(),
        disable: vi.fn(),
        viewport: vi.fn(),
        createShader: vi.fn(),
        shaderSource: vi.fn(),
        compileShader: vi.fn(),
        createProgram: vi.fn(),
        attachShader: vi.fn(),
        linkProgram: vi.fn(),
        useProgram: vi.fn(),
        createBuffer: vi.fn(),
        bindBuffer: vi.fn(),
        bufferData: vi.fn(),
        getAttribLocation: vi.fn(() => 0),
        enableVertexAttribArray: vi.fn(),
        vertexAttribPointer: vi.fn(),
        drawArrays: vi.fn(),
        drawElements: vi.fn(),
        canvas: { width: 800, height: 600 }
      } as unknown as WebGLRenderingContext;
    }
    return null;
  }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
}

// 2. Mock Web Audio API
class MockAudioContext {
  state: AudioContextState = 'running';
  sampleRate: number = 44100;

  createAnalyser() {
    return {
      fftSize: 2048,
      frequencyBinCount: 1024,
      minDecibels: -100,
      maxDecibels: -30,
      smoothingTimeConstant: 0.8,
      getByteFrequencyData: vi.fn((array: Uint8Array) => {
        if (array && array.length > 0) {
          array.fill(128);
        }
      }),
      getByteTimeDomainData: vi.fn((array: Uint8Array) => {
        if (array && array.length > 0) {
          array.fill(128);
        }
      }),
      connect: vi.fn(),
      disconnect: vi.fn()
    };
  }
  createMediaStreamSource() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn()
    };
  }
  createGain() {
    return {
      gain: { value: 1, setValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn()
    };
  }
  createBufferSource() {
    return {
      buffer: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null
    };
  }
  decodeAudioData(_buffer: ArrayBuffer) {
    return Promise.resolve({
      duration: 1,
      length: 44100,
      sampleRate: 44100,
      numberOfChannels: 1,
      getChannelData: () => new Float32Array(44100)
    });
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
  suspend() {
    this.state = 'suspended';
    return Promise.resolve();
  }
  close() {
    this.state = 'closed';
    return Promise.resolve();
  }
}

globalScope.AudioContext = MockAudioContext;
globalScope.webkitAudioContext = MockAudioContext;

// 3. Mock SpeechRecognition
class MockSpeechRecognition {
  continuous: boolean = false;
  interimResults: boolean = false;
  lang: string = 'zh-TW';
  onstart: ((event: Event) => void) | null = null;
  onresult: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onend: ((event: Event) => void) | null = null;

  start() {
    if (typeof this.onstart === 'function') {
      this.onstart(new Event('start'));
    }
  }
  stop() {
    if (typeof this.onend === 'function') {
      this.onend(new Event('end'));
    }
  }
  abort() {
    if (typeof this.onend === 'function') {
      this.onend(new Event('end'));
    }
  }
}

globalScope.SpeechRecognition = MockSpeechRecognition;
globalScope.webkitSpeechRecognition = MockSpeechRecognition;

// 4. Mock SpeechSynthesis & SpeechSynthesisUtterance
class MockSpeechSynthesisUtterance {
  text: string;
  lang: string = 'zh-TW';
  pitch: number = 1;
  rate: number = 1;
  volume: number = 1;
  voice: SpeechSynthesisVoice | null = null;
  onstart: ((event: Event) => void) | null = null;
  onend: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onpause: ((event: Event) => void) | null = null;
  onresume: ((event: Event) => void) | null = null;
  onboundary: ((event: Event) => void) | null = null;

  constructor(text: string = '') {
    this.text = text;
  }
}

const mockSpeechSynthesis = {
  speaking: false,
  pending: false,
  paused: false,
  onvoiceschanged: null,
  speak: vi.fn((utterance: MockSpeechSynthesisUtterance) => {
    mockSpeechSynthesis.speaking = true;
    setTimeout(() => {
      if (typeof utterance.onstart === 'function') {
        utterance.onstart(new Event('start'));
      }
      setTimeout(() => {
        mockSpeechSynthesis.speaking = false;
        if (typeof utterance.onend === 'function') {
          utterance.onend(new Event('end'));
        }
      }, 10);
    }, 0);
  }),
  cancel: vi.fn(() => {
    mockSpeechSynthesis.speaking = false;
    mockSpeechSynthesis.pending = false;
  }),
  pause: vi.fn(() => {
    mockSpeechSynthesis.paused = true;
  }),
  resume: vi.fn(() => {
    mockSpeechSynthesis.paused = false;
  }),
  getVoices: vi.fn(() => [
    {
      name: 'Google 國語（臺灣）',
      lang: 'zh-TW',
      default: true,
      localService: true
    } as SpeechSynthesisVoice,
    {
      name: 'Google US English',
      lang: 'en-US',
      default: false,
      localService: true
    } as SpeechSynthesisVoice,
    {
      name: 'Google 日本語',
      lang: 'ja-JP',
      default: false,
      localService: true
    } as SpeechSynthesisVoice
  ])
};

globalScope.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
globalScope.speechSynthesis = mockSpeechSynthesis;

// 5. Mock WebGPU (navigator.gpu) & MediaDevices
if (typeof navigator !== 'undefined') {
  if (!navigator.mediaDevices) {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn(() =>
          Promise.resolve({
            getTracks: () => [{ stop: vi.fn(), enabled: true }]
          })
        )
      },
      configurable: true,
      writable: true
    });
  } else {
    navigator.mediaDevices.getUserMedia = vi.fn(() =>
      Promise.resolve({
        getTracks: () => [{ stop: vi.fn(), enabled: true }]
      })
    ) as unknown as typeof navigator.mediaDevices.getUserMedia;
  }

  Object.defineProperty(navigator, 'gpu', {
    value: {
      requestAdapter: vi.fn(() =>
        Promise.resolve({
          requestDevice: vi.fn(() =>
            Promise.resolve({
              queue: { submit: vi.fn(), writeBuffer: vi.fn() },
              createShaderModule: vi.fn(),
              createBindGroupLayout: vi.fn(),
              createPipelineLayout: vi.fn(),
              createComputePipeline: vi.fn(),
              createBuffer: vi.fn()
            })
          )
        })
      )
    },
    configurable: true,
    writable: true
  });
}

// 6. Mock ResizeObserver & IntersectionObserver
class MockObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalScope.ResizeObserver = MockObserver;
globalScope.IntersectionObserver = MockObserver;

// 7. Mock requestAnimationFrame & cancelAnimationFrame
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalScope.requestAnimationFrame = (callback: FrameRequestCallback) =>
    setTimeout(callback, 16);
  globalScope.cancelAnimationFrame = (id: number) => clearTimeout(id);
}
