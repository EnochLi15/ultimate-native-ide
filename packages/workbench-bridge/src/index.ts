/**
 * @ultimate-ide/workbench-bridge — the renderer-side workbench integration.
 *
 * Receives the MessagePort from electron-main, creates an IdeBridge, and
 * exposes it as a workbench service so all VS Code components can reach the
 * DSH agent kernel.
 *
 * @module @ultimate-ide/workbench-bridge
 */

export { createIdeBridgeService, messagePortToWirePort } from './service.ts'
export type { IIdeBridgeService } from './service.ts'
