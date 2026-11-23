# 📌 TODO 5：UI 介面引擎獨立反應式狀態庫與跨領域解耦規格書
*(UI Engine Reactive Store Decoupling & Modern State Architecture RFC)*

> **文件狀態**：規格拍板與動態更新中 (Living Document / RFC)  
> **建立日期**：2026-11-12  
> **對應追蹤**：[`package/typescript/README_ZH.md`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/README_ZH.md) 🗺️ 未來架構演進待辦事項（TODO 5）  
> **關聯核心**：[`package/typescript/core/ui/`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/ui/)、[`package/typescript/core/orchestrator/`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/orchestrator/)、[`package/typescript/core/speech/`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/speech/)、[`package/typescript/core/brain/`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/brain/)  
> **關聯前期**：[`docs/TODO-1-DOMAIN-NEUTRAL-BRAIN-DECOUPLING.md`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/docs/TODO-1-DOMAIN-NEUTRAL-BRAIN-DECOUPLING.md)、[`docs/TODO-4-SPEECH-ENGINE-CLEAN-DECOUPLING.md`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/docs/TODO-4-SPEECH-ENGINE-CLEAN-DECOUPLING.md)

---

## 🎯 一、背景與重構目標 (Background & Objective)

### 1.1 現況痛點 (Current Problems)

目前在 `package/typescript` 專案中，五大核心引擎的狀態架構出現了顯著的「非對稱性」：
- **大腦引擎 (`core/brain`)**：具備 `createBaseStore<BrainStoreState>`
- **語音引擎 (`core/speech`)**：具備 `createBaseStore<InternalSpeechStoreState>`
- **外觀引擎 (`core/skin`)**：具備 `createBaseStore<InternalSkinStoreState>`
- **多國語言 (`core/i18n`)**：具備 `createBaseStore<I18nEngineState>`
- **協調層 (`core/orchestrator`)**：具備 `createBaseStore<AvatarBotStoreState>`（`rootStore`）
- **介面引擎 (`core/ui`)**：❌ **全專案唯一缺乏獨立 Store 的引擎！**

這導致了以下三大嚴重問題：
1. **區域閉包與命令式 DOM 操作混雜**：[`core/ui/dom.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/ui/dom.ts#L22-L26) 內依賴 `let currentListening = false;` 等閉包變數，外部原本需傳入多達 5 個位置參數呼叫 `updateVoiceStatus`、`updateMicState`、`updateBubble`，出現大量「布林盲區」（Boolean Blindness）與可讀性極差的 `(undefined, undefined, false)` 傳參。
2. **大腦「思考不發聲」狀態誤放至語音引擎，造成跨領域繞道與寄生**：
   - 當初為了讓大腦在「思考過程（如 `'讓我想想…'`）」與「串流逐字打字」時只顯示文字而不唸出聲音，衍生了 `spokenDisplayText`（不發聲顯示）與 `spokenAudioText`（發聲朗讀）雙軌概念，但卻誤將兩者都放在下游的 `SpeechEngine` 內。
   - 結果導致大腦為了顯示不發聲的文字，還得繞道寫入 `speechEngine.spokenDisplayText`；同時 UI 各控制按鈕（靜音、語速、語言、清除歷史、AI 大腦狀態、複製回答）也因為 UI 缺乏自己的 Store，全數直接賦值 `speechEngine.spokenDisplayText = ...` 來借用其 6 秒計時器！
   - 更嚴重的是，在 [`pipeline-stream.ts#L219-L225`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/orchestrator/pipeline-stream.ts#L219-L225) 中，當使用者開啟靜音（`ttsMuted === true`）時，還得特別寫一段 `else if` 特判去塞 `spokenDisplayText`，否則畫面氣泡就會跟著停止更新。
3. **無法支援 Headless UI**：外部開發者若想使用 Vue 3、React 或自訂 UI 元件替換預設 DOM，無法單純透過訂閱 UI 狀態來驅動自訂組件。

### 1.2 終極解耦目標：「源頭大腦雙軌分流、終端 UI Store 匯流」 (Target Architecture)

1. **五大引擎架構 100% 對稱**：比照其他引擎，引入 `createBaseStore<UiEngineState>`，建立純資料驅動（Data-Driven）的響應式 UI 引擎。
2. **大腦雙軌 Store 源頭分流（與 TODO 1 對齊）**：
   - 將「哪些字只顯示、哪些字要唸出來」的決策權歸還給源頭的 **`BrainEngine` (`BrainStoreState`)**：
     - **視覺顯示軌 (`displayText: string`)**：由 **`UIEngine`** 監聽。涵蓋思考提示（`'讓我想想…'`）、串流逐字生成文字、完整回答。即使語音靜音或未載入 `SpeechEngine`，氣泡依然 100% 正常運作。
     - **語音發聲軌 (`spokenText: string`)**：由 **`SpeechEngine`** 監聽。思考過程中保持靜默，僅在真正需要開口朗讀的完句就緒時觸發 TTS。
3. **終端 UI Store 匯流與自建計時器（與 TODO 4 對齊）**：
   - `UiEngineStore` 統一匯流畫面氣泡的三大來源：**(1) 大腦視覺軌 `displayText`**、**(2) 語音 STT 使用者說話預覽 (`'你：…'`)**、**(3) UI 自身系統提示 (`uiEngine.toast()`)**。
   - 6 秒氣泡自動淡出計時器（`bubbleTimer`）由 `UiEngine` 內部自主維護；在正式版 `v1.0.0` 前自 `SpeechEngine` 徹底刪除 `spokenDisplayText` 與 `spokenDisplayTextTimer`（不留舊版相容代理）。
4. **全面收斂為純淨 Options 物件簽名**：消除多位置布林參數，直接採用乾淨的具名選項物件（不留舊版多參數多載）。
5. **解鎖 Headless UI 能力**：外部組件可直接 `uiEngine.subscribe(...)`，為 React / Vue 自訂介面奠定標準基礎。

---

## 🏗️ 二、新舊架構對比 (Architecture Comparison)

```mermaid
flowchart TD
    subgraph OldArchitecture ["❌ 舊架構：大腦與 UI 繞道寄生語音引擎"]
        direction TB
        B_OLD["BrainEngine (思考 '讓我想想…' / 串流)"] -->|繞道呼叫| SP_OLD["speechEngine.spokenDisplayText"]
        EV_OLD["UI 按鈕 (靜音/語速/語言/歷史/複製)"] -->|賦值寄生| SP_OLD
        SP_OLD -->|語音引擎跑 6s 定時器| UB_OLD["uiDom.bubbleEl 氣泡"]
    end

    subgraph NewArchitecture ["✅ 新架構：源頭大腦雙軌分流 + 終端 UI Store 匯流"]
        direction TB
        subgraph BrainStore ["🧠 BrainStoreState (決策源頭)"]
            B_DISP["軌道 1：displayText<br>(含思考提示 / 串流逐字 / 完整回答)"]
            B_SPOK["軌道 2：spokenText<br>(僅含需發聲朗讀之回答，思考時靜默)"]
        end

        subgraph Speech ["🔊 SpeechEngine (純音訊)"]
            TTS_NEW["speak(text) / pushSpeech()<br>無視覺狀態、無 6s 計時器"]
            STT_NEW["STT 語音辨識預覽 ('你：…')"]
        end

        subgraph UiStore ["🎨 UiEngineStore (createBaseStore<UiEngineState>)"]
            UI_STATE["• bubbleText + 自主 6s bubbleTimer<br>• isBubbleVisible / isThinking<br>• isHistoryOpen / isMinimal<br>• voiceLive / mic"]
        end

        B_DISP ===>|"1. 訂閱視覺軌 (靜音亦正常跳字)"| UI_STATE
        B_SPOK ===>|"2. 訂閱發聲軌"| TTS_NEW
        STT_NEW -->|使用者說話預覽| UI_STATE
        EV_NEW["UI 按鈕回饋 / 系統提示"] -->|uiEngine.toast()| UI_STATE

        UI_STATE -->|自動訂閱反應式更新| DOM2["原生 UiDom (bubbleEl / mic / voiceLive)"]
        UI_STATE -.->|外部自訂訂閱 (可選)| HEADLESS["Vue 3 / React 自訂 Headless 組件"]
    end
```

---

## 📋 三、目標狀態與介面規格 (Target Specification)

### 3.1 UI 引擎反應式狀態介面 (`UiEngineState`)

```typescript
import type { AvatarMode } from '@/core/types';
import type { BaseStore } from '@/core/store';

/**
 * 即時語音狀態列響應式資料模型
 */
export interface UiVoiceLiveState {
  /** 即時語音對話是否連線啟用 */
  active: boolean;
  /** 狀態文字（如「即時語音待命」、「正在聆聽…」） */
  text: string;
  /** CSS 狀態標籤（如 'listening' | 'speaking'） */
  state?: string;
  /** 音量指示條數值 (0 ~ 100) */
  level: number;
}

/**
 * 麥克風按鈕響應式資料模型
 */
export interface UiMicState {
  /** 是否正在麥克風監聽輸入中 */
  isListening: boolean;
  /** 是否處於即時持續對話模式 (標準命名) */
  continuousMode: boolean;
}

/**
 * UI 介面引擎內部完整反應式狀態模型
 */
export interface UiEngineState {
  /** 當前顯示於對話氣泡之文字 (匯流大腦 displayText、STT 預覽與 UI Toast) */
  bubbleText: string;
  /** 對話氣泡是否處於顯示狀態 */
  isBubbleVisible: boolean;
  /** 是否處於 AI 深度思考動畫中 */
  isThinking: boolean;
  /** 聊天歷史面板是否展開抽屜 */
  isHistoryOpen: boolean;
  /** 助理是否處於最小化圓形浮球狀態 */
  isMinimal: boolean;
  /** 當前虛擬人人格模式 ('companion' | 'assistant') */
  avatarMode: AvatarMode;
  /** 即時語音對話連線狀態 */
  voiceLive: UiVoiceLiveState;
  /** 麥克風互動按鈕狀態 */
  mic: UiMicState;
}
```

---

### 3.2 控制器純淨 Options 物件簽名（已移除舊版多位置參數）

為確保 `v1.0.0` 正式版 API 純淨，消除位置參數的「布林盲區」，UI 控制方法直接收斂為單一 Options 物件（不保留舊版多參數多載或 `@deprecated` 欄位）：

```typescript
// 1. VoiceStatus Options
export interface VoiceStatusOptions {
  /** 是否啟用即時持續對話模式 (標準命名) */
  continuousMode?: boolean;
  /** 狀態標籤文字 */
  text?: string;
  /** 狀態識別碼 (如 'listening', 'speaking') */
  state?: string;
  /** 音量等級 (0 ~ 100) */
  level?: number;
  /** 多國語言引擎實例 */
  i18n?: I18nEngine | null;
}

// 2. MicState Options
export interface MicStateOptions {
  /** 麥克風監聽中狀態 */
  isListening?: boolean;
  /** 持續對話模式 (標準命名) */
  continuousMode?: boolean;
  /** 角色模式 ('assistant' | 'companion') */
  avatarMode?: AvatarMode;
  /** 多國語言引擎實例 */
  i18n?: I18nEngine | null;
}

// 3. UpdateBubble Options
export interface UpdateBubbleOptions {
  /** 是否展示氣泡 */
  show?: boolean;
  /** 是否顯示思考中動畫 */
  isThinking?: boolean;
  /** 自訂淡出逾時毫秒數 (預設 6000ms，設為 0 不自動關閉) */
  autoDismissMs?: number;
}
```

---

### 3.3 目標純淨 UI 引擎介面 (`UiEngine`)

```typescript
export interface UiEngine extends SubscribableStore<UiEngineState> {
  /** 存取原生 DOM 元素結構 (供預設 DOM 渲染模式使用) */
  readonly dom: UiDom;
  
  /** 當前氣泡文字 (可直接賦值觸發資料驅動更新) */
  bubbleText: string;
  /** 氣泡顯隱狀態 */
  isBubbleVisible: boolean;
  /** 思考動畫狀態 */
  isThinking: boolean;
  /** 歷史面板展開狀態 */
  isHistoryOpen: boolean;
  /** 最小化模式 */
  isMinimal: boolean;

  /**
   * 觸發視覺 Toast 氣泡提示 (純資料驅動更新 bubbleText 並啟動 UI 定時器)
   */
  toast(message: string, durationMs?: number): void;

  /**
   * 更新語音狀態 (純淨 Options 物件)
   */
  updateVoiceStatus(options?: VoiceStatusOptions): void;

  /**
   * 更新麥克風狀態 (純淨 Options 物件)
   */
  updateMicState(options?: MicStateOptions): void;

  /**
   * 更新對話氣泡 (文字與 Options 分離)
   */
  updateBubble(text?: string, options?: UpdateBubbleOptions): void;
}
```

---

## ⚡ 四、跨模組名稱相撞防護 (Collision Protection)

在本次重構與跨模組串接中，嚴格執行以下命名規範：

1. **`btn-engine` / `engineButtonEl` 歧義消除**：
   - 舊名稱 `engineButtonEl` 與大腦引擎（`llmButtonEl`）及本專案之複數引擎架構相撞。
   - 統一重命名為標準名稱 **`skinModeButtonEl`**（DOM ID 仍維持 `#btn-engine` 確保外部樣式相容）。
2. **全模組語音開關收斂至 `continuousMode`**：
   - 全面替換 UI 內部讀寫的 `convoOn`（`events.ts`、`history.ts`、`dom.ts`）。
3. **全模組靜音狀態收斂至 `isMuted`**：
   - 全面替換 UI 內部讀寫的 `ttsMuted`。
4. **全模組播放倍率收斂至 `playbackRate`**：
   - 全面替換 UI 內部讀寫的 `ttsRate`。
5. **全模組無語音計數收斂至 `consecutiveNoSpeechCount`**：
   - 全面替換 UI 內部讀寫的 `noSpeechRuns`。
6. **大腦思考狀態語意分工**：
   - 大腦引擎生命週期：`onReasoningStart` / `onReasoningChunk` / `onReasoningEnd`（資料面）。
   - UI 介面表現層狀態：維持 **`isThinking`**（視覺面氣泡與動態動畫），由協調層負責事件銜接。

---

## 🚀 五、分階段落地重構計畫 (Implementation Plan)

### 階段一：清理死屬性與統一純淨 Options 介面 (Tier 1 - 已完成 ✅)
- [x] 移除 `UiDom.onTapTimer` 100% 死屬性。
- [x] 移除 `UiContext` 上的 `AVATAR_MODE_MAP`、`ENGINE_MODE_MAP`、`STATE_MAP` 靜態字典冗餘，改自 `@/core/constants` 引用，並消除 `dom.ts` 與 `events.ts` 內的 `AvatarMode` 寫死字串（Magic Strings）。
- [x] 為 `updateVoiceStatus`、`updateMicState`、`updateBubble`、`initSkinModeChangeButton` 實作乾淨 Options 物件介面（依指示於 v1.0.0 前直接移除多參數位置舊簽名，不留舊多載）。
- [x] 將 `engineButtonEl` 重新命名為語意中立的 `skinModeButtonEl`，並將 `SkinModeToggleOptions.isEngineToggleEnabled` 正名為 `isSkinModeToggleEnabled`。
- [x] 全專案 42 套測試檔、Typecheck、Lint、Build 全數綠燈通過。

### 階段二：建立 `UiEngineStore` 與大腦雙軌 Store 銜接 (Tier 2 - UI 內部已完成 ✅ / 待大腦與語音雙軌收網 📋)
- [x] 在 `core/ui/store.ts` 以 `createBaseStore<UiEngineState>` 宣告 UI 狀態庫（管理 `bubbleText`、`isBubbleVisible`、`isThinking`、`isHistoryOpen`、`isMinimal`、`voiceLive`、`mic`），並於 `core/ui/dom.ts` 內部自建 6 秒 `bubbleTimer`（常數 `DEFAULT_BUBBLE_DISMISS_MS` 集中於 `core/constants.ts`，維持純函式工廠 + 閉包物件風格）。
- [x] 將 `events.ts`（7 處）與 `history.ts`（1 處）對 `speechEngine.spokenDisplayText` 的賦值，全面改為直接呼叫 `uiDom.toast(message)`。
- [x] 將 `events.ts` 內的 `ttsRate`、`noSpeechRuns` 遷移為語音引擎已支援的標準命名（`playbackRate`、`consecutiveNoSpeechCount`）。
- [x] 補齊 `@ai-avatar-bot/sdk/ui` 獨立子路徑匯出、`CustomEnginesConfig.ui` 整顆引擎取代支援，並讓 `initUi(container)` 支援可選自動建立 `#stage`。
- [ ] 配合 TODO 1，在大腦 `BrainStoreState`（[`core/brain/internal-store.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/brain/internal-store.ts)）擴充雙軌屬性：
  - **`displayText`**（視覺顯示軌，含思考提示 `'讓我想想…'` 與串流逐字打字）➔ 由 `UIEngine` 監聽並更新 `bubbleText`。
  - **`spokenText`**（語音發聲軌，僅含需朗讀之完句，思考時不觸發）➔ 由 `SpeechEngine` 監聽並觸發 `speak()`。
- [ ] 自 `speech/index.ts`、`speech/types.ts` 與 `orchestrator`（`engine-factory.ts`、`pipeline-stream.ts`、`pipeline-user.ts`）徹底移除 `spokenDisplayText`、`spokenAudioText` 與 `spokenDisplayTextTimer`（正式版前不留舊相容代理），並移除 `pipeline-stream.ts` 的 `ttsMuted` 靜音特判 Hack。
- [ ] 配合 TODO 4 耦合項 06，將 `events.ts` 與 `history.ts` 內的 `ttsMuted`、`convoOn` 遷移為標準語音命名（`isMuted`、`continuousMode`）。
- [ ] 配合 I18nEngine 整理，補齊 `events.ts` L256–L286 內部 5 處未國際化的大腦提示字串。

### 階段三：大腦封裝保護與歷史型別收斂 (Tier 3 - 待與 TODO 1 & ToolsEngine 收網時執行 📋)
- [ ] 配合 TODO 1 耦合點 05，移除 `events.ts` L220 對 `brainEngine.chatLog.length = 0` 的直接截斷，改呼叫大腦公開方法 `clearHistory()`。
- [ ] 配合 TODO 1 耦合點 05，將 `events.ts` L236–L295（`llmButtonEl.onclick`）對 `brainEngine.aiProvider` 與 `brainEngine.llm` 的私有狀態白箱穿透存取，收斂為大腦公開狀態查詢與載入門面方法。
- [ ] 配合 ToolsEngine 整理，將 `history.ts` 對 `ToolChatMessage` 的依賴改回大腦基礎 `ChatLogItem` 型別。
- [ ] 擴充跨引擎單元測試，驗證大腦雙軌分流、UI Store 監聽與全引擎解耦 100% 通過。

