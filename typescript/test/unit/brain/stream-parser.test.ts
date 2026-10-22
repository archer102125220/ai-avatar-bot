import { describe, it, expect, vi } from 'vitest';
import {
  StreamParser,
  STREAM_PARSER_STATE
} from '@/core/brain/stream-parser';

describe('Unit Test: StreamParser Subsystem (Deep Coverage & Edge Cases)', () => {
  it('Case 1: should parse standard <think> stream tags cleanly', () => {
    const onReasoningStart = vi.fn();
    const onReasoningChunk = vi.fn();
    const onReasoningEnd = vi.fn();
    const onAnswerStart = vi.fn();
    const onAnswerChunk = vi.fn();
    const onAnswerEnd = vi.fn();

    const parser = new StreamParser({
      model: 'deepseek-r1',
      onReasoningStart,
      onReasoningChunk,
      onReasoningEnd,
      onAnswerStart,
      onAnswerChunk,
      onAnswerEnd
    });

    expect(parser.getState()).toBe(STREAM_PARSER_STATE.IDLE);
    expect(parser.hasReasoning()).toBe(false);

    // Feed reasoning chunk
    parser.feed('<think>Analyzing user question...');
    expect(parser.getState()).toBe(STREAM_PARSER_STATE.THINKING);
    expect(onReasoningStart).toHaveBeenCalledTimes(1);
    expect(onReasoningStart).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'deepseek-r1' })
    );
    expect(onReasoningChunk).toHaveBeenCalledWith(
      expect.objectContaining({
        chunkDelta: 'Analyzing user question...',
        accumulatedReasoning: 'Analyzing user question...'
      })
    );

    // Feed transition to answer
    parser.feed(' Done.</think>\n\nHere is your requested answer.');
    expect(parser.getState()).toBe(STREAM_PARSER_STATE.ANSWERING);
    expect(onReasoningEnd).toHaveBeenCalledTimes(1);
    expect(onReasoningEnd).toHaveBeenCalledWith(
      expect.objectContaining({
        fullReasoning: 'Analyzing user question... Done.',
        model: 'deepseek-r1'
      })
    );
    expect(onAnswerStart).toHaveBeenCalledTimes(1);
    expect(onAnswerChunk).toHaveBeenCalledWith(
      'Here is your requested answer.',
      'Here is your requested answer.',
      expect.anything()
    );

    // Feed more answer
    parser.feed(' Hope this helps!');
    expect(onAnswerChunk).toHaveBeenCalledWith(
      ' Hope this helps!',
      'Here is your requested answer. Hope this helps!',
      expect.anything()
    );

    const result = parser.finish();
    expect(parser.getState()).toBe(STREAM_PARSER_STATE.FINISHED);
    expect(onAnswerEnd).toHaveBeenCalledTimes(1);
    expect(result.reasoning).toBe('Analyzing user question... Done.');
    expect(result.answer).toBe(
      'Here is your requested answer. Hope this helps!'
    );
    expect(result.hasReasoning).toBe(true);
    expect(result.model).toBe('deepseek-r1');
    expect(result.reasoningTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.totalTimeMs).toBeGreaterThanOrEqual(result.reasoningTimeMs);
  });

  it('Case 2: should parse alternative <thought> stream tags cleanly', () => {
    const onReasoningChunk = vi.fn();
    const onAnswerChunk = vi.fn();

    const parser = new StreamParser({
      onReasoningChunk,
      onAnswerChunk
    });

    parser.feed('<thought>Considering algorithmic complexity...</thought>');
    expect(parser.getState()).toBe(STREAM_PARSER_STATE.ANSWERING);
    expect(parser.getReasoning()).toBe(
      'Considering algorithmic complexity...'
    );

    parser.feed('The algorithm runs in O(n log n).');
    const result = parser.finish();

    expect(result.reasoning).toBe('Considering algorithmic complexity...');
    expect(result.answer).toBe('The algorithm runs in O(n log n).');
    expect(result.hasReasoning).toBe(true);
  });

  it('Case 3: should parse structured reasoning_content chunks (OpenAI / Ollama objects)', () => {
    const onReasoningStart = vi.fn();
    const onReasoningChunk = vi.fn();
    const onReasoningEnd = vi.fn();
    const onAnswerStart = vi.fn();
    const onAnswerChunk = vi.fn();

    const parser = new StreamParser({
      model: 'o1-preview',
      onReasoningStart,
      onReasoningChunk,
      onReasoningEnd,
      onAnswerStart,
      onAnswerChunk
    });

    // 1. OpenAI delta.reasoning_content chunks
    parser.feed({
      choices: [{ delta: { reasoning_content: 'Step 1: check parameters.' } }]
    });
    expect(parser.getState()).toBe(STREAM_PARSER_STATE.THINKING);
    expect(onReasoningStart).toHaveBeenCalledTimes(1);

    parser.feed({
      choices: [{ delta: { reasoning_content: ' Step 2: verify output.' } }]
    });
    expect(parser.getReasoning()).toBe(
      'Step 1: check parameters. Step 2: verify output.'
    );

    // 2. OpenAI delta.content transition
    parser.feed({
      choices: [{ delta: { content: 'Calculation complete: 42.' } }]
    });
    expect(parser.getState()).toBe(STREAM_PARSER_STATE.ANSWERING);
    expect(onReasoningEnd).toHaveBeenCalledTimes(1);
    expect(onAnswerStart).toHaveBeenCalledTimes(1);
    expect(onAnswerChunk).toHaveBeenCalledWith(
      'Calculation complete: 42.',
      'Calculation complete: 42.',
      expect.anything()
    );

    const result = parser.finish();
    expect(result.reasoning).toBe(
      'Step 1: check parameters. Step 2: verify output.'
    );
    expect(result.answer).toBe('Calculation complete: 42.');
  });

  it('Case 3b: should parse Ollama message format (thinking and content)', () => {
    const parser = new StreamParser();

    parser.feed({
      message: { thinking: 'Deep reasoning in Ollama...' }
    });
    expect(parser.getState()).toBe(STREAM_PARSER_STATE.THINKING);

    parser.feed({
      message: { content: 'Ollama final answer.' }
    });
    expect(parser.getState()).toBe(STREAM_PARSER_STATE.ANSWERING);

    const result = parser.finish();
    expect(result.reasoning).toBe('Deep reasoning in Ollama...');
    expect(result.answer).toBe('Ollama final answer.');
  });

  it('Case 4: should handle direct stream without any thinking tags or fields', () => {
    const onReasoningStart = vi.fn();
    const onReasoningChunk = vi.fn();
    const onReasoningEnd = vi.fn();
    const onAnswerStart = vi.fn();
    const onAnswerChunk = vi.fn();
    const onAnswerEnd = vi.fn();

    const parser = new StreamParser({
      onReasoningStart,
      onReasoningChunk,
      onReasoningEnd,
      onAnswerStart,
      onAnswerChunk,
      onAnswerEnd
    });

    parser.feed('Hello world!');
    expect(parser.getState()).toBe(STREAM_PARSER_STATE.ANSWERING);
    expect(onReasoningStart).not.toHaveBeenCalled();
    expect(onReasoningChunk).not.toHaveBeenCalled();
    expect(onReasoningEnd).not.toHaveBeenCalled();
    expect(onAnswerStart).toHaveBeenCalledTimes(1);
    expect(onAnswerChunk).toHaveBeenCalledWith(
      'Hello world!',
      'Hello world!',
      expect.anything()
    );

    parser.feed(' How may I assist you?');
    const result = parser.finish();

    expect(result.reasoning).toBe('');
    expect(result.answer).toBe('Hello world! How may I assist you?');
    expect(result.hasReasoning).toBe(false);
    expect(onAnswerEnd).toHaveBeenCalledWith(
      'Hello world! How may I assist you?',
      expect.any(Number)
    );
  });

  it('Case 5: should handle tags split across chunk boundaries (fine-grained micro chunks)', () => {
    const onReasoningStart = vi.fn();
    const onReasoningEnd = vi.fn();
    const parser = new StreamParser({
      onReasoningStart,
      onReasoningEnd
    });

    // Feed start tag character-by-character
    const startChars = ['<', 't', 'h', 'i', 'n', 'k', '>'];
    for (const char of startChars) {
      parser.feed(char);
    }
    expect(parser.getState()).toBe(STREAM_PARSER_STATE.THINKING);
    expect(onReasoningStart).toHaveBeenCalledTimes(1);

    // Feed reasoning content
    parser.feed('Thinking line 1.');
    parser.feed(' Thinking line 2.');

    // Feed end tag split across chunks
    parser.feed('</th');
    expect(parser.getState()).toBe(STREAM_PARSER_STATE.THINKING);
    // '</th' should NOT be emitted into reasoning
    expect(parser.getReasoning()).toBe(
      'Thinking line 1. Thinking line 2.'
    );

    // Complete the end tag
    parser.feed('ink>Final answer.');
    expect(parser.getState()).toBe(STREAM_PARSER_STATE.ANSWERING);
    expect(onReasoningEnd).toHaveBeenCalledTimes(1);
    expect(parser.getAnswer()).toBe('Final answer.');

    const result = parser.finish();
    expect(result.reasoning).toBe('Thinking line 1. Thinking line 2.');
    expect(result.answer).toBe('Final answer.');
  });

  it('Case 5b: should handle <thought> tag split into single characters', () => {
    const parser = new StreamParser();
    const chunks = [
      '<',
      't',
      'h',
      'o',
      'u',
      'g',
      'h',
      't',
      '>',
      'Micro',
      ' thought',
      '<',
      '/',
      't',
      'h',
      'o',
      'u',
      'g',
      'h',
      't',
      '>',
      'Micro',
      ' answer'
    ];

    for (const chunk of chunks) {
      parser.feed(chunk);
    }

    const result = parser.finish();
    expect(result.reasoning).toBe('Micro thought');
    expect(result.answer).toBe('Micro answer');
    expect(result.hasReasoning).toBe(true);
  });

  it('Case 6: should handle empty thinking tags <think></think> gracefully', () => {
    const onReasoningStart = vi.fn();
    const onReasoningEnd = vi.fn();
    const onAnswerStart = vi.fn();
    const onAnswerChunk = vi.fn();

    const parser = new StreamParser({
      onReasoningStart,
      onReasoningEnd,
      onAnswerStart,
      onAnswerChunk
    });

    parser.feed('<think></think>Direct response without actual thoughts.');
    expect(onReasoningStart).toHaveBeenCalledTimes(1);
    expect(onReasoningEnd).toHaveBeenCalledWith(
      expect.objectContaining({ fullReasoning: '' })
    );
    expect(onAnswerStart).toHaveBeenCalledTimes(1);
    expect(onAnswerChunk).toHaveBeenCalledWith(
      'Direct response without actual thoughts.',
      'Direct response without actual thoughts.',
      expect.anything()
    );

    const result = parser.finish();
    expect(result.reasoning).toBe('');
    expect(result.answer).toBe(
      'Direct response without actual thoughts.'
    );
    expect(result.hasReasoning).toBe(false);
  });

  it('Case 7: should support multi-turn reasoning in a single stream', () => {
    const onReasoningStart = vi.fn();
    const onReasoningEnd = vi.fn();
    const onAnswerChunk = vi.fn();

    const parser = new StreamParser({
      onReasoningStart,
      onReasoningEnd,
      onAnswerChunk
    });

    parser.feed('<think>Step 1 analysis</think>Action 1.');
    expect(onReasoningStart).toHaveBeenCalledTimes(1);
    expect(onReasoningEnd).toHaveBeenCalledTimes(1);
    expect(parser.getAnswer()).toBe('Action 1.');

    parser.feed('<think>Step 2 verification</think>Action 2.');
    expect(onReasoningStart).toHaveBeenCalledTimes(2);
    expect(onReasoningEnd).toHaveBeenCalledTimes(2);

    const result = parser.finish();
    expect(result.reasoning).toBe(
      'Step 1 analysisStep 2 verification'
    );
    expect(result.answer).toBe('Action 1.Action 2.');
  });

  it('Case 8: should handle non-tag angle brackets < in normal answer text', () => {
    const onAnswerChunk = vi.fn();
    const parser = new StreamParser({ onAnswerChunk });

    parser.feed('Notice that 3 < 5 and 10 > 2.');
    const result = parser.finish();

    expect(result.reasoning).toBe('');
    expect(result.answer).toBe('Notice that 3 < 5 and 10 > 2.');
    expect(result.hasReasoning).toBe(false);
  });

  it('Case 9: should handle leading whitespace before <think> tag', () => {
    const parser = new StreamParser();

    parser.feed('  \n\n<think>Thinking with leading newlines</think>Hello!');
    const result = parser.finish();

    expect(result.reasoning).toBe('Thinking with leading newlines');
    expect(result.answer).toBe('Hello!');
  });

  it('Case 10: should flush cleanly when stream finishes inside thinking state', () => {
    const onReasoningEnd = vi.fn();
    const onAnswerEnd = vi.fn();

    const parser = new StreamParser({
      onReasoningEnd,
      onAnswerEnd
    });

    parser.feed('<think>Unfinished reasoning block');
    expect(parser.getState()).toBe(STREAM_PARSER_STATE.THINKING);

    const result = parser.finish();
    expect(parser.getState()).toBe(STREAM_PARSER_STATE.FINISHED);
    expect(onReasoningEnd).toHaveBeenCalledWith(
      expect.objectContaining({ fullReasoning: 'Unfinished reasoning block' })
    );
    expect(onAnswerEnd).toHaveBeenCalled();
    expect(result.reasoning).toBe('Unfinished reasoning block');
    expect(result.answer).toBe('');
  });

  it('Case 11: should support reset and re-execution on the same parser instance', () => {
    const parser = new StreamParser();

    parser.feed('<think>First cycle</think>Answer 1');
    const r1 = parser.finish();
    expect(r1.reasoning).toBe('First cycle');
    expect(r1.answer).toBe('Answer 1');

    parser.reset();
    expect(parser.getState()).toBe(STREAM_PARSER_STATE.IDLE);
    expect(parser.getReasoning()).toBe('');
    expect(parser.getAnswer()).toBe('');

    parser.feed('Direct answer in second cycle');
    const r2 = parser.finish();
    expect(r2.reasoning).toBe('');
    expect(r2.answer).toBe('Direct answer in second cycle');
    expect(r2.hasReasoning).toBe(false);
  });

  it('Case 12: should ignore feed calls once finished', () => {
    const parser = new StreamParser();
    parser.feed('Initial');
    parser.finish();
    expect(parser.getState()).toBe(STREAM_PARSER_STATE.FINISHED);

    parser.feed('Ignored text');
    expect(parser.getAnswer()).toBe('Initial');
  });
});
