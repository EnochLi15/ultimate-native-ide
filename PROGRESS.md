# 开发进度

> 跟踪 R0–R7 各阶段完成状态。每阶段须满足 native 性验收才进下一阶段。

## R0 内核就位 — 代码完整,待 VS Code fork 应用

| 子步 | 状态 | 说明 |
|---|---|---|
| R0.1 contracts 深合约包 | ✅ | brand/ids/agent/session/fs/tools/rpc,tsc 通过 |
| R0.2 agent-host 骨架 | ✅ | transport + rpc-server + dsh-boot + main + cli,tsc 通过 |
| R0.3 ide-bridge-renderer | ✅ | IdeBridge 类型代理,tsc 通过 |
| R0.4 electron-main + workbench 集成 | ✅ 代码就位 | spawner + workbench-bridge,tsc 通过;待 VS Code fork 应用 |
| R0.5 真实 DSH boot | ✅ | vendor/dsh subtree + build;bootDsh 真实;8/8 boot+fs |
| ✅ 工具/会话/事件接入 | ✅ | listTools(25) + invokeTool(bash) + queryEvents + 事件转发 |
| ✅ agent 生命周期 | ✅ | create/idle/events/dispose,4/4 |
| ✅ 端到端 e2e | ✅ | real-loop.e2e: renderer→RPC→real DSH→bash,1/1 |
| ✅ CLI 独立进程 | ✅ | cli.ts + stdio-port;cli-verify 6/6 |

### 已验证的命门
1. **深合约类型对齐** ✓ — tsc 全绿
2. **RPC 神经功能** ✓ — 11/11(mock)+ 1/1(real e2e)
3. **真实 DSH 内核 boot + 驱动** ✓ — ctx.fs + ctx.tools(bash) + agent lifecycle
4. **独立进程** ✓ — CLI over stdio,6/6

**全测试 23/23** + CLI 独立验证 6/6

### Agent Host 当前能力(全部已验证)
- boot 真实 DSH Cordis 树(agent-host profile = dsh-base)
- ctx.fs: resolve/stat/read/write/edit/list
- ctx.tools: 25 个工具,含 bash(可执行命令返回 stdout)
- ctx.agents: create/resume/dispose/sendPrompt/cancel/awaitIdle
- ctx.sessions: 事件日志查询 + 实时事件转发
- 完整 RPC 神经:renderer → AgentHostApi → DshKernel → DSH ctx.*
- 可作为独立进程运行(CLI over stdio)

### R0.4 待完成:VS Code fork 应用
electron-main + workbench 集成代码已就位,需 fork VS Code 并应用:
1. fork microsoft/vscode
2. electron-main: 调用 spawnAgentHost() 拉起 AH UtilityProcess
3. Workbench.startup: 调用 createIdeBridgeService() 注册服务
4. 验收:renderer 调 ctx.tools.bash 跑命令回显终端面板

## R1–R7 — 待 R0.4 完成后推进

| 阶段 | 状态 | 内核侧准备 |
|---|---|---|
| R1 执行世界融合 | ⏳ | ctx.fs/ctx.tools 已 live,需 VS Code 侧接入 |
| R2 文档融合 + provenance | ⏳ | BulkEditService 管道已确认 |
| R3 session log 脊柱 | ⏳ | ctx.sessions 已 live |
| R4 agent 驱动工作台 | ⏳ | editor-as-tool 待写 |
| R5 原生 agent 面 | ⏳ | chatViewPane 替换点已确认 |
| R6 双向扩展桥 | ⏳ | EH↔AH 桥接点已确认 |
| R7 云端执行 + 开放生态 | ⏳ | e2b 已确认可迁云 |
