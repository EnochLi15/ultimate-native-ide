/**
 * R6 extension-bridge tests: EH→AH and AH→EH capability flow.
 *
 * @module @ultimate-ide/extension-bridge/tests/bridge.test
 */

import { describe, it, expect } from 'vitest'
import { EhToAhBridge, AhToEhBridge } from '../src/index.ts'
import type { AgentToolProxy, SessionLogProxy } from '../src/index.ts'
import type { SessionId } from '@ultimate-ide/contracts/ids'
import type { SessionEvent } from '@ultimate-ide/contracts/session'

describe('R6: EH→AH bridge (extension contributions → agent)', () => {
  it('registers and unregisters model providers', () => {
    const bridge = new EhToAhBridge()
    const dispose = bridge.registerModelProvider({
      vendor: 'openai',
      label: 'OpenAI',
      async sendRequest() { return { content: [{ type: 'text', text: 'ok' }] } },
    })

    expect(bridge.getModelProviders()).toHaveLength(1)
    expect(bridge.getModelProviders()[0].vendor).toBe('openai')

    dispose()
    expect(bridge.getModelProviders()).toHaveLength(0)
  })

  it('registers tools and exposes them as ToolDefinition', () => {
    const bridge = new EhToAhBridge()
    bridge.registerTool({
      name: 'my_ext_tool',
      description: 'A custom extension tool',
      parameters: { type: 'object', properties: {} },
      async execute() { return 'result' },
    })

    const defs = bridge.getToolDefinitions()
    expect(defs).toHaveLength(1)
    expect(defs[0].name).toBe('my_ext_tool')
    expect(defs[0].description).toBe('A custom extension tool')
  })

  it('executes registered tools', async () => {
    const bridge = new EhToAhBridge()
    bridge.registerTool({
      name: 'echo_tool',
      description: 'Echoes input',
      parameters: { type: 'object' },
      async execute(args) { return JSON.stringify(args) },
    })

    const result = await bridge.executeTool('echo_tool', { msg: 'hello' })
    expect(result.isError).toBe(false)
    expect(result.content[0]).toMatchObject({ type: 'text' })
  })

  it('returns error for unknown tools', async () => {
    const bridge = new EhToAhBridge()
    const result = await bridge.executeTool('nonexistent', {})
    expect(result.isError).toBe(true)
  })

  it('registers chat participants', () => {
    const bridge = new EhToAhBridge()
    bridge.registerChatParticipant({
      id: 'my-agent',
      name: 'My Agent',
      description: 'Custom agent',
      persona: 'You are a helpful assistant.',
    })

    expect(bridge.getChatParticipants()).toHaveLength(1)
    expect(bridge.getChatParticipants()[0].id).toBe('my-agent')
  })
})

describe('R6: AH→EH bridge (agent capabilities → extensions)', () => {
  it('registers and invokes agent tools', async () => {
    const bridge = new AhToEhBridge()
    const proxy: AgentToolProxy = {
      definition: { name: 'agent_bash', description: 'Run bash', parameters: { type: 'object' } },
      async invoke(args) {
        return { content: [{ type: 'text', text: `ran: ${JSON.stringify(args)}` }], isError: false }
      },
    }

    const dispose = bridge.registerAgentTool(proxy)
    expect(bridge.getAgentTools()).toHaveLength(1)

    const result = await bridge.invokeAgentTool('agent_bash', { command: 'ls' }, 's1' as never)
    expect(result.isError).toBe(false)
    expect(result.content[0]).toMatchObject({ type: 'text' })

    dispose()
    expect(bridge.getAgentTools()).toHaveLength(0)
  })

  it('notifies on tool registry changes', () => {
    const bridge = new AhToEhBridge()
    const changes: number[] = []
    bridge.onToolsChanged((tools) => changes.push(tools.length))

    bridge.registerAgentTool({
      definition: { name: 't1', description: 'T1', parameters: {} },
      async invoke() { return { content: [], isError: false } },
    })
    bridge.registerAgentTool({
      definition: { name: 't2', description: 'T2', parameters: {} },
      async invoke() { return { content: [], isError: false } },
    })

    expect(changes).toEqual([1, 2])
  })

  it('manages session log proxies', async () => {
    const bridge = new AhToEhBridge()
    const logProxy: SessionLogProxy = {
      async queryEvents() { return [] },
      subscribe(_sid, handler) {
        // Simulate one event.
        setTimeout(() => handler({ seq: 0, time: 0, type: 'turn/start', data: { turn: 1 } } as SessionEvent), 10)
        return () => {}
      },
    }

    const dispose = bridge.registerSessionLog('s1' as never, logProxy)
    expect(bridge.getSessionLog('s1' as never)).toBeDefined()

    // Test subscription.
    const events: SessionEvent[] = []
    bridge.getSessionLog('s1' as never)?.subscribe('s1' as never, (e) => events.push(e))
    await new Promise((r) => setTimeout(r, 15))
    expect(events).toHaveLength(1)

    dispose()
    expect(bridge.getSessionLog('s1' as never)).toBeUndefined()
  })

  it('returns error for unknown agent tools', async () => {
    const bridge = new AhToEhBridge()
    const result = await bridge.invokeAgentTool('unknown', {}, 's1' as never)
    expect(result.isError).toBe(true)
  })
})
