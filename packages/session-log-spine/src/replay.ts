/**
 * R3: replay — step-through replay of the session log.
 *
 * The replay view lets a human step through the agent's work event by event,
 * seeing each turn, step, tool call, and result as it happened. This is the
 * "how did the agent do it" view — essential for trust and debugging.
 *
 * @module @ultimate-ide/session-log-spine/replay
 */

import type { SessionEvent } from '@ultimate-ide/contracts/session'

/** A replay cursor — tracks position in the event stream. */
export class ReplayCursor {
  private readonly events: readonly SessionEvent[]
  private position = 0

  constructor(events: readonly SessionEvent[]) {
    this.events = events
  }

  /** The current position (0 = before any event). */
  get pos(): number {
    return this.position
  }

  /** Total events. */
  get total(): number {
    return this.events.length
  }

  /** Whether there are more events to step forward. */
  get canForward(): boolean {
    return this.position < this.events.length
  }

  /** Whether we can step backward. */
  get canBackward(): boolean {
    return this.position > 0
  }

  /** Step forward one event. Returns the event, or undefined at the end. */
  forward(): SessionEvent | undefined {
    if (this.position >= this.events.length) return undefined
    const event = this.events[this.position]
    this.position++
    return event
  }

  /** Step backward one event. Returns the event at the new position. */
  backward(): SessionEvent | undefined {
    if (this.position <= 0) return undefined
    this.position--
    return this.events[this.position]
  }

  /** Jump to a specific seq. */
  jumpTo(seq: number): SessionEvent | undefined {
    const index = this.events.findIndex((e) => e.seq === seq)
    if (index < 0) return undefined
    this.position = index + 1
    return this.events[index]
  }

  /** Get all events up to the current position (the "state so far"). */
  eventsSoFar(): SessionEvent[] {
    return this.events.slice(0, this.position)
  }

  /** Reset to the beginning. */
  reset(): void {
    this.position = 0
  }

  /** Go to the end. */
  toEnd(): void {
    this.position = this.events.length
  }
}

/**
 * Find the fork point: the last completed turn before a given seq.
 * Used by R3.4 (fork/resume) to determine where to branch.
 *
 * @param events - the session events.
 * @param fromSeq - the seq to fork from.
 * @returns the seq of the last turn/end before fromSeq, or 0 if none.
 */
export function findForkPoint(events: readonly SessionEvent[], fromSeq: number): number {
  let lastTurnEnd = 0
  for (const event of events) {
    if (event.seq > fromSeq) break
    if (event.type === 'turn/end') {
      lastTurnEnd = event.seq
    }
  }
  return lastTurnEnd
}

/**
 * Extract the seed events for a fork: all events up to and including the
 * fork point. These become the new session's initial history.
 *
 * @param events - the original session events.
 * @param fromSeq - the seq to fork from.
 * @returns the seed events (up to the fork point).
 */
export function forkSeed(events: readonly SessionEvent[], fromSeq: number): SessionEvent[] {
  const forkPoint = findForkPoint(events, fromSeq)
  if (forkPoint === 0) return []
  return events.filter((e) => e.seq <= forkPoint)
}
