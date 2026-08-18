/**
 * R3 session-log-spine tests: timeline, task tree, and replay projections.
 *
 * @module @ultimate-ide/session-log-spine/tests/spine.test
 */

import { describe, it, expect } from 'vitest'
import { deriveTimeline, filterByCategory, timelineSummary } from '../src/timeline.ts'
import { deriveTaskTree, countNodes } from '../src/task-tree.ts'
import { ReplayCursor, findForkPoint, forkSeed } from '../src/replay.ts'
import type { SessionEvent } from '@ultimate-ide/contracts/session'

// Helper: create a minimal session event.
function ev(seq: number, type: string, data: Record<string, unknown>): SessionEvent {
  return { seq, time: seq * 1000, type, data } as SessionEvent
}

// A sample session: turn 1 with a user message, assistant message, and tool call.
const sampleEvents: SessionEvent[] = [
  ev(0, 'turn/start', { turn: 1 }),
  ev(1, 'user/message', { content: [{ type: 'text', text: 'Fix the bug' }] }),
  ev(2, 'step/start', { turn: 1, step: 1 }),
  ev(3, 'tool/call', { turn: 1, step: 1, callId: 'c1', tool: 'bash', args: { command: 'grep bug' } }),
  ev(4, 'tool/result', { turn: 1, step: 1, callId: 'c1', content: [], isError: false }),
  ev(5, 'assistant/message', { turn: 1, step: 1, message: { content: [{ type: 'text', text: 'Found it' }] } }),
  ev(6, 'step/end', { turn: 1, step: 1 }),
  ev(7, 'turn/end', { turn: 1 }),
]

describe('R3: timeline projection', () => {
  it('derives a timeline entry per event', () => {
    const timeline = deriveTimeline(sampleEvents)
    expect(timeline).toHaveLength(8)
    expect(timeline[0].category).toBe('boundary')
    expect(timeline[0].label).toContain('Turn 1')
  })

  it('categorizes conversation and tool events', () => {
    const timeline = deriveTimeline(sampleEvents)
    const conversation = filterByCategory(timeline, 'conversation')
    const tools = filterByCategory(timeline, 'tool')
    expect(conversation.length).toBe(2) // user + assistant
    expect(tools.length).toBe(2) // tool/call + tool/result
  })

  it('generates a summary', () => {
    const timeline = deriveTimeline(sampleEvents)
    const summary = timelineSummary(timeline)
    expect(summary).toContain('8 events')
    expect(summary).toContain('2 conversation')
    expect(summary).toContain('2 tool')
  })
})

describe('R3: task tree projection', () => {
  it('builds a tree with turn nodes', () => {
    const tree = deriveTaskTree(sampleEvents)
    expect(tree.kind).toBe('turn')
    expect(tree.children.length).toBe(1) // one turn
    expect(tree.children[0].kind).toBe('turn')
    expect(tree.children[0].label).toBe('Turn 1')
  })

  it('marks completed turns', () => {
    const tree = deriveTaskTree(sampleEvents)
    expect(tree.children[0].completed).toBe(true)
  })

  it('counts nodes by kind', () => {
    const tree = deriveTaskTree(sampleEvents)
    const counts = countNodes(tree)
    expect(counts.turn).toBe(2) // root + turn 1
    expect(counts.goal).toBe(0)
    expect(counts.todo).toBe(0)
  })

  it('extracts goal/todo/subagent from tool calls', () => {
    const eventsWithTasks: SessionEvent[] = [
      ev(0, 'turn/start', { turn: 1 }),
      ev(1, 'tool/call', { turn: 1, step: 1, callId: 'c1', tool: 'create_goal', args: { objective: 'Fix all bugs' } }),
      ev(2, 'tool/call', { turn: 1, step: 1, callId: 'c2', tool: 'todo_write', args: { todos: [
        { content: 'Find bug', status: 'completed' },
        { content: 'Fix bug', status: 'pending' },
      ] } }),
      ev(3, 'tool/call', { turn: 1, step: 1, callId: 'c3', tool: 'subagent', args: { description: 'Search codebase' } }),
      ev(4, 'turn/end', { turn: 1 }),
    ]
    const tree = deriveTaskTree(eventsWithTasks)
    const counts = countNodes(tree)
    expect(counts.goal).toBe(1)
    expect(counts.todo).toBe(2)
    expect(counts.subagent).toBe(1)
  })
})

describe('R3: replay cursor', () => {
  it('steps forward through events', () => {
    const cursor = new ReplayCursor(sampleEvents)
    expect(cursor.pos).toBe(0)
    expect(cursor.canForward).toBe(true)

    const e1 = cursor.forward()
    expect(e1?.seq).toBe(0)
    expect(cursor.pos).toBe(1)

    cursor.toEnd()
    expect(cursor.canForward).toBe(false)
  })

  it('steps backward', () => {
    const cursor = new ReplayCursor(sampleEvents)
    cursor.toEnd()
    expect(cursor.canBackward).toBe(true)

    const e = cursor.backward()
    expect(e?.seq).toBe(7)
    expect(cursor.pos).toBe(7)
  })

  it('jumps to a specific seq', () => {
    const cursor = new ReplayCursor(sampleEvents)
    const e = cursor.jumpTo(5)
    expect(e?.seq).toBe(5)
    expect(cursor.pos).toBe(6)
  })

  it('returns events so far', () => {
    const cursor = new ReplayCursor(sampleEvents)
    cursor.jumpTo(3)
    const soFar = cursor.eventsSoFar()
    expect(soFar.length).toBe(4) // seq 0,1,2,3
  })
})

describe('R3: fork/resume', () => {
  it('finds the fork point (last turn/end before a seq)', () => {
    const forkPoint = findForkPoint(sampleEvents, 7)
    expect(forkPoint).toBe(7) // turn/end at seq 7
  })

  it('finds the fork point before a mid-session seq', () => {
    const forkPoint = findForkPoint(sampleEvents, 5)
    expect(forkPoint).toBe(0) // no turn/end before seq 5 (turn/end is at 7)
  })

  it('extracts the fork seed (events up to fork point)', () => {
    const seed = forkSeed(sampleEvents, 7)
    expect(seed.length).toBe(8) // all events up to and including seq 7
  })

  it('returns empty seed when no fork point', () => {
    const seed = forkSeed(sampleEvents, 5)
    expect(seed.length).toBe(0)
  })
})
