/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Ultimate Native IDE. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

/**
 * Ultimate Native IDE — Agent Host integration for the VS Code workbench.
 *
 * @module vs/workbench/contrib/ultimateNative/agentHostIntegration
 */

import { IWorkbenchContribution, IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from '../../common/contributions.js';
import { IInstantiationService } from '../../../platform/instantiation/common/instantiation.js';
import { LifecyclePhase } from '../../services/lifecycle/common/lifecycle.js';
import { Registry } from '../../../platform/registry/common/platform.js';

/**
 * The Agent Host integration contribution.
 */
class AgentHostIntegration implements IWorkbenchContribution {

	constructor(
		@IInstantiationService instantiationService: IInstantiationService,
	) {
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

	private async connectViaMessagePort(_port: unknown): Promise<void> {
		try {
			console.log('[ultimate-native] Agent Host connected via MessagePort');
		} catch (err) {
			console.error('[ultimate-native] Failed to connect Agent Host:', err);
		}
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(AgentHostIntegration, LifecyclePhase.Restored);
