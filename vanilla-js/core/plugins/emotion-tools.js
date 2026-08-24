import {
  DEFAULT_SUPPORTED_EMOTIONS,
  DEFAULT_EMOTION_TOOL_NAME,
  TOOL_ROUTING_MODE_MAP,
  TOOL_RESULT_MODE_MAP,
  TOOL_SCHEMA_TYPE_MAP
} from '../constants';

/**
 * 情緒工具插件的配置選項。
 * 
 * @typedef {Object} EmotionToolsPluginOptions
 * @property {(() => Object|null)} [getSkinEngine=null] - 獨立使用時提供 skinEngine 實例的函式。
 * @property {string[]} [emotions=DEFAULT_SUPPORTED_EMOTIONS] - 支援的情緒或手勢清單。
 * @property {string} [toolName=DEFAULT_EMOTION_TOOL_NAME] - 工具名稱。
 * @property {string} [description] - 工具說明（供 LLM 理解調用時機）。
 * @property {'ai'|'client'|'hybrid'|string} [routingMode=TOOL_ROUTING_MODE_MAP.AI] - 路由模式（'ai' | 'client' | 'hybrid'）。
 * @property {'ai_summary'|'direct'|string} [resultMode=TOOL_RESULT_MODE_MAP.AI_SUMMARY] - 結果處理模式（'ai_summary' | 'direct'）。
 * @property {((emotion: string, context?: Object) => void)} [onEmotionTrigger=null] - 情緒觸發時的回呼函式。
 */

/**
 * 建立情緒與動作控制工具插件的工廠函式。
 *
 * @param {EmotionToolsPluginOptions} [options={}] - 插件配置選項。
 * @returns {import('../tools').ToolDefinition[]} 註冊的工具定義陣列。
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
      execute: async (param1, param2) => {
        const args =
          typeof param1 === 'object' &&
          param1 !== null &&
          param1.args !== undefined
            ? param1.args
            : param1 || {};
        const context =
          typeof param1 === 'object' &&
          param1 !== null &&
          param1.context !== undefined
            ? param1.context
            : param2 || {};

        const emotion = args?.emotion;
        const safeEmotion = typeof emotion === 'string' ? emotion.trim() : '';
        if (safeEmotion === '') {
          return { success: false, reason: 'Invalid emotion' };
        }

        const skin =
          (typeof getSkinEngine === 'function' ? getSkinEngine() : null) ||
          context?.skinEngine;

        if (typeof skin === 'object' && skin !== null) {
          if (typeof skin.setEmotion === 'function') {
            skin.setEmotion(safeEmotion);
          } else if (typeof skin.gesture === 'function') {
            await skin.gesture(safeEmotion);
          }
        } else {
          console.warn(
            'Skin engine is not available for emotion tool:',
            safeEmotion
          );
        }

        if (typeof onEmotionTrigger === 'function') {
          onEmotionTrigger(safeEmotion, context);
        }

        return {
          success: true,
          currentEmotion: safeEmotion
        };
      }
    }
  ];
}
