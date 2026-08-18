/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Ultimate Native IDE. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

/**
 * Ultimate Native IDE — preload bridge.
 *
 * Receives the Agent Host MessagePort from electron-main (via IPC) and
 * exposes it on the renderer's globalThis as `__ultimateNativeAgentHostPort`.
 *
 * The workbench's AgentHostIntegration contribution (see agentHostIntegration.ts)
 * reads this global during startup and creates an IdeBridge from it.
 *
 * @module vs/platform/ultimateNative/sandbox/preload
 */

import { ipcRenderer } from 'electron';

// Listen for the Agent Host port from electron-main.
ipcRenderer.on('ultimate-native:agent-host-port', (_event, port: MessagePort) => {
	(globalThis as any).__ultimateNativeAgentHostPort = port;
	console.log('[ultimate-native] Agent Host port received in preload');
});

export {};
