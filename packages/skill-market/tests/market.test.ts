/**
 * R7 skill-market tests.
 *
 * @module @ultimate-ide/skill-market/tests/market.test
 */

import { describe, it, expect, vi } from 'vitest'
import { SkillMarketRegistry } from '../src/index.ts'
import type { SkillPackage, McpServerEntry } from '../src/index.ts'

describe('R7: skill market registry', () => {
  it('registers and unregisters skills', () => {
    const applySkill = vi.fn().mockResolvedValue(undefined)
    const applyMcp = vi.fn().mockResolvedValue(undefined)
    const reg = new SkillMarketRegistry(applySkill, applyMcp)

    const dispose = reg.registerSkill({
      id: 'tdd',
      name: 'TDD',
      description: 'Test-driven development',
      source: 'builtin',
      version: '1.0.0',
      enabled: true,
      tags: ['testing', 'development'],
    })

    expect(reg.listSkills()).toHaveLength(1)
    expect(reg.getInstallStatus('tdd').kind).toBe('installed')

    dispose()
    expect(reg.listSkills()).toHaveLength(0)
  })

  it('enables and disables skills', () => {
    const applySkill = vi.fn().mockResolvedValue(undefined)
    const reg = new SkillMarketRegistry(applySkill, vi.fn())
    reg.registerSkill({
      id: 'diagnose',
      name: 'Diagnose',
      description: 'Bug diagnosis',
      source: 'builtin',
      version: '1.0.0',
      enabled: true,
      tags: [],
    })

    reg.setSkillEnabled('diagnose', false)
    expect(reg.listSkills()[0].enabled).toBe(false)

    reg.setSkillEnabled('diagnose', true)
    expect(reg.listSkills()[0].enabled).toBe(true)
  })

  it('searches skills by name/description/tags', () => {
    const reg = new SkillMarketRegistry(vi.fn(), vi.fn())
    reg.registerSkill({ id: 'tdd', name: 'TDD', description: 'Test-driven dev', source: 'builtin', version: '1', enabled: true, tags: ['testing'] })
    reg.registerSkill({ id: 'blog', name: 'Blog Writing', description: 'Write blogs', source: 'builtin', version: '1', enabled: true, tags: ['writing'] })

    expect(reg.search('test').length).toBe(1)
    expect(reg.search('test')[0].id).toBe('tdd')
    expect(reg.search('blog').length).toBe(1)
    expect(reg.search('writing').length).toBe(1)
  })

  it('installs from GitHub', async () => {
    const applySkill = vi.fn().mockResolvedValue(undefined)
    const reg = new SkillMarketRegistry(applySkill, vi.fn())

    await reg.installFromGithub('user/repo', 'my-skill', 'My Skill', 'A custom skill')

    expect(reg.listSkills()).toHaveLength(1)
    expect(reg.listSkills()[0].source).toBe('github')
    expect(reg.listSkills()[0].repo).toBe('user/repo')
  })

  it('manages MCP servers', () => {
    const applyMcp = vi.fn().mockResolvedValue(undefined)
    const reg = new SkillMarketRegistry(vi.fn(), applyMcp)

    const dispose = reg.registerMcpServer({
      id: 'memory',
      name: 'Memory MCP',
      transport: 'stdio',
      endpoint: 'node memory-server.js',
      connected: false,
    })

    expect(reg.listMcpServers()).toHaveLength(1)

    reg.setMcpConnected('memory', true)
    expect(reg.listMcpServers()[0].connected).toBe(true)

    dispose()
    expect(reg.listMcpServers()).toHaveLength(0)
  })

  it('notifies on changes', () => {
    const reg = new SkillMarketRegistry(vi.fn(), vi.fn())
    const changes: number[] = []
    reg.onChange(() => changes.push(reg.listSkills().length))

    reg.registerSkill({ id: 's1', name: 'S1', description: '', source: 'builtin', version: '1', enabled: true, tags: [] })
    reg.registerSkill({ id: 's2', name: 'S2', description: '', source: 'builtin', version: '1', enabled: true, tags: [] })

    expect(changes).toEqual([1, 2])
  })
})
