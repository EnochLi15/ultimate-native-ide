# 终极 AI Native IDE —— 实现方案

> 可执行的工程方案:仓库组织、阶段分解、每阶段交付物与验收、关键技术决策。
> 目标:不计成本降本,每阶段做到位,朝终极 native 演进。
> 架构见《架构文档》,产品见《设计方案》。

---

## 1. 仓库组织

```
ultimate-ide/                      # fork 自 microsoft/vscode
├─ (VS Code 全量源码)               # 深度侵入修改
├─ vendor/dsh/                     # git subtree/submodule: deepseek-harness
│   └─ (DSH 全包,可 patch,追 upstream)
├─ packages/contracts/             # 深合约类型包(renderer↔AH 共享)
├─ packages/agent-host/            # AH 进程包装(拉起 DSH Cordis 树)
├─ packages/ide-bridge-renderer/   # renderer 侧深合约客户端
├─ packages/ide-services/          # VS Code 服务替换层(fs/terminal→ctx.*)
├─ packages/provenance/            # 编辑 provenance 注入 session log
├─ packages/editor-as-tool/        # agent 驱动工作台工具集
└─ packages/agent-view/            # 原生 agent 面(替换 chat contrib)
```

- DSH 上游正常演进不感知本 fork;本 fork 以 subtree 跟进,可 patch。
- 深合约 `contracts` 包从两侧导出类型,CI 双向类型检查。

---

## 2. 技术决策(已基于代码确认)

| 决策 | 选择 | 依据(已验证文件) |
|---|---|---|
| AH 进程底座 | electron UtilityProcess | `src/vs/platform/utilityProcess/electron-main/utilityProcess.ts` |
| AH↔renderer 传输 | MessagePort + RPCProtocol(复用 EH 同款) | `extensionHostStarter.ts` 模式 |
| 工作台启动 hook | Workbench.startup()/renderWorkbench() | `workbench.ts:131/320` |
| agent edit 管道 | BulkEditService.apply(WorkspaceEdit) | `contrib/bulkEdit/browser/bulkEditService.ts` |
| 工作副本历史 | 复用 workingCopyHistoryService | `services/workingCopy/common/workingCopyHistoryService.ts` |
| 终端后端替换 | ITerminalBackend→ctx.terminals | `contrib/terminal/browser/terminalService.ts` |
| chat 替换 | 替换 chatViewPane contrib | `contrib/chat/browser/widgetHosts/viewPane/chatViewPane.ts` |
| EH 能力流入 agent | 拦截 registerLanguageModelChatProvider/registerTool | `extHost.api.impl.ts:1889` vscode.lm |
| DSH Agent 类型 | AgentHandle/AgentFactory | `packages/core/agent/src/index.ts:172` |
| session log | session-persistence-jsonl/sqlite + projection | `packages/session/*` |
| fs seam 事件 | fs/write-intent, fs/edit-intent, fs/observed(+新增 fs/changed) | `packages/fs/fs/src/index.ts:49` |
| 执行世界迁云 | fs-e2b/subprocess-e2b(零改 bash/terminal/lsp) | `packages/e2b/*` |

---

## 3. 阶段分解(按 native 深度)

### R0 内核就位
**目标**:Agent Host 进程跑通,renderer 能调 DSH ctx.*,深合约成立。

- [ ] R0.1 vendor DSH 为 subtree;`contracts` 包导出 Agent/AgentHandle/SessionEvent/Tool/FsTarget 类型
- [ ] R0.2 `agent-host` 包:UtilityProcess 拉起,挂载 DSH base bundle 的 Cordis 树(ctx.agents/tools/fs/llm)
- [ ] R0.3 `ide-bridge-renderer`:MessagePort+RPCProtocol 客户端,类型对齐 contracts
- [ ] R0.4 Workbench.startup 注入:启动时拉起 AH,注册 IdeBridge 为服务
- [ ] R0.5 验证:renderer 调 `ctx.tools['bash']` 跑命令,结果回显终端面板

**验收**:工作台首次能通过深合约驱动 DSH 执行一个 bash 命令。
**命门**:深合约类型对齐 + 进程拉起,是后续一切基础。

### R1 执行世界融合
**目标**:VS Code fs/terminal/subprocess 后端替换为 ctx.*,沙箱+审批生效。

- [ ] R1.1 `ide-services`:IFileService 后端代理到 ctx.fs(resolve/stat/read/write/edit/list)
- [ ] R1.2 ITerminalBackend 代理到 ctx.terminals(spawn/onData/resize/close)
- [ ] R1.3 Task/Debug adapter 启动经 ctx.subprocess
- [ ] R1.4 LSP client 启动经 ctx.lsp+ctx.subprocess
- [ ] R1.5 host-internal 旁路:settings/扩展存储/global storage 标记非 workspace,绕沙箱
- [ ] R1.6 sandbox+approval 接入:workspace-write 默认,危险操作审批 UI
- [ ] R1.7 新增 `fs/changed` 事件(target, outcome, actor)供 UI 同步,与 `fs/observed` 解耦

**验收**:人与 agent 的终端/文件是同一个;危险操作弹审批;工作台自用 IO 不被沙箱锁死。
**命门**:单一执行世界不变量——CI 断言无第二条 workspace 文件路径。

### R2 文档融合 + provenance
**目标**:agent edit 走 BulkEditService,provenance 写 session log。

- [ ] R2.1 `ctx.tools['edit'/'write']` 转 WorkspaceEdit,经 IdeBridge 调 BulkEditService.apply()
- [ ] R2.2 `provenance` 层:WorkspaceEdit 携带 `initiator: 'agent'|'human'|'extension'` + step id
- [ ] R2.3 provenance 写入 DSH session log(经 AH)
- [ ] R2.4 agent read 命中打开文档的活内容(ITextModel),而非磁盘
- [ ] R2.5 落盘 ITextFileService.save()→ctx.fs→沙箱/审批
- [ ] R2.6 双写者归一测试:agent edit 与人键盘同写一缓冲,无「磁盘被改覆盖」冲突

**验收**:agent 改代码→编辑器实时 dirty+undo 完整;可查「谁改的/哪个 turn」;人未保存编辑 agent 可见。
**命门**:双写者归一。

### R3 session log 脊柱
**目标**:log 成工作台脊柱,派生视图可用。

- [ ] R3.1 session log 服务在 renderer 暴露(经 IdeBridge 订阅 SessionEvent 流)
- [ ] R3.2 时间线视图:编辑/命令/对话交织
- [ ] R3.3 任务树视图:goal/plan/todo/subagent 层级
- [ ] R3.4 fork/resume:从任意 turn 分支
- [ ] R3.5 replay:逐步回放 agent 工作
- [ ] R3.6 文件检查点:可重建某时刻文件树状态

**验收**:从任意 turn fork 新分支继续;重放可见逐步编辑/执行。
**命门**:文件是 log 检查点。

### R4 agent 驱动工作台
**目标**:editor-as-tool 工具集,agent 主动编排 UI。

- [ ] R4.1 `editor-as-tool` 包:editor.open/reveal/applyEdit/showDiff
- [ ] R4.2 terminal.focus(sessionId)
- [ ] R4.3 workbench.setLayout(编辑/任务/审查模式)
- [ ] R4.4 plan.present(plan)审批 UI
- [ ] R4.5 agent 面 stream 渲染(thinking/tool 进度/diff 联动)
- [ ] R4.6 流式语义映射表:DSH assistant/chunk+tool 进度 → 工作台渲染

**验收**:agent 能 open/reveal/showDiff/setLayout;对话与编辑器同屏联动。
**命门**:主动权在 agent,控制权在人。

### R5 原生 agent 面
**目标**:替换 chat contrib,多形态交互面。

- [ ] R5.1 替换 chatViewPane,`agent-view` 接管主交互区
- [ ] R5.2 内联对话(选代码就地)
- [ ] R5.3 命令栏模式(收起)
- [ ] R5.4 全屏任务模式
- [ ] R5.5 审批阻塞式 UI(plan/danger)
- [ ] R5.6 编辑器为主布局确认(非 chat 主屏)

**验收**:编辑器为主、agent 编排,非 chat 主屏;多形态切换流畅。

### R6 双向扩展桥
**目标**:EH↔AH 能力双向流。

- [ ] R6.1 EH `registerLanguageModelChatProvider`→ctx.llm
- [ ] R6.2 EH `registerTool`/`registerLanguageModelTool`→ctx.tools
- [ ] R6.3 EH `registerChatParticipant`→agent preset/persona
- [ ] R6.4 EH LSP 贡献→ctx.lsp
- [ ] R6.5 AH 工具→暴露为 LanguageModelTool 供 Copilot/扩展调
- [ ] R6.6 AH session log→扩展可查询
- [ ] R6.7 5 万扩展兼容性套件回归

**验收**:扩展的 model/tool 流入 agent;agent 工具流入扩展;5万扩展既服务人也服务 agent。

### R7 云端执行 + 开放生态
**目标**:e2b 进默认 profile,skill/mcp 市场。

- [ ] R7.1 fs-e2b/subprocess-e2b 接入 ide profile
- [ ] R7.2 本地/云一键切换(会话级)
- [ ] R7.3 skill 加载(ctx.skills+skill-filesystem)
- [ ] R7.4 mcp server 接入(ctx.mcp)
- [ ] R7.5 dsh-plugin 发现机制
- [ ] R7.6 credentials 分离(用户填 key 不泄露)

**验收**:本地/云一键切换;第三方能力可装;agent 手伸云端脸在编辑器。

---

## 4. 测试策略(沿用 DSH 策略)

- 每个融合/服务替换配 **REAL-composition 测试**:经 Cordis Loader+app boot,不 hand-built ctx.plugin
- **不变量 CI**:单一执行世界(无第二文件路径)、model-visible 即 logged、provenance 完整
- **HMR-safety**:registry 贡献须证 disposal(fiber dispose 后移除)
- **回归**:跟 VS Code upstream rebase 后跑扩展兼容性套件(保 5 万扩展不破)
- **snapshot 测试**:流式渲染、provenance、session log 投影

---

## 5. upstream 跟进纪律

- **VS Code**:以「模块化服务替换」优于「散点 hack」,集中替换在服务边界(ITextFileService 后端/ITerminalBackend/chat view),便于 rebase
- **DSH**:subtree 跟进,patch 集中在 contracts 类型导出与 AH 包装,不侵入 DSH 内核包
- **双向类型漂移**:CI 同时跑 VS Code+DSH 类型检查,任一 breaking 先暴露在 contracts

---

## 6. 风险与缓解

| 风险 | 缓解 |
|---|---|
| upstream rebase 冲突大 | 模块化服务替换,补丁集中边界 |
| 深合约类型漂移 | contracts 单一来源,CI 双向检查 |
| 执行世界边界误锁工作台 | host-internal 旁路显式标记,测试覆盖 |
| 流式语义(thinking/tool进度)映射 | R4 定映射表+snapshot 测试 |
| 5万扩展兼容 | R6 后跑兼容套件,未实现 Shape 优雅降级 |
| e2b 延迟 | R7 验证,本地优先模式保底 |
| 双写者并发(多agent+人) | R2 状态机严谨+REAL 测试 |

---

## 7. 里程碑与 native 性验收

| 里程碑 | 验收(native 性判据) |
|---|---|
| R0 | 工作台能调 ctx.tools.bash(内核就位) |
| R1 | 人与 agent 同终端/文件,危险操作审批(单一执行世界) |
| R2 | agent 改代码实时 dirty+可查谁改的(文档融合) |
| R3 | 从任意 turn fork/重放(session log 脊柱) |
| R4 | agent 能 open/reveal/setLayout(驱动工作台) |
| R5 | 编辑器为主 agent 编排,非 chat 主屏(原生面) |
| R6 | 扩展 model/tool↔agent 双向流(双向桥) |
| R7 | 本地/云一键切换+第三方能力可装(开放护城河) |

每里程碑满足对应 native 判据才进下一阶段,不追求先出能用的。

---

## 8. 第一步(R0.1)即刻可做

1. fork microsoft/vscode
2. `git subtree add` deepseek-harness 到 `vendor/dsh`
3. 建 `packages/contracts`,从 DSH `packages/core/agent/src/index.ts` 导出 Agent/AgentHandle/AgentFactory 类型,从 VS Code 导出 WorkspaceEdit/ITextModel/Uri
4. 建 `packages/agent-host` 骨架:UtilityProcess 入口 + 挂载 DSH base bundle
5. 建 `packages/ide-bridge-renderer` 骨架:MessagePort + RPCProtocol 客户端
6. 在 `Workbench.startup()` 注入拉起 AH

这一步通了,深合约 + 进程拓扑成立,后续 R1–R7 是在稳固地基上逐层加融合。
