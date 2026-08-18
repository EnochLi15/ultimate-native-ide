/**
 * R6: AH → EH direction — agent capabilities flow out to extensions.
 *
 * The DSH Agent Host's tools, session log, and plan/goal state are exposed
 * to VS Code extensions so they can:
 *  - Call agent tools (bash, read, grep, etc.) via the LanguageModelTool API
 *  - Query the session log (for timeline/stats extensions)
 *  - Subscribe to agent plan/goal state (for project management extensions)
 *
 * @module @ultimate-ide/extension-bridge/ah-to-eh
 */

import type { ContentBlock, ToolDefinition, ToolResult } from '@ultimate-ide/contracts/tools'
import type { SessionEvent } from '@ultimate-ide/contracts/session'
import type { SessionId } from '@ultimate-ide/contracts/ids'

/** A callable agent tool, exposed to extensions as a LanguageModelTool. */
export interface AgentToolProxy {
  /** The tool's definition (name, description, parameters). */
  readonly definition: ToolDefinition
  /** Invoke the tool (delegates to AH via the bridge). */
  invoke(args: unknown, sessionId: SessionId): Promise<ToolResult>
}

/** A session log query interface for extensions. */
export interface SessionLogProxy {
  /** Query events from a session (optionally from a seq). */
  queryEvents(sessionId: SessionId, fromSeq?: number): Promise<SessionEvent[]>
  /** Subscribe to live session events. */
  subscribe(sessionId: SessionId, handler: (event: SessionEvent) => void): () => void
}

/**
 * The AH→EH bridge — exposes agent capabilities to extensions.
 *
 * In the VS Code fork, this is wired by registering each agent tool as a
 * `vscode.lm.registerTool` on the ExtHost, and exposing the session log
 * via a VS Code service that extensions can inject.
 */
export class AhToEhBridge {
  private readonly tools = new Map<string, AgentToolProxy>()
  private readonly logProxies = new Map<SessionId, SessionLogProxy>()
  private readonly toolChangeListeners: Array<(tools: AgentToolProxy[]) => void> = []

  /** Register an agent tool (exposed to extensions as LanguageModelTool). */
  registerAgentTool(proxy: AgentToolProxy): () => void {
    this.tools.set(proxy.definition.name, proxy)
    this.notifyToolChange()
    return () => {
      this.tools.delete(proxy.definition.name)
      this.notifyToolChange()
    }
  }

  /** Get all registered agent tools. */
  getAgentTools(): AgentToolProxy[] {
    return [...this.tools.values()]
  }

  /** Invoke an agent tool by name (delegates to AH). */
  async invokeAgentTool(name: string, args: unknown, sessionId: SessionId): Promise<ToolResult> {
    const tool = this.tools.get(name)
    if (!tool) {
      return { content: [{ type: 'text', text: `Agent tool "${name}" not found` }], isError: true }
    }
    return tool.invoke(args, sessionId)
  }

  /** Register a session log proxy for a session. */
  registerSessionLog(sessionId: SessionId, proxy: SessionLogProxy): () => void {
    this.logProxies.set(sessionId, proxy)
    return () => { this.logProxies.delete(sessionId) }
  }

  /** Get the session log proxy for a session. */
  getSessionLog(sessionId: SessionId): SessionLogProxy | undefined {
    return this.logProxies.get(sessionId)
  }

  /** Subscribe to tool registry changes (for extension UI updates). */
  onToolsChanged(listener: (tools: AgentToolProxy[]) => void): () => void {
    this.toolChangeListeners.push(listener)
    return () => {
      const i = this.toolChangeListeners.indexOf(listener)
      if (i >= 0) this.toolChangeListeners.splice(i, 1)
    }
  }

  private notifyToolChange(): void {
    const tools = this.getAgentTools()
    for (const listener of this.toolChangeListeners) listener(tools)
  }
}
