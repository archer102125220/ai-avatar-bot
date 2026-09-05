# AI Avatar Bot

繁體中文 | [English](./README_EN.md)

> 輕量、模組化、可擴充的網頁端 AI 虛擬數位人（2D Live2D / 3D VRM）互動 SDK 專案生態系。

本專案源自於 [YuriCrystal/ai-avatar-bot](https://github.com/YuriCrystal/ai-avatar-bot) 的開源探索，我們將其進行大規模模組化拆分、架構重構與工程化規範，旨在打造一套可發布至 npm 的現代化 Web AI 虛擬人套件生態。

---

## 📑 目錄

- [📦 套件矩陣與版本導覽](#-套件矩陣與版本導覽)
- [🌟 核心架構與多引擎設計](#-核心架構與多引擎設計)
- [🚀 快速開始 (以 Vanilla JS 為例)](#-快速開始-以-vanilla-js-為例)
- [🛠️ Monorepo 開發指令](#️-monorepo-開發指令)
- [🗺️ 開發藍圖 (Roadmap)](#️-開發藍圖-roadmap)
- [🤝 鳴謝與原作者 (Credits)](#-鳴謝與原作者-credits)
- [📦 第三方資產與授權 (License)](#-第三方資產與授權-license)

---

## 📦 套件矩陣與版本導覽

本 Monorepo 依據不同使用場景與技術棧，規劃並拆分為多個獨立的子專案包。其中 **`vanilla-js` 為核心基礎版本（目前最完整）**，其他框架與型別版本均以此為藍本進行擴充與封裝：

| 套件目錄 | 套件名稱 / 類型 | 狀態 | 定位與特點說明 | 快速連結 |
| :--- | :--- | :---: | :--- | :---: |
| [`/vanilla-js`](./vanilla-js) | `ai-avatar-bot-vanilla-js` | 🟢 **最完整 (核心主力)** | **零框架依賴**的純 JavaScript 核心 SDK。具備多引擎架構、記憶壓縮、Auto-Continue、無頭模式 (Headless) 與 Vite/Webpack 離線構建插件。後續所有版本的基石。 | [📄 詳細文件](./vanilla-js/README.md) |
| [`/iframe`](./iframe) | `ai-avatar-bot-iframe` | 🟡 **經典重構** | **原版初步模組化重構**。保留原作者經典的 Iframe 與 `embed.js` 一行腳本嵌入設計，提供極致的 DOM / CSS 隔離與開箱即用的 Standalone Demo。 | [📄 詳細文件](./iframe/README.md) |
| [`/typescript`](./typescript) | `ai-avatar-bot-typescript` | 🚧 **進行中** | 以 `vanilla-js` 為基礎移植的 **TypeScript 型別安全版**。提供完整的型別定義檔 (`.d.ts`)、介面約束與更佳的 IDE 自動補全體驗。 | [📁 原始碼](./typescript) |
| [`/vue`](./vue) | `ai-avatar-bot-vue` | 🚧 **進行中** | 針對 **Vue 3** 封裝的專屬元件庫。提供 `<AiAvatarBot />` 元件與 `useAvatar` 組合式函式 (Composables)，支援響應式 Props 與自訂插槽。 | [📁 原始碼](./vue) |
| [`/react`](./react) | `ai-avatar-bot-react` | 🚧 **進行中** | 針對 **React 18 / 19** 封裝的專屬元件庫。提供 `<AiAvatarBot />` 元件與 `useAvatar` Hooks，完美融入 React 狀態週期與 JSX 渲染。 | [📁 原始碼](./react) |

---

## 🌟 核心架構與多引擎設計

整個 SDK 採用高度解耦的「多引擎驅動架構」，支援自訂替換底層實作或透過無頭模式（Headless Mode）接管介面：

```text
┌──────────────────────────────────────────────────────────────┐
│                       AiAvatarWidget                         │
├──────────────┬──────────────┬──────────────┬─────────────────┤
│ 🧠 Brain     │ 🗣️ Speech    │ 🎭 Skin      │ 🛠️ Tools        │
│  - AI Provider│  - Web STT   │  - Live2D 2D │  - Rule Route   │
│  - WebLLM     │  - Neural TTS│  - VRM 3D    │  - AI Function  │
│  - Memory/RAG │  - Lip Sync  │  - Emotions  │  - Confirmation │
├──────────────┴──────────────┴──────────────┴─────────────────┤
│ 🖥️ UI Engine (Dock, Chat Bubbles, History Panel, Mic Control) │
│ 🌐 i18n Engine (zh-TW, en-US, ja-JP, ko-KR...)               │
│ 📦 BaseStore (Reactive State Management)                     │
└──────────────────────────────────────────────────────────────┘
```

### 主要引擎職責：

1. 🧠 **大腦引擎 (Brain Engine)**：
   * **三層自動降級機制**：遠端 AI Provider (Ollama / OpenAI API) ➔ 本地 WebLLM (瀏覽器 WebGPU 端側模型) ➔ Bigram 關鍵字快速檢索。
   * **智慧上下文壓縮 (Context Compression)**：滑動窗口與滾動摘要策略，雙軌預算保護 WebGPU 顯存與 Token 上限。
   * **自動接續回答 (Auto-Continue)**：突破單次輸出 Token 限制，無縫接續長篇回覆。
2. 🗣️ **語音引擎 (Speech Engine)**：
   * 整合瀏覽器語音辨識 (STT) 與微軟神經網路語音合成 (TTS)。
   * 支援語音即時打斷 (Barge-in)、陪伴模式連續對話、音訊串流佇列與即時對嘴 (Lip Sync)。
3. 🎭 **外觀引擎 (Skin Engine)**：
   * 同時支援 2D (Live2D via Pixi.js) 與 3D (VRM via Three.js)。
   * 內建 8+ 種情緒手勢反應（喜悅、驚訝、思考、揮手、鞠躬等），並支援自訂模型載入與安全的拖曳換裝。
4. 🛠️ **工具管理器 (Tools Engine)**：
   * 標準化 Function Calling，支援「純前端規則秒配」、「AI 語意調用」與「雙軌混合模式」。
   * 具備 Human-in-the-loop 人工授權確認機制與 JSON Schema 參數驗證。
5. 🖥️ **介面引擎 (UI Engine)**：
   * 內建開箱即用的現代化懸浮視窗、對話氣泡與設定抽屜。
   * 支援 **Headless 模式**，允許開發者隱藏預設 UI，100% 自行以 Vue/React 刻劃介面。
6. 🌐 **多語系引擎 (I18n Engine)**：
   * 內建繁中 (`zh-TW`)、簡中 (`zh-CN`)、英文 (`en-US`)、日文 (`ja-JP`)、韓文 (`ko-KR`) 介面與提示詞字典。

---

## 🚀 快速開始 (以 Vanilla JS 為例)

目前最穩定且功能完整的版本為 `vanilla-js`。您可以直接透過 npm 安裝或引入模組使用：

```bash
# 安裝 Vanilla JS 核心套件
npm install ai-avatar-bot-vanilla-js
```

### 初始化範例：

```javascript
import { initAvatarBot } from 'ai-avatar-bot-vanilla-js';

// 初始化並掛載至指定容器
const widget = await initAvatarBot({
  container: document.getElementById('avatar-container'),
  
  // 模式設定：'assistant' (助理) 或 'companion' (陪伴連續對話)
  avatarMode: 'assistant',
  gender: 'female',
  
  // 大腦模型配置
  llmModel: 'Hermes-3-Llama-3.1-8B-q4f32_1-MLC',
  welcomeText: '你好！我是你的專屬 AI 虛擬助理。',

  // 上下文壓縮與顯存管理
  compression: {
    strategy: 'sliding-window',
    maxTurns: 6,
    maxTotalChars: 4000
  }
});
```

> 📖 **完整參數設定、API 介面與進階功能**：請參閱 [Vanilla JS 詳細說明文件](./vanilla-js/README.md)。

---

## 🛠️ Monorepo 開發指令

本專案採用 Yarn Workspaces 管理多套件：

```bash
# 啟動 Vanilla JS 開發伺服器（推薦：目前最完整）
yarn dev:js

# 啟動 TypeScript 版本開發伺服器
yarn dev:ts

# 啟動 Vue 3 版本開發伺服器
yarn dev:vue

# 啟動 React 版本開發伺服器
yarn dev:react

# 啟動 Iframe 經典版開發伺服器
yarn dev:iframe

# 建構所有套件產物
yarn build
```

---

## 🗺️ 開發藍圖 (Roadmap)

- [x] **階段一：Vanilla JS 核心重構與功能完備**
  - 多引擎模組化拆分（Brain, Speech, Skin, Tools, UI, i18n）
  - Live2D + VRM 雙外觀引擎整合
  - WebLLM + 雲端 AI Provider 智慧降級與自動接續
  - 記憶管理、安全 Tool Call 修剪與上下文壓縮管線
  - Vite / Webpack 零配置離線資產插件
- [ ] **階段二：TypeScript 嚴格型別化移植 (`/typescript`)**
  - 將 Vanilla JS 完整邏輯遷移至 TS，建立全型別定義檔
- [ ] **階段三：Vue 3 & React 官方封裝元件庫 (`/vue`, `/react`)**
  - 開發 `<AiAvatarBot />` 元件與響應式 Hooks / Composables
- [ ] **階段四：npm 公開發布與 CDN 生態**
  - 正式發布各版本至 npm 註冊表

---

## 🤝 鳴謝與原作者 (Credits)

本套件的架構與核心靈感源自於原作者 **[YuriCrystal](https://github.com/YuriCrystal)** 的開源專案 [ai-avatar-bot](https://github.com/YuriCrystal/ai-avatar-bot)。

感謝原作者在 Web 數位人互動、Live2D/VRM 整合、WebGPU 端側推論以及語音對嘴設計上的開創性探索與開源貢獻！

---

## 📦 第三方資產與授權 (License)

本專案自有原始程式碼採用 **[MIT License](LICENSE)** 開源。

> ⚠️ **重要提醒**：本專案引用之第三方運行時核心與模型資產（Live2D Cubism Core 專有授權、Haru/Natori 範例模型、初音未來/洛克人 VRM 角色模型等）各有其原作者與版權方之授權條款，**不包含於本專案 MIT 授權範圍內**。商業用途或公開散布前請務必詳閱 [第三方資產與授權條款說明](./vanilla-js/README.md#-第三方資產與授權請務必詳閱)。
