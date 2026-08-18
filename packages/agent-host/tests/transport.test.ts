/**
 * Unit tests for the Transport class — the bidirectional message-passing layer.
 *
 * @module @ultimate-ide/agent-host/tests/transport.test
 */

import { describe, it, expect } from 'vitest'
import { Transport, type WirePort } from '../src/transport.ts'

function createPortPair(): [WirePort, WirePort] {
  const handlersA: ((m: unknown) => void)[] = []
  const handlersB: ((m: unknown) => void)[] = []
  return [
    { postMessage: (m) => handlersB.forEach((h) => h(m)), onMessage: (h) => { handlersA.push(h); return () => { const i = handlersA.indexOf(h); if (i >= 0) handlersA.splice(i, 1) } } },
    { postMessage: (m) => handlersA.forEach((h) => h(m)), onMessage: (h) => { handlersB.push(h); return () => { const i = handlersB.indexOf(h); if (i >= 0) handlersB.splice(i, 1) } } },
  ]
}

describe('Transport', () => {
  it('request/response round-trips a result', async () => {
    const [clientPort, serverPort] = createPortPair()
    const client = new Transport(clientPort)
    const server = new Transport(serverPort)
    server.onRequest(async (req) => {
      server.respond(req.id, true, { echoed: req.args })
    })
    const result = await client.request('echo', ['hello', 42])
    expect(result).toEqual({ echoed: ['hello', 42] })
    client.close()
    server.close()
  })

  it('request/response round-trips an error', async () => {
    const [clientPort, serverPort] = createPortPair()
    const client = new Transport(clientPort)
    const server = new Transport(serverPort)
    server.onRequest(async (req) => {
      server.respond(req.id, false, undefined, 'boom')
    })
    await expect(client.request('fail', [])).rejects.toThrow('boom')
    client.close()
    server.close()
  })

  it('events flow from server to client', async () => {
    const [clientPort, serverPort] = createPortPair()
    const client = new Transport(clientPort)
    const server = new Transport(serverPort)
    const received: unknown[] = []
    client.onEvent((e) => received.push(e))
    server.emit({ kind: 'test', payload: 'hello' })
    await new Promise((r) => setTimeout(r, 5))
    expect(received).toEqual([{ kind: 'test', payload: 'hello' }])
    client.close()
    server.close()
  })

  it('multiple concurrent requests each get their own response', async () => {
    const [clientPort, serverPort] = createPortPair()
    const client = new Transport(clientPort)
    const server = new Transport(serverPort)
    server.onRequest(async (req) => {
      // Delay proportional to id to test ordering independence
      await new Promise((r) => setTimeout(r, 10 - (req.id % 5)))
      server.respond(req.id, true, req.id * 10)
    })
    const results = await Promise.all([
      client.request('mul', [1]),
      client.request('mul', [2]),
      client.request('mul', [3]),
    ])
    expect(results).toEqual([10, 20, 30])
    client.close()
    server.close()
  })
})
