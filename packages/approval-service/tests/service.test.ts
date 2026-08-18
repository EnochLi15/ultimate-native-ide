/**
 * R1.6 approval service tests.
 *
 * @module @ultimate-ide/approval-service/tests/service.test
 */

import { describe, it, expect, vi } from 'vitest'
import { ApprovalService, approvalSeverity } from '../src/index.ts'
import type { ApprovalRequest } from '@ultimate-ide/contracts/rpc'

function makeRequest(id: string, kind: ApprovalRequest['kind'] = 'bash'): ApprovalRequest {
  return { id, sessionId: 's1' as never, kind, description: `test ${kind}`, callId: `call-${id}` }
}

describe('R1.6: approval service', () => {
  it('receives a request and holds it pending', () => {
    const respond = vi.fn().mockResolvedValue(undefined)
    const svc = new ApprovalService(respond)
    const req = makeRequest('a1')

    const promise = svc.receive(req)
    expect(svc.hasPending).toBe(true)
    expect(svc.getPending()).toHaveLength(1)
    expect(svc.getPending()[0].id).toBe('a1')

    // Don't await — the promise is pending until we respond.
    void promise
  })

  it('allow sends the decision and resolves', async () => {
    const respond = vi.fn().mockResolvedValue(undefined)
    const svc = new ApprovalService(respond)
    const req = makeRequest('a2')

    const promise = svc.receive(req)
    await svc.allow('a2')

    const decision = await promise
    expect(decision).toBe('allow')
    expect(respond).toHaveBeenCalledWith({ id: 'a2', decision: 'allow' })
    expect(svc.hasPending).toBe(false)
  })

  it('reject sends the decision and resolves', async () => {
    const respond = vi.fn().mockResolvedValue(undefined)
    const svc = new ApprovalService(respond)
    const req = makeRequest('a3')

    const promise = svc.receive(req)
    await svc.reject('a3')

    const decision = await promise
    expect(decision).toBe('reject')
    expect(respond).toHaveBeenCalledWith({ id: 'a3', decision: 'reject' })
  })

  it('allowAll batch-approves all pending', async () => {
    const respond = vi.fn().mockResolvedValue(undefined)
    const svc = new ApprovalService(respond)
    const p1 = svc.receive(makeRequest('b1'))
    const p2 = svc.receive(makeRequest('b2'))
    const p3 = svc.receive(makeRequest('b3'))

    await svc.allowAll()

    expect(await p1).toBe('allow')
    expect(await p2).toBe('allow')
    expect(await p3).toBe('allow')
    expect(svc.hasPending).toBe(false)
  })

  it('notifies listeners on pending changes', async () => {
    const respond = vi.fn().mockResolvedValue(undefined)
    const svc = new ApprovalService(respond)
    const changes: number[] = []
    svc.onPendingChange((pending) => changes.push(pending.length))

    svc.receive(makeRequest('c1'))
    await svc.allow('c1')

    expect(changes).toEqual([1, 0])
  })

  it('auto-denies after timeout', async () => {
    vi.useFakeTimers()
    const respond = vi.fn().mockResolvedValue(undefined)
    const svc = new ApprovalService(respond, { autoDenyMs: 100 })

    const promise = svc.receive(makeRequest('d1'))
    vi.advanceTimersByTime(100)

    await expect(promise).rejects.toThrow('auto-denied')
    expect(svc.hasPending).toBe(false)
    vi.useRealTimers()
  })

  it('approvalSeverity classifies correctly', () => {
    expect(approvalSeverity(makeRequest('x', 'bash'))).toBe('medium')
    expect(approvalSeverity(makeRequest('x', 'fs-write'))).toBe('low')
    expect(approvalSeverity(makeRequest('x', 'escalation'))).toBe('high')
  })
})
