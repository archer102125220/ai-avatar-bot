# AI Avatar Bot (TypeScript)

[![npm version](https://img.shields.io/npm/v/ai-avatar-bot-typescript.svg)](https://www.npmjs.com/package/ai-avatar-bot-typescript)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

繁體中文 | [English](./README.md)

> 輕量、嚴格型別約束、模組化且零框架依賴的網頁端 AI 虛擬數位人（2D Live2D / 3D VRM）互動 SDK。

`ai-avatar-bot-typescript` 是 AI Avatar Bot 生態系中的 **100% 原生 TypeScript 嚴格實作版**。專為現代高可靠度企業級網頁應用設計，具備完整的編譯期型別安全（Compile-time Type Safety）、豐富的泛型介面約束（Generics）、極致流暢的 IDE 自動補全體驗，以及完整輸出的型別定義檔（`.d.ts`）。輕鬆在各前端專案中嵌入具備**語音互動（STT/TTS）**、**AI 大腦推論（雲端 AI / 端側 WebGPU WebLLM）**、**長對話記憶與上下文壓縮**、**外部工具調用（Function Calling）**以及**生動表情動作**的 2D/3D 虛擬數位人。

---

## 📑 目錄

- [🌟 核心特色與 TypeScript 優勢](#-核心特色與-typescript-優勢)
- [🏗️ 架構設計](#️-架構設計)
- [📦 安裝方式與依賴配置](#-安裝方式與依賴配置)
  - [透過套件管理器安裝](#透過套件管理器安裝)
  - [透過 CDN 引入 (ESM / 傳統 `<script>` 標籤)](#透過-cdn-引入-esm--傳統-script-標籤)
  - [模組化子路徑按需引入 (Subpath Imports)](#模組化子路徑按需引入-subpath-imports)
  - [Peer Dependencies 依賴配置與輕量化最佳實踐](#peer-dependencies-依賴配置與輕量化最佳實踐)
- [🚀 快速開始 (TypeScript 範例)](#-快速開始-typescript-範例)
- [🗂️ 靜態模型資產與 CLI 一鍵同步 (Asset Sync CLI)](#️-靜態模型資產與-cli-一鍵同步-asset-sync-cli)
- [🔌 前端與全端框架外掛整合 (Framework Plugins)](#-前端與全端框架外掛整合-framework-plugins)
  - [1. Vite 專案配置 (Vue 3, Svelte, Vite React)](#1-vite-專案配置-vue-3-svelte-vite-react)
  - [2. Next.js 專案配置 (App Router / Pages Router)](#2-nextjs-專案配置-app-router--pages-router)
  - [3. Nuxt 3 專案配置 (Nuxt Module)](#3-nuxt-3-專案配置-nuxt-module)
  - [4. Webpack 專案配置 (Create React App, Vue CLI, Webpack 5)](#4-webpack-專案配置-create-react-app-vue-cli-webpack-5)
  - [5. AnalogJS 專案配置 (Angular Meta-Framework)](#5-analogjs-專案配置-angular-meta-framework)
  - [6. Node.js 路徑輔助工具](#6-nodejs-路徑輔助工具)
- [⚙️ 詳細設定選項 (AvatarBotOptions)](#️-詳細設定選項-avatarbotoptions)
- [🧠 進階功能指南](#-進階功能指南)
  - [1. 大腦引擎與三層降級推論 (型別化工廠)](#1-大腦引擎與三層降級推論-型別化工廠)
  - [2. 自動接續回答機制 (Auto-Continue Response)](#2-自動接續回答機制-auto-continue-response)
  - [3. [實驗性 Experimental] AI 模型推論過程 (Reasoning / Thinking) 與 WebLLM OOM 降級](#3-實驗性-experimental-ai-模型推論過程-reasoning--thinking-與-webllm-oom-降級架構)
  - [4. 記憶管理、資料結構與自訂儲存轉接器](#4-記憶管理資料結構與自訂儲存轉接器)
  - [5. Function Calling 與自訂工具 (Tools Engine)](#5-function-calling-與自訂工具-tools-engine)
  - [6. 2D (Live2D) 與 3D (VRM) 雙外觀引擎](#6-2d-live2d-與-3d-vrm-雙外觀引擎)
  - [7. 語音辨識與神經語音 (Speech Engine)](#7-語音辨識與神經語音-speech-engine)
  - [8. 無頭模式 (Headless Mode) 與自訂 UI](#8-無頭模式-headless-mode-與自訂-ui)
- [📐 導出 TypeScript 型別速查表](#-導出-typescript-型別速查表)
- [📚 實例 API 與方法 (AiAvatarWidget)](#-實例-api-與方法-aiavatarwidget)
- [🌐 多語系支援 (i18n)](#-多語系支援-i18n)
- [📦 第三方資產與授權](#-第三方資產與授權請務必詳閱)
- [🧪 測試體系與品質保證 (Testing)](#-測試體系與品質保證-testing)
- [⚠️ 風險與限制揭露](#️-風險與限制揭露)
- [🔐 隱私與資料流向](#-隱私與資料流向)
- [❓ 常見問題 (FAQ)](#-常見問題-faq)
- [🤝 鳴謝與原作者 (Credits)](#-鳴謝與原作者-credits)
- [📝 授權條款 (License)](#-授權條款-license)

---

## 🌟 核心特色與 TypeScript 優勢

* 🔷 **100% 純原生 TypeScript 與零 `any` 規範**：
  * 基於現代 TypeScript（ES2022+ / Bundler 模組解析）從頭構建。
  * 完整導出高精準度 `.d.ts` 定義檔與 JSDoc 詳細註釋，在 VS Code、WebStorm、Cursor 中提供最直接的型別提示與介面說明。
* 🧠 **多層次 AI 大腦 (Brain Engine)**：
  * 支援雲端 AI 提供者（Ollama、vLLM、OpenAI 相容 API），具備專屬強型別工廠勾子（`AiProviderFetchSettingFactory`, `AiProviderFetchPayloadFactory`）。
  * 支援瀏覽器端端側推論（基於 WebGPU 的 WebLLM，完全離線、保護隱私）。
  * 內建智慧三層自動降級機制（AI Provider ➔ WebLLM ➔ 關鍵字檢索後備）。
* 🗣️ **全雙工/連續對話語音系統 (Speech Engine)**：
  * 整合語音辨識 (STT) 與微軟神經網路語音合成 (TTS)，具備完整的生命週期型別。
  * 支援即時語音打斷 (Barge-in)、陪伴模式連續對話、音訊串流佇列與自動對嘴 (Lip Sync)。
* 🎭 **2D / 3D 雙渲染外觀 (Skin Engine)**：
  * 支援 Live2D (Pixi.js) 與 VRM 3D 模型 (Three.js)，提供清晰的空間幾何與變形介面（`Vector3Coord`, `Point2D`, `Vector3Scale`）。
  * 內建 8+ 種情緒反應與肢體手勢（喜悅、驚訝、思考、悲傷、揮手、鞠躬、放鬆等），支援運行時 VRM 拖曳換裝。
* 🛠️ **強型別工具管理器 (Tools Engine)**：
  * 嚴格的 `ToolDefinition` 介面規範與 JSON Schema 參數驗證。
  * 支援 3 種路由模式（`'client'`, `'ai'`, `'hybrid'`），並具備 Human-in-the-loop 人工授權確認機制。
* 💾 **智慧上下文壓縮與對話記憶 (Memory & Compression)**：
  * 滑動窗口 (Sliding Window) 與滾動摘要 (Rolling Summary) 策略，搭配端側/雲端階層式雙軌預算。
  * 強型別 `MemoryData` 結構與可擴充的 `MemoryAdapter` 介面，方便對接 IndexedDB 或後端資料庫。
* 🖥️ **零框架依賴與無頭架構 (Headless Ready)**：
  * 架構解耦，支援 100% Headless 模式，能無縫整合至 React 18/19、Vue 3、Svelte 5 或 Angular 專案中。

---

## 🏗️ 架構設計

```text
┌──────────────────────────────────────────────────────────────┐
│                    AiAvatarWidget (TS)                       │
├──────────────┬──────────────┬──────────────┬─────────────────┤
│ 🧠 Brain     │ 🗣️ Speech    │ 🎭 Skin      │ 🛠️ Tools        │
│  - AI Provider│  - Web STT   │  - Live2D 2D │  - Rule Route   │
│  - WebLLM     │  - Neural TTS│  - VRM 3D    │  - AI Function  │
│  - Memory/RAG │  - Lip Sync  │  - Emotions  │  - Confirmation │
├──────────────┴──────────────┴──────────────┴─────────────────┤
│ 🖥️ UI Engine (Dock, Chat Bubbles, History Panel, Mic Control) │
│ 🌐 i18n Engine (zh-TW, en-US, ja-JP, ko-KR...)               │
│ 📦 BaseStore<T> (強型別響應式狀態管理)                        │
└──────────────────────────────────────────────────────────────┘
```

---

## 📦 安裝方式與依賴配置

### 透過套件管理器安裝

```bash
# yarn (推薦)
yarn add ai-avatar-bot-typescript

# npm
npm install ai-avatar-bot-typescript

# pnpm
pnpm add ai-avatar-bot-typescript
```

### 透過 CDN 引入 (ESM / 傳統 `<script>` 標籤)

本套件提供雙打包架構，不僅完整支援現代前端打包工具，也兼具 CDN 開箱即用：

#### 1. ES Module CDN (`+esm`)
```html
<!-- 引入樣式 -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/ai-avatar-bot-typescript/dist/ai-avatar-bot.css" />

<!-- 透過現代瀏覽器原生 import 使用 -->
<script type="module">
  import { initAvatarBot } from 'https://cdn.jsdelivr.net/npm/ai-avatar-bot-typescript/+esm';
  // 或使用 unpkg: https://unpkg.com/ai-avatar-bot-typescript?module
</script>
```

#### 2. 傳統 `<script>` 標籤 (IIFE，掛載於 `window.AiAvatarBot`)
```html
<!-- 引入樣式 -->
<link rel="stylesheet" href="https://unpkg.com/ai-avatar-bot-typescript/dist/ai-avatar-bot.css" />

<!-- 引入獨立 IIFE Bundle -->
<script src="https://unpkg.com/ai-avatar-bot-typescript/dist/ai-avatar-bot.iife.js"></script>
<script>
  // 所有導出方法皆自動掛載於全域物件 window.AiAvatarBot
  const { initAvatarBot, GENDER_MAP, AVATAR_MODE_MAP } = window.AiAvatarBot;
</script>
```

---

### 模組化子路徑按需引入 (Subpath Imports)

`ai-avatar-bot-typescript` 支援現代 `package.json` 的 `exports` 子路徑映射，允許您只載入所需模組並享有獨立的 TypeScript 宣告檔：

```typescript
// 1. 全量整合入口 (包含預設 UI 與所有控制器，支援 alias: createAvatarBot)
import { initAvatarBot, createAvatarBot } from 'ai-avatar-bot-typescript';
import 'ai-avatar-bot-typescript/style.css';

// 2. 僅引入大腦與記憶子系統 (支援自訂 LLM、記憶管理與雙軌推論串流解析器)
import { 
  initBrainEngine, 
  initMemory, 
  initWebLLM, 
  initAiProvider, 
  createStreamParser, 
  type BrainEngine, 
  type MemoryAdapter, 
  type MemoryData,
  type StreamParserInstance 
} from 'ai-avatar-bot-typescript/brain';

// 3. 僅引入語音引擎 (STT 語音辨識 / Neural TTS / 即時對嘴)
import { 
  initSpeechEngine, 
  initDefaultSTTEngine, 
  initDefaultTTSEngine, 
  drainSentences,
  type SpeechEngine, 
  type STTEngine, 
  type TTSEngine 
} from 'ai-avatar-bot-typescript/speech';

// 4. 僅引入 2D/3D 外觀渲染引擎 (Live2D / VRM)
import { 
  initSkinEngine, 
  type SkinEngine, 
  type Skin2DConfig, 
  type Skin3DConfig 
} from 'ai-avatar-bot-typescript/skin';

// 5. 僅引入工具管理器 (Function Calling & Router)
import { 
  initToolsEngine, 
  type ToolsEngine, 
  type ToolDefinition 
} from 'ai-avatar-bot-typescript/tools';

// 6. 僅引入多語系模組
import { initI18nEngine, type I18nEngine } from 'ai-avatar-bot-typescript/i18n';

// 7. 僅引入常數與對應表
import { 
  GENDER_MAP, 
  AVATAR_MODE_MAP, 
  REASONING_MODE_MAP, 
  EMOTION_TARGET_MAP, 
  STATE_MAP 
} from 'ai-avatar-bot-typescript/constants';

// 8. 僅引入型別定義
import type { 
  AvatarBotOptions, 
  AiAvatarWidget, 
  ReasoningOptions, 
  ToolDefinition 
} from 'ai-avatar-bot-typescript/types';
```

---

### Peer Dependencies 依賴配置與輕量化最佳實踐

為了防止外部專案（例如已有自帶 Three.js 或自定義 WebGPU 渲染管線的專案）發生 **Three.js 多重實例衝突 (Multiple instances of Three.js)**，並將核心發布體積由 7.2MB 大幅壓縮至 **223KB (-96.9%)**，大型渲染引擎與模型庫均已宣告為**可選的 `peerDependencies`**。

請依照專案實際需求安裝對應渲染引擎：

```bash
# 🎯 情境 A：若需要 3D (VRM) 渲染
yarn add three @pixiv/three-vrm @pixiv/three-vrm-animation

# 🎯 情境 B：若需要 2D (Live2D) 渲染
yarn add pixi.js pixi-live2d-display

# 🎯 情境 C：若需要瀏覽器端端側推論 (WebLLM)
yarn add @mlc-ai/web-llm

# 🎯 情境 D：全功能齊備
yarn add three @pixiv/three-vrm @pixiv/three-vrm-animation pixi.js pixi-live2d-display @mlc-ai/web-llm
```

> [!TIP]
> 如果您的應用場景僅使用「純雲端 AI 提供者（如 Ollama / OpenAI API）」與「純 2D Live2D」，您完全不需要安裝 `three` 或 `@mlc-ai/web-llm`，打包產物將維持最輕量狀態！

---

## 🚀 快速開始 (TypeScript 範例)

### 1. 建立 HTML 掛載容器

```html
<!DOCTYPE html>
<html lang="zh-TW">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Avatar Bot TS Demo</title>
    <style>
      #avatar-container {
        width: 100vw;
        height: 100vh;
        overflow: hidden;
        position: relative;
      }
    </style>
  </head>
  <body>
    <div id="avatar-container"></div>
    <script type="module" src="./src/main.ts"></script>
  </body>
</html>
```

### 2. 在 TypeScript 中初始化 Avatar Bot

```typescript
import { 
  initAvatarBot, 
  type AvatarBotOptions, 
  type AiAvatarWidget,
  type KnowledgeEntry 
} from 'ai-avatar-bot-typescript';
import 'ai-avatar-bot-typescript/style.css';

// 1. 定義型別化的檢索知識庫
const knowledgeBase: KnowledgeEntry[] = [
  {
    q: '你們的服務時間是什麼時候？',
    kw: '營業時間 服務時間 上班時間',
    a: '我們的在線服務時間為週一至週五 09:00 至 18:00。'
  }
];

// 2. 嚴格型別約束的配置選項
const options: AvatarBotOptions = {
  container: document.getElementById('avatar-container'),
  
  // 角色模式與語音配置
  avatarMode: 'assistant',
  gender: 'female',
  locale: 'zh-TW',
  
  // 大腦引擎配置（以瀏覽器端 WebLLM 模型為例）
  llmModel: 'Hermes-3-Llama-3.1-8B-q4f32_1-MLC',
  welcomeText: '你好！我是以 TypeScript 重構的專屬 AI 虛擬助理。',
  knowledge: knowledgeBase,
  
  // 上下文壓縮與記憶預算
  enableMemory: true,
  compression: {
    strategy: 'sliding-window',
    maxTurns: 6,
    maxTotalChars: 4000
  },

  // 生命週期回呼函式
  onReady: (widget: AiAvatarWidget) => {
    console.log('AI Avatar Bot 初始化完成！', widget);
  },
  onSpeaking: (text: string) => {
    console.log('虛擬人正在說話：', text);
  },
  onError: (error: Error) => {
    console.error('發生運行時錯誤：', error);
  }
};

// 3. 初始化掛載並取得 Controller 實例
const widget: AiAvatarWidget = await initAvatarBot(options);
```

---

## 🗂️ 靜態模型資產與 CLI 一鍵同步 (Asset Sync CLI)

本套件隨附完整的 2D (Live2D) 與 3D (VRM) 實體靜態模型資產（位於套件內 `avatar-skin/` 目錄下）。

為了讓前端專案能直接以本機 HTTP 伺服器讀取模型資產，無需手動尋找套件目錄或繁瑣拷貝，本套件內建 **全自動 CLI 同步工具**：

```bash
# 🎯 自動偵測當前專案框架結構（Next.js / Nuxt / Angular / Vite）並同步至目標 public/ 目錄
npx ai-avatar-bot sync

# 🎯 若使用 Yarn
yarn ai-avatar-bot sync

# 🎯 僅模擬執行，不實際寫入（檢驗即將複製的檔案清單）
npx ai-avatar-bot sync --dry-run

# 🎯 手動指定輸出目錄（例如自訂 assets 資料夾）
npx ai-avatar-bot sync --out src/assets/avatar-skin

# 🎯 若目標檔案已存在則略過不覆蓋
npx ai-avatar-bot sync --no-overwrite
```

### 框架自動偵測規則：
* **Angular 專案** (`angular.json`) ➔ 自動同步至 `src/assets/avatar-skin`
* **Next.js 專案** (`next.config.*`) ➔ 自動同步至 `public/avatar-skin`
* **Nuxt 專案** (`nuxt.config.*`) ➔ 自動同步至 `public/avatar-skin`
* **一般前端專案** (含有 `public/` 目錄) ➔ 自動同步至 `public/avatar-skin`

---

## 🔌 前端與全端框架外掛整合 (Framework Plugins)

除了手動執行 CLI 同步外，本套件提供一系列具備原生 TypeScript 強型別支援的各框架整合外掛。在本地開發時實現**零拷貝直接串流 (Zero-Copy Proxy)**，在生產構建時**自動拷貝資產**：

### 1. Vite 專案配置 (Vue 3, Svelte, Vite React)

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { avatarBotVitePlugin } from 'ai-avatar-bot-typescript/vite';

export default defineConfig({
  plugins: [
    avatarBotVitePlugin() // 開發期自動攔截 /avatar-skin/*，構建時自動複製至 dist/avatar-skin
  ]
});
```

### 2. Next.js 專案配置 (App Router / Pages Router)

```typescript
// next.config.mjs 或 next.config.ts
import { withAvatarBot } from 'ai-avatar-bot-typescript/next';

const nextConfig = {
  // 原有的 Next.js 設定
};

export default withAvatarBot(nextConfig);
```
> [!NOTE]
> `withAvatarBot` 同時相容於 **Turbopack** (`next dev --turbo`) 與傳統 **Webpack** 構建模式，啟動時會自動確保模型資產同步至 `public/avatar-skin`。

### 3. Nuxt 3 專案配置 (Nuxt Module)

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: [
    'ai-avatar-bot-typescript/nuxt' // 基於 Nitro 引擎，開發期 0 拷貝串流，生產構建自動複製
  ]
});
```

### 4. Webpack 專案配置 (Create React App, Vue CLI, Webpack 5)

```typescript
// webpack.config.js
import { AvatarBotWebpackPlugin } from 'ai-avatar-bot-typescript/webpack';

export default {
  plugins: [
    new AvatarBotWebpackPlugin() // 自動配置 DevServer 中間件與構建資產複製
  ]
};
```

### 5. AnalogJS 專案配置 (Angular Meta-Framework)

```typescript
// vite.config.ts (AnalogJS)
import { defineConfig } from 'vite';
import analog from '@analogjs/platform';
import { avatarBotAnalogPlugin, getAnalogNitroConfig } from 'ai-avatar-bot-typescript/analog';

export default defineConfig(() => ({
  plugins: [
    analog({
      nitro: getAnalogNitroConfig()
    }),
    avatarBotAnalogPlugin()
  ]
}));
```

### 6. Node.js 路徑輔助工具

如果您的專案有自定義的部署腳本或 CI/CD 管線，可直接調用 Node.js 輔助函式：

```typescript
import { getAvatarSkinPath, copyAvatarSkin } from 'ai-avatar-bot-typescript/node';

// 取得本套件 avatar-skin 模型庫的實體絕對路徑
const skinPath: string = getAvatarSkinPath();
console.log('Avatar Skin 實體路徑：', skinPath);

// 程式化複製資產至指定路徑
copyAvatarSkin('dist/client/avatar-skin', { overwrite: true });
```

---

## ⚙️ 詳細設定選項 (AvatarBotOptions)

所有選項皆收錄於 `AvatarBotOptions` 介面中：

### 一般與 UI 介面設定

| 選項名稱 | 型別定義 | 預設值 | 說明 |
| :--- | :--- | :--- | :--- |
| `container` | `HTMLElement \| null` | `null` | **必填**。掛載虛擬人的 DOM 容器元素。 |
| `avatarMode` | `AvatarMode` (`'assistant' \| 'companion' \| string`) | `'assistant'` | 人設模式：`'assistant'`（助理）或 `'companion'`（陪伴）。 |
| `gender` | `Gender` (`'female' \| 'male' \| string`) | `'female'` | 預設角色性別。 |
| `locale` | `string` | `'zh-TW'` | UI 介面與語音合成語系（`'zh-TW'`, `'en-US'`, `'ja-JP'`, `'ko-KR'`）。 |
| `i18nMessages` | `Record<string, Record<string, string>>` | `{}` | 自訂多語系覆蓋文字字典。 |
| `isMinimal` | `boolean` | `false` | 是否以極簡/縮小懸浮球模式啟動。 |
| `isIframe` | `boolean` | `false` | 是否運行於 Iframe 隔離環境。 |

### 大腦引擎與 AI Provider 設定

| 選項名稱 | 型別定義 | 預設值 | 說明 |
| :--- | :--- | :--- | :--- |
| `enableAiProvider` | `boolean` | `false` | 是否啟用遠端雲端 AI 服務提供者（Ollama / 自建 API）。 |
| `aiProviderBaseUrl` | `string` | `''` | 遠端 AI 伺服器 API 基礎端點。 |
| `aiProviderPingUrl` | `string` | `undefined` | 自訂遠端 AI 伺服器探活健康檢查端點。若未提供則依據 `baseUrl` 自動推導（Ollama 自動使用 `/api/tags`，OpenAI 相容端點自動使用 `/models`）。 |
| `aiProviderAutoPing` | `AiProviderPingStrategy` (`'eager' \| 'lazy' \| 'manual' \| false`) | `'eager'` | AI Provider 初始化探活策略：`'eager'`（背景非阻塞探活，首頁秒開不卡頓）、`'lazy'`（延遲至發送首個問題時探活）、`'manual'` 或 `false`（完全手動探活）。 |
| `aiProviderModel` | `string` | `'hermes3:latest'` | 遠端 AI 模型名稱識別碼（預設為具備完整工具調用與推論之旗艦模型）。 |
| `aiProviderHeaders` | `Record<string, string>` | `undefined` | 隨所有 AI Provider 請求發送之自訂 HTTP 標頭（例如 `Authorization`、`x-api-key`、代理或租戶辨識標頭等）。 |
| `aiProviderIsStream` | `boolean` | `true` | 是否啟用 AI Provider 串流輸出模式。 |
| `aiProviderMaxTokens` | `number` | `2048` | 遠端 AI 單次生成 Token 最大上限。 |
| `aiProviderCreateFetchSetting` | `AiProviderFetchSettingFactory \| RequestInit` | `undefined` | 自訂 Fetch Header / RequestInit 配置工廠函式。 |
| `aiProviderCreateFetchPayload` | `AiProviderFetchPayloadFactory \| Record<string, unknown> \| BodyInit` | `undefined` | 自訂 JSON 請求負載生成工廠函式。 |
| `aiProviderResponseFormat` | `string \| Record<string, unknown>` | `undefined` | 遠端 AI 回應解析格式（`'sse'`, `'json'` 或自訂解析物件）。 |
| `aiProviderExtractToolCalls` | `AiProviderToolCallExtractor` | `undefined` | 自串流 Chunk 中抽取 Tool Call 的型別化解析勾子。 |
| `llmModel` | `string` | `'Hermes-3-Llama-3.1-8B-q4f32_1-MLC'` | 瀏覽器端 WebLLM 主模型名稱（預設為旗艦 8B 模型）。 |
| `llmFallbackModel` | `string \| null \| false` | `'Qwen2.5-1.5B-Instruct-q4f16_1-MLC'` | WebGPU 記憶體不足（OOM）時的備選保底模型。設為 `null` 則關閉降級。 |
| `enableOomFallback` | `boolean` | `true` | 是否啟用 WebGPU 顯存不足時的自動降級機制。 |
| `reasoning` | `ReasoningOptions` | `{ mode: 'auto', showThinkingInBubble: true }` | ⚠️ **[實驗性 Experimental]** AI 模型推論思考過程設定（`mode`: `'auto' \| 'always' \| 'never'`, `showThinkingInBubble`: `boolean`, `promptDirective?`: `string \| ((locale: string) => string) \| false`）。推論輸出穩定度目前尚在驗證中。 |
| `llmMaxTokens` | `number` | `1024` | WebLLM 模型單次回應 Token 最大限制。 |
| `preloadWebLLM` | `boolean` | `false` | 是否在初始化時即刻預載 WebLLM 權重。 |
| `autoFallbackWebLLM` | `boolean` | `true` | 當遠端 AI 失敗時是否自動降級至本地 WebLLM。 |
| `enableAutoContinue` | `boolean` | `false` | 是否在回答被 Token 截斷時自動接續生成。 |
| `maxAutoContinuations` | `number` | `3` | 最大自動接續回合次數（防止無限迴圈）。 |
| `autoContinueMode` | `AutoContinueMode` (`'stream' \| 'buffered'`) | `'stream'` | 接續輸出模式（串流邊講邊播或緩衝全收）。 |
| `autoContinuePrompt` | `AutoContinuePromptResolver \| null` | `null` | 自訂接續提示詞字串或動態解析函式。 |
| `knowledge` | `KnowledgeEntry[] \| Record<string, unknown> \| string \| null` | `null` | 助理模式預載知識庫陣列。 |
| `companionKnowledge` | `KnowledgeEntry[] \| Record<string, unknown> \| string \| null` | `null` | 陪伴模式預載知識庫陣列。 |
| `modes` | `Record<string, unknown>` | `{}` | 聲明式自訂模式註冊表。 |

### 記憶管理與上下文壓縮

| 選項名稱 | 型別定義 | 預設值 | 說明 |
| :--- | :--- | :--- | :--- |
| `enableMemory` | `boolean` | `true` | 是否啟用跨對話輪次的記憶管理。 |
| `maxHistoryTurns` | `number` | `6` | 保留之歷史對話輪數上限（1 輪 = 1 使用者訊息 + 1 AI 回應）。 |
| `memoryKey` | `string` | `'avatar-widget-memory'` | 本地端儲存鍵名。 |
| `memoryAdapter` | `MemoryAdapter` | `null` | 實作 `MemoryAdapter` 介面的自訂儲存轉接器實例。 |
| `compression` | `BrainCompressionOptions` | `{}` | 上下文壓縮策略配置（`strategy`, `maxTurns`, `maxTotalChars`, `webLlm`, `aiProvider`）。 |
| `systemContextTemplate` | `DynamicTextOrResolver` | `undefined` | 助理模式系統提示詞範本或動態解析器。 |
| `companionSystemContextTemplate` | `DynamicTextOrResolver` | `undefined` | 陪伴模式系統提示詞範本或動態解析器。 |
| `ragTemplate` | `DynamicTextOrResolver` | `undefined` | RAG 參考資料提示詞範本。 |
| `customContext` | `Record<string, unknown>` | `undefined` | 附加注入至提示詞的自訂上下文物件。 |
| `customEngines` | `CustomEnginesConfig` | `{}` | 自訂子引擎依賴注入字典（`{ skin?, tools?, brain?, stt?, tts?, i18n? }`）。 |

### 語音與外觀渲染

| 選項名稱 | 型別定義 | 預設值 | 說明 |
| :--- | :--- | :--- | :--- |
| `ttsEndpoint` | `string` | `'api/tts'` | 自建神經網路 TTS 後端 API 端點。 |
| `neuralVoice` | `string` | `''` | 指定之神經語音模型識別碼。 |
| `startMode` | `EngineMode` (`'2d' \| '3d'`) | `'2d'` | 初始外觀渲染引擎：`'2d'` (Live2D) 或 `'3d'` (VRM)。 |
| `fitMode` | `FitMode` (`'half' \| 'full'`) | `'full'` | 鏡頭構圖模式：`'half'` (半身) 或 `'full'` (全身)。 |
| `skin2d` | `Skin2DConfig` | `{}` | 2D Live2D 縮放、位移與錨點配置。 |
| `zoom` / `offsetX` / `offsetY` | `number` | 預設值 | `skin2d` 的快捷別名。 |
| `anchor` | `Point2D` | `{ x: 0.5, y: 1.0 }` | 2D 模型的錨點座標。 |
| `modelUrl` | `string` | 內建預設 | 2D Live2D `.model3.json` 檔案路徑或 URL。 |
| `skin3d` | `Skin3DConfig` | `{}` | 3D VRM 鏡頭、空間變換與注視配置。 |
| `camera` | `Skin3DCameraConfig` | 預設設定 | 3D 鏡頭參數（`fov`, `position`, `lookAt`）。 |
| `modelTransform` | `Skin3DModelConfig` | 預設設定 | 3D 模型空間變換（`position`, `scale`, `rotation`）。 |
| `pointerLook` | `boolean` | `true` | 是否啟用 3D 眼神注視隨滑鼠游標追蹤。 |
| `vrmUrl` | `string` | 內建預設 | 3D VRM `.vrm` 模型檔案路徑或 URL。 |
| `enableModelDrop` | `boolean` | `false` | 是否允許拖曳 `.vrm` 檔案換裝（基於安全考量預設關閉）。 |
| `enableEngineToggle` | `boolean` | `true` | 當同時具備 2D 與 3D 模型時是否顯示切換按鈕。 |
| `gesture` | `SkinUnifiedGestureHandler` | `undefined` | 全域統一動作攔截器 `(engine, gestureName, context) => Promise<void> \| void`，可自訂動作邏輯或委派至 `context.gesture2D` / `context.gesture3D`。 |
| `tapGestures` | `string[] \| Skin3DActionItem[]` | `['goodbye', 'bow', 'waiting']` (3D) | 點擊虛擬人時隨機播放的動作清單。3D 與 2D 皆可作為點擊動作來源，亦支援物件設定如 `{ action: 'waiting', pointerLook: false }`。 |
| `tapMotions` | `string[]` | `undefined` | Live2D 2D 專屬的隨機點擊動作群組名稱陣列。 |
| `motionMap` | `Record<string, string>` | `{}` | Live2D 2D 自訂動作對照表（例如 `{ wave: 'SpecialWave' }`）。 |
| `expressionMap` | `Record<string, string>` | `{}` | 2D/3D 通用自訂語意表情對照表（例如 `{ happy: 'MyCustomSmile' }`）。 |

### 建議問題與問候語設定

| 選項名稱 | 型別定義 | 預設值 | 說明 |
| :--- | :--- | :--- | :--- |
| `suggestedQuestions` | `LocalizableOrResolver<string[]>` | 內建預設 | 推薦問題清單（支援字串陣列、多語系字典或動態函式）。 |
| `companionSuggestedQuestions` | `LocalizableOrResolver<string[]>` | 內建預設 | 陪伴模式專屬推薦問題清單。 |
| `assistantSuggestedQuestions` | `LocalizableOrResolver<string[]>` | 內建預設 | 助理模式專屬推薦問題清單。 |
| `suggestedTitle` | `LocalizableOrResolver<string>` | 內建預設 | 推薦問題區塊的標題文字。 |
| `companionSuggestedTitle` | `LocalizableOrResolver<string>` | 內建預設 | 陪伴模式推薦問題區塊標題文字。 |
| `assistantSuggestedTitle` | `LocalizableOrResolver<string>` | 內建預設 | 助理模式推薦問題區塊標題文字。 |
| `greeting` / `welcomeText` | `string` | 內建預設 | 點擊問候語音與初次啟動歡迎訊息。 |

### 工具擴充與外掛

| 選項名稱 | 型別定義 | 預設值 | 說明 |
| :--- | :--- | :--- | :--- |
| `tools` / `hostTools` | `ToolDefinition[]` | `[]` | 註冊至 Function Calling 引擎的型別化工具清單。 |
| `enableEmotionTools` | `boolean` | `true` | 是否啟用內建的情緒手勢動作工具外掛。 |
| `confirmationTimeoutMs` | `number` | `60000` | 使用者授權確認對話框的超時毫秒數。 |

### 生命週期事件回呼

| 回呼函式 | 型別簽章 | 觸發時機 |
| :--- | :--- | :--- |
| `onReady` | `(widget: AiAvatarWidget) => void` | 所有子引擎初始化完成且掛載於 DOM 後觸發。 |
| `onSpeaking` | `(text: string) => void` | 語音合成開始發聲時觸發。 |
| `onSpeakingEnd` | `() => void` | 語音播放結束時觸發。 |
| `onStreamChunk` | `(chunkDelta: string, rawChunk?: unknown) => void` | 正式回答文字串流增量抵達時觸發（透傳底層原生 Chunk）。 |
| `onStreamEnd` | `(fullText: string) => void` | 大腦 LLM 串流生成文字完全結束時觸發。 |
| `onReasoningStart` | `(info: ReasoningStartInfo) => void` | ⚠️ **[實驗性 Experimental]** AI 模型推論思考過程開始時觸發（靜音軌）。 |
| `onReasoningChunk` | `(info: ReasoningChunkInfo, chunkDelta: string, accumulated: string, rawChunk?: unknown) => void` | ⚠️ **[實驗性 Experimental]** 推論串流增量抵達時觸發。 |
| `onReasoningEnd` | `(info: ReasoningEndInfo, fullReasoning: string, durationMs: number) => void` | ⚠️ **[實驗性 Experimental]** 推論過程完全結束時觸發。 |
| `onLlmOomFallback` | `(info: LlmOomFallbackInfo, primaryModel: string, fallbackModel: string, error: unknown) => void` | 瀏覽器 WebLLM 發生 WebGPU 顯存不足並自動降級模型時觸發。 |
| `onAutoContinueStart` | `(info: AutoContinueStartInfo) => void` | 自動接續回答開始時觸發。 |
| `onAutoContinueWait` | `(info: AutoContinueStartInfo) => void` | 等待接續串流的空檔（切換至思考姿態）觸發。 |
| `onAutoContinueResume` | `(info: AutoContinueResumeInfo) => void` | 接續串流抵達並恢復說話時觸發。 |
| `onAutoContinueEnd` | `(info: AutoContinueEndInfo) => void` | 接續迴圈完全結束時觸發。 |
| `onAddChatMessage` | `(role: ChatRole, text: string) => void` | 新對話訊息加入面板時觸發。 |
| `onMicStateChanged` | `(isListening: boolean) => void` | 麥克風錄音狀態切換時觸發。 |
| `onToolCall` | `(toolCall: ParsedToolCall) => void` | 工具被調用執行時觸發。 |
| `onToolNotFound` | `(info: ToolNotFoundErrorInfo, widget: AiAvatarWidget) => unknown` | 模型調用未註冊工具時觸發（可回傳自訂訊息給模型）。 |
| `onToolError` | `(info: ToolErrorInfo, widget: AiAvatarWidget) => unknown` | 工具執行發生例外時觸發（可回傳自訂錯誤給模型）。 |
| `onBrainFallback` | `(fromEngine: string, toEngine: string, error: unknown) => void` | 大腦引擎在層級之間降級切換時觸發。 |
| `onAiProviderConnecting` | `(...args: unknown[]) => void` | AI 伺服器發起連線探活時觸發。 |
| `onAiProviderConnected` | `(response: unknown, fetchSetting?: unknown, aiProvider?: unknown, ...args: unknown[]) => void` | AI 伺服器探活成功並確認連線時觸發。 |
| `onAiProviderError` | `(error: Error, ...args: unknown[]) => void` | AI 伺服器探活失敗或連線異常時觸發。 |
| `onError` | `(error: Error, widget: AiAvatarWidget) => void` | 發生未預期的運行時錯誤時觸發。 |

---

## 🧠 進階功能指南

### 1. 大腦引擎與三層降級推論 (型別化工廠)

大腦引擎具備三層高可用設計，並提供專屬 TypeScript 工廠函式介面：

```typescript
import { 
  initAvatarBot, 
  type AiProviderFetchSettingFactory, 
  type AiProviderFetchPayloadFactory,
  type LLMMessage 
} from 'ai-avatar-bot-typescript';

// 1. 強型別的 Ollama Payload 生成工廠
const createOllamaPayload: AiProviderFetchPayloadFactory = (
  messages: LLMMessage[] | Array<Record<string, unknown>>,
  tools,
  model,
  defaultPayload
) => {
  return JSON.stringify({
    model: 'qwen2.5:latest',
    messages,
    stream: true
  });
};

// 2. 強型別的 Fetch 配置工廠
const createOllamaFetchSetting: AiProviderFetchSettingFactory = (
  messages,
  model,
  defaultSetting
) => {
  return {
    ...defaultSetting,
    headers: {
      'Content-Type': 'application/json'
    }
  };
};

const widget = await initAvatarBot({
  container: document.getElementById('avatar-container'),
  enableAiProvider: true,
  aiProviderBaseUrl: 'http://localhost:11434/api/chat',
  aiProviderModel: 'qwen2.5:latest',
  aiProviderCreateFetchPayload: createOllamaPayload,
  aiProviderCreateFetchSetting: createOllamaFetchSetting,
  autoFallbackWebLLM: true
});
```

#### 1.1 AI 伺服器健康探活與響應式連線狀態管理 (模式 A)

SDK 採用 **模式 A（方法調用 + Store 響應式廣播）** 架構，具備非阻塞連線、智慧端點推導與完整的單向資料流狀態同步：

- **非阻塞背景探活 (首頁秒開)**：預設 `aiProviderAutoPing: 'eager'` 會在背景非同步執行探活，初始化函式立即返回，避免首頁渲染被遠端伺服器網路延遲卡住。
- **智慧端點推導**：若未特別指定 `aiProviderPingUrl`，系統會依 `baseUrl` 自動推導（Ollama 自動使用 `/api/tags`，OpenAI 相容端點自動使用 `/models`）。
- **響應式狀態訂閱**：透過 `widget.store.subscribe('aiProviderStatus', callback)` 訂閱狀態變更，即時驅動前端 UI 燈號或狀態文字。
- **手動探活 / 重試**：調用 `await widget.pingAiProvider()` 即可發起探活並同步 Store。

```typescript
import { 
  initAvatarBot, 
  AI_PROVIDER_STATUS_MAP, 
  AI_PROVIDER_PING_STRATEGY_MAP 
} from 'ai-avatar-bot-typescript';

const widget = await initAvatarBot({
  container: document.getElementById('avatar-container'),
  enableAiProvider: true,
  aiProviderBaseUrl: 'http://localhost:11434',
  aiProviderAutoPing: AI_PROVIDER_PING_STRATEGY_MAP.EAGER, // 'eager' (非阻塞背景探活) | 'lazy' (延遲首問) | 'manual' (完全手動)
  // aiProviderPingUrl: '/custom/healthz', // 可選：自訂健康檢查路徑
  onAiProviderConnecting: () => console.log('AI 伺服器連線中...'),
  onAiProviderConnected: () => console.log('AI 伺服器已連線！'),
  onAiProviderError: (error) => console.warn('AI 伺服器連線失敗:', error)
});

// 1. 訂閱 Store 狀態變更 (響應式驅動 UI)
const unsubscribe = widget.store.subscribe('aiProviderStatus', (status) => {
  switch (status) {
    case AI_PROVIDER_STATUS_MAP.CONNECTING:
      updateStatusBadge('連線中...', 'badge-warning');
      break;
    case AI_PROVIDER_STATUS_MAP.CONNECTED:
      updateStatusBadge('已就緒', 'badge-success');
      break;
    case AI_PROVIDER_STATUS_MAP.ERROR:
      const errorMsg = widget.store.getState().aiProviderError;
      updateStatusBadge(`離線 (${errorMsg})`, 'badge-danger');
      showRetryButton();
      break;
  }
});

// 2. 隨時查詢是否在線就緒
if (widget.isAiProviderReady) {
  console.log('AI Provider 可立即處理請求');
}

// 3. 使用者點擊「重試連線」按鈕時
retryButton.addEventListener('click', async () => {
  retryButton.disabled = true;
  const isOk = await widget.pingAiProvider();
  retryButton.disabled = false;
  if (!isOk) {
    alert('重試連線失敗，請確認 AI 伺服器是否正常運行中');
  }
});
```

#### 1.2 自訂 HTTP 標頭與多供應商認證 (`aiProviderHeaders`)

SDK 採用通用且與供應商無關的標頭設定（`aiProviderHeaders`），能無縫對接主流 AI 雲端平台與自建 API 閘道：

##### 🌐 主流 AI 供應商設定範例

```typescript
import { initAvatarBot } from 'ai-avatar-bot-typescript';

// 1. OpenAI / DeepSeek (Bearer Token)
const openAiBot = await initAvatarBot({
  container: document.getElementById('avatar-openai'),
  enableAiProvider: true,
  aiProviderBaseUrl: 'https://api.openai.com/v1',
  aiProviderModel: 'gpt-4o',
  aiProviderHeaders: {
    Authorization: `Bearer ${OPENAI_API_KEY}`
  }
});

// 2. Anthropic Claude (x-api-key + anthropic-version)
const anthropicBot = await initAvatarBot({
  container: document.getElementById('avatar-anthropic'),
  enableAiProvider: true,
  aiProviderBaseUrl: 'https://api.anthropic.com/v1',
  aiProviderModel: 'claude-3-5-sonnet-20241022',
  aiProviderHeaders: {
    'x-api-key': ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01'
  }
});

// 3. OpenRouter (自訂路由與識別標頭)
const openRouterBot = await initAvatarBot({
  container: document.getElementById('avatar-openrouter'),
  enableAiProvider: true,
  aiProviderBaseUrl: 'https://openrouter.ai/api/v1',
  aiProviderModel: 'meta-llama/llama-3.3-70b-instruct',
  aiProviderHeaders: {
    Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    'HTTP-Referer': 'https://your-company.com',
    'X-Title': 'My Interactive Avatar'
  }
});

// 4. Azure OpenAI Service (api-key)
const azureBot = await initAvatarBot({
  container: document.getElementById('avatar-azure'),
  enableAiProvider: true,
  aiProviderBaseUrl: 'https://your-resource.openai.azure.com/openai/deployments/gpt-4o',
  aiProviderHeaders: {
    'api-key': AZURE_API_KEY
  }
});
```

##### 🔄 不可變標頭與動態金鑰輪替

> [!IMPORTANT]
> **不可變防護保證 (`Object.freeze`)**：`widget.aiProviderHeaders` 回傳之標頭物件皆為唯讀凍結快照。禁止就地修改屬性（例如 `widget.aiProviderHeaders.Authorization = '...'`），在嚴格模式下將拋出 `TypeError`，確保內部狀態不被幽靈賦值竄改。
>
> 若需在執行期動態換證（例如 Token 過期重刷或切換多租戶環境）：

```typescript
// 方式 A：使用專屬輔助方法（推薦）
widget.setAiProviderHeaders({
  Authorization: `Bearer ${refreshedToken}`,
  'X-Tenant-Id': 'tenant-b'
});

// 方式 B：透過 Setter 展開賦值
widget.aiProviderHeaders = {
  ...widget.aiProviderHeaders,
  Authorization: `Bearer ${refreshedToken}`
};

// 讀取當前標頭快照
console.log(widget.aiProviderHeaders.Authorization);
```

##### 🛡️ 生產環境資安警語

> [!WARNING]
> **前端 API 金鑰外洩風險**：請勿將具有高計費額度或最高權限的生產環境 Master API Key 直接寫在公開的前端靜態程式碼中，終端使用者可輕易透過瀏覽器開發者工具或網路面板截獲。
>
> 在生產環境中，強烈建議將 `aiProviderBaseUrl` 指向您的**後端代理伺服器（Backend Proxy）**（如 Next.js API Routes、Express、Cloudflare Workers 等），由後端安全注入金鑰，或由驗證伺服器核發具備時效性的臨時短期 Token。

---

### 2. 自動接續回答機制 (Auto-Continue Response)

當模型輸出觸及 `max_tokens` 上限（`finish_reason === 'length'`）時，自動發起接續請求並無縫拼接：

```typescript
import { 
  initAvatarBot, 
  type AutoContinueStartInfo, 
  type AutoContinueResumeInfo, 
  type AutoContinueEndInfo 
} from 'ai-avatar-bot-typescript';

const widget = await initAvatarBot({
  container: document.getElementById('avatar-container'),
  enableAutoContinue: true,
  maxAutoContinuations: 3,
  autoContinueMode: 'stream',

  onAutoContinueStart: (info: AutoContinueStartInfo) => {
    console.log(`第 ${info.continuationIndex}/${info.maxContinuations} 回合接續開始`);
  },
  onAutoContinueResume: (info: AutoContinueResumeInfo) => {
    console.log('接收到接續 Chunk，恢復語音朗讀：', info.chunk);
  },
  onAutoContinueEnd: (info: AutoContinueEndInfo) => {
    console.log(`自動接續完成，共進行 ${info.totalContinuations} 輪，結束原因：${info.reason}`);
  }
});
```

---

### 3. [實驗性 Experimental] AI 模型推論過程 (Reasoning / Thinking) 與 WebLLM OOM 降級架構

> [!WARNING]
> **⚠️ 實驗性功能標註 (Experimental Feature Notice)**：  
> 推論思考過程（Reasoning / Thinking Output）與雙軌串流解析目前屬於**實驗性功能 (Experimental)**。由於各開源模型（如 DeepSeek-R1、Hermes 3、QwQ 等）在端側量化（4-bit）與伺服器端協議（OpenAI 相容 / Ollama / vLLM）對思考標籤（如 `<think>`）與 reasoning 欄位的支援程度與輸出穩定性存在差異，在部分模型或短文本情境下可能存在偶發跳過或格式不穩定之情況。在正式確認完全穩定前，建議評估業務情境後選用，或透過 `reasoning.mode = 'never'` 關閉推論輸出。

現代推論型大語言模型（如 DeepSeek-R1、Hermes 3、OpenAI o-系列、Claude 3.7 Thinking、QwQ）在生成最終語音回覆前會先進行內心思維推導。`ai-avatar-bot-typescript` 原生提供 **雙軌串流架構 (Dual-Track Stream Architecture)** 與 **兩階段 WebGPU OOM 自適應降級**：

#### 🚀 雙軌串流架構 (Dual-Track Stream Architecture)
1. **靜默思考軌 (`onReasoningStart`, `onReasoningChunk`, `onReasoningEnd`)**：
   - 推論 Token（例如 `<think>`、`<thought>` 標籤或 API 的 `delta.reasoning_content`）完全與 TTS 語音發聲隊列隔離。Avatar 在推論期間維持完全靜音，不會進行唇形同步。
   - 身體動作自動切換至 `thinking` 沉思動作（例如 3D VRM 手扥下巴），並切換至專注沉思表情 (`thinking`)。
   - 對話對話氣泡顯示呼吸思考動畫指示器 (`showThinkingInBubble: true`)。
   - 完整的思維鏈內容會連同執行毫秒數 (`reasoningTimeMs`) 保存至對話歷史記憶中。
2. **回覆發聲軌 (`onStreamChunk`, `onStreamEnd`)**：
   - 接收到第一個回答 Token 時，TTS 語音合成才延遲啟動 (`speechEngine.beginSpeech()`)，Avatar 動作淡入切換至 `talking` 講話動作與中性自然表情。
   - 口述句子串流推播至語音播放，並與 2D/3D 口型即時同步。
3. **歷史面板折疊式思維卡片 (Collapsible Thought History UI)**：
   - 對話歷史面板渲染原生 HTML5 `<details class="history-item__thought">` 折疊卡片，顯示 `🤔 思考過程 (X.Xs)`（支援多國語系），供使用者隨時展開查閱完整推論過程。

#### 🧠 推論模式控制 (`REASONING_MODE_MAP`) 與自訂提示詞 (`promptDirective`)
透過 `reasoning.mode`（型別 `ReasoningMode` / 常數 `REASONING_MODE_MAP`）與 `promptDirective`，開發者能精準掌控不同模型的推論行為與思考提示詞注入：

| 模式 (`mode`) | 行為特性 | 適用模型情境 |
| :--- | :--- | :--- |
| **`REASONING_MODE_MAP.auto`** *(預設)* | **被動偵測**：不主動修改提示詞，自動抓取模型輸出的 `<think>`、`<thought>` 標籤或 API 的 `reasoning_content`。 | `DeepSeek-R1`、`QwQ-32B` 等原生推論模型 |
| **`REASONING_MODE_MAP.always`** | **強制推論**：自動為 WebLLM 擴增 Token 上限（最多至 1024 Token），發送 `extra_body: { enable_thinking: true }`，並依 `promptDirective` 向 System Prompt 注入思考指引。 | `Hermes-3-Llama-3.1-8B`、`Qwen-2.5-Instruct` 等標準指令對話模型 |
| **`REASONING_MODE_MAP.never`** | **關閉推論**：略過推論標籤解析，所有輸出直接視為最終口述回答，並向下發 `extra_body: { enable_thinking: false }`。 | 追求極速簡短回應的情境 |

**自訂思考提示詞 (`promptDirective`) 彈性配置：**
- **字串 (`string`)**：使用指定的客製化提示詞（如特定 XML 標籤 `<thought>`、`<thinking>`，或要求使用特定語言進行推論思考）。
- **函式 (`(locale: string) => string`)**：依當前語系動態產出最適思考引導。
- **停用注入 (`false`)**：若開發者已在 `systemContext` 或自訂角色中寫妥推論指引，設為 `false` 可完全交由開發者自主控制，避免 SDK 重複插入多餘字句。
- **預設 (`undefined`)**：自動依當前語系注入強化版多國語言思考引導（包含明確的「不可省略 <think>」強約束與結構化輸出格式範例，確保通用 Instruct 模型在簡短對話或日常問答時亦能穩定觸發 `<think>` 推論過程）。

#### 🧭 模型特性與能力相容性說明 (Model Characteristics & Compatibility)

在整合推論思維鏈（Reasoning / Thinking）與工具調用（Function Calling）時，不同類型的模型具備不同的天然特性與邊界：

1. **原生推論模型 (Native Reasoning Models)**：
   - **代表模型**：`DeepSeek-R1` 系列、`QwQ-32B` 等。
   - **輸出特性**：天然主動輸出 `<think>...</think>` 標籤或 API 專屬的 `reasoning_content` 欄位，具備強大的自主思維鏈分析。
   - **工具調用相容性**：現階段多數開源原生推論模型**尚未對齊結構化 Function Calling (Tool Calling)**。若在請求中掛載 Tools 定義，模型往往容易將調用邏輯混雜在思考字串中，或無法產出合法之 JSON Schema 工具呼叫格式。

2. **通用指令/對話模型 (General Instruct Models)**：
   - **代表模型**：`Hermes-3-Llama-3.1-8B`、`Qwen-2.5-Instruct`、`Llama-3.1-Instruct` 等。
   - **輸出特性**：原生預設**不會**主動輸出 `<think>` 思考標籤；收到問題後即直接給出最終回覆。若需思考過程，需在提示詞（Prompt Directive）中明確格式規範。
   - **工具調用相容性**：天然支援極高可靠度的結構化 Tool Calling 與 JSON Schema 參數驗證。

> [!WARNING]
> **WebLLM 端側模型穩定度與推論表現揭露 (Stability Notice)**：
> 1. **通用指令模型的推論穩定度**：  
>    在 WebLLM 端側模型中，通用指令模型（如 `Hermes-3-Llama-3.1-8B-q4f32_1-MLC`）的思維鏈輸出是透過提示詞（Prompt Directive）誘導促發。由於 4-bit 端側量化以及模型對簡短對話的慣性，**並非 100% 每次對話皆保證輸出 `<think>` 標籤**（面對極短日常問候或長背景知識時，模型可能偶發跳過思考直接給出口述回答）。
> 2. **雙軌流自動容錯**：  
>    若模型跳過思考標籤，SDK 底層的 `createStreamParser` 狀態機會自動即時無縫切入「口述回答軌」，直接啟動語音對嘴與氣泡更新，**絕不會發生畫面卡死或無限等待思考結束的情況**。
> 3. **工具調用與推論兼備的現狀**：  
>    目前開源 WebLLM 模型庫中，**尚未有同時具備「100% 穩定原生 `<think>` 思維鏈」且「100% 穩定結構化 Tool Calling」的完美模型**。此現象為當前模型微調與端側量化之技術共性，開發者在設計人設與業務場景時需評估該權衡（需 Tool Call 選指令模型；需深度純推論選原生推論模型）。

#### 🛡️ 兩階段 WebGPU 記憶體超載自適應降級 (Two-Tier WebGPU OOM Fallback)
- **第一階 (旗艦預設)**：預設載入 `Hermes-3-Llama-3.1-8B-q4f32_1-MLC`，提供完整的 Function Calling 工具調用與深度思考能力。
- **第二階 (輕量備援)**：若使用者裝置 WebGPU 顯存不足 (OOM)，自動觸發 `onLlmOomFallback` 回呼並平滑降級至輕量級 `Qwen2.5-1.5B-Instruct-q4f16_1-MLC`（僅需 ~1.1GB 下載、~1.2GB VRAM）。
- **快速失敗 (Fail-Fast)**：若備援模型依然初始化失敗，立即拋出標準型別錯誤，避免陷入無窮重試迴圈。
- **自訂配置**：可設定 `llmFallbackModel: null` 停用自動降級，強制要求只使用主要模型。

```typescript
import { 
  initAvatarBot, 
  REASONING_MODE_MAP,
  type ReasoningStartInfo, 
  type ReasoningChunkInfo, 
  type ReasoningEndInfo,
  type LlmOomFallbackInfo 
} from 'ai-avatar-bot-typescript';

const widget = await initAvatarBot({
  container: document.getElementById('avatar-container'),
  llmModel: 'Hermes-3-Llama-3.1-8B-q4f32_1-MLC',
  llmFallbackModel: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
  enableOomFallback: true,

  reasoning: {
    // 啟用強制推論模式，促使通用 Instruct 模型在回答前進行思考
    mode: REASONING_MODE_MAP.always,
    showThinkingInBubble: true,
    // 自訂思考引導詞（亦可傳入函式 (locale) => ... 或傳入 false 自主在 systemContext 控制）
    promptDirective: 'Think and plan step-by-step inside <think>...</think>, then reply in Traditional Chinese outside the tags.'
  },

  onReasoningStart: (info: ReasoningStartInfo) => {
    console.log('AI 開始思考...', info.model);
  },
  onReasoningChunk: (info: ReasoningChunkInfo, delta: string) => {
    console.log('思考過程 Delta：', delta);
  },
  onReasoningEnd: (info: ReasoningEndInfo, fullReasoning: string, durationMs: number) => {
    console.log(`思考完畢，耗時 ${durationMs}ms`);
  },
  onStreamChunk: (chunkDelta: string, rawChunk?: unknown) => {
    console.log('口述回答 Chunk：', chunkDelta);
  },
  onLlmOomFallback: (info: LlmOomFallbackInfo, primary: string, fallback: string, err: unknown) => {
    console.warn(`觸發 WebGPU OOM 降級：${primary} -> ${fallback}`);
  }
});
```

#### 🧩 核心解析器：`createStreamParser` (底層雙軌狀態機)

若您在 **Headless 模式**、自建前端對話流或 Node.js 後端服務中需要獨立解析推論串流，可直接從 `ai-avatar-bot-typescript/brain` 導入工廠函式 `createStreamParser`：

```typescript
import { 
  createStreamParser, 
  STREAM_PARSER_STATE,
  type StreamParserInstance,
  type StreamParserResult 
} from 'ai-avatar-bot-typescript/brain';

const parser: StreamParserInstance = createStreamParser({
  mode: 'auto', // 'auto' | 'always' | 'never'
  onReasoningStart: (info) => {
    console.log('進入思維推導階段 (靜音軌)', info.model);
  },
  onReasoningChunk: (info) => {
    // 增量思維 Token (<think>...</think> 或 reasoning_content)
    console.log('思考中:', info.chunkDelta);
  },
  onReasoningEnd: (info) => {
    console.log(`推導完成，耗時 ${info.durationMs}ms`);
  },
  onAnswerStart: () => {
    console.log('進入語音回答階段 (TTS 啟動)');
  },
  onAnswerChunk: (chunkDelta, accumulatedAnswer) => {
    console.log('口述 Chunk 抵達:', chunkDelta);
  },
  onAnswerEnd: (fullAnswer, durationMs) => {
    console.log('回答生成完畢');
  }
});

// 將大語言模型串流 Chunk 餵入解析狀態機
parser.feed(rawLlmChunk);

// 串流結束時結算結果
const result: StreamParserResult = parser.finish();
console.log('完整推論：', result.reasoning);
console.log('完整回答：', result.answer);
console.log('是否包含思考過程：', result.hasReasoning);
```

---

### 4. 記憶管理、資料結構與自訂儲存轉接器

實作 `MemoryAdapter` 介面，即可將記憶存入 IndexedDB、Redis 或自建後端 API：

```typescript
import { 
  initAvatarBot, 
  type MemoryAdapter, 
  type MemoryData 
} from 'ai-avatar-bot-typescript';

class SessionStorageMemoryAdapter implements MemoryAdapter {
  load(key: string): MemoryData | null {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? (JSON.parse(raw) as MemoryData) : null;
    } catch {
      return null;
    }
  }

  save(key: string, data: MemoryData): void {
    try {
      sessionStorage.setItem(key, JSON.stringify(data));
    } catch (err) {
      console.warn('儲存對話記憶失敗：', err);
    }
  }

  clear(key: string): void {
    sessionStorage.removeItem(key);
  }
}

const widget = await initAvatarBot({
  container: document.getElementById('avatar-container'),
  enableMemory: true,
  memoryKey: 'custom-session-mem',
  memoryAdapter: new SessionStorageMemoryAdapter()
});

// 操作強型別的記憶子系統
const memory = widget.brainEngine?.memory;
if (memory) {
  memory.setMetadata({ role: 'vip', plan: 'enterprise' });
  const meta = memory.getMetadata();
  console.log('自訂業務中繼資料：', meta);
}
```

---

### 5. Function Calling 與自訂工具 (Tools Engine)

註冊自訂工具並享有完整的 JSON Schema 與執行參數驗證：

```typescript
import { 
  initAvatarBot, 
  type ToolDefinition, 
  type ToolExecutionParams 
} from 'ai-avatar-bot-typescript';

interface WeatherArgs {
  city: string;
}

const weatherTool: ToolDefinition = {
  name: 'get_weather',
  label: '查詢天氣',
  description: '查詢特定城市的即時氣溫與天氣狀況。',
  keywords: ['天氣', '氣溫', '下雨', '預報'],
  routingMode: 'hybrid', // 'client' (純前端比對) | 'ai' (AI 呼叫) | 'hybrid' (混合模式)
  requiresConfirmation: false,
  inputSchema: {
    type: 'object',
    properties: {
      city: {
        type: 'string',
        title: '城市名稱',
        description: '例如：台北、東京、紐約'
      }
    },
    required: ['city']
  },
  execute: async ({ args }: ToolExecutionParams) => {
    const { city } = args as unknown as WeatherArgs;
    const res = await fetch(`https://api.example.com/weather?city=${encodeURIComponent(city)}`);
    const data = await res.json();
    return `${city} 目前天氣：${data.condition}，氣溫 ${data.temperature}°C。`;
  }
};

const widget = await initAvatarBot({
  container: document.getElementById('avatar-container'),
  tools: [weatherTool]
});
```

---

### 6. 2D (Live2D) 與 3D (VRM) 雙外觀引擎

透過型別化配置控制空間座標、相機視角與表情手勢：

```typescript
import { 
  initAvatarBot, 
  type Skin2DConfig, 
  type Skin3DConfig 
} from 'ai-avatar-bot-typescript';

const widget = await initAvatarBot({
  container: document.getElementById('avatar-container'),
  startMode: '3d',
  fitMode: 'half'
});

// 切換渲染引擎
if (widget.skinEngine) {
  widget.skinEngine.engineMode = '2d'; // 切換至 Live2D
  widget.skinEngine.engineMode = '3d'; // 切換至 VRM 3D
}

// 調整 2D Live2D 配置
widget.setSkin2d({
  zoom: 1.8,
  offsetX: 15,
  anchor: { x: 0.5, y: 1.0 }
});

// 調整 3D VRM 鏡頭與空間姿態
widget.setSkin3d({
  pointerLook: true,
  half: {
    camera: {
      fov: 28,
      position: { x: 0, y: 1.4, z: 2.4 },
      lookAt: { x: 0, y: 1.2, z: 0 }
    }
  }
});

// 觸發情緒動作與手勢
widget.skinEngine?.setEmotion('happy');
widget.applyEmotionFromText?.('這真是個令人開心的好消息！');

// 播放統一語意動作 (2D/3D 自動同構適配)
widget.playGesture?.('bow');

// 程式化觸發全身點擊互動 (播放隨機點擊動作並朗讀問候語)
widget.tap?.();
```

#### 🎬 3D 動作池與性別層疊繼承 (Action Pools & Cascade Gender Inheritance)
3D VRM 引擎採用生動的動作池架構，包含常態呼吸待機、性別專屬偶發小動作（10~20秒隨機輪播）、說話動作池與開場問候，並支援動作級別的視線追蹤控制（`pointerLook`）與平滑融混過渡（`crossfadeDuration`）：

```typescript
const widget = await initAvatarBot({
  container: document.getElementById('avatar-container'),
  startMode: '3d',
  gender: 'female',
  skin3d: {
    // 1. 常態呼吸待機動作池 (LoopRepeat 無縫循環，頭頸解耦跟隨游標)
    idlePool: ['idle-1', 'idle-2'],

    // 2. 性別專屬偶發小動作池 (每 10~20 秒隨機插播，播畢平滑淡回常態待機)
    idleVariants: {
      female: [
        { name: 'idle-female-1', pointerLook: false }, // 檢視指甲 (關閉注視避免斜視)
        { name: 'idle-female-2', pointerLook: true }   // 背手輕踢腿 (開啟注視)
      ],
      male: [
        { name: 'idle-male-1', pointerLook: true },    // 舒展手臂
        { name: 'idle-male-2', pointerLook: true }     // 舒展脖子
      ]
    },

    // 3. 說話動作池 (說話時隨機抽樣循環，對嘴演算法精準疊加)
    talkingPool: ['talking-1', 'talking-2', 'talking-3', 'talking-4'],

    // 4. 開場招呼手勢 (模型載入就緒後自動觸發一次)
    greetings: {
      female: {
        name: 'standing-greeting',  // 女生單手揮手問候
        pointerLook: false          // 男生甩手敬禮
      },
      male: {
        name: 'salute',
        pointerLook: false
      }
    },

    // 5. 點擊互動隨機反饋動作池
    tapGestures: ['goodbye', 'bow', 'waiting'],

    // 6. 自訂手勢庫字典 (支援層疊繼承：通用定義 + 性別個別覆蓋)
    gestures: {
      bow: { pointerLook: false, crossfadeDuration: 0.4 }, // 鞠躬不跟隨滑鼠
      female: {
        waiting: { url: '/avatar-skin/3d-model/vrma/common/waiting.vrma' }
      }
    }
  }
});
```

#### 🎭 統一動作調度與全域攔截器 (`gesture`)
可在初始化時傳入 `gesture` 攔截器，根據當前渲染模式或動作名稱進行自訂轉發，並安全委派回原生 2D / 3D 渲染器：

```typescript
const widget = await initAvatarBot({
  container: document.getElementById('avatar-container'),
  // 全域動作攔截器
  gesture: async (engine, gestureName, context) => {
    console.log(`[Gesture] 請求動作: ${gestureName}, 當前渲染模式: ${context.mode}`);

    if (gestureName === 'special_welcome') {
      if (context.mode === '2d') {
        await context.gesture2D('Wave'); // 委派至 Live2D 動作
      } else {
        await context.gesture3D('goodbye'); // 委派至 3D VRM 動作
      }
      return;
    }

    // 未攔截之動作委派回預設通道
    if (context.mode === '2d') {
      await context.gesture2D(gestureName);
    } else {
      await context.gesture3D(gestureName);
    }
  }
});
```

#### 👆 點擊動作清單與自訂映射 (`tapGestures`, `motionMap`, `expressionMap`)

```typescript
const widget = await initAvatarBot({
  container: document.getElementById('avatar-container'),
  // 點擊虛擬人時隨機播放的動作列表
  tapGestures: ['bow', 'goodbye', 'nod'],
  // 2D Live2D 專屬自訂動作名稱對照表 (外部名稱 ➔ 模型內建 Group)
  motionMap: {
    greeting: 'Tap',
    special_dance: 'DanceGroup'
  },
  // 2D / 3D 通用自訂語意表情對照表 (情緒名稱 ➔ 模型表情名稱)
  expressionMap: {
    happy: 'MyCustomSmile',
    angry: 'f08'
  }
});
```

#### 🔍 2D 三層階梯動作解析機制 (Three-tier Motion Resolution)
當呼叫 `widget.playGesture('greet')` 或 2D 渲染器執行動作時，內部採用優先級分層解析，開箱即用且高度相容各種第三方 Live2D 模型：
1. **第一層（自訂動作對照表）**：比對 `motionMap['greet']`，有對應則直接播放對應群組。
2. **第二層（模型原生直通群組）**：直接在 Live2D 模型中比對同名群組（大小寫不拘，如 `'Tap'`）。
3. **第三層（內建預設動作別名庫）**：比對內建語意別名庫（如 `tap`、`goodbye`、`bow`、`thinking`、`look`、`relax`、`surprised`、`waiting`），自動匹配模型中存在的別名。
4. **第四層（語意表情降級切換）**：若未命中任何動作群組，則檢查 `expressionMap` 或模型表情切換。
5. **未命中保護**：若完全未命中，安全觸發 `onGestureError` 並拋出 `GestureNotFoundError`，不中斷主執行緒。

---

### 7. 語音辨識與神經語音 (Speech Engine)

```typescript
// 程式化觸發語音朗讀
widget.speechEngine?.speak('很高興為您服務！');

// 響應式賦值觸發語音（內部自動維護序號，連續賦予相同字串亦可播放）
if (widget.speechEngine) {
  widget.speechEngine.spokenAudioText = '哈囉～我是您的專屬虛擬助理！';
}

// 啟動 / 關閉麥克風語音輸入 (STT)
widget.speechEngine?.startListening();
widget.speechEngine?.setMic(false);

// 即時語音打斷 (Barge-in)
widget.speechEngine?.interruptForVoice();

// 訂閱說話狀態與即時字幕文字
widget.speechEngine?.subscribe('isSpeaking', (isSpeaking: boolean) => {
  console.log('語音播放中：', isSpeaking);
});
widget.speechEngine?.subscribe('spokenDisplayText', (subtitle: string) => {
  console.log('即時字幕：', subtitle);
});
```

---

### 8. 無頭模式 (Headless Mode) 與自訂 UI

若您希望以 Vue 3、React、Svelte 或原生 DOM 100% 自行構建介面，可開啟極簡模式：

```typescript
import { initAvatarBot } from 'ai-avatar-bot-typescript';

const widget = await initAvatarBot({
  container: document.getElementById('canvas-wrapper'),
  isMinimal: true // 隱藏預設懸浮窗與氣泡
});

// 程式化將使用者輸入傳遞給 AI 大腦處理
await widget.handleUser('請問你們的退換貨政策是什麼？');

// 訂閱狀態以繪製自訂介面
widget.speechEngine?.subscribe('isSpeaking', (speaking: boolean) => {
  const customBubble = document.getElementById('custom-bubble');
  if (customBubble) {
    customBubble.style.display = speaking ? 'block' : 'none';
  }
});
```

---

## 📐 導出 TypeScript 型別速查表

`ai-avatar-bot-typescript` 完整導出各子模組的核心型別：

### 核心導出 (`ai-avatar-bot-typescript`)

* **協調器核心 (Orchestrator)**：`AvatarBotOptions`, `AiAvatarWidget`, `AvatarBotStore`, `AvatarBotStoreState`, `CustomEnginesConfig`, `OrchestratorEngines`
* **各子引擎介面**：`BrainEngine`, `BrainEngineOptions`, `SpeechEngine`, `SpeechEngineOptions`, `SkinEngine`, `SkinEngineOptions`, `ToolsEngine`, `ToolsEngineSetting`, `I18nEngine`, `I18nEngineOptions`, `UiDom`, `UiContext`
* **大腦與記憶**：`LLMMessage<TContent>`, `BrainCompressionOptions`, `MemoryData`, `MemoryAdapter`, `KnowledgeEntry`, `ChatLogItem`, `ParsedToolCall`, `ChatHistoryItem`, `MemoryInstance`
* **AI Provider**：`AiProviderFetchSettingFactory`, `AiProviderFetchPayloadFactory`, `AiProviderToolCallExtractor`, `AiProviderOptions`, `AiProviderEngine`
* **外觀與幾何座標**：`Skin2DConfig`, `Skin3DConfig`, `Skin3DCameraConfig`, `Skin3DModelConfig`, `Renderer2D`, `Renderer3D`, `Point2D`, `Vector2Coord`, `Vector2Tuple`, `Vector2Input`, `Vector3Coord`, `Vector3Tuple`, `Vector3Input`, `Vector3Scale`
* **工具管理**：`ToolDefinition`, `ToolRouteCandidate`, `ToolExecutionParams`, `PendingToolState`
* **可擴充字面量聯集**：`AvatarMode`, `Gender`, `FitMode`, `EngineMode`, `AutoContinueMode`, `ChatRole`, `ReasoningMode`
* **動態解析型別**：`LocalizableOrResolver<T, C>`, `DynamicTextOrResolver<C>`, `AutoContinuePromptResolver`
* **事件 Payload 與推論**：`AutoContinueStartInfo`, `AutoContinueResumeInfo`, `AutoContinueEndInfo`, `ToolNotFoundErrorInfo`, `ToolErrorInfo`, `LlmLoadProgressInfo`, `ReasoningOptions`, `ReasoningStartInfo`, `ReasoningChunkInfo`, `ReasoningEndInfo`, `LlmOomFallbackInfo`

---

## 📚 實例 API 與方法 (AiAvatarWidget)

初始化完成後回傳的 `widget` 實例符合 `AiAvatarWidget` 介面：

```typescript
export interface AiAvatarWidget {
  readonly options: AvatarBotOptions;
  readonly container: HTMLElement;
  readonly uiDom: UiDom;
  readonly i18nEngine: I18nEngine;
  readonly brainEngine: BrainEngine | null;
  readonly speechEngine: SpeechEngine | null;
  readonly skinEngine: SkinEngine | null;
  readonly toolsEngine: ToolsEngine | null;

  // 互動方法
  handleUser(text?: string): Promise<void> | void;
  answerQuestion?(question: string): Promise<string | void>;
  applyEmotionFromText?(text: string): void;
  classifyEmotion?(text: string): string;
  playGesture?(gestureName: string): void;
  tap?(): void;
  showMinimalEl(): void;
  hiddenMinimalEl(): void;

  // AI Provider 與自訂標頭
  readonly isAiProviderReady: boolean;
  pingAiProvider(fetchSetting?: RequestInit | null): Promise<boolean>;
  aiProviderHeaders: Readonly<Record<string, string>>;
  setAiProviderHeaders(newHeaders: Record<string, string>): void;

  // 外觀與視口調整
  setSkin2d(config: Partial<Skin2DConfig>): void;
  setSkin3d(config: Partial<Skin3DConfig>): void;
  setFitMode(fitMode: FitMode): void;

  // 推薦問題控制
  setSuggestedQuestions(
    questions?: LocalizableOrResolver<string[]>,
    title?: LocalizableOrResolver<string>
  ): void;
  renderSuggestions(): void;

  // 響應式屬性
  avatarMode: AvatarMode;
  gender: Gender;
  locale: string;
  isMinimal: boolean;
  enableMemory: boolean;
  enableAiProvider: boolean;
  enableAutoContinue: boolean;
  maxAutoContinuations: number;
  autoContinueMode: AutoContinueMode;
  enableModelDrop: boolean;
  enableEngineToggle: boolean;
  readonly reasoning?: ReasoningOptions;
  llmFallbackModel?: string | null | false;
  enableOomFallback?: boolean;
}
```

---

## 🌐 多語系支援 (i18n)

支援於運行時隨時切換介面語言與發音語系：

```typescript
widget.i18nEngine.setLocale('zh-TW'); // 繁體中文
widget.i18nEngine.setLocale('en-US'); // 英文
widget.i18nEngine.setLocale('ja-JP'); // 日文
widget.i18nEngine.setLocale('ko-KR'); // 韓文
widget.i18nEngine.setLocale('zh-CN'); // 簡體中文
```

---

## 📦 第三方資產與授權（請務必詳閱）

本套件之原始程式碼採用 **[MIT License](LICENSE)** 開源。然而本套件**引用與包含之第三方運行庫、範例模型與動作素材**各有其獨立授權，**不屬於本專案 MIT 授權之範疇**：

| 資產 / 依賴項目 | 授權協議 / 來源 | 商業與散布注意事項 |
| :--- | :--- | :--- |
| **Live2D Cubism Core** (`cubism.live2d.com`) | **Proprietary License** 專有授權 | **非開源**。透過官方 CDN 動態載入。若用於商業發布或打包散布，必須確保符合 Live2D 官方條款並取得合適之授權。 |
| **Haru 範例模型** (`2d-model/female/haru_greeter_t03.*`) | Live2D **Free Material License** | **僅供技術展示與測試使用**。不可直接用於商業產品部署。正式上線請替換為合法取得之 Live2D 模型。 |
| **Natori 範例模型** (`2d-model/male/natori_pro_t06.*`) | Live2D **Free Material License** | **僅供技術展示與測試使用**。不可直接用於商業產品部署。 |
| **初音未來 VRM 模型** (`3d-model/HatsuneMiku.vrm`) | **Piapro Character License (PCL)** | 角色 IP 屬於 Crypton Future Media, INC.。**嚴格限於非商業技術展示**，未經授權禁止商業營利。 |
| **洛克人 VRM 模型** (`3d-model/RockmanEXE.vrm`) | **Capcom Derivative Guidelines** | 遊戲 IP 屬於 CAPCOM CO., LTD.。**嚴格限於個人非商業技術展示使用**。 |
| **VRMA 動作庫** (`3d-model/vrma/*.vrma`) | **MIT / CC-BY 4.0** | 包含揮手再見 (goodbye)、鞠躬 (bow)、思考 (thinking)、張望 (look)、放鬆 (relax)、驚訝 (surprised)、登場 (appearing)、喜歡/讚 (liked)、等待 (waiting) 等動作。免費提供商業與個人使用。 |
| **Pixi.js / pixi-live2d-display** | **MIT License** | 開源 2D WebGL 渲染引擎與 Live2D 整合套件。 |
| **Three.js / @pixiv/three-vrm** | **MIT License** | 開源 3D WebGL 渲染器與 VRM 標準庫。 |
| **@mlc-ai/web-llm** (WebLLM) | **Apache-2.0** | 瀏覽器 WebGPU 端側模型推論引擎。 |

---

## 🧪 測試體系與品質保證 (Testing)

`ai-avatar-bot-typescript` 擁有完整的自動化驗證體系，涵蓋型別檢查、單元演算法與 Playwright 端到端驗證：

```bash
# 1. 嚴格 TypeScript 編譯期型別檢查
yarn test:typecheck

# 2. 執行 600+ 項 Vitest 單元測試（涵蓋大腦推論、語音、外觀、工具、記憶、Store，603 測試全數通過）
yarn test:unit

# 3. Vitest 監聽與視覺化 UI 儀表板
yarn test:unit:watch
yarn test:unit:ui

# 4. 單元測試覆蓋率報告
yarn test:unit:coverage

# 5. Playwright E2E 雙軌測試（介面合約一致性與真實 WebGL 引擎測試）
yarn test:e2e:contract
yarn test:e2e:engine
yarn test:e2e

# 6. 生產環境 Bundle 冒煙測試
yarn test:smoke
```

---

## ⚠️ 風險與限制揭露

1. **TTS 語音服務與後端端點**：
   - 本套件為純前端 SDK。支援對接自建神經網路 TTS 端點（`ttsEndpoint`）或自動降級至瀏覽器原生 Web Speech API（`window.speechSynthesis`）。
2. **語音辨識 (STT) 雲端處理**：
   - 瀏覽器原生 Web Speech API（`webkitSpeechRecognition`）通常會將麥克風音訊上傳至瀏覽器廠商（如 Google）伺服器處理，非純本地辨識。
3. **WebLLM 顯卡硬體與下載門檻**：
   - 瀏覽器端 WebLLM 需 WebGPU 支援與充足的 GPU 顯存（初次需下載 1GB–5GB 模型權重）。相容性考量下可配置 `enableAiProvider: true` 對接遠端伺服器。
4. **專業領域知識免責**：
   - 內建知識庫僅供展示。若應用於法律、醫療、金融等高專業度場景，務必設定相應之法律免責聲明。

---

## 🔐 隱私與資料流向

| 功能模組 | 資料處理地點 / 目標 | 隱私與安全說明 |
| :--- | :--- | :--- |
| **語音辨識 (STT)** | 麥克風音訊 ➔ 瀏覽器廠商雲端 (例如 Google) | 音量分析為本機運算；識別文字回傳至前端。 |
| **語音合成 (TTS)** | 待讀文字 ➔ 自訂 `ttsEndpoint` 或本地瀏覽器 | 若使用原生語音則 100% 在本地合成。 |
| **WebLLM 本地大腦** | **100% 瀏覽器本地端 (WebGPU)** | 對話計算全程於瀏覽器記憶體中完成，不離開使用者設備。 |
| **AI Provider 雲端大腦**| 對話訊息 ➔ 您所設定之 `aiProviderBaseUrl` | 依據您的後端伺服器架構進行處理（例如本地 Ollama 或自建 API）。 |
| **對話記憶 (Memory)** | **100% 瀏覽器本地端** (`localStorage` / 自訂轉接器) | 儲存於使用者設備，不會主動上傳至任何伺服器。 |

---

## ❓ 常見問題 (FAQ)

### Q1: `ai-avatar-bot-typescript` 與早期 `vanilla-js` 原型的關係與演進？
> **A:** 本專案早期曾以純 JavaScript（`vanilla-js`）進行多引擎架構驗證，在確認功能成熟健全後，該原型已於 Commit [`2e4cb12a4c689d8dc98a814211279ce0cb3ebf59`](https://github.com/archer102125220/ai-avatar-bot/commit/2e4cb12a4c689d8dc98a814211279ce0cb3ebf59)（Tag: `archive/vanilla-js-baseline`）完成階段性使命並封存歸檔。目前的 `ai-avatar-bot-typescript` 為單一核心事實來源（Single Source of Truth），採用 100% 原生 TypeScript 撰寫，具備更極致的輕量化（核心 223KB）、完善的型別約束與 Subpath 導出，且編譯出的標準 ESM/CJS/IIFE 產物可讓純 JavaScript 專案無縫直接使用。

### Q2: 是否能在無預設 UI（無頭模式 Headless）下使用？
> **A:** 可以！初始化時傳入 `isMinimal: true` 即可隱藏預設懸浮窗與氣泡，接著可完全使用 React、Vue、Svelte 繪製專屬介面，並透過 `widget.handleUser()` 及訂閱 `widget.speechEngine` 與之互動。

### Q3: 如何動態切換 2D (Live2D) 與 3D (VRM)？
> **A:** 可在初始化時設定 `startMode: '2d'` 或 `'3d'`，亦可在運行時透過 `widget.skinEngine.engineMode = '3d'` 即時切換。

---

## 🤝 鳴謝與原作者 (Credits)

本套件的架構與核心靈感源自於原作者 **[YuriCrystal](https://github.com/YuriCrystal)** 的開源專案 [ai-avatar-bot](https://github.com/YuriCrystal/ai-avatar-bot)。

感謝原作者在 Web 數位人互動、Live2D/VRM 整合、WebGPU 端側推論以及語音對嘴設計上的開創性探索與開源貢獻！

---

## 📝 授權條款 (License)

本專案自有原始程式碼採用 **[MIT License](LICENSE)** 開源。
