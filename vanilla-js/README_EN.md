# AI Avatar Bot (Vanilla JS)

[![npm version](https://img.shields.io/npm/v/ai-avatar-bot-vanilla-js.svg)](https://www.npmjs.com/package/ai-avatar-bot-vanilla-js)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[繁體中文](./README.md) | English

> Lightweight, modular, framework-agnostic interactive SDK for Web AI Digital Avatars (2D Live2D / 3D VRM).

`ai-avatar-bot-vanilla-js` is designed to effortlessly embed interactive 2D/3D AI digital avatars into modern web applications, featuring **Voice Interaction (STT/TTS)**, **Multi-Tier AI Brain Inference (Cloud AI / In-Browser WebGPU WebLLM)**, **Context Compression & Conversation Memory**, **Function Calling (Tools Management)**, and **Expressive Emotional Gestures**.

---

## 📑 Table of Contents

- [🌟 Key Features](#-key-features)
- [🏗️ Architecture](#️-architecture)
- [📦 Installation](#-installation)
- [🚀 Quick Start](#-quick-start)
- [⚙️ Configuration Options](#️-configuration-options)
- [🧠 In-Depth Guides](#-in-depth-guides)
  - [1. Brain Engine & Three-Tier Fallback Inference](#1-brain-engine--three-tier-fallback-inference)
  - [2. Context Compression & Memory Management](#2-context-compression--memory-management)
  - [3. Function Calling & Custom Tools (Tools Engine)](#3-function-calling--custom-tools-tools-engine)
  - [4. 2D (Live2D) & 3D (VRM) Dual Skin Engine](#4-2d-live2d--3d-vrm-dual-skin-engine)
  - [5. Speech Recognition & Neural TTS (Speech Engine)](#5-speech-recognition--neural-tts-speech-engine)
  - [6. Headless Mode & Custom UI Integration](#6-headless-mode--custom-ui-integration)
- [📚 Instance API & Methods](#-instance-api--methods)
- [🛠️ Build Tool Plugins (Vite & Webpack Offline Support)](#️-build-tool-plugins-vite--webpack-offline-support)
- [🌐 Internationalization (i18n)](#-internationalization-i18n)
- [📦 Third-Party Assets & Licenses](#-third-party-assets--licenses-must-read)
- [⚠️ Risk & Limitations Disclosure](#️-risk--limitations-disclosure)
- [🔐 Privacy & Data Flow](#-privacy--data-flow)
- [❓ Frequently Asked Questions (FAQ)](#-frequently-asked-questions-faq)
- [🤝 Credits & Original Author](#-credits--original-author)
- [📝 License](#-license)

---

## 🌟 Key Features

* 🧠 **Multi-Tier AI Brain (Brain Engine)**:
  * Supports Cloud AI Providers (Ollama, vLLM, OpenAI-compatible APIs, etc.).
  * Supports In-Browser On-Device Models via WebGPU (WebLLM, 100% offline & privacy-first).
  * Built-in 3-tier automatic fallback (AI Provider ➔ WebLLM ➔ Bigram Retrieval).
* 🗣️ **Full-Duplex / Continuous Speech System (Speech Engine)**:
  * Seamlessly unifies Speech-to-Text (STT) and Neural Text-to-Speech (TTS).
  * Supports Real-Time Barge-in interruption, Companion continuous conversation, audio queuing, and automated Lip Sync computation.
* 🎭 **2D / 3D Dual-Renderer Avatar (Skin Engine)**:
  * Supports Live2D (Pixi.js) and 3D VRM models (Three.js).
  * 8+ built-in emotional reactions and bodily gestures (happy, surprised, sad, wave, bow, relax, etc.).
  * Supports custom model loading, and optional drag-and-drop `.vrm` file hot-swapping via the `enableModelDrop` toggle (disabled by default for production security).
* 🛠️ **Extensible Tool Manager (Tools Engine)**:
  * Standardized Function Calling with 3 routing modes (Rule-based Client Match, AI Semantic Call, or Hybrid Mode).
  * Built-in Human-in-the-loop confirmation dialogs and JSON Schema parameter validation.
* 💾 **Smart Context Compression & Conversation Memory**:
  * Sliding Window and Rolling Summary compression strategies.
  * Cascading limits tailored specifically for WebLLM (conserving WebGPU VRAM) and cloud AI providers.
  * Safe tool-call pruning to prevent orphaned messages and API compliance errors.
* 🖥️ **Zero Framework Dependencies & Headless Architecture**:
  * Written in vanilla JavaScript (ES Module), easily integrating with React, Vue, Angular, Svelte, or native HTML pages.
  * Comes with a ready-to-use polished UI dock, while offering 100% headless mode for custom UI designs.

---

## 🏗️ Architecture

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

## 📦 Installation

### Via Package Managers

```bash
# npm
npm install ai-avatar-bot-vanilla-js

# pnpm
pnpm add ai-avatar-bot-vanilla-js

# yarn
yarn add ai-avatar-bot-vanilla-js
```

### Via CDN / Direct ES Module Import

```html
<script type="module">
  import { initAvatarBot } from 'https://cdn.jsdelivr.net/npm/ai-avatar-bot-vanilla-js/+esm';
</script>
```

---

## 🚀 Quick Start

### 1. HTML Container Setup

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Avatar Bot Demo</title>
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

### 2. Initialize Avatar Bot

```javascript
import { initAvatarBot, GENDER_MAP, AVATAR_MODE_MAP } from 'ai-avatar-bot-vanilla-js';

// Initialize and mount to target container
const avatarWidget = await initAvatarBot({
  container: document.getElementById('avatar-container'),
  
  // Persona mode: 'assistant' (Assistant) or 'companion' (Continuous chat Companion)
  avatarMode: AVATAR_MODE_MAP.assistant,
  gender: GENDER_MAP.female,
  
  // Brain model configuration (WebLLM in-browser model)
  llmModel: 'Hermes-3-Llama-3.1-8B-q4f32_1-MLC',
  
  // Static knowledge base for RAG / Retrieval
  knowledge: [
    {
      q: 'What are your business hours?',
      kw: 'business hours open close time',
      a: 'We are open Monday through Friday from 09:00 to 18:00.'
    }
  ],
  
  // Custom greeting
  welcomeText: 'Hello! I am your AI assistant. How may I help you today?',
  
  // Event listeners
  onReady: (widget) => {
    console.log('AI Avatar Bot is ready!', widget);
  },
  onSpeaking: (text) => {
    console.log('Avatar speaking:', text);
  },
  onError: (error) => {
    console.error('An error occurred:', error);
  }
});
```

---

## ⚙️ Configuration Options

Options object accepted by `initAvatarBot(options)`:

### General & UI Settings

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `container` | `HTMLElement` | `null` | **Required**. DOM container element to mount the avatar widget. |
| `avatarMode` | `string` | `'assistant'` | Persona mode: `'assistant'` \| `'companion'` or custom persona key. |
| `gender` | `string` | `'female'` | Default character gender (`'female'` \| `'male'`). |
| `locale` | `string` | `'zh-TW'` | UI and speech language code (`'en-US'`, `'zh-TW'`, `'ja-JP'`, `'ko-KR'`, etc.). |
| `i18nMessages` | `Object` | `{}` | Custom multi-language dictionary override messages. |
| `isMinimal` | `boolean` | `false` | Whether to start in minimal/collapsed floating bubble mode. |
| `isIframe` | `boolean` | `false` | Whether running inside an iframe. |

### Brain Engine & AI Provider Settings

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `enableAiProvider` | `boolean` | `false` | Whether to enable remote AI server provider (Ollama / custom API). |
| `aiProviderBaseUrl` | `string` | `''` | Base URL of the remote AI API server. |
| `aiProviderModel` | `string` | `'qwen2.5:latest'` | Model name for remote AI provider. |
| `aiProviderStream` | `boolean` | `true` | Whether to enable streaming for AI provider responses. |
| `aiProviderMaxTokens` | `number` | `2048` | Max response tokens for remote AI provider. |
| `aiProviderCreatedFetchSetting` | `Function\|Object` | `null` | Custom Fetch Header / RequestInit configuration. |
| `aiProviderCreatedFetchPayload` | `Function\|Object` | `null` | Custom JSON payload factory function or object. |
| `llmModel` | `string` | `'Qwen2.5-1.5B...'` | In-browser WebLLM model name. |
| `llmMaxTokens` | `number` | `1024` | Maximum response tokens limit for in-browser WebLLM. |
| `preloadWebLLM` | `boolean` | `false` | Whether to preload WebLLM weights immediately upon initialization. |
| `autoFallbackWebLLM` | `boolean` | `true` | Whether to auto-fallback to WebLLM if remote AI Provider fails. |
| `knowledge` | `Array\|string` | `null` | Preloaded knowledge base for assistant mode (JSON array or string). |
| `companionKnowledge` | `Array\|string` | `null` | Preloaded knowledge base for companion mode. |
| `modes` | `Object` | `null` | Declarative custom mode definitions (prompts, greetings, rules). |

### Memory & Context Compression

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `enableMemory` | `boolean` | `true` | Whether to enable conversation memory across turns. |
| `maxHistoryTurns` | `number` | `6` | Maximum conversation turns retained (1 turn = 1 user msg + 1 AI reply). |
| `memoryKey` | `string` | `'avatar-widget-memory'` | Key name for browser LocalStorage persistence. |
| `memoryAdapter` | `Object` | `null` | Custom storage adapter (must implement `get` and `set`). |
| `compression` | `Object` | `{}` | Context compression and VRAM budget controls (see guide below). |

### Speech & Skin Rendering

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `ttsEndpoint` | `string` | `'api/tts'` | Custom neural TTS backend API endpoint. |
| `neuralVoice` | `string` | `''` | Specified neural voice model identifier. |
| `startMode` | `string` | `'2d'` | Initial render mode: `'2d'` (Live2D) or `'3d'` (VRM). |
| `fitMode` | `string` | `'half'` | Stage fit mode: `'half'` (bust shot) or `'full'` (full body). |
| `modelUrl` | `string` | Built-in default | URL to 2D Live2D `.model3.json` file. |
| `vrmUrl` | `string` | Built-in default | URL to 3D VRM `.vrm` file. |
| `enableModelDrop` | `boolean` | `false` | Whether to allow users to drag and drop `.vrm` files onto canvas to hot-swap models (disabled by default for production security). |

### Tools & Plugins

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `tools` / `hostTools` | `Array<Object>` | `[]` | List of tools registered for AI Function Calling. |
| `enableEmotionTools` | `boolean` | `true` | Whether to enable built-in emotion and gesture tool plugin. |
| `confirmationTimeoutMs` | `number` | `60000` | Timeout in milliseconds for user authorization confirmations. |

### Event Callbacks

| Callback | Arguments | Description |
| :--- | :--- | :--- |
| `onReady(widget)` | `widget` | Triggered when all engines are loaded and mounted. |
| `onSpeaking(text, widget)` | `text, widget` | Triggered when the avatar begins speaking audio. |
| `onSpeakingEnd(widget)` | `widget` | Triggered when audio utterance playback finishes. |
| `onStreamEnd(fullText)` | `fullText` | Triggered when brain LLM stream text generation completes. |
| `onAddChatMessage(msg, widget)` | `msg, widget` | Triggered when a new chat message is added. |
| `onMicStateChanged(isListening, convoOn)` | `isListening, convoOn` | Triggered when microphone state changes. |
| `onVoiceStatusChanged(convoOn, text, state, level)` | Multiple state vars | Triggered when real-time voice volume/status updates. |
| `onToolCall(pendingCall, widget)` | `pendingCall, widget` | Triggered when an external tool is invoked. |
| `onToolNotFound(info, widget)` | `info, widget` | Triggered when AI calls an unregistered tool (can return custom result to model). |
| `onToolError(info, widget)` | `info, widget` | Triggered when tool execution fails (can return custom error result to model). |
| `onBrainFallback(from, to, error)` | `from, to, error` | Triggered when the brain engine falls back to another tier. |
| `onError(error, widget)` | `error, widget` | Triggered on unexpected runtime errors. |

---

## 🧠 In-Depth Guides

### 1. Brain Engine & Three-Tier Fallback Inference

The Brain Engine features a high-availability 3-tier architecture to ensure continuous user engagement:

1. **Tier 1: AI Provider (Remote AI Server)**
   * Connects to local Ollama, vLLM, or any OpenAI-compatible server.
2. **Tier 2: WebLLM (In-Browser WebGPU Model)**
   * Automatically executes on-device inference when offline or if the remote server fails.
3. **Tier 3: Retrieval (Bigram Keyword Match)**
   * Instant fallback to preloaded knowledge entries if WebGPU is unsupported or model loading fails.

#### Connecting to Ollama / Remote Provider:

```javascript
const widget = await initAvatarBot({
  container: document.getElementById('avatar-container'),
  enableAiProvider: true,
  aiProviderBaseUrl: 'http://localhost:11434/api/chat',
  aiProviderModel: 'qwen2.5:latest',
  
  // Custom payload builder for Ollama format
  aiProviderCreatedFetchPayload: (messages, isStream) => ({
    model: 'qwen2.5:latest',
    messages: messages,
    stream: isStream
  })
});
```

---

### 2. Context Compression & Memory Management

Engineered to prevent Token exhaustion and WebGPU Out-Of-Memory (OOM) crashes:

```javascript
const widget = await initAvatarBot({
  container: document.getElementById('avatar-container'),
  enableMemory: true,
  
  compression: {
    // Strategy: 'sliding-window' | 'rolling-summary' | 'none'
    strategy: 'sliding-window',
    
    maxTurns: 6,         // Global max conversation turns
    maxTotalChars: 4000, // Global character budget
    
    // WebLLM override (strict VRAM budget control)
    webLlm: {
      maxTurns: 3,
      maxTotalChars: 1500
    },
    
    // Remote AI Provider override (higher token capacity)
    aiProvider: {
      maxTurns: 8,
      maxTotalChars: 6000
    },
    
    // Custom compressor hook for custom summarization
    customCompressor: async ({ messages, systemPrompt, history, latestQuestion, limits }) => {
      return messages;
    }
  }
});
```

---

### 3. Function Calling & Custom Tools (Tools Engine)

Register custom tools with **Instant Client-Side Rule Matching**, **AI Semantic Calling**, or **Hybrid Mode**:

```javascript
const widget = await initAvatarBot({
  container: document.getElementById('avatar-container'),
  
  tools: [
    {
      name: 'get_weather',
      label: 'Check Weather',
      description: 'Check real-time weather conditions for a specific city.',
      keywords: ['weather', 'temperature', 'rain', 'forecast'],
      routingMode: 'hybrid', // 'client' | 'ai' | 'hybrid'
      requiresConfirmation: false, // Whether to require user confirmation dialog
      inputSchema: {
        type: 'object',
        properties: {
          city: {
            type: 'string',
            title: 'City Name',
            description: 'e.g. Taipei, Tokyo, New York'
          }
        },
        required: ['city']
      },
      execute: async ({ args }) => {
        const res = await fetch(`https://api.example.com/weather?city=${encodeURIComponent(args.city)}`);
        const data = await res.json();
        return `Weather in ${args.city}: ${data.weather}, Temperature: ${data.temperature}°C.`;
      }
    }
  ]
});
```

---

### 4. 2D (Live2D) & 3D (VRM) Dual Skin Engine

* **Switching 2D / 3D Modes**:
  ```javascript
  // Switch to 3D VRM
  widget.skinEngine.engineMode = '3d';

  // Switch to 2D Live2D
  widget.skinEngine.engineMode = '2d';
  ```
* **Controlling Emotions & Gestures**:
  ```javascript
  // Trigger specific emotion (happy, surprised, sad, thinking, neutral, wave, bow, relax)
  widget.skinEngine.setEmotion('happy');

  // Infer and trigger emotion automatically from text
  widget.setEmotionFromText('That is fantastic news!');
  ```
* **Loading Custom Models & Drag-and-Drop Hot Swapping**:
  ```javascript
  // 1. Programmatically load a VRM file
  const fileInput = document.getElementById('vrm-upload');
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      widget.skinEngine.loadVRMFile(file);
    }
  });

  // 2. Enable drag-and-drop replacement (disabled by default):
  // const widget = await initAvatarBot({ container, enableModelDrop: true });
  // Or toggle dynamically:
  widget.enableModelDrop = true;
  ```

---

### 5. Speech Recognition & Neural TTS (Speech Engine)

* **Trigger Speech Synthesis (TTS)**:
  ```javascript
  widget.speechEngine.speak('Glad to be of service!');
  ```
* **Start / Stop Microphone (STT)**:
  ```javascript
  // Start listening
  widget.speechEngine.startListening();

  // Stop listening
  widget.speechEngine.setMic(false);
  ```
* **Real-Time Voice Interruption (Barge-in)**:
  ```javascript
  // Interrupt ongoing AI speech and immediately listen to user
  widget.speechEngine.interruptForVoice();
  ```

---

### 6. Headless Mode & Custom UI Integration

To build your own interface with **Vue, React, Svelte, or Angular**, run in Headless mode and subscribe to reactive stores:

```javascript
import { initAvatarBot } from 'ai-avatar-bot-vanilla-js';

const widget = await initAvatarBot({
  container: document.getElementById('avatar-canvas-only'),
  isMinimal: true // Hide default floating UI dock
});

// Send messages programmatically to AI Brain
await widget.handleUser('What is the warranty policy?');

// Subscribe to speaking state for custom bubbles or animations
widget.speechEngine.subscribe('isSpeaking', (isSpeaking) => {
  console.log('Speaking state:', isSpeaking);
});

// Subscribe to real-time subtitle text updates
widget.speechEngine.subscribe('spokenDisplayText', (text) => {
  document.getElementById('my-custom-bubble').textContent = text;
});
```

---

## 📚 Instance API & Methods

`initAvatarBot` returns the `AiAvatarWidget` instance:

```typescript
interface AiAvatarWidget {
  // Core Sub-Engines
  brainEngine: BrainEngine;
  speechEngine: SpeechEngine;
  skinEngine: SkinEngine;
  toolsEngine: ToolsEngine;
  i18nEngine: I18nEngine;
  
  // Common Interaction Methods
  handleUser(text: string): Promise<void>; // Process user text input through AI Brain
  setEmotionFromText(text: string): void;   // Infer and trigger matching emotion/gesture
  classifyEmotion(text: string): string;    // Classify emotion string from text
  showMinimalEl(): void;                   // Show minimal floating avatar button
  hiddenMinimalEl(): void;                 // Hide minimal floating avatar button
  
  // State Properties & Getters/Setters
  avatarMode: 'assistant' | 'companion' | string; // Current persona mode
  gender: 'female' | 'male';                      // Current character gender
  locale: string;                                 // Current UI/Speech locale
  isMinimal: boolean;                             // Current minimal mode state
  enableModelDrop: boolean;                       // Model drag-and-drop toggle
}
```

---

## 🛠️ Build Tool Plugins (Vite & Webpack Offline Support)

To eliminate the need for manual file copying to `public/` after `npm install`, and to ensure that 2D/3D models and gestures load seamlessly **even in offline or air-gapped development environments**, this package includes dedicated build tool plugins for Vite and Webpack:

* **Local Development (Dev Server)**: The plugin automatically intercepts `/avatar-skin/*` requests and streams the files directly from `node_modules` using Node.js file system APIs (0 external network requests, 0 online CDN dependencies).
* **Production Build**: When building your project (`vite build` or `webpack build`), the plugin automatically copies the entire `avatar-skin` directory into your project's build output (`dist/avatar-skin/`).

### 1. Vite Project Setup (Vue 3, Nuxt, Svelte, Vite React)

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import { avatarBotVitePlugin } from 'ai-avatar-bot-vanilla-js/vite';

export default defineConfig({
  plugins: [
    avatarBotVitePlugin() // Zero configuration! Handles local dev proxy & build output copy
  ]
});
```

### 2. Webpack Project Setup (Create React App, Vue CLI, Webpack 5)

```javascript
// webpack.config.js or vue.config.js
const { AvatarBotWebpackPlugin } = require('ai-avatar-bot-vanilla-js/webpack');

module.exports = {
  plugins: [
    new AvatarBotWebpackPlugin() // Automatically handles Webpack DevServer proxy & build copy
  ]
};
```

---

## 🌐 Internationalization (i18n)

Built-in multi-language dictionary with dynamic locale switching:

```javascript
// Switch to English
widget.i18nEngine.setLocale('en-US');

// Switch to Japanese
widget.i18nEngine.setLocale('ja-JP');

// Switch to Traditional Chinese
widget.i18nEngine.setLocale('zh-TW');
```

Supported locale codes: `zh-TW` (Traditional Chinese), `zh-CN` (Simplified Chinese), `en-US` (English), `ja-JP` (Japanese), `ko-KR` (Korean).

---

## 📦 Third-Party Assets & Licenses (**MUST READ**)

The source code of this package is licensed under the **MIT License** (see [`LICENSE`](LICENSE)). However, this package **includes and references third-party libraries, proprietary runtimes, sample 2D/3D avatar models, and animation assets** that carry their own independent licenses and are **NOT covered by this project's MIT License**:

| Asset / Dependency | License / Source | Commercial & Usage Notice |
| :--- | :--- | :--- |
| **Live2D Cubism Core** (`cubism.live2d.com`) | **Proprietary License** (Live2D Proprietary Software License) | **Non-Open Source**. Loaded dynamically via official CDN. For commercial deployment, distribution, or bundling, you must ensure compliance with Live2D official terms and obtain appropriate licenses. |
| **Haru Sample Model** (`2d-model/female/haru_greeter_t03.*`) | Live2D **Free Material License** | **For technical demonstration and testing only**. Not authorized for direct commercial product deployment. Please replace with your own legitimately licensed Live2D model for production. |
| **Natori Sample Model** (`2d-model/male/natori_pro_t06.*`) | Live2D **Free Material License** | **For technical demonstration and testing only**. Not authorized for direct commercial product deployment. |
| **Shizuku Sound Files** (`2d-model/female/shizuku/sounds/*`) | Live2D **Free Material License** | Tap interaction sounds for sample testing and demonstration only. |
| **Hatsune Miku VRM Model** (`3d-model/HatsuneMiku.vrm`) | **Piapro Character License (PCL)** (Crypton Future Media) | Character IP © Crypton Future Media, INC. **Strictly for non-commercial personal derivative / technical demo use**. Commercial exploitation is strictly prohibited without authorization. |
| **Rockman.EXE VRM Model** (`3d-model/RockmanEXE.vrm`) | **Capcom Derivative Guidelines** (CAPCOM CO., LTD.) | Game IP © CAPCOM CO., LTD. **Strictly for non-commercial personal demonstration use**. |
| **VRMA Animation Library** (`3d-model/vrma/*.vrma` 6 motions) | **MIT / CC-BY 4.0** (Hirokazu Niimoto / VRM Consortium) | Includes wave, bow, thinking, look around, relax, and surprised motions. Open source and free for commercial/personal use. |
| **Pixi.js / pixi-live2d-display** | **MIT License** | Open-source 2D WebGL rendering engine and Live2D integration plugin. |
| **Three.js / @pixiv/three-vrm** | **MIT License** | Open-source 3D WebGL renderer and VRM avatar standard library. |
| **@mlc-ai/web-llm** (WebLLM) | **Apache-2.0** | In-browser WebGPU language model inference engine. Downloaded model weights (e.g. Qwen2.5, Hermes Llama 3.1, Gemma 2) are governed by their respective creators' license terms. |

---

## ⚠️ Risk & Limitations Disclosure

Please review the following constraints before deploying to production:

1. **TTS Voice Service & Custom Endpoints**:
   - This package is a **pure client-side SDK** and does not bundle any backend speech proxy servers. It provides a dual-track synthesis system: you can connect to your own neural TTS backend (e.g. Azure Cognitive Speech, OpenAI TTS, or custom API) via `ttsEndpoint`, or automatically fallback to browser native Web Speech API (`window.speechSynthesis`) when no endpoint is configured or if network calls fail.
   - Developers are responsible for managing their own API keys, quotas, and service terms when connecting third-party TTS backends.
2. **Speech Recognition (STT) Cloud Processing**:
   - Uses browser native Web Speech API (`webkitSpeechRecognition`). On Chrome and most browsers, **microphone audio is uploaded to browser vendor servers (e.g. Google) for speech recognition** and is not purely on-device. Please disclose this in your application's privacy policy.
3. **WebLLM Hardware & Compute Overhead**:
   - WebLLM runs entirely inside user browsers via WebGPU for privacy and zero server cost. However, initial loading requires downloading 1GB–5GB of model weights, requiring sufficient GPU VRAM. For unsupported hardware, configure `enableAiProvider: true` to connect to cloud APIs.
4. **Domain Knowledge Disclaimer**:
   - Built-in knowledge entries are strictly for technical demonstration. When applying this bot to specialized domains such as **medical advice, legal counsel, financial consulting, or critical decision-making**, developers must establish appropriate legal disclaimers.

---

## 🔐 Privacy & Data Flow

| Feature Module | Data Processing Location / Destination | Privacy & Security Note |
| :--- | :--- | :--- |
| **Speech-to-Text (STT)** | Microphone audio ➔ Browser vendor cloud (e.g. Google on Chrome) | Audio volume analysis is local; recognized text returns to client. |
| **Text-to-Speech (TTS)** | Utterance text ➔ Your configured `ttsEndpoint` or local browser | If using native speech, synthesized 100% locally. If remote, only sends utterance text. |
| **WebLLM Local Brain** | **100% In-Browser Client (WebGPU)** | Conversation data computed entirely in browser memory; never leaves client device. |
| **AI Provider Cloud Brain**| Context messages ➔ Your configured `aiProviderBaseUrl` | Processed according to your backend server (e.g. Ollama, self-hosted API, OpenAI). |
| **Conversation Memory** | **100% In-Browser Client** (`localStorage`) | Persisted locally on client device; never automatically uploaded to remote servers. |

---

## ❓ Frequently Asked Questions (FAQ)

### Q1: What browser environment is required for WebLLM on-device models?
> **A:** WebLLM requires **WebGPU** support. We recommend the latest versions of Chrome, Edge, or Safari 18+. For environments lacking WebGPU support, enable `enableAiProvider: true` to connect to remote AI servers, or rely on built-in retrieval fallback.

### Q2: Do Speech Synthesis (TTS) and Microphone (STT) require HTTPS?
> **A:** Yes. Due to modern browser security policies, Web Speech API and microphone recording permissions are strictly restricted to **HTTPS or `localhost`** environments.

### Q3: How do I customize or replace Live2D / VRM models?
> **A:** Pass `modelUrl` (2D `.model3.json`) or `vrmUrl` (3D `.vrm`) during initialization, or call `widget.skinEngine.loadVRMFile(file)` programmatically. If you want to allow user drag-and-drop replacement, explicitly set `enableModelDrop: true`.

---

## 🤝 Credits & Original Author

The foundational architecture and core design of this package are based on the open-source project [ai-avatar-bot](https://github.com/YuriCrystal/ai-avatar-bot) by **[YuriCrystal](https://github.com/YuriCrystal)**.

We express our sincere gratitude to the original author for the pioneering work and contributions to Web digital avatars, Live2D/VRM integrations, WebGPU on-device WebLLM inference, and natural speech dialogue systems! This project builds upon that foundation with modularization, architectural refactoring, strict engineering conventions, and npm packaging.

---

## 📝 License

This project's source code is licensed under the [MIT License](LICENSE).

> ⚠️ **Important Notice**: The MIT license covers only the project's own source code. Third-party dependencies, the proprietary Live2D Cubism Core runtime, sample character models (such as Haru and Seed-san), and neural voice services carry their own respective licenses and terms, which are not covered by this MIT license. Please review [Third-Party Assets & Licenses](#-third-party-assets--licenses-must-read) before commercial use.
