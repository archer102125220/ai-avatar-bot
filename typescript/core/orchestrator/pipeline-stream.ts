import { callOptionEvent } from './options';
import type { AiAvatarWidget, AvatarBotOptions, GetEnginesFn } from './types';
import type {
  ReasoningStartInfo,
  ReasoningChunkInfo,
  ReasoningEndInfo
} from '@/core/types';

export interface AutoContinueState {
  isActive: boolean;
  continuationIndex: number;
  maxContinuations: number;
  accumulatedText: string;
}

export interface StreamSpeechState {
  sentenceBuffer: string;
  buf: string;
}

export interface StreamPipelineParams {
  widget?: AiAvatarWidget;
  getWidget?: () => AiAvatarWidget;
  options: AvatarBotOptions;
  getEngines: GetEnginesFn;
  autoContinueState: AutoContinueState;
  streamSpeechState: StreamSpeechState;
}

export interface StreamPipeline {
  getStreamSpeechId: () => number;
  setStreamSpeechId: (id: number) => void;
  isThinking: () => boolean;
  onStreamStart: () => void;
  onStreamChunk: (chunkDelta: string, rawChunk?: unknown) => void;
  onStreamEnd: (fullText: string) => void;
  onReasoningStart: (info?: ReasoningStartInfo) => void;
  onReasoningChunk: (info?: ReasoningChunkInfo) => void;
  onReasoningEnd: (info?: ReasoningEndInfo) => void;
  onAutoContinueStart: (info: unknown) => void;
  onAutoContinueWait: (info: unknown) => void;
  onAutoContinueResume: (info: unknown) => void;
  onAutoContinueEnd: (info: unknown) => void;
  onInterrupt: () => void;
  onSpeechWait: (speechSequenceId: unknown) => void;
}

/**
 * Creates the Brain streaming text and Speech audio/lip-sync synchronization pipeline (Stream Pipeline).
 */
export function createStreamPipeline({
  widget,
  getWidget,
  options,
  getEngines,
  autoContinueState,
  streamSpeechState
}: StreamPipelineParams): StreamPipeline {
  let streamSpeechId = 0;
  let hasSpeechStarted = false;
  let isThinkingState = false;

  const resolveWidget =
    typeof getWidget === 'function'
      ? getWidget
      : () => widget as AiAvatarWidget;

  function ensureSpeechStarted(): void {
    if (hasSpeechStarted === true) {
      return;
    }
    hasSpeechStarted = true;
    const { speechEngine, skinEngine } = getEngines();
    if (speechEngine !== null && typeof speechEngine === 'object') {
      streamSpeechId =
        speechEngine.ttsMuted === true ? 0 : speechEngine.beginSpeech();
    } else {
      streamSpeechId = 0;
    }
    if (typeof skinEngine === 'object' && skinEngine !== null) {
      if (skinEngine.gestureName === 'thinking') {
        skinEngine.gestureName = 'talking';
      }
    }
  }

  return {
    getStreamSpeechId: () => streamSpeechId,
    setStreamSpeechId: (id: number) => {
      streamSpeechId = id;
      hasSpeechStarted = true;
    },
    isThinking: () => isThinkingState,

    onStreamStart() {
      const { speechEngine } = getEngines();
      if (speechEngine !== null && typeof speechEngine === 'object') {
        speechEngine.isProcessing = true;
      }
      isThinkingState = false;
      hasSpeechStarted = false;
      streamSpeechId = 0;
      streamSpeechState.sentenceBuffer = '';
      streamSpeechState.buf = '';
    },

    onReasoningStart(info?: ReasoningStartInfo) {
      isThinkingState = true;
      const { speechEngine, skinEngine } = getEngines();
      if (speechEngine !== null && typeof speechEngine === 'object') {
        speechEngine.isProcessing = true;
      }
      if (typeof skinEngine === 'object' && skinEngine !== null) {
        if (skinEngine.gestureName !== undefined) {
          skinEngine.gestureName = 'thinking';
        }
        if (typeof skinEngine.setEmotion === 'function') {
          skinEngine.setEmotion('thinking');
        }
      }
      const safeInfo =
        typeof info === 'object' && info !== null ? info : {};
      callOptionEvent(options, resolveWidget(), 'onReasoningStart', safeInfo);
    },

    onReasoningChunk(info?: ReasoningChunkInfo) {
      const safeInfo =
        typeof info === 'object' && info !== null
          ? info
          : { chunkDelta: '', accumulatedReasoning: '' };
      callOptionEvent(
        options,
        resolveWidget(),
        'onReasoningChunk',
        safeInfo,
        safeInfo.chunkDelta,
        safeInfo.accumulatedReasoning,
        safeInfo.rawChunk
      );
    },

    onReasoningEnd(info?: ReasoningEndInfo) {
      isThinkingState = false;
      const { skinEngine } = getEngines();
      if (typeof skinEngine === 'object' && skinEngine !== null) {
        if (skinEngine.gestureName === 'thinking') {
          skinEngine.gestureName = 'talking';
        }
        if (typeof skinEngine.setEmotion === 'function') {
          skinEngine.setEmotion('neutral');
        }
      }
      const safeInfo =
        typeof info === 'object' && info !== null
          ? info
          : { fullReasoning: '', durationMs: 0 };
      callOptionEvent(
        options,
        resolveWidget(),
        'onReasoningEnd',
        safeInfo,
        safeInfo.fullReasoning,
        safeInfo.durationMs
      );
    },

    onStreamChunk(chunkDelta: string, rawChunk?: unknown) {
      ensureSpeechStarted();

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

      callOptionEvent(
        options,
        resolveWidget(),
        'onStreamChunk',
        chunkDelta,
        rawChunk
      );
    },

    /**
     * Callback invoked when the Brain LLM stream completes.
     * Flushes any remaining text to the speech synthesis queue and emits the `onStreamEnd` event.
     */
    onStreamEnd(fullText: string) {
      const { speechEngine, skinEngine } = getEngines();

      if (
        speechEngine !== null &&
        typeof speechEngine === 'object' &&
        speechEngine.ttsMuted !== true
      ) {
        if (hasSpeechStarted === false) {
          const remainingSentences = speechEngine.drainSentences(
            streamSpeechState,
            true
          );
          if (remainingSentences.length > 0) {
            streamSpeechId = speechEngine.beginSpeech();
            hasSpeechStarted = true;
            for (const sentence of remainingSentences) {
              speechEngine.pushSpeech(streamSpeechId, sentence);
            }
            speechEngine.endSpeech(streamSpeechId);
          } else if (typeof speechEngine?.onUtteranceEnd === 'function') {
            speechEngine.onUtteranceEnd();
          }
        } else if (
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
      } else if (
        streamSpeechId === 0 &&
        typeof speechEngine?.onUtteranceEnd === 'function'
      ) {
        speechEngine.onUtteranceEnd();
      }

      if (typeof skinEngine === 'object' && skinEngine !== null) {
        if (skinEngine.gestureName === 'thinking') {
          skinEngine.gestureName = 'neutral';
        }
      }

      isThinkingState = false;
      hasSpeechStarted = false;
      callOptionEvent(options, resolveWidget(), 'onStreamEnd', fullText);
    },

    onAutoContinueStart(info: unknown) {
      const infoObj =
        typeof info === 'object' && info !== null
          ? (info as Record<string, unknown>)
          : null;
      autoContinueState.isActive = true;
      autoContinueState.continuationIndex =
        typeof infoObj?.continuationIndex === 'number'
          ? infoObj.continuationIndex
          : 0;
      autoContinueState.maxContinuations =
        typeof infoObj?.maxContinuations === 'number'
          ? infoObj.maxContinuations
          : 0;
      autoContinueState.accumulatedText =
        typeof infoObj?.accumulatedText === 'string'
          ? infoObj.accumulatedText
          : '';
      callOptionEvent(options, resolveWidget(), 'onAutoContinueStart', info);
    },

    onAutoContinueWait(info: unknown) {
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

    onAutoContinueResume(info: unknown) {
      const infoObj =
        typeof info === 'object' && info !== null
          ? (info as Record<string, unknown>)
          : null;
      autoContinueState.continuationIndex =
        typeof infoObj?.continuationIndex === 'number'
          ? infoObj.continuationIndex
          : 0;
      autoContinueState.maxContinuations =
        typeof infoObj?.maxContinuations === 'number'
          ? infoObj.maxContinuations
          : 0;
      autoContinueState.accumulatedText =
        typeof infoObj?.accumulatedText === 'string'
          ? infoObj.accumulatedText
          : '';
      callOptionEvent(options, resolveWidget(), 'onAutoContinueResume', info);
    },

    onAutoContinueEnd(info: unknown) {
      autoContinueState.isActive = false;
      callOptionEvent(options, resolveWidget(), 'onAutoContinueEnd', info);
    },

    onInterrupt() {
      const { brainEngine, skinEngine, speechEngine } = getEngines();
      isThinkingState = false;
      hasSpeechStarted = false;
      streamSpeechId = 0;
      autoContinueState.isActive = false;
      autoContinueState.continuationIndex = 0;
      autoContinueState.maxContinuations = 0;
      autoContinueState.accumulatedText = '';
      if (typeof skinEngine === 'object' && skinEngine !== null) {
        if (skinEngine.gestureName === 'thinking') {
          skinEngine.gestureName = 'neutral';
        }
      }
      if (speechEngine !== null && typeof speechEngine === 'object') {
        speechEngine.isProcessing = false;
      }
      const llmObj = brainEngine?.llm as Record<string, unknown> | undefined;
      const controller = llmObj?.controller as
        { abort?: () => void } | undefined;
      if (typeof controller?.abort === 'function') {
        try {
          controller.abort();
        } catch (_error) {}
      }
    },

    onSpeechWait(speechSequenceId?: unknown) {
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
