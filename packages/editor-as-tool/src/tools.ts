/**
 * R4: editor-as-tool — the tool definitions that let the agent drive the
 * workbench UI.
 *
 * These are model-facing tools the agent calls to orchestrate the editor:
 *  - editor.open: open a file and optionally reveal a range
 *  - editor.reveal: highlight a range in the active editor
 *  - editor.show_diff: present a diff for human review (before applying)
 *  - workbench.set_layout: switch between edit/task/review modes
 *  - plan.present: present a plan for human approval before executing
 *
 * Unlike filesystem tools (which execute in the Agent Host), these tools
 * EMIT events to the renderer — the actual UI manipulation happens in the
 * VS Code workbench. The tool body:
 *  1. Emits an {@link AgentHostEvent} (editor-open, editor-show-diff, etc.)
 *     via the provided emit callback.
 *  2. Returns a confirmation to the model ("opened foo.ts at line 42").
 *
 * The renderer subscribes to these events and performs the actual VS Code
 * API calls (openEditor, revealRange, diffEditor, setLayout).
 *
 * @module @ultimate-ide/editor-as-tool/tools
 */

import type { ContentBlock, ToolDefinition, ToolResult } from '@ultimate-ide/contracts/tools'
import type {
  AgentHostEvent,
  EditorOpenRequest,
  EditorShowDiffRequest,
  WorkbenchLayoutMode,
} from '@ultimate-ide/contracts/rpc'

/** The emit callback that pushes events to the renderer. */
export type EmitFn = (event: AgentHostEvent) => void

/** A text content block helper. */
function textBlock(text: string): ContentBlock {
  return { type: 'text', text }
}

/** A successful tool result. */
function ok(text: string): ToolResult {
  return { content: [textBlock(text)], isError: false }
}

/** A failed tool result. */
function err(text: string): ToolResult {
  return { content: [textBlock(text)], isError: true }
}

/**
 * The editor.open tool: open a file and optionally reveal a line range.
 *
 * The agent calls this when it wants the human to look at a specific file —
 * e.g., after making an edit, or when explaining code.
 */
export function executeEditorOpen(args: { path: string; start_line?: number; end_line?: number }, emit: EmitFn): Promise<ToolResult> {
  const request: EditorOpenRequest = {
    path: args.path,
    startLine: args.start_line,
    endLine: args.end_line,
  }
  emit({ kind: 'editor-open', ...request })
  const range = args.start_line ? ` lines ${args.start_line}${args.end_line ? `-${args.end_line}` : ''}` : ''
  return Promise.resolve(ok(`Opened ${args.path}${range}`))
}

/**
 * The editor.show_diff tool: present a diff for human review.
 *
 * The agent calls this BEFORE applying a change it wants the human to approve
 * — the renderer shows a diff view, and the human can accept or reject.
 */
export function executeEditorShowDiff(args: { path: string; before: string; after: string; label?: string }, emit: EmitFn): Promise<ToolResult> {
  const request: EditorShowDiffRequest = {
    path: args.path,
    before: args.before,
    after: args.after,
    label: args.label,
  }
  emit({ kind: 'editor-show-diff', ...request })
  return Promise.resolve(ok(`Presented diff for ${args.path} (awaiting human review)`))
}

/**
 * The workbench.set_layout tool: switch the workbench layout mode.
 *
 * - 'edit': editor-focused, agent panel collapsed (default for coding)
 * - 'task': agent panel full-screen, editor as preview (for multi-step execution)
 * - 'review': diff + timeline side-by-side (for plan review or replay)
 */
export function executeSetLayout(args: { mode: 'edit' | 'task' | 'review' }, emit: EmitFn): Promise<ToolResult> {
  const mode = args.mode as WorkbenchLayoutMode
  emit({ kind: 'workbench-layout', mode })
  return Promise.resolve(ok(`Workbench layout set to '${mode}'`))
}

/**
 * The plan.present tool: present a plan for human approval.
 *
 * The agent calls this when it has a multi-step plan and wants the human to
 * approve before executing. The renderer shows the plan in a blocking approval
 * UI; the human can approve, modify, or reject.
 *
 * NOTE: This tool does NOT auto-approve. The model should call it and then
 * wait for the human's response (delivered via a subsequent user message).
 */
export function executePresentPlan(args: { plan: string; steps?: string[] }, emit: EmitFn): Promise<ToolResult> {
  // The plan is presented as an approval-request event; the renderer shows
  // it in a blocking UI and the human's response comes back as a user message.
  emit({
    kind: 'approval-request',
    id: `plan-${Date.now()}`,
    sessionId: '', // filled by the caller
    description: args.plan,
  } as never)
  const stepCount = args.steps?.length ?? 0
  return Promise.resolve(ok(`Plan presented for approval${stepCount ? ` (${stepCount} steps)` : ''}. Awaiting human response.`))
}

/**
 * The full editor-as-tool schema set, for registration in the tool registry.
 * These schemas are model-facing: name, description, and parameters.
 */
export const EDITOR_AS_TOOL_SCHEMAS: readonly ToolDefinition[] = [
  {
    name: 'editor_open',
    description:
      'Open a file in the editor and optionally reveal a line range. Use this when you want the human to look at specific code — e.g., after making an edit, or when explaining a function.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'The file path to open.' },
        start_line: { type: 'number', description: 'The first line to reveal (1-based).' },
        end_line: { type: 'number', description: 'The last line to reveal (1-based).' },
      },
      required: ['path'],
    },
  },
  {
    name: 'editor_show_diff',
    description:
      'Present a diff for human review. Call this BEFORE applying a change you want the human to approve. The renderer shows a diff view; the human can accept or reject.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'The file path the diff applies to.' },
        before: { type: 'string', description: 'The original content.' },
        after: { type: 'string', description: 'The proposed content.' },
        label: { type: 'string', description: 'Optional label for the diff view.' },
      },
      required: ['path', 'before', 'after'],
    },
  },
  {
    name: 'workbench_set_layout',
    description:
      "Switch the workbench layout mode. 'edit' = editor-focused (default); 'task' = agent full-screen with editor as preview; 'review' = diff + timeline side-by-side.",
    parameters: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['edit', 'task', 'review'], description: 'The layout mode.' },
      },
      required: ['mode'],
    },
  },
]
