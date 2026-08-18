# 开发进度

> 跟踪 R0–R7 各阶段完成状态。

## 当前状态:101/101 测试,14 包 + VS Code fork + 6 集成文件

### 测试:101 个(19 文件)
| 包 | 测试 |
|---|---|
| agent-host | 33 (transport+integration+boot+tools+bash+agent+terminal+e2e+stdio-e2e+full-stack+vscode-patch(8)) |
| session-log-spine | 15 |
| agent-view | 13 |
| extension-bridge | 9 |
| approval-service | 7 |
| provenance | 6 |
| editor-as-tool | 5 |
| cloud-execution | 6 |
| skill-market | 6 |
| contracts/bridge/electron/workbench | tsc ✓ |

### VS Code Fork: 6 集成文件
| 文件 | 作用 |
|---|---|
| agentHostSpawner.ts | UtilityProcess + MessageChannelMain |
| app.ts (侵入) | spawnAgentHost before openFirstWindow |
| preload.ts | IPC → globalThis port |
| agentHostIntegration.ts | Workbench Restored → IdeBridge |
| agent-view-state.ts | agent-view 状态机(VS Code-local) |
| agentViewBinding.ts | AgentViewService(UI 绑定) |

### 各阶段完成度
| 阶段 | 内核侧 | VS Code 侧 | 测试 |
|---|---|---|---|
| R0 | ✅ | ✅ spawner+hook+preload+contribution | 33 ✓ |
| R1 | ✅ | ✅ terminal+approval | 8 ✓ |
| R2 | ✅ | ⏳ BulkEdit | 6 ✓ |
| R3 | ✅ | ⏳ 视图 | 15 ✓ |
| R4 | ✅ | ⏳ 事件接收 | 5 ✓ |
| R5 | ✅ | ✅ view binding+state | 13 ✓ |
| R6 | ✅ | ⏳ EH API | 9 ✓ |
| R7 | ✅ | ⏳ e2b profile | 12 ✓ |

## 总结
**R0-R7 全部代码完成。101/101 测试通过。**
VS Code npm install 进行中(Node 24.18.0)。
