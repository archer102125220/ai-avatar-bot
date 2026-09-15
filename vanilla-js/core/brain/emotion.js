/**
 * Classifies emotional sentiment from text.
 *
 * @param {string} text - Input text to evaluate.
 * @returns {'surprised' | 'sad' | 'happy' | 'neutral'} Detected emotion state.
 */
export function classifyEmotion(text) {
  const safeText = String(text || '');
  const countPattern = (regex) => (safeText.match(regex) || []).length;
  const surprised = countPattern(/哇|居然|竟然|沒想到|驚|真的嗎|！？|\?!|!\?/g);
  const sad = countPattern(
    /抱歉|對不起|可惜|遺憾|失敗|錯誤|沒辦法|不支援|不行|連不上|難過|唉/g
  );
  const happy = countPattern(
    /哈|笑|開心|太好了|好耶|讚|恭喜|歡迎|謝謝|沒問題|完成|成功|一起|囉|喔！|🎉|😊|👋/g
  );
  if (surprised > 0 && surprised >= Math.max(happy, sad)) {
    return 'surprised';
  }
  if (sad > happy) {
    return 'sad';
  }
  if (happy > 0) {
    return 'happy';
  }
  return 'neutral';
}

/**
 * Triggers avatar emotion/gesture updates based on the sentiment of the response text.
 *
 * @param {import('../../index.d.ts').BrainEngine | Object} brainEngine - Brain engine instance.
 * @param {string} text - Response text.
 */
export function applyEmotionFromText(brainEngine, text) {
  if (
    typeof brainEngine === 'object' &&
    brainEngine !== null &&
    typeof brainEngine.onEmotionChange === 'function'
  ) {
    brainEngine.onEmotionChange(classifyEmotion(text));
  }
}
