import { callOptionEvent } from './options';

/**
 * Creates the Brain streaming text and Speech audio/lip-sync synchronization pipeline (Stream Pipeline).
 *
 * @param {Object} params
 * @param {import('@types').AiAvatarWidget} [params.widget] - Widget instance.
 * @param {() => import('@types').AiAvatarWidget} [params.getWidget] - Getter returning the widget instance.
 * @param {import('@types').AvatarBotOptions} params.options - Raw configuration options.
 * @param {() => { brainEngine: any, speechEngine: any, skinEngine: any, toolsEngine: any }} params.getEngines - Getter returning all engine instances.
 * @param {{ isActive: boolean, continuationIndex: number, maxContinuations: number, accumulatedText: string }} params.autoContinueState - Auto-continue state tracking object.
 * @param {{ sentenceBuffer: string, buf: string }} params.streamSpeechState - Speech streaming buffer state object.
 * @returns {Object} Stream lifecycle callback methods.
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
  const resolveWidget =
    typeof getWidget === 'function' ? getWidget : () => widget;

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
     * Callback invoked when the Brain LLM stream completes.
     * Flushes any remaining text to the speech synthesis queue and emits the `onStreamEnd` event.
     *
     * @param {string} fullText - Full generated LLM answer text.
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
