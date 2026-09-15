/**
 * Creates the user input handling pipeline (`handleUser`).
 *
 * @param {Object} params
 * @param {import('../../index.d.ts').AiAvatarWidget} [params.widget] - Widget instance.
 * @param {() => import('../../index.d.ts').AiAvatarWidget} [params.getWidget] - Getter returning the widget instance.
 * @param {import('../../index.d.ts').BaseStore} params.rootStore - Central reactive state store.
 * @param {any} params.i18nEngine - Internationalization engine instance.
 * @param {() => { brainEngine: any, speechEngine: any, skinEngine: any, toolsEngine: any }} params.getEngines - Getter returning all engine instances.
 * @param {{ isActive: boolean, continuationIndex: number, maxContinuations: number, accumulatedText: string }} params.autoContinueState - Auto-continue state tracking object.
 * @returns {(text?: string) => void} User input pipeline handler function.
 */
export function createUserPipeline({
  widget,
  getWidget,
  rootStore,
  i18nEngine,
  getEngines,
  autoContinueState
}) {
  const resolveWidget =
    typeof getWidget === 'function' ? getWidget : () => widget;

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
        if (typeof brainEngine.memory.clear === 'function') {
          brainEngine.memory.clear();
        }
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
          {
            confidence: routedTool.match.score,
            reason: routedTool.match.reason
          },
          {
            skinEngine,
            brainEngine,
            speechEngine,
            aiAvatarWidget: resolveWidget(),
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
