/**
 * Central Type Definitions for the Orchestrator and Widget Subsystems.
 * All type definitions reference the single source of truth in `index.d.ts`.
 */

/**
 * Custom sub-engines injection configuration.
 * @typedef {import('../../index.d.ts').CustomEnginesConfig} CustomEnginesConfig
 */

/**
 * Multi-turn conversation memory data structure.
 * @typedef {import('../../index.d.ts').MemoryData} MemoryData
 */

/**
 * Storage adapter interface for persistent conversation memory.
 * @typedef {import('../../index.d.ts').MemoryAdapter} MemoryAdapter
 */

/**
 * Avatar persona mode identifier ('assistant' | 'companion' | custom string).
 * @typedef {import('../../index.d.ts').AvatarMode} AvatarMode
 */

/**
 * Options for configuring and initializing the AI Avatar Bot.
 * @typedef {import('../../index.d.ts').AvatarBotOptions} AvatarBotOptions
 */

/**
 * Initialized AI Avatar Bot widget controller instance.
 * @typedef {import('../../index.d.ts').AiAvatarWidget} AiAvatarWidget
 */

export {};
