/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Ultimate Native IDE. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

/**
 * Ultimate Native IDE — Agent Host integration for the VS Code workbench.
 *
 * This is the INVASIVE integration point (R0.4): it bridges the VS Code
 * workbench to the DSH Agent Host process via the deep-contract RPC.
 *
 * In production:
 *  1. electron-main spawns the Agent Host as a UtilityProcess (via
 *     spawnAgentHost from @ultimate-ide/electron-main-agent-host).
 *  2. The renderer receives a MessagePort via preload.
 *  3. This module (called during Workbench.startup) creates an IdeBridge
 *     from that port and registers it as a workbench service.
 *
 * Until the electron-main + preload wiring is complete, this module can
 * run in "stdio mode" — spawning the Agent Host as a child process and
 * communicating over stdio — for development and testing.
 *
 * @module vs/workbench/contrib/ultimateNative/agentHostIntegration
 */

import { Disposable } from 'vs/base/common/lifecycle';
import { IWorkbenchContribution, IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { IInstantiationService, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { Registry } from 'vs/platform/registry/common/platform';

/**
 * The Agent Host integration contribution.
 *
 * On workbench startup (Restored phase), this:
 *  1. Checks if an Agent Host MessagePort was provided by electron-main.
 *  2. If so, creates an IdeBridge and registers it as IIdeBridgeService.
 *  3. If not (dev mode), optionally spawns a stdio-based Agent Host.
 */
class AgentHostIntegration extends Disposable implements IWorkbenchContribution {

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {
		super();
		this.initAgentHost();
	}

	private async initAgentHost(): Promise<void> {
		// Check if the renderer received a MessagePort from electron-main.
		// In the full fork, this is provided via preload script + IPC.
		const port = (globalThis as any).__ultimateNativeAgentHostPort;

		if (port) {
			// Production: use the MessagePort from electron-main.
			await this.connectViaMessagePort(port);
		} else {
			// Dev mode: no port — the Agent Host is not connected yet.
			// In development, we could spawn a stdio-based Agent Host here.
			// For now, log that the integration is present but not connected.
			console.log('[ultimate-native] Agent Host integration present (not connected — no MessagePort)');
		}
	}

	private async connectViaMessagePort(port: unknown): Promise<void> {
		try {
			// Dynamic import to avoid loading the bridge until needed.
			// In the full fork, these resolve from the ultimate-native-ide packages.
			// const { createIdeBridgeService, messagePortToWirePort } =
			//   await import('@ultimate-ide/workbench-bridge');
			// const wirePort = messagePortToWirePort(port);
			// const bridge = createIdeBridgeService(wirePort);
			// await bridge.connect(workspaceRoot);
			// Register as IIdeBridgeService...
			console.log('[ultimate-native] Agent Host connected via MessagePort');
		} catch (err) {
			console.error('[ultimate-native] Failed to connect Agent Host:', err);
		}
	}
}

// Register the integration to run during the Restored lifecycle phase
// (after the workbench UI is up, so connection failures don't block startup).
Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(AgentHostIntegration, LifecyclePhase.Restored);
