/**
 * R6: EH → AH direction — extension contributions flow into the agent.
 *
 * VS Code extensions register capabilities on the Extension Host (EH):
 *  - `vscode.lm.registerLanguageModelChatProvider` → models
 *  - `vscode.lm.registerTool` → tools
 *  - `vscode.chat.createChatParticipant` → chat participants (personas)
 *  - LSP contributions → language intelligence
 *  - `vscode.commands.registerCommand` → commands
 *
 * This module defines the bridge that forwards these registrations to the
 * Agent Host (AH), so the agent can use extension-provided models, tools,
 * and language intelligence.
 *
 * @module @ultimate-ide/extension-bridge/eh-to-ah
 */

import type { ContentBlock, ToolDefinition, ToolResult } from '@ultimate-ide/contracts/tools'

/** One model provider registered by an extension. */
export interface ExtensionModelProvider {
  /** The vendor id (e.g. 'openai', 'anthropic'). */
  readonly vendor: string
  /** Human-readable label. */
  readonly label: string
  /** Send a model request and return the response (streamed or complete). */
  sendRequest(messages: Array<{ role: string; content: ContentBlock[] }>, options: {
    model?: string
    temperature?: number
    maxTokens?: number
  }): Promise<{ content: ContentBlock[]; usage?: { inputTokens?: number; outputTokens?: number } }>
}

/** One tool registered by an extension. */
export interface ExtensionTool {
  readonly name: string
  readonly description: string
  readonly parameters: object
  execute(args: unknown): Promise<unknown>
}

/** One chat participant (persona) registered by an extension. */
export interface ExtensionChatParticipant {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly persona: string
}

/**
 * The EH→AH bridge — collects extension registrations and forwards them
 * to the Agent Host.
 *
 * In the VS Code fork, this is wired by intercepting the ExtHost API:
 * when an extension calls `registerLanguageModelChatProvider`, the
 * registration is also forwarded here. The bridge then calls
 * `bridge.api.*` to register them on the AH side.
 */
export class EhToAhBridge {
  private readonly models = new Map<string, ExtensionModelProvider>()
  private readonly tools = new Map<string, ExtensionTool>()
  private readonly participants = new Map<string, ExtensionChatParticipant>()

  /** Register an extension model provider (forwarded to ctx.llm on AH). */
  registerModelProvider(provider: ExtensionModelProvider): () => void {
    this.models.set(provider.vendor, provider)
    // TODO: call bridge.api to register on AH (requires AH-side model registration API)
    return () => { this.models.delete(provider.vendor) }
  }

  /** Register an extension tool (forwarded to ctx.tools on AH). */
  registerTool(tool: ExtensionTool): () => void {
    this.tools.set(tool.name, tool)
    // TODO: call bridge.api to register on AH
    return () => { this.tools.delete(tool.name) }
  }

  /** Register an extension chat participant (forwarded as agent persona). */
  registerChatParticipant(participant: ExtensionChatParticipant): () => void {
    this.participants.set(participant.id, participant)
    return () => { this.participants.delete(participant.id) }
  }

  /** Get all registered model providers. */
  getModelProviders(): ExtensionModelProvider[] {
    return [...this.models.values()]
  }

  /** Get all registered tools (as ToolDefinition for AH). */
  getToolDefinitions(): ToolDefinition[] {
    return [...this.tools.values()].map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }))
  }

  /** Get all registered chat participants. */
  getChatParticipants(): ExtensionChatParticipant[] {
    return [...this.participants.values()]
  }

  /** Execute an extension tool by name (used when AH delegates a tool call back to EH). */
  async executeTool(name: string, args: unknown): Promise<ToolResult> {
    const tool = this.tools.get(name)
    if (!tool) {
      return { content: [{ type: 'text', text: `Tool "${name}" not found` }], isError: true }
    }
    try {
      const result = await tool.execute(args)
      // The result is unknown; wrap it as a text content block.
      const text = typeof result === 'string' ? result : JSON.stringify(result)
      return { content: [{ type: 'text', text }], isError: false }
    } catch (err) {
      return {
        content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
        isError: true,
      }
    }
  }
}
