/**
 * R5: agent view state — the reactive state machine for the native agent panel.
 *
 * Manages the current mode, conversation stream, pending approvals, agent
 * status, and tool activity. This is the pure state layer; the VS Code fork
 * binds it to React/workbench rendering.
 *
 * @module @ultimate-ide/agent-view/state
 */

import type { AgentViewMode } from './modes.ts'
import type { AgentHostEvent, ApprovalRequest, AgentStatusEvent } from '@ultimate-ide/contracts'
import type { SessionEvent } from '@ultimate-ide/contracts/session'
import type { ContentBlock } from '@ultimate-ide/contracts/tools'

/** One message in the conversation stream. */
export interface ConversationMessage {
  readonly id: string
  readonly role: 'user' | 'assistant'
  readonly content: ContentBlock[]
  readonly timestamp: number
  /** The turn/step, when from an agent. */
  readonly turn?: number
  readonly step?: number
}

/** A tool activity entry (pending or completed). */
export interface ToolActivity {
  readonly callId: string
  readonly tool: string
  readonly args?: unknown
  readonly status: 'pending' | 'completed' | 'error'
  readonly result?: ContentBlock[]
  readonly timestamp: number
}

/** The full agent view state. */
export interface AgentViewState {
  /** The current interaction mode. */
  readonly mode: AgentViewMode
  /** The agent's lifecycle status. */
  readonly agentStatus: 'idle' | 'running' | 'disconnected'
  /** The conversation messages (ordered). */
  readonly messages: readonly ConversationMessage[]
  /** Active tool calls (pending or recently completed). */
  readonly toolActivity: readonly ToolActivity[]
  /** Pending approval requests (blocking). */
  readonly pendingApprovals: readonly ApprovalRequest[]
  /** Whether the agent is connected to the Agent Host. */
  readonly connected: boolean
  /** The current turn number. */
  readonly currentTurn: number
}

/** The initial state. */
export const initialAgentViewState: AgentViewState = {
  mode: 'command-bar',
  agentStatus: 'disconnected',
  messages: [],
  toolActivity: [],
  pendingApprovals: [],
  connected: false,
  currentTurn: 0,
}

/**
 * The agent view state reducer — a pure function that produces the next state
 * from an event. The VS Code fork dispatches AgentHostEvents into this reducer.
 *
 * @param state - the current state.
 * @param event - the event from the Agent Host.
 * @returns the next state.
 */
export function reduceAgentView(state: AgentViewState, event: AgentHostEvent): AgentViewState {
  switch (event.kind) {
    case 'agent-status': {
      const statusEvent = event as AgentStatusEvent
      return { ...state, agentStatus: statusEvent.status }
    }

    case 'session-event': {
      const sessionEvent = (event as { sessionId: string } & SessionEvent) as SessionEvent
      return reduceSessionEvent(state, sessionEvent)
    }

    case 'approval-request': {
      const req = event as ApprovalRequest
      return { ...state, pendingApprovals: [...state.pendingApprovals, req] }
    }

    case 'editor-open':
    case 'editor-show-diff':
    case 'workbench-layout': {
      // These are handled by the workbench UI directly (editor/layout actions);
      // the agent view state doesn't change.
      return state
    }

    case 'terminal-data':
    case 'terminal-exit': {
      // Terminal events are handled by the terminal panel; no state change here.
      return state
    }

    case 'error': {
      console.error('[agent-view] error event:', event)
      return state
    }

    default:
      return state
  }
}

/** Reduce one session event into the agent view state. */
function reduceSessionEvent(state: AgentViewState, event: SessionEvent): AgentViewState {
  const data = event.data as Record<string, unknown>

  switch (event.type) {
    case 'user/message': {
      const content = data.content as ContentBlock[]
      const msg: ConversationMessage = {
        id: `msg-${event.seq}`,
        role: 'user',
        content,
        timestamp: event.time,
      }
      return { ...state, messages: [...state.messages, msg] }
    }

    case 'assistant/message': {
      const message = data.message as { content: ContentBlock[] }
      const msg: ConversationMessage = {
        id: `msg-${event.seq}`,
        role: 'assistant',
        content: message.content,
        timestamp: event.time,
        turn: data.turn as number,
        step: data.step as number,
      }
      return { ...state, messages: [...state.messages, msg] }
    }

    case 'tool/call': {
      const activity: ToolActivity = {
        callId: data.callId as string,
        tool: data.tool as string,
        args: data.args,
        status: 'pending',
        timestamp: event.time,
      }
      return { ...state, toolActivity: [...state.toolActivity, activity] }
    }

    case 'tool/result': {
      const callId = data.callId as string
      const isError = data.isError as boolean
      const content = data.content as ContentBlock[]
      return {
        ...state,
        toolActivity: state.toolActivity.map((a) =>
          a.callId === callId
            ? { ...a, status: isError ? 'error' : 'completed', result: content }
            : a,
        ),
      }
    }

    case 'turn/start': {
      return { ...state, currentTurn: data.turn as number }
    }

    default:
      return state
  }
}

/** Set the interaction mode (from human or agent action). */
export function setMode(state: AgentViewState, mode: AgentViewMode): AgentViewState {
  return { ...state, mode }
}

/** Mark the agent as connected (after IdeBridge.connect succeeds). */
export function setConnected(state: AgentViewState, connected: boolean): AgentViewState {
  return {
    ...state,
    connected,
    agentStatus: connected ? state.agentStatus : 'disconnected',
  }
}

/** Clear a resolved approval from the pending list. */
export function resolveApproval(state: AgentViewState, approvalId: string): AgentViewState {
  return {
    ...state,
    pendingApprovals: state.pendingApprovals.filter((a) => a.id !== approvalId),
  }
}
