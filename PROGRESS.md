# 开发进度

> 跟踪 R0–R7 各阶段完成状态。每阶段须满足 native 性验收才进下一阶段。

## 当前状态:71/71 测试,11 包 + VS Code fork + app.ts hook

### 测试分布(71 个测试,14 个文件)
| 包 | 测试 | 说明 |
|---|---|---|
| agent-host | 25 | transport+integration+boot+tools+bash+agent+terminal+e2e+stdio-e2e |
| session-log-spine | 15 | timeline+task-tree+replay+fork |
| agent-view | 13 | modes(3)+reducer(10) |
| approval-service | 7 | receive/allow/reject/batch/notify/timeout/severity |
| provenance | 6 | tracker+registry |
| editor-as-tool | 5 | open/diff/layout/schemas |
| contracts | tsc ✓ | 类型层(修复 ApprovalRequest.kind 冲突) |
| ide-bridge-renderer | tsc ✓ | RPC 客户端 |
| electron-main-agent-host | tsc ✓ | 独立包 |
| workbench-bridge | tsc ✓ | 独立包 |

### VS Code Fork
- vendor/vscode: squashed subtree (282M)
- 4 个集成文件: spawner + app.ts hook + preload + workbench contribution
- stdio e2e 验证(模拟 utilityProcess.fork)

## 各阶段完成度

| 阶段 | 内核侧 | VS Code 侧 | 验证 |
|---|---|---|---|
| R0 内核就位 | ✅ | ✅ 补丁+hook+stdio e2e | ✅ 25 |
| R1 执行世界融合 | ✅ fs+tools+terminal+approval | ⏳ | ✅ |
| R2 文档融合 | ✅ provenance | ⏳ | ✅ 6 |
| R3 session log 脊柱 | ✅ 投影层 | ⏳ | ✅ 15 |
| R4 agent 驱动工作台 | ✅ editor-as-tool | ⏳ | ✅ 5 |
| R5 原生 agent 面 | ✅ agent-view(模式+状态机) | ⏳ chatViewPane 替换 | ✅ 13 |
| R6 双向扩展桥 | ⏳ | ⏳ EH↔AH | ⏳ |
| R7 云端执行 | ⏳ e2b | ⏳ | ⏳ |

## 关键修复
- ApprovalRequest.kind → approvalKind: 修复与 AgentHostEvent union kind 判别式冲突
  (TS 将 'bash'|... ∩ 'approval-request' = never,丢弃 union member)
