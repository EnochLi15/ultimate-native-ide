/**
 * R4 editor-as-tool test: verify the tool functions emit the right events.
 *
 * @module @ultimate-ide/editor-as-tool/tests/tools.test
 */

import { describe, it, expect } from 'vitest'
import {
  executeEditorOpen,
  executeEditorShowDiff,
  executeSetLayout,
  EDITOR_AS_TOOL_SCHEMAS,
} from '../src/tools.ts'
import type { AgentHostEvent } from '@ultimate-ide/contracts/rpc'

describe('R4: editor-as-tool', () => {
  it('editor_open emits an editor-open event with path and range', async () => {
    const events: AgentHostEvent[] = []
    const result = await executeEditorOpen(
      { path: '/src/foo.ts', start_line: 10, end_line: 20 },
      (e) => events.push(e),
    )
    expect(result.isError).toBe(false)
    expect(events).toHaveLength(1)
    expect(events[0].kind).toBe('editor-open')
    expect((events[0] as { path: string }).path).toBe('/src/foo.ts')
  })

  it('editor_show_diff emits an editor-show-diff event', async () => {
    const events: AgentHostEvent[] = []
    const result = await executeEditorShowDiff(
      { path: '/src/foo.ts', before: 'old', after: 'new' },
      (e) => events.push(e),
    )
    expect(result.isError).toBe(false)
    expect(events[0].kind).toBe('editor-show-diff')
  })

  it('set_layout emits a workbench-layout event', async () => {
    const events: AgentHostEvent[] = []
    const result = await executeSetLayout({ mode: 'task' }, (e) => events.push(e))
    expect(result.isError).toBe(false)
    expect(events[0].kind).toBe('workbench-layout')
    expect((events[0] as { mode: string }).mode).toBe('task')
  })

  it('schemas define all three tools with correct names', () => {
    const names = EDITOR_AS_TOOL_SCHEMAS.map((s) => s.name)
    expect(names).toContain('editor_open')
    expect(names).toContain('editor_show_diff')
    expect(names).toContain('workbench_set_layout')
    expect(EDITOR_AS_TOOL_SCHEMAS.length).toBe(3)
  })

  it('each schema has required fields', () => {
    for (const schema of EDITOR_AS_TOOL_SCHEMAS) {
      expect(typeof schema.name).toBe('string')
      expect(schema.name.length).toBeGreaterThan(0)
      expect(typeof schema.description).toBe('string')
      expect(typeof schema.parameters).toBe('object')
    }
  })
})
