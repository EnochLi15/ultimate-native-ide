/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Ultimate Native IDE. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

/**
 * R3: Session log spine integration for VS Code.
 *
 * This module provides the VS Code-local copy of the session-log-spine
 * projection logic (timeline, task tree, replay), so the workbench can
 * render derived views from the session event stream without depending
 * on the @ultimate-ide/session-log-spine package.
 *
 * @module vs/workbench/contrib/ultimateNative/sessionLogSpine
 */

/** One entry in the timeline. */
export interface TimelineEntry {
  readonly seq: number;
  readonly time: number;
  readonly category: 'conversation' | 'tool' | 'boundary' | 'status';
  readonly label: string;
  readonly turn?: number;
  readonly step?: number;
  readonly eventType: string;
}

/** A node in the task tree. */
export interface TaskNode {
  readonly id: string;
  readonly kind: 'goal' | 'todo' | 'subagent' | 'turn';
  readonly label: string;
  readonly seq: number;
  readonly children: TaskNode[];
  completed: boolean;
}

/** A session event (minimal shape for projection). */
interface SessionEvent {
  readonly seq: number;
  readonly time: number;
  readonly type: string;
  readonly data: Record<string, unknown>;
}

/** Derive a timeline from session events. */
export function deriveTimeline(events: readonly SessionEvent[]): TimelineEntry[] {
  return events.map((event) => {
    const base = { seq: event.seq, time: event.time, eventType: event.type };
    const data = event.data;

    switch (event.type) {
      case 'turn/start':
        return { ...base, category: 'boundary' as const, label: `Turn ${data.turn} started`, turn: data.turn as number };
      case 'turn/end':
        return { ...base, category: 'boundary' as const, label: `Turn ${data.turn} ended`, turn: data.turn as number };
      case 'step/start':
        return { ...base, category: 'boundary' as const, label: `Step ${data.step} started`, turn: data.turn as number, step: data.step as number };
      case 'step/end':
        return { ...base, category: 'boundary' as const, label: `Step ${data.step} ended`, turn: data.turn as number, step: data.step as number };
      case 'user/message': {
        const content = data.content as Array<{ type: string; text?: string }>;
        const text = content?.map((c) => c.text ?? '').join('') ?? '';
        return { ...base, category: 'conversation' as const, label: `User: ${text.slice(0, 60)}` };
      }
      case 'assistant/message': {
        const msg = data.message as { content: Array<{ type: string; text?: string }> };
        const text = msg?.content?.map((c) => c.text ?? '').join('') ?? '';
        return { ...base, category: 'conversation' as const, label: `Assistant: ${text.slice(0, 60)}`, turn: data.turn as number, step: data.step as number };
      }
      case 'tool/call': {
        return { ...base, category: 'tool' as const, label: `Tool call: ${data.tool}`, turn: data.turn as number, step: data.step as number };
      }
      case 'tool/result': {
        return { ...base, category: 'tool' as const, label: data.isError ? 'Tool result (error)' : 'Tool result', turn: data.turn as number, step: data.step as number };
      }
      case 'agent/status': {
        return { ...base, category: 'status' as const, label: `Agent ${data.status}` };
      }
      default:
        return { ...base, category: 'boundary' as const, label: event.type };
    }
  });
}

/** Derive a task tree from session events. */
export function deriveTaskTree(events: readonly SessionEvent[]): TaskNode {
  const root: TaskNode = { id: 'root', kind: 'turn', label: 'Session', seq: 0, children: [], completed: false };
  let currentTurn: TaskNode | null = null;

  for (const event of events) {
    const data = event.data;
    switch (event.type) {
      case 'turn/start': {
        const turn = data.turn as number;
        const turnNode: TaskNode = { id: `turn-${turn}`, kind: 'turn', label: `Turn ${turn}`, seq: event.seq, children: [], completed: false };
        root.children.push(turnNode);
        currentTurn = turnNode;
        break;
      }
      case 'turn/end': {
        if (currentTurn) currentTurn.completed = true;
        currentTurn = null;
        break;
      }
      case 'tool/call': {
        const tool = data.tool as string;
        const args = data.args as Record<string, unknown> | undefined;
        const parent = currentTurn ?? root;
        if (tool === 'create_goal' || tool === 'update_goal') {
          parent.children.push({ id: `goal-${event.seq}`, kind: 'goal', label: (args?.objective as string) ?? 'Goal', seq: event.seq, children: [], completed: tool === 'update_goal' && (args?.action as string) === 'complete' });
        } else if (tool === 'todo_write') {
          const todos = (args?.todos as Array<{ content: string; status: string }>) ?? [];
          for (const todo of todos) {
            parent.children.push({ id: `todo-${event.seq}-${todo.content.slice(0, 20)}`, kind: 'todo', label: todo.content, seq: event.seq, children: [], completed: todo.status === 'completed' });
          }
        } else if (tool === 'subagent' || tool === 'subagent_fork') {
          parent.children.push({ id: `subagent-${event.seq}`, kind: 'subagent', label: (args?.description as string) ?? `Subagent (${tool})`, seq: event.seq, children: [], completed: false });
        }
        break;
      }
      default:
        break;
    }
  }
  return root;
}

/** Replay cursor for step-through replay. */
export class ReplayCursor {
  private position = 0;
  constructor(private readonly events: readonly SessionEvent[]) {}
  get pos(): number { return this.position; }
  get total(): number { return this.events.length; }
  get canForward(): boolean { return this.position < this.events.length; }
  get canBackward(): boolean { return this.position > 0; }
  forward(): SessionEvent | undefined {
    if (this.position >= this.events.length) return undefined;
    return this.events[this.position++];
  }
  backward(): SessionEvent | undefined {
    if (this.position <= 0) return undefined;
    return this.events[--this.position];
  }
  jumpTo(seq: number): SessionEvent | undefined {
    const idx = this.events.findIndex((e) => e.seq === seq);
    if (idx < 0) return undefined;
    this.position = idx + 1;
    return this.events[idx];
  }
  eventsSoFar(): SessionEvent[] { return this.events.slice(0, this.position); }
  reset(): void { this.position = 0; }
  toEnd(): void { this.position = this.events.length; }
}

/** Find the fork point (last turn/end before a seq). */
export function findForkPoint(events: readonly SessionEvent[], fromSeq: number): number {
  let lastTurnEnd = 0;
  for (const event of events) {
    if (event.seq > fromSeq) break;
    if (event.type === 'turn/end') lastTurnEnd = event.seq;
  }
  return lastTurnEnd;
}

/** Extract the seed events for a fork. */
export function forkSeed(events: readonly SessionEvent[], fromSeq: number): SessionEvent[] {
  const forkPoint = findForkPoint(events, fromSeq);
  if (forkPoint === 0) return [];
  return events.filter((e) => e.seq <= forkPoint);
}
