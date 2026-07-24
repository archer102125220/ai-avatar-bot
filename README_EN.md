# AI Avatar Bot (Vanilla JS)

[繁體中文](./README.md) | English

> ⚠️ **Work In Progress**
> This project is currently undergoing a massive refactor and packaging process. This document describes the **"Target Architecture"** we aim to achieve.
> ([Original GitHub](https://github.com/YuriCrystal/ai-avatar-bot))

A highly modular npm package for integrating 2D/3D AI Avatars into web applications. It is designed to quickly embed digital humans with voice interaction, LLM integration, and expressive animations.

## 🌟 Target Features

*   **Multi-Engine Architecture**: Highly modular, allowing developers to swap or customize underlying logic easily.
    *   🧠 **Brain Engine (`brainEngine`)**: Handles communication with Large Language Models (LLM). Supports Ollama server, WebLLM (local models), and features built-in contextual memory management.
    *   🗣️ **Speech Engine (`speechEngine`)**: Consolidates speech input (STT) and output (TTS). Supports browser built-in speech and high-fidelity neural speech APIs. Automatically manages the mutually exclusive "listen and speak" states and microphone handovers.
    *   🛠️ **Tools Manager (`toolsManager`)**: A standardized Function Calling manager. Easily register external tools for the brain to invoke (e.g., check weather, control UI).
    *   🎭 **Skin Engine**: Supports loading 2D (Live2D) and 3D (.vrm) models, featuring automatic lip-sync and gesture control.
    *   🖥️ **UI Engine (`uiEngine`)**: Provides an out-of-the-box default control interface, and supports **Headless Mode**, allowing developers to completely take over UI rendering to perfectly fit any frontend framework.
*   **Continuous Conversation (Companion Mode)**: Supports natural back-and-forth dialogue. The AI automatically reopens the microphone to listen after speaking.
*   **Zero Frontend Dependencies**: The core is built with Vanilla JS, making it easy to integrate into React, Vue, Angular, or any web project.

## 🗺️ Roadmap

This package will be released in multiple versions to meet different developer needs:

1.  **Vanilla JS**: The current main focus, used to validate core logic and architecture.
2.  **TypeScript (TS)**: Coming soon! To provide better type hinting and development experience, the TS version will **completely replace** the current Vanilla JS version once finished.
3.  **Vue & React Wrappers**: Once the core logic (TS version) stabilizes, dedicated component libraries optimized for Vue and React will be released for seamless integration.

## 📦 Installation

*(npm install support coming soon. For now, please use by importing core modules)*

## 🚀 Quick Start

```javascript
import { aiAvatarWidget } from './vanilla-js/core/index.js';

// Initialize and mount Widget
aiAvatarWidget.init({
  container: document.getElementById('avatar-container'), // Uses built-in uiEngine by default
  avatarMode: 'assistant', // or 'companion'
  llmModel: 'llama3', 
  greeting: 'Hello! I am your AI assistant.'
});
```

## 🧩 Architecture & Customization

> 🚧 **API Documentation in Progress**
> 
> The advanced architectural operations (including custom APIs for `brainEngine`, `speechEngine`, `uiEngine`, and `toolsManager`, Headless mode, and event listening mechanisms) are currently being refactored and polished.
> 
> To provide the most accurate reference, detailed API documentation, property descriptions, and plugin development examples will be provided here once the underlying architecture is stable and officially released. Stay tuned!

## 📝 License

MIT License
