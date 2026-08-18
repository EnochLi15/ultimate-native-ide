/**
 * R7: skill & MCP market types.
 *
 * @module @ultimate-ide/skill-market/types
 */

/** One installable skill (reusable agent instructions). */
export interface SkillPackage {
  /** The skill's unique id (e.g. 'tdd', 'diagnose', 'blog-writing-guide'). */
  readonly id: string
  /** Human-readable name. */
  readonly name: string
  /** One-line description. */
  readonly description: string
  /** The source: 'builtin', 'local', 'github', 'registry'. */
  readonly source: SkillSource
  /** The skill's version. */
  readonly version: string
  /** Whether the skill is currently installed/enabled. */
  readonly enabled: boolean
  /** Optional GitHub repo (for 'github' source). */
  readonly repo?: string
  /** Optional path (for 'local' source). */
  readonly path?: string
  /** Tags for search/filter. */
  readonly tags: readonly string[]
}

/** Where a skill comes from. */
export type SkillSource = 'builtin' | 'local' | 'github' | 'registry'

/** One MCP server definition. */
export interface McpServerEntry {
  /** The server's unique id. */
  readonly id: string
  /** Human-readable name. */
  readonly name: string
  /** The transport type. */
  readonly transport: 'stdio' | 'sse' | 'http'
  /** The command (for stdio) or URL (for sse/http). */
  readonly endpoint: string
  /** Whether the server is currently connected. */
  readonly connected: boolean
  /** Optional: environment variables (references, not values). */
  readonly envRefs?: readonly string[]
}

/** Installation status for a skill or MCP server. */
export type InstallStatus =
  | { kind: 'not-installed' }
  | { kind: 'installing' }
  | { kind: 'installed'; version: string }
  | { kind: 'error'; message: string }
