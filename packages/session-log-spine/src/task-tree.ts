/**
 * R3: task tree — derives a hierarchical task tree (goal/plan/todo/subagent)
 * from the SessionEvent stream.
 *
 * The task tree is the "what is the agent working on" view: goals, plans,
 * todos, and subagent delegations organized hierarchically. It's the
 * projection that shows the agent's intent structure, not just its actions.
 *
 * @module @ultimate-ide/session-log-spine/task-tree
 */

import type { SessionEvent } from '@ultimate-ide/contracts/session'

/** A node in the task tree. */
export interface TaskNode {
  /** A stable id for this node. */
  readonly id: string
  /** The node type. */
  readonly kind: 'goal' | 'todo' | 'subagent' | 'turn'
  /** A human-readable label. */
  readonly label: string
  /** The seq when this node was created. */
  readonly seq: number
  /** Child nodes. */
  readonly children: TaskNode[]
  /** Whether this task is completed. */
  completed: boolean
}

/**
 * Derive a task tree from session events.
 *
 * The tree is structured as:
 *  - Turn boundaries become 'turn' nodes
 *  - Tool calls for `create_goal`/`update_goal` become 'goal' nodes
 *  - Tool calls for `todo_write` become 'todo' nodes
 *  - Tool calls for `subagent`/`subagent_fork` become 'subagent' nodes
 *
 * @param events - the session events.
 * @returns the root task tree (a virtual root with turn children).
 */
export function deriveTaskTree(events: readonly SessionEvent[]): TaskNode {
  const root: TaskNode = {
    id: 'root',
    kind: 'turn',
    label: 'Session',
    seq: 0,
    children: [],
    completed: false,
  }

  let currentTurn: TaskNode | null = null

  for (const event of events) {
    const data = event.data as Record<string, unknown>

    switch (event.type) {
      case 'turn/start': {
        const turn = data.turn as number
        const turnNode: TaskNode = {
          id: `turn-${turn}`,
          kind: 'turn',
          label: `Turn ${turn}`,
          seq: event.seq,
          children: [],
          completed: false,
        }
        root.children.push(turnNode)
        currentTurn = turnNode
        break
      }
      case 'turn/end': {
        if (currentTurn) currentTurn.completed = true
        currentTurn = null
        break
      }
      case 'tool/call': {
        const tool = data.tool as string
        const args = data.args as Record<string, unknown> | undefined
        const parent = currentTurn ?? root

        if (tool === 'create_goal' || tool === 'update_goal') {
          parent.children.push({
            id: `goal-${event.seq}`,
            kind: 'goal',
            label: (args?.objective as string) ?? 'Goal',
            seq: event.seq,
            children: [],
            completed: tool === 'update_goal' && (args?.action as string) === 'complete',
          })
        } else if (tool === 'todo_write') {
          const todos = (args?.todos as Array<{ content: string; status: string }>) ?? []
          for (const todo of todos) {
            parent.children.push({
              id: `todo-${event.seq}-${todo.content.slice(0, 20)}`,
              kind: 'todo',
              label: todo.content,
              seq: event.seq,
              children: [],
              completed: todo.status === 'completed',
            })
          }
        } else if (tool === 'subagent' || tool === 'subagent_fork') {
          parent.children.push({
            id: `subagent-${event.seq}`,
            kind: 'subagent',
            label: (args?.description as string) ?? `Subagent (${tool})`,
            seq: event.seq,
            children: [],
            completed: false,
          })
        }
        break
      }
      default:
        // Other events don't affect the task tree.
        break
    }
  }

  return root
}

/** Count nodes by kind in a task tree. */
export function countNodes(root: TaskNode): Record<TaskNode['kind'], number> {
  const counts: Record<TaskNode['kind'], number> = { goal: 0, todo: 0, subagent: 0, turn: 0 }
  function walk(node: TaskNode): void {
    counts[node.kind]++
    for (const child of node.children) walk(child)
  }
  walk(root)
  return counts
}
