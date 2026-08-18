import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

const DSH_HOME = new URL('../../../.dsh-home', import.meta.url).pathname
const WORKSPACE = process.cwd()

// Spawn the Agent Host CLI using node --import tsx/esm.
const child = spawn(process.execPath, ['--import', 'tsx/esm', 'packages/agent-host/src/cli.ts'], {
  cwd: WORKSPACE,
  env: { ...process.env, DSH_HOME, DSH_WORKSPACE_ROOT: WORKSPACE },
  stdio: ['pipe', 'pipe', 'pipe'],
})

const stdoutRL = createInterface({ input: child.stdout })
const stderrRL = createInterface({ input: child.stderr })

let passed = 0
let failed = 0
function assert(cond: boolean, msg: string): void {
  if (cond) { passed++; console.log(`  ✓ ${msg}`) }
  else { failed++; console.error(`  ✗ ${msg}`) }
}

stderrRL.on('line', (line) => console.log(`  [stderr] ${line}`))

async function sendRequest(id: number, method: string, args: unknown[]): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const handler = (line: string) => {
      try {
        const msg = JSON.parse(line)
        if (msg.kind === 'response' && msg.id === id) {
          stdoutRL.off('line', handler)
          if (msg.ok) resolve(msg.result)
          else reject(new Error(msg.error?.message ?? 'RPC error'))
        }
      } catch { /* ignore */ }
    }
    stdoutRL.on('line', handler)
    child.stdin.write(JSON.stringify({ kind: 'request', id, method, args }) + '\n')
  })
}

async function main(): Promise<void> {
  console.log('\n=== Agent Host CLI standalone test ===\n')

  // Wait for "ready" on stderr.
  await new Promise<void>((resolve) => {
    const handler = (line: string) => {
      if (line.includes('ready')) { stderrRL.off('line', handler); resolve() }
    }
    stderrRL.on('line', handler)
  })
  assert(true, 'Agent Host CLI booted and is ready')

  // 1. Handshake.
  const hs = await sendRequest(1, '__handshake', [{
    protocol: 'ultimate-ide-agent-host',
    version: 1,
    workspaceRoot: WORKSPACE,
  }]) as { ready: boolean }
  assert(hs.ready === true, 'handshake: ready=true')

  // 2. List tools.
  const tools = await sendRequest(2, 'listTools', ['cli-test']) as Array<{ name: string }>
  assert(tools.length > 20, `listTools: ${tools.length} tools`)
  assert(tools.some((t) => t.name === 'bash'), 'listTools: bash present')

  // 3. Execute bash.
  const bashResult = await sendRequest(3, 'invokeTool', ['cli-test', 'bash', {
    command: 'echo cli-standalone-success',
    description: 'test echo via CLI',
  }]) as { isError: boolean; content: Array<{ type: string; text: string }> }
  assert(bashResult.isError === false, 'bash: no error')
  const text = bashResult.content.map((c) => c.text).join('')
  assert(text.includes('cli-standalone-success'), `bash: output contains expected string`)

  child.kill('SIGTERM')
  console.log(`\n=== ${passed} passed, ${failed} failed ===\n`)
  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error('Test crashed:', err)
  child.kill()
  process.exit(1)
})
