# 开发进度

> 跟踪 R0–R7 各阶段完成状态。每阶段须满足 native 性验收才进下一阶段。

## R0 内核就位 — 接近完成

| 子步 | 状态 | 说明 |
|---|---|---|
| R0.1 contracts 深合约包 | ✅ 完成 | `packages/contracts`:brand/ids/agent/session/fs/tools/rpc,tsc 通过 |
| R0.2 agent-host 骨架 | ✅ 完成 | `packages/agent-host`:transport + rpc-server + dsh-boot seam + main,tsc 通过 |
| R0.3 ide-bridge-renderer | ✅ 完成 | `packages/ide-bridge-renderer`:IdeBridge 类型代理,tsc 通过 |
| ✅ 深合约闭环验证 | ✅ 完成 | 11/11 测试(4 transport + 7 integration),vitest 就绪 |
| R0.5 真实 DSH boot + 验证 | ✅ 完成 | vendor/dsh subtree + build;bootDsh 真实实现;8/8 boot+fs 验证;14/14 全测试 |
| R0.4 Workbench 注入 | ⏳ 待做 | 需 fork VS Code + electron-main UtilityProcess 拉起 AH |

### 已验证的命门
1. **深合约类型对齐**:三包共享类型,tsc 全绿,漂移编译期暴露 ✓
2. **RPC 神经功能**:renderer→transport→server→kernel 往返/事件流/错误传播,11/11 ✓
3. **真实 DSH 内核 boot**:agent-host profile 加载 dsh-base,ctx.fs live(resolve/stat/list),8/8 ✓

### 下一轮重点
1. **fork VS Code**:引入 microsoft/vscode 源码
2. **electron-main 拉起 AH**:UtilityProcess + MessageChannelMain,workspaceRoot 传入
3. **Workbench.startup 注入**:注册 IdeBridge 为工作台服务
4. **R0 完整验收**:renderer 调 ctx.tools.bash 跑命令,结果回显终端面板

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
