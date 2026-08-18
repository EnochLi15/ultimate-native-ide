/**
 * Spawns the Agent Host as an electron UtilityProcess and connects it to the
 * renderer via a MessageChannelMain.
 *
 * In the VS Code fork, this is called from electron-main's app lifecycle
 * (after `app.whenReady()`), before the renderer window is created. The
 * returned {@link AgentHostConnection} carries the renderer-side MessagePort
 * that the workbench bridge will consume.
 *
 * Production wiring (in the VS Code fork's `src/vs/platform/.../main.ts`):
 * ```ts
 * import { spawnAgentHost } from '@ultimate-ide/electron-main-agent-host'
 * const ahConnection = await spawnAgentHost(workspaceRoot)
 * // Pass ahConnection.rendererPort to the BrowserWindow via preload.
 * ```
 *
 * @module @ultimate-ide/electron-main-agent-host/spawner
 */

/** The connection between electron-main and the Agent Host process. */
export interface AgentHostConnection {
  /**
   * The port the renderer receives (via preload / IPC) to talk to the Agent Host.
   * In production this is electron's MessagePortMain; typed as unknown until
   * the VS Code fork provides electron types.
   */
  readonly rendererPort: unknown
  /** The Agent Host UtilityProcess instance. */
  readonly process: unknown
  /** Dispose: kill the Agent Host process and close the port. */
  dispose(): Promise<void>
}

/** Options for {@link spawnAgentHost}. */
export interface SpawnOptions {
  /** The workspace root the Agent Host confines execution to. */
  readonly workspaceRoot: string
  /** The DSH home directory (holds profiles + sessions). */
  readonly dshHome: string
  /** The path to the Agent Host entry script (cli.ts or its built version). */
  readonly agentHostScript: string
  /** Optional: a custom UtilityProcess fork function (for testing). */
  readonly fork?: (options: ForkOptions) => UtilityProcessLike
}

/** A minimal UtilityProcess-like interface (matches electron's UtilityProcess). */
export interface UtilityProcessLike {
  stdout: NodeJS.ReadableStream | null
  stderr: NodeJS.ReadableStream | null
  postMessage(message: unknown, transfer?: unknown[]): void
  kill(): boolean
}

/** Options for the fork function. */
export interface ForkOptions {
  readonly script: string
  readonly env: Record<string, string>
  readonly stdio: 'pipe'
}

/**
 * Spawn the Agent Host as a UtilityProcess and connect it to the renderer.
 *
 * This function is the electron-main integration point. In production it uses
 * electron's `utilityProcess.fork()` and `MessageChannelMain`; in tests it
 * accepts a custom fork function.
 *
 * The Agent Host receives its MessagePort via `process.parentPort`, and the
 * renderer receives the other end via the returned `rendererPort`.
 */
export async function spawnAgentHost(options: SpawnOptions): Promise<AgentHostConnection> {
  const { workspaceRoot, dshHome, agentHostScript, fork } = options

  // In production, this is electron's utilityProcess.fork().
  // The Agent Host script (cli.ts) receives the port via process.parentPort
  // and the workspace root via DSH_WORKSPACE_ROOT env.
  const proc = (fork ?? defaultFork)({
    script: agentHostScript,
    env: {
      ...process.env,
      DSH_HOME: dshHome,
      DSH_WORKSPACE_ROOT: workspaceRoot,
    } as Record<string, string>,
    stdio: 'pipe',
  })

  // Log stderr for diagnostics.
  if (proc.stderr) {
    proc.stderr.on('data', (chunk: Buffer) => {
      process.stderr.write(`[agent-host] ${chunk.toString()}`)
    })
  }

  // In production, create a MessageChannelMain and send port1 to the Agent
  // Host process and port2 to the renderer. For now, this is a placeholder
  // that the VS Code fork's electron-main fills in with real electron APIs.
  //
  // The actual electron code:
  //   const { port1, port2 } = new MessageChannelMain()
  //   proc.postMessage({ type: 'port', port: port1 }, [port1])
  //   return { rendererPort: port2, process: proc, dispose: ... }

  // Placeholder: return a stub connection until electron APIs are available.
  // The real implementation requires electron's MessageChannelMain, which is
  // only available in the electron-main process of the VS Code fork.
  return {
    rendererPort: null as unknown, // set by the fork's real implementation
    process: proc,
    async dispose() {
      proc.kill()
    },
  }
}

/** Default fork: uses node's child_process.spawn as a fallback (non-electron). */
function defaultFork(opts: ForkOptions): UtilityProcessLike {
  // In production this is replaced by electron's utilityProcess.fork().
  // For non-electron testing, spawn as a child process.
  const { spawn } = require('node:child_process') as typeof import('node:child_process')
  const child = spawn(process.execPath, ['--import', 'tsx/esm', opts.script], {
    env: opts.env,
    stdio: [opts.stdio, opts.stdio, opts.stdio],
  })
  return {
    stdout: child.stdout,
    stderr: child.stderr,
    postMessage(message: unknown) {
      child.stdin?.write(JSON.stringify(message) + '\n')
    },
    kill() {
      child.kill('SIGTERM')
      return true
    },
  }
}
