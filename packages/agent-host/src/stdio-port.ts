/**
 * A stdio-based WirePort — adapts process.stdin/stdout to the Transport's
 * message-passing interface. Each line is one JSON-encoded RPC message.
 *
 * This lets the Agent Host run as a standalone process (for testing and
 * debugging without electron), and is the same boot path the electron
 * UtilityProcess will use in production (with a MessagePort instead of stdio).
 *
 * @module @ultimate-ide/agent-host/stdio-port
 */

import { createInterface } from 'node:readline'
import type { WirePort } from './transport.ts'

/** A WirePort backed by process.stdin/stdout (newline-delimited JSON). */
export class StdioPort implements WirePort {
  private readonly stdout: NodeJS.WriteStream
  private readonly stdin: NodeJS.ReadStream
  private handlers: ((m: unknown) => void)[] = []
  private closed = false

  constructor(stdin = process.stdin, stdout = process.stdout) {
    this.stdin = stdin
    this.stdout = stdout
  }

  postMessage(message: unknown): void {
    if (this.closed) return
    this.stdout.write(JSON.stringify(message) + '\n')
  }

  onMessage(handler: (message: unknown) => void): () => void {
    this.handlers.push(handler)
    // Set up readline on first handler.
    if (this.handlers.length === 1) {
      const rl = createInterface({ input: this.stdin })
      rl.on('line', (line) => {
        if (line.trim().length === 0) return
        try {
          const msg = JSON.parse(line)
          for (const h of this.handlers) h(msg)
        } catch {
          // Ignore malformed lines.
        }
      })
    }
    return () => {
      const i = this.handlers.indexOf(handler)
      if (i >= 0) this.handlers.splice(i, 1)
    }
  }

  close(): void {
    this.closed = true
    this.handlers = []
  }
}
