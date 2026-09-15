import { describe, it, expect, vi } from 'vitest';
import { initToolsEngine, validateToolsEngine } from '@/core/tools';
import {
  TOOL_CANCEL_REASON_MAP,
  CHAT_SOURCE_MAP
} from '@/core/constants';



describe('Unit Test: core/tools/index.js (Tools Engine)', () => {
  describe('validateToolsEngine', () => {
    it('should validate complete tools engine correctly', () => {
      const validEngine = {
        routeHostTool: vi.fn(),
        prepareTool: vi.fn(),
        continueToolInput: vi.fn(),
        offerToolChoices: vi.fn(),
        continueToolChoice: vi.fn(),
        chooseTool: vi.fn(),
        offerHostTool: vi.fn(),
        executePendingTool: vi.fn(),
        cancelPendingTool: vi.fn(),
        continueToolConfirmation: vi.fn(),
        handleToolResult: vi.fn()
      };
      const result = validateToolsEngine(validEngine);
      expect(result.isValid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('should report missing methods for incomplete or non-object engine', () => {
      expect(validateToolsEngine(null).isValid).toBe(false);
      expect(validateToolsEngine({}).isValid).toBe(false);
      const partial = { routeHostTool: vi.fn() };
      const res = validateToolsEngine(partial);
      expect(res.isValid).toBe(false);
      expect(res.missing).toContain('prepareTool');
    });
  });

  describe('initToolsEngine - Initialization and Setters', () => {
    it('should initialize with default timeout and getters/setters', () => {
      const onAddChatMessage = vi.fn();
      const onUpdateChatMessage = vi.fn();
      const onSetHistoryOpen = vi.fn();
      const onRenderHistory = vi.fn();
      const onSpokenAudioPlayNow = vi.fn();

      const engine = initToolsEngine({
        confirmationTimeoutMs: 8000,
        onAddChatMessage,
        onUpdateChatMessage,
        onSetHistoryOpen,
        onRenderHistory,
        onSpokenAudioPlayNow,
        getChatLog: () => [],
        getChatSeq: () => 1
      });

      expect(engine.confirmationTimeoutMs).toBe(8000);
      engine.confirmationTimeoutMs = 12000;
      expect(engine.confirmationTimeoutMs).toBe(12000);
      // invalid value guard
      engine.confirmationTimeoutMs = -5;
      expect(engine.confirmationTimeoutMs).toBe(12000);

      expect(engine.onAddChatMessage).toBe(onAddChatMessage);
      expect(engine.onUpdateChatMessage).toBe(onUpdateChatMessage);
      expect(engine.onSetHistoryOpen).toBe(onSetHistoryOpen);
      expect(engine.onRenderHistory).toBe(onRenderHistory);
      expect(engine.onSpokenAudioPlayNow).toBe(onSpokenAudioPlayNow);
    });

    it('should route tools and convert schemas to OpenAI tools', () => {
      const engine = initToolsEngine({
        getChatLog: () => [],
        getChatSeq: () => 1
      });
      engine.HOST_TOOLS = [
        {
          name: 'get_time',
          label: '查詢時間',
          description: '取得當前時間',
          keywords: ['時間', '幾點'],
          inputSchema: { type: 'object', properties: {} }
        }
      ];

      expect(engine.getAiAvailableTools()).toHaveLength(1);
      expect(engine.toOpenAiTools()).toHaveLength(1);
      const routed = engine.routeHostTool('現在幾點');
      expect(routed.match).toBeDefined();
      expect(routed.match.tool.name).toBe('get_time');
    });
  });

  describe('Parameter Collection & continueToolInput', () => {
    const weatherTool = {
      name: 'get_weather',
      label: '查詢天氣',
      description: '查詢特定城市的天氣',
      inputSchema: {
        type: 'object',
        properties: {
          city: { title: '城市名稱', type: 'string' }
        },
        required: ['city']
      },
      execute: vi.fn(async ({ args }) => `天氣：${args.city} 晴天`)
    };

    it('should prompt user for missing parameters during prepareTool', () => {
      const onAddChatMessage = vi.fn();
      const onSpokenAudioPlayNow = vi.fn();

      const engine = initToolsEngine({
        onAddChatMessage,
        onSpokenAudioPlayNow,
        getChatLog: () => [],
        getChatSeq: () => 1
      });

      engine.prepareTool(weatherTool, '幫我查天氣', { confidence: 0.9 }, {});

      expect(engine.pendingToolInput).toBeDefined();
      expect(engine.pendingToolInput.missing).toContain('city');
      expect(onAddChatMessage).toHaveBeenCalledWith('assistant', expect.stringContaining('請提供城市名稱'), { source: 'tool' });
      expect(onSpokenAudioPlayNow).toHaveBeenCalled();
    });

    it('should handle cancel during continueToolInput', () => {
      const onAddChatMessage = vi.fn();
      const onSpokenAudioPlayNow = vi.fn();

      const engine = initToolsEngine({
        onAddChatMessage,
        onSpokenAudioPlayNow,
        getChatLog: () => [],
        getChatSeq: () => 1
      });

      engine.pendingToolInput = {
        tool: weatherTool,
        query: '查天氣',
        routeMeta: {},
        args: {},
        missing: ['city']
      };

      const handled = engine.continueToolInput('算了');
      expect(handled).toBe(true);
      expect(engine.pendingToolInput).toBeNull();
      expect(onAddChatMessage).toHaveBeenCalledWith('assistant', '好的，已取消這個操作。', { source: 'tool' });
    });

    it('should return false when continueToolInput called with no pending input', () => {
      const engine = initToolsEngine({
        getChatLog: () => [],
        getChatSeq: () => 1
      });
      expect(engine.continueToolInput('台北')).toBe(false);
    });

    it('should collect missing param on continueToolInput and proceed to tool execution', () => {
      const onSpokenAudioPlayNow = vi.fn();
      const chatLog = [];

      const engine = initToolsEngine({

        onAddChatMessage: vi.fn((role, text, opts) => {
          const id = opts?.id || `msg_${Date.now()}`;
          chatLog.push({ id, role, text, ...opts });
          return id;
        }),
        onSpokenAudioPlayNow,
        getChatLog: () => chatLog,
        getChatSeq: () => 1
      });

      engine.pendingToolInput = {
        tool: weatherTool,
        query: '查天氣',
        routeMeta: {},
        args: {},
        missing: ['city']
      };

      const handled = engine.continueToolInput('台北');
      expect(handled).toBe(true);
      expect(engine.pendingToolInput).toBeNull();
    });
  });

  describe('Ambiguous Choices: offerToolChoices, continueToolChoice, chooseTool', () => {
    const toolA = { name: 'tool_a', label: '播放音樂', keywords: ['音樂', '聽歌'] };
    const toolB = { name: 'tool_b', label: '查詢天氣', keywords: ['天氣', '氣溫'] };

    it('should offer choices and open history panel', () => {
      const onAddChatMessage = vi.fn(() => 'choice_msg_1');
      const onSetHistoryOpen = vi.fn();
      const onSpokenAudioPlayNow = vi.fn();
      const chatLog = [{ id: 'choice_msg_1', role: 'assistant', text: '' }];

      const engine = initToolsEngine({
        onAddChatMessage,
        onSetHistoryOpen,
        onSpokenAudioPlayNow,
        getChatLog: () => chatLog,
        getChatSeq: () => 1
      });

      engine.offerToolChoices('我想聽', [
        { tool: toolA, score: 0.6 },
        { tool: toolB, score: 0.5 }
      ]);

      expect(engine.pendingToolChoice).toBeDefined();
      expect(engine.pendingToolChoice.messageId).toBe('choice_msg_1');
      expect(onSetHistoryOpen).toHaveBeenCalledWith(true);
      expect(onSpokenAudioPlayNow).toHaveBeenCalled();
    });

    it('should handle cancel during continueToolChoice', () => {
      const chatLog = [{ id: 'choice_msg_1', role: 'assistant', text: '', pendingChoices: [{ tool: toolA }] }];
      const onRenderHistory = vi.fn();
      const onSpokenAudioPlayNow = vi.fn();

      const engine = initToolsEngine({
        onRenderHistory,
        onSpokenAudioPlayNow,
        getChatLog: () => chatLog,
        getChatSeq: () => 1
      });

      engine.pendingToolChoice = {
        messageId: 'choice_msg_1',
        choices: [{ tool: toolA }]
      };

      const handled = engine.continueToolChoice('取消');
      expect(handled).toBe(true);
      expect(engine.pendingToolChoice).toBeNull();
      expect(chatLog[0].text).toBe('好的，已取消。');
      expect(onRenderHistory).toHaveBeenCalled();
      expect(onSpokenAudioPlayNow).toHaveBeenCalledWith('好的，已取消這個操作。');
    });

    it('should select choice by ordinal number ("第一個", "2", or routed keyword)', () => {
      const chatLog = [{ id: 'choice_msg_1', role: 'assistant', text: '', choiceQuery: '我想聽', pendingChoices: [{ tool: toolA }, { tool: toolB }] }];
      const onRenderHistory = vi.fn();
      const onAddChatMessage = vi.fn();

      const engine = initToolsEngine({
        onRenderHistory,
        onAddChatMessage,
        getChatLog: () => chatLog,
        getChatSeq: () => 1
      });

      engine.pendingToolChoice = {
        messageId: 'choice_msg_1',
        choices: [{ tool: toolA, score: 0.8 }, { tool: toolB, score: 0.7 }]
      };

      const handled = engine.continueToolChoice('第一個');
      expect(handled).toBe(true);
      expect(engine.pendingToolChoice).toBeNull();
      expect(chatLog[0].text).toContain('已選擇「播放音樂」');
      expect(onRenderHistory).toHaveBeenCalled();
    });

    it('should prompt if choice input is unrecognized', () => {
      const onAddChatMessage = vi.fn();
      const onSpokenAudioPlayNow = vi.fn();

      const engine = initToolsEngine({
        onAddChatMessage,
        onSpokenAudioPlayNow,
        getChatLog: () => [],
        getChatSeq: () => 1
      });

      engine.pendingToolChoice = {
        messageId: 'msg_1',
        choices: [{ tool: toolA }]
      };

      const handled = engine.continueToolChoice('隨便啦');
      expect(handled).toBe(true);
      expect(onAddChatMessage).toHaveBeenCalledWith('assistant', expect.stringContaining('請說「第一個、第二個、第三個」'), { source: 'tool' });
    });
  });

  describe('Tool Confirmation, Execution, and Cancellation Flows', () => {
    it('should offer confirmation for tools with requiresConfirmation: true', () => {
      vi.useFakeTimers();
      const onAddChatMessage = vi.fn();
      const onSetHistoryOpen = vi.fn();
      const onSpokenAudioPlayNow = vi.fn();
      const onToolOffer = vi.fn();

      const confirmTool = {
        name: 'delete_file',
        label: '刪除檔案',
        requiresConfirmation: true,
        confirmationTimeoutMs: 5000,
        inputSchema: { type: 'object', properties: {} },
        execute: vi.fn(async () => '已刪除')
      };

      const engine = initToolsEngine({
        onAddChatMessage,
        onSetHistoryOpen,
        onSpokenAudioPlayNow,
        onToolOffer,
        getChatLog: () => [],
        getChatSeq: () => 1
      });

      engine.offerHostTool(confirmTool, '刪除檔案', { reason: 'test' }, {}, { callId: 'call_del_1' });

      expect(engine.pendingToolConfirmation).toBe('call_del_1');
      expect(onAddChatMessage).toHaveBeenCalledWith('assistant', expect.stringContaining('要幫你執行「刪除檔案」嗎？'), expect.objectContaining({ id: 'call_del_1' }));
      expect(onSetHistoryOpen).toHaveBeenCalledWith(true);
      expect(onSpokenAudioPlayNow).toHaveBeenCalled();
      expect(onToolOffer).toHaveBeenCalledWith(expect.objectContaining({ name: 'delete_file', confirmation: true }));

      vi.useRealTimers();
    });

    it('should execute pending tool when user confirms with "好的" / "yes"', async () => {
      const onRenderHistory = vi.fn();
      const onToolConfirm = vi.fn();
      const executeMock = vi.fn(async () => ({ ok: true, message: '刪除成功' }));

      const pendingToolData = {
        name: 'delete_file',
        label: '刪除檔案',
        tool: {
          name: 'delete_file',
          label: '刪除檔案',
          execute: executeMock
        },
        input: { args: { path: '/tmp/test.txt' } }
      };

      const chatLog = [{
        id: 'call_del_2',
        role: 'assistant',
        text: '要執行嗎？',
        pendingTool: pendingToolData
      }];

      const engine = initToolsEngine({
        onRenderHistory,
        onToolConfirm,
        getChatLog: () => chatLog,
        getChatSeq: () => 1
      });

      engine.pendingToolConfirmation = 'call_del_2';
      const handled = engine.continueToolConfirmation('好');
      expect(handled).toBe(true);
      expect(chatLog[0].text).toContain('正在執行「刪除檔案」');
      expect(onToolConfirm).toHaveBeenCalledWith({ name: 'delete_file', toolCallId: undefined });
      expect(executeMock).toHaveBeenCalled();
    });

    it('should cancel pending tool when user says "取消" or sends new input topic', () => {
      const onRenderHistory = vi.fn();
      const onToolCancel = vi.fn();
      const onConfirmResume = vi.fn();

      const chatLog = [{
        id: 'call_del_3',
        role: 'assistant',
        text: '要執行嗎？',
        pendingTool: {
          name: 'delete_file',
          onConfirmResume
        }
      }];

      const engine = initToolsEngine({
        onRenderHistory,
        onToolCancel,
        isConvoOn: () => true,
        onSpokenAudioPlayNow: vi.fn(),
        getChatLog: () => chatLog,
        getChatSeq: () => 1
      });

      engine.pendingToolConfirmation = 'call_del_3';
      const handled = engine.continueToolConfirmation('不要');
      expect(handled).toBe(true);
      expect(chatLog[0].text).toBe('好的，已取消。');
      expect(onConfirmResume).toHaveBeenCalledWith({ cancelled: true, reason: TOOL_CANCEL_REASON_MAP.USER_CANCEL });
      expect(onToolCancel).toHaveBeenCalledWith(expect.objectContaining({ name: 'delete_file', reason: TOOL_CANCEL_REASON_MAP.USER_CANCEL }));

      // test new input topic auto-cancel
      chatLog[0].pendingTool = { name: 'delete_file', onConfirmResume };
      engine.pendingToolConfirmation = 'call_del_3';
      const handledNew = engine.continueToolConfirmation('今天天氣如何？');
      expect(handledNew).toBe(false);
      expect(chatLog[0].cancelled).toBe(true);
      expect(chatLog[0].text).toBe('已取消（已轉移話題）。');
    });

    it('should handle tool confirmation timeout automatically', () => {
      vi.useFakeTimers();
      const onToolCancel = vi.fn();
      const chatLog = [{
        id: 'call_timeout_1',
        role: 'assistant',
        text: '要執行嗎？',
        pendingTool: { name: 'dangerous_action' }
      }];

      const engine = initToolsEngine({
        onToolCancel,
        getChatLog: () => chatLog,
        getChatSeq: () => 1
      });

      const timeoutTool = {
        name: 'dangerous_action',
        label: '危險操作',
        requiresConfirmation: true,
        confirmationTimeoutMs: 3000,
        inputSchema: { type: 'object', properties: {} }
      };

      engine.offerHostTool(timeoutTool, '危險操作', {}, {}, { callId: 'call_timeout_1' });
      expect(engine.pendingToolConfirmation).toBe('call_timeout_1');

      // Fast forward past 3000ms
      vi.advanceTimersByTime(3500);

      expect(chatLog[0].timedOut).toBe(true);
      expect(chatLog[0].text).toBe('操作已逾時失效。');
      expect(onToolCancel).toHaveBeenCalledWith(expect.objectContaining({ reason: TOOL_CANCEL_REASON_MAP.TIMEOUT }));

      vi.useRealTimers();
    });

    it('should handle tool result and update chat message or add new message', () => {
      const onUpdateChatMessage = vi.fn();
      const onAddChatMessage = vi.fn();
      const onSpokenAudioPlayNow = vi.fn();

      const chatLog = [{ id: 'msg_res_1', role: 'assistant', text: '執行中...' }];

      const engine = initToolsEngine({
        onUpdateChatMessage,
        onAddChatMessage,
        onSpokenAudioPlayNow,
        getChatLog: () => chatLog,
        getChatSeq: () => 1
      });

      // existing message update
      engine.handleToolResult({
        ok: true,
        message: '操作完成',
        callId: 'msg_res_1',
        name: 'test_tool'
      });
      expect(onUpdateChatMessage).toHaveBeenCalledWith('msg_res_1', '操作完成', false);
      expect(onSpokenAudioPlayNow).toHaveBeenCalledWith('操作完成');

      // non-existing message addition
      engine.handleToolResult({
        ok: false,
        error: '網路中斷',
        callId: 'missing_id',
        name: 'test_tool'
      });
      expect(onAddChatMessage).toHaveBeenCalledWith('assistant', '執行失敗：網路中斷', { source: CHAT_SOURCE_MAP.TOOL });
    });

    it('should handle executeToolDirectly errors and onConfirmResume callback', async () => {
      const crashingTool = {
        name: 'crash_tool',
        label: '當機工具',
        execute: vi.fn(async () => {
          throw new Error('Database locked');
        })
      };

      const onConfirmResume = vi.fn();
      const engine = initToolsEngine({
        getChatLog: () => [],
        getChatSeq: () => 1
      });

      const res = await engine.executeToolDirectly(
        crashingTool,
        {},
        { onConfirmResume, callId: 'call_1' }
      );

      expect(res.ok).toBe(false);
      expect(res.error).toBe('Database locked');
      expect(onConfirmResume).toHaveBeenCalledWith({ ok: false, error: 'Database locked' });
    });

    it('should handle cancelPendingTool and executePendingTool edge cases and callbacks', () => {
      const onToolCancel = vi.fn();
      const onToolConfirm = vi.fn();
      const onToolCall = vi.fn();
      const onSpokenAudioPlayNow = vi.fn();
      const onRenderHistory = vi.fn();

      const chatLog = [
        {
          id: 'msg_tool_1',
          pendingTool: {
            name: 'custom_host_tool',
            label: '自訂宿主工具',
            toolCallId: 'call_custom_1',
            input: { args: { count: 5 } },
            onConfirmResume: vi.fn(),
            tool: {} // no execute method
          }
        },
        {
          id: 'msg_no_tool',
          text: '無待處理工具'
        }
      ];

      const engine = initToolsEngine({
        onToolCancel,
        onToolConfirm,
        onToolCall,
        onSpokenAudioPlayNow,
        onRenderHistory,
        isConvoOn: () => true,
        getChatLog: () => chatLog,
        getChatSeq: () => 2
      });

      // cancel non-existing or invalid pending tool
      engine.cancelPendingTool('missing_id');
      engine.cancelPendingTool('msg_no_tool');

      // cancel pending tool with convoOn
      engine.cancelPendingTool('msg_tool_1', { reason: TOOL_CANCEL_REASON_MAP.USER_CANCEL });
      expect(onToolCancel).toHaveBeenCalledWith({
        name: 'custom_host_tool',
        reason: TOOL_CANCEL_REASON_MAP.USER_CANCEL,
        toolCallId: 'call_custom_1'
      });
      expect(onSpokenAudioPlayNow).toHaveBeenCalledWith('好的，已取消。');

      // test executePendingTool without tool.execute triggers onToolCall & onToolConfirm
      chatLog[0].pendingTool = {
        name: 'custom_host_tool',
        label: '自訂宿主工具',
        toolCallId: 'call_custom_2',
        input: { args: { count: 10 } },
        tool: {}
      };
      engine.executePendingTool('msg_tool_1');
      expect(onToolCall).toHaveBeenCalled();
      expect(onToolConfirm).toHaveBeenCalledWith({
        name: 'custom_host_tool',
        toolCallId: 'call_custom_2'
      });

      // continueToolConfirmation when no pending confirmation is active
      expect(engine.continueToolConfirmation('好')).toBe(false);
    });
  });
});
