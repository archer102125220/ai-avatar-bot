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

- [x] **耦合項 01（ToolsEngine 發音回呼與持續對話狀態中立化）**：
  * **現狀**：[`core/tools/index.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/tools/index.ts) 內共有 9 處直接呼叫 `toolsEngine.onSpokenAudioPlayNow`（L86 缺少必填參數提示、L112 取消補填參數、L140 參數驗證失敗重試提示、L193 提供多工具候選清單、L224 取消候選清單、L268 候選序號無法辨識重試提示、L375 詢問工具執行確認、L560 取消待確認工具、L636 工具執行結果朗讀），且 L556 透過 `setting.isConvoOn()`（對應 [`core/tools/types.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/tools/types.ts#L267) 與 [`core/orchestrator/engine-factory.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/orchestrator/engine-factory.ts#L1070)）讀取 `speechEngine.convoOn` 來判斷取消時是否發聲（但 L112 與 L224 同為取消卻未檢查 `isConvoOn`）。
  * **已收集規格**：於 `ToolsEngineOptions` 引入領域中立回呼 `onNoticeMessage?: (text: string, options?: ToolNoticeOptions) => void`（於 `v1.0.0` 正式版前直接移除舊名 `onSpokenAudioPlayNow`，不留過渡別名），其中 `ToolNoticeOptions` 攜帶 `{ phase?: 'input_prompt' | 'input_retry' | 'choice_offer' | 'choice_retry' | 'confirm_offer' | 'cancel' | 'result'; onlyInContinuousMode?: boolean }`，並自 `ToolsEngine` 移除對語音狀態 `isConvoOn` 的感知；改由協調層（`engine-factory.ts`）統一依 `speechEngine.continuousMode` 與 `speechEngine.isMuted` 決定是否調用 `speechEngine.speak(text)`。
  * **收集進度**：✅ 已於盤點 ToolsEngine 時完成規格收集（待協調層與跨引擎收網時實作）。

- [x] **耦合項 02（I18nEngine 多語系字典、死鍵合一與語系切換三重觸發解耦）**：
  * **現狀**：
    1. **`DEFAULT_STT_MESSAGES` 與 `core/i18n/locales/*.ts` 的 `speech.*` 雙軌字典分裂（8 個死鍵 + 4 個未入庫硬編碼字串）**：
       - [`core/i18n/locales/`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/i18n/locales/zh-TW.ts#L45-L53) 四語系字典中雖已定義 9 個 `speech.*` 鍵，但除了 `speech.sessionEnded` 被 [`core/ui/events.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/ui/events.ts#L82) 讀取外，其餘 8 個鍵（`speech.unsupported`、`speech.micError`、`speech.startFailed`、`speech.listening`、`speech.permissionDenied`、`speech.noSpeech`、`speech.bgStop`、`speech.noSpeechAbort`）在全專案 **0 次引用**！
       - [`core/speech/stt.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/speech/stt.ts#L48-L139) 另行硬編碼了一份完全重複的 `DEFAULT_STT_MESSAGES` 與 `getSttMessage()`，且多出一個未收錄於 `locales/*.ts` 的 `requestPermission`（`'正在取得麥克風權限…'`）；此外 [`core/speech/index.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/speech/index.ts) 還硬編碼了 L595 `'已停止回答，請繼續說…'`（`interruptForVoice`）、L787 `'你：' + text + '…'`（STT 暫時預覽，未復用 `brain.userPrefix`）與 L790 `'正在辨識：' + text`。這導致開發者透過 `i18nMessages` 覆寫 `speech.*` 時，STT 引擎完全不會生效。
    2. **`SpeechEngine.setLocale()` 語言標籤硬編碼與 `onLanguageChanged` 三重觸發衝突**：
       - [`core/speech/index.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/speech/index.ts#L667-L685) 在 `setLocale(locale)` 內硬編碼了 `'英文 (English)'`、`shortLabel = 'English'` 等標籤並觸發 `emitLanguageChange(locale, label, shortLabel)`，與 [`core/i18n/constants.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/i18n/constants.ts#L19-L24) 的 `LOCALE_LABELS`（`{ label: 'English (US)', shortLabel: 'EN' }`）以及 `locales/*.ts` 的 `'ui.lang.buttonText'`（`'English'`）形成三套互相衝突的標籤定義。
       - 當呼叫 `i18nEngine.setLocale()` 時，[`core/orchestrator/subscribers.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/orchestrator/subscribers.ts#L319-L364) 先執行 `rootStore.setState({ locale })`（觸發 `setupStoreSubscribers` L258 呼叫第 1 次 `speechEngine.setLocale`），接著 L324 又手動呼叫第 2 次 `speechEngine.setLocale`，最後 L357 又直接觸發第 3 次 `options.onLanguageChanged`！導致單次語系切換會連續觸發 **3 次** `onLanguageChanged`，且前兩次與第三次的 `label` / `shortLabel` 參數值完全不同。
    3. **點擊化身問候語 `greeting.*` 未接線（3 個死鍵）**：
       - `core/i18n/locales/*.ts` 定義了 `greeting.default`、`greeting.companion`、`greeting.assistant`，但 [`core/orchestrator/interaction.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/orchestrator/interaction.ts#L72-L181) 卻以 `if (/en/i.test(currentLocale))` 硬編碼四語系問候語，未接入 `i18nEngine`。
    4. **工具引擎硬編碼字串**：[`core/tools/index.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/tools/index.ts) 內部硬編碼了 16+ 處繁體中文提示字串與語音意圖正則（如 L178 參數詢問、L250/L373/L924/L929 確認與取消正則 `/^(取消|不要|算了|cancel)$/i`、L406–L411 候選序號正則 `/(?:第一|1|一)/`、L254/L386/L437/L492/L582/L610/L678/L736/L820/L878/L881/L944 狀態文字），且 [`core/tools/validator.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/tools/validator.ts#L160-L249) 內部硬編碼了 11 處繁體中文驗證錯誤訊息（如 `'必須是整數'`、`'為必填'` 等），目前完全未接入 `i18nEngine`。
  * **已收集規格**：
    1. **語音引擎移除語言標籤推導與 `onLanguageChange` 回呼**：語音引擎僅負責將 `locale` 同步給 STT (`recognition.lang`) 與 TTS (`loadVoice` / `localeVoice`)，自 `SpeechEngine` 移除硬編碼語言名稱與 `onLanguageChange` / `onLanguageChanged`；語系變更事件與按鈕標籤統一由 `I18nEngine` / `Orchestrator` 單一來源派發，並消除 `subscribers.ts` 中 `speechEngine.setLocale` 的重複呼叫。
    2. **收斂 `speech.*` 單一事實來源（SSOT）**：將 `speech.requestPermission`、`speech.interrupted`（`'已停止回答，請繼續說…'`）、`speech.recognizing`（`'正在辨識：{text}'`）補齊至 `core/i18n/locales/*.ts`，讓 `stt.ts` 與 `speech/index.ts` 直接對接 `i18nEngine`（或共用 `defaultLocales` fallback），徹底廢除重複的 `DEFAULT_STT_MESSAGES`。
    3. **接通 `greeting.*` 與抽離 `tools.*` 字典**：將 `interaction.ts` 的預設問候語改由 `i18nEngine.t('greeting.*')` 讀取，並將 `ToolsEngine` 的互動提示與驗證錯誤納入 `i18nEngine` 的 `tools.*` 命名空間。
  * **收集進度**：✅ 已於盤點 I18nEngine 時完成全量死鍵與衝突規格收集。

- [x] **耦合項 03（大腦雙軌 Store 歸位與 UI 模組氣泡字幕/6 秒定時器解耦）**：
  * **現狀**：
    1. 當初為了區分大腦「思考過程不發聲（僅顯示文字）」與「回答朗讀發聲」，在 `SpeechEngine` 內設計了 `spokenDisplayText`（搭配 6 秒計時器 `spokenDisplayTextTimer`）與 `spokenAudioText`，導致大腦為了顯示不發聲的思考文字與靜音串流，反而必須繞道寫入 `SpeechEngine`。
    2. **UI 控制提示借道語音引擎**：UI 控制項點擊回饋（[`core/ui/events.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/ui/events.ts#L132) 靜音切換、L154 語速調整、L181 語言切換、L224 清除歷史、L254–L284 大腦狀態）及 [`core/ui/history.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/ui/history.ts#L234) 複製回答成功時，皆直接賦值 `speechEngine.spokenDisplayText = ...` 來觸發 6 秒氣泡。
  * **已拍板規格（大腦雙軌分流 + UI Store 終端匯流）**：
    1. **大腦雙軌 Store 源頭分流（TODO 1 對齊）**：於 `BrainStoreState` 建立 **`displayText`**（視覺顯示軌，供 `UIEngine` 監聽，含思考提示與串流文字）與 **`spokenText`**（語音發聲軌，供 `SpeechEngine` 監聽，僅含需朗讀之完句）。
    2. **UI 引擎獨立 Store 化（TODO 5 對齊）**：UI 模組引入 `createBaseStore<UiEngineState>`，自主管理 `bubbleText`、`isBubbleVisible` 與專屬的 6 秒 `bubbleTimer`（匯流大腦 `displayText`、STT 預覽與 UI 自身 `toast()`）。
    3. **語音引擎徹底移除視覺狀態**：在正式版 `v1.0.0` 前，自 `SpeechEngine` 徹底刪除 `spokenDisplayText`、`spokenDisplayTextTimer`、`onSpokenDisplayTextChange` 與 `onSpokenDisplayTextTimeout`（不留過渡期相容代理），讓語音核心 100% 回歸純粹的 STT / TTS 音訊職能。
  * **收集進度**：✅ UI 端已率先落實 `createUiStore()`、6 秒 `bubbleTimer` 與 `uiDom.toast()`（`events.ts` 與 `history.ts` 已徹底脫離 `speechEngine.spokenDisplayText`）；大腦雙軌分流與自 `SpeechEngine` 移除 `spokenDisplayText` 待協調層收網時實作。

- [x] **耦合項 04（Interaction 與 UI 化身點擊防抖移出）**：
  * **現狀**：
    1. `core/orchestrator/interaction.ts` 中使用 `speechEngine.onTapTimer = true` 進行點擊化身手勢與發聲的防抖。
    2. 盤點 `core/ui` 時確認：[`core/ui/types.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/ui/types.ts#L78)（`UiDom.onTapTimer: boolean`）與 [`core/ui/dom.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/ui/dom.ts#L430)（`onTapTimer: false`）全專案無任何讀寫引用，為 100% 死程式碼。
  * **待收集規格**：當重構互動層與 UI 層時，將化身點擊防抖收斂至 interaction 模組自建閉包變數，從 `SpeechEngine` 徹底移除 `onTapTimer` 與 `triggerTap()`，並同步刪除 `UiDom.onTapTimer`。
  * **收集進度**：✅ 已移除 `UiDom.onTapTimer` 死屬性；`SpeechEngine.onTapTimer` 排定於協調層收網時刪除。

- [x] **耦合項 05（BrainEngine 發聲軌監聽與副作用賦值徹底消除）**：
  * **現狀**：大腦輸出時，在 `engine-factory.ts`、`pipeline-user.ts` 透過 `speechEngine.spokenAudioText = text` 賦值（內部轉為 `spokenAudioState`）來觸發發聲。
  * **已拍板規格**：與大腦 TODO 1 雙軌 Store 鏡像對齊。當大腦更新發聲軌 `spokenText`（觸發 `onSpokenTextChange(text)`）時，Orchestrator 監聽並直接執行 `speechEngine.speak(text)`，自 `SpeechEngine` 徹底移除 `spokenAudioText` 與 `spokenAudioState`。
  * **收集進度**：✅ 已與 TODO 1 & TODO 5 完成雙軌規格對齊，待協調層整合時一併收網。

- [ ] **耦合項 06（RootStore / Widget 全域開關名稱收斂）**：
  * **現狀**：全專案多處散落 `convoOn`（口語縮寫）與 `ttsMuted`（前綴不一致），包含 `ToolsEngineOptions.isConvoOn`（[`core/tools/types.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/tools/types.ts#L267) 與 [`core/orchestrator/engine-factory.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/orchestrator/engine-factory.ts#L1070)）亦直接讀取 `speechEngine.convoOn`。
  * **待收集規格**：在 Orchestrator 與 RootStore 重構時，統一將狀態屬性提升為標準的 `continuousMode` 與 `isMuted`，並隨耦合項 01 移除 `ToolsEngine` 的 `isConvoOn`。
  * **收集進度**：⏳ 待協調層整合時一併收網。

- [ ] **耦合項 07（串流管線 `drainSentences` 純函式化與實例轉發方法移除）**：
  * **現狀**：`core/orchestrator/pipeline-stream.ts` 內有 5 處（L208, L221, L247, L265, L284）透過 `speechEngine.drainSentences(...)` 調用實例上的包裝方法，且 `test/unit/orchestrator/pipeline.test.ts` 有 5 處 mock（Tier 1 採用方案 A 先行標註 `@deprecated` 保留以避免波及管線）。
  * **待收集規格**：在協調層與串流管線收網時，將 `pipeline-stream.ts` 改為直接 `import { drainSentences } from '@/core/speech'` 呼叫頂層純函式，更新 `pipeline.test.ts`，並自 `SpeechEngine` 介面與實例徹底移除 `drainSentences`。
  * **收集進度**：⏳ 待協調層整合時一併收網。

- [x] **耦合項 08（UI 與頂層 `AvatarBotOptions` 語音新舊別名全面收斂）**：
  * **現狀**：
    1. ~~[`core/ui/events.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/ui/events.ts#L151-L159) 讀寫舊名 `speechEngine.ttsRate` 與 `speechEngine.noSpeechRuns`（L90）。~~ *(已於 UI Step 3 遷移為 `playbackRate` 與 `consecutiveNoSpeechCount` ✅)*
    2. [`core/ui/events.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/ui/events.ts#L89) 以及 [`core/ui/history.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/ui/history.ts#L32) 仍使用舊口語縮寫 `convoOn`，需隨耦合項 06 對齊語音引擎標準名 `continuousMode`。
    3. [`core/ui/events.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/ui/events.ts#L123) 仍讀寫 `speechEngine.ttsMuted`，需隨耦合項 06 對齊標準名 `isMuted`。
    4. 頂層 `AvatarBotOptions`（`core/orchestrator/types.ts` L416–L431 與 `engine-factory.ts` L819–L901）仍使用舊回呼名稱（`onSpeaking`、`onSpeakingEnd`、`onMicStateChanged`、`onVoiceStatusChanged`、`onLanguageChanged`）。
  * **已拍板規格**：
    - `core/ui/dom.ts`、`core/ui/types.ts` 與 `core/ui/events.ts`（`playbackRate` / `consecutiveNoSpeechCount`）已率先完成純淨化。
    - 剩餘 `convoOn` ➔ `continuousMode`、`ttsMuted` ➔ `isMuted` 與頂層 `AvatarBotOptions` 語音回呼於協調層收網時一併完成。
  * **收集進度**：✅ 已完成 UI 內部遷移與全點位盤點。

---

## 🏗️ 三、受影響之跨引擎依賴矩陣 (Cross-Engine Dependency Matrix)

在後續模組重構與協調層接網時，請依下列「大腦雙軌分流 + UI 終端匯流」架構進行對齊：

```mermaid
flowchart TD
    subgraph Brain ["🧠 大腦引擎 (core/brain) - TODO 1"]
        B_DISPLAY["Store 軌道 1：displayText<br>(含思考提示 '讓我想想…' / 串流逐字 / 完整回答)"]
        B_SPEECH["Store 軌道 2：spokenText<br>(僅含需發聲朗讀之回答，思考時靜默)"]
    end

    subgraph Tools ["🛠️ 工具引擎 (core/tools)"]
        TL1["輸出中立回呼：onNoticeMessage(text)"]
    end

    subgraph Speech ["🔊 語音引擎 (core/speech) - TODO 4"]
        SP1["核心發聲：speak(text) / pushSpeech()"]
        SP2["口型計算：computeMouth() 0~1"]
        SP3["STT 語音辨識預覽事件"]
    end

    subgraph Skin ["🎭 外觀引擎 (core/skin)"]
        SK1["每幀調用 computeMouth() 計算嘴型 Viseme"]
        SK2["監聽 isSpeaking 驅動 talking 動作池"]
    end

    subgraph UI ["🎨 介面引擎 (core/ui) - TODO 5"]
        UI1["UiEngineStore (bubbleText + 6s 計時器)<br>匯流：大腦 displayText / STT 預覽 / UI Toast"]
        UI2["控制 continuousMode 與 isMuted 開關"]
    end

    subgraph Orchestrator ["🎛️ 協調層 (core/orchestrator) - 終點收網"]
        OC1["監聽大腦 displayText ➔ 更新 UI bubbleText"]
        OC2["監聽大腦 spokenText ➔ 轉發 speech.speak()"]
        OC3["接管工具 onNoticeMessage ➔ 分發 UI 與 Speech"]
        OC4["獨立管理化身點擊防抖 & assistantActive"]
    end

    B_DISPLAY ===>|"1. 視覺軌 (靜音亦正常跳字)"| OC1
    B_SPEECH ===>|"2. 發聲軌"| OC2
    Tools -->|onNoticeMessage| OC3
    OC1 -->|寫入 bubbleText| UI1
    OC2 -->|speak(text)| SP1
    OC3 --> UI1
    OC3 --> SP1
    SP1 -->|computeMouth() / isSpeaking| Skin
    SP3 -->|使用者語音預覽 '你：…'| UI1
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

