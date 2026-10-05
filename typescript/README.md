# AI Avatar Bot (TypeScript)

[![npm version](https://img.shields.io/npm/v/ai-avatar-bot-typescript.svg)](https://www.npmjs.com/package/ai-avatar-bot-typescript)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[繁體中文](./README_ZH.md) | English

> Lightweight, strictly typed, modular, and framework-agnostic interactive SDK for Web AI Digital Avatars (2D Live2D / 3D VRM).

`ai-avatar-bot-typescript` is the **100% native TypeScript implementation** of the AI Avatar Bot ecosystem. Engineered for high-reliability web applications, it provides complete compile-time type safety, rich generic abstractions, first-class IDE autocompletion, and bundled declaration files (`.d.ts`). Effortlessly embed interactive 2D/3D digital avatars featuring **Voice Interaction (STT/TTS)**, **Multi-Tier AI Brain Inference (Cloud AI / In-Browser WebGPU WebLLM)**, **Context Compression & Conversation Memory**, **Function Calling (Tools Management)**, and **Expressive Emotional Gestures**.

---

## 📑 Table of Contents

- [🌟 Key Features & TypeScript Highlights](#-key-features--typescript-highlights)
- [🏗️ Architecture](#️-architecture)
- [📦 Installation & Setup](#-installation--setup)
  - [Package Managers](#package-managers)
  - [CDN Usage (ESM / Traditional `<script>` Tag)](#cdn-usage-esm--traditional-script-tag)
  - [Modular Subpath Imports](#modular-subpath-imports)
  - [Peer Dependencies & Lightweight Best Practices](#peer-dependencies--lightweight-best-practices)
- [🚀 Quick Start (TypeScript)](#-quick-start-typescript)
- [🗂️ Asset Management & CLI Sync Tool (`sync`)](#️-asset-management--cli-sync-tool-sync)
- [🔌 Framework & Build Tool Plugins](#-framework--build-tool-plugins)
  - [1. Vite (Vue 3, Svelte, Vite React)](#1-vite-vue-3-svelte-vite-react)
  - [2. Next.js (App Router / Pages Router)](#2-nextjs-app-router--pages-router)
  - [3. Nuxt 3 (Nuxt Module)](#3-nuxt-3-nuxt-module)
  - [4. Webpack (Create React App, Vue CLI, Webpack 5)](#4-webpack-create-react-app-vue-cli-webpack-5)
  - [5. AnalogJS (Angular Meta-Framework)](#5-analogjs-angular-meta-framework)
  - [6. Node.js Path Resolution Helpers](#6-nodejs-path-resolution-helpers)
- [⚙️ Configuration Options (AvatarBotOptions)](#️-configuration-options-avatarbotoptions)
- [🧠 In-Depth Guides](#-in-depth-guides)
  - [1. Brain Engine & Three-Tier Fallback Inference](#1-brain-engine--three-tier-fallback-inference)
  - [2. Auto-Continue Response Mechanism](#2-auto-continue-response-mechanism)
  - [3. Memory Management, Data Schema & Custom Storage Adapter](#3-memory-management-data-schema--custom-storage-adapter)
  - [4. Function Calling & Custom Tools (Tools Engine)](#4-function-calling--custom-tools-tools-engine)
  - [5. 2D (Live2D) & 3D (VRM) Dual Skin Engine](#5-2d-live2d--3d-vrm-dual-skin-engine)
  - [6. Speech Recognition & Neural TTS (Speech Engine)](#6-speech-recognition--neural-tts-speech-engine)
  - [7. Headless Mode & Custom UI Integration](#7-headless-mode--custom-ui-integration)
- [📐 Exported TypeScript Types Reference](#-exported-typescript-types-reference)
- [📚 Instance API & Methods (AiAvatarWidget)](#-instance-api--methods-aiavatarwidget)
- [🌐 Internationalization (i18n)](#-internationalization-i18n)
- [📦 Third-Party Assets & Licenses](#-third-party-assets--licenses-must-read)
- [🧪 Testing & Quality Assurance](#-testing--quality-assurance)
- [⚠️ Risk & Limitations Disclosure](#️-risk--limitations-disclosure)
- [🔐 Privacy & Data Flow](#-privacy--data-flow)
- [❓ Frequently Asked Questions (FAQ)](#-frequently-asked-questions-faq)
- [🤝 Credits & Attribution](#-credits--attribution)
- [📝 License](#-license)

---

## 🌟 Key Features & TypeScript Highlights

* 🔷 **100% Pure TypeScript & Zero `any` Ambiguity**:
  * Written natively in modern TypeScript (ES2022+ / Bundler resolution).
  * Generates high-fidelity `.d.ts` declaration maps with thorough JSDoc annotations for immediate inline documentation in VS Code, WebStorm, and Cursor.
* 🧠 **Multi-Tier AI Brain (Brain Engine)**:
  * Connects to Cloud AI Providers (Ollama, vLLM, OpenAI-compatible APIs) with type-safe request/payload factory hooks (`AiProviderFetchSettingFactory`, `AiProviderFetchPayloadFactory`).
  * In-Browser On-Device Models via WebGPU (WebLLM, 100% offline & client-side).
  * Automated 3-tier fallback: AI Provider ➔ WebLLM ➔ Bigram Knowledge Retrieval.
* 🗣️ **Full-Duplex / Continuous Speech System (Speech Engine)**:
  * Unifies Speech-to-Text (STT) and Neural Text-to-Speech (TTS) with strong lifecycle typings.
  * Real-Time Barge-in voice interruption, Companion continuous conversation, audio queuing, and automated Lip Sync.
* 🎭 **2D / 3D Dual-Renderer Avatar (Skin Engine)**:
  * Supports Live2D (Pixi.js) and 3D VRM models (Three.js) with spatial geometry interfaces (`Vector3Coord`, `Point2D`, `Vector3Scale`).
  * 8+ built-in emotional gestures (happy, surprised, sad, goodbye, bow, relax, etc.) and runtime VRM hot-swapping.
* 🛠️ **Type-Safe Function Calling (Tools Engine)**:
  * Strict `ToolDefinition` interfaces with JSON Schema parameter validation.
  * 3 routing modes (`'client'`, `'ai'`, `'hybrid'`) and built-in Human-in-the-loop confirmation dialogs.
* 💾 **Smart Context Compression & Conversation Memory**:
  * Sliding Window and Rolling Summary compression strategies with cascading limits.
  * Strongly typed `MemoryData` schema and extensible `MemoryAdapter` interface for custom storage backends (Redis, IndexedDB, etc.).
* 🖥️ **Framework-Agnostic & Headless Ready**:
  * Clean architectural separation allowing 100% headless usage with React 18/19, Vue 3, Svelte 5, or Angular.

---

## 🏗️ Architecture

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
│ 📦 BaseStore<T> (Strongly Typed Reactive State Management)   │
└──────────────────────────────────────────────────────────────┘
```

---

## 📦 Installation & Setup

### Package Managers

```bash
# yarn (recommended)
yarn add ai-avatar-bot-typescript

# npm
npm install ai-avatar-bot-typescript

# pnpm
pnpm add ai-avatar-bot-typescript
```

### CDN Usage (ESM / Traditional `<script>` Tag)

`ai-avatar-bot-typescript` provides a dual-build architecture supporting both modern module bundlers and CDN script tags:

#### 1. ES Module CDN (`+esm`)
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/ai-avatar-bot-typescript/dist/ai-avatar-bot.css" />

<script type="module">
  import { initAvatarBot } from 'https://cdn.jsdelivr.net/npm/ai-avatar-bot-typescript/+esm';
  // Or via unpkg: https://unpkg.com/ai-avatar-bot-typescript?module
</script>
```

#### 2. Traditional `<script>` Tag (IIFE, attached to `window.AiAvatarBot`)
```html
<link rel="stylesheet" href="https://unpkg.com/ai-avatar-bot-typescript/dist/ai-avatar-bot.css" />

<!-- Load standalone IIFE bundle -->
<script src="https://unpkg.com/ai-avatar-bot-typescript/dist/ai-avatar-bot.iife.js"></script>
<script>
  // All exported functions are mounted globally on window.AiAvatarBot
  const { initAvatarBot, GENDER_MAP, AVATAR_MODE_MAP } = window.AiAvatarBot;
</script>
```

---

### Modular Subpath Imports

The package leverages modern `package.json` `exports` subpaths, enabling fine-grained on-demand imports and dedicated TypeScript declaration files:

```typescript
// 1. Full-Featured Entry (UI + Orchestrator)
import { initAvatarBot } from 'ai-avatar-bot-typescript';
import 'ai-avatar-bot-typescript/style.css';

// 2. Brain & Memory Subsystems only
import { BrainEngine, MemoryManager, WebLLMAdapter } from 'ai-avatar-bot-typescript/brain';

// 3. Speech Engine only (STT / Neural TTS)
import { SpeechEngine, WebSpeechStt, EdgeNeuralTts } from 'ai-avatar-bot-typescript/speech';

// 4. Skin Engine only (2D Live2D / 3D VRM)
import { SkinEngine } from 'ai-avatar-bot-typescript/skin';

// 5. Tools Engine only (Function Calling & Routing)
import { ToolsEngine } from 'ai-avatar-bot-typescript/tools';

// 6. i18n Engine only
import { I18nEngine } from 'ai-avatar-bot-typescript/i18n';

// 7. Constants and Maps
import { GENDER_MAP, AVATAR_MODE_MAP, EmotionState } from 'ai-avatar-bot-typescript/constants';

// 8. Type Definitions only
import type { AvatarBotOptions, AiAvatarWidget, ToolDefinition } from 'ai-avatar-bot-typescript/types';
```

---

### Peer Dependencies & Lightweight Best Practices

To prevent **multiple instances of Three.js** in host applications and keep the core package ultra-compact at **223KB (-96.9%)**, heavy rendering and AI engines are declared as **optional `peerDependencies`**.

Install only what your application requires:

```bash
# 🎯 Scenario A: If using 3D VRM rendering
yarn add three @pixiv/three-vrm @pixiv/three-vrm-animation

# 🎯 Scenario B: If using 2D Live2D rendering
yarn add pixi.js pixi-live2d-display

# 🎯 Scenario C: If using In-Browser WebGPU WebLLM
yarn add @mlc-ai/web-llm

# 🎯 Scenario D: All engines enabled
yarn add three @pixiv/three-vrm @pixiv/three-vrm-animation pixi.js pixi-live2d-display @mlc-ai/web-llm
```

> [!TIP]
> If your application only uses remote AI providers (e.g., Ollama / OpenAI API) and 2D Live2D models, you do **not** need to install `three` or `@mlc-ai/web-llm`.

---

## 🚀 Quick Start (TypeScript)

### 1. HTML Container

```html
<!DOCTYPE html>
<html lang="en">
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

### 2. Initialize Avatar Bot in TypeScript

```typescript
import { 
  initAvatarBot, 
  type AvatarBotOptions, 
  type AiAvatarWidget,
  type KnowledgeEntry 
} from 'ai-avatar-bot-typescript';
import 'ai-avatar-bot-typescript/style.css';

// 1. Prepare typed knowledge entries
const knowledgeBase: KnowledgeEntry[] = [
  {
    q: 'What is this project?',
    kw: 'project avatar bot typescript',
    a: 'This is the official TypeScript edition of AI Avatar Bot.'
  }
];

// 2. Strongly typed options
const options: AvatarBotOptions = {
  container: document.getElementById('avatar-container'),
  
  // Persona & Voice
  avatarMode: 'assistant',
  gender: 'female',
  locale: 'en-US',
  
  // Brain Engine Configuration (WebLLM in-browser inference)
  llmModel: 'Hermes-3-Llama-3.1-8B-q4f32_1-MLC',
  welcomeText: 'Hello! I am your AI avatar assistant built with TypeScript.',
  knowledge: knowledgeBase,
  
  // Context Compression & Memory Budget
  enableMemory: true,
  compression: {
    strategy: 'sliding-window',
    maxTurns: 6,
    maxTotalChars: 4000
  },

  // Lifecycle Callbacks
  onReady: (widget: AiAvatarWidget) => {
    console.log('Avatar Bot ready!', widget);
  },
  onSpeaking: (text: string) => {
    console.log('Avatar speaking:', text);
  },
  onError: (error: Error) => {
    console.error('Runtime error:', error);
  }
};

// 3. Mount and start
const widget: AiAvatarWidget = await initAvatarBot(options);
```

---

## 🗂️ Asset Management & CLI Sync Tool (`sync`)

The package includes complete 2D (Live2D) and 3D (VRM) model assets located under the `avatar-skin/` directory.

To allow local development servers to serve model assets without manual file copying or path searching, the package provides an **automated CLI sync tool**:

```bash
# 🎯 Automatically detect host project framework (Next.js / Nuxt / Angular / Vite) and sync assets
npx ai-avatar-bot sync

# 🎯 When using Yarn
yarn ai-avatar-bot sync

# 🎯 Dry run simulation (lists target files without modifying disk)
npx ai-avatar-bot sync --dry-run

# 🎯 Manually specify custom destination directory
npx ai-avatar-bot sync --out src/assets/avatar-skin

# 🎯 Skip existing files without overwriting
npx ai-avatar-bot sync --no-overwrite
```

### Auto-Detection Rules:
* **Angular Projects** (`angular.json`) ➔ syncs to `src/assets/avatar-skin`
* **Next.js Projects** (`next.config.*`) ➔ syncs to `public/avatar-skin`
* **Nuxt Projects** (`nuxt.config.*`) ➔ syncs to `public/avatar-skin`
* **Standard Web Projects** (with `public/` directory) ➔ syncs to `public/avatar-skin`

---

## 🔌 Framework & Build Tool Plugins

In addition to the CLI, the package provides zero-config build plugins with native TypeScript support. These proxy requests directly from `node_modules` during local development (zero-copy) and automatically copy assets to the output directory during production builds:

### 1. Vite (Vue 3, Svelte, Vite React)

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { avatarBotVitePlugin } from 'ai-avatar-bot-typescript/vite';

export default defineConfig({
  plugins: [
    avatarBotVitePlugin() // Intercepts /avatar-skin/* in dev; copies to dist/avatar-skin on build
  ]
});
```

### 2. Next.js (App Router / Pages Router)

```typescript
// next.config.mjs or next.config.ts
import { withAvatarBot } from 'ai-avatar-bot-typescript/next';

const nextConfig = {
  // Your Next.js configuration
};

export default withAvatarBot(nextConfig);
```
> [!NOTE]
> `withAvatarBot` supports both **Turbopack** (`next dev --turbo`) and standard **Webpack** modes, automatically verifying that assets exist in `public/avatar-skin`.

### 3. Nuxt 3 (Nuxt Module)

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: [
    'ai-avatar-bot-typescript/nuxt' // Zero-copy Nitro dev streaming & automatic build output
  ]
});
```

### 4. Webpack (Create React App, Vue CLI, Webpack 5)

```typescript
// webpack.config.js
import { AvatarBotWebpackPlugin } from 'ai-avatar-bot-typescript/webpack';

export default {
  plugins: [
    new AvatarBotWebpackPlugin() // DevServer middleware & production asset copy
  ]
};
```

### 5. AnalogJS (Angular Meta-Framework)

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

### 6. Node.js Path Resolution Helpers

For custom build scripts or CI/CD pipelines:

```typescript
import { getAvatarSkinPath, copyAvatarSkin } from 'ai-avatar-bot-typescript/node';

// Resolves absolute path to packaged avatar-skin folder
const skinPath: string = getAvatarSkinPath();
console.log('Avatar skin path:', skinPath);

// Programmatically copy assets to destination directory
copyAvatarSkin('dist/client/avatar-skin', { overwrite: true });
```

---

## ⚙️ Configuration Options (AvatarBotOptions)

All configuration options are defined in the `AvatarBotOptions` interface:

### General & UI Settings

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `container` | `HTMLElement \| null` | `null` | **Required**. DOM container element to mount the avatar widget. |
| `avatarMode` | `AvatarMode` (`'assistant' \| 'companion' \| string`) | `'assistant'` | Persona mode preset or custom key. |
| `gender` | `Gender` (`'female' \| 'male' \| string`) | `'female'` | Default character gender. |
| `locale` | `string` | `'zh-TW'` | UI and speech language code (`'en-US'`, `'zh-TW'`, `'ja-JP'`, `'ko-KR'`). |
| `i18nMessages` | `Record<string, Record<string, string>>` | `{}` | Custom multi-language dictionary override messages. |
| `isMinimal` | `boolean` | `false` | Whether to start in minimal/collapsed floating bubble mode. |
| `isIframe` | `boolean` | `false` | Whether running inside an iframe. |

### Brain Engine & AI Provider Settings

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `enableAiProvider` | `boolean` | `false` | Whether to enable remote AI server provider (Ollama / custom API). |
| `aiProviderBaseUrl` | `string` | `''` | Base URL of the remote AI API server. |
| `aiProviderModel` | `string` | `'qwen2.5:latest'` | Model identifier for remote AI provider. |
| `aiProviderStream` | `boolean` | `true` | Whether to enable streaming for AI provider responses. |
| `aiProviderMaxTokens` | `number` | `2048` | Max response tokens for remote AI provider. |
| `aiProviderCreateFetchSetting` | `AiProviderFetchSettingFactory \| RequestInit` | `undefined` | Custom Fetch Header / RequestInit factory function. |
| `aiProviderCreateFetchPayload` | `AiProviderFetchPayloadFactory \| Record<string, unknown> \| BodyInit` | `undefined` | Custom JSON payload factory function or object. |
| `aiProviderResponseFormat` | `string \| Record<string, unknown>` | `undefined` | Custom AI provider response format (`'sse'`, `'json'`, etc.). |
| `aiProviderExtractToolCalls` | `AiProviderToolCallExtractor` | `undefined` | Custom parser callback for extracting tool calls from streaming chunks. |
| `llmModel` | `string` | `'Qwen2.5-1.5B...'` | In-browser WebLLM model name. |
| `llmMaxTokens` | `number` | `1024` | Maximum response tokens limit for in-browser WebLLM. |
| `preloadWebLLM` | `boolean` | `false` | Whether to preload WebLLM weights immediately upon initialization. |
| `autoFallbackWebLLM` | `boolean` | `true` | Whether to auto-fallback to WebLLM if remote AI Provider fails. |
| `enableAutoContinue` | `boolean` | `false` | Whether to auto-continue generation when response reaches token limit (`finish_reason === 'length'`). |
| `maxAutoContinuations` | `number` | `3` | Maximum consecutive auto-continuation turns limit. |
| `autoContinueMode` | `AutoContinueMode` (`'stream' \| 'buffered'`) | `'stream'` | Output mode for auto-continuation. |
| `autoContinuePrompt` | `AutoContinuePromptResolver \| null` | `null` | Custom continuation prompt string or dynamic resolver function. |
| `knowledge` | `KnowledgeEntry[] \| Record<string, unknown> \| string \| null` | `null` | Preloaded knowledge base for assistant mode. |
| `companionKnowledge` | `KnowledgeEntry[] \| Record<string, unknown> \| string \| null` | `null` | Preloaded knowledge base for companion mode. |
| `modes` | `Record<string, unknown>` | `{}` | Declarative custom mode definitions. |

### Memory & Context Compression

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `enableMemory` | `boolean` | `true` | Whether to enable conversation memory across turns. |
| `maxHistoryTurns` | `number` | `6` | Maximum conversation turns retained (1 turn = 1 user msg + 1 AI reply). |
| `memoryKey` | `string` | `'avatar-widget-memory'` | Key name for browser LocalStorage persistence. |
| `memoryAdapter` | `MemoryAdapter` | `null` | Custom storage adapter instance implementing `MemoryAdapter`. |
| `compression` | `BrainCompressionOptions` | `{}` | Context compression settings (`strategy`, `maxTurns`, `maxTotalChars`, `webLlm`, `aiProvider`, `customCompressor`). |
| `systemContextTemplate` | `DynamicTextOrResolver` | `undefined` | System prompt template for assistant mode. |
| `companionSystemContextTemplate` | `DynamicTextOrResolver` | `undefined` | System prompt template for companion mode. |
| `ragTemplate` | `DynamicTextOrResolver` | `undefined` | RAG reference material template. |
| `customContext` | `Record<string, unknown>` | `undefined` | Custom context object appended to LLM prompt. |
| `customEngines` | `CustomEnginesConfig` | `{}` | Custom sub-engines injection (`{ skin?, tools?, brain?, stt?, tts?, i18n? }`). |

### Speech & Skin Rendering

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `ttsEndpoint` | `string` | `'api/tts'` | Custom neural TTS backend API endpoint. |
| `neuralVoice` | `string` | `''` | Specified neural voice model identifier. |
| `startMode` | `EngineMode` (`'2d' \| '3d'`) | `'2d'` | Initial render mode: `'2d'` (Live2D) or `'3d'` (VRM). |
| `fitMode` | `FitMode` (`'half' \| 'full'`) | `'full'` | Stage fit mode: `'half'` (bust shot) or `'full'` (full body). |
| `skin2d` | `Skin2DConfig` | `{}` | 2D Live2D zoom, offset, and anchor configuration. |
| `zoom` / `offsetX` / `offsetY` | `number` | Defaults | Aliases for `skin2d` properties. |
| `anchor` | `Point2D` | `{ x: 0.5, y: 1.0 }` | 2D model anchor point (`Point2D`). |
| `modelUrl` | `string` | Built-in | URL to 2D Live2D `.model3.json` file. |
| `skin3d` | `Skin3DConfig` | `{}` | 3D VRM camera, model transform, and gaze configuration. |
| `camera` | `Skin3DCameraConfig` | Defaults | 3D camera settings (`fov`, `position`, `lookAt`). |
| `modelTransform` | `Skin3DModelConfig` | Defaults | 3D model spatial transform (`position`, `scale`, `rotation`). |
| `pointerLook` | `boolean` | `true` | Whether to enable 3D eye gaze tracking the pointer. |
| `vrmUrl` | `string` | Built-in | URL to 3D VRM `.vrm` file. |
| `enableModelDrop` | `boolean` | `false` | Allow drag-and-drop `.vrm` hot swapping (disabled by default). |
| `enableEngineToggle` | `boolean` | `true` | Show 2D/3D toggle button when both models are available. |
| `gesture` | `SkinUnifiedGestureHandler` | `undefined` | Global unified gesture interceptor `(engine, gestureName, context) => Promise<void> \| void`, allowing custom gesture routing and safe delegation via `context.gesture2D` / `context.gesture3D`. |
| `tapGestures` | `string[]` | `['goodbye', 'bow', 'waiting']` (3D) | List of gestures picked randomly when the avatar is clicked/tapped. Available across both 2D and 3D. |
| `tapMotions` | `string[]` | `undefined` | 2D Live2D specific list of motion group names triggered randomly on tap. |
| `motionMap` | `Record<string, string>` | `{}` | 2D Live2D custom motion mapping dictionary (e.g. `{ wave: 'SpecialWave' }`). |
| `expressionMap` | `Record<string, string>` | `{}` | Universal semantic expression mapping dictionary for 2D/3D (e.g. `{ happy: 'MyCustomSmile' }`). |

### Suggestions & Greetings Settings

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `suggestedQuestions` | `LocalizableOrResolver<string[]>` | Built-in | Global suggested questions (array, locale dict, or resolver function). |
| `companionSuggestedQuestions` | `LocalizableOrResolver<string[]>` | Built-in | Companion mode specific suggested questions. |
| `assistantSuggestedQuestions` | `LocalizableOrResolver<string[]>` | Built-in | Assistant mode specific suggested questions. |
| `suggestedTitle` | `LocalizableOrResolver<string>` | Built-in | Suggested questions header title. |
| `greeting` / `welcomeText` | `string` | Built-in | Click greeting and launch welcome text. |

### Tools & Plugins

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `tools` / `hostTools` | `ToolDefinition[]` | `[]` | List of typed tools registered for Function Calling. |
| `enableEmotionTools` | `boolean` | `true` | Whether to enable built-in emotion and gesture tool plugin. |
| `confirmationTimeoutMs` | `number` | `60000` | Timeout in ms for user authorization confirmations. |

### Lifecycle Callbacks

| Callback | Signature | Description |
| :--- | :--- | :--- |
| `onReady` | `(widget: AiAvatarWidget) => void` | Fired when all sub-engines are initialized and mounted. |
| `onSpeaking` | `(text: string) => void` | Fired when TTS begins speaking. |
| `onSpeakingEnd` | `() => void` | Fired when TTS finishes speaking. |
| `onStreamEnd` | `(fullText: string) => void` | Fired when brain LLM stream completes. |
| `onAutoContinueStart` | `(info: AutoContinueStartInfo) => void` | Fired when auto-continuation starts. |
| `onAutoContinueWait` | `(info: AutoContinueStartInfo) => void` | Fired when waiting for next continuation chunk. |
| `onAutoContinueResume` | `(info: AutoContinueResumeInfo) => void` | Fired when continuation chunk arrives. |
| `onAutoContinueEnd` | `(info: AutoContinueEndInfo) => void` | Fired when auto-continuation completes. |
| `onAddChatMessage` | `(role: ChatRole, text: string) => void` | Fired when a chat message is added. |
| `onMicStateChanged` | `(isListening: boolean) => void` | Fired when microphone state changes. |
| `onToolCall` | `(toolCall: ParsedToolCall) => void` | Fired when a tool call is executed. |
| `onToolNotFound` | `(info: ToolNotFoundErrorInfo, widget: AiAvatarWidget) => unknown` | Fired when AI calls an unregistered tool. |
| `onToolError` | `(info: ToolErrorInfo, widget: AiAvatarWidget) => unknown` | Fired when tool execution fails. |
| `onBrainFallback` | `(fromEngine: string, toEngine: string, error: unknown) => void` | Fired when brain engine falls back between tiers. |
| `onError` | `(error: Error, widget: AiAvatarWidget) => void` | Fired on unexpected runtime error. |

---

## 🧠 In-Depth Guides

### 1. Brain Engine & Three-Tier Fallback Inference

The Brain Engine features a high-availability 3-tier architecture with dedicated TypeScript factory types:

```typescript
import { 
  initAvatarBot, 
  type AiProviderFetchSettingFactory, 
  type AiProviderFetchPayloadFactory,
  type LLMMessage 
} from 'ai-avatar-bot-typescript';

// Strongly typed payload factory for Ollama
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

// Strongly typed request init factory
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

### 2. Auto-Continue Response Mechanism

Automatically bypasses single-response token truncation limits (`finish_reason === 'length'`) with full event typing:

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
    console.log(`Auto-continue turn ${info.continuationIndex}/${info.maxContinuations}`);
  },
  onAutoContinueResume: (info: AutoContinueResumeInfo) => {
    console.log('Received next continuation chunk:', info.chunk);
  },
  onAutoContinueEnd: (info: AutoContinueEndInfo) => {
    console.log(`Auto-continue finished. Total turns: ${info.totalContinuations}, Reason: ${info.reason}`);
  }
});
```

---

### 3. Memory Management, Data Schema & Custom Storage Adapter

Implement the `MemoryAdapter` interface to store conversation memory in IndexedDB, Redis, or an external backend API:

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
      console.warn('Failed to save session memory:', err);
    }
  }

  clear(key: string): void {
    sessionStorage.removeItem(key);
  }
}

const widget = await initAvatarBot({
  container: document.getElementById('avatar-container'),
  enableMemory: true,
  memoryKey: 'my-session-memory',
  memoryAdapter: new SessionStorageMemoryAdapter()
});

// Access strongly typed memory subsystem
const memory = widget.brainEngine?.memory;
if (memory) {
  memory.setMetadata({ role: 'admin', tier: 'premium' });
  const meta = memory.getMetadata();
  console.log('User metadata:', meta);
}
```

---

### 4. Function Calling & Custom Tools (Tools Engine)

Register custom tools with complete parameter schema validation:

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
  label: 'Check Weather',
  description: 'Retrieve real-time weather information for a specific city.',
  keywords: ['weather', 'temperature', 'forecast'],
  routingMode: 'hybrid', // 'client' | 'ai' | 'hybrid'
  requiresConfirmation: false,
  inputSchema: {
    type: 'object',
    properties: {
      city: {
        type: 'string',
        title: 'City Name',
        description: 'e.g. Taipei, Tokyo, London'
      }
    },
    required: ['city']
  },
  execute: async ({ args }: ToolExecutionParams) => {
    const { city } = args as unknown as WeatherArgs;
    const res = await fetch(`https://api.example.com/weather?city=${encodeURIComponent(city)}`);
    const data = await res.json();
    return `Current weather in ${city}: ${data.condition}, ${data.temperature}°C.`;
  }
};

const widget = await initAvatarBot({
  container: document.getElementById('avatar-container'),
  tools: [weatherTool]
});
```

---

### 5. 2D (Live2D) & 3D (VRM) Dual Skin Engine

Control spatial coordinates, cameras, and animations with typed configurations:

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

// Switch rendering engines
if (widget.skinEngine) {
  widget.skinEngine.engineMode = '2d'; // Switch to Live2D
  widget.skinEngine.engineMode = '3d'; // Switch to VRM 3D
}

// Adjust 2D Live2D configuration
widget.setSkin2d({
  zoom: 1.8,
  offsetX: 15,
  anchor: { x: 0.5, y: 1.0 }
});

// Adjust 3D VRM Camera & Transform
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

// Trigger emotions & gestures
widget.skinEngine?.setEmotion('happy');
widget.applyEmotionFromText?.('That sounds wonderful!');

// Play isomorphic semantic gesture (adapts automatically across 2D/3D)
widget.playGesture?.('bow');

// Programmatically trigger avatar tap interaction (plays tap gesture & greets)
widget.tap?.();
```

#### 🎭 Unified Gesture Dispatcher & Interceptor (`gesture`)
You can pass a custom `gesture` interceptor during initialization to customize animations or safely delegate to the underlying 2D / 3D renderers:

```typescript
const widget = await initAvatarBot({
  container: document.getElementById('avatar-container'),
  // Global gesture interceptor
  gesture: async (engine, gestureName, context) => {
    console.log(`[Gesture] Requested: ${gestureName}, Mode: ${context.mode}`);

    if (gestureName === 'special_welcome') {
      if (context.mode === '2d') {
        await context.gesture2D('Wave'); // Delegate to Live2D
      } else {
        await context.gesture3D('goodbye'); // Delegate to 3D VRM
      }
      return;
    }

    // Delegate unintercepted gestures to default channels
    if (context.mode === '2d') {
      await context.gesture2D(gestureName);
    } else {
      await context.gesture3D(gestureName);
    }
  }
});
```

#### 👆 Tap Gestures & Custom Mappings (`tapGestures`, `motionMap`, `expressionMap`)

```typescript
const widget = await initAvatarBot({
  container: document.getElementById('avatar-container'),
  // Gestures picked randomly when user taps the avatar
  tapGestures: ['bow', 'goodbye', 'nod'],
  // 2D Live2D specific motion mapping (external name ➔ model motion group)
  motionMap: {
    greeting: 'Tap',
    special_dance: 'DanceGroup'
  },
  // Universal semantic expression mapping (semantic emotion ➔ model expression)
  expressionMap: {
    happy: 'MyCustomSmile',
    angry: 'f08'
  }
});
```

#### 🔍 Three-tier Live2D Motion Resolution
When calling `widget.playGesture('greet')` or triggering 2D animations, the engine resolves names hierarchically for seamless out-of-the-box compatibility with arbitrary third-party Live2D models:
1. **Tier 1 (Custom Motion Map)**: Looks up `motionMap['greet']`. Plays the mapped group immediately if present.
2. **Tier 2 (Direct Model Match)**: Searches directly for a matching group in the model definition (case-insensitive, e.g. `'Tap'`).
3. **Tier 3 (Preset Motion Aliases)**: Matches against built-in aliases (such as `tap`, `goodbye`, `bow`, `thinking`, `look`, `relax`, `surprised`, `waiting`).
4. **Tier 4 (Fallback Expression)**: If no motion group matches, checks `expressionMap` or model expressions to perform facial expression morphing.
5. **Safe Error Handling**: If completely unresolved, safely fires `onGestureError` with `GestureNotFoundError` without crashing the main thread.

---

### 6. Speech Recognition & Neural TTS (Speech Engine)

```typescript
// Speak arbitrary text programmatically
widget.speechEngine?.speak('Welcome! How can I assist you today?');

// Assign reactive spoken text property
if (widget.speechEngine) {
  widget.speechEngine.spokenAudioText = 'Triggering audio synthesis via reactive assignment';
}

// Start / stop microphone speech-to-text
widget.speechEngine?.startListening();
widget.speechEngine?.setMic(false);

// Interrupt ongoing speech (Barge-in)
widget.speechEngine?.interruptForVoice();

// Subscribe to speech state
widget.speechEngine?.subscribe('isSpeaking', (isSpeaking: boolean) => {
  console.log('TTS Active:', isSpeaking);
});
widget.speechEngine?.subscribe('spokenDisplayText', (subtitle: string) => {
  console.log('Real-time Subtitle:', subtitle);
});
```

---

### 7. Headless Mode & Custom UI Integration

To build your own interface with React, Vue, Svelte, or Angular, enable minimal mode and subscribe to reactive stores:

```typescript
import { initAvatarBot } from 'ai-avatar-bot-typescript';

const widget = await initAvatarBot({
  container: document.getElementById('canvas-wrapper'),
  isMinimal: true // Hides built-in floating dock & bubbles
});

// Programmatically send questions to AI Brain
await widget.handleUser('Tell me about your product pricing.');

// Subscribe to speaking state
widget.speechEngine?.subscribe('isSpeaking', (speaking: boolean) => {
  const customBubble = document.getElementById('custom-bubble');
  if (customBubble) {
    customBubble.style.display = speaking ? 'block' : 'none';
  }
});
```

---

## 📐 Exported TypeScript Types Reference

`ai-avatar-bot-typescript` exports rich types across all submodules:

### Root Exports (`ai-avatar-bot-typescript`)

* **Orchestrator**: `AvatarBotOptions`, `AiAvatarWidget`, `AvatarBotStore`, `AvatarBotStoreState`, `CustomEnginesConfig`, `OrchestratorEngines`
* **Sub-Engines**: `BrainEngine`, `BrainEngineOptions`, `SpeechEngine`, `SpeechEngineOptions`, `SkinEngine`, `SkinEngineOptions`, `ToolsEngine`, `ToolsEngineSetting`, `I18nEngine`, `I18nEngineOptions`, `UiDom`, `UiContext`
* **Brain & Memory**: `LLMMessage<TContent>`, `BrainCompressionOptions`, `MemoryData`, `MemoryAdapter`, `KnowledgeEntry`, `ChatLogItem`, `ParsedToolCall`, `ChatHistoryItem`, `MemoryInstance`
* **AI Provider**: `AiProviderFetchSettingFactory`, `AiProviderFetchPayloadFactory`, `AiProviderToolCallExtractor`, `AiProviderOptions`, `AiProviderEngine`
* **Skin & Spatial**: `Skin2DConfig`, `Skin3DConfig`, `Skin3DCameraConfig`, `Skin3DModelConfig`, `Renderer2D`, `Renderer3D`, `Point2D`, `Vector2Coord`, `Vector2Tuple`, `Vector2Input`, `Vector3Coord`, `Vector3Tuple`, `Vector3Input`, `Vector3Scale`
* **Tools**: `ToolDefinition`, `ToolRouteCandidate`, `ToolExecutionParams`, `PendingToolState`
* **Extensible Literal Unions**: `AvatarMode`, `Gender`, `FitMode`, `EngineMode`, `AutoContinueMode`, `ChatRole`
* **Resolvers**: `LocalizableOrResolver<T, C>`, `DynamicTextOrResolver<C>`, `AutoContinuePromptResolver`
* **Events**: `AutoContinueStartInfo`, `AutoContinueResumeInfo`, `AutoContinueEndInfo`, `ToolNotFoundErrorInfo`, `ToolErrorInfo`, `LlmLoadProgressInfo`

---

## 📚 Instance API & Methods (AiAvatarWidget)

The initialized controller implements `AiAvatarWidget`:

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

  // Interaction Methods
  handleUser(text?: string): Promise<void> | void;
  answerQuestion?(question: string): Promise<string | void>;
  applyEmotionFromText?(text: string): void;
  classifyEmotion?(text: string): string;
  showMinimalEl(): void;
  hiddenMinimalEl(): void;

  // Skin & Viewport Control
  setSkin2d(config: Partial<Skin2DConfig>): void;
  setSkin3d(config: Partial<Skin3DConfig>): void;
  setFitMode(fitMode: FitMode): void;

  // Suggested Questions
  setSuggestedQuestions(
    questions?: LocalizableOrResolver<string[]>,
    title?: LocalizableOrResolver<string>
  ): void;
  renderSuggestions(): void;

  // Reactive State Properties
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

## 🌐 Internationalization (i18n)

Switch UI and speech languages dynamically at runtime:

```typescript
widget.i18nEngine.setLocale('en-US'); // English
widget.i18nEngine.setLocale('zh-TW'); // Traditional Chinese
widget.i18nEngine.setLocale('ja-JP'); // Japanese
widget.i18nEngine.setLocale('ko-KR'); // Korean
widget.i18nEngine.setLocale('zh-CN'); // Simplified Chinese
```

---

## 📦 Third-Party Assets & Licenses (**MUST READ**)

The source code created in this package is licensed under the **[MIT License](LICENSE)**. However, this package **references third-party runtimes, sample models, and animation assets** that carry their own independent licenses and are **NOT covered by this project's MIT License**:

| Asset / Dependency | License / Source | Commercial & Usage Notice |
| :--- | :--- | :--- |
| **Live2D Cubism Core** (`cubism.live2d.com`) | **Proprietary License** | **Non-Open Source**. Loaded dynamically via official CDN. For commercial deployment, ensure compliance with Live2D official terms and obtain appropriate licenses. |
| **Haru Sample Model** (`2d-model/female/haru_greeter_t03.*`) | Live2D **Free Material License** | **For technical demonstration and testing only**. Replace with your own legitimately licensed Live2D model for production. |
| **Natori Sample Model** (`2d-model/male/natori_pro_t06.*`) | Live2D **Free Material License** | **For technical demonstration and testing only**. |
| **Hatsune Miku VRM Model** (`3d-model/HatsuneMiku.vrm`) | **Piapro Character License (PCL)** | Character IP © Crypton Future Media, INC. **Strictly for non-commercial personal derivative / technical demo use**. |
| **Rockman.EXE VRM Model** (`3d-model/RockmanEXE.vrm`) | **Capcom Derivative Guidelines** | Game IP © CAPCOM CO., LTD. **Strictly for non-commercial personal demonstration use**. |
| **VRMA Animation Library** (`3d-model/vrma/*.vrma`) | **MIT / CC-BY 4.0** | Open-source 3D animations (goodbye, bow, thinking, look around, relax, surprised, appearing, liked, waiting). Free for commercial/personal use. |
| **Pixi.js / pixi-live2d-display** | **MIT License** | Open-source 2D WebGL rendering engine and Live2D integration plugin. |
| **Three.js / @pixiv/three-vrm** | **MIT License** | Open-source 3D WebGL renderer and VRM avatar standard library. |
| **@mlc-ai/web-llm** (WebLLM) | **Apache-2.0** | In-browser WebGPU language model inference engine. |

---

## 🧪 Testing & Quality Assurance

`ai-avatar-bot-typescript` includes a comprehensive test suite across unit algorithms, typechecking, and Playwright E2E tests:

```bash
# 1. Typecheck with strict TypeScript compiler
yarn test:typecheck

# 2. Run 490+ Vitest unit tests (Brain, Speech, Skin, Tools, Memory, Store)
yarn test:unit

# 3. Vitest watch mode & UI dashboard
yarn test:unit:watch
yarn test:unit:ui

# 4. Vitest code coverage report
yarn test:unit:coverage

# 5. Playwright E2E testing (UI Contract Parity & Engine Smoke)
yarn test:e2e:contract
yarn test:e2e:engine
yarn test:e2e

# 6. Production bundle smoke test
yarn test:smoke
```

---

## ⚠️ Risk & Limitations Disclosure

1. **TTS Voice Service & Custom Endpoints**:
   - This package is a pure client-side SDK. It supports connecting to custom neural TTS backend endpoints (`ttsEndpoint`) or falling back to browser native Web Speech API (`window.speechSynthesis`).
2. **Speech Recognition (STT) Cloud Processing**:
   - Browser Web Speech API (`webkitSpeechRecognition`) typically uploads microphone audio to browser vendor servers (e.g. Google) for speech recognition.
3. **WebLLM Hardware & Compute Requirements**:
   - In-browser WebLLM requires WebGPU support and sufficient GPU VRAM (1GB–5GB model download). For broader device compatibility, enable `enableAiProvider: true` to connect to remote AI servers.
4. **Domain Knowledge Disclaimer**:
   - Built-in knowledge entries are strictly for demonstration. Deployments in legal, financial, or medical fields must include proper professional disclaimers.

---

## 🔐 Privacy & Data Flow

| Feature Module | Data Processing Location / Destination | Privacy & Security Note |
| :--- | :--- | :--- |
| **Speech-to-Text (STT)** | Microphone audio ➔ Browser vendor cloud (e.g. Google) | Audio volume analysis is local; recognized text returns to client. |
| **Text-to-Speech (TTS)** | Utterance text ➔ Configured `ttsEndpoint` or local browser | Native speech synthesizes 100% locally. |
| **WebLLM Local Brain** | **100% In-Browser Client (WebGPU)** | Conversation data computed entirely in browser memory; never leaves client device. |
| **AI Provider Cloud Brain**| Context messages ➔ Configured `aiProviderBaseUrl` | Processed according to your backend server (e.g. Ollama, self-hosted API). |
| **Conversation Memory** | **100% In-Browser Client** (`localStorage` / Custom adapter) | Persisted locally on client device; never automatically uploaded to remote servers. |

---

## ❓ Frequently Asked Questions (FAQ)

### Q1: What is the relationship and evolution between `ai-avatar-bot-typescript` and the earlier `vanilla-js` prototype?
> **A:** The project originally validated multi-engine architecture with a pure JavaScript prototype (`vanilla-js`). Following complete feature and integration validation, that prototype was officially archived at Commit [`2e4cb12a4c689d8dc98a814211279ce0cb3ebf59`](https://github.com/archer102125220/ai-avatar-bot/commit/2e4cb12a4c689d8dc98a814211279ce0cb3ebf59) (Tag: `archive/vanilla-js-baseline`). Today, `ai-avatar-bot-typescript` serves as the Single Source of Truth—offering 100% native TypeScript type safety, a compact 223KB core, subpath exports, and standard ESM/CJS/IIFE builds that can be seamlessly consumed in pure JavaScript projects as well.

### Q2: Can I use this package without any UI (Headless)?
> **A:** Yes! Pass `isMinimal: true` during initialization to hide the built-in UI dock and bubbles. You can then render your own UI using React, Vue, Svelte, or native DOM while interacting with `widget.handleUser()` and subscribing to `widget.speechEngine`.

### Q3: How do I switch between 2D (Live2D) and 3D (VRM)?
> **A:** Set `startMode: '2d'` or `'3d'` during initialization, or switch dynamically at runtime via `widget.skinEngine.engineMode = '3d'`.

---

## 🤝 Credits & Attribution

The foundational architecture and core design of this package are based on the open-source project [ai-avatar-bot](https://github.com/YuriCrystal/ai-avatar-bot) by **[YuriCrystal](https://github.com/YuriCrystal)**.

We express our sincere gratitude to the original author for the pioneering exploration and open-source contributions in Web digital human interaction, Live2D/VRM integration, WebGPU client-side inference, and voice lip-sync design!

---

## 📝 License

This project's source code is licensed under the [MIT License](LICENSE).
