/**
 * @ultimate-ide/ide-bridge-renderer — the renderer-side deep-contract client.
 *
 * Exports {@link IdeBridge}: the renderer's single door to the DSH agent
 * kernel. Construct with a MessagePort, call `connect(workspaceRoot)`, then
 * use `bridge.api` for typed calls and `bridge.onEvent(...)` for the event
 * stream.
 *
 * @module @ultimate-ide/ide-bridge-renderer
 */

export { IdeBridge } from './client.ts'
export type { WirePort } from './client.ts'
