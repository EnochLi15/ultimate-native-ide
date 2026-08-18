# 终极 AI Native IDE —— 架构文档

> 基于 fork VS Code(深度侵入)+ DSH agent 内核深度融合。
> 本文档定义系统架构:进程拓扑、组件边界、深合约、数据流、不变量。
> 设计原则与产品视角见《设计方案》;可执行步骤见《实现方案》。

---

## 1. 设计立论与不变量

### 立论
fork VS Code(其价值是 Monaco+工作台+5万扩展+文档模型+LSP/DAP 的不可拆整体),把 DSH 的 agent-loop 作为内核层深度融合。DSH 不作独立产品 fork,而以可追踪上游的 vendored 包群成为 fork 的「agent 内核层」。

agent-loop(turn/step 状态机)是调度内核,能主动发起动作;编辑器/工作台降为它的面与工具。这是 native 与非 native 的唯一分水岭。

### 四条不变量(全架构推导自此)
1. **agent loop 是调度内核**:turn/step 决定下一步;人也是输入源之一,不是唯一驱动者。
2. **session log 是事实之源**:文件、编辑器状态、对话都从它派生或与它对齐;文件是 log 的检查点。
3. **单一执行世界**:fs/subprocess/terminal/lsp 一套归属(ctx.*),沙箱+审批贯穿;不分裂。
4. **编辑器是 agent 的工具,也是人的审查面**:双身份,agent 与人同写一个工作副本。

---

## 2. 进程拓扑

新增 Agent Host(AH)为一等进程,与 Extension Host(EH)平级但地位更高——它是内核,不是附属。

```
electron-main
 ├─ 拉起 renderer / agent-host / extension-host / shared-process
 │
 ├─ renderer(工作台)
 │   Monaco/壳/UI/文档模型/终端面板/问题面板
 │   ├─ ITextFileService/WorkingCopyService/BulkEditService(融合二)
 │   ├─ ITerminalBackend → 代理到 AH ctx.terminals(融合一)
 │   ├─ IFileService → 代理到 AH ctx.fs(融合一)
 │   └─ 原生 agent 面(替换 chat contrib)(融合四)
 │        ▲ 深合约(共享 TS 类型 + 结构化 RPC/MessagePort)
 │        │
 ├─ Agent Host(node, UtilityProcess)◄──────────────┐
 │   DSH Cordis 全树:                                │ 深合约
 │   ├─ agent-loop(turn/step/inject/cancel)         │
 │   ├─ ctx.tools(bash/grep/glob/edit/lsp/editor…)  │
 │   ├─ ctx.fs / ctx.subprocess / ctx.terminals     │
 │   ├─ ctx.lsp / ctx.llm / ctx.sandbox / ctx.approval
 │   ├─ ctx.sessions(append-only SessionEvent log)  │
 │   └─ capability seams(model/execution/skill/mcp) │
 │        │ 独占单一执行世界                          │
 │        ▼                                          │
 │   sandboxed 子进程: bash/pty/lsp-server/fs       │
 │   (local: landlock/ACL; 或 e2b 云端沙箱)         │
 │                                                   │
 └─ Extension Host(node) ►─ 双向能力桥 ──────────────┘
     跑全部 VS Code 扩展,vscode.* API
     贡献点:chatParticipants/languageModelChatProviders/languageModelTools/...
```

### 进程职责
| 进程 | 角色 | 来源 |
|---|---|---|
| electron-main | 进程主管,拉起 AH/EH/renderer | VS Code 留 |
| renderer | 工作台:编辑器/UI/文档模型/面板 | VS Code 留+改(服务代理、agent 面) |
| Agent Host | DSH 内核:agent-loop/tools/fs/lsp/terminal/sandbox/session | DSH vendored + 新包装 |
| Extension Host | VS Code 扩展运行时 | VS Code 留 |

### 为什么 AH 是独立进程(非 renderer 内)
- agent-loop 与工具执行是 CPU/IO 密集,独立进程不阻塞渲染。
- 单一执行世界的沙箱边界以进程为硬隔离,比同进程软沙箱可靠。
- 与 EH 平级,但 EH 调 AH 经深合约,不绕 renderer——避免「renderer 当中间人」的延迟与耦合。
- 复用 VS Code 已有的 utilityProcess + MessagePort 传输底座(已确认 `src/vs/platform/utilityProcess/electron-main/utilityProcess.ts`)。

---

## 3. 深合约(深融合的技术基础)

寄生/桥接版靠 ACP/JSON-RPC 薄协议猜形状;终极版因 fork 了,可**共享 TypeScript 类型**:

- 一个 `contracts` 包,从 DSH 导出 `Agent`/`AgentHandle`/`AgentFactory`/`SessionEvent`/`Tool`/`FsTarget` 等类型,从 VS Code 导出 `WorkspaceEdit`/`ITextModel`/`Uri` 等类型。
- renderer 与 AH 编译时类型对齐,运行时结构化 RPC(复用 EH 的 MessagePort + RPCProtocol 机制)。
- 类型漂移在 CI 类型检查阶段即暴露,不等到运行时。

> 深合约是「允许侵入」的红利兑现:不 fork 就只能薄协议;fork 了就能类型共享,融合才可靠。

### 深合约类型来源(已验证)
- DSH 侧:`packages/core/agent/src/index.ts:172` 的 `AgentHandle`、`AgentFactory`(createAgent/resume)、`Agent`(inject/cancel/step/turn)
- VS Code 侧:`WorkspaceEdit`、`ITextModel`、`Uri`、`MainThread*Shape` 协议
- 跨侧共享:经 `packages/contracts` 统一导出,renderer 与 AH 都 import 它

---

## 4. 四大深度融合

### 融合一:单一执行世界
VS Code 原生 fs/terminal/process/task 后端**替换**为 AH 的 ctx.*:

| VS Code 原生 | 替换为 | 效果 |
|---|---|---|
| IFileService 后端 | ctx.fs | explorer/搜索/保存全过沙箱 |
| ITerminalBackend | ctx.terminals | 人命令与 agent 命令同一 PTY 池 |
| Task/Debug adapter 启动 | ctx.subprocess | 编译/测试/调试在沙箱内,受审批 |
| LSP client 启动 | ctx.lsp(+ctx.subprocess) | 语言服务器同一执行世界,诊断人机一致 |

**边界**:VS Code 工作台自用 IO(settings/扩展存储/global storage)走 host-internal 旁路,标记非 workspace,绕过沙箱。

> 红利:agent 和人看到同一个诊断、终端、文件状态——构造性一致,不靠同步。且 ctx.fs/ctx.subprocess 挂 e2b 即整体迁云。

### 融合二:文档模型共用 + provenance
agent edit/write 走 VS Code 既有 `BulkEditService` + `ITextFileService`,不另建 ctx.documents:

- agent edit → WorkspaceEdit → `IBulkEditService.apply()` → 进 VS Code 文档模型
- 人键盘 → 同一 `ITextModel` → 同一 dirty/undo-redo
- agent 编辑享完整 undo/dirty/冲突检测/工作副本历史(`workingCopyHistoryService` 已存在)
- 落盘 `ITextFileService.save()` → 走 ctx.fs → 受沙箱/审批

**新增 provenance 层**:每次 WorkspaceEdit 携带 `initiator: 'agent'|'human'|'extension'` + agent step id,写入 session log。于是「这一行谁改的、哪个 turn」可查、可回放、可分支。

> 比「自建 ctx.documents」更好:白拿 VS Code 成熟模型,只加 provenance。命门解决,且更可靠。

### 融合三:session log 为事实之源脊柱
- DSH append-only `SessionEvent` log 成为工作台脊柱服务。
- 编辑 provenance、执行事件(终端/进程)、对话 turn/step、审批、plan/goal/todo 全 append 同一 log。
- 派生视图(都是 log 投影):时间线、任务树、分支/恢复(fork/resume)、重放。
- 文件是 log 的检查点,可重建某时刻文件树。

> 把「会话」从「侧栏聊天历史」提升为「项目的工作记忆」。Cursor 的对话历史是 UI 状态;这里是内核事实之源。

### 融合四:agent 驱动工作台
新增 editor-as-tool(agent 工具,作用于工作台状态):

| 工具 | 作用 |
|---|---|
| editor.open(path,range?) | 打开文件/定位 |
| editor.reveal(range) | 高亮一段 |
| editor.applyEdit(workspaceEdit) | 应用编辑(走融合二管道) |
| editor.showDiff(before,after) | 弹 diff 审查 |
| terminal.focus(sessionId) | 聚焦终端 |
| workbench.setLayout(...) | 切布局 |
| plan.present(plan) | 展示计划等审批 |

agent 能编排工作区状态——主动权在 agent,控制权在人。

---

## 5. 组件边界与归属

| 组件 | 来源 | 处置 |
|---|---|---|
| Monaco 编辑器 | VS Code | 留 |
| 工作台壳(文件树/problems/palette/settings/布局) | VS Code | 留,消费融合后服务 |
| 文档模型(ITextFileService/WorkingCopy/BulkEdit) | VS Code | 留+增权(provenance+log) |
| 扩展+EH+vscode.* API | VS Code | 留,全兼容 |
| LSP/DAP 客户端框架 | VS Code | 留框架,后端切统一执行世界 |
| 终端面板 UI | VS Code | 留 UI,后端换 ctx.terminals |
| Chat contrib view | VS Code | 替换为原生 agent 面 |
| fs/terminal/process 后端 | VS Code 原生 | 替换为 ctx.* |
| agent-loop | DSH | 新内核 |
| tools registry(bash/grep/glob/edit/lsp…) | DSH | 新 |
| session log+fork/resume/replay | DSH | 新脊柱 |
| sandbox+approval+policy | DSH | 新,贯穿执行世界 |
| capability seams(model/execution/skill/mcp) | DSH | 新,四可换 |
| subagent/workflow/goal/plan/todo | DSH | 新 |
| editor-as-tool 集 | 新写 | 新 |
| Agent Host 进程+深合约 | 新写 | 新 |
| EH↔AH 双向能力桥 | 新写 | 新 |

---

## 6. 数据流(端到端示例)

用户在 agent 面输入「重构 foo.ts 的 bar 函数」:

1. agent 面经深合约调 AH `ctx.agents.createAgent(prompt, cwd)`
2. AH 起 agent,进 agent-loop(turn/step)
3. step:模型经 ctx.llm 请求 → 返回要调 grep/glob
4. ctx.tools 调 grep(经 ctx.fs 沙箱)→ 找到 foo.ts → 读
5. 模型决定 edit → ctx.tools['edit'] → 转 WorkspaceEdit(+provenance)→ BulkEditService.apply()
6. renderer 文档模型实时 dirty,Monaco 显示改动;session log 记 step/tool/edit
7. agent 调 editor.reveal(range)→ 工作台跳到改动行(融合四)
8. 若需跑测试 → ctx.tools['bash'] → ctx.terminals → 终端面板可见
9. 文本流经深合约回 agent 面,实时渲染;终态写 session log

---

## 7. 不变量校验机制

- **单一执行世界**:CI 断言 workspace 内文件操作无第二条路径(无直接 fs API 调用,全经 ctx.fs 代理)。
- **model-visible 即 logged**:沿用 DSH 不变量——任何进模型请求的可从 log 重建;runtime 有断言。
- **provenance 完整**:每条 WorkspaceEdit 必带 initiator+step id,缺失即测试失败。

---

## 8. EH↔AH 双向能力桥

**EH → AH(扩展贡献给 agent):**
- `registerLanguageModelChatProvider`(EH)→ 该模型进 `ctx.llm`(AH)
- `registerTool`/`registerLanguageModelTool`(EH)→ 进 `ctx.tools`(AH)
- `registerChatParticipant`(EH)→ 成 agent preset/persona
- LSP 贡献(EH)→ 语言智能进 `ctx.lsp`,人机共用
- `registerCommand`(EH)→ agent 可作为工具调用 VS Code 命令

**AH → EH(agent 贡献给扩展):**
- agent 的 bash/grep/glob/edit 等工具 → 暴露为 `LanguageModelTool`,让 Copilot/扩展也能调
- agent 的 session log → 扩展可查询(做 timeline 插件、统计等)
- agent 的 plan/goal → 扩展可订阅呈现

> 5 万扩展不只为「人」服务,也为「agent」服务——扩展生态价值被 native 内核放大。

---

## 9. 开放性(四可换,架构脊柱)

| seam | 可换 | 体现 |
|---|---|---|
| ctx.llm | 模型 | deepseek/pi-ai/可接 codex/claude-code |
| ctx.fs/ctx.subprocess | 执行环境 | local / e2b 云 / 远程,一键迁云 |
| ctx.tools | 工具 | 裁剪/扩展,dsh-plugin 生态 |
| ctx.skills+ctx.mcp | 能力 | 技能市场、MCP server |

---

## 10. 一句话

> Fork VS Code(深度侵入),把 DSH 的 agent-loop 作为内核层深度融合:新增 Agent Host 一等进程独占单一执行世界,agent 编辑走 VS Code 既有文档模型并加 provenance 接上 session log 脊柱,agent 能主动驱动工作台 UI,chat contrib 被原生 agent 面替换,扩展经双向桥既服务人也服务 agent。**编辑器是脸、扩展是手、DSH agent loop 是脑,三者深度融合为一个 body——native 不让步,生态不丢失,开放是脊柱。**
