/**
 * R5 agent-view tests: mode management + state reducer.
 *
 * @module @ultimate-ide/agent-view/tests/state.test
 */

import { describe, it, expect } from 'vitest'
import {
  AGENT_VIEW_MODES,
  getModeMeta,
  isMainAreaMode,
  initialAgentViewState,
  reduceAgentView,
  setMode,
  setConnected,
  resolveApproval,
} from '../src/index.ts'
import type { AgentHostEvent, ApprovalRequest } from '@ultimate-ide/contracts/rpc'
import type { SessionEvent } from '@ultimate-ide/contracts/session'

function sessionEvent(seq: number, type: string, data: Record<string, unknown>): AgentHostEvent {
  return { kind: 'session-event', sessionId: 's1' as never, seq, time: seq * 1000, type, data } as never
}

describe('R5: agent view modes', () => {
  it('defines 5 modes with metadata', () => {
    expect(AGENT_VIEW_MODES.length).toBe(5)
    const ids = AGENT_VIEW_MODES.map((m) => m.id)
    expect(ids).toEqual(['command-bar', 'panel', 'task', 'review', 'inline'])
  })

  it('getModeMeta returns the right mode', () => {
    const meta = getModeMeta('task')
    expect(meta?.label).toBe('Task')
    expect(meta?.icon).toBe('rocket')
  })

  it('isMainAreaMode identifies task and review', () => {
    expect(isMainAreaMode('task')).toBe(true)
    expect(isMainAreaMode('review')).toBe(true)
    expect(isMainAreaMode('command-bar')).toBe(false)
    expect(isMainAreaMode('panel')).toBe(false)
  })
})

describe('R5: agent view state reducer', () => {
  it('starts with initial state', () => {
    expect(initialAgentViewState.mode).toBe('command-bar')
    expect(initialAgentViewState.agentStatus).toBe('disconnected')
    expect(initialAgentViewState.messages).toHaveLength(0)
    expect(initialAgentViewState.connected).toBe(false)
  })

  it('handles agent-status events', () => {
    const event: AgentHostEvent = { kind: 'agent-status', sessionId: 's1' as never, status: 'running' } as never
    const next = reduceAgentView(initialAgentViewState, event)
    expect(next.agentStatus).toBe('running')
  })

  it('handles user/message session events', () => {
    const event = sessionEvent(0, 'user/message', {
      content: [{ type: 'text', text: 'Hello agent' }],
    })
    const next = reduceAgentView(initialAgentViewState, event)
    expect(next.messages).toHaveLength(1)
    expect(next.messages[0].role).toBe('user')
  })

  it('handles assistant/message session events', () => {
    const event = sessionEvent(1, 'assistant/message', {
      turn: 1,
      step: 1,
      message: { content: [{ type: 'text', text: 'Hi there' }] },
    })
    const next = reduceAgentView(initialAgentViewState, event)
    expect(next.messages).toHaveLength(1)
    expect(next.messages[0].role).toBe('assistant')
    expect(next.messages[0].turn).toBe(1)
  })

  it('tracks tool call → result lifecycle', () => {
    const callEvent = sessionEvent(2, 'tool/call', {
      turn: 1, step: 1, callId: 'c1', tool: 'bash', args: { command: 'ls' },
    })
    const resultEvent = sessionEvent(3, 'tool/result', {
      turn: 1, step: 1, callId: 'c1', content: [{ type: 'text', text: 'file.ts' }], isError: false,
    })

    let state = reduceAgentView(initialAgentViewState, callEvent)
    expect(state.toolActivity).toHaveLength(1)
    expect(state.toolActivity[0].status).toBe('pending')

    state = reduceAgentView(state, resultEvent)
    expect(state.toolActivity[0].status).toBe('completed')
    expect(state.toolActivity[0].result?.[0]).toMatchObject({ type: 'text', text: 'file.ts' })
  })

  it('tracks turn number', () => {
    const event = sessionEvent(0, 'turn/start', { turn: 3 })
    const next = reduceAgentView(initialAgentViewState, event)
    expect(next.currentTurn).toBe(3)
  })

  it('handles approval-request events', () => {
    const req: ApprovalRequest = {
      id: 'ap1', sessionId: 's1' as never, approvalKind: 'bash', description: 'run rm',
    }
    const event: AgentHostEvent = { kind: 'approval-request', ...req } as never
    const next = reduceAgentView(initialAgentViewState, event)
    expect(next.pendingApprovals).toHaveLength(1)
    expect(next.pendingApprovals[0].id).toBe('ap1')
  })

  it('resolveApproval removes from pending', () => {
    const state = {
      ...initialAgentViewState,
      pendingApprovals: [
        { id: 'ap1', sessionId: 's1' as never, approvalKind: 'bash' as const, description: 'test' },
        { id: 'ap2', sessionId: 's1' as never, approvalKind: 'fs-write' as const, description: 'test2' },
      ],
    }
    const next = resolveApproval(state, 'ap1')
    expect(next.pendingApprovals).toHaveLength(1)
    expect(next.pendingApprovals[0].id).toBe('ap2')
  })

  it('setMode changes the mode', () => {
    const next = setMode(initialAgentViewState, 'task')
    expect(next.mode).toBe('task')
  })

  it('setConnected updates connection state', () => {
    const connected = setConnected(initialAgentViewState, true)
    expect(connected.connected).toBe(true)

    const disconnected = setConnected(connected, false)
    expect(disconnected.connected).toBe(false)
    expect(disconnected.agentStatus).toBe('disconnected')
  })
})
