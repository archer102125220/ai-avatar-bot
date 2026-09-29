# AI Avatar Bot

[繁體中文](./README_ZH.md) | English

> A lightweight, modular, and extensible Web AI Avatar (2D Live2D / 3D VRM) SDK ecosystem.

This project originated from the open-source exploration by [YuriCrystal/ai-avatar-bot](https://github.com/YuriCrystal/ai-avatar-bot). We have performed extensive modular decomposition, architectural refactoring, and engineering standardizations to build a modern Web AI Avatar package ecosystem ready for npm distribution.

---

## 📑 Table of Contents

- [📦 Package Matrix & Navigation](#-package-matrix--navigation)
- [🌟 Core Architecture & Multi-Engine Design](#-core-architecture--multi-engine-design)
- [🚀 Quick Start (Vanilla JS Example)](#-quick-start-vanilla-js-example)
- [🛠️ Monorepo Development Commands](#️-monorepo-development-commands)
- [🗺️ Roadmap](#️-roadmap)
- [🤝 Credits & Attribution](#-credits--attribution)
- [📦 Third-Party Assets & License](#-third-party-assets--license)

---

## 📦 Package Matrix & Navigation

This Monorepo is organized into dedicated sub-packages for various usage scenarios and frontend technology stacks. Among them, **`vanilla-js` serves as the foundational core package (currently the most complete)**, and all other framework wrappers and typed versions are built upon it:

| Package Directory | Package Name / Type | Status | Role & Characteristics | Quick Link |
| :--- | :--- | :---: | :--- | :---: |
| [`/vanilla-js`](./vanilla-js) | `ai-avatar-bot-vanilla-js` | 🟢 **Most Complete (Core Baseline)** | **Zero framework dependencies** pure JavaScript core SDK with built-in comprehensive TypeScript definitions (`types/index.d.ts`). Features multi-engine architecture, memory compression, Auto-Continue, Headless mode, and Vite/Webpack offline asset plugins. The foundation for all subsequent packages. | [📄 Documentation](./vanilla-js/README.md) |
| [`/iframe`](./iframe) | `ai-avatar-bot-iframe` | 🟡 **Classic Refactor** | **Initial modular refactor of the original version**. Preserves the original author's classic iframe and `embed.js` one-line script embedding design, offering maximum DOM/CSS isolation and standalone demo pages. | [📄 Documentation](./iframe/README.en.md) |
| [`/typescript`](./typescript) | `ai-avatar-bot-typescript` | 🟢 **Ready (Release-Ready / Recommended)** | **100% native TypeScript type-safe SDK**. Release-ready with modern standards: modular subpath exports (`/brain`, `/skin`, etc.), dual ESM/IIFE CDN builds, optional peer dependencies (compact 223KB core), CLI asset sync tool, and 6+ framework plugins. | [📄 Documentation](./typescript/README.md) |
| [`/vue`](./vue) | `ai-avatar-bot-vue` | 🚧 **In Progress** | Dedicated component library for **Vue 3**. Provides `<AiAvatarBot />` components and `useAvatar` composables, supporting reactive props and custom slots. | [📁 Source Code](./vue) |
| [`/react`](./react) | `ai-avatar-bot-react` | 🚧 **In Progress** | Dedicated component library for **React 18 / 19**. Provides `<AiAvatarBot />` components and `useAvatar` hooks, seamlessly integrating with React lifecycle and JSX rendering. | [📁 Source Code](./react) |

---

## 🌟 Core Architecture & Multi-Engine Design

The entire SDK adopts a highly decoupled "Multi-Engine Architecture", allowing developers to swap underlying implementations or completely take over the UI via Headless Mode:

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

### Core Engine Responsibilities:

1. 🧠 **Brain Engine**:
   * **Three-tier Auto-Fallback**: Remote AI Provider (Ollama / OpenAI API) ➔ Client-side WebLLM (browser WebGPU models) ➔ Bigram keyword instant retrieval.
   * **Intelligent Context Compression**: Sliding window and rolling summary strategies with cascading dual-track budgets to prevent WebGPU VRAM overflow and token limits.
   * **Auto-Continue Responses**: Automatically bypasses single-response token truncation to produce seamless long answers.
2. 🗣️ **Speech Engine**:
   * Integrates browser Speech Recognition (STT) and Microsoft Neural TTS.
   * Supports real-time voice barge-in, companion continuous dialogue, audio streaming queue, and real-time lip sync.
3. 🎭 **Skin Engine**:
   * Dual rendering support for 2D (Live2D via Pixi.js) and 3D (VRM via Three.js).
   * Built-in 8+ emotional gestures (happy, surprised, thinking, wave, bow, relax, etc.), custom model loading, and secure drag-and-drop outfit swapping.
4. 🛠️ **Tools Engine**:
   * Standardized Function Calling supporting client rule matching, AI semantic invocation, and hybrid routing.
   * Built-in Human-in-the-loop authorization dialogs and JSON Schema parameter validation.
5. 🖥️ **UI Engine**:
   * Modern out-of-the-box floating dock, chat bubbles, and settings drawers.
   * Supports **Headless Mode**, allowing developers to completely hide the default UI and build custom interfaces with Vue or React.
6. 🌐 **I18n Engine**:
   * Built-in locale dictionaries for Traditional Chinese (`zh-TW`), Simplified Chinese (`zh-CN`), English (`en-US`), Japanese (`ja-JP`), and Korean (`ko-KR`).

---

## 🚀 Quick Start

### 1. Vanilla JS (Zero Framework Dependencies)

```bash
# yarn
yarn add ai-avatar-bot-vanilla-js

# npm
npm install ai-avatar-bot-vanilla-js
```

```javascript
import { initAvatarBot } from 'ai-avatar-bot-vanilla-js';
import 'ai-avatar-bot-vanilla-js/style.css';

const widget = await initAvatarBot({
  container: document.getElementById('avatar-container'),
  avatarMode: 'assistant',
  gender: 'female',
  llmModel: 'Hermes-3-Llama-3.1-8B-q4f32_1-MLC',
  welcomeText: 'Hello! I am your AI Avatar assistant.'
});
```

> 📖 **Full Options & Guides**: See [Vanilla JS Documentation](./vanilla-js/README.md).

### 2. TypeScript (Strict Type Safety)

```bash
# yarn (recommended)
yarn add ai-avatar-bot-typescript

# npm
npm install ai-avatar-bot-typescript
```

```typescript
import { 
  initAvatarBot, 
  type AvatarBotOptions, 
  type AiAvatarWidget 
} from 'ai-avatar-bot-typescript';
import 'ai-avatar-bot-typescript/style.css';

const options: AvatarBotOptions = {
  container: document.getElementById('avatar-container'),
  avatarMode: 'assistant',
  gender: 'female',
  llmModel: 'Hermes-3-Llama-3.1-8B-q4f32_1-MLC',
  welcomeText: 'Hello! I am your AI Avatar assistant.'
};

const widget: AiAvatarWidget = await initAvatarBot(options);
```

> 📖 **Full Options & Guides**: See [TypeScript Documentation](./typescript/README.md).

---

## 🛠️ Monorepo Development Commands

This project uses Yarn Workspaces to manage sub-packages:

```bash
# Start Vanilla JS development server (Recommended: Most complete)
yarn dev:js

# Start TypeScript development server
yarn dev:ts

# Start Vue 3 development server
yarn dev:vue

# Start React development server
yarn dev:react

# Start Iframe classic version development server
yarn dev:iframe

# Run full TypeScript package verification (typecheck, unit tests, smoke test, lint)
yarn typecheck:ts
yarn test:ts
yarn test:ts:smoke
yarn lint:ts

# Build all workspace packages
yarn build
```

---

## 🗺️ Roadmap

- [x] **Phase 1: Vanilla JS Core Refactoring & Feature Completeness**
  - Multi-engine modularization (Brain, Speech, Skin, Tools, UI, i18n)
  - Live2D + VRM dual rendering engine integration
  - WebLLM + Cloud AI Provider fallback and Auto-Continue
  - Memory management, safe Tool Call pruning, and context compression pipeline
  - Vite / Webpack zero-config offline asset plugins
- [x] **Phase 2: TypeScript Strict Porting & npm Release Hardening (`/typescript`)**
  - Complete 100% native TS porting with full declaration files
  - Modular subpath exports (`/brain`, `/skin`, `/speech`, `/tools`, `/i18n`, `/constants`, `/types`)
  - Dual-build CDN ecosystem (ESM `+esm` and traditional `<script>` IIFE `window.AiAvatarBot`)
  - Externalized heavy dependencies & optional peerDependencies (core slimmed to 223KB, -96.9%)
  - Built-in static asset sync CLI (`sync`) and 6+ framework plugins (Vite, Next, Nuxt, Webpack...)
  - Cross-platform automated test suite (Vitest 494 tests, TypeScript compile-time checks, Playwright E2E smoke test)
- [ ] **Phase 3: Vue 3 & React Official Wrapper Component Libraries (`/vue`, `/react`)**
  - Develop `<AiAvatarBot />` components and reactive Hooks / Composables
- [ ] **Phase 4: Public npm Release & Multi-Package Maintenance**
  - Officially publish all packages to the npm registry

---

## 🤝 Credits & Attribution

The architecture and core inspiration of this project originate from **[YuriCrystal](https://github.com/YuriCrystal)** and the open-source repository [ai-avatar-bot](https://github.com/YuriCrystal/ai-avatar-bot).

We express our sincere gratitude to the original author for the pioneering exploration and open-source contributions in Web digital human interaction, Live2D/VRM integration, WebGPU client-side inference, and voice lip-sync design!

---

## 📦 Third-Party Assets & License

The original source code created in this project is licensed under the **[MIT License](LICENSE)**.

> ⚠️ **Important Notice**: Third-party runtimes and model assets referenced in this project (Live2D Cubism Core proprietary license, Haru/Natori sample models, Hatsune Miku/Rockman VRM character models, etc.) are governed by their respective authors' licenses and **are NOT covered by this project's MIT License**. Please review the [Third-Party Assets & License Disclaimers](./vanilla-js/README.md#-third-party-assets--licensing-please-read-carefully) before commercial use or distribution.
