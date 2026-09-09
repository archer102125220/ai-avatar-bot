import { callOptionEvent } from './options';

/**
 * 建立大腦串流文字與語音/口型同步管線 (Stream Pipeline)。
 *
 * @param {Object} params
 * @param {import('./types').AiAvatarWidget} [params.widget] - Widget 實例
 * @param {() => import('./types').AiAvatarWidget} [params.getWidget] - 取得 Widget 實例的函式
 * @param {import('./types').AvatarBotOptions} params.options - 原始設定選項
 * @param {() => { brainEngine: any, speechEngine: any, skinEngine: any, toolsEngine: any }} params.getEngines - 取得各引擎實例的函式
 * @param {{ isActive: boolean, continuationIndex: number, maxContinuations: number, accumulatedText: string }} params.autoContinueState - 自動接續狀態物件
 * @param {{ sentenceBuffer: string, buf: string }} params.streamSpeechState - 語音串流緩衝區狀態物件
 * @returns {Object} 串流相關回呼事件集合
 */
export function createStreamPipeline({
  widget,
  getWidget,
  options,
  getEngines,
  autoContinueState,
  streamSpeechState
}) {
  let streamSpeechId = 0;
  const resolveWidget = typeof getWidget === 'function' ? getWidget : () => widget;

  return {
    getStreamSpeechId: () => streamSpeechId,
    setStreamSpeechId: (id) => {
      streamSpeechId = id;
    },

    onStreamStart() {
      const { speechEngine } = getEngines();
      if (speechEngine !== null && typeof speechEngine === 'object') {
        streamSpeechId =
          speechEngine.ttsMuted === true ? 0 : speechEngine.beginSpeech();
      } else {
        streamSpeechId = 0;
      }
      streamSpeechState.sentenceBuffer = '';
      streamSpeechState.buf = '';
    },

    onStreamChunk(chunkDelta) {
      const { speechEngine } = getEngines();
      if (
        streamSpeechId !== 0 &&
        speechEngine !== null &&
        typeof speechEngine === 'object'
      ) {
        if (streamSpeechId !== speechEngine.speakSeq) {
          return;
        }
        streamSpeechState.sentenceBuffer += chunkDelta;
        streamSpeechState.buf += chunkDelta;
        for (const sentence of speechEngine.drainSentences(
          streamSpeechState,
          false
        )) {
          speechEngine.pushSpeech(streamSpeechId, sentence);
        }
      }
    },

    /**
     * 大腦文字串流輸出結束時的回調。
     * 用於將殘餘字串送入語音合成佇列並宣告文字結尾，同時對外派發 onStreamEnd 事件通知開發者回答文字已生成完畢。
     *
     * @param {string} fullText - LLM 完整回答文字內容
     */
    onStreamEnd(fullText) {
      const { speechEngine } = getEngines();
      if (
        speechEngine !== null &&
        typeof speechEngine === 'object' &&
        streamSpeechId !== 0 &&
        streamSpeechId === speechEngine.speakSeq
      ) {
        const remainingSentences = speechEngine.drainSentences(
          streamSpeechState,
          true
        );
        for (const sentence of remainingSentences) {
          speechEngine.pushSpeech(streamSpeechId, sentence);
        }
        speechEngine.endSpeech(streamSpeechId);
      } else if (
        streamSpeechId === 0 &&
        typeof speechEngine?.onUtteranceEnd === 'function'
      ) {
        speechEngine.onUtteranceEnd();
      }

      callOptionEvent(options, resolveWidget(), 'onStreamEnd', fullText);
    },

    onAutoContinueStart(info) {
      autoContinueState.isActive = true;
      autoContinueState.continuationIndex =
        typeof info?.continuationIndex === 'number'
          ? info.continuationIndex
          : 0;
      autoContinueState.maxContinuations =
        typeof info?.maxContinuations === 'number' ? info.maxContinuations : 0;
      autoContinueState.accumulatedText =
        typeof info?.accumulatedText === 'string' ? info.accumulatedText : '';
      callOptionEvent(options, resolveWidget(), 'onAutoContinueStart', info);
    },

    onAutoContinueWait(info) {
      const { skinEngine } = getEngines();
      if (typeof skinEngine === 'object' && skinEngine !== null) {
        if (typeof skinEngine.setEmotion === 'function') {
          skinEngine.setEmotion('thinking');
        } else if (skinEngine.gestureName !== undefined) {
          skinEngine.gestureName = 'thinking';
        }
      }
      callOptionEvent(options, resolveWidget(), 'onAutoContinueWait', info);
    },

    onAutoContinueResume(info) {
      autoContinueState.continuationIndex =
        typeof info?.continuationIndex === 'number'
          ? info.continuationIndex
          : 0;
      autoContinueState.maxContinuations =
        typeof info?.maxContinuations === 'number' ? info.maxContinuations : 0;
      autoContinueState.accumulatedText =
        typeof info?.accumulatedText === 'string' ? info.accumulatedText : '';
      callOptionEvent(options, resolveWidget(), 'onAutoContinueResume', info);
    },

    onAutoContinueEnd(info) {
      autoContinueState.isActive = false;
      callOptionEvent(options, resolveWidget(), 'onAutoContinueEnd', info);
    },

    onInterrupt() {
      const { brainEngine } = getEngines();
      autoContinueState.isActive = false;
      autoContinueState.continuationIndex = 0;
      autoContinueState.maxContinuations = 0;
      autoContinueState.accumulatedText = '';
      if (typeof brainEngine?.llm?.controller?.abort === 'function') {
        try {
          brainEngine.llm.controller.abort();
        } catch (_error) {}
      }
    },

    onSpeechWait(speechSequenceId) {
      const { skinEngine } = getEngines();
      if (autoContinueState.isActive === true) {
        if (typeof skinEngine === 'object' && skinEngine !== null) {
          if (typeof skinEngine.setEmotion === 'function') {
            skinEngine.setEmotion('thinking');
          } else if (skinEngine.gestureName !== undefined) {
            skinEngine.gestureName = 'thinking';
          }
        }
        callOptionEvent(options, resolveWidget(), 'onAutoContinueWait', {
          continuationIndex: autoContinueState.continuationIndex,
          maxContinuations: autoContinueState.maxContinuations,
          accumulatedText: autoContinueState.accumulatedText,
          speechSequenceId
        });
      }
    }
  };
}
