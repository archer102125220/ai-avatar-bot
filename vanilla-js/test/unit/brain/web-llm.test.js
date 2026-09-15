import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initWebLLM, chatWithWebLLM } from '../../../core/brain/web-llm';
import {
  STATE_MAP,
  LLM_FINISH_REASON_MAP
} from '../../../core/constants';

vi.mock('@mlc-ai/web-llm', () => ({
  CreateMLCEngine: vi.fn().mockImplementation((model, options) => {
    if (typeof options?.initProgressCallback === 'function') {
      options.initProgressCallback({ progress: 0.5, text: 'Loading...' });
      options.initProgressCallback({ progress: 1.0, text: 'Ready' });
    }
    return Promise.resolve({
      chat: {
        completions: {
          create: vi.fn().mockImplementation((opt) => {
            if (opt.stream === true) {
              return (async function* () {
                yield { choices: [{ delta: { content: '你好' } }] };
                yield { choices: [{ delta: { content: '，世界！' }, finish_reason: 'stop' }] };
              })();
            }
            return Promise.resolve({
              choices: [
                {
                  message: { role: 'assistant', content: 'WebLLM 回應內容' },
                  finish_reason: 'stop'
                }
              ]
            });
          })
        }
      }
    });
  })
}));

describe('Unit Test: core/brain/web-llm.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initWebLLM', () => {
    it('should initialize with default idle state and model', () => {
      const llm = initWebLLM({
        llmModel: 'Llama-3-8B-Instruct-q4f32_1-MLC'
      });

      expect(llm.state).toBe(STATE_MAP.IDLE);
      expect(llm.progress).toBe(0);
      expect(llm.model).toBe('Llama-3-8B-Instruct-q4f32_1-MLC');
      expect(llm.supported).toBe(true); // navigator.gpu is mocked in test/setup.js
    });
  });

  describe('load', () => {
    it('should trigger dynamic import, track progress, and transition to READY state', async () => {
      const onLoading = vi.fn();
      const onLoadProgress = vi.fn();
      const onLoaded = vi.fn();

      const llm = initWebLLM({
        llmModel: 'Llama-3-8B-Instruct',
        onLoading,
        onLoadProgress,
        onLoaded
      });

      await llm.load();

      expect(onLoading).toHaveBeenCalledOnce();
      expect(onLoadProgress).toHaveBeenCalledTimes(2);
      expect(llm.progress).toBe(1.0);
      expect(llm.state).toBe(STATE_MAP.READY);
      expect(onLoaded).toHaveBeenCalledOnce();
    });
  });

  describe('chat', () => {
    it('should perform non-stream chat completion and return text', async () => {
      const llm = initWebLLM({
        llmModel: 'Llama-3-8B-Instruct',
        llmIsStream: false
      });

      await llm.load();

      const response = await llm.chat([
        { role: 'user', content: '請問你是誰？' }
      ]);

      expect(response.type).toBe('text');
      expect(response.content).toBe('WebLLM 回應內容');
      expect(response.finishReason).toBe('stop');
    });

    it('should perform stream chat completion and invoke delta callback', async () => {
      const llm = initWebLLM({
        llmModel: 'Llama-3-8B-Instruct',
        llmIsStream: true
      });

      await llm.load();

      const onDelta = vi.fn();
      const response = await llm.chat(
        [{ role: 'user', content: '打招呼' }],
        onDelta
      );

      expect(onDelta).toHaveBeenCalledTimes(2);
      expect(response.type).toBe('text');
      expect(response.content).toBe('你好，世界！');
    });
  });

  describe('chatWithWebLLM', () => {
    it('should orchestrate streaming pipeline with brain engine hooks', async () => {
      const onStreamStart = vi.fn();
      const onStreamChunk = vi.fn();
      const onStreamEnd = vi.fn();
      const onSpokenDisplayTextChange = vi.fn();
      const updateChatMessage = vi.fn();

      const llm = initWebLLM({
        llmModel: 'Llama-3-8B-Instruct',
        llmIsStream: true
      });
      await llm.load();

      const brainEngine = {
        llm,
        locale: 'zh-TW',
        knowledge: [],
        memory: { enabled: true, data: { history: [] }, addTurn: vi.fn() },
        compression: {},
        onStreamStart,
        onStreamChunk,
        onStreamEnd,
        onSpokenDisplayTextChange,
        updateChatMessage
      };

      await chatWithWebLLM(brainEngine, '請問今天心情如何？');

      expect(onStreamStart).toHaveBeenCalledOnce();
      expect(onStreamChunk).toHaveBeenCalledTimes(2);
      expect(onStreamEnd).toHaveBeenCalledWith('你好，世界！');
      expect(brainEngine.memory.addTurn).toHaveBeenCalledWith('assistant', '你好，世界！');
    });
  });
});
