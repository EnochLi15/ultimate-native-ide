/**
 * R7: skill & MCP market registry — manages installed skills and MCP servers.
 *
 * The registry is the user-facing API for the open ecosystem:
 *  - Discover skills from builtin, local, GitHub, or a registry
 *  - Install/uninstall skills
 *  - Enable/disable skills per-session
 *  - Register MCP servers and manage their connections
 *
 * In the VS Code fork, this is exposed as a settings panel + command palette.
 *
 * @module @ultimate-ide/skill-market/registry
 */

import type { SkillPackage, McpServerEntry, InstallStatus, SkillSource } from './types.ts'

/** Callback for applying skill changes to the Agent Host. */
export type ApplySkillFn = (skills: SkillPackage[]) => Promise<void>

/** Callback for applying MCP server changes to the Agent Host. */
export type ApplyMcpFn = (servers: McpServerEntry[]) => Promise<void>

/**
 * The skill & MCP market registry.
 */
export class SkillMarketRegistry {
  private readonly skills = new Map<string, SkillPackage>()
  private readonly mcpServers = new Map<string, McpServerEntry>()
  private readonly installStatuses = new Map<string, InstallStatus>()
  private readonly applySkill: ApplySkillFn
  private readonly applyMcp: ApplyMcpFn
  private readonly listeners: Array<() => void> = []

  constructor(applySkill: ApplySkillFn, applyMcp: ApplyMcpFn) {
    this.applySkill = applySkill
    this.applyMcp = applyMcp
  }

  // -- Skills --

  /** Register a skill (from any source). */
  registerSkill(skill: SkillPackage): () => void {
    this.skills.set(skill.id, skill)
    this.installStatuses.set(skill.id, { kind: 'installed', version: skill.version })
    this.notify()
    void this.applySkill(this.listSkills())
    return () => {
      this.skills.delete(skill.id)
      this.installStatuses.delete(skill.id)
      this.notify()
      void this.applySkill(this.listSkills())
    }
  }

  /** Install a skill from GitHub. */
  async installFromGithub(repo: string, skillId: string, name: string, description: string): Promise<void> {
    this.installStatuses.set(skillId, { kind: 'installing' })
    this.notify()
    try {
      // In production: clone the repo, read the SKILL.md, register the skill.
      // For now, register with source='github'.
      this.registerSkill({
        id: skillId,
        name,
        description,
        source: 'github' as SkillSource,
        version: '0.0.1',
        enabled: true,
        repo,
        tags: [],
      })
    } catch (err) {
      this.installStatuses.set(skillId, {
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      })
      this.notify()
      throw err
    }
  }

  /** Enable/disable a skill. */
  setSkillEnabled(id: string, enabled: boolean): void {
    const skill = this.skills.get(id)
    if (!skill) throw new Error(`skill ${id} not found`)
    this.skills.set(id, { ...skill, enabled })
    this.notify()
    void this.applySkill(this.listSkills())
  }

  /** Uninstall a skill. */
  uninstallSkill(id: string): void {
    this.skills.delete(id)
    this.installStatuses.set(id, { kind: 'not-installed' })
    this.notify()
    void this.applySkill(this.listSkills())
  }

  /** List all registered skills. */
  listSkills(): SkillPackage[] {
    return [...this.skills.values()]
  }

  /** Get the install status of a skill. */
  getInstallStatus(id: string): InstallStatus {
    return this.installStatuses.get(id) ?? { kind: 'not-installed' }
  }

  /** Search skills by query (name/description/tags). */
  search(query: string): SkillPackage[] {
    const q = query.toLowerCase()
    return this.listSkills().filter((s) =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tags.some((t) => t.toLowerCase().includes(q)),
    )
  }

  // -- MCP Servers --

  /** Register an MCP server. */
  registerMcpServer(server: McpServerEntry): () => void {
    this.mcpServers.set(server.id, server)
    this.notify()
    void this.applyMcp(this.listMcpServers())
    return () => {
      this.mcpServers.delete(server.id)
      this.notify()
      void this.applyMcp(this.listMcpServers())
    }
  }

  /** Set MCP server connection status. */
  setMcpConnected(id: string, connected: boolean): void {
    const server = this.mcpServers.get(id)
    if (!server) throw new Error(`MCP server ${id} not found`)
    this.mcpServers.set(id, { ...server, connected })
    this.notify()
    void this.applyMcp(this.listMcpServers())
  }

  /** List all registered MCP servers. */
  listMcpServers(): McpServerEntry[] {
    return [...this.mcpServers.values()]
  }

  // -- Subscriptions --

  /** Subscribe to registry changes. */
  onChange(listener: () => void): () => void {
    this.listeners.push(listener)
    return () => {
      const i = this.listeners.indexOf(listener)
      if (i >= 0) this.listeners.splice(i, 1)
    }
  }

  private notify(): void {
    for (const listener of this.listeners) listener()
  }
}
