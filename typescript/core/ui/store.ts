import { createBaseStore, type BaseStore } from '@/core/store';
import { DEFAULT_AVATAR_MODE } from '@/core/constants';
import type { UiEngineState } from './types';

/**
 * Creates a reactive BaseStore instance initialized with default UI state.
 */
export function createUiStore(
  initialState?: Partial<UiEngineState>
): BaseStore<UiEngineState> {
  return createBaseStore<UiEngineState>({
    bubbleText: '',
    isBubbleVisible: false,
    isThinking: false,
    isHistoryOpen: false,
    isMinimal: false,
    avatarMode: DEFAULT_AVATAR_MODE,
    voiceLive: {
      active: false,
      text: '',
      state: '',
      level: 0
    },
    mic: {
      isListening: false,
      continuousMode: false
    },
    ...initialState
  });
}
