# 📌 TODO 6：跨引擎國際化字典單一事實來源（SSOT）與語系同步收網規格書
*(Cross-Engine I18n Dictionary SSOT & Locale Synchronization Specification)*

> **文件狀態**：草案與動態更新中 (Living Document / RFC)  
> **建立日期**：2026-11-25  
> **對應追蹤**：[`package/typescript/README_ZH.md`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/README_ZH.md) 🗺️ 未來架構演進待辦事項（TODO 6）  
> **關聯核心**：[`package/typescript/core/i18n/`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/i18n/)、`core/orchestrator/`、`core/brain/`、`core/speech/`、`core/tools/`、`core/ui/`  
> **關聯前期**：[`docs/TODO-1-DOMAIN-NEUTRAL-BRAIN-DECOUPLING.md`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/docs/TODO-1-DOMAIN-NEUTRAL-BRAIN-DECOUPLING.md)、[`docs/TODO-4-SPEECH-ENGINE-CLEAN-DECOUPLING.md`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/docs/TODO-4-SPEECH-ENGINE-CLEAN-DECOUPLING.md)、[`docs/TODO-5-UI-ENGINE-REACTIVE-STORE-DECOUPLING.md`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/docs/TODO-5-UI-ENGINE-REACTIVE-STORE-DECOUPLING.md)

---

## 🎯 一、背景與重構目標 (Background & Objective)

### 1.1 已完成之 `core/i18n` 本體純淨化成果 (Tier 1 - Completed ✅)
在 `core/i18n` 第一階段本體整理（方案 A）中，我們已完成：
1. **獨立型別與驗證器**：建立 [`core/i18n/types.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/i18n/types.ts) 與 `validateI18nEngine()`，與其他子引擎目錄結構 100% 對齊。
2. **常數語意正名與二次導出**：建立 [`core/i18n/locales/index.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/i18n/locales/index.ts) 將舊名 `defaultLocales` 正名為 `DEFAULT_I18N_MESSAGES`，並於 `core/i18n/constants.ts` 與頂層 `core/constants.ts` 二次導出。
3. **拆分純 `BaseStore` 資料訂閱與領域事件**：`i18nEngine.subscribe('locale')` 回歸標準 `BaseStore` 2 參數 `(newLocale, prevLocale)`，並於 `I18nEngineOptions` / `I18nEngine` 新增 `onLocaleChange: LocaleChangeListener`（接收 `(newLocale, labels, prevLocale)`）。
4. **深層字典合併與實例獨立 `localeLabels`**：支援巢狀字典遞迴合併（`deepMergeDictionary`）、自訂語系標籤擴充（`options.localeLabels` 與 `addMessages` 第 3 參數），並移除與 `LOCALE_LABELS.shortLabel` 重複的 `'ui.lang.buttonText'`。
5. **修正頂層 `AvatarBotOptions.i18nMessages` 型別**：擴展為 `Record<string, TranslationDictionary>`，支援覆寫陣列型翻譯鍵。

### 1.2 待跨引擎收網之痛點 (Tier 2 - Cross-Engine Scope)
在盤點 `core/i18n` 與其他五大引擎的連動關係時，發現以下跨引擎問題需於協調層與各引擎收網時統一解決：
1. **四語系字典中 21 個翻譯鍵（約 27%）淪為 0 引用死鍵**：各子引擎（`speech/stt.ts`、`brain/messages.ts`、`brain/index.ts`、`orchestrator/interaction.ts`）在內部另外硬編碼了重複的四語系字串，導致開發者透過 `i18nMessages` 覆寫這些鍵時完全無效。
2. **多處子引擎仍存在未入庫之繁體中文硬編碼**：當切換為 `en-US`、`ja-JP`、`ko-KR` 時，部分 UI 提示、語音狀態、工具驗證與背景摘要 Prompt 仍固定輸出繁體中文。
3. **語系切換事件 `onLanguageChanged` 三重觸發與雙向訂閱迴圈**：`subscribers.ts` 與 `speechEngine.setLocale()` 的重複派發導致單次語系切換觸發 3 次回呼且 `label` / `shortLabel` 前後矛盾。

---

## 📋 二、21 個未接線死鍵與各引擎雙軌重複對照表 (Dead Keys Registry)

以下收錄於 [`core/i18n/locales/{zh-TW,en-US,ja-JP,ko-KR}.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/i18n/locales/zh-TW.ts) 的 21 個鍵目前在 `core/` 內為 **0 引用**，收網時應將各引擎內部的硬編碼改為讀取 `i18nEngine.t()`（或 `DEFAULT_I18N_MESSAGES` fallback）：

| 類別 | `locales/*.ts` 現有死鍵 (共 21 鍵) | 目前硬編碼重複之檔案位置 | 收網處理方式 |
| :--- | :--- | :--- | :--- |
| **語音 (`speech.*`)**<br>*(8 鍵)* | `speech.unsupported`<br>`speech.micError`<br>`speech.startFailed`<br>`speech.listening`<br>`speech.permissionDenied`<br>`speech.noSpeech`<br>`speech.bgStop`<br>`speech.noSpeechAbort` | [`core/speech/stt.ts#L48-L139`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/speech/stt.ts#L48-L139) (`DEFAULT_STT_MESSAGES` & `getSttMessage`) | 廢除 `stt.ts` 內重複的 `DEFAULT_STT_MESSAGES`，改由 `i18nEngine.t('speech.*')` 或 `DEFAULT_I18N_MESSAGES[locale]['speech.*']` 單一來源提供（對齊 TODO 4 耦合項 02）。 |
| **大腦提示詞 (`prompt.*`)**<br>*(8 鍵)* | `prompt.system.assistant`<br>`prompt.system.companion`<br>`prompt.rag`<br>`prompt.languageRule`<br>`prompt.gender.female`<br>`prompt.gender.male`<br>`prompt.fallback.assistant`<br>`prompt.fallback.companion` | [`core/brain/messages.ts#L727-L960`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/brain/messages.ts#L727-L960)<br>[`core/brain/index.ts#L935-L1166`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/brain/index.ts#L935-L1166) | 將 `locales/*.ts` 的 `prompt.system.assistant` 與 `prompt.rag` 更新對齊 `messages.ts` 最新安全圍欄文案，並改由 `getBrainMessage(engine, 'prompt.*')` 讀取，消除 `if (/en/i.test(locale))` 硬編碼（對齊 TODO 1 耦合點 06）。 |
| **問候語 (`greeting.*`)**<br>*(3 鍵)* | `greeting.default`<br>`greeting.companion`<br>`greeting.assistant` | [`core/orchestrator/interaction.ts#L72-L181`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/orchestrator/interaction.ts#L72-L181) | 將 `interaction.ts` 點擊化身預設問候語改為透過 `i18nEngine.t('greeting.*')` 解析（對齊 TODO 4 耦合項 02）。 |
| **歡迎詞 (`welcome.*`)**<br>*(2 鍵)* | `welcome.assistant`<br>`welcome.companion` | [`core/brain/messages.ts#L144-L219`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/brain/messages.ts#L144-L219) | 將 `locales/*.ts` 的 `welcome.assistant`、`welcome.companion`（及新增 `welcome.companionReturn` 多次造訪歡迎詞）與 `getWelcomeText()` 接通（對齊 TODO 1 耦合點 06）。 |

---

## 🧱 三、未入庫之跨引擎硬編碼繁中字串納管清單 (Unwired Hardcoded Strings)

除上述已建鍵但未接線的 21 個死鍵外，以下散落於各引擎的硬編碼繁體中文需新增對應鍵至 `core/i18n/locales/*.ts`：

1. **UI 大腦狀態按鈕提示（[`core/ui/events.ts#L258-L285`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/ui/events.ts#L258-L285) — 共 5 處，對齊 TODO 5）**：
   - `brain.aiProvider.activeMsg`：`'AI 伺服器大腦運作中（{model}）🧠'`
   - `brain.aiProvider.unreachableMsg`：`'AI 伺服器連不上：確認 AI 伺服器在跑、且 AI_PROVIDER_ORIGINS 已允許這個網站。'`
   - `brain.llm.unsupportedWebGPU`：`'這個裝置不支援 WebGPU，先用知識庫模式就好（功能一樣可用）。'`
   - `brain.llm.alreadyReady`：`'AI 大腦已啟用，問我問題吧 🧠'`
   - `brain.llm.loadingProgress`：`'AI 大腦載入中… {progress}%'`
2. **語音引擎狀態提示（[`core/speech/stt.ts#L51`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/speech/stt.ts#L51) & [`core/speech/index.ts#L595-L790`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/speech/index.ts#L595-L790) — 共 3 處，對齊 TODO 4）**：
   - `speech.requestPermission`：`'正在取得麥克風權限…'`
   - `speech.interrupted`：`'已停止回答，請繼續說…'`
   - `speech.recognizing`：`'正在辨識：{text}'`（另 L787 `'你：' + text + '…'` 直接復用既有 `'brain.userPrefix'`）
3. **協調層外觀載入提示（[`core/orchestrator/engine-factory.ts#L1415-L1464`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/orchestrator/engine-factory.ts#L1415-L1464) — 共 2 處）**：
   - `skin.error.2dInit`：`'2D 啟動失敗：{error}'`
   - `skin.vrmChanged`：`'換上你的角色了！🎭'`
4. **大腦背景滾動摘要提示詞與清除記憶指令（[`core/brain/compression.ts#L418-L460`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/brain/compression.ts#L418-L460) & [`core/orchestrator/pipeline-user.ts#L92`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/orchestrator/pipeline-user.ts#L92)，對齊 TODO 1）**：
   - 依 `locale` 分流 `generateRollingSummary` 的預設 System/User 摘要提示詞與 `'問'`/`'答'` 標籤。
   - 擴充 `pipeline-user.ts` 清除記憶匹配規則以涵蓋英/日/韓語系（或支援由 `i18nEngine` 讀取觸發詞）。
5. **工具引擎互動與 Schema 驗證訊息（[`core/tools/index.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/tools/index.ts) 16 處 & [`core/tools/validator.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/tools/validator.ts) 11 處，對齊 TODO 4）**：
   - 將參數詢問、多選一候選提示、確認執行、逾時/取消/完成/失敗狀態，以及 `validator.ts` 的型別/格式驗證錯誤訊息納入 `tools.*` 命名空間。

---

## 🔄 四、語系切換單一來源與跨引擎參數對齊 (Locale Sync & Parameter Alignment)

1. **消除 `onLanguageChanged` 三重觸發與 `setLocale` 雙重呼叫**：
   - **問題根源**：
     1. [`core/orchestrator/subscribers.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/orchestrator/subscribers.ts#L249-L325) 中，`setupI18nSubscribers` 在 `i18nEngine` 語系變更時呼叫 `rootStore.setState({ locale: newLocale })`（同步觸發 `setupStoreSubscribers` 內的 `rootStore.subscribe('locale')` 呼叫第 1 次 `brainEngine.setLocale` 與 `speechEngine.setLocale`），隨後 L321–324 又手動呼叫第 2 次 `brainEngine.setLocale` 與 `speechEngine.setLocale`。
     2. [`core/speech/index.ts#L667-L685`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/speech/index.ts#L667-L685) 的 `speechEngine.setLocale()` 內部硬編碼了 `'英文 (English)'` 等標籤並觸發 `onLanguageChanged`（共觸發 2 次），接著 `setupI18nSubscribers` L357 又以 `i18nEngine.labels` 觸發第 3 次 `onLanguageChanged`。
   - **收網方案**：
     - 自 `SpeechEngine` 移除硬編碼語言標籤推導與 `onLanguageChange` / `onLanguageChanged`（語音引擎的 `setLocale` 僅負責更新 STT `recognition.lang` 與 TTS 音色）。
     - 在 `subscribers.ts` 中統一由 `i18nEngine` 的 `onLocaleChange`（或 `subscribe('locale')`）作為唯一語系同步起點，移除重複的 `brainEngine.setLocale` / `speechEngine.setLocale` 呼叫，並支援 `rootStore.setState({ locale })` 反向同步至 `i18nEngine.setLocale()`（透過相等性守衛避免循環觸發）。
2. **UI 引擎 `i18n` 參數名與動態語系輪詢對齊（對齊 TODO 5）**：
   - 將 [`core/ui/types.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/ui/types.ts#L71-L85) 中 `VoiceStatusOptions.i18n` 與 `MicStateOptions.i18n` 統一正名為 `i18nEngine`（或直接由 `initUi` 閉包內的 `currentI18nEngine` 自動提供）。
   - [`core/ui/events.ts#L169`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/ui/events.ts#L169) 的語言切換按鈕改為輪詢 `Object.keys(context.i18nEngine?.messages || {})`（fallback 至 `SUPPORTED_LOCALES`），讓開發者新增的自訂語系也能透過 UI 按鈕切換。
   - [`core/ui/dom.ts`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/ui/dom.ts) 的 `initUi()` 在傳入 `i18nEngine` 時，於結尾自動執行一次 `updateUIStrings(container, i18nEngine)`。
   - **評估 `ui.engine.ariaLabel` 鍵名語意對齊**：[`core/ui/dom.ts#L171`](file:///Users/parkerchen/Desktop/code/ai-avatar-bot/package/typescript/core/ui/dom.ts#L171) 的 2D/3D 外觀切換按鈕已於 TODO 5 正名為 `skinModeButtonEl`，但其無障礙屬性仍綁定舊鍵名 `data-i18n-aria="ui.engine.ariaLabel"`，收網時可評估正名為 `ui.skinMode.ariaLabel` 以消除 `engine` 歧義。
3. **`CustomEnginesConfig.i18n` 非同步工廠與 `validateI18nEngine` 接入**：
   - 將 `customEngines.i18n` 的初始化由同步的 `normalizeOptions` 移至 `initAvatarBot` / `engine-factory.ts` 非同步流程中，支援 `await customEngines.i18n(options)` 並透過 `validateI18nEngine()` 進行介面驗證與降級保護。
4. **`resolveLocalized` 實例方法與獨立函式調用收斂**：
   - 目前 `core/brain/`、`core/ui/suggestions.ts`、`core/orchestrator/interaction.ts` 皆直接呼叫 4 參數獨立函式 `resolveLocalized(value, locale, fallbackValue, templateContext)`，而在已持有 `i18nEngine` 實例的場景下，可優先調用 3 參數實例方法 `i18nEngine.resolveLocalized(value, fallbackValue, templateContext)`（自動帶入當前 `i18nEngine.locale`）。

---

## 🛡️ 五、各子引擎獨立使用保障原則（零強制依賴與字典分片聚合架構）
*(Standalone Sub-Engine Independence & Bottom-Up Domain Dictionary Sharding)*

為確保將各引擎多語系字典收斂至單一事實來源（SSOT）後，**絕對不會妨礙開發者單獨使用任一子引擎（如 `@ai-avatar-bot/sdk/brain`、`/speech`、`/tools`、`/ui`）**，收網實作時必須嚴格遵守以下三大架構約束：

### 5.1 執行期零強制依賴：`i18nEngine` 永遠為選配注入 (`Optional Injection`)
1. **不強迫實例化 `I18nEngine`**：
   - 各子引擎之 Options（`BrainEngineOptions`、`SpeechEngineOptions`、`ToolsEngineOptions`、`UiContext`）中，`i18nEngine?: I18nEngine` 永遠為**可選參數（Optional）**，同時保留子引擎自身的 `locale?: SupportedLocale` 設定。
2. **雙層解析 Fallback 機制**：
   - **統整模式（有注入 `i18nEngine`）**：優先呼叫 `i18nEngine.t(key, params)`，確保開發者於頂層配置的 `i18nMessages` 或 `addMessages()` 能 100% 覆寫所有子引擎文案。
   - **獨立模式（未注入 `i18nEngine`）**：子引擎自動退回（Fallback）以自身的 `locale`（預設 `'zh-TW'`）查詢該領域內建預設值並完成 `{param}` 插值，開發者單獨使用子引擎時無須額外引入或初始化 `initI18nEngine()`。

### 5.2 打包期零跨領域體積污染：由下而上領域字典分片聚合 (`Bottom-Up Domain Sharding`)
1. **禁止子引擎反向載入整包全領域大字典**：
   - 若子引擎（如 `core/speech` 或 `core/tools`）為了 Fallback 而直接引入包含所有引擎文案的 `DEFAULT_I18N_MESSAGES`，會導致開發者按需引入 `@ai-avatar-bot/sdk/speech` 時，連帶把 `Brain` 長達數百行的 System Prompt 與 RAG 模板一併打包（破壞 Subpath Tree-Shaking 與未來獨立拆包）。
2. **按領域拆分輕量字典並由 `core/i18n` 向上匯總**：
   - 將預設字典按領域拆分為獨立輕量分片（如 `brain`、`speech`、`tools`、`ui`），各子引擎在獨立運作時**僅引用所屬領域的預設分片**（或內建預設常數），而 `core/i18n/locales/index.ts` 的 `DEFAULT_I18N_MESSAGES` 則由各領域分片向上組合（Spread / Merge）而成：
     ```text
     core/brain  (僅依賴 brain 預設分片)  ─┐
     core/speech (僅依賴 speech 預設分片) ─┼──向上聚合──> DEFAULT_I18N_MESSAGES (core/i18n)
     core/tools  (僅依賴 tools 預設分片)  ─┤
     core/ui     (僅依賴 ui 預設分片)     ─┘
     ```
   - 如此即可同時達成**「全專案唯一字典來源（SSOT，不重複維護兩套字串）」**與**「子引擎單獨打包 100% 輕量零耦合」**。

### 5.3 各子引擎現行多語系抽離狀態盤點
| 子引擎 | 目前是否已抽離至 `locales/*.ts` | 單獨使用（未傳 `i18nEngine`）時的現行 Fallback 行為 | 收網對齊目標 |
| :--- | :--- | :--- | :--- |
| **`core/ui`** | **已抽離約 86%**（32 個 `ui.*` / `suggestions.*` 鍵已入庫；僅剩 `events.ts` 5 句大腦按鈕提示未入庫） | **僅有繁體中文預設值**：在 `dom.ts`、`history.ts`、`events.ts`、`suggestions.ts` 內皆以 `typeof i18nEngine?.t === 'function' ? i18nEngine.t(key) : '繁中預設字'` 作為單語 Fallback。 | 補齊剩餘 5 鍵；單獨呼叫 `initUi(container, stage, i18nEngine)` 時維持無 `i18nEngine` 即以預設文案安全渲染，有 `i18nEngine` 時自動套用 `updateUIStrings`。 |
| **`core/brain`** | **半抽離**（17 個 `brain.*` 狀態鍵已入庫並由 `getBrainMessage` 讀取；但 `prompt.*` 8 鍵與 `welcome.*` 2 鍵雖在 `locales/*.ts` 卻未接線；`compression.ts` 摘要 Prompt 未入庫） | `brain.*` 狀態鍵會 Fallback 查 `DEFAULT_I18N_MESSAGES[locale]`（四語系）；`prompt.*` 與 `welcome.*` 在 `messages.ts` 內寫死四語系 `if/else`；`compression.ts` 僅有繁中預設值。 | 讓 `prompt.*`、`welcome.*` 與摘要 Prompt 統一走 `getBrainMessage`（有 `i18nEngine` 走 `t()`，無則查 Brain 領域四語系分片）。 |
| **`core/speech`** | **雙軌重複**（`locales/*.ts` 已有 `speech.*` 9 鍵，但 `stt.ts` 內部又重複寫了一套四語系 `DEFAULT_STT_MESSAGES`，另有 2 句僅繁中硬編碼） | `stt.ts` 固定查內部的 `DEFAULT_STT_MESSAGES[locale]`（完全忽略 `i18nEngine` 與 `i18nMessages` 覆寫）；`index.ts` 的 2 句固定輸出繁中。 | 統一 `speech.*` 鍵名分片；有 `i18nEngine`（或由協調層接手 UI 泡泡）時走 `i18nEngine.t()`，單獨使用 `SpeechEngine` 時查 `speech` 領域四語系分片。 |
| **`core/tools`** | **尚未抽離**（`index.ts` 16 處互動提示與 `validator.ts` 11 處驗證訊息皆未入庫） | **僅有繁體中文預設值**（全數寫死繁中字串）。 | 抽離 `tools.*` 領域分片；有 `i18nEngine` 時走 `i18nEngine.t()`，單獨使用 `ToolsEngine` 時支援依 `locale` 查 `tools` 領域預設分片。 |
| **`core/skin`** | **無內部 UI 文案**（僅 `orchestrator/engine-factory.ts` 有 2 句繁中載入/換裝提示） | 外觀引擎本體為純 WebGL 渲染，不涉及多語系文案。 | 協調層的 2 句提示納入 `skin.*` 由 `orchestrator` 的 `i18nEngine.t()` 解析。 |

---

## 🚀 六、最終驗收清單 (Final Acceptance Checklist)

- [ ] 確立**「選配注入 (`i18nEngine?: I18nEngine`) ＋ 領域分片由下而上聚合」**機制，確保任一子引擎單獨使用（不傳 `i18nEngine`）時皆能依 `locale` 正常運作且不打包其他領域字典。
- [ ] `core/i18n/locales/*.ts` 內 21 個死鍵（`speech.*` 8 鍵、`prompt.*` 8 鍵、`greeting.*` 3 鍵、`welcome.*` 2 鍵）全數與對應子引擎接通，零未引用死鍵。
- [ ] `core/ui/events.ts`、`core/speech/`、`core/orchestrator/engine-factory.ts`、`core/brain/compression.ts`、`core/tools/` 內之硬編碼繁中字串全數抽離至 `locales/*.ts`。
- [ ] `core/orchestrator/subscribers.ts` 消除 `brainEngine.setLocale` / `speechEngine.setLocale` 雙重呼叫與 `onLanguageChanged` 三重觸發。
- [ ] `core/ui/` 完成 `i18nEngine` 參數名對齊、自訂語系按鈕輪詢與 `initUi` 自動執行 `updateUIStrings`。
- [ ] `customEngines.i18n` 支援 `async` 工廠函式並接入 `validateI18nEngine` 驗證。
- [ ] `README_ZH.md` 與 `README.md` 更新自訂語系擴充範例（`i18nMessages` + `localeLabels`）並將狀態標記為 `✅ TODO 6 (Implemented)`。
