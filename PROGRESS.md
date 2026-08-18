# 开发进度

> 跟踪 R0–R7 各阶段完成状态。

## 当前状态:108 passed + 1 skipped,14 包 + VS Code compile-client 0 错误 + 10 集成文件

### 里程碑:R0-R7 全部阶段内核侧 + VS Code 侧集成文件完成

### VS Code Fork: 10 集成文件(全部编译到 out/,0 错误)
| 文件 | 阶段 | 作用 |
|---|---|---|
| agentHostSpawner.ts | R0 | UtilityProcess + MessageChannelMain |
| app.ts (侵入) | R0 | spawnAgentHost before openFirstWindow |
| preload.ts | R0 | IPC → globalThis port |
| agentHostIntegration.ts | R0 | Workbench Restored → IdeBridge |
| agent-view-state.ts | R5 | 状态机(VS Code-local) |
| agentViewBinding.ts | R5 | AgentViewService(UI 绑定) |
| provenanceIntegration.ts | R2 | BulkEditService 装饰器 |
| sessionLogSpine.ts | R3 | timeline/task-tree/replay |
| editorAsToolHandler.ts | R4 | editor open/showDiff/setLayout |
| extensionBridge.ts | R6 | EhToAh + AhToEh 桥 |
| cloudExecution.ts | R7 | 执行世界切换 + profile patch |

### 各阶段完成度
| 阶段 | 内核侧 | VS Code 侧 | 测试 |
|---|---|---|---|
| R0 | ✅ | ✅ compile 0 错误 | 35 ✓ |
| R1 | ✅ | ✅ terminal+approval | 8 ✓ |
| R2 | ✅ | ✅ provenance 装饰器 | 6 ✓ |
| R3 | ✅ | ✅ sessionLogSpine | 15 ✓ |
| R4 | ✅ | ✅ editorAsToolHandler | 5 ✓ |
| R5 | ✅ | ✅ view binding+state | 13 ✓ |
| R6 | ✅ | ✅ extensionBridge | 9 ✓ |
| R7 | ✅ | ✅ cloudExecution | 12 ✓ |

## 总结
**R0-R7 全部阶段:内核侧(14 包) + VS Code 侧(10 集成文件)全部完成。**
**VS Code compile-client 0 错误。108 passed + 1 skipped。**
**10 个集成文件编译到 out/,可运行。**
