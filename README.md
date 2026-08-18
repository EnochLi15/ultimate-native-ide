# Ultimate Native IDE

> 一个开放的 AI native IDE:fork VS Code(深度侵入)+ DeepSeek Harness(DSH)agent 内核深度融合。
>
> **编辑器是脸、扩展是手、DSH agent loop 是脑,三者深度融合为一个 body——native 不让步,生态不丢失,开放是脊柱。**

## 当前状态:93/93 测试,14 包,R0-R7 全部阶段覆盖

### 验证结果(13/13 全绿)
```
=== Ultimate Native IDE — Verification ===
--- Type Checks ---
  ✓ contracts (tsc)          ✓ agent-host (tsc)
  ✓ ide-bridge-renderer      ✓ editor-as-tool
  ✓ provenance               ✓ session-log-spine
  ✓ approval-service         ✓ agent-view
  ✓ extension-bridge         ✓ cloud-execution
  ✓ skill-market
--- Test Suite ---
  ✓ vitest: 93 tests passed
--- CLI Standalone ---
  ✓ CLI: 6/6 passed
=== 13 passed, 0 failed ===
```

运行验证:`node --import tsx/esm scripts/verify-all.ts`

## 架构

```
electron-main (VS Code fork)
  ├─ spawnAgentHost() ← agentHostSpawner.ts (侵入 hook)
  │   └─ UtilityProcess → Agent Host CLI → MessageChannelMain
  ├─ BrowserWindow (preload.ts)
  │   └─ IPC → globalThis.__ultimateNativeAgentHostPort
  └─ renderer (Workbench.startup)
      └─ AgentHostIntegration (Restored phase)
          └─ IdeBridge → IIdeBridgeService

Agent Host (独立进程,DSH 内核)
  ├─ agent-loop (turn/step)
  ├─ ctx.tools (bash/grep/glob/edit/... 25 tools)
  ├─ ctx.fs (resolve/stat/read/write/edit/list)
  ├─ ctx.terminals (PTY spawn/send/read/close)
  ├─ ctx.sessions (append-only SessionEvent log)
  ├─ ctx.llm (model adapters,可换)
  ├─ ctx.sandbox + ctx.approval (沙箱+审批)
  └─ capability seams (model/execution/skill/mcp 可换)
```

## 14 个包(R0-R7 全覆盖)

| 包 | 阶段 | 测试 | 说明 |
|---|---|---|---|
| `contracts` | R0.1 | tsc ✓ | 深合约类型层(brand/ids/agent/session/fs/tools/rpc) |
| `agent-host` | R0-R1 | 25 | 真实 DSH boot + RPC server + CLI + fs + tools(bash) + terminal(PTY) + agent lifecycle + e2e |
| `ide-bridge-renderer` | R0.3 | tsc ✓ | renderer 侧 RPC 客户端(AgentHostApi 类型代理) |
| `electron-main-agent-host` | R0.4 | tsc ✓ | UtilityProcess 拉起 + MessageChannelMain |
| `workbench-bridge` | R0.4 | tsc ✓ | IdeBridge 注册为工作台服务 |
| `editor-as-tool` | R4 | 5 | agent 驱动 UI:open/showDiff/setLayout/presentPlan |
| `provenance` | R2 | 6 | 编辑溯源:initiator(agent/human/extension) + step id + tracker |
| `session-log-spine` | R3 | 15 | timeline + task-tree + replay + fork/resume |
| `approval-service` | R1.6 | 7 | 人机审批:pending 队列 + allow/reject + autoDeny |
| `agent-view` | R5 | 13 | 5 模式(command-bar/panel/task/review/inline) + state reducer |
| `extension-bridge` | R6 | 9 | EH↔AH 双向:model/tool/participant 注册 + agent tool/session log 暴露 |
| `cloud-execution` | R7 | 6 | local↔cloud-e2b 切换 + worldPatchYaml(架构护城河) |
| `skill-market` | R7 | 6 | skill 注册/搜索/GitHub安装 + MCP server 管理 |

## 快速开始

```sh
# 1. 安装依赖
pnpm install

# 2. 搭建 DSH 环境(vendored DSH + profile)
./scripts/setup.sh

# 3. 运行测试
pnpm test

# 4. 全量验证
node --import tsx/esm scripts/verify-all.ts

# 5. 启动 Agent Host CLI(独立进程)
DSH_HOME=.dsh-home node --import tsx/esm packages/agent-host/src/cli.ts
```

## 文档

- [架构文档](docs/01-architecture.md) — 进程拓扑、四大深度融合、深合约、不变量
- [设计方案](docs/02-design.md) — native 四判据、交互范式、形态、护城河
- [实现方案](docs/03-implementation.md) — R0-R7 八阶段、技术决策、测试策略
- [VS Code 集成指南](docs/vscode-fork-integration.md) — 3 集成点 + wiring 步骤
- [演进文档](docs/10-13) — 从"装心脏"到"深度融合"的思路推导

## Native 四判据(设计宪法)

1. agent loop 是调度内核——agent 能主动发起动作
2. session log 是事实之源——会话是工作记忆,非聊天记录
3. 单一执行世界——人/agent 同一个终端、文件、诊断
4. 编辑器是 agent 的工具也是人的审查面——双身份同写一个副本

## 护城河

**native + 开放 + 执行可迁移**,三者互锁:
- native:DSH agent loop 为内核
- 开放:模型/执行/工具/能力四可换
- 执行可迁移:挂 e2b 即整体迁云——Cursor/Windsurf 架构上做不到

## License

MIT
