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
1. **區域閉包與命令式 DOM 操作混雜**：[`core/ui/dom.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/ui/dom.ts#L22-L26) 內依賴 `let currentListening = false;` 等閉包變數，外部需傳入多達 5 個位置參數呼叫 `updateVoiceStatus`、`updateMicState`、`updateBubble`，出現大量「布林盲區」（Boolean Blindness）與可讀性極差的 `(undefined, undefined, false)` 傳參。
2. **「Toast 寄生反模式」反向破壞領域邊界**：UI 各控制按鈕（靜音、語速、語言、清除歷史、AI 伺服器狀態、WebLLM 狀態）及複製回答回饋，因 UI 沒有自己的狀態庫，全數直接對 `speechEngine.spokenDisplayText = ...` 賦值，把語音音訊核心當作表現層的通知管線與 6 秒計時器控制器！
3. **無法支援 Headless UI**：外部開發者若想使用 Vue 3、React 或自訂 UI 元件替換預設 DOM，無法單純透過訂閱 UI 狀態來驅動自訂組件。

### 1.2 終極解耦目標 (Target Architecture)

1. **五大引擎架構 100% 對稱**：比照其他引擎，引入 `createBaseStore<UiEngineState>`，建立純資料驅動（Data-Driven）的響應式 UI 引擎。
2. **收斂表現層狀態**：將氣泡文字（`bubbleText`）、氣泡顯隱（`isBubbleVisible`）、思考中動畫（`isThinking`）、歷史面板開關（`isHistoryOpen`）、即時語音待命（`voiceLive`）、麥克風按鈕狀態（`mic`）全部收斂在 `UiEngine` 內部。
3. **徹底切除對語音引擎的 Toast 寄生**：氣泡淡出計時器由 UI 模組自建，`SpeechEngine.spokenDisplayText` 僅保留為相容轉發代理，音訊核心回歸純粹的 STT / TTS。
4. **全面收斂為純 Options 物件簽名**：消除 5 個位置參數，提供型別安全的選項物件，並保留重載以達成零破壞性向後相容。
5. **解鎖 Headless UI 能力**：外部組件可直接 `uiEngine.subscribe(...)`，為 React / Vue 自訂介面奠定標準基礎。

---

## 🏗️ 二、新舊架構對比 (Architecture Comparison)

```mermaid
flowchart TD
    subgraph OldArchitecture ["舊架構：無 Store 且寄生語音"]
        direction TB
        EV1["UI 按鈕 (靜音/語速/語言/歷史/LLM)"] -->|賦值寄生| SP1["speechEngine.spokenDisplayText"]
        SP1 -->|語音引擎跑 6s 定時器| UB1["uiDom.bubbleEl 氣泡"]
        OC1["orchestrator"] -->|5 個位置參數| UV1["uiDom.updateVoiceStatus(convoOn, text, state, level, i18n)"]
        OC1 -->|4 個位置參數| UM1["uiDom.updateMicState(isListening, convoOn, isCompanion, i18n)"]
    end

    subgraph NewArchitecture ["新架構：純資料驅動與對稱 UI Store"]
        direction TB
        UI_STORE["UiEngineStore (createBaseStore<UiEngineState>)<br>• bubbleText<br>• isThinking<br>• isHistoryOpen<br>• voiceLive<br>• mic"]
        
        EV2["UI 按鈕回饋"] -->|修改 UI 狀態| UI_STORE
        SP2["speechEngine 說話中"] -->|發送音訊事件 onSpeakStart| OC2["協調層 Orchestrator"]
        OC2 -->|資料驅動更新| UI_STORE
        
        UI_STORE -->|自動訂閱反應式更新| DOM2["原生 UiDom (bubbleEl / mic / voiceLive)"]
        UI_STORE -.->|外部自訂訂閱 (可選)| HEADLESS["Vue 3 / React 自訂 Headless 組件"]
        
        SP_LEGACY["speechEngine.spokenDisplayText<br>(相容 Getter/Setter 代理)"] -.->|轉發寫入| UI_STORE
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
  /** 當前顯示於對話氣泡之文字 (含 TTS 字幕與視覺 Toast) */
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

### 3.2 控制器純 Options 物件簽名收斂

為了消除位置參數的「布林盲區」，UI 控制方法全面收斂為 Options 物件，並以函式多載（Overload）保持舊版多參數 100% 向後相容：

```typescript
// 1. VoiceStatus Options
export interface VoiceStatusOptions {
  /** 是否啟用即時持續對話模式 (標準命名) */
  continuousMode?: boolean;
  /** @deprecated 請改用 continuousMode。舊版口語縮寫 */
  convoOn?: boolean;
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
  /** @deprecated 請改用 continuousMode */
  convoOn?: boolean;
  /** 角色模式 ('assistant' | 'companion') */
  avatarMode?: AvatarMode;
  /** @deprecated 請改用 avatarMode === 'companion' */
  isCompanion?: boolean;
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
- [x] 移除 `UiContext` 上的 `AVATAR_MODE_MAP`、`ENGINE_MODE_MAP`、`STATE_MAP` 靜態字典冗餘，改自 `@/core/constants` 引用。
- [x] 為 `updateVoiceStatus`、`updateMicState`、`updateBubble`、`initSkinModeChangeButton` 實作乾淨 Options 物件介面（依指示於 v1.0.0 前直接移除多參數位置舊簽名，不留舊多載）。
- [x] 將 `engineButtonEl` 重新命名為語意中立的 `skinModeButtonEl`。
- [x] 全專案 42 套測試檔（707 項單元測試）、Typecheck、Lint、Build 全數綠燈通過。

### 階段二：建立 `UiEngineStore` 與切除語音寄生 (Tier 2 - 進行中 🚧)
- [ ] 在 `core/ui/` 建立 `store.ts`，以 `createBaseStore<UiEngineState>` 宣告 UI 狀態庫。
- [ ] 在 UI 模組內部自建 `bubbleTimer`，接管氣泡定時關閉邏輯，脫離對語音引擎的依賴。
- [ ] 將 `events.ts` 與 `history.ts` 內 7 處對 `speechEngine.spokenDisplayText` 的賦值，改為呼叫 `uiEngine.toast(message)` 或 `uiStore.setState({ bubbleText })`。
- [ ] 在 `speech/index.ts` 中將 `spokenDisplayText` 的 setter 改為純代理轉發至 UI 狀態，徹底移除內部的 `spokenDisplayTextTimer`。
- [ ] 將 `events.ts` 內的 `ttsMuted`、`ttsRate`、`noSpeechRuns`、`convoOn` 遷移為標準語音命名。
- [ ] 補齊 `events.ts` L256–L286 內部 5 處未國際化的大腦提示字串。

### 階段三：大腦封裝保護與歷史型別收斂 (Tier 3 - 待執行 📋)
- [ ] 移除 `events.ts` L220 對 `brainEngine.chatLog.length = 0` 的暴力截斷，改呼叫大腦公開方法 `clearHistory()`。
- [ ] 將 `history.ts` 對 `ToolChatMessage` 的依賴改回大腦基礎 `ChatLogItem` 型別。
- [ ] 擴充單元測試（`test/unit/ui/*.test.ts`），驗證 UI Store 監聽與全引擎解耦 100% 通過。

