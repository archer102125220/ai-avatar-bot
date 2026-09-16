/**
 * Central Type Definitions for the Orchestrator and Widget Subsystems.
 * All type definitions reference the single source of truth in `types/index.d.ts`.
 */

/**
 * Custom sub-engines injection configuration.
 * @typedef {import('@types').CustomEnginesConfig} CustomEnginesConfig
 */

/**
 * Multi-turn conversation memory data structure.
 * @typedef {import('@types').MemoryData} MemoryData
 */

/**
 * Storage adapter interface for persistent conversation memory.
 * @typedef {import('@types').MemoryAdapter} MemoryAdapter
 */

/**
 * Avatar persona mode identifier ('assistant' | 'companion' | custom string).
 * @typedef {import('@types').AvatarMode} AvatarMode
 */

/**
 * Options for configuring and initializing the AI Avatar Bot.
 * @typedef {import('@types').AvatarBotOptions} AvatarBotOptions
 */

/**
 * Initialized AI Avatar Bot widget controller instance.
 * @typedef {import('@types').AiAvatarWidget} AiAvatarWidget
 */

export {};

