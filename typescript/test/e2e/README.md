# Dual-Track E2E Testing Architecture & Cross-Framework Migration Guide (TypeScript)

[繁體中文](./README_ZH.md) | English

> This directory contains the End-to-End (E2E) testing suite for `ai-avatar-bot-typescript`. It adopts a **dual-track layered design**, balancing **real underlying engine sanity** (WebGL/3D, Web Audio API, Brain stream parsing) with **cross-framework UI behavior contract parity** (Vanilla JS, TypeScript, React, Vue).

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
│   frameworks (Vanilla / TypeScript / React)  │              │   real browser environments                  │
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

To guarantee identical user experience and behavior across different framework implementations (Vanilla JS, TypeScript, React, Vue), all UI components must adhere strictly to this DOM and attribute contract:

| Element | `data-testid` / ID | State Attributes / ARIA | Description |
| :--- | :--- | :--- | :--- |
| **Widget Root** | `avatar-widget-root` | `[css-is-speaking="true\|false"]`<br>`[css-is-minimal="true\|false"]`<br>`[css-is-loading="true\|false"]` | Outermost container reflecting real-time state and global styles |
| **Chat Bubble** | `#bubble` / `avatar-bubble` | `[css-is-visible="true\|false"]` | Floating speech bubble containing typewriter messages |
| **Chat Input** | `#type-input` | `placeholder`, `disabled` | Text input supporting Enter key & submit button |
| **Submit Button** | `#btn-send` | `disabled` | Button triggering message dispatch flow |
| **Mic Button** | `#btn-mic` | `[aria-pressed="true\|false"]` | Toggle button for real-time speech recognition (STT) |
| **Speaker / Mute Button**| `#btn-mute` | `[aria-pressed="true\|false"]` | Toggle button for speech output mute/unmute |
| **Minimal Button** | `.aw-minimal` | - | Toggle button to collapse or expand the avatar |
| **History Button** | `#btn-history` | `[aria-expanded="true\|false"]` | Button toggling the conversation history drawer |
| **History Panel** | `#history-panel` | `[css-is-open="true\|false"]` | Drawer container for dialogue history |
| **History Message Items**| `#history-list .history-item` | - | Rendered dialogue records inside the history drawer |
| **Tool Approval Card** | `.history-confirm` | - | Rendered when a function call requires user approval |
| **Tool Confirm Button** | `.history-confirm button.confirm` | - | Authorizes and triggers execution of the tool |

---

## 💻 3. CLI Commands & Isolated Report Viewing

```bash
# 1. Run unit tests (Vitest)
npm run test:unit

# 2. Run Track A: Cross-framework UI contract parity tests (Playwright)
npm run test:e2e:contract

# 3. Run Track B: Real engine pipeline smoke tests (WebGL / Web Audio / SSE)
npm run test:e2e:engine

# 4. Run full dual-track E2E test suite (Track A + Track B)
npm run test:e2e

# 5. Run production bundle smoke test (builds and verifies dist/ in raw HTML)
npm run test:smoke

# 6. Launch Playwright interactive UI debugger
npm run test:e2e:ui
```
