/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Ultimate Native IDE. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

/**
 * Ultimate Native IDE — electron-main Agent Host spawner.
 *
 * @module vs/platform/ultimateNative/electron-main/agentHostSpawner
 */

import { MessageChannelMain, utilityProcess } from 'electron';

/**
 * The Agent Host connection — carries the renderer-side MessagePort.
 */
export interface IAgentHostConnection {
	/** The port the renderer receives to talk to the Agent Host. */
	readonly rendererPort: MessageChannelMain['port1'];
	/** Dispose: kill the Agent Host process. */
	dispose(): void;
}

/**
 * Spawn the Agent Host as a UtilityProcess.
 */
export async function spawnAgentHost(
	workspaceRoot: string,
	dshHome: string,
	agentHostScript: string,
): Promise<IAgentHostConnection> {

	const { port1, port2 } = new MessageChannelMain();

	const child = utilityProcess.fork(agentHostScript, [], {
		env: {
			...process.env,
			DSH_HOME: dshHome,
			DSH_WORKSPACE_ROOT: workspaceRoot,
		},
		stdio: 'pipe',
	});

	// Send port1 to the Agent Host process as a transferable.
	// The port must be in the transfer list, NOT in the message body.
	child.postMessage({ type: 'ultimate-native-port' }, [port1]);

	child.stderr?.on('data', (chunk: Buffer) => {
		console.error(`[agent-host] ${chunk.toString().trim()}`);
	});

	return {
		rendererPort: port2,
		dispose() {
			child.kill();
		},
	};
}
