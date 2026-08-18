/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Ultimate Native IDE. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

/**
 * Ultimate Native IDE — Agent Host integration for the VS Code workbench.
 *
 * This contribution is the CENTRAL WIRING point: during Workbench Restored
 * phase, it:
 *  1. Receives the Agent Host MessagePort from electron-main (via preload).
 *  2. Creates an AgentViewService (state machine for the agent panel).
 *  3. Creates an EditorAsToolHandler (receives agent UI commands).
 *  4. Wires the AgentHostEvent stream → AgentViewService.processEvent +
 *     EditorAsToolHandler.dispatch.
 *  5. Exposes the services for other workbench components to consume.
 *
 * @module vs/workbench/contrib/ultimateNative/agentHostIntegration
 */

import { IWorkbenchContribution, IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from '../../common/contributions.js';
import { IInstantiationService } from '../../../platform/instantiation/common/instantiation.js';
import { IEditorService } from '../../services/editor/common/editorService.js';
import { LifecyclePhase } from '../../services/lifecycle/common/lifecycle.js';
import { Registry } from '../../../platform/registry/common/platform.js';
import { AgentViewService } from './agentViewBinding.js';
import { EditorAsToolHandler } from './editorAsToolHandler.js';

/**
 * The Agent Host integration contribution — the central wiring point.
 *
 * On Restored phase, it bootstraps all ultimate-native services and connects
 * them to the Agent Host event stream.
 */
class AgentHostIntegration implements IWorkbenchContribution {

	private _viewService: AgentViewService | undefined;
	private _editorHandler: EditorAsToolHandler | undefined;

	constructor(
		@IInstantiationService instantiationService: IInstantiationService,
		@IEditorService editorService: IEditorService,
	) {
		// Create the services immediately (they're lightweight).
		this._viewService = new AgentViewService();
		this._editorHandler = new EditorAsToolHandler(editorService);

		// Bootstrap the Agent Host connection.
		this.initAgentHost();
	}

	private async initAgentHost(): Promise<void> {
		const port = (globalThis as any).__ultimateNativeAgentHostPort;

		if (port) {
			await this.connectViaMessagePort(port);
		} else {
			console.log('[ultimate-native] Agent Host integration present (not connected — no MessagePort)');
		}
	}

	private async connectViaMessagePort(port: unknown): Promise<void> {
		try {
			// In production, this creates an IdeBridge from the MessagePort
			// and subscribes to the AgentHostEvent stream.
			//
			// The bridge's onEvent handler feeds events into:
			//   - AgentViewService.processEvent (for UI state updates)
			//   - EditorAsToolHandler.dispatch (for editor/layout commands)
			//
			// For now, set up a mock event listener that demonstrates the wiring.
			const messagePort = port as {
				onmessage: ((ev: { data: unknown }) => void) | null;
				postMessage: (msg: unknown) => void;
			};

			messagePort.onmessage = (event: { data: unknown }) => {
				const message = event.data as { kind?: string };

				if (message?.kind === 'session-event' || message?.kind === 'agent-status' ||
				    message?.kind === 'approval-request' || message?.kind === 'error') {
					// Feed into the view state reducer.
					this._viewService?.processEvent(message);
				}

				if (message?.kind === 'editor-open' || message?.kind === 'editor-show-diff' ||
				    message?.kind === 'workbench-layout') {
					// Feed into the editor handler.
					this._editorHandler?.dispatch(message as never);
				}
			};

			// Mark as connected.
			this._viewService?.setConnected(true);
			console.log('[ultimate-native] Agent Host connected — view service + editor handler wired');
		} catch (err) {
			console.error('[ultimate-native] Failed to connect Agent Host:', err);
		}
	}

	/** Get the view service (for UI components to consume). */
	get viewService(): AgentViewService | undefined {
		return this._viewService;
	}

	/** Get the editor handler (for command palette to consume). */
	get editorHandler(): EditorAsToolHandler | undefined {
		return this._editorHandler;
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(AgentHostIntegration, LifecyclePhase.Restored);
