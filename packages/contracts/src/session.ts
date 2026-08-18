/**
 * Session-log contract types — the durable, append-only fact stream that is
 * the IDE's source of truth (architecture invariant 2: "session log 是事实之源").
 *
 * These mirror `@deepseek-ai/dsh-session` (`packages/core/session/src/types.ts`)
 * in a dependency-free form. The Agent Host owns the real log; the renderer
 * subscribes to the event stream over the deep-contract RPC.
 *
 * @module @ultimate-ide/contracts/session
 */

import type { SessionId } from './ids.ts'
import type { ContentBlock } from './tools.ts'

/** A user-supplied message routed to an agent's inbox. */
export interface UserMessage {
  readonly role: 'user'
  readonly content: ContentBlock[]
}

/** A committed assistant message from one model request. */
export interface AssistantMessage {
  readonly role: 'assistant'
  readonly content: ContentBlock[]
}

/** Token usage for one model request. */
export interface TokenUsage {
  readonly inputTokens?: number
  readonly outputTokens?: number
  readonly reasoningTokens?: number
  readonly cacheReadTokens?: number
  readonly cacheWriteTokens?: number
}

/**
 * The durable event vocabulary. Each key maps to the `data` payload of one
 * {@link SessionEvent}. The renderer switches on `event.type` to narrow
 * `event.data` without casts.
 *
 * Source: `@deepseek-ai/dsh-session` `SessionEventMap`
 * (`packages/core/session/src/types.ts:236`).
 */
export interface SessionEventMap {
  /** A turn boundary opened. */
  'turn/start': { turn: number }
  /** A turn boundary closed. */
  'turn/end': { turn: number }
  /** A step (one model request + its tool calls) started. */
  'step/start': { turn: number; step: number }
  /** A step ended. */
  'step/end': { turn: number; step: number }
  /** Identified user input admitted into the log. */
  'user/message': UserMessage
  /** A committed assistant message from a completed model request. */
  'assistant/message': {
    turn: number
    step: number
    message: AssistantMessage
    usage?: TokenUsage
  }
  /** A streaming text chunk (live, pre-commit). */
  'assistant/chunk': {
    turn: number
    step: number
    seq: number
    text: string
  }
  /** A tool was called by the model. */
  'tool/call': {
    turn: number
    step: number
    callId: string
    tool: string
    args: unknown
  }
  /** A tool call completed with its result. */
  'tool/result': {
    turn: number
    step: number
    callId: string
    content: ContentBlock[]
    isError: boolean
  }
  /** An agent's lifecycle state changed. */
  'agent/status': { sessionId: SessionId; status: 'idle' | 'running' }
}

/** The appendable event-type keys. */
export type SessionEventType = keyof SessionEventMap

/**
 * One durable fact in the session log. The `{ [K in ...]: {...} }[K]` mapping
 * makes `switch (event.type)` narrow `event.data` to the matching payload.
 *
 * Source: `@deepseek-ai/dsh-session` `SessionEvent`
 * (`packages/core/session/src/types.ts:404`).
 */
export type SessionEvent<T extends SessionEventType = SessionEventType> = {
  type: T
  /** Monotonic sequence number within the session. */
  seq: number
  /** Unix epoch milliseconds. */
  time: number
  data: SessionEventMap[T]
}
