import type { PendingToolState } from '@/core/types';

/**
 * Property definition inside a tool's JSON input schema.
 */
export interface ToolSchemaProperty {
  /** Property type ('string' | 'number' | 'integer' | 'boolean'). */
  type?: 'string' | 'number' | 'integer' | 'boolean' | string;
  /** Property display title. */
  title?: string;
  /** Property description for LLM or human prompt. */
  description?: string;
  /** Key to look up property value from session context. */
  contextKey?: string;
  /** Format constraints ('email' | 'url' | 'phone' | 'contact'). */
  format?: 'email' | 'url' | 'phone' | 'contact' | string;
  /** Keyword prefixes indicating this parameter in natural language. */
  prefixes?: string[];
  /** Allowed enumeration values. */
  enum?: string[];
  /** Minimum numeric value. */
  minimum?: number;
  /** Maximum numeric value. */
  maximum?: number;
  /** Maximum string character length. */
  maxLength?: number;
  [key: string]: unknown;
}

/**
 * JSON input schema for tool parameters.
 */
export interface ToolSchema {
  /** Root schema type (usually 'object'). */
  type?: 'object' | string;
  /** Dictionary of parameter properties. */
  properties?: Record<string, ToolSchemaProperty>;
  /** Array of required parameter names. */
  required?: string[];
  [key: string]: unknown;
}

/**
 * Execution payload received by tool execution callback.
 */
export interface ToolExecutePayload {
  args: Record<string, unknown>;
  context?: Record<string, unknown>;
  query?: string;
}

/**
 * Declarative definition of a tool callable by the AI or client rules.
 */
export interface ToolDefinition {
  /** Unique tool identifier name. */
  name: string;
  /** Human-readable display label. */
  label?: string;
  /** Detailed description of what the tool does (used by LLM for function calling). */
  description?: string;
  /** Keywords for fuzzy client-side routing. */
  keywords?: string[];
  /** Example phrases for intent similarity routing. */
  examples?: string[];
  /** Keywords that disqualify/exclude this tool. */
  excludeKeywords?: string[];
  /** Tool priority weighting (-10 to 10). */
  priority?: number;
  /** Routing confidence threshold score (0.15 to 0.95). */
  routeThreshold?: number;
  /** Whether execution requires explicit user confirmation. */
  requiresConfirmation?: boolean;
  /** Routing decision mode ('client' | 'ai' | 'hybrid'). */
  routingMode?: 'ai' | 'client' | 'hybrid' | string;
  /** Result handling mode ('ai_summary' | 'direct'). */
  resultMode?: 'ai_summary' | 'direct' | string;
  /** User confirmation timeout in milliseconds (default 60000). */
  confirmationTimeoutMs?: number | null;
  /** Legacy timeout in milliseconds. */
  timeoutMs?: number;
  /** Regex patterns or string keywords for client-side intent routing. */
  patterns?: Array<RegExp | string>;
  /** Execution callback function. */
  execute?: (
    payload: ToolExecutePayload | Record<string, unknown>,
    context?: Record<string, unknown>
  ) => Promise<unknown> | unknown;
  /** JSON Schema describing the tool's input parameters. */
  inputSchema?: ToolSchema;
}

/**
 * Scoring evaluation result for a tool against a user query.
 */
export interface ToolScoreResult {
  /** Calculated match score (0 to 1). */
  score: number;
  /** Reason for match score calculation. */
  reason: string;
}

/**
 * Candidate tool match returned from routing evaluation.
 */
export interface ToolRouteCandidate {
  /** Candidate tool definition. */
  tool: ToolDefinition;
  /** Match score (0 to 1). */
  score: number;
  /** Reason for match score. */
  reason?: string;
}

/**
 * Result of tool intent routing.
 */
export interface ToolRouteResult {
  /** Best unambiguous matching tool candidate, or null if ambiguous or none matched. */
  match: ToolRouteCandidate | null;
  /** Ambiguous candidate tools presented to the user when scores are close. */
  ambiguous: ToolRouteCandidate[];
  /** All candidates exceeding routing threshold sorted by score descending. */
  candidates: ToolRouteCandidate[];
}

/**
 * Validation result for tool input parameters against its schema.
 */
export interface ToolValidationResult {
  /** Whether all validation checks passed. */
  ok: boolean;
  /** Validated and sanitized argument dictionary. */
  args: Record<string, unknown>;
  /** Array of validation error messages. */
  errors: string[];
}

/**
 * Parameter extraction result from natural language query.
 */
export interface ToolExtractResult {
  /** Successfully extracted arguments. */
  args: Record<string, unknown>;
  /** Required parameter names that are missing. */
  missing: string[];
  /** Parameter validation errors encountered during extraction. */
  errors: string[];
}

/**
 * Result data payload when a tool finishes execution.
 */
export interface ToolResultData {
  /** Whether execution succeeded. */
  ok?: boolean;
  /** Error message if execution failed. */
  error?: string;
  /** Success message or result text. */
  message?: string;
  /** Unique tool call identifier. */
  callId: string;
  /** Tool name. */
  name?: string;
}

/**
 * State of a tool execution pending missing parameter input from user.
 */
export interface PendingToolInput {
  /** Tool being prepared. */
  tool: ToolDefinition;
  /** Original user query text. */
  query: string;
  /** Intent routing metadata. */
  routeMeta: Record<string, unknown>;
  /** Currently collected parameter arguments. */
  args: Record<string, unknown>;
  /** Missing required parameter names. */
  missing: string[];
}

/**
 * State of multiple ambiguous tool candidates presented to the user.
 */
export interface PendingToolChoice {
  /** Chat message ID containing the choice prompt. */
  messageId: string;
  /** Candidate choices offered to the user. */
  choices: ToolRouteCandidate[];
}

export interface ToolChatMessage {
  id?: string;
  role?: string;
  text?: string;
  pendingTool?: PendingToolState | null;
  choiceQuery?: string;
  pendingChoices?: ToolRouteCandidate[] | null;
  timedOut?: boolean;
  cancelled?: boolean;
  [key: string]: unknown;
}

/**
 * Settings for initializing the ToolsEngine.
 */
export interface ToolsEngineSetting {
  /** User confirmation timeout in milliseconds. */
  confirmationTimeoutMs?: number;
  /** Callback to append a chat message. */
  onAddChatMessage?: (
    role: string,
    text: string,
    options?: Record<string, unknown>
  ) => string | void;
  /** Callback to update an existing chat message. */
  onUpdateChatMessage?: (id: string, text: string, streaming?: boolean) => void;
  /** Callback to set chat history drawer open state. */
  onSetHistoryOpen?: (isOpen: boolean) => void;
  /** Callback to re-render chat history. */
  onRenderHistory?: () => void;
  /** Callback to immediately speak dialogue audio. */
  onSpokenAudioPlayNow?: (text: string) => void;
  /** Callback fired when a tool is triggered for execution. */
  onToolCall?: (pendingToolData: Record<string, unknown>) => void;
  /** Callback fired when a tool confirmation is offered. */
  onToolOffer?: (offer: {
    name: string;
    confirmation: boolean;
    toolCallId?: string | null;
  }) => void;
  /** Callback fired when a tool execution is confirmed by the user. */
  onToolConfirm?: (confirm: { name: string; toolCallId?: string | null }) => void;
  /** Callback fired when a tool is cancelled. */
  onToolCancel?: (cancel: {
    name: string;
    reason: string;
    toolCallId?: string | null;
  }) => void;
  /** Function returning current chat log array. */
  getChatLog?: () => ToolChatMessage[];
  /** Function returning current chat message sequence number. */
  getChatSeq?: () => number;
  /** Function returning whether continuous conversation mode is active. */
  isConvoOn?: () => boolean;
  /** Callback fired when a tool execution completes or yields a result. */
  onToolResult?: (resultData: ToolResultData) => void;
}

/**
 * Tools Engine instance for parameter extraction, intent routing, and function execution.
 */
export interface ToolsEngine {
  /** Registered host tool definitions. */
  HOST_TOOLS: ToolDefinition[];
  /** Active tool pending missing parameter input. */
  pendingToolInput: PendingToolInput | null;
  /** Active ambiguous tool choices pending user selection. */
  pendingToolChoice: PendingToolChoice | null;
  /** Active tool message ID pending user confirmation. */
  pendingToolConfirmation: string | null;
  /** Current confirmation timeout in milliseconds. */
  confirmationTimeoutMs: number;
  /** Registered callback to add a chat message. */
  readonly onAddChatMessage?: (
    role: string,
    text: string,
    options?: Record<string, unknown>
  ) => string | void;
  /** Registered callback to update a chat message. */
  readonly onUpdateChatMessage?: (
    id: string,
    text: string,
    streaming?: boolean
  ) => void;
  /** Registered callback to set history drawer state. */
  readonly onSetHistoryOpen?: (isOpen: boolean) => void;
  /** Registered callback to render history drawer. */
  readonly onRenderHistory?: () => void;
  /** Registered callback to speak dialogue audio. */
  readonly onSpokenAudioPlayNow?: (text: string) => void;
  /** Routes query to the best host tool candidate. */
  routeHostTool(queryText: string): ToolRouteResult;
  /** Gets tools available for AI model calling. */
  getAiAvailableTools(): ToolDefinition[];
  /** Converts tools to OpenAI-compatible function calling schemas. */
  toOpenAiTools(): OpenAITool[];
  /** Generates parameter collection prompt for missing field. */
  parameterPrompt(
    tool: ToolDefinition,
    propertyName: string,
    errorText?: string
  ): string;
  /** Prepares a tool for execution by extracting parameters. */
  prepareTool(
    tool: ToolDefinition,
    query: string,
    routeMeta?: Record<string, unknown> | null,
    existingArgs?: Record<string, unknown>
  ): void;
  /** Continues collecting missing parameters from user input. */
  continueToolInput(inputText: string): boolean;
  /** Offers ambiguous tool choices to the user. */
  offerToolChoices(query: string, candidates: ToolRouteCandidate[]): void;
  /** Processes user response to ambiguous tool choice. */
  continueToolChoice(inputText: string): boolean;
  /** Selects a specific tool choice. */
  chooseTool(messageId: string, choiceIndex: number): void;
  /** Offers host tool execution confirmation or executes directly. */
  offerHostTool(
    tool: ToolDefinition,
    query: string,
    routeMeta?: Record<string, unknown> | null,
    args?: Record<string, unknown>,
    options?: Record<string, unknown>
  ): void;
  /** Executes a confirmed pending tool. */
  executePendingTool(messageId: string): void;
  /** Cancels a pending tool. */
  cancelPendingTool(messageId: string, options?: { reason?: string }): void;
  /** Handles user confirmation answer ('yes', 'no', 'cancel'). */
  continueToolConfirmation(inputText: string): boolean;
  /** Handles tool execution result response. */
  handleToolResult(resultData: ToolResultData): void;
  /** Executes a tool directly with arguments and context. */
  executeToolDirectly(
    tool: ToolDefinition,
    args: Record<string, unknown>,
    pendingToolData?: Record<string, unknown>
  ): Promise<unknown>;
}

export interface OpenAIToolProperty {
  type: string;
  description: string;
  enum?: string[];
}

export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, OpenAIToolProperty>;
      required: string[];
    };
  };
}
