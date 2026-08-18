/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Ultimate Native IDE. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

/**
 * Ultimate Native IDE — electron-main Agent Host spawner.
 *
 * This is the INVASIVE integration point in electron-main (R0.4): it spawns
 * the DSH Agent Host as a UtilityProcess and creates a MessageChannelMain to
 * connect it to the renderer.
 *
 * Called from the VS Code app lifecycle, after `app.whenReady()` and before
 * the first window is created. The renderer-side port is passed to the
 * BrowserWindow via preload.
 *
 * @module vs/platform/ultimateNative/electron-main/agentHostSpawner
 */

import { Disposable } from 'vs/base/common/lifecycle';
import { utilityProcess } from 'vs/code/electron-main/utilityProcess';
import { MessageChannelMain } from 'vs/base/parts/sandbox/electron-main/electronBase';

/**
 * The Agent Host connection — carries the renderer-side MessagePort.
 */
export interface IAgentHostConnection {
	/** The port the renderer receives to talk to the Agent Host. */
	readonly rendererPort: MessagePortMain;
	/** Dispose: kill the Agent Host process. */
	dispose(): void;
}

/**
 * Spawn the Agent Host as a UtilityProcess.
 *
 * @param workspaceRoot - the workspace root to confine execution to.
 * @param dshHome - the DSH home directory.
 * @param agentHostScript - the path to the Agent Host entry script.
 * @returns the connection with the renderer-side MessagePort.
 */
export async function spawnAgentHost(
	workspaceRoot: string,
	dshHome: string,
	agentHostScript: string,
): Promise<IAgentHostConnection> {

	// Create a MessageChannel: port1 → Agent Host, port2 → renderer.
	const { port1, port2 } = new MessageChannelMain();

	// Spawn the Agent Host as a UtilityProcess.
	const child = utilityProcess.fork(agentHostScript, [], {
		env: {
			...process.env,
			DSH_HOME: dshHome,
			DSH_WORKSPACE_ROOT: workspaceRoot,
		},
		stdio: 'pipe',
	});

	// Send port1 to the Agent Host process.
	child.postMessage({ type: 'ultimate-native-port', port: port1 }, [port1]);

	// Log stderr for diagnostics.
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
