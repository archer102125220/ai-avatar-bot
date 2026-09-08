/**
 * 從文字判斷情緒狀態
 * @param {string} text - 輸入文字
 * @returns {'surprised'|'sad'|'happy'|'neutral'} 情緒狀態
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
 * 根據文字觸發虛擬人情緒動作變更
 * @param {Object} brainEngine - 大腦引擎實例
 * @param {string} text - 回應文字
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

/**
 * 相容別名：setEmotionFromText -> applyEmotionFromText
 */
export const setEmotionFromText = applyEmotionFromText;
