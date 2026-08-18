/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Ultimate Native IDE. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

/**
 * R4: editor-as-tool event handler for VS Code.
 *
 * Receives editor-open / editor-show-diff / workbench-layout events from the
 * Agent Host (via AgentHostEvent stream) and executes the corresponding VS Code
 * API calls (openEditor, revealRange, diffEditor, setLayout).
 *
 * @module vs/workbench/contrib/ultimateNative/editorAsToolHandler
 */

import { IEditorService } from '../../services/editor/common/editorService.js';
import { URI } from '../../../base/common/uri.js';
import { Range } from '../../../editor/common/core/range.js';

/** An editor-open request from the agent. */
export interface EditorOpenRequest {
  readonly path: string;
  readonly startLine?: number;
  readonly endLine?: number;
}

/** An editor-show-diff request from the agent. */
export interface EditorShowDiffRequest {
  readonly path: string;
  readonly before: string;
  readonly after: string;
  readonly label?: string;
}

/** A workbench-layout mode request from the agent. */
export type WorkbenchLayoutMode = 'edit' | 'task' | 'review';

/**
 * The editor-as-tool handler — processes agent UI requests.
 *
 * Registered during Workbench startup, it listens to AgentHostEvent stream
 * and executes VS Code API calls.
 */
export class EditorAsToolHandler {
  constructor(
    private readonly _editorService: IEditorService,
  ) {}

  /**
   * Handle an editor-open request: open a file and optionally reveal a range.
   */
  async handleOpen(req: EditorOpenRequest): Promise<void> {
    const uri = URI.file(req.path);
    await this._editorService.openEditor({ resource: uri });

    if (req.startLine !== undefined) {
      const editor = this._editorService.activeTextEditorControl;
      if (editor && typeof editor === 'object' && 'revealRange' in editor) {
        const startLine = req.startLine;
        const endLine = req.endLine ?? req.startLine;
        (editor as { revealRange: (range: unknown) => void }).revealRange(
          new Range(startLine, 1, endLine, 1),
        );
      }
    }
  }

  /**
   * Handle an editor-show-diff request: present a diff for review.
   */
  async handleShowDiff(_req: EditorShowDiffRequest): Promise<void> {
    // In production, this opens a diff editor with before/after content.
    // For now, log the request.
    console.log(`[ultimate-native] show diff for ${_req.path}`);
  }

  /**
   * Handle a workbench-layout mode change.
   */
  handleSetLayout(_mode: WorkbenchLayoutMode): void {
    // In production, this switches the workbench layout.
    console.log(`[ultimate-native] set layout: ${_mode}`);
  }

  /**
   * Dispatch an AgentHostEvent to the right handler.
   */
  dispatch(event: Record<string, unknown>): void {
    const kind = event.kind as string;
    switch (kind) {
      case 'editor-open':
        void this.handleOpen(event as unknown as EditorOpenRequest);
        break;
      case 'editor-show-diff':
        void this.handleShowDiff(event as unknown as EditorShowDiffRequest);
        break;
      case 'workbench-layout':
        this.handleSetLayout((event as { mode: WorkbenchLayoutMode }).mode);
        break;
      default:
        // Not an editor-as-tool event; ignore.
        break;
    }
  }
}
