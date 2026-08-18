# 开发进度

> 跟踪 R0–R7 各阶段完成状态。

## 当前状态:102/102 测试,14 包 + VS Code fork tsc 编译验证通过(0 错误)

### 里程碑
- ✅ R0-R7 全部代码完成(14 包)
- ✅ 102/102 测试通过(19 文件)
- ✅ VS Code fork TypeScript 编译通过(0 错误,6 集成文件)
- ✅ Full-stack 集成测试(14 包端到端)
- ⏳ VS Code gulp 全量编译(进行中)

### 测试:102 个(19 文件)
| 包 | 测试 |
|---|---|
| agent-host | 34 (transport+integration+boot+tools+bash+agent+terminal+e2e+stdio-e2e+full-stack+vscode-patch(9)) |
| session-log-spine | 15 |
| agent-view | 13 |
| extension-bridge | 9 |
| approval-service | 7 |
| provenance | 6 |
| editor-as-tool | 5 |
| cloud-execution | 6 |
| skill-market | 6 |
| contracts/bridge/electron/workbench | tsc ✓ |

### VS Code Fork: 6 集成文件(tsc 0 错误)
1. agentHostSpawner.ts — UtilityProcess + MessageChannelMain
2. app.ts (侵入) — spawnAgentHost before openFirstWindow
3. preload.ts — IPC → globalThis port
4. agentHostIntegration.ts — Workbench Restored → IdeBridge
5. agent-view-state.ts — 状态机(VS Code-local)
6. agentViewBinding.ts — AgentViewService(UI 绑定)

### 各阶段完成度
| 阶段 | 内核侧 | VS Code 侧 | 测试 |
|---|---|---|---|
| R0 | ✅ | ✅ tsc 0 错误 | 34 ✓ |
| R1 | ✅ | ✅ terminal+approval | 8 ✓ |
| R2 | ✅ | ⏳ BulkEdit | 6 ✓ |
| R3 | ✅ | ⏳ 视图 | 15 ✓ |
| R4 | ✅ | ⏳ 事件接收 | 5 ✓ |
| R5 | ✅ | ✅ view binding+state | 13 ✓ |
| R6 | ✅ | ⏳ EH API | 9 ✓ |
| R7 | ✅ | ⏳ e2b profile | 12 ✓ |
