/**
 * R3: timeline — derives an interleaved timeline of edits, commands, and
 * conversation from the SessionEvent stream.
 *
 * The timeline is the "what happened in this session" view: every turn, step,
 * user message, assistant message, tool call, and tool result in chronological
 * order. It's the primary projection of the session log for human review.
 *
 * @module @ultimate-ide/session-log-spine/timeline
 */

import type { SessionEvent } from '@ultimate-ide/contracts/session'

/** One entry in the timeline — a categorized, human-readable event. */
export interface TimelineEntry {
  /** Monotonic seq from the session log. */
  readonly seq: number
  /** Unix epoch milliseconds. */
  readonly time: number
  /** The category for grouping/filtering. */
  readonly category: 'conversation' | 'tool' | 'boundary' | 'status'
  /** A human-readable label. */
  readonly label: string
  /** The turn number, when available. */
  readonly turn?: number
  /** The step number, when available. */
  readonly step?: number
  /** The raw event type. */
  readonly eventType: string
}

/**
 * Derive a timeline from a session event stream.
 *
 * @param events - the session events (ordered by seq).
 * @returns the timeline entries, one per event.
 */
export function deriveTimeline(events: readonly SessionEvent[]): TimelineEntry[] {
  return events.map(eventToTimelineEntry)
}

/** Convert one session event to a timeline entry. */
function eventToTimelineEntry(event: SessionEvent): TimelineEntry {
  const base = { seq: event.seq, time: event.time, eventType: event.type }
  const data = event.data as Record<string, unknown>

  switch (event.type) {
    case 'turn/start':
      return { ...base, category: 'boundary', label: `Turn ${data.turn} started`, turn: data.turn as number }
    case 'turn/end':
      return { ...base, category: 'boundary', label: `Turn ${data.turn} ended`, turn: data.turn as number }
    case 'step/start':
      return { ...base, category: 'boundary', label: `Step ${data.step} started`, turn: data.turn as number, step: data.step as number }
    case 'step/end':
      return { ...base, category: 'boundary', label: `Step ${data.step} ended`, turn: data.turn as number, step: data.step as number }
    case 'user/message': {
      const content = data.content as Array<{ type: string; text?: string }>
      const text = content?.map((c) => c.text ?? '').join('') ?? ''
      return { ...base, category: 'conversation', label: `User: ${text.slice(0, 60)}` }
    }
    case 'assistant/message': {
      const msg = data.message as { content: Array<{ type: string; text?: string }> }
      const text = msg?.content?.map((c) => c.text ?? '').join('') ?? ''
      return { ...base, category: 'conversation', label: `Assistant: ${text.slice(0, 60)}`, turn: data.turn as number, step: data.step as number }
    }
    case 'tool/call': {
      const tool = data.tool as string
      return { ...base, category: 'tool', label: `Tool call: ${tool}`, turn: data.turn as number, step: data.step as number }
    }
    case 'tool/result': {
      const isError = data.isError as boolean
      return { ...base, category: 'tool', label: isError ? 'Tool result (error)' : 'Tool result', turn: data.turn as number, step: data.step as number }
    }
    case 'agent/status': {
      const status = data.status as string
      return { ...base, category: 'status', label: `Agent ${status}` }
    }
    default:
      return { ...base, category: 'boundary', label: event.type }
  }
}

/** Filter a timeline by category. */
export function filterByCategory(timeline: readonly TimelineEntry[], category: TimelineEntry['category']): TimelineEntry[] {
  return timeline.filter((e) => e.category === category)
}

/** Get a text summary of the timeline (for quick preview). */
export function timelineSummary(timeline: readonly TimelineEntry[]): string {
  const counts = { conversation: 0, tool: 0, boundary: 0, status: 0 }
  for (const e of timeline) counts[e.category]++
  return `${timeline.length} events: ${counts.conversation} conversation, ${counts.tool} tool, ${counts.boundary} boundary, ${counts.status} status`
}
