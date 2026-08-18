# 终极 AI Native IDE —— 重新设计

> 约束已变:允许 fork、允许侵入修改、不为降本/快速出临时版妥协。
> 目标唯一:最好用的、终极版 AI native IDE。
> 本文档推翻前几版的成本驱动妥协,从「谁当内核」重新推导。

---

## 0. 先回答那个被前提束缚的问题

> 「分别 fork 二者各做适配层独立演进再插件结合」——否。
> 「基于一个 fork 把一个装进另一个」——方向对,但「装」的程度不够。

**正确答案:fork VS Code(深度、侵入式),把 DSH 的 agent 核心作为内核层深度融合进去。DSH 不作为独立产品 fork,而是以可追踪上游的 vendored 包群成为这个 fork 的「agent 内核层」。** 之前的「薄 fork + 独立适配层」是成本妥协,现在撤掉。

为什么是 fork VS Code 而非 fork DSH:
- VS Code 的价值是一个**不可拆的整体**——Monaco + 工作台 + 5 万扩展 + 文档模型 + LSP/DAP 集成。拆开即失值。
- DSH 的价值是**凝聚的内核**——agent loop / tools / sandbox / session / capability seams,可作为一个层注入。
- 所以:把凝聚的内核注入那个不可拆的整体。方向是「DSH 内核 → VS Code fork」,不是反过来。

但「装进去」要装到什么程度,才是本设计的核心命题。答案:**不是装成一层服务,是装成内核本身。**

---

## 1. 设计论点:反转谁当内核

这是 native 与非 native 的唯一分水岭。

| | VS Code 现状 | 终极 native IDE |
|---|---|---|
| 内核 | 编辑器/工作台事件循环 | **agent loop(turn/step 状态机)** |
| 调度 | 用户事件驱动「下一步」 | turn/step 决定下一步;人也是输入源之一 |
| chat | contrib(侧栏 view) | **一等公民**,与编辑器对等的主动面 |
| 事实之源 | 文件系统 | **session log**(文件是其投影/检查点) |
| 执行世界 | 工作台一套 + 扩展一套,无沙箱 | **单一沙箱执行世界**,人/agent 共用 |
| agent | Copilot 的浅补全 | **可主动驱动工作台**的执行主体 |

> 四条不变量,全设计由此推导:
> 1. **agent loop 是调度内核**——它不只是被调用的服务,它能主动发起动作。
> 2. **session log 是事实之源**——文件、编辑器状态、对话都从它派生或与它对齐。
> 3. **单一执行世界**——fs/subprocess/terminal/lsp 一套,沙箱+审批贯穿。
> 4. **编辑器是 agent 的工具,也是人的审查面**——双身份,同写一个工作副本。

---

## 2. 进程拓扑:Agent Host 作为一等进程

VS Code 现有进程:`electron-main` / `renderer`(工作台)/ `extension-host`(node)/ `shared-process` / `utility-process`。

**新增一个一等进程 `Agent Host`(node),与 Extension Host 平级,但地位更高——它是内核,不是附属:**

```
┌──────────────────────────────────────────────────────────────────┐
│  electron-main                                                    │
│   └─ 拉起 renderer / agent-host / extension-host / shared         │
└──────────────────────────────────────────────────────────────────┘
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐   ┌──────────────────┐   ┌──────────────────┐
│  renderer     │   │  Agent Host (新) │   │  Extension Host  │
│  (工作台)     │   │  DSH Cordis 全树 │   │  (跑 5 万扩展)   │
│  Monaco/壳/UI │◄─►│  agent-loop      │◄─►│  vscode.* API    │
│  文档模型     │深 │  ctx.tools/fs/   │深 │  lm/chat/tools   │
│  终端/问题面板│合约│  lsp/terminals/  │合约│  贡献点          │
│               │   │  sandbox/session │   │                  │
└───────────────┘   └────────┬─────────┘   └──────────────────┘
                             │ 深合约(共享类型,非 ACP 薄协议)
                             ▼
                    ┌──────────────────┐
                    │ sandboxed 子进程 │
                    │ bash/pty/lsp/fs  │  ← 单一执行世界
                    │ (local 或 e2b 云)│
                    └──────────────────┘
```

关键设计点:

- **Agent Host 跑 DSH 完整 Cordis 树**(agent-loop + 全部 ctx.* seam)。它不是「被工作台调用的子进程」,而是一个**有自己调度、能主动向工作台推送动作**的内核进程。
- **renderer ↔ Agent Host 是深合约**:共享 TypeScript 类型(直接 import DSH 的类型定义,不序列化成 ACP 薄协议),走结构化 MessageChannel/RPC。这是「侵入式」的红利——因为 fork 了,可以共享类型,不靠 JSON-RPC 猜形状。
- **Extension Host 保留**,扩展照常跑。但 EH 与 Agent Host **双向能力桥**(§6):扩展贡献的 model/tool/lsp/command 流向 agent;agent 的工具流向扩展。
- **执行世界归 Agent Host 独占**:renderer 的终端面板、文件树、tasks 都经 Agent Host 的 `ctx.*`,不另起一套。VS Code 原生 fs/terminal 服务被**替换或代理**到 Agent Host。

---

## 3. 四大深度融合

### 融合一:单一执行世界(替换 VS Code 原生 fs/terminal/process)

VS Code 现有多套执行入口(文件系统 provider、终端后端、task 执行、debug adapter 启动),各自 spawn,无统一沙箱。**全部重定向到 Agent Host 的 `ctx.fs` / `ctx.subprocess` / `ctx.terminals`:**

| VS Code 原生 | 重定向到 | 效果 |
|---|---|---|
| 文件系统 provider(`IFileService`) | `ctx.fs` | explorer/搜索/保存全过沙箱;workspace 内一致 |
| 终端后端(`ITerminalBackend`) | `ctx.terminals` | 人敲的命令与 agent 跑的命令**同一个 PTY 池** |
| Task 执行 / debug adapter 启动 | `ctx.subprocess` | 编译/测试/调试都在沙箱内,受审批 |
| LSP client 启动 | `ctx.lsp`(+`ctx.subprocess`) | 语言服务器跑在同一个执行世界,诊断人机一致 |

> **红利:agent 和人看到同一个诊断、同一个终端、同一个文件状态——构造性地一致,不靠同步。** 且 `ctx.fs`/`ctx.subprocess` 挂 e2b 即整体迁云(§7)。
> **代价:VS Code 工作台自用 IO(settings、扩展存储、global storage)走 host-internal 旁路,标记为非 workspace,绕过沙箱。** 这条边界要显式画清。

### 融合二:文档模型共用(不重建,借用并增权)

这是 native 的命门。VS Code 已有一套久经考验的工作副本模型,代码确认:

- `ITextFileService` / `WorkingCopyService` / `workingCopyHistoryService`(VS Code **已有工作副本历史机制**!可复用)
- `BulkEditService`(`IBulkEditService`)——所有编辑经此应用的统一管道

**设计:agent 的 edit/write 工具,执行路径走同一个 `BulkEditService` + `ITextFileService`,而非另写一条 ctx.documents。**

- agent `edit` → 生成 `WorkspaceEdit` → `IBulkEditService.apply()` → 进 VS Code 文档模型
- 人键盘 → 同一个 `ITextModel` → 同一个 dirty 跟踪 / undo-redo
- **agent 的编辑享有完整 undo、dirty、冲突检测、工作副本历史**——因为它就是一等编辑,不是外部 API 突袭
- 落盘由 `ITextFileService.save()` 触发 → 走融合一里的 `ctx.fs` → 受沙箱/审批

**新增一层 provenance(来源)记账**:每次 `WorkspaceEdit` 携带 `initiator: 'agent' | 'human' | 'extension'` + agent step id,写入 session log。于是「这一行谁改的、在哪个 turn」可查、可回放、可分支。**这是把 VS Code 文档模型接上 session log 脊柱的那颗螺丝。**

> 比「从 DSH 长身体自建 ctx.documents」更好:白拿 VS Code 成熟模型,只加 provenance。命门解决,且更可靠。

### 融合三:session log 作为事实之源脊柱

终极 native 的架构宣言:**session log 不是聊天记录,是整个项目的决策与执行档案。**

- DSH 的 append-only `SessionEvent` log 成为工作台的脊柱服务。
- **融合二的 provenance 编辑、融合一的执行事件(终端/进程)、对话 turn/step、审批决策、plan/goal/todo**——全部 append 进同一个 log。
- 工作台新增**派生视图**(都是 log 的投影):
  - 时间线:这个会话里发生了什么(编辑、命令、对话交织)
  - 任务树:goal/plan/todo/subagent 的层级
  - 分支/恢复:从任意 turn fork 一个新分支继续(如 DSH 已有的 fork/resume)
  - 重放:逐步回放 agent 的工作
- **文件是 log 的检查点,不是反之**——可重建某时刻的文件树状态。

> 这把「会话」从「侧栏聊天历史」提升为「项目的工作记忆」。Cursor 的对话历史是 UI 状态;这里是内核事实之源。这是终极 native 与「带 chat 的 IDE」的架构级差。

### 融合四:agent 驱动工作台(主动权)

前三融合让 agent 和人共享世界与文档;本融合让 agent **能主动操作工作台 UI**,而不只是产出文字:

新增一组「editor-as-tool」能力(agent 的工具,但作用于工作台状态):

| agent 工具 | 作用 | 人的体验 |
|---|---|---|
| `editor.open(path, range?)` | 打开文件、定位 | 编辑器主动跳到 agent 关心的代码 |
| `editor.reveal(range)` | 高亮一段 | 看到 agent 正在说的那行 |
| `editor.applyEdit(workspaceEdit)` | 应用编辑(走融合二管道) | 实时看到改动 + diff |
| `editor.showDiff(before, after)` | 弹 diff 视图 | 审查 agent 提议再批准 |
| `terminal.focus(sessionId)` | 聚焦某个终端 | 看 agent 正在跑的命令 |
| `workbench.setLayout(...)` | 切布局(编辑器/对话/问题) | agent 为任务重塑工作区 |
| `plan.present(plan)` | 展示计划等审批 | agent 先给方案,人批准再执行 |

> 这才是 native:agent 不是「在侧栏说话」,是「能编排你的工作区状态」。人随时可介入、回退、接管。**主动权在 agent,控制权在人。**

---

## 4. 原生 agent 交互面(替换 chat contrib)

VS Code 的 chat 是 contrib view(`chatViewPane.ts`)。终极 IDE 不留这个侧栏形态,重建原生的 agent 面:

- **主交互区**:不是固定侧栏,而是可浮可嵌的 agent 面——可全屏(任务模式)、可内联(选代码就地对话)、可收成命令栏。
- **agent 发起的 UI 变更**:agent 调 §3 的 editor-as-tool 时,工作台主动切换视图、弹 diff、高亮——对话与编辑器**同屏联动**,而非「上面对话、下面手动找文件」。
- **多视图投影**:对话只是 session log 的一个视图;时间线/任务树/计划/重放是平级视图(融合三)。
- **审批是一等交互**:plan 待审、危险操作待批,以阻塞式 UI 呈现,不让 agent 偷跑。

> 形态分水岭:**编辑器为主、agent 为主动编排者**,而非「chat 占主屏、编辑器是附属」。Cursor 仍是 chat 主屏;这里 agent 编排整个工作区。

---

## 5. 组件归属:留 / 换 / 新

| 组件 | 来源 | 处置 |
|---|---|---|
| Monaco 编辑器 | VS Code | **留**,作编辑面 |
| 工作台壳(文件树/problems/palette/settings/布局) | VS Code | **留**,消费融合后的服务 |
| 文档模型(ITextFileService/WorkingCopy/BulkEdit) | VS Code | **留 + 增权**(provenance、接 session log) |
| 扩展 + Extension Host + vscode.* API | VS Code | **留**,扩展全兼容 |
| LSP/DAP 客户端框架 | VS Code | **留框架**,后端切到统一执行世界 |
| 终端面板 UI | VS Code | **留 UI**,后端换 `ctx.terminals` |
| Chat contrib view | VS Code | **替换**为原生 agent 面(§4) |
| 文件系统/终端/进程执行后端 | VS Code 原生 | **替换**为 `ctx.fs`/`ctx.subprocess`/`ctx.terminals`(融合一) |
| agent-loop | DSH | **新内核**(Agent Host) |
| tools registry(bash/grep/glob/edit/lsp…) | DSH | **新**,agent 的手 |
| session log + fork/resume/replay | DSH | **新脊柱**(融合三) |
| sandbox + approval + policy | DSH | **新**,贯穿执行世界 |
| capability seams(model/execution/skill/mcp) | DSH | **新**,四可换(§7) |
| subagent / workflow / goal / plan / todo | DSH | **新**,编排能力 |
| editor-as-tool 工具集 | 新写 | **新**(融合四) |
| Agent Host 进程 + 深合约 | 新写 | **新**(§2) |
| EH↔AH 双向能力桥 | 新写 | **新**(§6) |

> 内核与执行世界来自 DSH;编辑面、工作台壳、文档模型、扩展生态来自 VS Code;新增的是连接二者的深合约与 agent-as-tool 层。

---

## 6. Extension Host ↔ Agent Host 双向能力桥

保留扩展的前提是让扩展贡献的能力流入 agent,反之亦然:

**EH → AH(扩展贡献给 agent):**
- `registerLanguageModelChatProvider`(EH)→ 该模型进 `ctx.llm`(AH),agent 可用
- `registerTool`/`registerLanguageModelTool`(EH)→ 进 `ctx.tools`(AH)
- `registerChatParticipant`(EH)→ 成 agent preset/persona
- LSP 贡献(EH)→ 语言智能进 `ctx.lsp`,人机共用
- `registerCommand`(EH)→ agent 可作为工具调用 VS Code 命令

**AH → EH(agent 贡献给扩展):**
- agent 的 bash/grep/glob/edit 等工具 → 暴露为 `LanguageModelTool`,让 Copilot/扩展也能调
- agent 的 session log → 扩展可查询(做 timeline 插件、统计等)
- agent 的 plan/goal → 扩展可订阅呈现

> 这让 5 万扩展不只为「人」服务,也为「agent」服务——扩展生态的价值被 native 内核放大,而非丢失。

---

## 7. 四个可换(开放是产品属性,非口号)

DSH 的 seam 全保留,作为产品的开放脊柱:

| 可换 | seam | 终极 IDE 体现 |
|---|---|---|
| 模型 | `ctx.llm`(deepseek/pi-ai/可接 codex/claude-code) | 任选模型/路由,thinking 可见 |
| 执行环境 | `ctx.fs`/`ctx.subprocess`(local / e2b / 远程) | **本地/云端执行世界一键迁移**——架构级护城河 |
| 工具 | `ctx.tools` | 工具集裁剪/扩展,`dsh-plugin` 生态 |
| 能力 | `ctx.skills` + `ctx.mcp` | 技能市场、MCP server 接入 |

> 「agent 的手伸到云端,脸还在编辑器里」——Cursor/Windsurf 架构上做不到(执行绑死本地 fork),这是终极版的独有维度。

---

## 8. 构建与仓库组织

- **产品仓库**:fork 自 VS Code,深度侵入式修改(进程拓扑、服务替换、chat 替换、深合约)。vendor DSH 包群(pnpm workspace member 或 vendored),追踪 DSH upstream、可 patch。
- **DSH 上游**:正常演进,不感知此 fork。产品随 DSH 发版升级内核层。
- **深合约**:renderer 与 Agent Host 共享一份 TypeScript 类型包(从 DSH 导出 + VS Code 侧接口),编译时类型对齐,运行时结构化 RPC。这是侵入式 fork 的核心红利——不靠 ACP 猜协议。
- **补丁纪律(即便允许侵入)**:仍以「模块化替换」优于「散点 hack」——把替换集中在服务边界(ITextFileService 后端、ITerminalBackend、chat view),便于跟 VS Code upstream。但不再以「最小补丁」为目标,以「最佳 native」为目标。

---

## 9. 路线图(按 native 深度,不按成本)

| 阶段 | 目标 | 验收(native 性) |
|---|---|---|
| **R0 内核就位** | Agent Host 进程跑通;renderer↔AH 深合约;DSH ctx.* 可从工作台调 | 工作台能调 `ctx.tools.bash` 跑命令,结果回显 |
| **R1 执行世界融合** | fs/terminal/subprocess 后端替换为 ctx.*;沙箱+审批生效 | 人与 agent 的终端/文件是同一个;危险操作要审批 |
| **R2 文档融合** | agent edit 走 BulkEditService;provenance 写 session log | agent 改代码→编辑器实时 dirty+undo 完整;可查「谁改的」 |
| **R3 session log 脊柱** | 时间线/任务树/fork/replay 视图 | 从任意 turn fork 新分支;重放 agent 工作 |
| **R4 agent 驱动工作台** | editor-as-tool 工具集;agent 主动编排 UI | agent 能 open/reveal/showDiff/setLayout |
| **R5 原生 agent 面** | 替换 chat contrib;内联/全屏/命令栏多形态 | 编辑器为主、agent 编排,非 chat 主屏 |
| **R6 双向扩展桥** | EH↔AH 能力双向流 | 扩展的 model/tool 流入 agent;agent 工具流入扩展 |
| **R7 云端执行 + 开放生态** | e2b 进默认 profile;skill/mcp 市场 | 本地/云一键切换;第三方能力可装 |

每个 R 都提升一档 native 性,**不追求「先出个能用的」**,追求「每一档都做到位」。

---

## 10. 与前几版的根本区别

| 维度 | 薄 fork 版(前) | 从 DSH 长版(前) | **终极版(本)** |
|---|---|---|---|
| 谁是内核 | VS Code | DSH | **DSH(agent loop)** |
| fork 深度 | 薄补丁 | 不 fork VS Code | **深度侵入 fork** |
| 文档模型 | VS Code | 自建 ctx.documents | **VS Code 模型 + provenance** |
| agent 与编辑器 | 桥接(两世界) | 构造共享 | **深度融合(四融合)** |
| 交互面 | VS Code chat contrib | 新 UI 插件 | **原生 agent 面(替换 contrib)** |
| agent 主动权 | 无 | 弱 | **强(驱动工作台 UI)** |
| 执行世界 | 两个 | 一个 | **一个 + 可迁云** |
| session log | 旁挂 | 中心 | **事实之源脊柱** |
| 成本取向 | 低 | 高但自建 | **不计,只求最佳** |

---

## 11. 一句话

> Fork VS Code(深度、侵入),把 DSH 的 agent-loop 作为内核层深度融合:新增 Agent Host 一等进程独占单一执行世界,agent 编辑走 VS Code 既有文档模型并加 provenance 接上 session log 脊柱,agent 能主动驱动工作台 UI,chat contrib 被原生 agent 面替换,扩展经双向桥既服务人也服务 agent。**编辑器是脸、扩展是手、DSH agent loop 是脑,三者深度融合为一个 body——native 不让步,生态不丢失,开放是脊柱。**
