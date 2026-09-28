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
- [🚀 快速開始 (TypeScript 範例)](#-快速開始-typescript-範例)
- [⚙️ 詳細設定選項 (AvatarBotOptions)](#️-詳細設定選項-avatarbotoptions)
- [🧠 進階功能指南](#-進階功能指南)
  - [1. 大腦引擎與三層降級推論 (型別化工廠)](#1-大腦引擎與三層降級推論-型別化工廠)
  - [2. 自動接續回答機制 (Auto-Continue Response)](#2-自動接續回答機制-auto-continue-response)
  - [3. 記憶管理、資料結構與自訂儲存轉接器](#3-記憶管理資料結構與自訂儲存轉接器)
  - [4. Function Calling 與自訂工具 (Tools Engine)](#4-function-calling-與自訂工具-tools-engine)
  - [5. 2D (Live2D) 與 3D (VRM) 雙外觀引擎](#5-2d-live2d-與-3d-vrm-雙外觀引擎)
  - [6. 語音辨識與神經語音 (Speech Engine)](#6-語音辨識與神經語音-speech-engine)
  - [7. 無頭模式 (Headless Mode) 與自訂 UI](#7-無頭模式-headless-mode-與自訂-ui)
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
# npm
npm install ai-avatar-bot-typescript

# pnpm
pnpm add ai-avatar-bot-typescript

# yarn
yarn add ai-avatar-bot-typescript
```

### 渲染相關 Peer 依賴 (可選)

`ai-avatar-bot-typescript` 內部已預先配置好常用運行時。若您的專案需要自行呼叫底層 Three.js 或 Pixi.js，可手動安裝對應依賴：

```bash
npm install three @pixiv/three-vrm @pixiv/three-vrm-animation pixi.js pixi-live2d-display @mlc-ai/web-llm
```

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
| `aiProviderModel` | `string` | `'qwen2.5:latest'` | 遠端 AI 模型名稱識別碼。 |
| `aiProviderStream` | `boolean` | `true` | 是否啟用 AI Provider 串流輸出模式。 |
| `aiProviderMaxTokens` | `number` | `2048` | 遠端 AI 單次生成 Token 最大上限。 |
| `aiProviderCreateFetchSetting` | `AiProviderFetchSettingFactory \| RequestInit` | `undefined` | 自訂 Fetch Header / RequestInit 配置工廠函式。 |
| `aiProviderCreateFetchPayload` | `AiProviderFetchPayloadFactory \| Record<string, unknown> \| BodyInit` | `undefined` | 自訂 JSON 請求負載生成工廠函式。 |
| `aiProviderResponseFormat` | `string \| Record<string, unknown>` | `undefined` | 遠端 AI 回應解析格式（`'sse'`, `'json'` 或自訂解析物件）。 |
| `aiProviderExtractToolCalls` | `AiProviderToolCallExtractor` | `undefined` | 自串流 Chunk 中抽取 Tool Call 的型別化解析勾子。 |
| `llmModel` | `string` | `'Qwen2.5-1.5B...'` | 瀏覽器端 WebLLM 模型名稱。 |
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

### 建議問題與問候語設定

| 選項名稱 | 型別定義 | 預設值 | 說明 |
| :--- | :--- | :--- | :--- |
| `suggestedQuestions` | `LocalizableOrResolver<string[]>` | 內建預設 | 推薦問題清單（支援字串陣列、多語系字典或動態函式）。 |
| `companionSuggestedQuestions` | `LocalizableOrResolver<string[]>` | 內建預設 | 陪伴模式專屬推薦問題清單。 |
| `assistantSuggestedQuestions` | `LocalizableOrResolver<string[]>` | 內建預設 | 助理模式專屬推薦問題清單。 |
| `suggestedTitle` | `LocalizableOrResolver<string>` | 內建預設 | 推薦問題區塊的標題文字。 |
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
| `onStreamEnd` | `(fullText: string) => void` | 大腦 LLM 串流生成文字完全結束時觸發。 |
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

### 3. 記憶管理、資料結構與自訂儲存轉接器

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

### 4. Function Calling 與自訂工具 (Tools Engine)

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

### 5. 2D (Live2D) 與 3D (VRM) 雙外觀引擎

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
```

---

### 6. 語音辨識與神經語音 (Speech Engine)

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

### 7. 無頭模式 (Headless Mode) 與自訂 UI

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
* **可擴充字面量聯集**：`AvatarMode`, `Gender`, `FitMode`, `EngineMode`, `AutoContinueMode`, `ChatRole`
* **動態解析型別**：`LocalizableOrResolver<T, C>`, `DynamicTextOrResolver<C>`, `AutoContinuePromptResolver`
* **事件 Payload**：`AutoContinueStartInfo`, `AutoContinueResumeInfo`, `AutoContinueEndInfo`, `ToolNotFoundErrorInfo`, `ToolErrorInfo`, `LlmLoadProgressInfo`

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
  showMinimalEl(): void;
  hiddenMinimalEl(): void;

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
| **VRMA 動作庫** (`3d-model/vrma/*.vrma`) | **MIT / CC-BY 4.0** | 包含揮手、鞠躬、思考、張望、放鬆、驚訝 6 組動作。免費提供商業與個人使用。 |
| **Pixi.js / pixi-live2d-display** | **MIT License** | 開源 2D WebGL 渲染引擎與 Live2D 整合套件。 |
| **Three.js / @pixiv/three-vrm** | **MIT License** | 開源 3D WebGL 渲染器與 VRM 標準庫。 |
| **@mlc-ai/web-llm** (WebLLM) | **Apache-2.0** | 瀏覽器 WebGPU 端側模型推論引擎。 |

---

## 🧪 測試體系與品質保證 (Testing)

`ai-avatar-bot-typescript` 擁有完整的自動化驗證體系，涵蓋型別檢查、單元演算法與 Playwright 端到端驗證：

```bash
# 1. 嚴格 TypeScript 編譯期型別檢查
yarn test:typecheck

# 2. 執行 490+ 項 Vitest 單元測試（大腦、語音、外觀、工具、記憶、Store）
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

### Q1: `ai-avatar-bot-typescript` 與 `ai-avatar-bot-vanilla-js` 有什麼差異？
> **A:** 兩者共享完全相同的核心引擎架構與多引擎能力。`ai-avatar-bot-typescript` 採用 100% 原生 TypeScript 撰寫，具備嚴格的型別約束、泛型介面、專屬的型別定義檔輸出與絕佳的 IDE 自動補全，非常適合 TypeScript 或需要高度強型別保證的中大型專案。

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
