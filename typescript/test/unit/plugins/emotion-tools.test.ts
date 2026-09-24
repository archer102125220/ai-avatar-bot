import { describe, it, expect, vi } from 'vitest';
import { createEmotionToolsPlugin } from '@/core/plugins/emotion-tools';
import {
  DEFAULT_SUPPORTED_EMOTIONS,
  DEFAULT_EMOTION_TOOL_NAME,
  TOOL_ROUTING_MODE_MAP,
  TOOL_RESULT_MODE_MAP,
  TOOL_SCHEMA_TYPE_MAP
} from '@/core/constants';
import type { ToolDefinition } from '@/core/tools/types';
import type { SkinEngine } from '@core';

interface ExecutableEmotionTool extends ToolDefinition {
  inputSchema: NonNullable<ToolDefinition['inputSchema']>;
  execute: NonNullable<ToolDefinition['execute']>;
}

describe('Emotion Tools Plugin', () => {
  it('should generate valid emotion tool definition with defaults', () => {
    const tools = createEmotionToolsPlugin();

    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBe(1);

    const tool = tools[0] as ExecutableEmotionTool;
    expect(tool.name).toBe(DEFAULT_EMOTION_TOOL_NAME);
    expect(tool.routingMode).toBe(TOOL_ROUTING_MODE_MAP.AI);
    expect(tool.resultMode).toBe(TOOL_RESULT_MODE_MAP.AI_SUMMARY);
    expect(tool.inputSchema.type).toBe(TOOL_SCHEMA_TYPE_MAP.OBJECT);
    expect(tool.inputSchema.properties?.emotion?.enum).toEqual(
      DEFAULT_SUPPORTED_EMOTIONS
    );
    expect(tool.inputSchema.required).toEqual(['emotion']);
    expect(typeof tool.execute).toBe('function');
  });

  it('should accept custom toolName, custom emotions list, and custom routing/result modes', () => {
    const customEmotions = ['happy', 'surprised'];
    const tools = createEmotionToolsPlugin({
      toolName: 'custom_emotion_tool',
      emotions: customEmotions,
      routingMode: 'client' as unknown as typeof TOOL_ROUTING_MODE_MAP.CLIENT,
      resultMode: 'direct' as unknown as typeof TOOL_RESULT_MODE_MAP.DIRECT
    });

    const tool = tools[0] as ExecutableEmotionTool;
    expect(tool.name).toBe('custom_emotion_tool');
    expect(tool.routingMode).toBe('client');
    expect(tool.resultMode).toBe('direct');
    expect(tool.inputSchema.properties?.emotion?.enum).toEqual(customEmotions);
  });

  it('should execute successfully with targetSkinEngine.setEmotion and trigger callback', async () => {
    const mockSkinEngine = {
      setEmotion: vi.fn()
    };
    const onEmotionTrigger = vi.fn();

    const tools = createEmotionToolsPlugin({
      getSkinEngine: () => mockSkinEngine as unknown as SkinEngine,
      onEmotionTrigger
    });

    const tool = tools[0] as ExecutableEmotionTool;
    const result = await tool.execute(
      { emotion: 'happy' },
      { customContext: true }
    );

    expect(result).toEqual({
      success: true,
      currentEmotion: 'happy'
    });
    expect(mockSkinEngine.setEmotion).toHaveBeenCalledWith('happy');
    expect(onEmotionTrigger).toHaveBeenCalledWith('happy', {
      customContext: true
    });
  });

  it('should fallback to targetSkinEngine.gesture if setEmotion is not available', async () => {
    const mockSkinEngine = {
      gesture: vi.fn()
    };

    const tools = createEmotionToolsPlugin();
    const tool = tools[0] as ExecutableEmotionTool;

    const payload = {
      args: { emotion: 'wave' },
      context: { skinEngine: mockSkinEngine }
    };

    const result = await tool.execute(
      payload as unknown as Record<string, unknown>
    );

    expect(result).toEqual({
      success: true,
      currentEmotion: 'wave'
    });
    expect(mockSkinEngine.gesture).toHaveBeenCalledWith('wave');
  });

  it('should return failure if emotion argument is empty or invalid', async () => {
    const tools = createEmotionToolsPlugin();
    const tool = tools[0] as ExecutableEmotionTool;

    const result1 = await tool.execute({ emotion: '' });
    expect(result1).toEqual({
      success: false,
      reason: 'Invalid emotion'
    });

    const result2 = await tool.execute({});
    expect(result2).toEqual({
      success: false,
      reason: 'Invalid emotion'
    });
  });

  it('should warn when skin engine is not available for emotion tool (line 125)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tools = createEmotionToolsPlugin({
      getSkinEngine: () => null
    });
    const tool = tools[0] as ExecutableEmotionTool;
    const result = await tool.execute({ emotion: 'happy' }, {});
    expect(result).toEqual({
      success: true,
      currentEmotion: 'happy'
    });
    expect(warnSpy).toHaveBeenCalledWith(
      'Skin engine is not available for emotion tool:',
      'happy'
    );
    warnSpy.mockRestore();
  });
});
