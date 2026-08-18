/**
 * R7: execution world switcher — manages switching between local and cloud
 * execution worlds at the session or profile level.
 *
 * The switcher is the user-facing API for the "agent's hands reach the cloud"
 * feature. It:
 *  1. Tracks the current execution world (local by default).
 *  2. On switch, reconfigures the DSH profile to mount the right fs/subprocess
 *     providers (fs-local/subprocess-local for local; fs-e2b/subprocess-e2b
 *     for cloud).
 *  3. Optionally syncs workspace files to the cloud sandbox on connect.
 *  4. Notifies the UI of the world status.
 *
 * In the VS Code fork, this is exposed as a command + status bar indicator.
 *
 * @module @ultimate-ide/cloud-execution/switcher
 */

import type {
  ExecutionWorldConfig,
  ExecutionWorldKind,
  ExecutionWorldInfo,
  ExecutionWorldStatus,
} from './types.ts'

/** Callback type for applying a profile patch to the Agent Host. */
export type ApplyPatchFn = (patch: ExecutionWorldConfig) => Promise<void>

/** Listener for execution world status changes. */
export type WorldStatusListener = (info: ExecutionWorldInfo) => void

/**
 * The execution world switcher.
 *
 * Manages the current execution world and provides a clean API for switching
 * between local and cloud (E2B) execution.
 */
export class ExecutionWorldSwitcher {
  private currentConfig: ExecutionWorldConfig
  private currentStatus: ExecutionWorldStatus = { kind: 'disconnected' }
  private readonly applyPatch: ApplyPatchFn
  private readonly listeners: WorldStatusListener[] = []

  constructor(initialConfig: ExecutionWorldConfig, applyPatch: ApplyPatchFn) {
    this.currentConfig = initialConfig
    this.applyPatch = applyPatch
  }

  /** Get the current execution world info. */
  getInfo(): ExecutionWorldInfo {
    return {
      kind: this.currentConfig.kind,
      status: this.currentStatus,
      label: this.labelFor(this.currentConfig.kind),
      sandboxed: this.currentConfig.kind !== 'local',
    }
  }

  /** Switch to a different execution world. */
  async switch(config: ExecutionWorldConfig): Promise<void> {
    this.setStatus({ kind: 'connecting' })
    this.currentConfig = config

    try {
      // Apply the profile patch to the Agent Host — this reconfigures
      // ctx.fs/ctx.subprocess to the new backend.
      await this.applyPatch(config)

      // For cloud-e2b, the Agent Host would create an E2B sandbox here.
      // The sandbox id is returned and stored.
      const sandboxId = config.kind === 'cloud-e2b'
        ? `e2b-${Date.now()}`
        : undefined

      this.setStatus({ kind: 'connected', sandboxId })
    } catch (err) {
      this.setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
  }

  /** Switch to local execution. */
  async switchToLocal(workspaceRoot: string): Promise<void> {
    await this.switch({ kind: 'local', workspaceRoot })
  }

  /** Switch to E2B cloud execution. */
  async switchToE2B(workspaceRoot: string, templateId: string, apiKeyRef: string): Promise<void> {
    await this.switch({
      kind: 'cloud-e2b',
      workspaceRoot,
      e2bTemplateId: templateId,
      e2bApiKeyRef: apiKeyRef,
      syncOnConnect: true,
    })
  }

  /** Disconnect from the current execution world. */
  async disconnect(): Promise<void> {
    this.setStatus({ kind: 'disconnected' })
  }

  /** Subscribe to status changes. */
  onStatusChange(listener: WorldStatusListener): () => void {
    this.listeners.push(listener)
    return () => {
      const i = this.listeners.indexOf(listener)
      if (i >= 0) this.listeners.splice(i, 1)
    }
  }

  /** Get the current config. */
  get config(): ExecutionWorldConfig {
    return this.currentConfig
  }

  private setStatus(status: ExecutionWorldStatus): void {
    this.currentStatus = status
    const info = this.getInfo()
    for (const listener of this.listeners) listener(info)
  }

  private labelFor(kind: ExecutionWorldKind): string {
    switch (kind) {
      case 'local': return 'Local'
      case 'cloud-e2b': return 'Cloud (E2B)'
      case 'remote': return 'Remote'
    }
  }
}

/**
 * Helper: determine if a config requires cloud credentials.
 */
export function requiresCloudCredentials(config: ExecutionWorldConfig): boolean {
  return config.kind === 'cloud-e2b' && !config.e2bApiKeyRef
}

/**
 * Helper: the profile patch YAML for a given execution world.
 * This is what gets applied to the DSH profile to swap fs/subprocess providers.
 */
export function worldPatchYaml(config: ExecutionWorldConfig): string {
  switch (config.kind) {
    case 'local':
      return `# Local execution world
- id: fs-sandbox
  name: '@deepseek-ai/dsh-fs-local'
- id: subprocess
  name: '@deepseek-ai/dsh-subprocess-local'
`
    case 'cloud-e2b':
      return `# Cloud (E2B) execution world
- id: e2b
  name: '@deepseek-ai/dsh-e2b'
  config:
    templateId: ${config.e2bTemplateId ?? 'default'}
- id: fs-sandbox
  name: '@deepseek-ai/dsh-fs-e2b'
- id: subprocess
  name: '@deepseek-ai/dsh-subprocess-e2b'
`
    case 'remote':
      return `# Remote execution world
- id: fs-sandbox
  name: '@deepseek-ai/dsh-fs-remote'
  config:
    uri: ${config.remoteUri ?? ''}
`
  }
}
