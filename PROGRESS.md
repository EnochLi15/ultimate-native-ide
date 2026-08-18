# 开发进度

> 跟踪 R0–R7 各阶段完成状态。每阶段须满足 native 性验收才进下一阶段。

## 当前状态:57/57 测试通过,10 个包

| 包 | 阶段 | 测试 | 说明 |
|---|---|---|---|
| contracts | R0.1 | tsc ✓ | 深合约类型层 |
| agent-host | R0.2+R0.5+R1 | 24 ✓ | boot+fs+tools+bash+agent+terminal+e2e+CLI |
| ide-bridge-renderer | R0.3 | tsc ✓ | RPC 客户端 |
| electron-main-agent-host | R0.4 | tsc ✓ | 进程拉起(待 VS Code 应用) |
| workbench-bridge | R0.4 | tsc ✓ | 工作台注入(待 VS Code 应用) |
| editor-as-tool | R4 | 5 ✓ | agent 驱动 UI 工具集 |
| provenance | R2 | 6 ✓ | 编辑溯源 |
| session-log-spine | R3 | 15 ✓ | 时间线/任务树/重放投影 |
| approval-service | R1.6 | 7 ✓ | 人机审批契约 |

## 各阶段完成度

### R0 内核就位 — 100%
contracts ✓ + agent-host ✓ + bridge ✓ + electron-main/workbench(代码) ✓
+ 真实 DSH boot ✓ + tools(25)+bash ✓ + agent lifecycle ✓ + e2e ✓ + CLI ✓

### R1 执行世界融合 — 内核侧 100%
ctx.fs ✓ + ctx.tools(bash) ✓ + ctx.terminals(PTY) ✓ + ctx.sessions ✓
+ sandbox/approval(profile 自带) ✓ + approval-service ✓
+ VS Code 侧接入(IFileService/ITerminalBackend 代理) ⏳ 待 fork

### R2 文档融合 + provenance — 内核侧 100%
provenance 数据模型 + tracker ✓ + BulkEditService 接入 ⏳ 待 fork

### R3 session log 脊柱 — 投影层 100%
timeline ✓ + task-tree ✓ + replay ✓ + fork/resume ✓
+ renderer 视图渲染 ⏳ 待 VS Code fork

### R4 agent 驱动工作台 — 工具集 100%
editor-as-tool(open/showDiff/setLayout/presentPlan) ✓
+ VS Code 侧事件接收 ⏳ 待 fork

### R5/R6/R7 — 待 VS Code fork
- R5 原生 agent 面:chatViewPane 替换点已确认
- R6 双向扩展桥:EH↔AH 桥接点已确认
- R7 云端执行:e2b 已确认可迁云

## 总结
所有不依赖 VS Code fork 的内核侧 + 投影层 + 工具层工作已完成(57/57 测试)。
10 个包覆盖 R0-R4 + R1.6 + R3 的全部非 VS Code 代码。
剩余:fork microsoft/vscode 并应用集成模块 + renderer 侧视图渲染。
