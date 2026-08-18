# 开发进度

> 跟踪 R0–R7 各阶段完成状态。每阶段须满足 native 性验收才进下一阶段。

## 当前状态:92/92 测试,14 包 + VS Code fork。R0-R7 全部阶段覆盖。

### 包总览(14 个包,92 个测试)

| 包 | 阶段 | 测试 | 说明 |
|---|---|---|---|
| contracts | R0.1 | tsc ✓ | 深合约类型层 |
| agent-host | R0.2+R0.5+R1 | 25 | boot+fs+tools+bash+agent+terminal+e2e+stdio-e2e |
| ide-bridge-renderer | R0.3 | tsc ✓ | RPC 客户端 |
| electron-main-agent-host | R0.4 | tsc ✓ | 进程拉起 |
| workbench-bridge | R0.4 | tsc ✓ | 工作台注入 |
| editor-as-tool | R4 | 5 | agent 驱动 UI 工具集 |
| provenance | R2 | 6 | 编辑溯源 |
| session-log-spine | R3 | 15 | 时间线/任务树/重放 |
| approval-service | R1.6 | 7 | 人机审批 |
| agent-view | R5 | 13 | 原生交互面(5 模式+状态机) |
| extension-bridge | R6 | 9 | 双向能力桥(EH↔AH) |
| cloud-execution | R7 | 6 | 云端执行世界(护城河) |
| skill-market | R7 | 6 | skill/MCP 市场(开放生态) |

### VS Code Fork
- vendor/vscode: squashed subtree (282M)
- 4 集成文件: spawner + app.ts hook + preload + workbench contribution
- stdio e2e 验证(模拟 utilityProcess.fork)

## 各阶段完成度

| 阶段 | 内核侧 | VS Code 侧 | 测试 |
|---|---|---|---|
| R0 内核就位 | ✅ 100% | ✅ 补丁+hook+stdio e2e | 25 ✓ |
| R1 执行世界融合 | ✅ 100% | ⏳ IFileService/ITerminalBackend 代理 | 8 ✓ |
| R2 文档融合 | ✅ provenance | ⏳ BulkEditService 接入 | 6 ✓ |
| R3 session log 脊柱 | ✅ 投影层 | ⏳ renderer 视图 | 15 ✓ |
| R4 agent 驱动工作台 | ✅ editor-as-tool | ⏳ 事件接收 | 5 ✓ |
| R5 原生 agent 面 | ✅ agent-view | ⏳ chatViewPane 替换 | 13 ✓ |
| R6 双向扩展桥 | ✅ extension-bridge | ⏳ EH API 拦截 | 9 ✓ |
| R7 云端执行+生态 | ✅ cloud-exec+skill-market | ⏳ e2b profile 接入 | 12 ✓ |

## 总结
**R0-R7 全部阶段的内核侧/投影层/工具层/视图层/桥接层/生态层代码完成。**
92/92 测试通过。14 个包覆盖完整架构。

剩余:VS Code fork 的全量 build + renderer 侧视图渲染 + EH API 拦接。
这些需要 VS Code 的 yarn install + compile(需 Node 24)并应用到 fork。
