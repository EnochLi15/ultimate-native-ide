/**
 * @ultimate-ide/extension-bridge — R6: bidirectional EH↔AH capability bridge.
 *
 * @module @ultimate-ide/extension-bridge
 */

export { EhToAhBridge } from './eh-to-ah.ts'
export type { ExtensionModelProvider, ExtensionTool, ExtensionChatParticipant } from './eh-to-ah.ts'

export { AhToEhBridge } from './ah-to-eh.ts'
export type { AgentToolProxy, SessionLogProxy } from './ah-to-eh.ts'
