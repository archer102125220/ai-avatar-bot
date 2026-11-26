# 📌 TODO 7：協調器 (`core/orchestrator`) 與共用層 (`core/constants`, `core/types`, `core/plugins`) 逐步檢視與重構追蹤清單
*(Orchestrator & Shared Layer Step-by-Step Audit & Refactoring Master Checklist)*

> **文件狀態**：逐步討論與分階段推進中 (Living Master Checklist)  
> **建立日期**：2026-11-26  
> **關聯核心**：`core/constants.ts`、`core/types.ts`、`core/index.ts`、`core/plugins/emotion-tools.ts`、`core/orchestrator/*`  
> **關聯規格書**：[`TODO-1`](./TODO-1-DOMAIN-NEUTRAL-BRAIN-DECOUPLING.md)、[`TODO-4`](./TODO-4-SPEECH-ENGINE-CLEAN-DECOUPLING.md)、[`TODO-5`](./TODO-5-UI-ENGINE-REACTIVE-STORE-DECOUPLING.md)、[`TODO-6`](./TODO-6-I18N-DICTIONARY-SSOT-AND-LOCALE-SYNC.md)

---

## ⚡ 跨 Session 快速索引與讀取指南 (Cross-Session AI Reading Guide)

> **🤖 AI 讀取守則（節省 Context 負擔）**：
> 1. **分段讀取**：跨 Session 接手時，請先用 `read_file` 讀取本文件 **第 1 ～ 50 行** 掌握各階段進度，再依下表「行號區間」僅讀取當前要處理的階段。
> 2. **計畫分離原則**：本文件僅記錄**「問題清單、討論決策結論與完成狀態」**。**嚴禁**將冗長的程式碼 Diff 或逐步實作細節塞入本文件；每個階段準備動手前，應另行建立獨立的單一階段實作計畫（Artifact Plan）。

| 階段 | 主題範圍 | 核心目標檔案 | 決策狀態 | 實作狀態 | 章節行號參考 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **階段一** | **共用常數與型別層** | `core/types.ts`、`core/constants.ts`、`core/index.ts`（含 `enableSkinModeToggle` 連動） | ✅ 已拍板 | ⏳ 待執行（已建立獨立實作計畫） | L55 – L105 |
| **階段二** | **頂層初始化參數 `AvatarBotOptions`** | `core/orchestrator/types.ts`、`core/orchestrator/options.ts` | 💬 待討論 | ⏳ 待處理 | L107 – L145 |
| **階段三** | **控制器實例 `AiAvatarWidget` 與 `rootStore`** | `core/orchestrator/widget.ts`、`subscribers.ts`、`index.ts` | 💬 待討論 | ⏳ 待處理 | L147 – L180 |
| **階段四** | **協調器內部管線、工廠與內建插件** | `engine-factory.ts`、`pipeline-*.ts`、`interaction.ts`、`emotion-tools.ts` | 💬 待討論 | ⏳ 待處理 | L182 – L225 |
| **階段五** | **跨引擎規格書同步** | `docs/TODO-1.md`、`TODO-4.md`、`TODO-5.md`、`TODO-6.md` | 💬 待討論 | ⏳ 待處理 | L227 – L245 |

---

## 🔍 階段一：共用常數與型別層（✅ 已拍板定案）

- [ ] **1.1 同名型別單一來源收斂與 `@ai-avatar-bot/sdk/types` 補齊**
  - **問題**：全專案 231 個導出型別中，`EngineMode`、`FitMode`、`AutoContinueMode`、`ChatRole` 在 `core/types.ts`（含 `| (string & {})`）與 `core/constants.ts`（不含 `| (string & {})`）雙重宣告；且 `constants.ts` 內 15 個衍生型別（`AvatarState`、`CompressionStrategy`、`AiProviderStatus` 等）未從 `core/types.ts` 導出。
  - **已拍板決策**：該 4 個同名型別語意完全相同無需拆分；統一由 `core/types.ts` 定義所有共用型別，`core/constants.ts` 改自 `./types` 匯入並重新導出；修正 `MemoryClearTarget` 為 `| (string & {})` 保留自動完成；移除 `core/index.ts` 手寫壓制衝突的重複 `export type`。
- [ ] **1.2 模型預設路徑常數與頂層參數（`live2dUrl` / `vrmUrl`）對齊**
  - **問題**：`DEFAULT_MODEL_URL` 語意過於模糊（在 AI + 2D + 3D 跨領域下易與 LLM Model 混淆）；`DEFAULT_VRM_URL` 則貼近 3D 領域與 `vrmUrl` 參數但缺乏 2D 對稱常數。
  - **已拍板決策**：移除 `DEFAULT_MODEL_URL`；保留 `DEFAULT_VRM_URL` 並新增對稱的 `DEFAULT_LIVE2D_URL = DEFAULT_2D_MODEL_URL`（同時保留 `DEFAULT_2D_MODEL_URL` / `DEFAULT_3D_MODEL_URL` 家族）。
- [ ] **1.3 常數別名與執行期實例重複 Getter 清理（建立「靜態領域別名保留 vs 執行期實例單一純淨」規範）**
  - **問題**：存在 `*Options` vs `*Config`（`DEFAULT_REASONING_CONFIG`）、隨手縮寫（`EMO_TARGET_MAP`）、AI 領域別名（`FINISH_REASON_MAP`、`BRAIN_FALLBACK_TYPE_MAP`），且執行期實例 `widget` / `brainEngine` 重複掛載了雙份別名 Getter。
  - **已拍板決策**：
    1. `constants.ts` 移除 `DEFAULT_REASONING_CONFIG`（統一用 `*Options`）與 `EMO_TARGET_MAP`（統一用 `EMOTION_TARGET_MAP`）。
    2. `constants.ts` 靜態匯出層**刻意保留 4 組跨領域直覺對稱別名**（須於 `constants.ts` JSDoc 與 `README.md` / `README_ZH.md` 明確標註對照表與設計原因，避免外部開發者或未來維護者/AI 誤認）：
       - `DEFAULT_LIVE2D_URL` ⇄ `DEFAULT_2D_MODEL_URL`（對齊 `live2dUrl` 參數與 Live2D 領域直覺）
       - `DEFAULT_VRM_URL` ⇄ `DEFAULT_3D_MODEL_URL`（對齊 `vrmUrl` 參數與 3D VRM 領域直覺）
       - `FINISH_REASON_MAP` ⇄ `LLM_FINISH_REASON_MAP`（對齊 OpenAI/LLM 標準 `finish_reason` / `result.finishReason`）
       - `BRAIN_FALLBACK_TYPE_MAP` ⇄ `BRAIN_ENGINE_TYPE_MAP`（對齊 `onBrainFallback` 回呼攔截情境）
    3. 執行期實例（`AiAvatarWidget` 與 `BrainEngine`）移除重複掛載的別名 Getter（`BRAIN_FALLBACK_TYPE_MAP`、`FINISH_REASON_MAP`），實例層僅留唯一主名稱。
- [ ] **1.4 2D/3D 外觀模式切換開關正名（方案 B）**
  - **問題**：UI 引擎（`TODO-5`）已正名為 `skinModeButtonEl` 與 `isSkinModeToggleEnabled`，但常數與協調器仍為 `DEFAULT_ENABLE_ENGINE_TOGGLE` / `enableEngineToggle` / `isEngineToggleEnabled`。
  - **已拍板決策**：採用方案 B，全面正名為 `DEFAULT_ENABLE_SKIN_MODE_TOGGLE`、`enableSkinModeToggle` 與 `isSkinModeToggleEnabled`。

---

## 🛠️ 階段二：頂層初始化參數 `AvatarBotOptions`（💬 待討論）

- [ ] **2.1 WebLLM 模型參數 `@deprecated` 舊別名清理**
  - **標的**：`AvatarBotOptions`、`AiAvatarWidget`、`setupBrainEngine` 中的 `llmModel` 與 `llmFallbackModel`（及 `BrainEngine.llmFallbackModel`）。
  - **待討論方向**：是否對齊 `BrainEngineOptions`，於正式版前移除舊名，統一保留 `webLlmModel` 與 `webLlmFallbackModel`。
- [ ] **2.2 VRM 拖放開關重複別名清理**
  - **標的**：`AvatarBotOptions` 與 `options.ts` 中的 `allowModelDrop` vs `enableModelDrop`。
  - **待討論方向**：是否移除 `allowModelDrop`，與全專案 `enable*` 布林開關統一為 `enableModelDrop`。
- [ ] **2.3 頂層漏接參數與強型別修補**
  - **標的**：
    1. `isolateModeHistory`（`AvatarBotOptions` 已定義，但 `options.ts`、`setupBrainEngine`、`widget.ts`、`subscribers.ts` 漏接）。
    2. `localeLabels`（`I18nEngineOptions` 已支援，但 `AvatarBotOptions` 與 `options.ts` 漏接）。
    3. `onTapAvatar`（`interaction.ts` 已觸發，但 `AvatarBotOptions` 漏宣告）。
    4. `emotionToolsOptions`（`AvatarBotOptions` 目前為 `Record<string, unknown>`，可改為強型別 `EmotionToolsPluginOptions`）。
- [ ] **2.4 頂層事件回呼名稱與簽名對齊**
  - **標的**：
    1. 語音回呼：`AvatarBotOptions` 的 `onSpeaking`、`onSpeakingEnd`、`onMicStateChanged`、`onVoiceStatusChanged` 對齊 `SpeechEngineOptions` 的 `onSpeakStart`、`onSpeakEnd`、`onMicStateChange`、`onVoiceStatusChange`（及參數 `convoOn` ➔ `continuousMode`）。
    2. 對話歷史回呼：`onAddChatMessage` / `onUpdateChatMessage` 在 `engine-factory.ts` 中的 `rawCallback.length > 1` 舊版多位置參數嗅探是否移除，統一收斂為 `(item: ChatLogItem) => void`。
    3. 移除 `orchestrator/types.ts` 底部 0 引用的 `SpeechEngineOptions as SpeechEngineSetting`。

---

## 🎛️ 階段三：控制器實例 `AiAvatarWidget` 與 `rootStore`（💬 待討論）

- [ ] **3.1 `AiAvatarWidget` 實例上的唯讀 `on*` 回呼 Getter 與常數 Getter 範圍檢視**
  - **標的**：`widget.ts` L536–576 額外暴露的 8 個 `on*` 唯讀 Getter（`onLlmOomFallback`、`onAiProvider*`、`onReasoning*`、`onStreamChunk`）與 3 個設定 Getter（`webLlmFallbackModel`、`enableOomFallback`、`reasoning`），以及實例上掛載的大寫常數 Getter。
- [ ] **3.2 消除 `widget.ts` Setter 與 `subscribers.ts` 雙重賦值，補齊 Store 訂閱**
  - **標的**：`enableMemory`、`enableAiProvider` 等 8 個屬性在 `widget.ts` Setter 與 `subscribers.ts` 重複寫入 `brainEngine`；而 `enableModelDrop` 與 `enableSkinModeToggle` 則缺少 `subscribers.ts` 訂閱。
- [ ] **3.3 `widget.isMinimal` 與 `uiDom.isMinimal`（`UiEngineStore`）狀態同步**
  - **標的**：`widget.ts` L238–256 的 `_isMinimal` 切換時未同步更新 `uiDom.isMinimal`。
- [ ] **3.4 `options.onError` 全域錯誤回呼漏綁定與 `onReady` 綁定時機修正**
  - **標的**：`orchestrator/index.ts` L220 漏綁 `options.onError`（導致 `setupSkinEngine` 內 `widget.onError` 永不觸發），且 `onReady` / `onMinimalTrigger` 在 `await setupSkinEngine` 後才綁定。

---

## ⚙️ 階段四：協調器內部管線、工廠與內建插件 Bug 修復（💬 待討論）

- [ ] **4.1 `onLlmOomFallback` 傳參結構錯位與 `onReasoningChunk/End` 多餘位置參數修正（含 `brainOptions` 強型別化）**
  - **標的**：`engine-factory.ts` L132 `brainOptions` 標註為 `Record<string, unknown>`，導致 L138 `onLlmOomFallback` 將大腦傳入的 `LlmOomFallbackInfo` 物件誤當作第 1 位置字串參數 `primaryModel` 二次包裝；`pipeline-stream.ts` 的 `onReasoningChunk/End` 在 `safeInfo` 後多傳了拆解位置參數。
- [ ] **4.2 `CustomEnginesConfig`（`skin`、`tools`、`i18n`、`ui`）自訂引擎工廠傳參、非同步 `await` 與驗證統一**
  - **標的**：`customEngines.skin` 工廠未收到完整 `SkinEngineOptions`；`setupToolsEngine` 未設為 `async` / `await`；`customEngines.i18n` 未支援 `async` 與 `validateI18nEngine`。
- [ ] **4.3 `setupBrainEngine` 13 處解構自我預設冗餘與隱藏 `options.brain?.compression` 清理**
  - **標的**：`engine-factory.ts` L74–98 的 `foo = options.foo` 與 L356 的 `options.brain?.compression`。
- [ ] **4.4 `StreamSpeechState` 雙緩衝欄位（`sentenceBuffer` vs `buf`）與內部 `AvatarBotStore` / `GetEnginesFn` 型別收斂**
  - **標的**：`pipeline-stream.ts` 同時維護 `sentenceBuffer` 與舊縮寫 `buf`；`subscribers.ts`、`interaction.ts`、`pipeline-user.ts` 的 `rootStore` 使用無泛型 `BaseStore`。
- [ ] **4.5 非串流模式（知識庫檢索 `emitAnswer`）下 `skinEngine.gestureName = 'thinking'` 未重置問題**
  - **標的**：`pipeline-user.ts` L165 在呼叫 `answerQuestion` 前設為 `'thinking'`，但走檢索回答時未觸發 `onStreamEnd` 導致手勢未歸位 `'neutral'`。
- [ ] **4.6 內建情緒插件 `core/plugins/emotion-tools.ts` 型別與 3D 肢體動作（`playGesture` vs `setEmotion`）分流修復**
  - **標的**：`emotion-tools.ts` L24–26 未使用 `ToolRoutingMode` / `ToolResultMode`；L126–132 因 `if (setEmotion) ... else if (gesture)` 且方法名誤寫為 `gesture`（應為 `playGesture`），導致 3D 模式下 `'bow'`、`'goodbye'` 等肢體動作無法觸發。

---

## 📄 階段五：跨引擎規格書（`TODO-1`、`TODO-4`、`TODO-5`、`TODO-6`）同步更新（💬 待討論）

- [ ] **5.1 同步更新 4 份 TODO 文件**
  - 將上述各階段涉及跨引擎最終收網的項目同步更新至 [`TODO-1`](./TODO-1-DOMAIN-NEUTRAL-BRAIN-DECOUPLING.md)、[`TODO-4`](./TODO-4-SPEECH-ENGINE-CLEAN-DECOUPLING.md)、[`TODO-5`](./TODO-5-UI-ENGINE-REACTIVE-STORE-DECOUPLING.md)、[`TODO-6`](./TODO-6-I18N-DICTIONARY-SSOT-AND-LOCALE-SYNC.md)。
