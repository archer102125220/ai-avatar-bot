/**
 * 建立使用者輸入處理管線 (User Input Pipeline: handleUser)。
 *
 * @param {Object} params
 * @param {import('./types').AiAvatarWidget} params.widget - Widget 實例
 * @param {import('../store').BaseStore} params.rootStore - 狀態 Store
 * @param {any} params.i18nEngine - 多語系引擎實例
 * @param {() => { brainEngine: any, speechEngine: any, skinEngine: any, toolsEngine: any }} params.getEngines - 取得各引擎實例的函式
 * @param {{ isActive: boolean, continuationIndex: number, maxContinuations: number, accumulatedText: string }} params.autoContinueState - 自動接續狀態物件
 * @returns {(text?: string) => void} handleUser 函式
 */
export function createUserPipeline({
  widget,
  rootStore,
  i18nEngine,
  getEngines,
  autoContinueState
}) {
  return function handleUser(text = '') {
    const { brainEngine, speechEngine, skinEngine, toolsEngine } = getEngines();

    autoContinueState.isActive = false;
    autoContinueState.continuationIndex = 0;
    autoContinueState.maxContinuations = 0;
    autoContinueState.accumulatedText = '';

    if (typeof text === 'string' && text !== '') {
      if (typeof speechEngine?.stopSpeaking === 'function') {
        speechEngine.stopSpeaking();
      }
      if (typeof brainEngine?.addChatMessage === 'function') {
        brainEngine.addChatMessage('user', text);
      }
      if (speechEngine !== null && typeof speechEngine === 'object') {
        speechEngine.spokenDisplayText =
          typeof i18nEngine?.t === 'function'
            ? i18nEngine.t('brain.userPrefix', { text })
            : '你：' + text;
      }
    }

    if (
      typeof text === 'string' &&
      text !== '' &&
      toolsEngine !== null &&
      typeof toolsEngine === 'object'
    ) {
      if (
        typeof toolsEngine.pendingToolConfirmation === 'string' &&
        toolsEngine.pendingToolConfirmation !== '' &&
        toolsEngine.continueToolConfirmation(text) === true
      ) {
        return;
      }
      if (
        typeof toolsEngine.pendingToolChoice === 'object' &&
        toolsEngine.pendingToolChoice !== null &&
        toolsEngine.continueToolChoice(text) === true
      ) {
        return;
      }
      if (
        typeof toolsEngine.pendingToolInput === 'object' &&
        toolsEngine.pendingToolInput !== null &&
        toolsEngine.continueToolInput(text) === true
      ) {
        return;
      }
    }

    if (
      brainEngine?.memory?.enabled === true &&
      typeof text === 'string' &&
      text !== ''
    ) {
      if (/忘記我|清除記憶|forget me/i.test(text) === true) {
        brainEngine.memory.wipe();
        if (speechEngine !== null && typeof speechEngine === 'object') {
          speechEngine.spokenAudioText =
            typeof i18nEngine?.t === 'function'
              ? i18nEngine.t('brain.wipeMemory')
              : '好，我把記憶都清掉了，我們重新認識吧！';
        }
        return;
      }
      if (typeof brainEngine.memory.captureName === 'function') {
        brainEngine.memory.captureName(text);
      }
      if (typeof brainEngine.memory.addTurn === 'function') {
        brainEngine.memory.addTurn('user', text);
      }
    }

    if (
      toolsEngine !== null &&
      typeof toolsEngine === 'object' &&
      typeof toolsEngine.routeHostTool === 'function'
    ) {
      const routedTool = toolsEngine.routeHostTool(text);
      if (
        Array.isArray(routedTool.ambiguous) === true &&
        routedTool.ambiguous.length > 0
      ) {
        if (speechEngine !== null && typeof speechEngine === 'object') {
          speechEngine.isProcessing = false;
        }
        toolsEngine.offerToolChoices(text, routedTool.ambiguous);
        return;
      }
      if (typeof routedTool.match === 'object' && routedTool.match !== null) {
        if (speechEngine !== null && typeof speechEngine === 'object') {
          speechEngine.isProcessing = false;
        }
        toolsEngine.prepareTool(
          routedTool.match.tool,
          text,
          { confidence: routedTool.match.score, reason: routedTool.match.reason },
          {
            skinEngine,
            brainEngine,
            speechEngine,
            aiAvatarWidget: widget,
            store: rootStore,
            i18nEngine
          }
        );
        return;
      }
    }

    if (speechEngine !== null && typeof speechEngine === 'object') {
      speechEngine.isProcessing = true;
    }

    if (
      typeof skinEngine === 'object' &&
      skinEngine !== null &&
      skinEngine.gestureName !== undefined
    ) {
      skinEngine.gestureName = 'thinking';
    }

    if (typeof brainEngine?.answerQuestion === 'function') {
      brainEngine.answerQuestion(text);
    }
  };
}
