# Ultimate Native IDE

> 一个开放的 AI native IDE 设计方案:fork VS Code(深度侵入)+ DeepSeek Harness(DSH)agent 内核深度融合。
>
> **编辑器是脸、扩展是手、DSH agent loop 是脑,三者深度融合为一个 body——native 不让步,生态不丢失,开放是脊柱。**

## 这是什么

一套完整的设计与工程方案,回答一个问题:

> 如何把 DSH(开放的 agent 内核)和 VS Code(开放生态的 IDE)结合,打造一个**终极版**的 AI native IDE?

结论不是"把心脏装进别人的身体",也不是"分别 fork 各自适配再桥接",而是:

> **Fork VS Code(深度、侵入式),把 DSH 的 agent-loop 作为内核层深度融合进去。** DSH 不作独立产品 fork,而以可追踪上游的 vendored 包群成为这个 fork 的「agent 内核层」。agent-loop 是调度内核,编辑器/工作台降为它的面与工具。

## 仓库定位

本仓库当前是**设计文档阶段**——架构、设计、实现三份正式方案,加四份演进推导。代码实现(R0 起)将在此仓库推进。

## 文档导航

### 正式方案(三件套)

| 文档 | 回答 | 路径 |
|---|---|---|
| **架构文档** | 系统长什么样:进程拓扑、四大深度融合、组件边界、深合约、数据流、不变量 | [docs/01-architecture.md](docs/01-architecture.md) |
| **设计方案** | 产品是什么样:native 四判据、交互范式、形态、能力矩阵、四可换护城河、差异化 | [docs/02-design.md](docs/02-design.md) |
| **实现方案** | 怎么落地:仓库组织、技术决策、R0–R7 八阶段、测试策略、风险缓解 | [docs/03-implementation.md](docs/03-implementation.md) |

### 演进推导(思路如何走到终极版)

| 文档 | 阶段 | 路径 |
|---|---|---|
| 从 DSH 长身体 | 纯 native 路线(丢生态) | [docs/12-grow-from-dsh.md](docs/12-grow-from-dsh.md) |
| 寄生式架构 | 薄 fork + 神经替换(成本驱动) | [docs/11-parasitic-architecture.md](docs/11-parasitic-architecture.md) |
| 产品策略 | 双轨交付/四可换/云执行 | [docs/13-product-strategy.md](docs/13-product-strategy.md) |
| 终极版重设计 | 不计成本,深度融合 | [docs/10-ultimate-redesign.md](docs/10-ultimate-redesign.md) |

## 核心架构一览

```
electron-main
 ├─ renderer(工作台:Monaco/UI/文档模型/面板)
 │    ▲ 深合约(共享 TS 类型 + MessagePort RPC)
 ├─ Agent Host(DSH 内核:agent-loop/tools/fs/lsp/terminal/sandbox/session)◄─► Extension Host(5万扩展)
 │    └─ sandboxed 子进程(bash/pty/lsp,local 或 e2b 云端)
```

**四大深度融合:**
1. **单一执行世界** — VS Code 的 fs/terminal/process 后端替换为 DSH `ctx.*`
2. **文档模型共用 + provenance** — agent edit 走 VS Code `BulkEditService`,加来源记账接 session log
3. **session log 为事实之源脊柱** — 会话是项目工作记忆,可重放/分支/恢复
4. **agent 驱动工作台** — agent 能 open/reveal/showDiff/setLayout,主动编排 UI

## native 四判据(设计宪法)

1. agent loop 是调度内核——agent 能主动发起动作
2. session log 是事实之源——会话是工作记忆,非聊天记录
3. 单一执行世界——人/agent 同一个终端、文件、诊断
4. 编辑器是 agent 的工具也是人的审查面——双身份同写一个副本

## 护城河

**native + 开放 + 执行可迁移**,三者互锁:
- native:DSH agent loop 为内核
- 开放:模型/执行/工具/能力四可换
- 执行可迁移:DSH 执行世界挂 e2b 即整体迁云(agent 的手伸到云端,脸还在编辑器)——Cursor/Windsurf 架构上做不到

## 第一步(R0.1)

fork microsoft/vscode → subtree 引入 deepseek-harness → 建 `contracts` 深合约包 → UtilityProcess 拉起 Agent Host → Workbench.startup 注入。

## License

MIT
