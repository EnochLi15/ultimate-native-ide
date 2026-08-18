# 开发进度

> 跟踪 R0–R7 各阶段完成状态。每阶段须满足 native 性验收才进下一阶段。

## 当前状态:35/35 测试通过,8 个包

| 包 | 阶段 | 状态 | 验证 |
|---|---|---|---|
| contracts | R0.1 | ✅ | tsc ✓ |
| agent-host | R0.2+R0.5+R1 | ✅ | 24 测试 ✓ (boot+fs+tools+bash+agent+terminal+e2e) |
| ide-bridge-renderer | R0.3 | ✅ | tsc ✓ |
| electron-main-agent-host | R0.4 | ✅ 代码 | tsc ✓ (待 VS Code fork 应用) |
| workbench-bridge | R0.4 | ✅ 代码 | tsc ✓ (待 VS Code fork 应用) |
| editor-as-tool | R4 | ✅ | 5 测试 ✓ |
| provenance | R2 | ✅ | 6 测试 ✓ |

## R0 内核就位 — 100% 验证完成

| 子步 | 状态 |
|---|---|
| R0.1 contracts | ✅ |
| R0.2 agent-host (boot+RPC+CLI) | ✅ |
| R0.3 ide-bridge-renderer | ✅ |
| R0.4 electron-main + workbench | ✅ 代码 (待 VS Code 应用) |
| R0.5 真实 DSH boot + ctx.fs | ✅ |
| R0 工具/会话/事件 (25 tools + bash) | ✅ |
| R0 agent 生命周期 | ✅ |
| R0 e2e 真实内核全路径 | ✅ |
| R0 CLI 独立进程 | ✅ |

## R1 执行世界融合 — 内核侧完成

| 子步 | 状态 |
|---|---|
| ctx.fs (resolve/stat/read/write/edit/list) | ✅ |
| ctx.tools (25 tools, bash 执行) | ✅ |
| ctx.terminals (PTY spawn/send/read/close) | ✅ |
| ctx.sessions (事件查询 + 实时转发) | ✅ |
| sandbox + approval (profile 自带) | ✅ |
| VS Code 侧接入 (IFileService/ITerminalBackend 代理) | ⏳ 待 fork |

## R2 文档融合 + provenance — 内核侧完成

| 子步 | 状态 |
|---|---|
| provenance 数据模型 + tracker | ✅ |
| agent/human/extension 编辑溯源 | ✅ |
| BulkEditService 接入 + session log | ⏳ 待 VS Code fork |

## R4 agent 驱动工作台 — 工具集完成

| 子步 | 状态 |
|---|---|
| editor-as-tool (open/showDiff/setLayout/presentPlan) | ✅ |
| VS Code 侧事件接收 + API 调用 | ⏳ 待 VS Code fork |

## R3/R5/R6/R7 — 待 VS Code fork

| 阶段 | 状态 | 内核侧准备 |
|---|---|---|
| R3 session log 脊柱 | ⏳ | ctx.sessions live,provenance live |
| R5 原生 agent 面 | ⏳ | chatViewPane 替换点已确认 |
| R6 双向扩展桥 | ⏳ | EH↔AH 桥接点已确认 |
| R7 云端执行 + 开放生态 | ⏳ | e2b 已确认可迁云 |

## 下一步
所有不依赖 VS Code fork 的内核侧工作已完成。剩余 R3-R7 的 VS Code 侧
接入需要 fork microsoft/vscode (1.7GB) 并应用集成模块。
