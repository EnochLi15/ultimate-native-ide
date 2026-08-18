/**
 * R2: provenance tracker — maintains the per-document provenance map.
 *
 * The tracker is the queryable structure that answers "who changed line N?".
 * It is fed by:
 *  - Agent edits (via the DshKernel's tool execution path, which carries
 *    provenance on the WorkspaceEdit)
 *  - Human edits (via VS Code's ITextModel content change events)
 *  - Extension edits (via BulkEditService with extension initiator)
 *
 * The tracker is the bridge between VS Code's document model and the DSH
 * session log: it records every edit's provenance and can serialize the full
 * history for log replay, branching, and the timeline view.
 *
 * @module @ultimate-ide/provenance/tracker
 */

import type {
  DocumentProvenance,
  EditInitiator,
  LineRange,
  Provenance,
  ProvenanceEvent,
} from './types.ts'
import type { SessionId } from '@ultimate-ide/contracts/ids'

/**
 * The provenance tracker — one instance per open document.
 * Maintains a line-range → provenance map that updates as edits arrive.
 */
export class ProvenanceTracker {
  private readonly path: string
  private version = 0
  /** Ordered by startLine; ranges may overlap (last-write-wins on query). */
  private readonly ranges: Array<{ range: LineRange; provenance: Provenance }> = []
  /** Event listeners. */
  private readonly listeners: Array<(event: ProvenanceEvent) => void> = []

  constructor(path: string) {
    this.path = path
  }

  /** Record an edit at a line range with the given provenance. */
  recordEdit(range: LineRange, provenance: Provenance): void {
    this.version++
    this.ranges.push({ range, provenance })
    // Notify listeners.
    const event: ProvenanceEvent = {
      kind: 'provenance-edit',
      path: this.path,
      version: this.version,
      range,
      provenance,
    }
    for (const listener of this.listeners) listener(event)
  }

  /** Query: who last edited a line? Returns the provenance, or undefined. */
  queryLine(line: number): Provenance | undefined {
    // Last-write-wins: iterate from the end.
    for (let i = this.ranges.length - 1; i >= 0; i--) {
      const { range, provenance } = this.ranges[i]
      if (line >= range.startLine && line <= range.endLine) return provenance
    }
    return undefined
  }

  /** Query: who last edited a range? Returns the most recent provenance overlapping. */
  queryRange(startLine: number, endLine: number): Provenance | undefined {
    for (let i = this.ranges.length - 1; i >= 0; i--) {
      const { range, provenance } = this.ranges[i]
      // Overlap check.
      if (startLine <= range.endLine && endLine >= range.startLine) return provenance
    }
    return undefined
  }

  /** Get the full document provenance snapshot. */
  snapshot(): DocumentProvenance {
    return {
      path: this.path,
      version: this.version,
      edits: this.ranges.map((r) => [r.range, r.provenance] as const),
    }
  }

  /** Subscribe to provenance events. */
  onEvent(listener: (event: ProvenanceEvent) => void): () => void {
    this.listeners.push(listener)
    return () => {
      const i = this.listeners.indexOf(listener)
      if (i >= 0) this.listeners.splice(i, 1)
    }
  }

  /** Get the current version. */
  get currentVersion(): number {
    return this.version
  }
}

/**
 * The provenance registry — one tracker per open document.
 * The workbench creates this during startup; all edits route through it.
 */
export class ProvenanceRegistry {
  private readonly trackers = new Map<string, ProvenanceTracker>()
  private readonly globalListeners: Array<(event: ProvenanceEvent) => void> = []

  /** Get or create a tracker for a document. */
  forPath(path: string): ProvenanceTracker {
    let tracker = this.trackers.get(path)
    if (!tracker) {
      tracker = new ProvenanceTracker(path)
      tracker.onEvent((event) => {
        for (const listener of this.globalListeners) listener(event)
      })
      this.trackers.set(path, tracker)
    }
    return tracker
  }

  /** Subscribe to all provenance events across all documents. */
  onEvent(listener: (event: ProvenanceEvent) => void): () => void {
    this.globalListeners.push(listener)
    return () => {
      const i = this.globalListeners.indexOf(listener)
      if (i >= 0) this.globalListeners.splice(i, 1)
    }
  }

  /** Remove a document's tracker (on close). */
  remove(path: string): void {
    this.trackers.delete(path)
  }

  /** Get all open document paths. */
  paths(): string[] {
    return [...this.trackers.keys()]
  }
}
