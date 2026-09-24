import type { BaseStore } from '@/core/store';
import type { ToolDefinition } from '@/core/tools/types';

// ============================================================================
// 1. Reactive State & Subscribable Store
// ============================================================================

/**
 * Standard reactive store interface for all bot sub-engines.
 */
export type SubscribableStore<T extends object> = BaseStore<T>;

// ============================================================================
// 2. Spatial Geometry & Vectors (2D & 3D)
// ============================================================================

/** 2D coordinate point { x?: number, y?: number } */
export interface Point2D {
  x?: number;
  y?: number;
}

/** 2D coordinate point { x, y } */
export interface Vector2Coord {
  x: number;
  y: number;
}

/** 2D coordinate tuple [x, y] */
export type Vector2Tuple = [number, number];

/** Acceptable 2D coordinate inputs */
export type Vector2Input = Vector2Coord | Point2D;

/** 3D coordinate point { x, y, z } */
export interface Vector3Coord {
  x: number;
  y: number;
  z: number;
}

/** 3D coordinate tuple [x, y, z] */
export type Vector3Tuple = [number, number, number];

/** Acceptable 3D coordinate or spatial inputs */
export type Vector3Input = Vector3Coord | Vector3Tuple;

/** Acceptable 3D scale inputs (vector or uniform scalar multiplier) */
export type Vector3Scale = Vector3Input | number;

// ============================================================================
// 3. Literal Unions with Extensible Autocomplete
// ============================================================================

/** Avatar personality mode: built-in presets or any custom registered mode */
export type AvatarMode = 'assistant' | 'companion' | (string & {});

/** Avatar gender mode: built-in presets or any custom string */
export type Gender = 'female' | 'male' | (string & {});

/** Viewport fit mode: half-body or full-body */
export type FitMode = 'half' | 'full' | (string & {});

/** Rendering engine mode: 2D Live2D or 3D VRM */
export type EngineMode = '2d' | '3d' | (string & {});

/** Auto-continuation delivery mode */
export type AutoContinueMode = 'stream' | 'buffered' | (string & {});

/** Chat dialogue role */
export type ChatRole = 'system' | 'user' | 'assistant' | 'tool' | (string & {});

// ============================================================================
// 4. Dynamic & Localizable Value Resolvers
// ============================================================================

/**
 * Universal localized or dynamic resolver type.
 * Supports static value, multi-locale dictionary mapping, or resolver function.
 */
export type LocalizableOrResolver<T, C = Record<string, unknown>> =
  T | Record<string, T> | ((context: C) => T);

/**
 * Dynamic text template or resolver function.
 */
export type DynamicTextOrResolver<C = Record<string, unknown>> =
  string | ((context: C, ...args: unknown[]) => string);

/**
 * Auto-continuation prompt template, multi-locale mapping, or resolver function.
 */
export type AutoContinuePromptResolver =
  | string
  | Record<string, string>
  | ((accumulatedText: string, ...args: unknown[]) => string)
  | ((context: Record<string, unknown>, ...args: unknown[]) => string)
  | ((
      brain: unknown,
      continuationIndex?: number,
      accumulatedText?: string
    ) => string);

// ============================================================================
// 5. Tool & Dialogue State
// ============================================================================

/**
 * State representing a tool execution pending confirmation or parameter extraction.
 */
export interface PendingToolState {
  /** Tool identifier name. */
  name?: string;
  /** Human-readable display label. */
  label?: string;
  /** Target tool definition. */
  tool?: ToolDefinition;
  /** Unique tool call identifier. */
  toolCallId?: string | null;
  /** Extracted or pending parameter inputs. */
  input?: { args?: Record<string, unknown> };
  /** Index signature for custom metadata. */
  [key: string]: unknown;
}

// ============================================================================
// 6. Lifecycle & Event Payloads
// ============================================================================

/** Payload emitted when auto-continuation starts or waits */
export interface AutoContinueStartInfo {
  continuationIndex: number;
  maxContinuations: number;
  accumulatedText: string;
}

/** Payload emitted when auto-continuation stream resumes with next chunk */
export interface AutoContinueResumeInfo extends AutoContinueStartInfo {
  chunk: string;
}

/** Payload emitted when auto-continuation ends */
export interface AutoContinueEndInfo {
  totalContinuations: number;
  maxContinuations: number;
  accumulatedText: string;
  reason: string;
}

/** Payload emitted when a requested tool definition is not found */
export interface ToolNotFoundErrorInfo {
  toolName: string;
  args: unknown;
  toolCall: unknown;
}

/** Payload emitted when an error occurs during tool execution */
export interface ToolErrorInfo {
  tool: unknown;
  toolName: string;
  args: unknown;
  toolCall: unknown;
  error: Error;
}

/** Progress payload emitted during LLM model loading */
export type LlmLoadProgressInfo =
  number | { progress?: number; [key: string]: unknown };
