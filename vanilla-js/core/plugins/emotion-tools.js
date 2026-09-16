import {
  DEFAULT_SUPPORTED_EMOTIONS,
  DEFAULT_EMOTION_TOOL_NAME,
  TOOL_ROUTING_MODE_MAP,
  TOOL_RESULT_MODE_MAP,
  TOOL_SCHEMA_TYPE_MAP
} from '@/core/constants';

/**
 * @typedef {import('@types').EmotionToolsPluginOptions} EmotionToolsPluginOptions
 */

/**
 * Factory function to create the emotion and gesture control tools plugin.
 *
 * @param {EmotionToolsPluginOptions} [options={}] - Plugin configuration options.
 * @returns {import('@types').ToolDefinition[]} Array of registered tool definitions.
 */
export function createEmotionToolsPlugin(options = {}) {
  const {
    getSkinEngine = null,
    emotions = DEFAULT_SUPPORTED_EMOTIONS,
    toolName = DEFAULT_EMOTION_TOOL_NAME,
    description = '當對話情境需要表達情緒（如高興微笑、驚訝、悲傷、思考）或肢體動作（如揮手招呼、鞠躬、放鬆）時呼叫此工具。',
    routingMode = TOOL_ROUTING_MODE_MAP.AI,
    resultMode = TOOL_RESULT_MODE_MAP.AI_SUMMARY,
    onEmotionTrigger = null
  } = options;

  const validEmotions =
    Array.isArray(emotions) === true && emotions.length > 0
      ? emotions
      : DEFAULT_SUPPORTED_EMOTIONS;

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
      execute: async (executionPayloadOrArgs, fallbackContext) => {
        const isExecutionPayloadObject =
          typeof executionPayloadOrArgs === 'object' &&
          executionPayloadOrArgs !== null;

        const resolvedArgs =
          isExecutionPayloadObject === true &&
          executionPayloadOrArgs.args !== undefined
            ? executionPayloadOrArgs.args
            : isExecutionPayloadObject === true
              ? executionPayloadOrArgs
              : {};

        const resolvedContext =
          isExecutionPayloadObject === true &&
          executionPayloadOrArgs.context !== undefined
            ? executionPayloadOrArgs.context
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
            ? skinEngineFromGetter
            : resolvedContext?.skinEngine;

        if (typeof targetSkinEngine === 'object' && targetSkinEngine !== null) {
          if (typeof targetSkinEngine.setEmotion === 'function') {
            targetSkinEngine.setEmotion(safeEmotion);
          } else if (typeof targetSkinEngine.gesture === 'function') {
            await targetSkinEngine.gesture(safeEmotion);
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
