# 开发进度

> 跟踪 R0–R7 各阶段完成状态。每阶段须满足 native 性验收才进下一阶段。

## R0 内核就位 — 进行中

| 子步 | 状态 | 说明 |
|---|---|---|
| R0.1 contracts 深合约包 | ✅ 完成 | `packages/contracts`:brand/ids/agent/session/fs/tools/rpc,tsc 通过 |
| R0.2 agent-host 骨架 | ✅ 完成 | `packages/agent-host`:transport + rpc-server(实现 AgentHostApi)+ dsh-boot seam + main 入口,tsc 通过 |
| R0.3 ide-bridge-renderer | ✅ 完成 | `packages/ide-bridge-renderer`:IdeBridge 类型代理客户端,tsc 通过 |
| ✅ 深合约闭环验证 | ✅ 完成 | 11/11 测试通过(4 transport + 7 integration),vitest 框架就绪 |
| R0.4 Workbench 注入 | ⏳ 待做 | 需 fork VS Code + electron-main UtilityProcess 拉起 AH |
| R0.5 真实 DSH boot + 验证 | ⏳ 待做 | 需 vendor/build DSH + 实现 bootDsh 真实 Cordis 树加载 |

### 已验证的命门
- **深合约类型对齐**:三包(contracts/agent-host/ide-bridge-renderer)共享类型,tsc 全绿,漂移在编译期暴露
- **RPC 神经功能成立**:renderer→transport→server→kernel 调用往返、事件流、错误传播,集成测试 11/11 通过

### 下一轮重点
1. **fork VS Code**:将 microsoft/vscode fork 引入(或作为 separate branch + subtree 合并 packages)
2. **vendor/build DSH**:`git subtree add` deepseek-harness → `pnpm install` → `pnpm run build`
3. **实现真实 bootDsh**:加载 dsh-base bundle,挂载 ctx.agents/tools/fs/llm/sandbox/session,事件转发
4. **electron-main 拉起 AH**:UtilityProcess + MessageChannelMain,workspaceRoot 传入
5. **Workbench.startup 注入**:注册 IdeBridge 为工作台服务

## R1–R7 — 待 R0 完成后推进

| 阶段 | 状态 |
|---|---|
| R1 执行世界融合 | ⏳ |
| R2 文档融合 + provenance | ⏳ |
| R3 session log 脊柱 | ⏳ |
| R4 agent 驱动工作台 | ⏳ |
| R5 原生 agent 面 | ⏳ |
| R6 双向扩展桥 | ⏳ |
| R7 云端执行 + 开放生态 | ⏳ |
