# 📌 TODO 1：大腦獨立拆包時的中立化回呼名稱與領域解耦規格書
*(Domain-Neutral Brain Decoupling Specification)*

> **文件狀態**：草案與動態更新中 (Living Document / RFC)  
> **建立日期**：2026-11-04  
> **對應追蹤**：`package/typescript/README_ZH.md` 🗺️ 未來架構演進待辦事項（TODO 1）  
> **關聯核心**：`package/typescript/core/brain/`、`package/typescript/core/orchestrator/`、`package/typescript/core/tools/`

---

## 🎯 一、背景與重構目標 (Background & Objective)

### 1.1 現況痛點 (Current Problem)
目前在 `package/typescript` 中，大腦引擎（`BrainEngine`）的事件回呼直接承襲了來自 `origin` 單體專案的領域名詞：
- `onSpokenAudioPlayNow`（直接使用了語音引擎的 **Spoken Audio**）
- `onSpokenDisplayTextChange` / `onSpokenAudioTextChange`（包含 **Spoken**）
- `onEmotionChange`（直接使用了皮膚/外觀引擎的 **Emotion**）
- `ToolsEngine` 內部也深度耦合了 `onSpokenAudioPlayNow`

這導致大腦引擎被硬編碼綁定在「語音朗讀」與「視覺化化身表情」的特定使用情境上。

### 1.2 終極解耦目標 (Target Architecture)
未來當大腦模組獨立拆包為純認知推論套件（如 `@ai-avatar/brain`）時：
1. **大腦成為純認知/語意推論引擎**：只負責輸入（Prompt / Context / History）與輸出（Stream Chunks、Final Answer、Sentiment/Intent Analysis），不再包含任何語音發音或 Live2D/VRM 表情模型之專有名詞。
2. **大腦 Store 雙軌輸出架構（Dual-Track Reactive Store）**：
   - 回顧歷史設計，當初為了區分「思考過程不會全部唸出來（如 `'讓我想想…'`、逐字串流）」與「真正要開口朗讀的回答」，衍生出了 `spokenDisplayText` 與 `spokenAudioText`，但卻誤放進了下游的 `SpeechEngine`，導致大腦為了顯示不發聲的文字還得借道語音引擎。
   - **重構核心**：將這兩個狀態歸還給決策源頭的 **`BrainEngine` (`BrainStoreState`)**：
     - **視覺顯示軌 (`displayText: string`)**：供 `UIEngine` 監聽。涵蓋思考提示（`'讓我想想…'`）、串流逐字生成文字、完整回答。
     - **語音朗讀軌 (`spokenText: string`)**：供 `SpeechEngine` 監聽。思考過程保持靜默不更新，僅在真正要發聲朗讀的回答或完句就緒時更新。
3. **協調層（Orchestrator）擔負領域轉接**：訂閱大腦雙軌 Store 與中立事件，分別將 `displayText` 同步至 `UIEngine`、將 `spokenText` 送入 `SpeechEngine.speak()`、將 `onSentimentChange` 映射至 `SkinEngine.setEmotion()`。
4. **正式版 (`v1.0.0`) 前徹底淨化 API**：不保留過渡期 `@deprecated` 舊別名，直接移除 `onSpokenAudioPlayNow`、`onSpokenDisplayTextChange`、`onSpokenAudioTextChange`、`onEmotionChange`，確保首發正式版參數與型別 100% 乾淨。

---

## 📋 二、核心雙軌 Store 屬性與回呼映射表 (Store & Callbacks Mapping Table)

### 2.1 大腦 Store 雙軌狀態 (`BrainStoreState` in `core/brain/internal-store.ts`)

| 過去混淆位置 (Legacy in SpeechEngine) | 大腦 Store 新屬性名 (`BrainStoreState`) | 負責監聽之下游引擎 | 語意與更新時機說明 |
| :--- | :--- | :--- | :--- |
| `speechEngine.spokenDisplayText` | **`displayText: string`** | **`UIEngine`** | **視覺顯示軌**：大腦思考中（`'讓我想想…'`）、LLM 串流逐字打字（`currentStreamText`）、最終完整回答或反問提示。與語音是否靜音完全無關。 |
| `speechEngine.spokenAudioText`<br>`speechEngine.spokenAudioState` | **`spokenText: string`** | **`SpeechEngine`** | **語音發聲軌**：思考過程中**不更新**；僅在產出需要開口朗讀的完句、知識庫回答或反問語音時更新。 |

### 2.2 大腦事件回呼中立化映射 (`BrainEngineOptions`)

| 目前名稱 (Current Coupled — 預計移除) | 正式版中立新名稱 (Domain-Neutral) | 對應 Store 軌道 | 語意與觸發時機說明 |
| :--- | :--- | :--- | :--- |
| **`onSpokenDisplayTextChange`** | **`onDisplayTextChange`** | `displayText` | 大腦思考提示或串流生成過程中，視覺顯示文字變化時觸發（供 UI 氣泡即時渲染）。 |
| **`onSpokenAudioPlayNow`**<br>**`onSpokenAudioTextChange`** | **`onSpokenTextChange`**<br>*(或 `onOutputTextReady`)* | `spokenText` | 推論產出需發聲朗讀的回答文字時觸發（供語音引擎合成發音）。 |
| **`onEmotionChange`** | **`onSentimentChange`** | — | LLM 分析使用者對話或回覆語境後輸出的情感/意圖標籤（如 `happy`、`neutral`），由外觀引擎映射至表情動作。 |

---

## 🏗️ 三、受影響之跨引擎依賴矩陣 (Cross-Engine Dependency Matrix)

在整理其他引擎的型別與參數時，請依下列雙軌反應式矩陣進行對齊：

```mermaid
flowchart TD
    subgraph Brain ["🧠 大腦引擎 (core/brain)"]
        BN_STORE["BrainStoreState (createBrainStore)<br>1. displayText (視覺顯示軌：含思考/串流)<br>2. spokenText (語音發聲軌：僅含朗讀回答)"]
        BN_EVENT["中立事件：onSentimentChange"]
    end

    subgraph Orchestrator ["🎛️ 協調層 (core/orchestrator)"]
        OC1["訂閱 brain.displayText ➔ 更新 UI 氣泡"]
        OC2["訂閱 brain.spokenText ➔ 呼叫 speech.speak()"]
        OC3["接管 tools.onNoticeMessage ➔ 分發 UI 與 Speech"]
    end

    subgraph UI ["🎨 介面引擎 (core/ui - TODO 5)"]
        UI1["UiEngineStore (bubbleText + 6s 計時器)<br>無論是否靜音皆能正常顯示思考與串流文字"]
    end

    subgraph Speech ["🔊 語音引擎 (core/speech - TODO 4)"]
        SP1["純音訊核心：speak(text) / pushSpeech()<br>徹底移除 spokenDisplayText 與 6s 計時器"]
    end

    subgraph Skin ["🎭 外觀引擎 (core/skin)"]
        SK1["接收 sentiment 字串映射至模型表情"]
    end

    subgraph Tools ["🛠️ 工具引擎 (core/tools)"]
        TL1["輸出中立回呼：onNoticeMessage"]
    end

    BN_STORE ===>|"軌道 1：displayText"| OC1
    BN_STORE ===>|"軌道 2：spokenText"| OC2
    BN_EVENT -->|onSentimentChange| Skin
    Tools -->|onNoticeMessage| OC3
    OC1 -->|寫入 bubbleText| UI1
    OC2 -->|speak()| SP1
    OC3 --> UI1
    OC3 --> SP1
```

### 3.1 大腦引擎 (`package/typescript/core/brain/`)
- **檔案**：
  - [`core/brain/internal-store.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/brain/internal-store.ts)（擴充 `BrainStoreState` 加入 `displayText: ''` 與 `spokenText: ''`）
  - [`core/brain/types.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/brain/types.ts)（`BrainStoreState`、`BrainEngineOptions`、`BrainEngine`）
  - [`core/brain/index.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/brain/index.ts)、[`core/brain/ai-provider.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/brain/ai-provider.ts)、[`core/brain/web-llm.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/brain/web-llm.ts)、[`core/brain/tool-calling.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/brain/tool-calling.ts)
- **重點**：
  - 思考階段（`'brain.thinking'`）與串流增量階段：更新 `store.setState({ displayText })` 並觸發 `onDisplayTextChange`，**不觸發** `spokenText`。
  - 發聲階段（回答完成或 `notClear` 提示）：同時更新 `displayText` 與 `spokenText`，並觸發 `onSpokenTextChange`。
  - 直接移除舊名 `onSpokenAudioPlayNow`、`onSpokenDisplayTextChange`、`onSpokenAudioTextChange`、`onEmotionChange`。

### 3.2 協調器層 (`package/typescript/core/orchestrator/`)
- **檔案**：
  - [`core/orchestrator/engine-factory.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/orchestrator/engine-factory.ts)
  - [`core/orchestrator/pipeline-stream.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/orchestrator/pipeline-stream.ts)
  - [`core/orchestrator/types.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/orchestrator/types.ts)
- **職責**：
  - 訂閱大腦的 `displayText`（或 `onDisplayTextChange`），直接寫入 `uiEngine` 的 `bubbleText`，不再繞道 `speechEngine.spokenDisplayText`！
  - 移除 [`pipeline-stream.ts#L219-L225`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/orchestrator/pipeline-stream.ts#L219-L225) 中因過去文字綁在語音引擎上而被迫寫的 `else if (speechEngine.ttsMuted === true)` 靜音特判 Hack。
  - 訂閱大腦的 `spokenText`（或 `onSpokenTextChange`），橋接至 `speechEngine.speak()`。
  - 將大腦的 `onSentimentChange` 橋接至 `skinEngine.setEmotion()`。

### 3.3 工具引擎 (`package/typescript/core/tools/`)
- **檔案**：
  - [`core/tools/types.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/tools/types.ts)（`onSpokenAudioPlayNow`、`isConvoOn`、`onUpdateChatMessage`、`ToolChatMessage`）
  - [`core/tools/index.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/tools/index.ts)
- **調整方向**：
  - 工具引擎不應要求使用者傳入「語音發音回呼」或感知語音持續對話狀態（`isConvoOn`），直接更名為中立的 `onNoticeMessage`，由協調層同時轉發給 `uiEngine`（顯示氣泡）與 `speechEngine.speak()`（若未靜音則朗讀）。
  - 對齊大腦 TODO 3 的 `onUpdateChatMessage` 簽名（收斂為 `UpdateChatMessageOptions`），並消除 `ToolChatMessage` 與大腦 `ChatLogItem` 的型別分裂。

### 3.4 語音、UI 與外觀引擎 (`core/speech/`、`core/ui/`、`core/skin/`)
- **整理其他引擎型別時的注意事項**：
  - `SpeechEngine` 的 `speak(text: string)` 簽名保持純粹，並徹底刪除 `spokenDisplayText`、`spokenAudioText`、`spokenDisplayTextTimer`、`isProcessing`、`onTapTimer`，回歸純粹的 STT / TTS 音訊控制責任。
  - `UiEngine` 透過獨立的 `UiEngineStore` 接管畫面氣泡（`bubbleText`）與 6 秒自動淡出計時器（詳見 TODO 5）。
  - `SkinEngine` 定義清晰的情緒常態字串型別，以利大腦的意圖分析做型別收斂。

---

## 🛡️ 四、大腦雙軌 Store 與純淨介面實作規範 (Clean Implementation Standard)

在 `v1.0.0` 正式版前不保留舊版過渡別名，直接實作純淨的大腦雙軌狀態與回呼：

```typescript
// 1. 大腦內部反應式狀態 (core/brain/types.ts & internal-store.ts)
export interface BrainStoreState {
  /** 是否正在執行背景對話摘要壓縮 */
  isSummarizing: boolean;
  /** 陪伴模式預設回覆輪詢索引 */
  companionFallbackIndex: number;
  /** 對話請求序號 */
  chatSeq: number;
  /** 軌道 1：視覺顯示文字（含思考提示、串流逐字打字、完整回覆），供 UIEngine 監聽 */
  displayText: string;
  /** 軌道 2：語音發聲文字（僅含需朗讀之回覆，思考時不觸發），供 SpeechEngine 監聽 */
  spokenText: string;
}

// 2. 型別宣告層 (core/brain/types.ts)
export interface BrainEngineOptions {
  /** 當視覺顯示文字（思考提示、串流增量、最終回覆）變更時觸發 */
  onDisplayTextChange?: (text: string, ...args: unknown[]) => unknown;

  /** 當推論產出需發聲朗讀之文字時觸發 */
  onSpokenTextChange?: (text: string, ...args: unknown[]) => unknown;

  /** 當語意情感/意圖標籤變更時觸發 */
  onSentimentChange?: (sentiment: string, ...args: unknown[]) => unknown;
}

// 3. 大腦推論內部更新範例 (ai-provider.ts / web-llm.ts / index.ts)
// (A) 進入思考階段：只更新 displayText（UI 顯示「讓我想想…」，語音保持安靜）
function notifyThinking(engine: BrainEngine) {
  const thinkingText = getBrainMessage(engine, 'brain.thinking');
  setBrainStoreState(engine, { displayText: thinkingText });
  engine.onDisplayTextChange?.(thinkingText);
}

// (B) 串流逐字生成階段：即時更新 displayText 供 UI 跳字（語音由串流斷句器處理）
function notifyStreamDelta(engine: BrainEngine, currentStreamText: string) {
  setBrainStoreState(engine, { displayText: currentStreamText });
  engine.onDisplayTextChange?.(currentStreamText);
}

// (C) 完整回答或語音提示就緒：同步更新 displayText 與 spokenText
function notifyFinalAnswer(engine: BrainEngine, finalText: string) {
  setBrainStoreState(engine, {
    displayText: finalText,
    spokenText: finalText
  });
  engine.onDisplayTextChange?.(finalText);
  engine.onSpokenTextChange?.(finalText);
}
```

---

## 📝 五、邊整理其他引擎時的「動態記錄區」 (Discovered Couplings Log)

> 💡 **使用說明**：當您在整理 `SpeechEngine`、`SkinEngine`、`ToolsEngine` 的型別與參數時，凡是有發現和大腦相關的隱性依賴或問題，請直接將條目追加在此區。

### 發現記錄清單：
- [x] **耦合點 01 (ToolsEngine 與大腦/語音/UI 之跨領域耦合)**：
  - **語音朗讀與持續對話狀態耦合 (`onSpokenAudioPlayNow` / `isConvoOn`)**：[`core/tools/index.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/tools/index.ts) 內共有 9 處直接呼叫 `toolsEngine.onSpokenAudioPlayNow`（L86 缺少必填參數提示、L112 取消補填參數、L140 參數驗證失敗重試提示、L193 提供多工具候選清單、L224 取消候選清單、L268 候選序號無法辨識重試提示、L375 詢問工具執行確認、L560 取消待確認工具、L636 工具執行結果朗讀），且 L556 透過 `setting.isConvoOn()`（對應 [`core/tools/types.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/tools/types.ts#L267) 與 [`core/orchestrator/engine-factory.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/orchestrator/engine-factory.ts#L1070)）判斷是否播報取消語音（而 L112 與 L224 取消時卻未檢查 `isConvoOn`，邏輯不一致），需統一收斂為領域中立的 `onNoticeMessage` 並由 Orchestrator 決定是否朗讀。
  - **對話歷史型別分裂與陣列項目直接變異 (`ToolChatMessage` vs `ChatLogItem` / `getChatLog`)**：[`core/tools/types.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/tools/types.ts#L206-L221) 獨立定義了 `ToolChatMessage`（額外包含 `choiceQuery`、`timedOut`、`cancelled`、`executed`），與大腦引擎 [`core/brain/types.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/brain/types.ts#L250-L273) 的 `ChatLogItem` 重複；且 `ToolsEngine` 透過 `getChatLog()` 取得 `brainEngine.chatLog` 陣列引用後，直接在內部變異訊息屬性（如 `chatMessage.pendingChoices = null`、`chatMessage.pendingTool = null`、`chatMessage.timedOut = true`、`chatMessage.cancelled = true`、`chatMessage.text = ...`）並直接呼叫 UI 層的 `onRenderHistory()` / `onSetHistoryOpen(true)`（甚至 [`core/ui/history.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/ui/history.ts#L3) 也反向從 `@/core/tools` 匯入 `ToolChatMessage` 來標註 `brainEngine.chatLog`）。
  - **`onUpdateChatMessage` 簽名與大腦 `UpdateChatMessageOptions` 不一致**：大腦引擎已於 TODO 3 將 `updateChatMessage(id, text, options?: UpdateChatMessageOptions)` 收斂為純選項物件，但 `ToolsEngineSetting.onUpdateChatMessage`（[`core/tools/types.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/tools/types.ts#L236) 與 [`core/tools/index.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/tools/index.ts#L622)）仍維持舊版布林位置參數 `(id: string, text: string, streaming?: boolean) => void`，由 [`engine-factory.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/orchestrator/engine-factory.ts#L996-L1017) 橋接轉為 `{ streaming: append }`。
  - **`onToolCall` 觸發時機與 Payload 型別碰撞 (`ParsedToolCall` vs `pendingToolData`)**：頂層 `AvatarBotOptions.onToolCall`（[`core/orchestrator/types.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/orchestrator/types.ts#L473)）與 `README_ZH.md` 標註接收大腦的 `ParsedToolCall`（OpenAI Function Call 結構），但實際上大腦在 [`core/brain/tool-calling.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/brain/tool-calling.ts#L146) 中若工具具備 `execute` 會直接執行而不觸發 `onToolCall`，僅在 `ToolsEngine`（[`core/tools/index.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/tools/index.ts#L395) 與 L515）遇到無 `execute` 的外部宿主工具時才觸發 `onToolCall(pendingToolData)`，實際傳入的是工具引擎內部的 `pendingToolData` 而非 `ParsedToolCall`。
  - **`prepareTool` 第四參數傳參錯位 (`existingArgs` vs `context`)**：[`core/orchestrator/pipeline-user.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/orchestrator/pipeline-user.ts#L132-L147) 在觸發本地工具路由時，將包含 `{ skinEngine, brainEngine, speechEngine, aiAvatarWidget, store, i18nEngine }` 的執行環境 `context` 傳入 `toolsEngine.prepareTool(tool, query, routeMeta, existingArgs)` 的第四參數 `existingArgs`，而 [`prepareTool`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/tools/index.ts#L53-L66) 內部卻將 `extract()` 與 `offerHostTool()` 的 `context` 硬編碼為 `{}`，導致本地路由工具在提取 `contextKey` 或執行 `tool.execute({ args, context, query })` 時遺失完整的引擎執行上下文（與大腦路由 `setupBrainEngine.executeTool` 行為不一致）。
- [x] **耦合點 02 (SpeechEngine 跨領域狀態滲透與殘留耦合)**：
  - **大腦推理狀態洩漏 (`isProcessing`)**：`SpeechEngineState` 與 `SpeechEngine` 上掛載了 `isProcessing`，在 `pipeline-user.ts` 中由大腦推理流程強制修改，並用於 STT 判斷是否為 assistant 忙碌狀態。語音引擎理應只關心音訊狀態（`isSpeaking` / `isListening`），大腦的推論生命週期（思考中）不應直接作為語音引擎的核心屬性。
  - **UI 氣泡與字幕狀態硬塞入語音引擎 (`spokenDisplayText` / `updateDisplay`)**：`SpeechEngineState` 與 `TTSSpeakOptions`（`updateDisplay`）內部維護了畫面上要顯示的字幕文字 `spokenDisplayText`，甚至在 `stt.ts` 中宣告了完全未使用的 `spokenDisplayText`，且由 `SpeechEngine` 內部跑 6000ms 氣泡倒數計時器。純粹的 TTS/STT 音訊引擎應專注於語音合成與辨識，字幕渲染應由 UI/Orchestrator 訂閱語音事件後處理，而不應由語音引擎承擔字幕顯示狀態。
  - **大腦回呼直接以語音屬性作為反應式副作用觸發器 (`spokenAudioText` / `spokenAudioState`)**：大腦推論產出文字後，在 `engine-factory.ts` 中透過 `speechEngine.spokenAudioText = text` 賦值來觸發語音播放（內部轉換為 `spokenAudioState` 觸發監聽器），此設計為 `origin` 單體架構的殘留物。中立架構下，應直接呼叫 `speechEngine.speak(text)`，廢止副作用屬性賦值。
  - **化身互動行為與防抖滲透 (`onTapTimer` / `triggerTap` / `onTapAvatar` / `preloadTapGreeting`)**：`SpeechEngine` 內部包含了化身點擊防抖標記 `onTapTimer`、點擊轉發方法 `triggerTap()`、選項回呼 `onTapAvatar`，以及將 TTS 預先快取語音命名為 `preloadTapGreeting`。點擊化身屬於 UI/皮膚層的互動概念，不應侵入語音引擎。
  - **DOM 容器物件無效綁定 (`container` / `getContainer`)**：`SpeechEngineOptions` 定義了 `getContainer`，`SpeechEngine` 定義了 `readonly container`，但在整個語音引擎及其外部使用中均未實際讀取，為早年單體架構搬移時的死程式碼。
- [x] **耦合點 03 (SkinEngine 跨領域耦合)**：
  - **面部表情 (Expression) 與肢體動作 (Gesture) 通道混雜**：大腦輸出的 `onEmotionChange`（中立化後為 `onSentimentChange`）傳入 `skinEngine.setEmotion` 時，目前皮膚引擎內部會強制執行 `gestureName = emotion`，把情緒當作動作檔名播放，造成面部表情與肢體動作混亂、容易打斷 normal idle/speaking 動作或觸發警告。大腦解耦後，Orchestrator 應將 `onSentimentChange` 純粹映射至模型的面部表情（Expression/Blendshape），僅在明確有動作映射時才觸發肢體動畫。
  - **`model` 參數名相撞與歧義**：大腦引擎使用 `model`（LLM 名稱），而皮膚引擎頂層配置使用 `modelUrl`（2D 模型網址）與 `modelTransform`（3D 空間變換），在上層 `WidgetOptions` 容易產生認知衝突與配置混淆。
- [x] **耦合點 04 (Orchestrator 推理狀態硬編碼)**：
  - 在 `pipeline-stream.ts` 與 `pipeline-user.ts` 中，當大腦開始思考時，Orchestrator 硬編碼呼叫 `skinEngine.gestureName = 'thinking'` 與 `skinEngine.setEmotion('thinking')`；而在思考結束時，原先硬編碼呼叫 `skinEngine.gestureName = 'talking'`，但皮膚引擎並無單一 `talking` 手勢（說話由 `isSpeaking` 驅動動作池），導致無此手勢的模型拋出 `GestureNotFoundError`。現已將思考結束修正為平滑回歸 `neutral`。未來大腦徹底獨立拆包時，應將思考狀態正規化至標準推論生命週期事件（如 `onReasoningStart` / `onReasoningEnd`），由協調層或使用者自訂映射動作，而非直接在核心流程綁死特定字串。
- [x] **耦合點 05 (UiEngine 與大腦引擎之強耦合與白箱存取)**：
  - **直接變異大腦對話歷史陣列長度 (`chatLog.length = 0`)**：[`core/ui/events.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/ui/events.ts#L220) 在使用者點擊清除紀錄按鈕時，直接透過 `context.brainEngine.chatLog.length = 0` 暴力清空大腦的歷史訊息陣列，破壞封裝。大腦解耦後應提供標準方法（如 `brainEngine.clearHistory()` 或 `clearChatLog()`）供協調層與 UI 調用。
  - **對話歷史型別依賴錯位 (`ToolChatMessage` vs `ChatLogItem`)**：[`core/ui/history.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/ui/history.ts#L3) 反向從 `@/core/tools` 匯入 `ToolChatMessage` 來標註大腦的 `brainEngine.chatLog`（忽視了大腦本身的 `ChatLogItem` 型別定義）。中立架構下，對話歷史基礎型別應由 Brain 或頂層 Types 統一規範，工具附加屬性應以 Extension 型別疊加，避免 UI 成為工具與大腦型別混雜的受害者。
  - **UI 控制按鈕對 WebLLM / AiProvider 內部白箱穿透存取**：[`core/ui/events.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/ui/events.ts#L236-L295) 的 `llmButtonEl.onclick` 直接刺探大腦內部私有層級：`brainEngine.aiProvider?.enabled`、`ready`、`ping()`、`model`、以及 `brainEngine.llm.supported`、`state`、`progress`、`load()`。大腦引擎獨立拆包時，應於對外實例層提供中立的大腦狀態查詢與載入門面方法（如 `brainEngine.getProviderStatus()` 或 `brainEngine.loadLocalBrain()`），而非由 UI 模組深入存取各供應商之私有狀態。
  - **UI 硬編碼未國際化之大腦提示字串**：`events.ts` L256–L286 包含 5 處寫死之繁體中文大腦狀態提示（如 `'AI 伺服器大腦運作中'`、`'這個裝置不支援 WebGPU'` 等），完全繞過 `i18nEngine`。

---

## 🚀 六、最終驗收清單 (Final Acceptance Checklist)

當其他引擎皆整理完畢，準備最後收斂執行此 TODO 時，逐一勾選：

- [ ] `core/brain/internal-store.ts` 與 `core/brain/types.ts` 擴充雙軌 Store 屬性：`displayText`（供 `UIEngine` 監聽）與 `spokenText`（供 `SpeechEngine` 監聽）。
- [ ] `core/brain/types.ts` 將事件回呼全面收斂為中立名稱（`onDisplayTextChange`、`onSpokenTextChange`、`onSentimentChange`），直接移除舊版 `onSpoken*` 與 `onEmotionChange`。
- [ ] `core/brain/index.ts`、`ai-provider.ts`、`web-llm.ts`、`tool-calling.ts` 完成思考階段（僅更新 `displayText`）與發聲階段（更新雙軌）之分流。
- [ ] `core/tools/` 將 `onSpokenAudioPlayNow` 重構為中立名稱 `onNoticeMessage`。
- [ ] `core/orchestrator/engine-factory.ts` 與 `pipeline-stream.ts` 完成雙軌訂閱綁定（`UIEngine` 監聽 `displayText`、`SpeechEngine` 監聽 `spokenText`），並移除 `pipeline-stream.ts` 中的靜音特判 Hack。
- [ ] 單元測試全數更新並驗證雙軌分流（思考時不發聲、靜音時氣泡仍正常串流跳字）。
- [ ] 範例專案與 `README_ZH.md` 狀態更新為 `✅ TODO 1 (Implemented)`。

