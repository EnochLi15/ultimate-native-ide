/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Ultimate Native IDE. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

/**
 * R5: agent-view state machine — VS Code-local copy of the
 * @ultimate-ide/agent-view pure logic.
 *
 * This file is a direct copy of the agent-view state reducer, so the VS Code
 * fork can import it without @ultimate-ide package resolution. In production,
 * the @ultimate-ide/agent-view package is linked and this file is replaced
 * by an import.
 *
 * @module vs/workbench/contrib/ultimateNative/agent-view-state
 */

/** The interaction mode of the agent view. */
export type AgentViewMode = 'command-bar' | 'inline' | 'panel' | 'task' | 'review';

/** One message in the conversation stream. */
export interface ConversationMessage {
  readonly id: string;
  readonly role: 'user' | 'assistant';
  readonly content: Array<{ type: 'text'; text: string } | { type: 'image'; mediaType: string; data: string }>;
  readonly timestamp: number;
  readonly turn?: number;
  readonly step?: number;
}

/** A tool activity entry. */
export interface ToolActivity {
  readonly callId: string;
  readonly tool: string;
  readonly args?: unknown;
  readonly status: 'pending' | 'completed' | 'error';
  readonly result?: unknown[];
  readonly timestamp: number;
}

/** The full agent view state. */
export interface AgentViewState {
  readonly mode: AgentViewMode;
  readonly agentStatus: 'idle' | 'running' | 'disconnected';
  readonly messages: readonly ConversationMessage[];
  readonly toolActivity: readonly ToolActivity[];
  readonly pendingApprovals: readonly unknown[];
  readonly connected: boolean;
  readonly currentTurn: number;
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
};

/** Reduce an AgentHostEvent into the next state. */
export function reduceAgentView(state: AgentViewState, event: Record<string, unknown>): AgentViewState {
  const kind = event.kind as string;
  switch (kind) {
    case 'agent-status':
      return { ...state, agentStatus: event.status as AgentViewState['agentStatus'] };
    case 'session-event': {
      const sessionEvent = event as { type: string; data: Record<string, unknown>; seq: number; time: number };
      return reduceSessionEvent(state, sessionEvent);
    }
    case 'approval-request':
      return { ...state, pendingApprovals: [...state.pendingApprovals, event] };
    default:
      return state;
  }
}

function reduceSessionEvent(state: AgentViewState, event: { type: string; data: Record<string, unknown>; seq: number; time: number }): AgentViewState {
  const data = event.data;
  switch (event.type) {
    case 'user/message': {
      const msg: ConversationMessage = {
        id: `msg-${event.seq}`,
        role: 'user',
        content: data.content as ConversationMessage['content'],
        timestamp: event.time,
      };
      return { ...state, messages: [...state.messages, msg] };
    }
    case 'assistant/message': {
      const message = data.message as { content: ConversationMessage['content'] };
      const msg: ConversationMessage = {
        id: `msg-${event.seq}`,
        role: 'assistant',
        content: message.content,
        timestamp: event.time,
        turn: data.turn as number,
        step: data.step as number,
      };
      return { ...state, messages: [...state.messages, msg] };
    }
    case 'tool/call': {
      const activity: ToolActivity = {
        callId: data.callId as string,
        tool: data.tool as string,
        args: data.args,
        status: 'pending',
        timestamp: event.time,
      };
      return { ...state, toolActivity: [...state.toolActivity, activity] };
    }
    case 'tool/result': {
      const callId = data.callId as string;
      const isError = data.isError as boolean;
      return {
        ...state,
        toolActivity: state.toolActivity.map((a) =>
          a.callId === callId
            ? { ...a, status: isError ? 'error' : 'completed', result: data.content as unknown[] }
            : a,
        ),
      };
    }
    case 'turn/start':
      return { ...state, currentTurn: data.turn as number };
    default:
      return state;
  }
}

export function setMode(state: AgentViewState, mode: AgentViewMode): AgentViewState {
  return { ...state, mode };
}

export function setConnected(state: AgentViewState, connected: boolean): AgentViewState {
  return { ...state, connected, agentStatus: connected ? state.agentStatus : 'disconnected' };
}

export function resolveApproval(state: AgentViewState, approvalId: string): AgentViewState {
  return {
    ...state,
    pendingApprovals: state.pendingApprovals.filter((a) => (a as { id: string }).id !== approvalId),
  };
}
