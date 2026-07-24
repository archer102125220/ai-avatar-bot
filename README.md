# AI Avatar Bot (Vanilla JS)

繁體中文 | [English](./README_EN.md)
> ⚠️ **開發中 (Work In Progress)**
> 本專案目前正在進行大規模重構與封裝，本文件描述的為**「預期達成的目標架構」**。
> ([原版 GitHub](https://github.com/YuriCrystal/ai-avatar-bot))

這是一個將網頁數位人（AI Avatar）模組化封裝的 npm 套件。專為快速在網頁中嵌入具備語音互動、LLM 大腦與生動表情的 2D/3D 數位人所設計。

## 🌟 目標架構特色 (Target Features)

*   **多引擎架構設計**：高度模組化，方便開發者抽換或自訂底層邏輯。
    *   🧠 **Brain Engine (`brainEngine`)**：負責與大型語言模型 (LLM) 溝通，支援 Ollama 伺服器、WebLLM (本機端模型)，並內建上下文記憶管理 (Memory)。
    *   🗣️ **Speech Engine (`speechEngine`)**：統整語音輸入 (STT) 與輸出 (TTS)。支援瀏覽器內建語音與高擬真神經語音 API，並自動處理「聽與說」的狀態互斥與麥克風接力。
    *   🛠️ **Tools Manager (`toolsManager`)**：標準化的 Function Calling 管理器。輕鬆註冊外部工具讓大腦呼叫（例如：查天氣、控制 UI 等）。
    *   🎭 **Skin Engine**：支援載入 2D (Live2D) 與 3D (.vrm) 模型，並具備自動對嘴 (Lip Sync) 與情緒手勢 (Gestures) 控制。
    *   🖥️ **UI Engine (`uiEngine`)**：提供開箱即用的預設控制介面，並支援**無頭模式 (Headless Mode)**，允許開發者完全接管 UI 渲染，完美適應任何前端框架。
*   **連續對話（陪伴模式）**：支援自然的來回對話，AI 講完話後自動重開麥克風聆聽。
*   **零依賴前端框架**：核心使用 Vanilla JS 打造，可輕鬆整合至 React, Vue, Angular 或任何網頁專案中。

## 🗺️ 開發藍圖 (Roadmap)

本套件預計會推出多種版本以滿足不同開發者的需求：

1.  **Vanilla JS**：目前的開發主力，用於驗證核心邏輯與架構。
2.  **TypeScript (TS)**：即將推出！為了提供更好的型別提示與開發體驗，TS 版本完成後將會**完全取代**目前的 Vanilla JS 版本。
3.  **Vue & React 封裝版**：核心邏輯 (TS 版) 穩定後，將釋出針對 Vue 與 React 框架最佳化的專屬元件庫 (Components)，讓整合更無縫。

## 📦 安裝 (Installation)

*(即將支援 npm install，目前請透過引入核心模組使用)*

## 🚀 快速開始 (Quick Start)

```javascript
import { aiAvatarWidget } from './vanilla-js/core/index.js';

// 初始化並掛載 Widget
aiAvatarWidget.init({
  container: document.getElementById('avatar-container'), // 預設使用內建 uiEngine 渲染介面
  avatarMode: 'assistant', // 或 'companion'
  llmModel: 'llama3', 
  greeting: '你好！我是你的 AI 助理。'
});
```

## 🧩 架構與自訂 (Architecture & Customization)

> 🚧 **API 文件編寫中**
> 
> 本專案的進階架構操作（包含 `brainEngine`, `speechEngine`, `uiEngine` 與 `toolsManager` 的客製化 API、Headless 模式以及事件監聽機制）目前正處於重構與打磨階段。
> 
> 為了提供最精準的參考，詳細的 API 文件、屬性說明與外掛開發範例，將於架構底層穩定並正式釋出後，在此處完整補充說明。敬請期待！

## 📝 授權 (License)

MIT License
