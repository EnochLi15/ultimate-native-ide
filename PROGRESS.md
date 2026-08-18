# 开发进度

> 跟踪 R0–R7 各阶段完成状态。每阶段须满足 native 性验收才进下一阶段。

## R0 内核就位 — 核心验证完成,仅剩 Workbench 注入

| 子步 | 状态 | 说明 |
|---|---|---|
| R0.1 contracts 深合约包 | ✅ | `packages/contracts`:brand/ids/agent/session/fs/tools/rpc,tsc 通过 |
| R0.2 agent-host 骨架 | ✅ | transport + rpc-server + dsh-boot seam + main,tsc 通过 |
| R0.3 ide-bridge-renderer | ✅ | IdeBridge 类型代理,tsc 通过 |
| ✅ 深合约闭环验证 | ✅ | 11/11(transport + integration) |
| R0.5 真实 DSH boot | ✅ | vendor/dsh subtree + build;bootDsh 真实;8/8 boot+fs |
| ✅ R0 工具/会话/事件接入 | ✅ | listTools(25 工具)+ invokeTool(bash 执行)+ queryEvents + 事件转发 |
| R0.4 Workbench 注入 | ⏳ | 需 fork VS Code + electron-main UtilityProcess |

### 已验证的命门(三大基石全部成立)
1. **深合约类型对齐** ✓ — tsc 全绿,漂移编译期暴露
2. **RPC 神经功能** ✓ — 往返/事件流/错误传播 11/11
3. **真实 DSH 内核 boot + 驱动** ✓ — ctx.fs live + ctx.tools live(bash 执行验证)

**全测试 18/18**:4 transport + 7 integration + 3 boot + 2 tools + 2 bash

### Agent Host 当前能力(已验证)
- boot 真实 DSH Cordis 树(agent-host profile = dsh-base)
- ctx.fs: resolve/stat/read/write/edit/list
- ctx.tools: 25 个工具,含 bash(可执行命令返回 stdout)
- ctx.sessions: 事件日志查询
- session/event 实时转发到 renderer
- 完整 RPC 神经:renderer → AgentHostApi → DshKernel → DSH ctx.*

### 下一轮重点
R0 仅剩 R0.4(Workbench 注入)——需 fork VS Code。但 Agent Host 内核侧已 100% 验证。
可直接进入 R1(执行世界融合)的内核侧准备,或开始 VS Code fork。

## R1–R7 — 待 R0.4 完成后推进

| 阶段 | 状态 |
|---|---|
| R1 执行世界融合 | ⏳ 内核侧已就绪(ctx.fs/ctx.tools live) |
| R2 文档融合 + provenance | ⏳ |
| R3 session log 脊柱 | ⏳ |
| R4 agent 驱动工作台 | ⏳ |
| R5 原生 agent 面 | ⏳ |
| R6 双向扩展桥 | ⏳ |
| R7 云端执行 + 开放生态 | ⏳ |
