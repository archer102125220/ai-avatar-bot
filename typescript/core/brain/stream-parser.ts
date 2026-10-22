import {
  REASONING_START_TAG,
  REASONING_END_TAG,
  REASONING_ALT_START_TAG,
  REASONING_ALT_END_TAG
} from '@/core/constants';
import type {
  ReasoningStartInfo,
  ReasoningChunkInfo,
  ReasoningEndInfo
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
 */
export class StreamParser {
  private state: StreamParserState = STREAM_PARSER_STATE.IDLE;
  private buffer = '';
  private accumulatedReasoning = '';
  private accumulatedAnswer = '';
  private reasoningStartTime = 0;
  private reasoningDurationMs = 0;
  private startTime: number = Date.now();
  private endTime = 0;
  private reasoningMode: 'tag' | 'structured' | null = null;
  private readonly model?: string;
  private readonly startTags: string[];
  private readonly endTags: string[];
  private readonly options: StreamParserOptions;

  constructor(options: StreamParserOptions = {}) {
    this.options = options;
    this.model = options.model;
    this.startTags =
      Array.isArray(options.startTags) && options.startTags.length > 0
        ? options.startTags
        : [REASONING_START_TAG, REASONING_ALT_START_TAG];
    this.endTags =
      Array.isArray(options.endTags) && options.endTags.length > 0
        ? options.endTags
        : [REASONING_END_TAG, REASONING_ALT_END_TAG];
  }

  /**
   * Returns current active state of the parser.
   */
  public getState(): StreamParserState {
    return this.state;
  }

  /**
   * Returns accumulated reasoning text captured so far.
   */
  public getReasoning(): string {
    return this.accumulatedReasoning;
  }

  /**
   * Returns accumulated answer text captured so far.
   */
  public getAnswer(): string {
    return this.accumulatedAnswer;
  }

  /**
   * Returns the duration of the reasoning process in milliseconds.
   */
  public getReasoningDurationMs(): number {
    return this.reasoningDurationMs;
  }

  /**
   * Returns the total elapsed time of the generation in milliseconds.
   */
  public getTotalDurationMs(): number {
    const end = this.endTime > 0 ? this.endTime : Date.now();
    return Math.max(0, end - this.startTime);
  }

  /**
   * Returns whether any reasoning tokens were encountered during generation.
   */
  public hasReasoning(): boolean {
    return this.accumulatedReasoning !== '';
  }

  /**
   * Feeds an incoming token chunk (text string or engine object delta) into the state machine.
   *
   * @param rawChunk - Incoming chunk payload.
   */
  public feed(rawChunk: unknown): void {
    if (this.state === STREAM_PARSER_STATE.FINISHED) {
      return;
    }

    const { reasoningDelta, contentDelta } = extractChunkPayload(rawChunk);

    // Handle structured reasoning field (e.g. delta.reasoning_content)
    if (typeof reasoningDelta === 'string' && reasoningDelta !== '') {
      if (this.state === STREAM_PARSER_STATE.IDLE) {
        this.transitionToThinking('structured');
      }

      if (this.state === STREAM_PARSER_STATE.THINKING) {
        this.accumulatedReasoning += reasoningDelta;
        if (typeof this.options.onReasoningChunk === 'function') {
          this.options.onReasoningChunk({
            chunkDelta: reasoningDelta,
            accumulatedReasoning: this.accumulatedReasoning,
            rawChunk
          });
        }
      }
    }

    // Handle content field
    if (typeof contentDelta === 'string') {
      // If we were in structured reasoning mode and now receive answer content
      if (
        this.state === STREAM_PARSER_STATE.THINKING &&
        this.reasoningMode === 'structured' &&
        contentDelta !== ''
      ) {
        // If contentDelta does not contain further reasoning start tags, close structured reasoning
        const hasStartTag =
          findEarliestTag(contentDelta, this.startTags) !== null;
        if (hasStartTag === false && this.buffer === '') {
          this.transitionToAnswering();
        }
      }

      this.processTextChunk(contentDelta, rawChunk);
    }
  }

  /**
   * Finalizes the stream, flushing any pending buffers and computing final metrics.
   *
   * @returns Final parser result snapshot.
   */
  public finish(): StreamParserResult {
    this.endTime = Date.now();
    const totalTimeMs = Math.max(0, this.endTime - this.startTime);

    if (this.state === STREAM_PARSER_STATE.THINKING) {
      // Stream finished while still inside thinking phase
      if (this.buffer !== '') {
        this.accumulatedReasoning += this.buffer;
        if (typeof this.options.onReasoningChunk === 'function') {
          this.options.onReasoningChunk({
            chunkDelta: this.buffer,
            accumulatedReasoning: this.accumulatedReasoning
          });
        }
        this.buffer = '';
      }

      this.reasoningDurationMs = Math.max(
        0,
        this.endTime - this.reasoningStartTime
      );
      if (typeof this.options.onReasoningEnd === 'function') {
        this.options.onReasoningEnd({
          fullReasoning: this.accumulatedReasoning,
          durationMs: this.reasoningDurationMs,
          model: this.model
        });
      }

      if (typeof this.options.onAnswerStart === 'function') {
        this.options.onAnswerStart();
      }
      if (typeof this.options.onAnswerEnd === 'function') {
        this.options.onAnswerEnd(this.accumulatedAnswer, totalTimeMs);
      }
    } else if (this.state === STREAM_PARSER_STATE.ANSWERING) {
      if (this.buffer !== '') {
        this.accumulatedAnswer += this.buffer;
        if (typeof this.options.onAnswerChunk === 'function') {
          this.options.onAnswerChunk(
            this.buffer,
            this.accumulatedAnswer
          );
        }
        this.buffer = '';
      }

      if (typeof this.options.onAnswerEnd === 'function') {
        this.options.onAnswerEnd(this.accumulatedAnswer, totalTimeMs);
      }
    } else if (this.state === STREAM_PARSER_STATE.IDLE) {
      // No tags detected and finished immediately
      if (typeof this.options.onAnswerStart === 'function') {
        this.options.onAnswerStart();
      }

      if (this.buffer !== '') {
        this.accumulatedAnswer += this.buffer;
        if (typeof this.options.onAnswerChunk === 'function') {
          this.options.onAnswerChunk(
            this.buffer,
            this.accumulatedAnswer
          );
        }
        this.buffer = '';
      }

      if (typeof this.options.onAnswerEnd === 'function') {
        this.options.onAnswerEnd(this.accumulatedAnswer, totalTimeMs);
      }
    }

    this.state = STREAM_PARSER_STATE.FINISHED;

    return {
      reasoning: this.accumulatedReasoning,
      answer: this.accumulatedAnswer,
      reasoningTimeMs: this.reasoningDurationMs,
      totalTimeMs,
      hasReasoning: this.accumulatedReasoning !== '',
      model: this.model
    };
  }

  /**
   * Resets the parser instance for a new generation cycle.
   */
  public reset(): void {
    this.state = STREAM_PARSER_STATE.IDLE;
    this.buffer = '';
    this.accumulatedReasoning = '';
    this.accumulatedAnswer = '';
    this.reasoningStartTime = 0;
    this.reasoningDurationMs = 0;
    this.startTime = Date.now();
    this.endTime = 0;
    this.reasoningMode = null;
  }

  /**
   * Internal transition from IDLE / ANSWERING to THINKING.
   *
   * @param mode - Mode of reasoning detection: 'tag' or 'structured'.
   */
  private transitionToThinking(mode: 'tag' | 'structured'): void {
    this.reasoningMode = mode;
    this.state = STREAM_PARSER_STATE.THINKING;
    this.reasoningStartTime = Date.now();
    if (typeof this.options.onReasoningStart === 'function') {
      this.options.onReasoningStart({
        model: this.model,
        timestamp: this.reasoningStartTime
      });
    }
  }

  /**
   * Internal transition from THINKING to ANSWERING.
   */
  private transitionToAnswering(): void {
    this.reasoningDurationMs = Math.max(
      0,
      Date.now() - this.reasoningStartTime
    );

    if (typeof this.options.onReasoningEnd === 'function') {
      this.options.onReasoningEnd({
        fullReasoning: this.accumulatedReasoning,
        durationMs: this.reasoningDurationMs,
        model: this.model
      });
    }

    this.state = STREAM_PARSER_STATE.ANSWERING;
    this.reasoningMode = null;

    if (typeof this.options.onAnswerStart === 'function') {
      this.options.onAnswerStart();
    }
  }

  /**
   * Core text buffering and tag detection state engine.
   *
   * @param text - Text slice to feed.
   * @param rawChunk - Original chunk reference.
   */
  private processTextChunk(text: string, rawChunk?: unknown): void {
    this.buffer += text;

    while (this.buffer.length > 0) {
      if (this.state === STREAM_PARSER_STATE.IDLE) {
        const startTagMatch = findEarliestTag(this.buffer, this.startTags);

        if (startTagMatch !== null) {
          const textBefore = this.buffer.slice(0, startTagMatch.index);
          const trimmedBefore = textBefore.trim();

          // If there was meaningful text before the start tag, emit as answer
          if (trimmedBefore !== '') {
            if (typeof this.options.onAnswerStart === 'function') {
              this.options.onAnswerStart();
            }
            this.accumulatedAnswer += textBefore;
            if (typeof this.options.onAnswerChunk === 'function') {
              this.options.onAnswerChunk(
                textBefore,
                this.accumulatedAnswer,
                rawChunk
              );
            }
          }

          this.transitionToThinking('tag');
          this.buffer = this.buffer.slice(
            startTagMatch.index + startTagMatch.tag.length
          );
          continue;
        }

        // Check if buffer starts with a partial prefix of any start tag
        const trimmed = this.buffer.trimStart();
        if (trimmed === '') {
          // Pure leading whitespace: keep buffering until non-whitespace arrives
          break;
        }

        let isPotentialStartTag = false;
        for (let i = 0; i < this.startTags.length; i++) {
          if (this.startTags[i].startsWith(trimmed) === true) {
            isPotentialStartTag = true;
            break;
          }
        }

        if (isPotentialStartTag === true) {
          // Might complete a start tag on next chunk, wait
          break;
        }

        // Buffer cannot be a start tag: direct answer stream!
        this.state = STREAM_PARSER_STATE.ANSWERING;
        if (typeof this.options.onAnswerStart === 'function') {
          this.options.onAnswerStart();
        }
        // Fallthrough to ANSWERING processing below
      }

      if (this.state === STREAM_PARSER_STATE.THINKING) {
        const endTagMatch = findEarliestTag(this.buffer, this.endTags);

        if (endTagMatch !== null) {
          const reasoningSlice = this.buffer.slice(0, endTagMatch.index);
          if (reasoningSlice !== '') {
            this.accumulatedReasoning += reasoningSlice;
            if (typeof this.options.onReasoningChunk === 'function') {
              this.options.onReasoningChunk({
                chunkDelta: reasoningSlice,
                accumulatedReasoning: this.accumulatedReasoning,
                rawChunk
              });
            }
          }

          // Advance past end tag and trim immediate newline right after end tag
          this.buffer = this.buffer
            .slice(endTagMatch.index + endTagMatch.tag.length)
            .replace(/^(\r?\n)+/, '');

          this.transitionToAnswering();
          continue;
        }

        // No end tag yet: check if tail of buffer could be a partial end tag
        const partialLen = findPotentialTagPrefixLength(
          this.buffer,
          this.endTags
        );
        if (partialLen > 0) {
          const safeReasoning = this.buffer.slice(
            0,
            this.buffer.length - partialLen
          );
          if (safeReasoning !== '') {
            this.accumulatedReasoning += safeReasoning;
            if (typeof this.options.onReasoningChunk === 'function') {
              this.options.onReasoningChunk({
                chunkDelta: safeReasoning,
                accumulatedReasoning: this.accumulatedReasoning,
                rawChunk
              });
            }
          }
          this.buffer = this.buffer.slice(this.buffer.length - partialLen);
          break;
        }

        // Entire buffer is safe reasoning
        this.accumulatedReasoning += this.buffer;
        if (typeof this.options.onReasoningChunk === 'function') {
          this.options.onReasoningChunk({
            chunkDelta: this.buffer,
            accumulatedReasoning: this.accumulatedReasoning,
            rawChunk
          });
        }
        this.buffer = '';
        break;
      }

      if (this.state === STREAM_PARSER_STATE.ANSWERING) {
        // Check for multi-turn thinking start tag
        const startTagMatch = findEarliestTag(this.buffer, this.startTags);

        if (startTagMatch !== null) {
          const answerSlice = this.buffer.slice(0, startTagMatch.index);
          if (answerSlice !== '') {
            this.accumulatedAnswer += answerSlice;
            if (typeof this.options.onAnswerChunk === 'function') {
              this.options.onAnswerChunk(
                answerSlice,
                this.accumulatedAnswer,
                rawChunk
              );
            }
          }

          this.transitionToThinking('tag');
          this.buffer = this.buffer.slice(
            startTagMatch.index + startTagMatch.tag.length
          );
          continue;
        }

        // Check if tail of buffer could be start of another think tag
        const partialLen = findPotentialTagPrefixLength(
          this.buffer,
          this.startTags
        );
        if (partialLen > 0) {
          const safeAnswer = this.buffer.slice(
            0,
            this.buffer.length - partialLen
          );
          if (safeAnswer !== '') {
            this.accumulatedAnswer += safeAnswer;
            if (typeof this.options.onAnswerChunk === 'function') {
              this.options.onAnswerChunk(
                safeAnswer,
                this.accumulatedAnswer,
                rawChunk
              );
            }
          }
          this.buffer = this.buffer.slice(this.buffer.length - partialLen);
          break;
        }

        // Entire buffer is safe answer text
        this.accumulatedAnswer += this.buffer;
        if (typeof this.options.onAnswerChunk === 'function') {
          this.options.onAnswerChunk(
            this.buffer,
            this.accumulatedAnswer,
            rawChunk
          );
        }
        this.buffer = '';
        break;
      }

      break;
    }
  }
}
