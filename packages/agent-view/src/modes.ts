/**
 * R5: agent view modes — the multi-mode interaction surface.
 *
 * Unlike VS Code's fixed chat sidebar, the native agent view can reshape
 * itself to the task at hand:
 *  - 'command-bar': collapsed to a compact input (default during coding)
 *  - 'inline': embedded next to selected code (for localized questions)
 *  - 'panel': full-height side panel (traditional chat, but agent-driven)
 *  - 'task': full-screen takeover (agent is doing multi-step execution)
 *  - 'review': diff + timeline side-by-side (plan approval or replay)
 *
 * The agent itself can trigger mode changes via the `workbench_set_layout`
 * tool (R4). The human can switch modes manually via the activity bar.
 *
 * @module @ultimate-ide/agent-view/modes
 */

/** The interaction mode of the agent view. */
export type AgentViewMode = 'command-bar' | 'inline' | 'panel' | 'task' | 'review'

/** Metadata for one mode (for the activity bar / mode switcher). */
export interface AgentViewModeMeta {
  readonly id: AgentViewMode
  readonly label: string
  readonly icon: string
  readonly description: string
}

/** All available modes, in activity-bar order. */
export const AGENT_VIEW_MODES: readonly AgentViewModeMeta[] = [
  {
    id: 'command-bar',
    label: 'Command',
    icon: 'chevron-right',
    description: 'Compact input bar for quick instructions while coding.',
  },
  {
    id: 'panel',
    label: 'Panel',
    icon: 'comment-discussion',
    description: 'Full-height side panel for conversational agent interaction.',
  },
  {
    id: 'task',
    label: 'Task',
    icon: 'rocket',
    description: 'Full-screen mode for multi-step agent execution.',
  },
  {
    id: 'review',
    label: 'Review',
    icon: 'diff',
    description: 'Diff + timeline for plan approval and session replay.',
  },
  {
    id: 'inline',
    label: 'Inline',
    icon: 'zap',
    description: 'Embedded next to selected code for localized questions.',
  },
]

/** Get a mode's metadata by id. */
export function getModeMeta(id: AgentViewMode): AgentViewModeMeta | undefined {
  return AGENT_VIEW_MODES.find((m) => m.id === id)
}

/** Whether a mode takes over the main editor area (vs. sidebar). */
export function isMainAreaMode(mode: AgentViewMode): boolean {
  return mode === 'task' || mode === 'review'
}
