/**
 * Tool contract types — the model-facing capability registry (`ctx.tools`).
 *
 * These mirror the minimal shapes the renderer needs from
 * `@deepseek-ai/dsh-core-tools` (`packages/core/tools/src/index.ts`) and
 * `@deepseek-ai/dsh-llm` (`packages/llm/llm/src/types.ts`). The Agent Host
 * owns the real tool registry; the renderer invokes tools and renders their
 * results through the bridge RPC.
 *
 * @module @ultimate-ide/contracts/tools
 */

/** A text segment of model-facing content. */
export interface TextBlock {
  readonly type: 'text'
  readonly text: string
}

/** An image segment of model-facing content. */
export interface ImageBlock {
  readonly type: 'image'
  readonly mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'
  readonly data: string // base64
}

/** One block of model-facing content (text or image). */
export type ContentBlock = TextBlock | ImageBlock

/** A JSON value (the type tools return and persist). */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

/** A tool's input schema (JSON Schema fragment). */
export interface ToolSchema {
  readonly name: string
  readonly description: string
  readonly parameters: object
}

/** The completed outcome of a tool call. */
export interface ToolResult {
  /** The final model-facing content (or rendered error text on failure). */
  readonly content: ContentBlock[]
  /** Whether the call failed. */
  readonly isError: boolean
  /** The tool-private presentation payload. */
  readonly meta?: JsonValue
}

/** A registered tool's schema, for the renderer to display available tools. */
export interface ToolDefinition extends ToolSchema {
  /** Cooperative tool-call timeout budget in milliseconds. Omit for no deadline. */
  readonly timeoutMs?: number
}

/** Options for invoking a tool through the bridge. */
export interface ToolInvocationOptions {
  /** The calling agent's session id (scopes the invocation). */
  readonly sessionId: string
  /** Cancellation token id; the renderer may cancel by id. */
  readonly cancelId?: string
}
