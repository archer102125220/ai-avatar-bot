import {
  REASONING_START_TAG,
  REASONING_END_TAG,
  REASONING_ALT_START_TAG,
  REASONING_ALT_END_TAG
} from '@/core/constants';
import type {
  ReasoningStartInfo,
  ReasoningChunkInfo,
  ReasoningEndInfo,
  ReasoningMode
} from '@/core/types';

/**
 * State enum representing active parser phase.
 */
export const STREAM_PARSER_STATE = {
  /** Initial state before any token or tag is identified. */
  IDLE: 'IDLE',
  /** Actively parsing reasoning / thinking tokens (silent track). */
  THINKING: 'THINKING',
  /** Actively parsing spoken answer tokens (TTS / speech track). */
  ANSWERING: 'ANSWERING',
  /** Stream has concluded. */
  FINISHED: 'FINISHED'
} as const;

export type StreamParserState =
  (typeof STREAM_PARSER_STATE)[keyof typeof STREAM_PARSER_STATE];

/**
 * Configuration options and event callbacks for StreamParser.
 */
export interface StreamParserOptions {
  /** Model identifier string associated with this generation. */
  model?: string;
  /**
   * Reasoning capture mode:
   * - 'auto': Automatically detect reasoning tags (<think>, <thought>) and reasoning_content fields (default)
   * - 'always': Aggressively capture and stream reasoning tags
   * - 'never': Disable reasoning track; emit all output directly as answer
   */
  mode?: ReasoningMode;
  /** Supported reasoning start tags. Defaults to ['<think>', '<thought>']. */
  startTags?: string[];
  /** Supported reasoning end tags. Defaults to ['</think>', '</thought>']. */
  endTags?: string[];
  /** Callback fired when reasoning phase starts. */
  onReasoningStart?: (info: ReasoningStartInfo) => void;
  /** Callback fired when an incremental reasoning token chunk arrives. */
  onReasoningChunk?: (info: ReasoningChunkInfo) => void;
  /** Callback fired when reasoning phase concludes. */
  onReasoningEnd?: (info: ReasoningEndInfo) => void;
  /** Callback fired when answer phase starts. */
  onAnswerStart?: () => void;
  /** Callback fired when an incremental answer token chunk arrives. */
  onAnswerChunk?: (
    chunkDelta: string,
    accumulatedAnswer: string,
    rawChunk?: unknown
  ) => void;
  /** Callback fired when answer phase concludes. */
  onAnswerEnd?: (fullAnswer: string, durationMs: number) => void;
}

/**
 * Final execution result snapshot returned by StreamParser.finish().
 */
export interface StreamParserResult {
  /** Complete reasoning / thinking text extracted from stream. */
  reasoning: string;
  /** Complete final answer text extracted from stream. */
  answer: string;
  /** Elapsed duration of reasoning phase in milliseconds. */
  reasoningTimeMs: number;
  /** Total duration from parser instantiation to completion in milliseconds. */
  totalTimeMs: number;
  /** Whether the generation contained reasoning tokens. */
  hasReasoning: boolean;
  /** Model identifier. */
  model?: string;
}

/**
 * Stream parser instance interface returned by createStreamParser().
 */
export interface StreamParserInstance {
  /**
   * Feeds an incoming token chunk (text string or engine object delta) into the state machine.
   *
   * @param rawChunk - Incoming chunk payload.
   */
  feed(rawChunk: unknown): void;
  /**
   * Finalizes the stream, flushing any pending buffers and computing final metrics.
   *
   * @returns Final parser result snapshot.
   */
  finish(): StreamParserResult;
  /**
   * Resets the parser instance for a new generation cycle.
   */
  reset(): void;
  /**
   * Returns current active state of the parser.
   */
  getState(): StreamParserState;
  /**
   * Returns accumulated reasoning text captured so far.
   */
  getReasoning(): string;
  /**
   * Returns accumulated answer text captured so far.
   */
  getAnswer(): string;
  /**
   * Returns the duration of the reasoning process in milliseconds.
   */
  getReasoningDurationMs(): number;
  /**
   * Returns the total elapsed time of the generation in milliseconds.
   */
  getTotalDurationMs(): number;
  /**
   * Returns whether any reasoning tokens were encountered during generation.
   */
  hasReasoning(): boolean;
  /**
   * Returns true if stream has finalized or was terminated early due to loop guard.
   */
  isFinished(): boolean;
}

/**
 * Helper function to find the earliest occurring tag from a list of candidates.
 *
 * @param text - Source string to search.
 * @param tags - List of tag strings to locate.
 * @returns Object with matched tag and index, or null if not found.
 */
function findEarliestTag(
  text: string,
  tags: string[]
): { tag: string; index: number } | null {
  let earliestMatch: { tag: string; index: number } | null = null;

  for (let i = 0; i < tags.length; i++) {
    const candidateTag = tags[i];
    if (typeof candidateTag !== 'string' || candidateTag === '') {
      continue;
    }
    const idx = text.indexOf(candidateTag);
    if (idx !== -1) {
      if (earliestMatch === null || idx < earliestMatch.index) {
        earliestMatch = { tag: candidateTag, index: idx };
      }
    }
  }

  return earliestMatch;
}

/**
 * Helper function to check if the suffix of `text` matches a partial prefix of any candidate tag.
 * Used to avoid splitting tags across chunk boundaries.
 *
 * @param text - Current buffered text.
 * @param tags - List of candidate tags.
 * @returns Length of the matching suffix (0 if no partial prefix matches).
 */
function findPotentialTagPrefixLength(text: string, tags: string[]): number {
  if (text === '') {
    return 0;
  }

  let maxCandidateLen = 0;
  for (let i = 0; i < tags.length; i++) {
    if (tags[i].length > maxCandidateLen) {
      maxCandidateLen = tags[i].length;
    }
  }

  const checkMaxLen = Math.min(text.length, maxCandidateLen - 1);

  for (let len = checkMaxLen; len >= 1; len--) {
    const suffix = text.slice(text.length - len);
    for (let i = 0; i < tags.length; i++) {
      const candidateTag = tags[i];
      if (candidateTag.startsWith(suffix) === true) {
        return len;
      }
    }
  }

  return 0;
}

/**
 * Detects repetitive looping degeneration patterns (e.g. repeated sentences, paragraphs, or blocks)
 * and truncates the repetition while preserving the clean primary output.
 *
 * @param text - Candidate answer text string.
 * @returns Detection status and truncated clean text.
 */
function detectSingleRepetitionLoop(text: string): {
  hasLoop: boolean;
  cleanText: string;
} {
  if (typeof text !== 'string' || text.length < 24) {
    return { hasLoop: false, cleanText: text };
  }

  // 1. Paragraph-level repetition (split by newline boundaries)
  const paragraphs = text
    .split(/\r?\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (paragraphs.length >= 2) {
    const lastP = paragraphs[paragraphs.length - 1];
    const prevP = paragraphs[paragraphs.length - 2];

    if (
      lastP.length >= 15 &&
      (lastP === prevP ||
        (lastP.length >= prevP.length && lastP.startsWith(prevP)) ||
        (prevP.length >= lastP.length && prevP.startsWith(lastP)))
    ) {
      const lastOccurrenceIndex = text.lastIndexOf(lastP);
      if (lastOccurrenceIndex !== -1) {
        return {
          hasLoop: true,
          cleanText: text.slice(0, lastOccurrenceIndex).trimEnd()
        };
      }
    }
  }

  // 2. Sentence-level repetition (split by sentence-ending punctuation)
  const sentenceDelimiters = /([。！？!?\n]+)/;
  const tokens = text.split(sentenceDelimiters).filter(Boolean);
  const sentences: string[] = [];
  for (let i = 0; i < tokens.length; i += 2) {
    const s = ((tokens[i] || '') + (tokens[i + 1] || '')).trim();
    if (s.length > 0) {
      sentences.push(s);
    }
  }

  if (sentences.length >= 2) {
    const lastS = sentences[sentences.length - 1];
    const prevS = sentences[sentences.length - 2];
    if (lastS.length >= 12 && lastS === prevS) {
      const lastOccurrenceIndex = text.lastIndexOf(lastS);
      if (lastOccurrenceIndex !== -1) {
        return {
          hasLoop: true,
          cleanText: text.slice(0, lastOccurrenceIndex).trimEnd()
        };
      }
    }
  }

  // 3. 2-Sentence cycle repetition: A B A B
  if (sentences.length >= 4) {
    const s1 = sentences[sentences.length - 4];
    const s2 = sentences[sentences.length - 3];
    const s3 = sentences[sentences.length - 2];
    const s4 = sentences[sentences.length - 1];
    if (s1.length >= 8 && s2.length >= 8 && s1 === s3 && s2 === s4) {
      const lastOccurrenceIndex = text.lastIndexOf(s3);
      if (lastOccurrenceIndex !== -1) {
        return {
          hasLoop: true,
          cleanText: text.slice(0, lastOccurrenceIndex).trimEnd()
        };
      }
    }
  }

  // 4. General suffix block repetition: S ends with Block + Block (15 <= Block.length <= 300)
  const maxBlockLen = Math.min(300, Math.floor(text.length / 2));
  for (let len = 15; len <= maxBlockLen; len++) {
    const tail1 = text.slice(text.length - len);
    const tail2 = text.slice(text.length - len * 2, text.length - len);
    if (tail1 === tail2 && tail1.trim().length >= 15) {
      return {
        hasLoop: true,
        cleanText: text.slice(0, text.length - len).trimEnd()
      };
    }
  }

  return { hasLoop: false, cleanText: text };
}

/**
 * Detects repetitive looping degeneration patterns (e.g. repeated sentences, paragraphs, or blocks)
 * and iteratively truncates all repetitions while preserving the clean primary output.
 *
 * @param text - Candidate answer text string.
 * @returns Detection status and truncated clean text.
 */
export function detectRepetitionLoop(text: string): {
  hasLoop: boolean;
  cleanText: string;
} {
  if (typeof text !== 'string' || text.length < 24) {
    return { hasLoop: false, cleanText: text };
  }

  let current = text;
  let hasAnyLoop = false;

  for (let iteration = 0; iteration < 10; iteration++) {
    const singlePass = detectSingleRepetitionLoop(current);
    if (singlePass.hasLoop === true) {
      hasAnyLoop = true;
      current = singlePass.cleanText;
    } else {
      break;
    }
  }

  return { hasLoop: hasAnyLoop, cleanText: current };
}

/**
 * Helper function to extract structured reasoning and content deltas from diverse engine payloads.
 * Supports raw string deltas, OpenAI/WebLLM choices[0].delta, and Ollama message formats.
 *
 * @param chunk - Raw incoming chunk object or string.
 * @returns Extracted delta payload.
 */
function extractChunkPayload(chunk: unknown): {
  reasoningDelta?: string;
  contentDelta?: string;
} {
  if (typeof chunk === 'string') {
    return { contentDelta: chunk };
  }

  if (typeof chunk !== 'object' || chunk === null) {
    return {};
  }

  const obj = chunk as Record<string, unknown>;

  // 1. OpenAI / WebLLM chunk structure: choices[0].delta or choices[0].message
  const choices = obj.choices;
  if (Array.isArray(choices) === true && choices.length > 0) {
    const firstChoice = choices[0] as Record<string, unknown> | undefined;
    const delta = (firstChoice?.delta || firstChoice?.message) as
      | Record<string, unknown>
      | undefined;
    if (typeof delta === 'object' && delta !== null) {
      const reasoning =
        typeof delta.reasoning_content === 'string'
          ? delta.reasoning_content
          : typeof delta.reasoning === 'string'
            ? delta.reasoning
            : typeof delta.thinking === 'string'
              ? delta.thinking
              : undefined;
      const content =
        typeof delta.content === 'string' ? delta.content : undefined;
      return { reasoningDelta: reasoning, contentDelta: content };
    }
  }

  // 2. Ollama chunk structure: message.thinking / message.content
  const message = obj.message as Record<string, unknown> | undefined;
  if (typeof message === 'object' && message !== null) {
    const reasoning =
      typeof message.reasoning_content === 'string'
        ? message.reasoning_content
        : typeof message.thinking === 'string'
          ? message.thinking
          : undefined;
    const content =
      typeof message.content === 'string' ? message.content : undefined;
    return { reasoningDelta: reasoning, contentDelta: content };
  }

  // 3. Direct top-level properties
  const directReasoning =
    typeof obj.reasoning_content === 'string'
      ? obj.reasoning_content
      : typeof obj.reasoning === 'string'
        ? obj.reasoning
        : typeof obj.thinking === 'string'
          ? obj.thinking
          : undefined;
  const directContent =
    typeof obj.content === 'string' ? obj.content : undefined;

  return { reasoningDelta: directReasoning, contentDelta: directContent };
}

/**
 * Dual-Track Stream Parser state machine for AI Reasoning and Spoken Answer separation.
 *
 * Dispatches reasoning tokens silently to the thinking track while holding TTS speech,
 * and seamlessly emits answer tokens to the speech and UI pipeline upon completion.
 * Fully resilient against arbitrary chunk boundary slicing across network streams.
 *
 * @param options - Configuration options and stream callbacks.
 * @returns Initialized stream parser instance controller.
 */
export function createStreamParser(
  options: StreamParserOptions = {}
): StreamParserInstance {
  let state: StreamParserState = STREAM_PARSER_STATE.IDLE;
  let buffer = '';
  let accumulatedReasoning = '';
  let accumulatedAnswer = '';
  let reasoningStartTime = 0;
  let reasoningDurationMs = 0;
  let startTime = Date.now();
  let endTime = 0;
  let reasoningMode: 'tag' | 'structured' | null = null;

  const model = options.model;
  const mode: ReasoningMode =
    options.mode === 'never' || options.mode === 'always'
      ? options.mode
      : 'auto';
  const startTags: string[] =
    Array.isArray(options.startTags) && options.startTags.length > 0
      ? options.startTags
      : [REASONING_START_TAG, REASONING_ALT_START_TAG];
  const endTags: string[] =
    Array.isArray(options.endTags) && options.endTags.length > 0
      ? options.endTags
      : [REASONING_END_TAG, REASONING_ALT_END_TAG];

  /**
   * Helper to safely append answer slices, run repetition loop detection, and dispatch events.
   */
  function emitAnswerSlice(slice: string, rawChunk?: unknown): void {
    if (slice === '' || state === STREAM_PARSER_STATE.FINISHED) {
      return;
    }

    accumulatedAnswer += slice;

    const loopCheck = detectRepetitionLoop(accumulatedAnswer);
    if (loopCheck.hasLoop === true) {
      accumulatedAnswer = loopCheck.cleanText;
      buffer = '';
      state = STREAM_PARSER_STATE.FINISHED;
      endTime = Date.now();
      const totalTimeMs = Math.max(0, endTime - startTime);
      if (typeof options.onAnswerEnd === 'function') {
        options.onAnswerEnd(accumulatedAnswer, totalTimeMs);
      }
      return;
    }

    if (typeof options.onAnswerChunk === 'function') {
      options.onAnswerChunk(slice, accumulatedAnswer, rawChunk);
    }
  }

  /**
   * Internal transition from IDLE / ANSWERING to THINKING.
   *
   * @param nextMode - Mode of reasoning detection: 'tag' or 'structured'.
   */
  function transitionToThinking(nextMode: 'tag' | 'structured'): void {
    reasoningMode = nextMode;
    state = STREAM_PARSER_STATE.THINKING;
    reasoningStartTime = Date.now();
    if (typeof options.onReasoningStart === 'function') {
      options.onReasoningStart({
        model,
        timestamp: reasoningStartTime
      });
    }
  }

  /**
   * Internal transition from THINKING to ANSWERING.
   */
  function transitionToAnswering(): void {
    reasoningDurationMs = Math.max(0, Date.now() - reasoningStartTime);

    if (typeof options.onReasoningEnd === 'function') {
      options.onReasoningEnd({
        fullReasoning: accumulatedReasoning,
        durationMs: reasoningDurationMs,
        model
      });
    }

    state = STREAM_PARSER_STATE.ANSWERING;
    reasoningMode = null;

    if (typeof options.onAnswerStart === 'function') {
      options.onAnswerStart();
    }
  }

  /**
   * Core text buffering and tag detection state engine.
   *
   * @param text - Text slice to feed.
   * @param rawChunk - Original chunk reference.
   */
  function processTextChunk(text: string, rawChunk?: unknown): void {
    buffer += text;

    while (buffer.length > 0) {
      if (state === STREAM_PARSER_STATE.IDLE) {
        const startTagMatch = findEarliestTag(buffer, startTags);

        if (startTagMatch !== null) {
          const textBefore = buffer.slice(0, startTagMatch.index);
          const trimmedBefore = textBefore.trim();

          // If there was meaningful text before the start tag, emit as answer
          if (trimmedBefore !== '') {
            if (typeof options.onAnswerStart === 'function') {
              options.onAnswerStart();
            }
            emitAnswerSlice(textBefore, rawChunk);
          }

          transitionToThinking('tag');
          buffer = buffer.slice(startTagMatch.index + startTagMatch.tag.length);
          continue;
        }

        // Check if buffer starts with a partial prefix of any start tag
        const trimmed = buffer.trimStart();
        if (trimmed === '') {
          // Pure leading whitespace: keep buffering until non-whitespace arrives
          break;
        }

        let isPotentialStartTag = false;
        for (let i = 0; i < startTags.length; i++) {
          if (startTags[i].startsWith(trimmed) === true) {
            isPotentialStartTag = true;
            break;
          }
        }

        if (isPotentialStartTag === true) {
          // Might complete a start tag on next chunk, wait
          break;
        }

        // Buffer cannot be a start tag: direct answer stream!
        state = STREAM_PARSER_STATE.ANSWERING;
        if (typeof options.onAnswerStart === 'function') {
          options.onAnswerStart();
        }
        // Fallthrough to ANSWERING processing below
      }

      if (state === STREAM_PARSER_STATE.THINKING) {
        if (accumulatedReasoning === '') {
          buffer = buffer.replace(/^(\r?\n)+/, '');
          if (buffer === '') {
            break;
          }
        }

        const endTagMatch = findEarliestTag(buffer, endTags);

        if (endTagMatch !== null) {
          const reasoningSlice = buffer.slice(0, endTagMatch.index);
          if (reasoningSlice !== '') {
            accumulatedReasoning += reasoningSlice;
            if (typeof options.onReasoningChunk === 'function') {
              options.onReasoningChunk({
                chunkDelta: reasoningSlice,
                accumulatedReasoning,
                rawChunk
              });
            }
          }

          // Advance past end tag and trim immediate newline right after end tag
          buffer = buffer
            .slice(endTagMatch.index + endTagMatch.tag.length)
            .replace(/^[ \t]*(\r?\n)+/, '');

          transitionToAnswering();
          continue;
        }

        // No end tag yet: check if tail of buffer could be a partial end tag
        const partialLen = findPotentialTagPrefixLength(buffer, endTags);
        if (partialLen > 0) {
          const safeReasoning = buffer.slice(0, buffer.length - partialLen);
          if (safeReasoning !== '') {
            accumulatedReasoning += safeReasoning;
            if (typeof options.onReasoningChunk === 'function') {
              options.onReasoningChunk({
                chunkDelta: safeReasoning,
                accumulatedReasoning,
                rawChunk
              });
            }
          }
          buffer = buffer.slice(buffer.length - partialLen);
          break;
        }

        // Entire buffer is safe reasoning
        accumulatedReasoning += buffer;
        if (typeof options.onReasoningChunk === 'function') {
          options.onReasoningChunk({
            chunkDelta: buffer,
            accumulatedReasoning,
            rawChunk
          });
        }
        buffer = '';
        break;
      }

      if (state === STREAM_PARSER_STATE.ANSWERING) {
        const startTagMatch = findEarliestTag(buffer, startTags);
        const orphanEndTagMatch = findEarliestTag(buffer, endTags);

        // 1. Strip and discard any orphaned end tags that appear before any start tag
        if (
          orphanEndTagMatch !== null &&
          (startTagMatch === null ||
            orphanEndTagMatch.index < startTagMatch.index)
        ) {
          const textBefore = buffer.slice(0, orphanEndTagMatch.index);
          const textAfter = buffer.slice(
            orphanEndTagMatch.index + orphanEndTagMatch.tag.length
          );
          if (accumulatedAnswer === '') {
            buffer =
              (textBefore.trim() === '' ? '' : textBefore) +
              textAfter.replace(/^[ \t]*(\r?\n)+/, '');
          } else {
            buffer = textBefore + textAfter;
          }
          continue;
        }

        // 2. If at start of answer, check if buffer ends with a partial prefix of an end tag
        if (accumulatedAnswer === '') {
          const partialEndTagLen = findPotentialTagPrefixLength(
            buffer,
            endTags
          );
          if (partialEndTagLen > 0) {
            break;
          }

          // Strip leading newlines before first answer chunk
          buffer = buffer.replace(/^[ \t]*(\r?\n)+/, '');
          if (buffer === '') {
            break;
          }
        }

        // 3. Check for multi-turn thinking start tag
        if (startTagMatch !== null) {
          const answerSlice = buffer.slice(0, startTagMatch.index);
          if (answerSlice !== '') {
            emitAnswerSlice(answerSlice, rawChunk);
          }

          transitionToThinking('tag');
          buffer = buffer.slice(startTagMatch.index + startTagMatch.tag.length);
          continue;
        }

        // 4. Check if tail of buffer could be start of another think tag
        const partialLen = findPotentialTagPrefixLength(buffer, startTags);
        if (partialLen > 0) {
          const safeAnswer = buffer.slice(0, buffer.length - partialLen);
          if (safeAnswer !== '') {
            emitAnswerSlice(safeAnswer, rawChunk);
          }
          buffer = buffer.slice(buffer.length - partialLen);
          break;
        }

        // 5. Entire buffer is safe answer text
        emitAnswerSlice(buffer, rawChunk);
        buffer = '';
        break;
      }

      break;
    }
  }

  /**
   * Feeds an incoming token chunk (text string or engine object delta) into the state machine.
   *
   * @param rawChunk - Incoming chunk payload.
   */
  function feed(rawChunk: unknown): void {
    if (state === STREAM_PARSER_STATE.FINISHED) {
      return;
    }

    if (mode === 'never') {
      const { reasoningDelta, contentDelta } = extractChunkPayload(rawChunk);
      const textChunk =
        typeof contentDelta === 'string' && contentDelta !== ''
          ? contentDelta
          : typeof reasoningDelta === 'string' && reasoningDelta !== ''
            ? reasoningDelta
            : '';
      if (textChunk !== '') {
        if (state === STREAM_PARSER_STATE.IDLE) {
          state = STREAM_PARSER_STATE.ANSWERING;
          if (typeof options.onAnswerStart === 'function') {
            options.onAnswerStart();
          }
        }
        emitAnswerSlice(textChunk, rawChunk);
      }
      return;
    }

    const { reasoningDelta, contentDelta } = extractChunkPayload(rawChunk);

    // Handle structured reasoning field (e.g. delta.reasoning_content)
    if (typeof reasoningDelta === 'string' && reasoningDelta !== '') {
      if (state === STREAM_PARSER_STATE.IDLE) {
        transitionToThinking('structured');
      }

      if (state === STREAM_PARSER_STATE.THINKING) {
        accumulatedReasoning += reasoningDelta;
        if (typeof options.onReasoningChunk === 'function') {
          options.onReasoningChunk({
            chunkDelta: reasoningDelta,
            accumulatedReasoning,
            rawChunk
          });
        }
      }
    }

    // Handle content field
    if (typeof contentDelta === 'string') {
      // If we were in structured reasoning mode and now receive answer content
      if (
        state === STREAM_PARSER_STATE.THINKING &&
        reasoningMode === 'structured' &&
        contentDelta !== ''
      ) {
        // If contentDelta does not contain further reasoning start tags, close structured reasoning
        const hasStartTag = findEarliestTag(contentDelta, startTags) !== null;
        if (hasStartTag === false && buffer === '') {
          transitionToAnswering();
        }
      }

      processTextChunk(contentDelta, rawChunk);
    }
  }

  /**
   * Finalizes the stream, flushing any pending buffers and computing final metrics.
   *
   * @returns Final parser result snapshot.
   */
  function finish(): StreamParserResult {
    endTime = Date.now();
    const totalTimeMs = Math.max(0, endTime - startTime);

    if (state === STREAM_PARSER_STATE.THINKING) {
      // Stream finished while still inside thinking phase
      if (buffer !== '') {
        accumulatedReasoning += buffer;
        if (typeof options.onReasoningChunk === 'function') {
          options.onReasoningChunk({
            chunkDelta: buffer,
            accumulatedReasoning
          });
        }
        buffer = '';
      }

      reasoningDurationMs = Math.max(0, endTime - reasoningStartTime);
      if (typeof options.onReasoningEnd === 'function') {
        options.onReasoningEnd({
          fullReasoning: accumulatedReasoning,
          durationMs: reasoningDurationMs,
          model
        });
      }

      if (typeof options.onAnswerStart === 'function') {
        options.onAnswerStart();
      }
      if (typeof options.onAnswerEnd === 'function') {
        options.onAnswerEnd(accumulatedAnswer, totalTimeMs);
      }
    } else if (state === STREAM_PARSER_STATE.ANSWERING) {
      if (buffer !== '') {
        for (let i = 0; i < endTags.length; i++) {
          const tag = endTags[i];
          if (tag !== '' && buffer.includes(tag) === true) {
            buffer = buffer.split(tag).join('');
          }
        }
        if (accumulatedAnswer === '') {
          buffer = buffer.replace(/^[ \t]*(\r?\n)+/, '');
        }
        if (buffer !== '') {
          emitAnswerSlice(buffer);
          buffer = '';
        }
      }

      const loopCheck = detectRepetitionLoop(accumulatedAnswer);
      if (loopCheck.hasLoop === true) {
        accumulatedAnswer = loopCheck.cleanText;
      }

      if (typeof options.onAnswerEnd === 'function') {
        options.onAnswerEnd(accumulatedAnswer, totalTimeMs);
      }
    } else if (state === STREAM_PARSER_STATE.IDLE) {
      // No tags detected and finished immediately
      if (typeof options.onAnswerStart === 'function') {
        options.onAnswerStart();
      }

      if (buffer !== '') {
        for (let i = 0; i < endTags.length; i++) {
          const tag = endTags[i];
          if (tag !== '' && buffer.includes(tag) === true) {
            buffer = buffer.split(tag).join('');
          }
        }
        buffer = buffer.replace(/^[ \t]*(\r?\n)+/, '');
        if (buffer !== '') {
          accumulatedAnswer += buffer;
          if (typeof options.onAnswerChunk === 'function') {
            options.onAnswerChunk(buffer, accumulatedAnswer);
          }
          buffer = '';
        }
      }

      if (typeof options.onAnswerEnd === 'function') {
        options.onAnswerEnd(accumulatedAnswer, totalTimeMs);
      }
    }

    state = STREAM_PARSER_STATE.FINISHED;

    return {
      reasoning: accumulatedReasoning.trim(),
      answer: accumulatedAnswer.replace(/^[ \t]*(\r?\n)+/, ''),
      reasoningTimeMs: reasoningDurationMs,
      totalTimeMs,
      hasReasoning: accumulatedReasoning !== '',
      model
    };
  }

  /**
   * Resets the parser instance for a new generation cycle.
   */
  function reset(): void {
    state = STREAM_PARSER_STATE.IDLE;
    buffer = '';
    accumulatedReasoning = '';
    accumulatedAnswer = '';
    reasoningStartTime = 0;
    reasoningDurationMs = 0;
    startTime = Date.now();
    endTime = 0;
    reasoningMode = null;
  }

  return {
    feed,
    finish,
    reset,
    getState: (): StreamParserState => state,
    getReasoning: (): string => accumulatedReasoning,
    getAnswer: (): string => accumulatedAnswer,
    getReasoningDurationMs: (): number => reasoningDurationMs,
    getTotalDurationMs: (): number => {
      const end = endTime > 0 ? endTime : Date.now();
      return Math.max(0, end - startTime);
    },
    hasReasoning: (): boolean => accumulatedReasoning !== '',
    isFinished: (): boolean => state === STREAM_PARSER_STATE.FINISHED
  };
}

/**
 * Backward compatibility type alias for StreamParserInstance.
 */
export type StreamParser = StreamParserInstance;

/**
 * Backward compatibility constructor wrapper supporting both `createStreamParser()`
 * and legacy `new StreamParser(options)`.
 */
export const StreamParser = function (
  this: unknown,
  options: StreamParserOptions = {}
): StreamParserInstance {
  return createStreamParser(options);
} as unknown as {
  new (options?: StreamParserOptions): StreamParserInstance;
  (options?: StreamParserOptions): StreamParserInstance;
};
