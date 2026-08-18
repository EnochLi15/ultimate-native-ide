/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Ultimate Native IDE. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

/**
 * R2: Provenance integration for VS Code's BulkEditService.
 *
 * Wraps IBulkEditService.apply() to attach provenance metadata to every edit.
 *
 * @module vs/workbench/contrib/ultimateNative/provenanceIntegration
 */

import { IBulkEditService, IBulkEditOptions, IBulkEditResult, IBulkEditPreviewHandler, ResourceEdit } from '../../../editor/browser/services/bulkEditService.js';
import { WorkspaceEdit } from '../../../editor/common/languages.js';
import { IDisposable } from '../../../base/common/lifecycle.js';
import { IEditorService } from '../../services/editor/common/editorService.js';
import { ITextModelService } from '../../../editor/common/services/resolverService.js';
import { ILogService } from '../../../platform/log/common/log.js';

/** Who initiated an edit. */
export type EditInitiator = 'agent' | 'human' | 'extension';

/** Provenance metadata attached to a WorkspaceEdit. */
export interface ProvenanceMetadata {
  readonly initiator: EditInitiator;
  readonly sessionId?: string;
  readonly turn?: number;
  readonly step?: number;
  readonly callId?: string;
  readonly editId: string;
  readonly timestamp: number;
}

/** Create provenance metadata for an agent edit. */
export function agentProvenance(sessionId: string, turn: number, step: number, callId?: string): ProvenanceMetadata {
  return {
    initiator: 'agent',
    sessionId,
    turn,
    step,
    callId,
    editId: `edit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
  };
}

/** Create provenance metadata for a human edit. */
export function humanProvenance(): ProvenanceMetadata {
  return {
    initiator: 'human',
    editId: `edit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
  };
}

/**
 * The provenance-aware BulkEditService decorator.
 */
export class ProvenanceBulkEditService implements IBulkEditService {
  readonly _serviceBrand: undefined;

  private _currentInitiator: EditInitiator = 'human';
  private _currentProvenance: ProvenanceMetadata | undefined;
  private _inner: IBulkEditService | undefined;

  constructor(
    @IEditorService private readonly _editorService: IEditorService,
    @ITextModelService private readonly _textModelService: ITextModelService,
    @ILogService private readonly _logService: ILogService,
  ) {
    // Lazily create the real BulkEditService (avoids circular dependency).
    // The inner service is created on first use.
  }

  /** Lazily initialize the real BulkEditService. */
  private getInner(): IBulkEditService {
    if (!this._inner) {
      // Dynamic import to avoid circular dependency at module load time.
      // The real BulkEditService is created with the injected services.
      const { BulkEditService } = require('../../bulkEdit/browser/bulkEditService.js') as {
        BulkEditService: new (editorService: IEditorService, textModelService: ITextModelService, logService: ILogService) => IBulkEditService;
      };
      this._inner = new BulkEditService(this._editorService, this._textModelService, this._logService);
    }
    return this._inner;
  }

  /**
   * Set the current edit initiator. Called by the Agent Host bridge before
   * applying agent edits, and reset to 'human' after.
   */
  setInitiator(initiator: EditInitiator, provenance?: ProvenanceMetadata): void {
    this._currentInitiator = initiator;
    this._currentProvenance = provenance;
  }

  /**
   * Apply edits with provenance tracking.
   */
  async apply(edit: ResourceEdit[] | WorkspaceEdit, options?: IBulkEditOptions): Promise<IBulkEditResult> {
    // Attach provenance to each edit if the initiator is agent/extension.
    if (this._currentProvenance && this._currentInitiator !== 'human') {
      const edits = Array.isArray(edit) ? edit : (edit as { edits?: ResourceEdit[] }).edits ?? [];
      for (const e of edits) {
        const re = e as { metadata?: Record<string, unknown> };
        if (re.metadata) {
          re.metadata.__provenance = this._currentProvenance;
        } else {
          re.metadata = { __provenance: this._currentProvenance };
        }
      }
    }

    // Delegate to the real BulkEditService.
    const result = await this.getInner().apply(edit, options);

    // Reset initiator after agent edits.
    if (this._currentInitiator === 'agent') {
      this.setInitiator('human');
    }

    return result;
  }

  hasPreviewHandler(): boolean {
    return this.getInner().hasPreviewHandler();
  }

  setPreviewHandler(handler: IBulkEditPreviewHandler): IDisposable {
    return this.getInner().setPreviewHandler(handler);
  }
}
