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
2. **協調層（Orchestrator）擔負領域轉接**：將大腦輸出的「中立語意結果」分發給下游客戶端（語音引擎朗讀、外觀引擎換表情、UI 氣泡更新）。
3. **無痛相容性保證（Zero-Breaking-Change）**：透過雙向別名轉接（Aliasing），既有的完整整合包呼叫者與舊版回呼仍能無縫運行。

---

## 📋 二、核心回呼名詞新舊映射表 (Event Callbacks Mapping Table)

| 目前名稱 (Current Coupled) | 建議中立新名稱 (Domain-Neutral) | 備選名稱 (Candidates) | 語意與觸發時機說明 |
| :--- | :--- | :--- | :--- |
| **`onSpokenAudioPlayNow`** | **`onOutputTextReady`** | `onFinalAnswer`<br>`onTextReady` | 推論產出完整語意回答（或句子切片斷句），準備交付下游客戶端消費（如送入語音合成或渲染氣泡）。 |
| **`onSpokenDisplayTextChange`** | **`onStreamTextChange`** | `onStreamProgress`<br>`onLiveTextChange` | 串流生成過程中文字累計變化（原用於語音顯示文字的實時同步）。 |
| **`onSpokenAudioTextChange`** | **`onNormalizedTextChange`** | `onAudioTextChange`<br>`onPreparedTextChange` | 經文字正規化、標點修正或代碼塊清洗後，適合作為輸出消費的純文字。 |
| **`onEmotionChange`** | **`onSentimentChange`** | `onIntentChange`<br>`onMoodChange` | LLM 分析使用者對話或回覆語境後輸出的情感/意圖標籤（如 `happy`、`neutral`），由外觀引擎決定如何映射至表情動作。 |

---

## 🏗️ 三、受影響之跨引擎依賴矩陣 (Cross-Engine Dependency Matrix)

在整理其他引擎的型別與參數時，請依下列矩陣進行檢查與更新：

```mermaid
flowchart TD
    subgraph Brain ["大腦引擎 (core/brain)"]
        BN1["宣告中立名稱與 @deprecated 舊別名"]
        BN2["ai-provider 觸發中立回呼"]
    end

    subgraph Orchestrator ["協調層 (core/orchestrator)"]
        OC1["engine-factory.ts 事件轉接橋樑"]
        OC2["WidgetOptions 雙向對齊"]
    end

    subgraph Speech ["語音引擎 (core/speech)"]
        SP1["接收 text 進行 speak()"]
        SP2[" spokenDisplayText 狀態解耦"]
    end

    subgraph Skin ["外觀引擎 (core/skin)"]
        SK1["接收 sentiment 字串映射至具體模型表情/動作"]
    end

    subgraph Tools ["工具引擎 (core/tools)"]
        TL1["將 toolsEngine.onSpokenAudioPlayNow<br>改為中立的 onNoticeMessage 或 onPromptOutput"]
    end

    Brain -->|onOutputTextReady| Orchestrator
    Brain -->|onSentimentChange| Orchestrator
    Tools -->|onNoticeMessage| Orchestrator
    Orchestrator -->|speak()| Speech
    Orchestrator -->|setEmotion()| Skin
```

### 3.1 大腦引擎 (`package/typescript/core/brain/`)
- **檔案**：
  - [`core/brain/types.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/brain/types.ts)（`BrainEngineOptions`、`BrainEngine`）
  - [`core/brain/index.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/brain/index.ts)（實例化與預設回呼）
  - [`core/brain/ai-provider.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/brain/ai-provider.ts)（推論生成與觸發點）
- **重點**：實作雙向別名解析，優先呼叫新名稱，若未提供則 fallback 至舊名稱。

### 3.2 協調器層 (`package/typescript/core/orchestrator/`)
- **檔案**：
  - [`core/orchestrator/engine-factory.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/orchestrator/engine-factory.ts)（約 L634 - L668、L1027 - L1043）
  - [`core/orchestrator/types.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/orchestrator/types.ts)
- **職責**：
  - 將大腦的 `onOutputTextReady` 橋接至 `speechEngine.speak()`。
  - 將大腦的 `onSentimentChange` 橋接至 `skinEngine.setEmotion()`。

### 3.3 工具引擎 (`package/typescript/core/tools/`)
- **檔案**：
  - [`core/tools/types.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/tools/types.ts)（`onSpokenAudioPlayNow`）
  - [`core/tools/index.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/tools/index.ts)（共 9 處直接調用 `onSpokenAudioPlayNow`）
- **調整方向**：工具引擎不應要求使用者傳入「語音發音回呼」，而應更名為中立的 `onNoticeMessage` 或 `onPromptOutput`。

### 3.4 語音與外觀引擎 (`core/speech/`、`core/skin/`)
- **整理其他引擎型別時的注意事項**：
  - `SpeechEngine` 的 `speak(text: string)` 簽名保持純粹，不需依賴大腦的任何型別。
  - `SkinEngine` 應定義清晰的情緒常態字串型別（如 `SentimentType = 'happy' | 'sad' | 'angry' | ...`），以利大腦的意圖分析做型別收斂。

---

## 🛡️ 四、雙向相容轉接實作規範 (Aliasing Implementation Standard)

為了確保發布 npm 後的 100% 向後相容，大腦引擎在實作中立化時需遵循以下模式：

```typescript
// 1. 型別宣告層 (types.ts)
export interface BrainEngineOptions {
  /** 領域中立標準回呼：當推論文字就緒準備輸出時觸發 */
  onOutputTextReady?: (text: string, ...args: unknown[]) => unknown;
  /** @deprecated 請改用 onOutputTextReady。舊版語音強綁定回呼名稱 */
  onSpokenAudioPlayNow?: (text: string, ...args: unknown[]) => unknown;

  /** 領域中立標準回呼：語意情感/意圖變更通知 */
  onSentimentChange?: (sentiment: string, ...args: unknown[]) => unknown;
  /** @deprecated 請改用 onSentimentChange。舊版外觀強綁定回呼名稱 */
  onEmotionChange?: (emotion: string, ...args: unknown[]) => unknown;

  /** 領域中立標準回呼：串流輸出增量文字變更 */
  onStreamTextChange?: (text: string, ...args: unknown[]) => unknown;
  /** @deprecated 請改用 onStreamTextChange。舊版回呼名稱 */
  onSpokenDisplayTextChange?: (text: string, ...args: unknown[]) => unknown;
}

// 2. 實例內部別名轉接層 (index.ts / ai-provider.ts)
function dispatchOutputTextReady(engine: BrainEngine, text: string) {
  // 優先觸發新標準回呼，若外部未傳入則呼叫舊別名
  if (typeof engine.onOutputTextReady === 'function') {
    engine.onOutputTextReady(text);
  } else if (typeof engine.onSpokenAudioPlayNow === 'function') {
    engine.onSpokenAudioPlayNow(text);
  }
}
```

---

## 📝 五、邊整理其他引擎時的「動態記錄區」 (Discovered Couplings Log)

> 💡 **使用說明**：當您在整理 `SpeechEngine`、`SkinEngine`、`ToolsEngine` 的型別與參數時，凡是有發現和大腦相關的隱性依賴或問題，請直接將條目追加在此區。

### 發現記錄清單：
- [x] **耦合點 01 (ToolsEngine)**：`core/tools/index.ts` 內有 9 處 `toolsEngine.onSpokenAudioPlayNow`，在取消、確認工具執行時直接發聲，需列入中立化重構範圍。
- [ ] **耦合點 02 (待整理補入)**：*（整理 SpeechEngine 參數型別時記錄）*
- [x] **耦合點 03 (SkinEngine 跨領域耦合)**：
  - **面部表情 (Expression) 與肢體動作 (Gesture) 通道混雜**：大腦輸出的 `onEmotionChange`（中立化後為 `onSentimentChange`）傳入 `skinEngine.setEmotion` 時，目前皮膚引擎內部會強制執行 `gestureName = emotion`，把情緒當作動作檔名播放，造成面部表情與肢體動作混亂、容易打斷 normal idle/speaking 動作或觸發警告。大腦解耦後，Orchestrator 應將 `onSentimentChange` 純粹映射至模型的面部表情（Expression/Blendshape），僅在明確有動作映射時才觸發肢體動畫。
  - **`model` 參數名相撞與歧義**：大腦引擎使用 `model`（LLM 名稱），而皮膚引擎頂層配置使用 `modelUrl`（2D 模型網址）與 `modelTransform`（3D 空間變換），在上層 `WidgetOptions` 容易產生認知衝突與配置混淆。
- [x] **耦合點 04 (Orchestrator 推理狀態硬編碼)**：
  - 在 `pipeline-stream.ts` 與 `pipeline-user.ts` 中，當大腦開始思考時，Orchestrator 硬編碼呼叫 `skinEngine.gestureName = 'thinking'` 與 `skinEngine.setEmotion('thinking')`；而在思考結束時，原先硬編碼呼叫 `skinEngine.gestureName = 'talking'`，但皮膚引擎並無單一 `talking` 手勢（說話由 `isSpeaking` 驅動動作池），導致無此手勢的模型拋出 `GestureNotFoundError`。現已將思考結束修正為平滑回歸 `neutral`。未來大腦徹底獨立拆包時，應將思考狀態正規化至標準推論生命週期事件（如 `onReasoningStart` / `onReasoningEnd`），由協調層或使用者自訂映射動作，而非直接在核心流程綁死特定字串。

---

## 🚀 六、最終驗收清單 (Final Acceptance Checklist)

當其他引擎皆整理完畢，準備最後收斂執行此 TODO 時，逐一勾選：

- [ ] `core/brain/types.ts` 新增中立回呼並保留 `@deprecated` 別名宣告。
- [ ] `core/brain/index.ts` 與 `core/brain/ai-provider.ts` 完成雙向別名轉發。
- [ ] `core/tools/` 將 `onSpokenAudioPlayNow` 重構為中立名稱。
- [ ] `core/orchestrator/engine-factory.ts` 完成事件管線的新舊相容綁定。
- [ ] 單元測試：
  - [ ] 驗證傳入新回呼（`onOutputTextReady`）能正確觸發。
  - [ ] 驗證傳入舊回呼（`onSpokenAudioPlayNow`）依然能向後相容正常運作。
- [ ] 範例專案與 `README_ZH.md` 狀態更新為 `✅ TODO 1 (Implemented)`。

