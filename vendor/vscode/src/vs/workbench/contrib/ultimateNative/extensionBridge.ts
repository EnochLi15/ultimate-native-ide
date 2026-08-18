/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Ultimate Native IDE. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

/**
 * R6: Extension Host ↔ Agent Host bridge for VS Code.
 *
 * This module defines the VS Code-local types for the bidirectional
 * capability bridge between VS Code's Extension Host (EH) and the DSH
 * Agent Host (AH).
 *
 * EH → AH: extension-registered models, tools, and chat participants
 *          flow into the agent kernel.
 * AH → EH: agent tools and session log are exposed to extensions via
 *          the LanguageModelTool API and a queryable service.
 *
 * @module vs/workbench/contrib/ultimateNative/extensionBridge
 */

import { IDisposable } from '../../../base/common/lifecycle.js';

/** One model provider registered by an extension (forwarded to AH ctx.llm). */
export interface ExtensionModelProvider {
  readonly vendor: string;
  readonly label: string;
  sendRequest(messages: Array<{ role: string; content: unknown[] }>, options: {
    model?: string;
    maxTokens?: number;
  }): Promise<{ content: unknown[]; usage?: { inputTokens?: number; outputTokens?: number } }>;
}

/** One tool registered by an extension (forwarded to AH ctx.tools). */
export interface ExtensionTool {
  readonly name: string;
  readonly description: string;
  readonly parameters: object;
  execute(args: unknown): Promise<unknown>;
}

/** One chat participant (persona) registered by an extension. */
export interface ExtensionChatParticipant {
  readonly id: string;
  readonly name: string;
  readonly persona: string;
}

/** The EH→AH bridge — collects extension registrations. */
export class EhToAhBridge {
  private readonly _models = new Map<string, ExtensionModelProvider>();
  private readonly _tools = new Map<string, ExtensionTool>();
  private readonly _participants = new Map<string, ExtensionChatParticipant>();

  registerModelProvider(provider: ExtensionModelProvider): IDisposable {
    this._models.set(provider.vendor, provider);
    return { dispose: () => { this._models.delete(provider.vendor); } };
  }

  registerTool(tool: ExtensionTool): IDisposable {
    this._tools.set(tool.name, tool);
    return { dispose: () => { this._tools.delete(tool.name); } };
  }

  registerChatParticipant(participant: ExtensionChatParticipant): IDisposable {
    this._participants.set(participant.id, participant);
    return { dispose: () => { this._participants.delete(participant.id); } };
  }

  getModelProviders(): ExtensionModelProvider[] {
    return [...this._models.values()];
  }

  getToolDefinitions(): Array<{ name: string; description: string; parameters: object }> {
    return [...this._tools.values()].map((t) => ({
      name: t.name, description: t.description, parameters: t.parameters,
    }));
  }

  getChatParticipants(): ExtensionChatParticipant[] {
    return [...this._participants.values()];
  }

  async executeTool(name: string, args: unknown): Promise<{ content: unknown[]; isError: boolean }> {
    const tool = this._tools.get(name);
    if (!tool) return { content: [{ type: 'text', text: `Tool "${name}" not found` }], isError: true };
    try {
      const result = await tool.execute(args);
      return { content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result) }], isError: false };
    } catch (err) {
      return { content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }], isError: true };
    }
  }
}

/** The AH→EH bridge — exposes agent capabilities to extensions. */
export class AhToEhBridge {
  private readonly _tools = new Map<string, { name: string; description: string; invoke: (args: unknown) => Promise<unknown> }>();
  private readonly _listeners: Array<() => void> = [];

  registerAgentTool(tool: { name: string; description: string; invoke: (args: unknown) => Promise<unknown> }): IDisposable {
    this._tools.set(tool.name, tool);
    this._notify();
    return { dispose: () => { this._tools.delete(tool.name); this._notify(); } };
  }

  getAgentTools(): Array<{ name: string; description: string }> {
    return [...this._tools.values()].map((t) => ({ name: t.name, description: t.description }));
  }

  async invokeAgentTool(name: string, args: unknown): Promise<unknown> {
    const tool = this._tools.get(name);
    if (!tool) throw new Error(`Agent tool "${name}" not found`);
    return tool.invoke(args);
  }

  onToolsChanged(listener: () => void): IDisposable {
    this._listeners.push(listener);
    return { dispose: () => { const i = this._listeners.indexOf(listener); if (i >= 0) this._listeners.splice(i, 1); } };
  }

  private _notify(): void {
    for (const l of this._listeners) l();
  }
}
