/**
 * R0.4 integration test: the full Agent Host path via stdio, simulating what
 * the electron-main spawner would do.
 *
 * This test spawns the Agent Host CLI as a child process (exactly what
 * utilityProcess.fork does in production), sends JSON-RPC over stdio, and
 * verifies the complete path:
 *   CLI process (Agent Host) → DSH kernel → bash execution → response
 *
 * This is the closest verification to production without a full electron build.
 *
 * @module @ultimate-ide/agent-host/tests/stdio-e2e.test
 */

import { describe, it, expect } from 'vitest'
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

const DSH_HOME = new URL('../../../.dsh-home', import.meta.url).pathname
const WORKSPACE = process.cwd()

/** Spawn the Agent Host CLI and return a JSON-RPC client. */
function spawnAgentHostCli(): {
  send: (method: string, args: unknown[]) => Promise<unknown>
  kill: () => void
} {
  const child = spawn(process.execPath, ['--import', 'tsx/esm', 'packages/agent-host/src/cli.ts'], {
    cwd: WORKSPACE,
    env: { ...process.env, DSH_HOME, DSH_WORKSPACE_ROOT: WORKSPACE },
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  const stdoutRL = createInterface({ input: child.stdout })
  const waiters = new Map<number, (result: unknown) => void>()
  let idCounter = 0

  stdoutRL.on('line', (line) => {
    try {
      const msg = JSON.parse(line)
      if (msg.kind === 'response' && msg.id !== undefined) {
        const waiter = waiters.get(msg.id)
        if (waiter) {
          waiters.delete(msg.id)
          if (msg.ok) waiter(msg.result)
          else waiter(Promise.reject(new Error(msg.error?.message ?? 'RPC error')))
        }
      }
    } catch { /* ignore */ }
  })

  return {
    async send(method: string, args: unknown[]): Promise<unknown> {
      const id = ++idCounter
      return new Promise((resolve, reject) => {
        waiters.set(id, (result) => {
          if (result instanceof Promise) result.catch(reject)
          else resolve(result)
        })
        child.stdin.write(JSON.stringify({ kind: 'request', id, method, args }) + '\n')
      })
    },
    kill() { child.kill('SIGTERM') },
  }
}

describe('R0.4: Agent Host CLI via stdio (simulates electron spawner)', () => {
  it('boots, handshakes, lists tools, runs bash — all over stdio', async () => {
    const cli = spawnAgentHostCli()

    try {
      // Wait for "ready" on stderr (the CLI logs to stderr).
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('boot timeout')), 15_000)
        cli.kill // just to reference; we need the child's stderr
        // The child's stderr is not exposed here; use a polling approach.
        setTimeout(() => { clearTimeout(timeout); resolve() }, 3000)
      })

      // 1. Handshake.
      const hs = await cli.send('__handshake', [{
        protocol: 'ultimate-ide-agent-host',
        version: 1,
        workspaceRoot: WORKSPACE,
      }]) as { ready: boolean }
      expect(hs.ready).toBe(true)

      // 2. List tools.
      const tools = await cli.send('listTools', ['stdio-test']) as Array<{ name: string }>
      expect(tools.length).toBeGreaterThan(20)
      expect(tools.some((t) => t.name === 'bash')).toBe(true)

      // 3. Execute bash.
      const result = await cli.send('invokeTool', ['stdio-test', 'bash', {
        command: 'echo stdio-e2e-success',
        description: 'test echo via stdio',
      }]) as { isError: boolean; content: Array<{ type: string; text: string }> }
      expect(result.isError).toBe(false)
      const text = result.content.map((c) => c.text).join('')
      expect(text).toContain('stdio-e2e-success')
    } finally {
      cli.kill()
    }
  }, 30_000)
})
