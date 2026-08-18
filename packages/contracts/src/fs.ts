/**
 * Filesystem contract types — the `ctx.fs` seam the renderer and agent share
 * (architecture invariant 3: "单一执行世界").
 *
 * These mirror `@deepseek-ai/dsh-fs/types` (`packages/fs/fs/src/types.ts`) in
 * a dependency-free form. The Agent Host owns the real `ctx.fs` provider
 * (local or e2b); the renderer reaches it through the bridge RPC so explorer,
 * search, and save all flow through the same sandboxed execution world.
 *
 * @module @ultimate-ide/contracts/fs
 */

import type { FsTargetKey, FsVersion } from './ids.ts'

/**
 * A path resolved by a backend into a stable identity. `resolve()` produces
 * this; every other fs operation takes it.
 */
export interface FsTarget {
  /** Opaque key for stale guards and target lookup. */
  targetKey: FsTargetKey
  /**
   * Path for model/UI-facing output. May be a local absolute path,
   * workspace-relative path, or remote URI depending on the backend.
   */
  displayPath: string
}

/**
 * One authoritative observation of a target. A present observation carries the
 * version used by guarded replacement; an absent observation authorizes only a
 * guarded create, never an edit.
 */
export type FsObservation =
  | { readonly kind: 'present'; readonly version: FsVersion }
  | { readonly kind: 'absent' }

/** Metadata about a target — what `stat` returns. */
export interface FsInfo {
  /** Opaque freshness token of the target right now. */
  version: FsVersion
  /** Whether the target is a regular file, a directory, or something else. */
  type: 'file' | 'directory' | 'other'
  /** Byte size of a regular file, when the backend can report it. */
  size?: number
}

/** One direct child returned by `listDir`. */
export interface FsDirEntry {
  /** Basename of the child inside the listed directory. */
  name: string
  /** Whether the child is a regular file, a directory, or something else. */
  type: 'file' | 'directory' | 'other'
  /** Resolved child target for follow-up operations. */
  target: FsTarget
  /** Opaque freshness token when the backend can report metadata cheaply. */
  version?: FsVersion
  /** Byte size of a regular file, when the backend can report it. */
  size?: number
}

/** Guarded write intent. */
export type FsWriteIntent =
  | { readonly kind: 'createIfAbsent' }
  | { readonly kind: 'replaceIfVersion'; readonly version: FsVersion }

/** The outcome of a write or edit. */
export interface FsWriteOutcome {
  readonly target: FsTarget
  readonly version: FsVersion
}

/** A literal text edit request. */
export interface FsEdit {
  readonly oldString: string
  readonly newString: string
  readonly replaceAll?: boolean
}

/**
 * The `ctx.fs` provider surface the renderer reaches through the bridge.
 * Methods are async because the backend may be remote (e2b cloud sandbox).
 * This is the RPC projection of DSH's `FileSystem` abstract service.
 */
export interface FsProvider {
  resolve(path: string, opts?: { cwd?: string }): Promise<FsTarget>
  stat(target: FsTarget): Promise<FsInfo | undefined>
  readText(target: FsTarget, opts?: { offset?: number; limit?: number }): Promise<string>
  writeText(target: FsTarget, content: string, intent?: FsWriteIntent): Promise<FsWriteOutcome>
  editText(target: FsTarget, edit: FsEdit, intent?: FsWriteIntent): Promise<FsWriteOutcome>
  listDir(target: FsTarget): Promise<FsDirEntry[]>
}
