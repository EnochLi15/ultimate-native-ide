/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Ultimate Native IDE. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

/**
 * R5: VS Code workbench renderer binding — connects the agent-view state
 * machine to VS Code's workbench UI.
 *
 * This module:
 *  1. Subscribes to AgentHostEvent stream from the IdeBridge service.
 *  2. Feeds events into the reduceAgentView reducer.
 *  3. Exposes the reactive state for VS Code UI components to consume.
 *  4. Provides commands for mode switching, prompt submission, approval response.
 *
 * Applied in the VS Code fork's workbench layer (not a contrib — a service
 * registered during startup, consumed by the agent panel UI).
 *
 * @module vs/workbench/contrib/ultimateNative/agentViewBinding
 */

import { Disposable, IDisposable } from 'vs/base/common/lifecycle';
import { Emitter, Event } from 'vs/base/common/event';
import {
  type AgentViewState,
  type AgentViewMode,
  initialAgentViewState,
  reduceAgentView,
  setMode,
  setConnected,
  resolveApproval,
} from './agent-view-state';

/**
 * The agent view state service — the bridge between the IdeBridge event stream
 * and the VS Code UI.
 *
 * In the VS Code fork, this is registered as IIdeAgentViewService during
 * Workbench.startup, right after the IdeBridge is connected.
 */
export class AgentViewService extends Disposable {
  private _state: AgentViewState = initialAgentViewState;

  private readonly _onDidChangeState = this._register(new Emitter<AgentViewState>());
  readonly onDidChangeState: Event<AgentViewState> = this._onDidChangeState.event;

  /** Get the current state. */
  get state(): AgentViewState {
    return this._state;
  }

  /** Process an event from the Agent Host (called by IdeBridge.onEvent). */
  processEvent(event: unknown): void {
    this._state = reduceAgentView(this._state, event as never);
    this._onDidChangeState.fire(this._state);
  }

  /** Mark the bridge as connected. */
  setConnected(connected: boolean): void {
    this._state = setConnected(this._state, connected);
    this._onDidChangeState.fire(this._state);
  }

  /** Switch the interaction mode. */
  setMode(mode: AgentViewMode): void {
    this._state = setMode(this._state, mode);
    this._onDidChangeState.fire(this._state);
  }

  /** Resolve a pending approval. */
  resolveApproval(approvalId: string): void {
    this._state = resolveApproval(this._state, approvalId);
    this._onDidChangeState.fire(this._state);
  }

  /** Get pending approvals (for the blocking UI). */
  get pendingApprovals(): readonly unknown[] {
    return this._state.pendingApprovals;
  }

  /** Whether the agent is running. */
  get isRunning(): boolean {
    return this._state.agentStatus === 'running';
  }
}

/**
 * The agent-view-state module re-export (so VS Code can import the pure logic
 * without the @ultimate-ide package resolution).
 *
 * In the full fork, these are either bundled or the @ultimate-ide/agent-view
 * package is linked into VS Code's node_modules.
 */
export {
  type AgentViewState,
  type AgentViewMode,
  initialAgentViewState,
  reduceAgentView,
  setMode,
  setConnected,
  resolveApproval,
} from './agent-view-state';
