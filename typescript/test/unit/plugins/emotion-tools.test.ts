import { describe, it, expect, vi } from 'vitest';
import { createEmotionToolsPlugin } from '@/core/plugins/emotion-tools';
import {
  DEFAULT_SUPPORTED_EMOTIONS,
  DEFAULT_EMOTION_TOOL_NAME,
  TOOL_ROUTING_MODE_MAP,
  TOOL_RESULT_MODE_MAP,
  TOOL_SCHEMA_TYPE_MAP
} from '@/core/constants';

describe('Emotion Tools Plugin', () => {
  it('should generate valid emotion tool definition with defaults', () => {
    const tools = createEmotionToolsPlugin();

    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBe(1);

    const tool = tools[0] as any;
    expect(tool.name).toBe(DEFAULT_EMOTION_TOOL_NAME);
    expect(tool.routingMode).toBe(TOOL_ROUTING_MODE_MAP.AI);
    expect(tool.resultMode).toBe(TOOL_RESULT_MODE_MAP.AI_SUMMARY);
    expect(tool.inputSchema.type).toBe(TOOL_SCHEMA_TYPE_MAP.OBJECT);
    expect(tool.inputSchema.properties.emotion.enum).toEqual(DEFAULT_SUPPORTED_EMOTIONS);
    expect(tool.inputSchema.required).toEqual(['emotion']);
    expect(typeof tool.execute).toBe('function');
  });

  it('should accept custom toolName, custom emotions list, and custom routing/result modes', () => {
    const customEmotions = ['happy', 'surprised'];
    const tools = createEmotionToolsPlugin({
      toolName: 'custom_emotion_tool',
      emotions: customEmotions,
      routingMode: 'client' as any,
      resultMode: 'direct' as any
    });

    const tool = tools[0] as any;
    expect(tool.name).toBe('custom_emotion_tool');
    expect(tool.routingMode).toBe('client');
    expect(tool.resultMode).toBe('direct');
    expect(tool.inputSchema.properties.emotion.enum).toEqual(customEmotions);
  });

  it('should execute successfully with targetSkinEngine.setEmotion and trigger callback', async () => {
    const mockSkinEngine = {
      setEmotion: vi.fn()
    };
    const onEmotionTrigger = vi.fn();

    const tools = createEmotionToolsPlugin({
      getSkinEngine: () => mockSkinEngine as any,
      onEmotionTrigger
    });

    const tool = tools[0] as any;
    const result = await tool.execute({ emotion: 'happy' }, { customContext: true });

    expect(result).toEqual({
      success: true,
      currentEmotion: 'happy'
    });
    expect(mockSkinEngine.setEmotion).toHaveBeenCalledWith('happy');
    expect(onEmotionTrigger).toHaveBeenCalledWith('happy', { customContext: true });
  });

  it('should fallback to targetSkinEngine.gesture if setEmotion is not available', async () => {
    const mockSkinEngine = {
      gesture: vi.fn()
    };

    const tools = createEmotionToolsPlugin();
    const tool = tools[0] as any;

    const payload = {
      args: { emotion: 'wave' },
      context: { skinEngine: mockSkinEngine }
    };

    const result = await tool.execute(payload as any);

    expect(result).toEqual({
      success: true,
      currentEmotion: 'wave'
    });
    expect(mockSkinEngine.gesture).toHaveBeenCalledWith('wave');
  });

  it('should return failure if emotion argument is empty or invalid', async () => {
    const tools = createEmotionToolsPlugin();
    const tool = tools[0] as any;

    const result1 = await tool.execute({ emotion: '' });
    expect(result1).toEqual({
      success: false,
      reason: 'Invalid emotion'
    });

    // @ts-ignore: Defensive runtime type checking test
    const result2 = await tool.execute({});
    expect(result2).toEqual({
      success: false,
      reason: 'Invalid emotion'
    });
  });
});
