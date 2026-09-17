# Dual-Track E2E Testing Architecture & Cross-Framework Migration Guide

[繁體中文](./README_ZH.md) | English

> This directory contains the End-to-End (E2E) testing suite for the `ai-avatar-bot` project. It adopts a **dual-track layered design**, balancing **real underlying engine sanity** (WebGL/3D, Web Audio API, Brain stream parsing) with **cross-framework UI behavior contract parity** (Vanilla JS, TypeScript, React, Vue).

---

## 🏗️ 1. Dual-Track Architecture Overview

```
                                  Playwright Dual-Track E2E Architecture
                                                    │
             ┌──────────────────────────────────────┴──────────────────────────────────────┐
             ▼                                                                             ▼
┌──────────────────────────────────────────────┐              ┌──────────────────────────────────────────────┐
│  【Track A】Cross-Framework UI Contract       │              │  【Track B】Real Engine Pipeline Smoke       │
│  (UI & Contract Parity E2E)                  │              │  (Real WebGL / Web Audio / Brain Stream)     │
├──────────────────────────────────────────────┤              ├──────────────────────────────────────────────┤
│ • Purpose: Ensure 100% parity across UI      │              │ • Purpose: Validate real runtime engines in  │
│   frameworks (Vanilla / React / Vue)         │              │   real browser environments                  │
│ • Method: Lightweight custom mock engines    │              │ • Method: Zero mocking, executes real WebGL, │
│ • Focus: Lifecycle, DOM testIDs, chat flows, │              │   Web Audio, and SSE streaming pipeline      │
│   tool calling confirmation cards            │              │ • Focus: Canvas context, lip-sync FFT math,  │
│ • Specs: specs/contract/*.spec.ts            │              │   and streaming chunk parser                 │
│ • Harness: harness/contract.html             │              │ • Specs: specs/engine/*.spec.ts              │
│                                              │              │ • Harness: harness/engine.html               │
└──────────────────────────────────────────────┘              └──────────────────────────────────────────────┘
```

### Track Comparison Matrix

| Metric / Attribute | Track A: Contract Parity (Track A) | Track B: Real Engine Smoke (Track B) | Release Bundle Smoke (Smoke) |
| :--- | :--- | :--- | :--- |
| **Scope** | UI state machine, DOM contract, user flows | WebGL Canvas, Web Audio API, Brain SSE | Production bundle (`dist/`) in raw HTML |
| **Engine Dependencies** | Mock engines (sub-second launch) | Real Live2D/VRM, real Web Audio, real Brain | Production build (`dist/ai-avatar-bot.js`) |
| **External Resources** | None (no models or external APIs) | Headless browser GPU & audio flags | None |
| **Primary Role** | **Cross-Framework Acceptance Suite** | **Engine Regression & Sanity Guard** | **Pre-release Gatekeeper** |
| **Duration** | ~15s (16 contract specs) | ~8s (8 engine smoke specs) | ~3s (1 bundle mount spec) |

---

## 📋 2. DOM Contract & TestID Specifications

To guarantee identical user experience and behavior across different framework implementations (Vanilla JS, React, Vue), all UI components must adhere strictly to this DOM and attribute contract:

| Element | `data-testid` | State Attributes / ARIA | Description |
| :--- | :--- | :--- | :--- |
| **Widget Root** | `avatar-widget-root` | `[css-is-speaking="true\|false"]`<br>`[css-is-minimal="true\|false"]`<br>`[css-is-loading="true\|false"]` | Outermost container reflecting real-time state and global styles |
| **Chat Bubble** | `avatar-bubble` | `[css-is-visible="true\|false"]` | Floating speech bubble containing typewriter messages |
| **Chat Input** | `avatar-chat-input` | `placeholder`, `disabled` | Text input supporting Enter key & submit button |
| **Submit Button** | `avatar-chat-submit` | `disabled` | Button triggering message dispatch flow |
| **Mic Button** | `avatar-btn-mic` | `[aria-pressed="true\|false"]` | Toggle button for real-time speech recognition (STT) |
| **Speaker / Mute Button**| `avatar-btn-speaker` | `[aria-pressed="true\|false"]` | Toggle button for speech output mute/unmute |
| **Minimal Button** | `avatar-btn-minimal` | - | Toggle button to collapse or expand the avatar |
| **History Button** | `avatar-btn-history` | `[aria-expanded="true\|false"]` | Button toggling the conversation history drawer |
| **History Panel** | `avatar-history-panel` | `[css-is-open="true\|false"]`<br>`inert` (true when closed) | Drawer container; inert prevents focus/clicks when closed |
| **History Message Items**| `avatar-msg-user`, `avatar-msg-bot` | - | Rendered dialogue records inside the history drawer |
| **Tool Approval Card** | `avatar-tool-card` | - | Rendered when a function call requires user approval |
| **Tool Confirm Button** | `avatar-tool-confirm-btn` | - | Authorizes and triggers execution of the tool |

---

## 🚀 3. Cross-Framework Migration & Acceptance Workflow

When implementing `@package/typescript` (Core refactoring), `@package/react`, or `@package/vue`, follow these standardized acceptance workflows:

### Workflow 1: TypeScript Core SDK Refactoring
1. **100% Unit Test Parity**: The refactored TypeScript core must pass all 470+ unit tests in `test/unit/`.
2. **Track B Engine Sanity**:
   - Ensure the real `SkinEngine`, `SpeechEngine`, and `BrainEngine` instances initialize cleanly without browser runtime exceptions.
   - Run `yarn test:e2e:engine` to verify WebGL context creation, resize listener responsiveness, and AudioContext establishment.

### Workflow 2: React / Vue UI Component Migration
1. **Set Up Test Harness**:
   - Create a test playground page (e.g., `test/e2e/harness/react.html` or a Vite dev harness).
   - Mount the framework component `<AiAvatarBot />` and inject compatible mock engines:
     ```ts
     const mockSkin = {
       canvas: document.createElement('canvas'),
       render: () => {},
       setEmotion: () => {},
       destroy: () => {}
     };
     ```
2. **Run Track A Contract Suite**:
   - Point the test runner to the framework harness and execute `test/e2e/specs/contract/*.spec.ts`.
   - The test suite covers:
     - `lifecycle.spec.ts`: Mount, `onReady` invocation, clean `destroy()` resource teardown.
     - `chat-flow.spec.ts`: Input focus, message submission, bubble typewriter streaming, state toggles.
     - `minimal-toggle.spec.ts`: Collapse/expand cycles, container state attributes.
     - `controls.spec.ts`: Mute state, history drawer `inert` & `aria-expanded` linkage.
     - `tool-calling.spec.ts`: Tool approval card rendering, user confirmation, result feedback.
3. **Acceptance Criteria**:
   - **Passing all 16 Track A tests certifies 100% isomorphic UI behavior with the reference Vanilla implementation.**

---

## 💻 4. CLI Commands & Isolated Report Viewing

Each test track outputs to an isolated directory to ensure results are never overwritten:

### Test Execution Commands

```bash
# 1. Run unit tests (Vitest)
yarn test:unit

# 2. Run Track A: Cross-framework UI contract parity tests (Playwright, ~15s)
yarn test:e2e:contract

# 3. Run Track B: Real engine pipeline smoke tests (WebGL / Web Audio / SSE)
yarn test:e2e:engine

# 4. Run full dual-track E2E test suite (Track A + Track B)
yarn test:e2e

# 5. Run production bundle smoke test (builds and verifies dist/ in raw HTML)
yarn test:smoke

# 6. Launch Playwright interactive UI debugger
yarn test:e2e:ui
```

### Isolated HTML Report Viewer

| Test Track | Output Directory | Command |
| :--- | :--- | :--- |
| **Full Dual-Track Report** | `playwright-report/all` | `yarn test:e2e:report` |
| **Track A Contract Report** | `playwright-report/contract` | `yarn test:e2e:report:contract` |
| **Track B Engine Report** | `playwright-report/engine` | `yarn test:e2e:report:engine` |
| **Bundle Smoke Report** | `playwright-report/smoke` | `yarn test:e2e:report:smoke` |
