/**
 * @ultimate-ide/cloud-execution — R7: cloud execution world (architectural moat).
 *
 * @module @ultimate-ide/cloud-execution
 */

export * from './types.ts'
export { ExecutionWorldSwitcher, requiresCloudCredentials, worldPatchYaml } from './switcher.ts'
export type { ApplyPatchFn, WorldStatusListener } from './switcher.ts'
