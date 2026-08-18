/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Ultimate Native IDE. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

/**
 * R5: VS Code workbench renderer binding — connects the agent-view state
 * machine to VS Code's workbench UI.
 *
 * @module vs/workbench/contrib/ultimateNative/agentViewBinding
 */

import { DisposableStore } from '../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../base/common/event.js';
import {
  type AgentViewState,
  type AgentViewMode,
  initialAgentViewState,
  reduceAgentView,
  setMode,
  setConnected,
  resolveApproval,
} from './agent-view-state.js';

/**
 * The agent view state service — the bridge between the IdeBridge event stream
 * and the VS Code UI.
 */
export class AgentViewService {
  private _state: AgentViewState = initialAgentViewState;
  private readonly _store = new DisposableStore();

  private readonly _onDidChangeState = this._store.add(new Emitter<AgentViewState>());
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

  dispose(): void {
    this._store.dispose();
  }
}

export {
  type AgentViewState,
  type AgentViewMode,
  initialAgentViewState,
  reduceAgentView,
  setMode,
  setConnected,
  resolveApproval,
} from './agent-view-state.js';
