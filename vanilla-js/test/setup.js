import { vi } from 'vitest';

// 1. Mock Canvas 2D & WebGL Context
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = vi.fn((type) => {
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
      };
    }
    if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') {
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
      };
    }
    return null;
  });
}

// 2. Mock Web Audio API
class MockAudioContext {
  constructor() {
    this.state = 'running';
    this.sampleRate = 44100;
  }
  createAnalyser() {
    return {
      fftSize: 2048,
      frequencyBinCount: 1024,
      minDecibels: -100,
      maxDecibels: -30,
      smoothingTimeConstant: 0.8,
      getByteFrequencyData: vi.fn((array) => {
        if (array && array.length > 0) {
          array.fill(128);
        }
      }),
      getByteTimeDomainData: vi.fn((array) => {
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

globalThis.AudioContext = MockAudioContext;
globalThis.webkitAudioContext = MockAudioContext;

// 3. Mock SpeechRecognition
class MockSpeechRecognition {
  constructor() {
    this.continuous = false;
    this.interimResults = false;
    this.lang = 'zh-TW';
    this.onstart = null;
    this.onresult = null;
    this.onerror = null;
    this.onend = null;
  }
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

globalThis.SpeechRecognition = MockSpeechRecognition;
globalThis.webkitSpeechRecognition = MockSpeechRecognition;

// 4. Mock SpeechSynthesis & SpeechSynthesisUtterance
class MockSpeechSynthesisUtterance {
  constructor(text = '') {
    this.text = text;
    this.lang = 'zh-TW';
    this.pitch = 1;
    this.rate = 1;
    this.volume = 1;
    this.voice = null;
    this.onstart = null;
    this.onend = null;
    this.onerror = null;
    this.onpause = null;
    this.onresume = null;
    this.onboundary = null;
  }
}

const mockSpeechSynthesis = {
  speaking: false,
  pending: false,
  paused: false,
  onvoiceschanged: null,
  speak: vi.fn((utterance) => {
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
    { name: 'Google 國語（臺灣）', lang: 'zh-TW', default: true, localService: true },
    { name: 'Google US English', lang: 'en-US', default: false, localService: true },
    { name: 'Google 日本語', lang: 'ja-JP', default: false, localService: true }
  ])
};

globalThis.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
globalThis.speechSynthesis = mockSpeechSynthesis;

// 5. Mock WebGPU (navigator.gpu)
if (typeof navigator !== 'undefined') {
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

globalThis.ResizeObserver = MockObserver;
globalThis.IntersectionObserver = MockObserver;

// 7. Mock requestAnimationFrame & cancelAnimationFrame
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 16);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
}
