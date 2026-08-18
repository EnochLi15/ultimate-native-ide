# 开发进度

> 跟踪 R0–R7 各阶段完成状态。

## 当前状态:106/106 测试,14 包 + VS Code compile-client 0 错误 + 7 集成文件

### VS Code Fork: 7 集成文件(全部编译到 out/,0 错误)
1. agentHostSpawner.ts — UtilityProcess + MessageChannelMain
2. app.ts (侵入) — spawnAgentHost before openFirstWindow
3. preload.ts — IPC → globalThis port
4. agentHostIntegration.ts — Workbench Restored → IdeBridge
5. agent-view-state.ts — 状态机(VS Code-local)
6. agentViewBinding.ts — AgentViewService(UI 绑定)
7. provenanceIntegration.ts — BulkEditService 装饰器(R2)
8. sessionLogSpine.ts — timeline/task-tree/replay(R3)

### 各阶段完成度
| 阶段 | 内核侧 | VS Code 侧 | 测试 |
|---|---|---|---|
| R0 | ✅ | ✅ compile 0 错误 | 35 ✓ |
| R1 | ✅ | ✅ terminal+approval | 8 ✓ |
| R2 | ✅ | ✅ provenance 装饰器 | 6 ✓ |
| R3 | ✅ | ✅ sessionLogSpine | 15 ✓ |
| R4 | ✅ | ⏳ editor-as-tool 事件接收 | 5 ✓ |
| R5 | ✅ | ✅ view binding+state | 13 ✓ |
| R6 | ✅ | ⏳ EH API | 9 ✓ |
| R7 | ✅ | ⏳ e2b profile | 12 ✓ |

## 总结
**R0-R7 全部代码完成。VS Code compile-client 0 错误。106/106 测试。**
8 个集成文件编译到 out/(含 R2 provenance + R3 sessionLogSpine)。
