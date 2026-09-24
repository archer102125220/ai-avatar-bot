import {
  DEFAULT_SUPPORTED_EMOTIONS,
  DEFAULT_EMOTION_TOOL_NAME,
  TOOL_ROUTING_MODE_MAP,
  TOOL_RESULT_MODE_MAP,
  TOOL_SCHEMA_TYPE_MAP
} from '@/core/constants';
import type { ToolDefinition } from '@/core/tools';
import type { SkinEngine } from '@/core/skin';

/**
 * Options for configuring the emotion and gesture tools plugin.
 */
export interface EmotionToolsPluginOptions {
  /** Function providing the SkinEngine instance when used standalone. */
  getSkinEngine?: () => SkinEngine | null;
  /** List of supported emotion or gesture trigger names. */
  emotions?: string[];
  /** Name of the tool registered for emotion dispatching. */
  toolName?: string;
  /** Natural language description explaining to the LLM when to call this tool. */
  description?: string;
  /** Routing decision mode ('client' | 'ai' | 'hybrid'). */
  routingMode?: string;
  /** Result handling mode ('ai_summary' | 'direct'). */
  resultMode?: string;
  /** Optional callback fired when an emotion or gesture is triggered. */
  onEmotionTrigger?:
    ((emotionName: string, context?: Record<string, unknown>) => void) | null;
}

/**
 * Factory function to create the emotion and gesture control tools plugin.
 *
 * @param options - Plugin configuration options.
 * @returns Array of registered tool definitions.
 */
export function createEmotionToolsPlugin(
  options: EmotionToolsPluginOptions = {}
): ToolDefinition[] {
  const {
    getSkinEngine = null,
    emotions = DEFAULT_SUPPORTED_EMOTIONS,
    toolName = DEFAULT_EMOTION_TOOL_NAME,
    description = '當對話情境需要表達情緒（如高興微笑、驚訝、悲傷、思考）或肢體動作（如揮手招呼、鞠躬、放鬆）時呼叫此工具。',
    routingMode = TOOL_ROUTING_MODE_MAP.AI,
    resultMode = TOOL_RESULT_MODE_MAP.AI_SUMMARY,
    onEmotionTrigger = null
  } = options;

  const validEmotions: string[] =
    Array.isArray(emotions) === true && emotions.length > 0
      ? Array.from(emotions)
      : Array.from(DEFAULT_SUPPORTED_EMOTIONS);

  const safeToolName =
    typeof toolName === 'string' && toolName !== ''
      ? toolName
      : DEFAULT_EMOTION_TOOL_NAME;

  return [
    {
      name: safeToolName,
      description,
      routingMode,
      resultMode,
      inputSchema: {
        type: TOOL_SCHEMA_TYPE_MAP.OBJECT,
        properties: {
          emotion: {
            type: TOOL_SCHEMA_TYPE_MAP.STRING,
            enum: validEmotions,
            description: '要表達的情緒或動作名稱'
          }
        },
        required: ['emotion']
      },
      execute: async (
        executionPayloadOrArgs: unknown,
        fallbackContext?: Record<string, unknown>
      ) => {
        const isExecutionPayloadObject =
          typeof executionPayloadOrArgs === 'object' &&
          executionPayloadOrArgs !== null;

        const payloadRecord = isExecutionPayloadObject
          ? (executionPayloadOrArgs as Record<string, unknown>)
          : null;

        const resolvedArgs =
          payloadRecord !== null && payloadRecord.args !== undefined
            ? (payloadRecord.args as Record<string, unknown>)
            : payloadRecord !== null
              ? payloadRecord
              : {};

        const resolvedContext =
          payloadRecord !== null && payloadRecord.context !== undefined
            ? (payloadRecord.context as Record<string, unknown>)
            : typeof fallbackContext === 'object' && fallbackContext !== null
              ? fallbackContext
              : {};

        const emotion = resolvedArgs?.emotion;
        const safeEmotion = typeof emotion === 'string' ? emotion.trim() : '';
        if (safeEmotion === '') {
          return { success: false, reason: 'Invalid emotion' };
        }

        const skinEngineFromGetter =
          typeof getSkinEngine === 'function' ? getSkinEngine() : null;
        const targetSkinEngine =
          skinEngineFromGetter !== null && skinEngineFromGetter !== undefined
            ? (skinEngineFromGetter as unknown as Record<string, unknown>)
            : (resolvedContext?.skinEngine as
                Record<string, unknown> | undefined);

        if (typeof targetSkinEngine === 'object' && targetSkinEngine !== null) {
          if (typeof targetSkinEngine.setEmotion === 'function') {
            (targetSkinEngine.setEmotion as (e: string) => void)(safeEmotion);
          } else if (typeof targetSkinEngine.gesture === 'function') {
            await (targetSkinEngine.gesture as (e: string) => Promise<void>)(
              safeEmotion
            );
          }
        } else {
          console.warn(
            'Skin engine is not available for emotion tool:',
            safeEmotion
          );
        }

        if (typeof onEmotionTrigger === 'function') {
          onEmotionTrigger(safeEmotion, resolvedContext);
        }

        return {
          success: true,
          currentEmotion: safeEmotion
        };
      }
    }
  ];
}
