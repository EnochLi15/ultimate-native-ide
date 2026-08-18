/**
 * @ultimate-ide/contracts — the deep-contract type layer shared between the
 * VS Code renderer and the DSH Agent Host.
 *
 * This package is TYPE-ONLY and dependency-free. Both sides import from here
 * so type drift between the renderer's proxy and the Agent Host's
 * implementation surfaces at compile time, not runtime.
 *
 * Architecture invariant: "深合约类型对齐 + 进程拉起,是后续一切基础" (R0 命门).
 *
 * @module @ultimate-ide/contracts
 */

export * from './brand.ts'
export * from './ids.ts'
export * from './agent.ts'
export * from './session.ts'
export * from './fs.ts'
export * from './tools.ts'
export * from './rpc.ts'
