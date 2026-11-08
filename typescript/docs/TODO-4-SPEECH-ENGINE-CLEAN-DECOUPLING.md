# 📌 TODO 4：語音引擎跨領域狀態解耦與動態收集規格書
*(Domain-Neutral Speech Engine Decoupling & Dynamic Registry Specification)*

> **文件狀態**：草案與動態更新中 (Living Document / RFC)  
> **建立日期**：2026-11-08  
> **對應追蹤**：`package/typescript/README_ZH.md` 🗺️ 未來架構演進待辦事項（TODO 4）  
> **關聯核心**：`package/typescript/core/speech/`、`package/typescript/core/orchestrator/`、`package/typescript/core/tools/`、`package/typescript/core/ui/`、`package/typescript/core/i18n/`  
> **關聯前期**：[`docs/TODO-1-DOMAIN-NEUTRAL-BRAIN-DECOUPLING.md`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/docs/TODO-1-DOMAIN-NEUTRAL-BRAIN-DECOUPLING.md)

---

## 🎯 一、背景與重構目標 (Background & Objective)

### 1.1 現況痛點 (Current Problem)
目前在 `package/typescript/core/speech/` 中，語音引擎直接承襲了來自 `origin` 單體前端架構的跨領域雜質：
1. **大腦推論生命週期洩漏**：`SpeechEngineState.isProcessing` 直接由大腦推論流程強制修改，並由 STT 用來判斷化身是否正在思考。
2. **UI 氣泡與字幕狀態硬塞**：`SpeechEngineState.spokenDisplayText` 與內部 6 秒計時器（`spokenDisplayTextTimer`）負責關閉 DOM 氣泡，音訊引擎直接掌管了 UI 表現層。
3. **副作用賦值反模式**：全專案多處透過 `speechEngine.spokenAudioText = '...'` 賦值引發 store 監聽來觸發語音播放（這正好是大腦 `onSpokenAudioPlayNow` / `onSpokenAudioTextChange` 的接收端）。
4. **化身互動防抖滲透**：`SpeechEngine.onTapTimer` 與 `triggerTap()` 負責化身點擊防抖與轉發，把點擊業務邏輯塞進了語音核心。
5. **全域開關名稱非標準化**：`convoOn`（口語縮寫）與 `ttsMuted`（前綴不一致）。

### 1.2 治理策略：分層治理與動態收集 (Two-Tier Governance)
若現在直接對全專案的上述項目進行硬性切除，將一次波及 15+ 個管線與 UI 檔案，造成巨大的爆炸半徑。因此我們比照先前大腦重構的成功模式：
* **語音內部純淨化（Tier 1 先行處理）**：死碼與無用私有狀態清理（`container`、`STTEngineState` 之 `spokenDisplayText` / `lastRestart` / `speechStartTime`、`tts.ts` 內部 5 個死屬性、`index.ts` 內部 `_speechQueue` / `_speechBuffer` / `_speechEndedFlag`）、實例方法 `drainSentences` 標註 `@deprecated`、STT/TTS 內部現代化與快取修復（`preloadAudio`、`playbackRate`、`consecutiveNoSpeechCount`、`onSpeakStart(text)` 參數補齊、`CustomEnginesConfig.speech` 注入驗證）。
* **跨領域強耦合項目（本 TODO 4 封存追蹤）**：建立**「跨引擎動態收集看板」**，在後續依序重構工具（Tools）、國際化（I18n）、UI 與互動層時，邊處理邊收集真實邊界規格，最後於協調層（Orchestrator）一口氣乾淨收網！

---

## 📋 二、跨引擎動態收集看板 (Cross-Engine Dynamic Coupling Registry)

> 💡 **使用說明**：當您在整理 `ToolsEngine`、`I18nEngine`、`UiEngine` 與 `Interaction` 的型別與參數時，凡是有發現和語音相關的隱性依賴或具體規格，請直接將條目追加在此區。

### 發現與收集清單：

- [ ] **耦合項 01（ToolsEngine 發音回呼中立化）**：
  * **現狀**：`core/tools/index.ts` 內有 9 處直接呼叫 `toolsEngine.onSpokenAudioPlayNow`，在取消、確認工具執行時直接發聲。
  * **待收集規格**：當重構工具引擎時，釐清工具執行完畢（或確認/取消）時需要傳遞給協調層的中立通知格式（如 `onNoticeMessage(msg: string)`），由 Orchestrator 統一調用 `speechEngine.speak()`。
  * **收集進度**：⏳ 待整理 ToolsEngine 時記錄。

- [ ] **耦合項 02（I18nEngine 多語系字典與標籤抽離）**：
  * **現狀**：`stt.ts` 內部維護了 `DEFAULT_STT_MESSAGES`（四語系字典），且 `SpeechEngine.setLocale()` 內部寫死了 `'英文 (English)'`、`'日文 (日本語)'` 等中文標籤。
  * **待收集規格**：當重構國際化模組時，規範語音錯誤提示（如麥克風拒絕、未偵測到聲音）如何改由 `i18nEngine.t('speech.*')` 統一提供，將硬編碼字串自語音模組徹底抽離。
  * **收集進度**：⏳ 待整理 I18nEngine 時記錄。

- [ ] **耦合項 03（UI 模組氣泡字幕與 6 秒定時器解耦）**：
  * **現狀**：`SpeechEngine` 內部跑了 6 秒計時器（`spokenDisplayTextTimer`）去控制 `bubbleEl` 氣泡關閉；且 STT 與 TTS 隨時直接修改 `spokenDisplayText`。
  * **待收集規格**：當重構 UI 模組時，將氣泡的顯示、打字動態與淡出計時完全歸回 UI 模組管理。語音模組僅需純粹拋出 `onSpeakStart(text)`、`onSpeakEnd()`、`onResult(text)`，由 UI 自行監聽更新 DOM。
  * **收集進度**：⏳ 待整理 UI 模組時記錄。

- [ ] **耦合項 04（Interaction 與 UI 化身點擊防抖移出）**：
  * **現狀**：`core/orchestrator/interaction.ts` 中使用 `speechEngine.onTapTimer = true` 進行點擊化身手勢與發聲的防抖；此外 `core/ui/types.ts`（L78 `UiDom.onTapTimer`）與 `core/ui/dom.ts`（L427 `onTapTimer: false`）亦殘留了完全未使用的同名死屬性。
  * **待收集規格**：當重構互動層與 UI 層時，將化身點擊防抖收斂至 interaction 模組自建閉包變數，從 `SpeechEngine` 徹底移除 `onTapTimer` 與 `triggerTap()`，並同步刪除 `UiDom.onTapTimer`。
  * **收集進度**：⏳ 待整理 Interaction 互動層與 UI 模組時記錄。

- [ ] **耦合項 05（BrainEngine 與管線副作用賦值徹底消除）**：
  * **現狀**：大腦輸出時，在 `engine-factory.ts`、`pipeline-user.ts` 透過 `speechEngine.spokenAudioText = text` 賦值來觸發發聲。
  * **待收集規格**：與大腦 TODO 1 鏡像對齊。大腦推論完成觸發中立回呼 `onOutputTextReady(text)` 時，Orchestrator 直接執行 `speechEngine.speak(text)`（Tier 1 已確保 `tts.ts` 呼叫 `onSpeakStart(text)` 時會傳入 `text` 字串），廢止所有屬性賦值副作用。
  * **收集進度**：⏳ 待協調層整合時一併收網。

- [ ] **耦合項 06（RootStore / Widget 全域開關名稱收斂）**：
  * **現狀**：全專案多處散落 `convoOn`（口語縮寫）與 `ttsMuted`（前綴不一致）。
  * **待收集規格**：在 Orchestrator 與 RootStore 重構時，統一將狀態屬性提升為標準的 `continuousMode` 與 `isMuted`。
  * **收集進度**：⏳ 待協調層整合時一併收網。

- [ ] **耦合項 07（串流管線 `drainSentences` 純函式化與實例轉發方法移除）**：
  * **現狀**：`core/orchestrator/pipeline-stream.ts` 內有 5 處（L208, L221, L247, L265, L284）透過 `speechEngine.drainSentences(...)` 調用實例上的包裝方法，且 `test/unit/orchestrator/pipeline.test.ts` 有 5 處 mock（Tier 1 採用方案 A 先行標註 `@deprecated` 保留以避免波及管線）。
  * **待收集規格**：在協調層與串流管線收網時，將 `pipeline-stream.ts` 改為直接 `import { drainSentences } from '@/core/speech'` 呼叫頂層純函式，更新 `pipeline.test.ts`，並自 `SpeechEngine` 介面與實例徹底移除 `drainSentences`。
  * **收集進度**：⏳ 待協調層整合時一併收網。

- [ ] **耦合項 08（UI 與頂層 `AvatarBotOptions` 語音新舊別名全面收斂）**：
  * **現狀**：`core/ui/events.ts` 仍讀寫舊名 `speechEngine.ttsRate`（L151–L159）與 `speechEngine.noSpeechRuns`（L90）；頂層 `AvatarBotOptions`（`core/orchestrator/types.ts` L416–L431 與 `engine-factory.ts` L819–L901）仍使用舊回呼名稱（`onSpeaking`、`onSpeakingEnd`、`onMicStateChanged`、`onVoiceStatusChanged`、`onLanguageChanged`）。
  * **待收集規格**：在 UI 模組與協調層收網時，將 `core/ui/events.ts` 改用 `playbackRate` 與 `consecutiveNoSpeechCount`，於 `AvatarBotOptions` 對齊標準回呼命名（`onSpeakStart`、`onSpeakEnd`、`onMicStateChange`、`onVoiceStatusChange`、`onLanguageChange`），並清除 Tier 1 過渡期保留的 `@deprecated` 別名（`preloadTapGreeting`、`ttsRate`、`noSpeechRuns`）。
  * **收集進度**：⏳ 待 UI 模組與協調層整合時一併收網。

---

## 🏗️ 三、受影響之跨引擎依賴矩陣 (Cross-Engine Dependency Matrix)

在後續模組重構與協調層接網時，請依下列中立架構進行對齊：

```mermaid
flowchart TD
    subgraph Brain ["大腦引擎 (core/brain) - TODO 1"]
        B1["輸出中立回呼：onOutputTextReady(text)"]
    end

    subgraph Tools ["工具引擎 (core/tools)"]
        TL1["輸出中立回呼：onNoticeMessage(text)"]
    end

    subgraph Speech ["語音引擎 (core/speech) - TODO 4"]
        SP1["核心入口：speak(text, options)"]
        SP2["口型計算：computeMouth() 0~1"]
        SP3["語音事件：onSpeakStart / onSpeakEnd"]
    end

    subgraph Skin ["外觀引擎 (core/skin)"]
        SK1["每幀調用 computeMouth() 計算嘴型 Viseme"]
        SK2["監聽 isSpeaking 驅動 talking 動作池"]
    end

    subgraph UI ["介面模組 (core/ui)"]
        UI1["監聽語音事件控制 bubbleEl 顯示與 6s 計時"]
        UI2["控制 continuousMode 與 isMuted 開關"]
    end

    subgraph Orchestrator ["協調層 (core/orchestrator) - 終點收網"]
        OC1["接管大腦 onOutputTextReady ➔ 轉發 speech.speak()"]
        OC2["接管工具 onNoticeMessage ➔ 轉發 speech.speak()"]
        OC3["獨立管理化身點擊防抖 (消滅 onTapTimer)"]
        OC4["計算 assistantActive (消滅 speech.isProcessing)"]
    end

    Brain -->|onOutputTextReady| Orchestrator
    Tools -->|onNoticeMessage| Orchestrator
    Orchestrator -->|speak(text)| Speech
    Speech -->|computeMouth()| Skin
    Speech -->|isSpeaking| Skin
    Speech -->|onSpeakStart / onSpeakEnd| UI
```

---

## 🛡️ 四、終極純淨目標介面預覽 (Target Clean Architecture Interface)

當所有後續引擎整理完畢、協調層統一收網後，`SpeechEngine` 將達成的最終純淨型別：

```typescript
export interface SpeechEngine extends SubscribableStore<SpeechEngineState> {
  /** 當前語音性別 ('female' | 'male') */
  gender: Gender;
  setGender(gender: Gender): void;

  /** 當前語言語系代碼 (例如 'zh-TW', 'en-US') */
  locale: string;
  setLocale(locale: string): void;

  /** TTS 語音合成 API 端點 */
  ttsEndpoint: string;
  /** 語音模型識別碼 */
  neuralVoice?: string;
  /** 當前語音句子流序號 */
  speakSeq: number;

  /** 是否正在播放語音合成音訊 (外觀引擎動作池依賴，維持不動) */
  readonly isSpeaking: boolean;
  /** 是否正在監聽麥克風輸入 (維持不動) */
  readonly isListening: boolean;
  /** 是否處於靜音狀態 (標準命名) */
  isMuted: boolean;
  /** 語音播放倍率 (標準命名) */
  playbackRate: number;

  /** 連續無語音偵測次數 (標準命名) */
  consecutiveNoSpeechCount: number;
  /** 是否啟用即時持續對話模式 (標準命名) */
  continuousMode: boolean;

  /**
   * 核心發聲方法：立即合成並播放指定文字
   */
  speak(text: string, options?: TTSSpeakOptions): void;
  /** 立即停止當前語音播放 */
  stopSpeaking(): void;
  /** 使用者插話打斷 (Barge-in)，停止播放並重啟麥克風監聽 */
  interruptForVoice(): void;

  /**
   * 核心口型計算：計算當前幀的嘴型張合幅度 (0 ~ 1)
   * (外觀引擎 2D/3D 口型同步專用，維持不動)
   */
  computeMouth(): number;

  /** 結束即時語音對話 Session */
  stopVoiceSession(message?: string): void;
  /** 設定麥克風監聽狀態並觸發通知 */
  setMic(isListening: boolean): void;
  /** 啟動麥克風監聽 */
  startListening(): void;

  /** 預先載入並快取指定文字之語音音訊 Buffer (通用現代化名稱) */
  preloadAudio(text: string): Promise<AudioBuffer | null> | void;

  /** 串流語音序號管理 */
  beginSpeech(): number;
  pushSpeech(speechSequenceId: number, text: string, options?: TTSSpeakOptions): void;
  endSpeech(speechSequenceId: number): void;
  onUtteranceEnd(): void;
}
```

---

## 🚀 五、最終驗收清單 (Final Acceptance Checklist)

當所有引擎盤點完畢、協調層執行最後收網時，逐一驗收確認：

- [ ] `core/speech/` 完全清除 `spokenAudioText`、`spokenDisplayText`、`isProcessing`、`onTapTimer`、`triggerTap()`、實例方法 `drainSentences` 以及過渡期 `@deprecated` 別名（`preloadTapGreeting`、`ttsRate`、`noSpeechRuns`、舊式 `-ed` 回呼）。
- [ ] `core/tools/` 徹底移除 `onSpokenAudioPlayNow`，改發送中立通知回呼。
- [ ] `core/i18n/` 完整接管語音模組的所有提示訊息字典與語言顯示標籤。
- [ ] `core/ui/` 完整接管字幕氣泡 DOM 生命週期與 6 秒定時器，移除 `UiDom.onTapTimer` 死屬性，並於 `events.ts` 改用 `playbackRate` 與 `consecutiveNoSpeechCount`。
- [ ] `core/orchestrator/interaction.ts` 自主維護點擊防抖，直接呼叫 `preloadAudio()` 與 `speak()`。
- [ ] `core/orchestrator/pipeline-*.ts` 全面改用 `speechEngine.speak()`、`isMuted` 與頂層純函式 `import { drainSentences } from '@/core/speech'`。
- [ ] `core/orchestrator/types.ts`（`AvatarBotOptions`）與 `engine-factory.ts` 全面對齊標準語音回呼命名（`onSpeakStart`、`onSpeakEnd`、`onMicStateChange`、`onVoiceStatusChange`、`onLanguageChange`）。
- [ ] 單元測試全數通過（`yarn test:unit`）且型別檢查零錯誤（`yarn test:typecheck`）。
- [ ] `README_ZH.md` 狀態更新為 `✅ TODO 4 (Implemented)`。

