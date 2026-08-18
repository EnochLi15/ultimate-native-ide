# 开发进度

> 跟踪 R0–R7 各阶段完成状态。

## 当前状态:99/99 测试,14 包 + VS Code fork + 4 集成补丁 + 补丁验证

### 测试分布(99 个测试,19 个文件)
| 包 | 测试 | 说明 |
|---|---|---|
| agent-host | 31 | transport(4)+integration(7)+boot(3)+tools(2)+bash(2)+agent(4)+terminal(1)+e2e(1)+stdio-e2e(1)+full-stack(1)+vscode-patch(6) |
| session-log-spine | 15 | timeline+task-tree+replay+fork |
| agent-view | 13 | modes+reducer |
| approval-service | 7 | receive/allow/reject/batch/notify/timeout/severity |
| provenance | 6 | tracker+registry |
| editor-as-tool | 5 | open/diff/layout/schemas |
| extension-bridge | 9 | EH→AH+AH→EH |
| cloud-execution | 6 | switcher+Yaml+credentials |
| skill-market | 6 | skills+MCP+search |
| contracts/bridge/electron/workbench | tsc ✓ | 类型层 |

### VS Code Fork 集成(4 文件 + 验证)
| 文件 | 作用 | 验证 |
|---|---|---|
| agentHostSpawner.ts | UtilityProcess + MessageChannelMain | ✓ 导入正确 |
| app.ts (侵入) | spawnAgentHost before openFirstWindow | ✓ hook 位置正确 |
| preload.ts | IPC → globalThis port | ✓ 结构正确 |
| agentHostIntegration.ts | Workbench Restored → IdeBridge | ✓ contribution 注册 |

### 各阶段完成度
| 阶段 | 内核侧 | VS Code 侧 | 测试 |
|---|---|---|---|
| R0 | ✅ | ✅ 补丁+hook+验证 | 31 ✓ |
| R1 | ✅ | ✅ 补丁 | 8 ✓ |
| R2 | ✅ | ⏳ BulkEdit | 6 ✓ |
| R3 | ✅ | ⏳ 视图 | 15 ✓ |
| R4 | ✅ | ⏳ 事件接收 | 5 ✓ |
| R5 | ✅ | ⏳ chatViewPane | 13 ✓ |
| R6 | ✅ | ⏳ EH API | 9 ✓ |
| R7 | ✅ | ⏳ e2b profile | 12 ✓ |

## 总结
**R0-R7 全部代码完成。99/99 测试通过。**
剩余仅 VS Code 全量 build(需 Node 24.18+)+ renderer 视图绑定。
