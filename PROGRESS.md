# 开发进度

> 跟踪 R0–R7 各阶段完成状态。每阶段须满足 native 性验收才进下一阶段。

## 当前状态:58/58 测试,10 包 + VS Code fork + app.ts 侵入 hook

### 测试分布
| 包 | 测试 | 说明 |
|---|---|---|
| agent-host | 25 | transport(4) + integration(7) + boot(3) + tools(2) + bash(2) + agent(4) + terminal(1) + e2e(1) + stdio-e2e(1) |
| session-log-spine | 15 | timeline(3) + task-tree(4) + replay(4) + fork(4) |
| approval-service | 7 | receive/allow/reject/allowAll/notify/autoDeny/severity |
| provenance | 6 | tracker(4) + registry(2) |
| editor-as-tool | 5 | open/diff/layout/schemas(2) |
| contracts | tsc ✓ | 类型层 |
| ide-bridge-renderer | tsc ✓ | RPC 客户端 |
| electron-main-agent-host | tsc ✓ | 独立包 |
| workbench-bridge | tsc ✓ | 独立包 |

### VS Code Fork 集成
| 集成点 | 文件 | 状态 |
|---|---|---|
| electron-main spawner | `vendor/vscode/src/vs/platform/ultimateNative/electron-main/agentHostSpawner.ts` | ✅ |
| app.ts hook | `vendor/vscode/src/vs/code/electron-main/app.ts` (侵入修改) | ✅ |
| preload bridge | `vendor/vscode/src/vs/platform/ultimateNative/sandbox/preload.ts` | ✅ |
| workbench contribution | `vendor/vscode/src/vs/workbench/contrib/ultimateNative/agentHostIntegration.ts` | ✅ |
| stdio 进程验证 | `packages/agent-host/tests/stdio-e2e.test.ts` | ✅ 58/58 |

## 各阶段完成度

| 阶段 | 内核侧 | VS Code 侧 | 验证 |
|---|---|---|---|
| R0 内核就位 | ✅ 100% | ✅ 补丁+hook | ✅ 58/58 + stdio e2e |
| R1 执行世界融合 | ✅ fs+tools+terminal+approval | ⏳ IFileService/ITerminalBackend 代理 | ✅ 内核侧 |
| R2 文档融合 | ✅ provenance | ⏳ BulkEditService 接入 | ✅ 内核侧 |
| R3 session log 脊柱 | ✅ 投影层 | ⏳ renderer 视图 | ✅ 15/15 |
| R4 agent 驱动工作台 | ✅ editor-as-tool | ⏳ 事件接收 | ✅ 5/5 |
| R5 原生 agent 面 | ⏳ | ⏳ chatViewPane 替换 | ⏳ |
| R6 双向扩展桥 | ⏳ | ⏳ EH↔AH 桥接 | ⏳ |
| R7 云端执行 | ⏳ e2b 可迁云 | ⏳ | ⏳ |

## 剩余工作
1. **VS Code 全量 build**:yarn install + compile(重型,需验证集成补丁编译通过)
2. **R5**:替换 chatViewPane 为原生 agent 面
3. **R6**:EH↔AH 双向能力桥
4. **R7**:e2b 云端执行 + skill/mcp 市场
