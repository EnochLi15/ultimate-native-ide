#!/usr/bin/env node
/**
 * Agent Host CLI entry point — runs the Agent Host as a standalone process
 * communicating over stdio (newline-delimited JSON-RPC).
 *
 * Usage:
 *   DSH_HOME=/path/to/.dsh-home node --import tsx/esm packages/agent-host/src/cli.ts
 *
 * Protocol (one JSON object per line):
 *   Request:  { "kind": "request", "id": 1, "method": "listTools", "args": ["s1"] }
 *   Response: { "kind": "response", "id": 1, "ok": true, "result": [...] }
 *   Event:    { "kind": "event", "payload": { "kind": "session-event", ... } }
 *
 * @module @ultimate-ide/agent-host/cli
 */

import { bootDsh } from './dsh-boot.ts'
import { AgentHostRpcServer } from './rpc-server.ts'
import { Transport } from './transport.ts'
import { StdioPort } from './stdio-port.ts'

async function main(): Promise<void> {
  const workspaceRoot = process.env.DSH_WORKSPACE_ROOT ?? process.cwd()
  const dshHome = process.env.DSH_HOME

  if (!dshHome) {
    process.stderr.write('agent-host: DSH_HOME is required\n')
    process.exit(1)
  }

  process.stderr.write(`[agent-host] booting... workspace=${workspaceRoot}\n`)

  // 1. Create the stdio transport first (so onEvent can use it).
  const port = new StdioPort()
  const transport = new Transport(port)

  // 2. Boot the real DSH kernel, forwarding events to stdout.
  const kernel = await bootDsh({
    workspaceRoot,
    onEvent: (event) => {
      transport.emit(event)
    },
  })

  // 3. Start the RPC server.
  const server = new AgentHostRpcServer(transport, kernel)
  server.start()

  process.stderr.write('[agent-host] ready, serving AgentHostApi over stdio\n')

  // 4. Graceful shutdown.
  const shutdown = async (): Promise<void> => {
    process.stderr.write('[agent-host] shutting down...\n')
    transport.close()
    await kernel.dispose()
    process.exit(0)
  }
  process.on('SIGTERM', () => void shutdown())
  process.on('SIGINT', () => void shutdown())
}

main().catch((err) => {
  process.stderr.write(`[agent-host] fatal: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
