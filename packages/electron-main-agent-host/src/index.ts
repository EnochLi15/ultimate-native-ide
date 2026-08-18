/**
 * @ultimate-ide/electron-main-agent-host — electron-main integration that
 * spawns the Agent Host as a UtilityProcess and connects it to the renderer.
 *
 * @module @ultimate-ide/electron-main-agent-host
 */

export { spawnAgentHost } from './spawner.ts'
export type { AgentHostConnection, SpawnOptions, UtilityProcessLike, ForkOptions } from './spawner.ts'
