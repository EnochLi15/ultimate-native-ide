# VS Code Fork Integration Guide

> How the Ultimate Native IDE integrates with the vendored VS Code fork.

## Architecture

```
electron-main (VS Code app.ts)
  ├─ spawnAgentHost() ← R0.4 patch (agentHostSpawner.ts)
  │   └─ UtilityProcess forks Agent Host CLI (packages/agent-host/src/cli.ts)
  │       └─ MessageChannelMain: port1→AH, port2→renderer
  │
  ├─ BrowserWindow created with preload
  │   └─ preload.ts receives port2 via IPC → globalThis.__ultimateNativeAgentHostPort
  │
  └─ renderer (Workbench)
      └─ Workbench.startup()
          └─ AgentHostIntegration (Restored phase) ← R0.4 patch
              └─ reads __ultimateNativeAgentHostPort
              └─ createIdeBridgeService(port) ← @ultimate-ide/workbench-bridge
              └─ bridge.connect(workspaceRoot)
              └─ registers IIdeBridgeService
```

## Integration Points (3 files in vendor/vscode/)

### 1. electron-main: `src/vs/platform/ultimateNative/electron-main/agentHostSpawner.ts`
- `spawnAgentHost(workspaceRoot, dshHome, script)` — forks Agent Host as UtilityProcess
- Creates MessageChannelMain, sends port1 to AH, returns port2 for renderer
- **Wiring**: Called from `src/vs/code/electron-main/app.ts` after `app.whenReady()`, before `openFirstWindow`

### 2. preload: `src/vs/platform/ultimateNative/sandbox/preload.ts`
- Listens for IPC `ultimate-native:agent-host-port`
- Sets `globalThis.__ultimateNativeAgentHostPort = port`
- **Wiring**: Added to the preload script bundle (or imported from existing preload)

### 3. workbench: `src/vs/workbench/contrib/ultimateNative/agentHostIntegration.ts`
- `AgentHostIntegration` IWorkbenchContribution, registered at `LifecyclePhase.Restored`
- Reads `globalThis.__ultimateNativeAgentHostPort`
- Creates IdeBridge, connects, registers as service
- **Wiring**: Auto-registered via contributions registry (no manual call needed)

## Remaining Wiring (to complete R0.4)

### A. electron-main app.ts hook
In `src/vs/code/electron-main/app.ts`, before `openFirstWindow`:
```ts
import { spawnAgentHost } from 'vs/platform/ultimateNative/electron-main/agentHostSpawner';

// In the app lifecycle, after shared process is ready:
const ahConnection = await spawnAgentHost(
  workspaceRoot,
  dshHome,
  path.join(__dirname, 'agent-host-cli.js')
);
// Store ahConnection.rendererPort; pass to BrowserWindow via IPC.
```

### B. preload bundle
Add the preload import to the existing preload entry, or merge the IPC listener.

### C. ultimate-native-ide package resolution
The VS Code fork needs to resolve `@ultimate-ide/*` packages. Options:
1. Build the ultimate-native-ide packages and symlink into `vendor/vscode/node_modules/@ultimate-ide/`
2. Or bundle them into the VS Code build via gulpfile configuration

### D. Agent Host script path
The `agentHostScript` path must point to a built version of `packages/agent-host/src/cli.ts`.
For dev: `node --import tsx/esm packages/agent-host/src/cli.ts`
For production: build to JS and reference the built file.

## Testing the Integration

### Dev mode (no electron)
The Agent Host CLI (`packages/agent-host/src/cli.ts`) runs standalone over stdio.
Verified by `cli-verify.ts` (6/6 passed).

### Full integration (with electron)
Requires building VS Code from source:
```sh
cd vendor/vscode
yarn install
yarn compile
# Then run with the integration patches applied.
```

## Current Status
- ✅ All 3 integration files created in vendor/vscode/
- ✅ Agent Host CLI verified standalone (6/6)
- ✅ All ultimate-native-ide packages verified (57/57)
- ⏳ app.ts hook (call spawnAgentHost)
- ⏳ preload bundle merge
- ⏳ Package resolution wiring
- ⏳ Full electron build + verification
