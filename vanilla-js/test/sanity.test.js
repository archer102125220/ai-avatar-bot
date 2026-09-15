import { describe, it, expect, vi } from 'vitest';
import {
  createMockRenderer2D,
  createMockRenderer3D,
  setupWindowPixiMock
} from '@/test/mocks/skin-renderer-mock';
import {
  createMockAiProvider,
  createMockWebLLMEngine,
  createMockChatCompletionStream
} from '@/test/mocks/ai-provider-mock';


describe('Phase 1: Test Infrastructure & Global Mocks Sanity Check', () => {
  it('should have DOM environment properly set up by jsdom', () => {
    const div = document.createElement('div');
    div.id = 'avatar-container';
    document.body.appendChild(div);

    expect(document.getElementById('avatar-container')).toBe(div);
    document.body.removeChild(div);
  });

  it('should mock Canvas 2D and WebGL contexts without errors', () => {
    const canvas = document.createElement('canvas');
    const ctx2d = canvas.getContext('2d');
    const ctx3d = canvas.getContext('webgl');

    expect(ctx2d).not.toBeNull();
    expect(typeof ctx2d.clearRect).toBe('function');

    expect(ctx3d).not.toBeNull();
    expect(typeof ctx3d.clear).toBe('function');
  });

  it('should mock Web Audio API (AudioContext & AnalyserNode)', () => {
    const audioCtx = new window.AudioContext();
    const analyser = audioCtx.createAnalyser();

    expect(audioCtx.state).toBe('running');
    expect(analyser.frequencyBinCount).toBe(1024);

    const freqData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(freqData);
    expect(freqData[0]).toBe(128);
  });

  it('should mock SpeechRecognition & SpeechSynthesis', () => {
    const recognition = new window.SpeechRecognition();
    const onStartSpy = vi.fn();
    recognition.onstart = onStartSpy;
    recognition.start();
    expect(onStartSpy).toHaveBeenCalledTimes(1);

    const utterance = new window.SpeechSynthesisUtterance('測試語音');
    window.speechSynthesis.speak(utterance);
    expect(window.speechSynthesis.speak).toHaveBeenCalledWith(utterance);
    expect(window.speechSynthesis.getVoices().length).toBeGreaterThan(0);
  });

  it('should mock WebGPU (navigator.gpu)', async () => {
    expect(navigator.gpu).toBeDefined();
    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();
    expect(device).toBeDefined();
    expect(typeof device.createShaderModule).toBe('function');
  });

  it('should verify Skin renderer mocks work', () => {
    const mock2d = createMockRenderer2D();
    expect(mock2d.canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(typeof mock2d.avatarModel.expression).toBe('function');

    const mock3d = createMockRenderer3D();
    expect(mock3d.TAP_GESTURES).toContain('wave');
    expect(typeof mock3d.playGesture).toBe('function');

    setupWindowPixiMock();
    expect(window.PIXI).toBeDefined();
    expect(window.PIXI.live2d.Live2DModel).toBeDefined();
  });

  it('should verify AI Provider & WebLLM mocks work', async () => {
    const aiProvider = createMockAiProvider({ defaultText: 'AI 回覆' });
    const stream = createMockChatCompletionStream(['你好', '，世界！']);
    const chunks = [];
    for await (const chunk of stream) {
      if (chunk.choices[0].delta.content) {
        chunks.push(chunk.choices[0].delta.content);
      }
    }
    expect(chunks).toEqual(['你好', '，世界！']);

    const onStream = vi.fn();
    const result = await aiProvider.chat({
      messages: [{ role: 'user', content: '嗨' }],
      onStream
    });
    expect(result.text).toBe('AI 回覆');
    expect(onStream).toHaveBeenCalled();

    const webLLM = createMockWebLLMEngine();
    const completion = await webLLM.chat.completions.create({ stream: false });
    expect(completion.choices[0].message.content).toBe('來自 WebLLM 的回應');
  });
});
