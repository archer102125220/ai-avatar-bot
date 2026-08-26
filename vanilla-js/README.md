# AI Avatar Bot (Vanilla JS)

[![npm version](https://img.shields.io/npm/v/ai-avatar-bot-vanilla-js.svg)](https://www.npmjs.com/package/ai-avatar-bot-vanilla-js)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> 輕量、模組化、零框架依賴的網頁端 AI 虛擬數位人（2D Live2D / 3D VRM）互動 SDK。

`ai-avatar-bot-vanilla-js` 專為在現代網頁中快速嵌入具備**語音互動（STT/TTS）**、**AI 大腦推論（雲端 AI / 本地 WebGPU WebLLM）**、**長對話記憶與上下文壓縮**、**外部工具調用（Function Calling）**以及**生動表情動作**的 2D/3D 虛擬數位人而設計。

---

## 📑 目錄

- [🌟 核心特色](#-核心特色)
- [🏗️ 架構設計](#️-架構設計)
- [📦 安裝方式](#-安裝方式)
- [🚀 快速開始](#-快速開始)
- [⚙️ 詳細設定選項 (Options)](#️-詳細設定選項-options)
- [🧠 進階功能指南](#-進階功能指南)
  - [1. 大腦引擎與三層降級推論](#1-大腦引擎與三層降級推論)
  - [2. 上下文壓縮與記憶管理](#2-上下文壓縮與記憶管理)
  - [3. Function Calling 與自訂工具 (Tools Engine)](#3-function-calling-與自訂工具-tools-engine)
  - [4. 2D (Live2D) 與 3D (VRM) 雙外觀引擎](#4-2d-live2d-與-3d-vrm-雙外觀引擎)
  - [5. 語音辨識與神經語音 (Speech Engine)](#5-語音辨識與神經語音-speech-engine)
  - [6. 無頭模式 (Headless Mode) 與自訂 UI](#6-無頭模式-headless-mode-與自訂-ui)
- [📚 實例 API 與方法](#-實例-api-與方法)
- [🌐 多語系支援 (i18n)](#-多語系支援-i18n)
- [❓ 常見問題 (FAQ)](#-常見問題-faq)
- [📝 授權 (License)](#-授權-license)

---

## 🌟 核心特色

* 🧠 **多層次 AI 大腦 (Brain Engine)**：
  * 支援雲端 AI 提供者（Ollama、OpenAI 相容 API 等）。
  * 支援瀏覽器端端側模型（基於 WebGPU 的 WebLLM，完全離線、保護隱私）。
  * 具備智慧三層自動降級（AI Provider ➔ WebLLM ➔ 關鍵字檢索後備）。
* 🗣️ **全雙工/連續對話語音系統 (Speech Engine)**：
  * 整合語音辨識 (STT) 與神經語音合成 (TTS)。
  * 支援即時語音打斷 (Barge-in)、陪伴模式連續對話、即時音訊串流佇列與自動對嘴 (Lip Sync)。
* 🎭 **2D / 3D 雙渲染外觀 (Skin Engine)**：
  * 支援 Live2D (Pixi.js) 與 VRM 3D 模型 (Three.js)。
  * 內建 8+ 種情緒反應與肢體動作手勢（喜悅、驚訝、悲傷、揮手、鞠躬、放鬆等）。
  * 支援自訂模型載入，並可透過安全開關（`enableModelDrop`，預設關閉）啟用拖曳 `.vrm` 檔案即時換裝。
* 🛠️ **強大靈活的工具管理器 (Tools Engine)**：
  * 支援標準化 Function Calling（前端純規則比對、AI 語意調用、雙軌混合模式）。
  * 內建 Human-in-the-loop 人工授權確認對話框與參數 JSON Schema 驗證。
* 💾 **智慧上下文壓縮與對話記憶 (Memory & Compression)**：
  * 滑動窗口 (Sliding Window) 與滾動摘要 (Rolling Summary) 策略。
  * 針對端側 WebLLM（節省顯存）與雲端 AI Provider 實施階層式雙軌預算。
  * 工具調用安全成對修剪（Safe Tool Call Pruning），防止 API 報錯。
* 🖥️ **零依賴與無頭架構 (Zero Dependencies & Headless)**：
  * 核心採用純 JavaScript (ES Module) 撰寫，相容 React、Vue、Angular、Svelte 或任何原生網頁專案。
  * 提供精美的預設控制介面，同時支援 Headless 模式供開發者 100% 自訂 UI。

---

## 🏗️ 架構設計

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

---

## 📦 安裝方式

### 透過套件管理器安裝

```bash
# npm
npm install ai-avatar-bot-vanilla-js

# pnpm
pnpm add ai-avatar-bot-vanilla-js

# yarn
yarn add ai-avatar-bot-vanilla-js
```

### 透過 CDN 或 ES Module 引入

```html
<script type="module">
  import { initAvatarBot } from 'https://cdn.jsdelivr.net/npm/ai-avatar-bot-vanilla-js/+esm';
</script>
```

---

## 🚀 快速開始

### 1. 準備 HTML 容器

```html
<!DOCTYPE html>
<html lang="zh-TW">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Avatar Bot 範例</title>
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
    <script type="module" src="./main.js"></script>
  </body>
</html>
```

### 2. 初始化 Avatar Bot

```javascript
import { initAvatarBot, GENDER_MAP, AVATAR_MODE_MAP } from 'ai-avatar-bot-vanilla-js';

// 初始化並掛載至指定容器
const avatarWidget = await initAvatarBot({
  container: document.getElementById('avatar-container'),
  
  // 角色模式：'assistant' (助理模式) 或 'companion' (陪伴連續對話模式)
  avatarMode: AVATAR_MODE_MAP.assistant,
  gender: GENDER_MAP.female,
  
  // 大腦模型配置（可選擇本地 WebLLM 或雲端 AI Provider）
  llmModel: 'Hermes-3-Llama-3.1-8B-q4f32_1-MLC',
  
  // 知識庫資料（支援 RAG 檢索問答）
  knowledge: [
    {
      q: '你們的營業時間是幾點？',
      kw: '營業時間 幾點 上班',
      a: '我們的營業時間為週一至週五 09:00 - 18:00。'
    }
  ],
  
  // 歡迎詞
  welcomeText: '你好！我是你的專屬 AI 助理，有什麼我可以幫忙的嗎？',
  
  // 回呼事件監聽
  onReady: (widget) => {
    console.log('AI Avatar Bot 初始化完成！', widget);
  },
  onSpeaking: (text) => {
    console.log('虛擬人正在說話：', text);
  },
  onError: (error) => {
    console.error('發生錯誤：', error);
  }
});
```

---

## ⚙️ 詳細設定選項 (Options)

傳入 `initAvatarBot(options)` 的設定物件支援以下屬性：

### 基本與介面設定

| 參數名 | 類型 | 預設值 | 說明 |
| :--- | :--- | :--- | :--- |
| `container` | `HTMLElement` | `null` | **必填**。虛擬人掛載的 DOM 容器元素 |
| `avatarMode` | `string` | `'assistant'` | 角色模式：`'assistant'` (助理模式) 或 `'companion'` (陪伴模式) 或自訂模式 |
| `gender` | `string` | `'female'` | 角色預設性別 (`'female'` \| `'male'`) |
| `locale` | `string` | `'zh-TW'` | 介面與語音語言代碼 (`'zh-TW'`, `'en-US'`, `'ja-JP'`, `'ko-KR'` 等) |
| `i18nMessages` | `Object` | `{}` | 自訂多語系擴充字典訊息 |
| `isMinimal` | `boolean` | `false` | 是否以極簡浮動收合模式啟動 |
| `isIframe` | `boolean` | `false` | 是否在 Iframe 環境中執行 |

### 大腦推論與 AI Provider 設定

| 參數名 | 類型 | 預設值 | 說明 |
| :--- | :--- | :--- | :--- |
| `enableAiProvider` | `boolean` | `false` | 是否啟用遠端 AI 提供者服務（如 Ollama / 自建 API） |
| `aiProviderBaseUrl` | `string` | `''` | 遠端 AI 服務的 API 基礎網址 |
| `aiProviderModel` | `string` | `'qwen2.5:latest'` | 遠端 AI 服務使用的模型名稱 |
| `aiProviderStream` | `boolean` | `true` | 遠端 AI 服務是否啟用串流 (Streaming) 傳輸 |
| `aiProviderMaxTokens` | `number` | `2048` | AI 回應的最大 Token 數上限 |
| `aiProviderCreatedFetchSetting` | `Function\|Object` | `null` | 自訂遠端 API 的 Fetch Header / RequestInit 設定 |
| `aiProviderCreatedFetchPayload` | `Function\|Object` | `null` | 自訂送出給 AI 提供者的 JSON Payload 結構 |
| `llmModel` | `string` | `'Qwen2.5-1.5B...'` | 瀏覽器端 WebLLM 模型名稱 |
| `preloadWebLLM` | `boolean` | `false` | 是否在初始化時即刻預載 WebLLM 權重檔案 |
| `autoFallbackWebLLM` | `boolean` | `true` | 當 AI Provider 連線失敗時是否自動啟動 WebLLM 備援 |
| `knowledge` | `Array\|string` | `null` | 助理模式預載的知識庫資料 (JSON Array 或字串) |
| `companionKnowledge` | `Array\|string` | `null` | 陪伴模式預載的知識庫資料 |
| `modes` | `Object` | `null` | 宣告式自訂模式註冊表（自訂專屬人格、Prompt、問候語） |

### 記憶與上下文壓縮設定 (Memory & Compression)

| 參數名 | 類型 | 預設值 | 說明 |
| :--- | :--- | :--- | :--- |
| `enableMemory` | `boolean` | `true` | 是否啟用對話歷史記憶與多輪對話管理 |
| `maxHistoryTurns` | `number` | `6` | 保留的最大對話輪數（1 輪 = 1 問 + 1 答） |
| `memoryKey` | `string` | `'avatar-widget-memory'` | 本機 Storage 記憶儲存的 Key 名稱 |
| `memoryAdapter` | `Object` | `null` | 自訂儲存轉接器（需實作 `get` 與 `set`） |
| `compression` | `Object` | `{}` | 上下文動態壓縮與顯存控制設定（詳見後文） |

### 語音與外觀設定 (Speech & Skin)

| 參數名 | 類型 | 預設值 | 說明 |
| :--- | :--- | :--- | :--- |
| `ttsEndpoint` | `string` | `'api/tts'` | 神經語音合成 (TTS) 後端 API 端點 |
| `neuralVoice` | `string` | `''` | 指定使用的微軟神經網路語音名稱 |
| `startMode` | `string` | `'2d'` | 初始渲染模式：`'2d'` (Live2D) 或 `'3d'` (VRM) |
| `fitMode` | `string` | `'half'` | 畫面適應模式：`'half'` (半身) 或 `'full'` (全身) |
| `modelUrl` | `string` | 內建預設模型 | 2D Live2D 模型的 `.model3.json` 檔案網址 |
| `vrmUrl` | `string` | 內建預設模型 | 3D VRM 模型的 `.vrm` 檔案網址 |
| `enableModelDrop` | `boolean` | `false` | 是否允許使用者拖曳 `.vrm` 模型檔案至畫布即時換裝（預設關閉以維護正式產品安全） |

### 工具擴充與外掛 (Tools & Plugins)

| 參數名 | 類型 | 預設值 | 說明 |
| :--- | :--- | :--- | :--- |
| `tools` / `hostTools` | `Array<Object>` | `[]` | 註冊給大腦調用的 Function Calling 工具清單 |
| `enableEmotionTools` | `boolean` | `true` | 是否自動啟用內建的情緒動作工具外掛 |
| `confirmationTimeoutMs` | `number` | `60000` | 工具需要使用者確認時的逾時毫秒數 (預設 60 秒) |

### 事件回呼 (Callbacks & Event Hooks)

| 回呼函式名 | 參數 | 說明 |
| :--- | :--- | :--- |
| `onReady(widget)` | `widget` | 虛擬人所有引擎載入完成並掛載後觸發 |
| `onSpeaking(text, widget)` | `text, widget` | 虛擬人開始播放語音發音時觸發 |
| `onSpeakingEnd(widget)` | `widget` | 虛擬人語音播放結束時觸發 |
| `onAddChatMessage(msg, widget)` | `msg, widget` | 新增對話訊息時觸發 |
| `onMicStateChanged(isListening, convoOn)` | `isListening, convoOn` | 麥克風錄音狀態變更時觸發 |
| `onVoiceStatusChanged(convoOn, text, state, level)` | 多項語音狀態 | 即時音訊音量與語音狀態變化時觸發 |
| `onToolCall(pendingCall, widget)` | `pendingCall, widget` | 外部工具被觸發時回呼 |
| `onBrainFallback(from, to, error)` | `from, to, error` | 當大腦推論引擎發生降級切換時觸發 |
| `onError(error, widget)` | `error, widget` | 發生未預期錯誤時觸發 |

---

## 🧠 進階功能指南

### 1. 大腦引擎與三層降級推論

大腦引擎內建高可用三層架構，確保虛擬人在任何網路環境下皆能流暢回應：

1. **第 1 層：AI Provider (遠端 AI 伺服器)**
   * 支援對接本地 Ollama、vLLM 或 OpenAI 相容格式的後端。
2. **第 2 層：WebLLM (瀏覽器 WebGPU 端側模型)**
   * 當雲端 API 斷線或使用者選擇離線時，自動載入本機端模型執行推論。
3. **第 3 層：Retrieval (Bigram 關鍵字檢索)**
   * 若無 WebGPU 支援或模型載入失敗，以極速比對知識庫條目提供精確解答。

#### 連接自訂 Ollama / AI Provider 範例：

```javascript
const widget = await initAvatarBot({
  container: document.getElementById('avatar-container'),
  enableAiProvider: true,
  aiProviderBaseUrl: 'http://localhost:11434/api/chat',
  aiProviderModel: 'qwen2.5:latest',
  
  // 自訂送出 Payload 格式
  aiProviderCreatedFetchPayload: (messages, isStream) => ({
    model: 'qwen2.5:latest',
    messages: messages,
    stream: isStream
  })
});
```

---

### 2. 上下文壓縮與記憶管理

專為 Web 虛擬人設計的顯存與 Token 防爆機制：

```javascript
const widget = await initAvatarBot({
  container: document.getElementById('avatar-container'),
  enableMemory: true,
  
  compression: {
    // 壓縮策略：'sliding-window' | 'rolling-summary' | 'none'
    strategy: 'sliding-window',
    
    maxTurns: 6,         // 全域預設保留對話輪數
    maxTotalChars: 4000, // 全域字元預算上限
    
    // 針對端側 WebLLM 個別覆寫（嚴格節省 WebGPU 記憶體）
    webLlm: {
      maxTurns: 3,
      maxTotalChars: 1500
    },
    
    // 針對雲端 AI Provider 個別覆寫（高容量模式）
    aiProvider: {
      maxTurns: 8,
      maxTotalChars: 6000
    },
    
    // 自訂壓縮器 Hook (可自訂演算法或摘要邏輯)
    customCompressor: async ({ messages, systemPrompt, history, latestQuestion, limits }) => {
      // 回傳符合 OpenAI messages 結構的陣列
      return messages;
    }
  }
});
```

---

### 3. Function Calling 與自訂工具 (Tools Engine)

您可以註冊自訂工具讓虛擬人調用。支援**純前端關鍵字秒級匹配**、**AI 語意調用**以及**雙軌模式 (Hybrid)**：

```javascript
const widget = await initAvatarBot({
  container: document.getElementById('avatar-container'),
  
  // 註冊工具清單
  tools: [
    {
      name: 'get_weather',
      label: '查詢天氣',
      description: '查詢特定城市的即時天氣狀況。',
      keywords: ['天氣', '氣溫', '下雨', '氣象'],
      routingMode: 'hybrid', // 'client' | 'ai' | 'hybrid'
      requiresConfirmation: false, // 是否需要彈窗讓使用者點擊確認
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
      // 執行函式
      execute: async ({ args }) => {
        const res = await fetch(`https://api.example.com/weather?city=${encodeURIComponent(args.city)}`);
        const data = await res.json();
        return `【${args.city}】目前天氣：${data.weather}，氣溫：${data.temperature}°C。`;
      }
    }
  ]
});
```

---

### 4. 2D (Live2D) 與 3D (VRM) 雙外觀引擎

* **動態切換 2D / 3D**：
  ```javascript
  // 切換至 3D 模式
  widget.skinEngine.engineMode = '3d';

  // 切換至 2D 模式
  widget.skinEngine.engineMode = '2d';
  ```
* **控制情緒與動作**：
  ```javascript
  // 觸發特定情緒 (happy, surprised, sad, thinking, neutral, wave, bow, relax)
  widget.skinEngine.setEmotion('happy');

  // 根據語句自動推斷並切換情緒
  widget.setEmotionFromText('太棒了，真是個好消息！');
  ```
* **載入自訂模型檔案與拖曳換裝**：
  ```javascript
  // 1. 程式化載入自訂 VRM 檔案（例如透過檔案上傳按鈕）
  const fileInput = document.getElementById('vrm-upload');
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      widget.skinEngine.loadVRMFile(file);
    }
  });

  // 2. 若欲允許使用者直接拖曳 .vrm 檔案到畫布進行即時換裝，需在初始化時顯式啟用（預設關閉）：
  // const widget = await initAvatarBot({ container, enableModelDrop: true });
  // 亦可動態開關：
  widget.enableModelDrop = true; // 開啟拖曳換裝
  ```

---

### 5. 語音辨識與神經語音 (Speech Engine)

* **主動發音 (TTS)**：
  ```javascript
  widget.speechEngine.speak('很高興為你服務！');
  ```
* **啟動 / 停止麥克風聆聽 (STT)**：
  ```javascript
  // 開始聆聽
  widget.speechEngine.startListening();

  // 停止聆聽
  widget.speechEngine.setMic(false);
  ```
* **語音即時打斷 (Barge-in)**：
  ```javascript
  // 中斷當前 AI 說話並立即開啟麥克風聆聽使用者
  widget.speechEngine.interruptForVoice();
  ```

---

### 6. 無頭模式 (Headless Mode) 與自訂 UI

如果您想使用 **Vue、React 或 Svelte** 完全接管 UI 介面，可以直接使用 Headless 模式或訂閱底層 Store 狀態：

```javascript
import { initAvatarBot } from 'ai-avatar-bot-vanilla-js';

const widget = await initAvatarBot({
  container: document.getElementById('avatar-canvas-only'),
  isMinimal: true // 隱藏預設浮動面板，完全透過 API 控制
});

// 透過 API 發送訊息給虛擬人大腦
await widget.handleUser('請問這款產品有保固嗎？');

// 訂閱說話狀態以自訂 React / Vue 上的對話泡泡或指示燈
widget.speechEngine.subscribe('isSpeaking', (isSpeaking) => {
  console.log('說話狀態改變：', isSpeaking);
});

// 訂閱字幕文字變更
widget.speechEngine.subscribe('spokenDisplayText', (text) => {
  document.getElementById('my-custom-bubble').textContent = text;
});
```

---

## 📚 實例 API 與方法

初始化完成後，`initAvatarBot` 會回傳 `AiAvatarWidget` 實例，包含以下常用屬性與方法：

```typescript
interface AiAvatarWidget {
  // 核心模組實例
  brainEngine: BrainEngine;
  speechEngine: SpeechEngine;
  skinEngine: SkinEngine;
  toolsEngine: ToolsEngine;
  i18nEngine: I18nEngine;
  
  // 常用控制方法
  handleUser(text: string): Promise<void>; // 模擬使用者輸入文字並讓大腦思考回覆
  setEmotionFromText(text: string): void;   // 解析文字並自動切換模型表情與手勢
  classifyEmotion(text: string): string;    // 分析文字並取得情緒名稱
  showMinimalEl(): void;                   // 顯示極簡模式懸浮按鈕
  hiddenMinimalEl(): void;                 // 隱藏極簡模式懸浮按鈕
  
  // 狀態與設定屬性
  avatarMode: 'assistant' | 'companion' | string; // 目前角色模式
  gender: 'female' | 'male';                      // 目前角色性別
  locale: string;                                 // 目前語系
  isMinimal: boolean;                             // 是否處於極簡模式
}
```

---

## 🌐 多語系支援 (i18n)

SDK 內建多國語言介面字典，可隨時動態切換：

```javascript
// 動態切換為英文
widget.i18nEngine.setLocale('en-US');

// 動態切換為日文
widget.i18nEngine.setLocale('ja-JP');

// 動態切換為繁體中文
widget.i18nEngine.setLocale('zh-TW');
```

支援的語系代碼：`zh-TW`（繁中）、`zh-CN`（簡中）、`en-US`（英文）、`ja-JP`（日文）、`ko-KR`（韓文）。

---

## ❓ 常見問題 (FAQ)

### Q1: WebLLM 本地模型需要什麼瀏覽器環境？
> **A:** WebLLM 依賴瀏覽器的 **WebGPU** 技術。推薦使用最新版 Chrome、Edge 或 Safari 18+。若使用者環境不支援 WebGPU，建議啟用 `enableAiProvider: true` 對接遠端伺服器，或依賴內建的檢索式後備機制。

### Q2: 語音合成 (TTS) 與麥克風 (STT) 是否需要 HTTPS？
> **A:** 是的。現代瀏覽器基於安全性考量，Web Speech API 與麥克風錄音權限通常**僅限在 HTTPS 或 `localhost` 本機環境下執行**。

### Q3: 如何自訂或替換 Live2D / VRM 模型？
> **A:** 可以在初始化時傳入 `modelUrl`（2D `.model3.json`）或 `vrmUrl`（3D `.vrm`），或是透過程式呼叫 `widget.skinEngine.loadVRMFile(file)` 進行動態替換。若有讓使用者拖曳檔案上傳的需求，可顯式開啟 `enableModelDrop: true` 選項。

---

## 📝 授權 (License)

本專案遵循 [MIT License](LICENSE) 條款開源與發布。歡迎自由使用、修改與整合於商業或開源專案中。
