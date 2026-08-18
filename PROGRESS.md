# 开发进度

> 跟踪 R0–R7 各阶段完成状态。每阶段须满足 native 性验收才进下一阶段。

## 当前状态:57/57 测试,10 包 + VS Code fork 已 vendored

| 包 | 阶段 | 测试 | 说明 |
|---|---|---|---|
| contracts | R0.1 | tsc ✓ | 深合约类型层 |
| agent-host | R0.2+R0.5+R1 | 24 ✓ | boot+fs+tools+bash+agent+terminal+e2e+CLI |
| ide-bridge-renderer | R0.3 | tsc ✓ | RPC 客户端 |
| electron-main-agent-host | R0.4 | tsc ✓ | 进程拉起(独立包) |
| workbench-bridge | R0.4 | tsc ✓ | 工作台注入(独立包) |
| editor-as-tool | R4 | 5 ✓ | agent 驱动 UI 工具集 |
| provenance | R2 | 6 ✓ | 编辑溯源 |
| session-log-spine | R3 | 15 ✓ | 时间线/任务树/重放投影 |
| approval-service | R1.6 | 7 ✓ | 人机审批契约 |

## VS Code Fork (vendor/vscode) — 集成补丁已创建

3 个侵入式集成文件:
| 文件 | 作用 | 状态 |
|---|---|---|
| `src/vs/platform/ultimateNative/electron-main/agentHostSpawner.ts` | UtilityProcess 拉起 AH + MessageChannelMain | ✅ 代码就位 |
| `src/vs/platform/ultimateNative/sandbox/preload.ts` | IPC 接收 MessagePort → globalThis | ✅ 代码就位 |
| `src/vs/workbench/contrib/ultimateNative/agentHostIntegration.ts` | Workbench Restored 阶段 → IdeBridge 服务 | ✅ 代码就位 |

剩余 wiring(见 docs/vscode-fork-integration.md):
- ⏳ app.ts 调用 spawnAgentHost
- ⏳ preload bundle 合并
- ⏳ @ultimate-ide/* 包解析 wiring
- ⏳ 全量 electron build + 验证

## 各阶段完成度

| 阶段 | 内核侧 | VS Code 侧 |
|---|---|---|
| R0 内核就位 | ✅ 100% (23 测试) | ✅ 补丁代码 / ⏳ wiring |
| R1 执行世界融合 | ✅ 100% (fs+tools+terminal+approval) | ⏳ IFileService/ITerminalBackend 代理 |
| R2 文档融合 | ✅ provenance 数据模型 | ⏳ BulkEditService 接入 |
| R3 session log 脊柱 | ✅ 投影层(15 测试) | ⏳ renderer 视图渲染 |
| R4 agent 驱动工作台 | ✅ editor-as-tool(5 测试) | ⏳ 事件接收 + API 调用 |
| R5 原生 agent 面 | ⏳ | ⏳ chatViewPane 替换 |
| R6 双向扩展桥 | ⏳ | ⏳ EH↔AH 桥接 |
| R7 云端执行 | ⏳ e2b 可迁云 | ⏳ |
