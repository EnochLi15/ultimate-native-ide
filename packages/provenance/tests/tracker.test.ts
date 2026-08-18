/**
 * R2 provenance test: verify the tracker records and queries edit attribution.
 *
 * @module @ultimate-ide/provenance/tests/tracker.test
 */

import { describe, it, expect } from 'vitest'
import { ProvenanceTracker, ProvenanceRegistry, agentProvenance, humanProvenance } from '../src/index.ts'

describe('R2: provenance tracker', () => {
  it('records agent edits and queries them by line', () => {
    const tracker = new ProvenanceTracker('/src/foo.ts')
    const prov = agentProvenance('session-1' as never, 1, 1, 'call-1')
    tracker.recordEdit({ startLine: 10, endLine: 15 }, prov)

    const result = tracker.queryLine(12)
    expect(result).toBeDefined()
    expect(result?.initiator).toBe('agent')
    expect(result?.turn).toBe(1)
    expect(result?.callId).toBe('call-1')
  })

  it('last-write-wins: a later edit overrides an earlier one', () => {
    const tracker = new ProvenanceTracker('/src/foo.ts')
    const agentProv = agentProvenance('session-1' as never, 1, 1)
    const humanProv = humanProvenance()
    tracker.recordEdit({ startLine: 5, endLine: 10 }, agentProv)
    tracker.recordEdit({ startLine: 7, endLine: 8 }, humanProv)

    // Line 7: human overrode agent.
    expect(tracker.queryLine(7)?.initiator).toBe('human')
    // Line 9: still agent.
    expect(tracker.queryLine(9)?.initiator).toBe('agent')
  })

  it('emits provenance events to listeners', () => {
    const tracker = new ProvenanceTracker('/src/foo.ts')
    const events: Array<{ path: string; initiator: string }> = []
    tracker.onEvent((e) => events.push({ path: e.path, initiator: e.provenance.initiator }))

    tracker.recordEdit({ startLine: 1, endLine: 5 }, humanProvenance())
    tracker.recordEdit({ startLine: 10, endLine: 20 }, agentProvenance('s1' as never, 1, 1))

    expect(events).toHaveLength(2)
    expect(events[0].initiator).toBe('human')
    expect(events[1].initiator).toBe('agent')
  })

  it('snapshot captures the full document provenance', () => {
    const tracker = new ProvenanceTracker('/src/foo.ts')
    tracker.recordEdit({ startLine: 1, endLine: 5 }, humanProvenance())
    tracker.recordEdit({ startLine: 10, endLine: 20 }, agentProvenance('s1' as never, 1, 1))

    const snap = tracker.snapshot()
    expect(snap.path).toBe('/src/foo.ts')
    expect(snap.version).toBe(2)
    expect(snap.edits).toHaveLength(2)
  })
})

describe('R2: provenance registry', () => {
  it('manages trackers per document path', () => {
    const registry = new ProvenanceRegistry()
    const t1 = registry.forPath('/src/a.ts')
    const t2 = registry.forPath('/src/b.ts')
    const t1Again = registry.forPath('/src/a.ts')

    expect(t1).toBe(t1Again) // same instance
    expect(t1).not.toBe(t2)
    expect(registry.paths()).toContain('/src/a.ts')
    expect(registry.paths()).toContain('/src/b.ts')
  })

  it('global listeners receive events from all documents', () => {
    const registry = new ProvenanceRegistry()
    const events: string[] = []
    registry.onEvent((e) => events.push(e.path))

    registry.forPath('/src/a.ts').recordEdit({ startLine: 1, endLine: 5 }, humanProvenance())
    registry.forPath('/src/b.ts').recordEdit({ startLine: 1, endLine: 5 }, humanProvenance())

    expect(events).toEqual(['/src/a.ts', '/src/b.ts'])
  })
})
