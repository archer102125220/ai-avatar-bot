# 雙軌 E2E 測試架構與跨框架驗收指引 (Dual-Track E2E Testing & Migration Guide)

繁體中文 | [English](./README.md)

> 本目錄包含 `ai-avatar-bot` 專案的端到端（E2E）測試體系。本架構採用**「分軌分層設計」**，兼顧「底層引擎（WebGL/3D、Web Audio、大腦串流）真實健全度」與「跨框架（Vanilla JS、TypeScript、React、Vue）UI 行為合約同構驗收」。

---

## 🏗️ 1. 雙軌測試架構概覽 (Dual-Track Architecture)

```
                                  Playwright 雙軌 E2E 測試架構
                                                │
         ┌──────────────────────────────────────┴──────────────────────────────────────┐
         ▼                                                                             ▼
┌──────────────────────────────────────────────┐              ┌──────────────────────────────────────────────┐
│  【軌道 A】跨框架 UI 與交互合約驗收           │              │  【軌道 B】真實引擎管線冒煙驗收 (Engine Smoke)│
│  (UI & Contract Parity E2E)                  │              │  (Real WebGL / Web Audio / Brain Stream)     │
├──────────────────────────────────────────────┤              ├──────────────────────────────────────────────┤
│ • 目的：跨框架（Vanilla / React / Vue）同構   │              │ • 目的：驗證真實引擎在真瀏覽器 Runtime 的健全度│
│ • 方式：自訂 Mock 引擎，秒級響應             │              │ • 方式：不 Mock 引擎，跑真實 WebGL、Web Audio │
│ • 焦點：生命週期、DOM 標籤、對話流、Tool 彈窗  │              │ • 焦點：Canvas Context、口型頻率計算、串流解析│
│ • 檔案：specs/contract/*.spec.ts             │              │ • 檔案：specs/engine/*.spec.ts               │
│ • 沙盒：harness/contract.html                │              │ • 沙盒：harness/engine.html                  │
└──────────────────────────────────────────────┘              └──────────────────────────────────────────────┘
```

### 分軌職責對比

| 指標 / 特性 | 軌道 A：交互合約 (Track A) | 軌道 B：真實引擎 (Track B) | 發布打包冒煙 (Smoke) |
| :--- | :--- | :--- | :--- |
| **目標範疇** | UI 狀態機、DOM 契約、交互行為 | WebGL Canvas、Web Audio API、Brain 串流 | `dist/` 打包產物在純 HTML 的載入與掛載 |
| **引擎依賴** | 輕量化 Mock 引擎（秒級啟動） | 真實 Live2D/VRM、真實 Web Audio、真實 Brain | 生產構建模組 (`dist/ai-avatar-bot.js`) |
| **外部資源** | 零（無需模型或遠端 API） | 啟動無頭瀏覽器 GPU/音訊 flags | 零 |
| **主要定位** | **跨框架移植驗收測試（Acceptance Suite）** | **底層引擎健全防護（Engine Regression）** | **發布前健全冒煙（Release Gate）** |
| **執行耗時** | ~15 秒（16 支驗收規格） | ~8 秒（8 支引擎冒煙規格） | ~3 秒（1 支打包載入規格） |

---

## 📋 2. DOM 契約與 TestID 規範 (Contract Standard)

為了保證不同框架實作（Vanilla JS、React、Vue）的完全同構，UI 組件必須嚴格遵守以下 DOM 與屬性合約：

| 元素名稱 | `data-testid` | 狀態屬性 (Attributes / ARIA) | 說明 |
| :--- | :--- | :--- | :--- |
| **Widget 根容器** | `avatar-widget-root` | `[css-is-speaking="true\|false"]`<br>`[css-is-minimal="true\|false"]`<br>`[css-is-loading="true\|false"]` | 最外層容器，包含即時狀態與全域主題樣式 |
| **對話氣泡** | `avatar-bubble` | `[css-is-visible="true\|false"]` | 包含打字機訊息文字的浮動氣泡 |
| **文字輸入框** | `avatar-chat-input` | `placeholder`, `disabled` | 支援 Enter / 送出按鈕送出 |
| **送出按鈕** | `avatar-chat-submit` | `disabled` | 觸發訊息發送流程 |
| **麥克風按鈕** | `avatar-btn-mic` | `[aria-pressed="true\|false"]` | 即時語音監聽切換開關 |
| **靜音切換按鈕** | `avatar-btn-speaker` | `[aria-pressed="true\|false"]` | 語音輸出靜音控制開關 |
| **最小化按鈕** | `avatar-btn-minimal` | - | 點擊切換虛擬人展開／收合狀態 |
| **歷史記錄按鈕** | `avatar-btn-history` | `[aria-expanded="true\|false"]` | 展開對話歷史抽屜面板 |
| **歷史面板容器** | `avatar-history-panel` | `[css-is-open="true\|false"]`<br>`inert` (關閉時為 true) | 歷史對話抽屜，關閉時不可被聚焦或點擊 |
| **歷史訊息項** | `avatar-msg-user`, `avatar-msg-bot` | - | 渲染於歷史抽屜內的對話紀錄 |
| **工具審批卡片** | `avatar-tool-card` | - | 當觸發需人工確認的工具調用時顯示 |
| **工具確認按鈕** | `avatar-tool-confirm-btn` | - | 點擊授權執行該工具 |

---

## 🚀 3. 跨框架翻寫與遷移驗收指引 (Migration Workflow)

當團隊進行 `@package/typescript`（核心重構）、`@package/react` 或 `@package/vue` 的封裝時，請按照下列步驟進行驗收：

### 流程一：TypeScript 核心重構驗收 (Core Migration)
1. **單元測試全覆蓋**：以 `test/unit/` 為準，重構後的 TypeScript 實作必須通過所有 470+ 項單元測試。
2. **軌道 B 引擎測試驗收**：
   - 確保真實 `SkinEngine`、`SpeechEngine`、`BrainEngine` 在瀏覽器中啟動無報錯。
   - 執行 `yarn test:e2e:engine`，驗證 WebGL 上下文、Resize 監聽與 AudioContext 正確建立。

### 流程二：React / Vue UI 組件封裝驗收 (UI Parity Migration)
1. **搭建測試沙盒 (Harness)**：
   - 在該框架目錄下建立測試頁面（如 `test/e2e/harness/react.html` 或 Vite Playground）。
   - 掛載該框架實作的 `<AiAvatarBot />` 組件，並傳入相容的 Mock 引擎：
     ```ts
     const mockSkin = {
       canvas: document.createElement('canvas'),
       render: () => {},
       setEmotion: () => {},
       destroy: () => {}
     };
     ```
2. **複用軌道 A 規格清單**：
   - 直接執行 `test/e2e/specs/contract/*.spec.ts`。
   - 測試清單涵蓋：
     - `lifecycle.spec.ts`：掛載、`onReady` 回呼觸發、`destroy()` 資源卸載。
     - `chat-flow.spec.ts`：輸入框聚焦、發送訊息、氣泡逐字打字機、狀態切換。
     - `minimal-toggle.spec.ts`：展開／收合、容器屬性切換。
     - `controls.spec.ts`：靜音開關、歷史抽屜 `inert` 與 `aria-expanded` 聯動。
     - `tool-calling.spec.ts`：工具確認卡片彈出、審批點擊、回呼結果回傳。
3. **驗收判定**：
   - **當軌道 A 的 16 項測試全部通過時，即證明該框架的 UI 與行為 100% 同構。**

---

## 💻 4. 測試指令與報告獨立檢視 (CLI & Reports)

專案配置了獨立的 HTML 報告輸出目錄，執行不同測試軌道**不會互相覆蓋**報告結果：

### 執行測試指令

```bash
# 1. 執行毫秒級單元測試 (Vitest)
yarn test:unit

# 2. 執行軌道 A：跨框架 UI 合約測試（秒級響應，適合日常開發與 PR 驗收）
yarn test:e2e:contract

# 3. 執行軌道 B：真實底層引擎冒煙測試（驗證 WebGL / Audio / SSE）
yarn test:e2e:engine

# 4. 執行雙軌完整 E2E 測試（軌道 A + 軌道 B）
yarn test:e2e

# 5. 執行發布前打包產物冒煙測試（先執行 yarn build 再驗收 dist/ 產物載入）
yarn test:smoke

# 6. 啟動 Playwright UI 視覺化互動除錯視窗
yarn test:e2e:ui
```

### 檢視 HTML 測試報告

| 軌道 | 報告存放路徑 | 開啟指令 |
| :--- | :--- | :--- |
| **完整雙軌報告** | `playwright-report/all` | `yarn test:e2e:report` |
| **軌道 A 合約報告** | `playwright-report/contract` | `yarn test:e2e:report:contract` |
| **軌道 B 引擎報告** | `playwright-report/engine` | `yarn test:e2e:report:engine` |
| **打包產物冒煙報告** | `playwright-report/smoke` | `yarn test:e2e:report:smoke` |
