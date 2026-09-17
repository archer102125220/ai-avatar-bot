import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initUi } from '@/core/ui/dom';
import { initI18nEngine } from '@/core/i18n';
import type { I18nEngine } from '@types';

describe('UI DOM & Scaffolding (initUi)', () => {
  let container: HTMLElement;
  let stageEl: HTMLElement;
  let i18nEngine: I18nEngine;

  beforeEach(() => {
    container = document.createElement('div');
    stageEl = document.createElement('div');
    stageEl.id = 'stage';
    i18nEngine = initI18nEngine({ locale: 'zh-TW' });
  });

  it('should return undefined and log error if container or stageEl is invalid', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // @ts-ignore: Defensive runtime type checking test
    expect(initUi(null, stageEl, i18nEngine)).toBeUndefined();
    // @ts-ignore: Defensive runtime type checking test
    expect(initUi(container, null, i18nEngine)).toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it('should create all required DOM elements and attach them to container and stage', () => {
    const uiDom: any = initUi(container, stageEl, i18nEngine);

    expect(uiDom).toBeDefined();
    expect(uiDom.stageEl).toBe(stageEl);
    expect(uiDom.bubbleEl.id).toBe('bubble');
    expect(uiDom.suggestionsEl.id).toBe('suggestions');
    expect(uiDom.historyPanelEl.id).toBe('history-panel');
    expect(uiDom.controlBarEl.id).toBe('control-bar');
    expect(uiDom.voiceLiveEl.id).toBe('voice-live');
    expect(uiDom.voiceStatusEl.id).toBe('voice-status');
    expect(uiDom.voiceLevelEl.id).toBe('voice-level');
    expect(uiDom.questionInputEl.id).toBe('type-input');
    expect(uiDom.sendButtonEl.id).toBe('btn-send');
    expect(uiDom.micButtonEl.id).toBe('btn-mic');
    expect(uiDom.btnLlmEl.id).toBe('btn-llm');
    expect(uiDom.engineButtonEl.id).toBe('btn-engine');
    expect(uiDom.muteButtonEl.id).toBe('btn-mute');
    expect(uiDom.speedButtonEl.id).toBe('btn-speed');
    expect(uiDom.langButtonEl.id).toBe('btn-lang');
    expect(uiDom.historyButtonEl.id).toBe('btn-history');
    expect(uiDom.closeButtonEl.id).toBe('btn-close');
    expect(uiDom.dockRow1El).toBeDefined();
    expect(uiDom.dockRow2El).toBeDefined();
    expect(uiDom.directWarnEl).toBeDefined();
    expect(uiDom.minimalEl.className).toBe('aw-minimal');

    expect(container.contains(stageEl)).toBe(true);
    expect(container.contains(uiDom.minimalEl)).toBe(true);
    expect(stageEl.contains(uiDom.bubbleEl)).toBe(true);
    expect(stageEl.contains(uiDom.suggestionsEl)).toBe(true);
    expect(stageEl.contains(uiDom.historyPanelEl)).toBe(true);
    expect(stageEl.contains(uiDom.controlBarEl)).toBe(true);
  });

  it('should update voice status properly via uiDom.updateVoiceStatus', () => {
    const uiDom: any = initUi(container, stageEl, i18nEngine);

    uiDom.updateVoiceStatus(true, '正在聆聽…', 'listening', 75, i18nEngine);

    expect(uiDom.voiceLiveEl.getAttribute('css-is-active')).toBe('true');
    expect(uiDom.voiceLiveEl.getAttribute('css-state')).toBe('listening');
    expect(uiDom.voiceStatusEl.textContent).toBe('正在聆聽…');
    expect(uiDom.voiceLevelEl.style.width).toBe('75%');

    // Convo active but state is empty string -> removes css-state
    uiDom.updateVoiceStatus(true, '', '', 50);
    expect(uiDom.voiceLiveEl.getAttribute('css-state')).toBeNull();
    expect(uiDom.voiceStatusEl.textContent).toBeTruthy();

    uiDom.updateVoiceStatus(false, undefined, undefined, 0, i18nEngine);
    expect(uiDom.voiceLiveEl.getAttribute('css-is-active')).toBeNull();
    expect(uiDom.voiceLiveEl.getAttribute('css-state')).toBeNull();
  });

  it('should update mic button and suggestions visibility via uiDom.updateMicState', () => {
    const uiDom: any = initUi(container, stageEl, i18nEngine);

    // 1. Listening + companion
    uiDom.updateMicState(true, true, true, i18nEngine);
    expect(uiDom.micButtonEl.getAttribute('css-state')).toBe('listening');
    expect(uiDom.micButtonEl.getAttribute('aria-pressed')).toBe('true');
    expect(uiDom.suggestionsEl.style.display).toBe('none');

    // 2. ConvoOn without listening
    uiDom.updateMicState(false, true, false);
    expect(uiDom.micButtonEl.getAttribute('css-state')).toBeNull();
    expect(uiDom.micButtonEl.getAttribute('aria-pressed')).toBe('true');

    // 3. Completely idle
    uiDom.updateMicState(false, false, false, i18nEngine);
    expect(uiDom.micButtonEl.getAttribute('css-state')).toBeNull();
    expect(uiDom.micButtonEl.getAttribute('aria-pressed')).toBe('false');
    expect(uiDom.suggestionsEl.style.display).toBe('flex');
  });

  it('should handle static container positioning and fallback mic/voice translations without i18nEngine', () => {
    const staticContainer = document.createElement('div');
    staticContainer.style.position = 'static';
    const subStage = document.createElement('div');

    // @ts-ignore: Defensive runtime type checking test
    const uiDom: any = initUi(staticContainer, subStage, null);
    expect(uiDom).toBeDefined();
    expect(staticContainer.style.position).toBe('relative');

    // 1. Listening in assistant mode without i18nEngine
    uiDom.updateMicState(true, true, false, null as any);
    expect(uiDom.micButtonEl.textContent).toBe('● 聆聽中');

    // 2. Listening in companion mode without i18nEngine
    uiDom.updateMicState(true, true, true, null as any);
    expect(uiDom.micButtonEl.textContent).toBe('● 對話中');

    // 3. Convo standby without i18nEngine
    uiDom.updateMicState(false, true, false, null as any);
    expect(uiDom.micButtonEl.textContent).toBe('◌ 對話中');

    // 4. Idle live without i18nEngine
    uiDom.updateMicState(false, false, false, null as any);
    expect(uiDom.micButtonEl.textContent).toBe('🎙️ 即時');

    // 5. Voice status with undefined text and level clamp > 100
    uiDom.updateVoiceStatus(true, undefined, 'processing', 150, null as any);
    expect(uiDom.voiceStatusEl.textContent).toBe('即時語音待命');
    expect(uiDom.voiceLevelEl.style.width).toBe('100%');
  });
});
