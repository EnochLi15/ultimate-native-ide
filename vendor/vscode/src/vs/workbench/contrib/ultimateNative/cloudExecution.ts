/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Ultimate Native IDE. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

/**
 * R7: Cloud execution world integration for VS Code.
 *
 * Provides the VS Code-local execution world switcher that manages switching
 * between local and cloud (E2B) execution. Generates the DSH profile patch
 * YAML to swap fs/subprocess providers.
 *
 * @module vs/workbench/contrib/ultimateNative/cloudExecution
 */

import { Emitter, Event } from '../../../base/common/event.js';

/** The execution world location. */
export type ExecutionWorldKind = 'local' | 'cloud-e2b' | 'remote';

/** Configuration for one execution world. */
export interface ExecutionWorldConfig {
  readonly kind: ExecutionWorldKind;
  readonly workspaceRoot: string;
  readonly e2bTemplateId?: string;
  readonly e2bApiKeyRef?: string;
  readonly syncOnConnect?: boolean;
}

/** The status of an execution world connection. */
export type ExecutionWorldStatus =
  | { kind: 'disconnected' }
  | { kind: 'connecting' }
  | { kind: 'connected'; sandboxId?: string }
  | { kind: 'error'; message: string };

/** One execution world's runtime info. */
export interface ExecutionWorldInfo {
  readonly kind: ExecutionWorldKind;
  readonly status: ExecutionWorldStatus;
  readonly label: string;
  readonly sandboxed: boolean;
}

/** Generate the DSH profile patch YAML for an execution world. */
export function worldPatchYaml(config: ExecutionWorldConfig): string {
  switch (config.kind) {
    case 'local':
      return `# Local execution world
- id: fs-sandbox
  name: '@deepseek-ai/dsh-fs-local'
- id: subprocess
  name: '@deepseek-ai/dsh-subprocess-local'
`;
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
`;
    case 'remote':
      return `# Remote execution world
- id: fs-sandbox
  name: '@deepseek-ai/dsh-fs-remote'
`;
  }
}

/** The execution world switcher. */
export class ExecutionWorldSwitcher {
  private _config: ExecutionWorldConfig;
  private _status: ExecutionWorldStatus = { kind: 'disconnected' };

  private readonly _onDidChange = new Emitter<ExecutionWorldInfo>();
  readonly onDidChange: Event<ExecutionWorldInfo> = this._onDidChange.event;

  constructor(initialConfig: ExecutionWorldConfig) {
    this._config = initialConfig;
  }

  getInfo(): ExecutionWorldInfo {
    return {
      kind: this._config.kind,
      status: this._status,
      label: this._labelFor(this._config.kind),
      sandboxed: this._config.kind !== 'local',
    };
  }

  get config(): ExecutionWorldConfig {
    return this._config;
  }

  async switch(config: ExecutionWorldConfig): Promise<void> {
    this._setStatus({ kind: 'connecting' });
    this._config = config;
    try {
      const sandboxId = config.kind === 'cloud-e2b' ? `e2b-${Date.now()}` : undefined;
      this._setStatus({ kind: 'connected', sandboxId });
    } catch (err) {
      this._setStatus({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  }

  async switchToLocal(workspaceRoot: string): Promise<void> {
    await this.switch({ kind: 'local', workspaceRoot });
  }

  async switchToE2B(workspaceRoot: string, templateId: string, apiKeyRef: string): Promise<void> {
    await this.switch({ kind: 'cloud-e2b', workspaceRoot, e2bTemplateId: templateId, e2bApiKeyRef: apiKeyRef, syncOnConnect: true });
  }

  async disconnect(): Promise<void> {
    this._setStatus({ kind: 'disconnected' });
  }

  private _setStatus(status: ExecutionWorldStatus): void {
    this._status = status;
    this._onDidChange.fire(this.getInfo());
  }

  private _labelFor(kind: ExecutionWorldKind): string {
    switch (kind) {
      case 'local': return 'Local';
      case 'cloud-e2b': return 'Cloud (E2B)';
      case 'remote': return 'Remote';
    }
  }
}
