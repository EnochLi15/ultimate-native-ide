/**
 * R1.6: the approval service — manages pending approval requests and delivers
 * the human's decision.
 *
 * The Agent Host pushes {@link ApprovalRequest} events to the renderer when
 * the agent wants to perform a sandboxed action that requires human consent
 * (bash commands, file writes, sandbox escalations, plan execution). This
 * service:
 *  1. Receives approval requests (from the AgentHostEvent stream).
 *  2. Holds them in a pending queue.
 *  3. Notifies the UI to show a blocking approval dialog.
 *  4. Delivers the human's decision back to the Agent Host via
 *     `bridge.api.respondApproval(response)`.
 *
 * Design principles:
 *  - **Blocking by default**: the agent does NOT proceed until the human
 *    responds. This is the "审批是一等公民" invariant.
 *  - **Timeout**: an optional auto-deny timeout prevents the agent from
 *    hanging forever if the human is away.
 *  - **Batching**: multiple approvals from the same turn can be batched into
 *    one dialog ("approve all") for UX efficiency.
 *
 * @module @ultimate-ide/approval-service/service
 */

import type { ApprovalRequest, ApprovalResponse } from '@ultimate-ide/contracts/rpc'
import type { SessionId } from '@ultimate-ide/contracts/ids'

/** The callback that sends the human's decision to the Agent Host. */
export type RespondFn = (response: ApprovalResponse) => Promise<void>

/** A pending approval with its resolve/reject callbacks. */
interface PendingApproval {
  readonly request: ApprovalRequest
  readonly resolve: (decision: 'allow' | 'reject') => void
  readonly reject: (error: Error) => void
  readonly timer: ReturnType<typeof setTimeout> | undefined
}

/** Options for the approval service. */
export interface ApprovalServiceOptions {
  /** Auto-deny after this many ms (0 = no timeout). Default: 0. */
  readonly autoDenyMs?: number
}

/**
 * The approval service — the renderer-side manager for human-in-the-loop
 * approvals.
 *
 * The workbench creates one instance, subscribes it to the AgentHostEvent
 * stream, and renders the pending approvals in a blocking UI.
 */
export class ApprovalService {
  private readonly respond: RespondFn
  private readonly autoDenyMs: number
  private readonly pending = new Map<string, PendingApproval>()
  private readonly listeners: Array<(pending: ApprovalRequest[]) => void> = []

  constructor(respond: RespondFn, options: ApprovalServiceOptions = {}) {
    this.respond = respond
    this.autoDenyMs = options.autoDenyMs ?? 0
  }

  /**
   * Receive an approval request from the Agent Host.
   * Called when the renderer receives an 'approval-request' event.
   */
  receive(request: ApprovalRequest): Promise<'allow' | 'reject'> {
    return new Promise<'allow' | 'reject'>((resolve, reject) => {
      const timer = this.autoDenyMs > 0
        ? setTimeout(() => {
            this.pending.delete(request.id)
            this.notifyListeners()
            reject(new Error(`approval ${request.id} auto-denied (timeout)`))
          }, this.autoDenyMs)
        : undefined

      this.pending.set(request.id, { request, resolve, reject, timer })
      this.notifyListeners()
    })
  }

  /**
   * The human allows the request.
   * Sends the decision to the Agent Host and resolves the promise.
   */
  async allow(id: string): Promise<void> {
    const pending = this.pending.get(id)
    if (!pending) throw new Error(`approval ${id} not found`)
    this.clearTimer(id)
    this.pending.delete(id)
    this.notifyListeners()
    await this.respond({ id, decision: 'allow' })
    pending.resolve('allow')
  }

  /**
   * The human rejects the request.
   * Sends the decision to the Agent Host and resolves the promise.
   */
  async reject(id: string): Promise<void> {
    const pending = this.pending.get(id)
    if (!pending) throw new Error(`approval ${id} not found`)
    this.clearTimer(id)
    this.pending.delete(id)
    this.notifyListeners()
    await this.respond({ id, decision: 'reject' })
    pending.resolve('reject')
  }

  /** Allow all pending approvals (batch UX). */
  async allowAll(): Promise<void> {
    const ids = [...this.pending.keys()]
    await Promise.all(ids.map((id) => this.allow(id)))
  }

  /** Reject all pending approvals (batch UX). */
  async rejectAll(): Promise<void> {
    const ids = [...this.pending.keys()]
    await Promise.all(ids.map((id) => this.reject(id)))
  }

  /** Get the current pending approvals (for UI rendering). */
  getPending(): ApprovalRequest[] {
    return [...this.pending.values()].map((p) => p.request)
  }

  /** Whether there are pending approvals. */
  get hasPending(): boolean {
    return this.pending.size > 0
  }

  /** Subscribe to pending-queue changes (for UI updates). */
  onPendingChange(listener: (pending: ApprovalRequest[]) => void): () => void {
    this.listeners.push(listener)
    return () => {
      const i = this.listeners.indexOf(listener)
      if (i >= 0) this.listeners.splice(i, 1)
    }
  }

  private clearTimer(id: string): void {
    const pending = this.pending.get(id)
    if (pending?.timer) clearTimeout(pending.timer)
  }

  private notifyListeners(): void {
    const snapshot = this.getPending()
    for (const listener of this.listeners) listener(snapshot)
  }
}

/**
 * Helper: classify the severity of an approval request for UI styling.
 */
export function approvalSeverity(request: ApprovalRequest): 'low' | 'medium' | 'high' {
  switch (request.kind) {
    case 'bash':
      return 'medium'
    case 'fs-write':
    case 'fs-edit':
      return 'low'
    case 'escalation':
      return 'high'
    default:
      return 'medium'
  }
}
