/**
 * Cross-boundary branded ids. Each is a plain string at runtime but nominally
 * distinct at the type level, so the compiler refuses to swap a session id for
 * an fs target key. Construction goes through the owning side's factory (a
 * branded cast); the contracts layer only declares the types.
 *
 * @module @ultimate-ide/contracts/ids
 */

import type { Branded } from './brand.ts'

/**
 * The single live identity shared by an agent and its session log.
 * Source: `@deepseek-ai/dsh-session` (`packages/core/session/src/types.ts:22`).
 */
export type SessionId = Branded<'SessionId'>

/**
 * Opaque key for fs stale guards and target lookup. The local backend uses a
 * realpath-like string; a remote backend might use a workspace URI or file id.
 * Consumers MUST NOT parse it or assume it is a local absolute path.
 * Source: `@deepseek-ai/dsh-fs/types` (`packages/fs/fs/src/types.ts`).
 */
export type FsTargetKey = Branded<'FsTargetKey'>

/**
 * Opaque file-version token — the freshness token a write/edit guards against.
 * Source: `@deepseek-ai/dsh-fs/types`.
 */
export type FsVersion = Branded<'FsVersion'>
