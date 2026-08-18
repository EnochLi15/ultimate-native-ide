# 从 DSH 长出一个 AI-Native IDE —— 架构设计

> 目标:不把 agent 心脏装进 VS Code,而是从 DSH 这颗心脏长出编辑器身体。
> 让编辑器与 agent **构造性地共享同一个执行世界**,而不是用桥去搬运状态。

---

## 0. 设计立论

一句话:**编辑器是 DSH 内核上的插件,所以它与 agent 天生共用同一套 fs / lsp / terminal / sandbox / session——这是构造决定的,不是调出来的。**

由此推出三条不可妥协的不变量,整个架构都从它们推导:

- **不变量 1(单一执行世界)**:文件、终端、LSP、进程派生只有一套归属——`ctx.fs` / `ctx.terminals` / `ctx.lsp` / `ctx.sandbox`。编辑器不另起一套。
- **不变量 2(变更走事件,不走 fs.watch)**:所有文件变更必经 `ctx.fs`,因此编辑器**订阅 `fs/*` 事件**即可知道一切变化,不需要监听磁盘。这是"一个执行世界"的直接红利。
- **不变量 3(agent 与人是同一文档的共同作者)**:对打开的文件,agent 的 `edit/write` 与人的键盘输入写入**同一个工作副本**,不分两条路。这是 native 体验的命门,详见 §3。

---

## 1. 分层架构

```
┌─────────────────────────────────────────────────────────────┐
│  Profile: ide  =  base + web-app + dsh-ide-app(新增)        │
├─────────────────────────────────────────────────────────────┤
│  UI 插件层(React,挂进 ui-slots / ui-layout)               │
│   ui-editor · ui-explorer · ui-problems · ui-diff           │
│   ui-terminal-panel · ui-activity-bar · ui-command-palette  │
├─────────────────────────────────────────────────────────────┤
│  ★ ctx.documents(新增,工作副本权威——设计的命门)          │
│   open/close · working copy · dirty · flush · document/changed│
├─────────────────────────────────────────────────────────────┤
│  能力 seam 层(DSH 已有,编辑器与 agent 共享)              │
│   ctx.fs  · ctx.lsp  · ctx.terminals  · ctx.tools           │
│   ctx.sandbox/sandbox-policy/approval · ctx.sessions        │
├─────────────────────────────────────────────────────────────┤
│  内核(DSH 已有)                                            │
│   agent-loop · session log · ctx.agents · ctx.llm · 插件树   │
└─────────────────────────────────────────────────────────────┘
```

底层四层 DSH 已具备,直接复用。要新增的是 **`ctx.documents` 工作副本权威** 和 **UI 插件层**,外加一个 `dsh-ide-app` bundle 把它们组合成 `ide` profile。

---

## 2. 复用 vs 新增(一张表说清工程量)

| 能力 | DSH 现状 | 在 IDE 里的角色 | 动作 |
|---|---|---|---|
| agent-loop / session log / ctx.agents | ✅ 已有 | 内核 | 复用 |
| ctx.fs (resolve/stat/read/write/edit/list) | ✅ 已有 | 文件持久层 | 复用 |
| fs/* 事件 (write-intent/edit-intent/observed) | ✅ 已有 | 变更通知 seam | 复用 + 可能加 `fs/changed` |
| ctx.lsp (provider/route/query) | ✅ 已有 | 语言智能(诊断/补全/定义/引用) | 复用,改多消费者 |
| ctx.terminals (spawn/PTY) | ✅ 已有 | 终端后端 | 复用 |
| ctx.tools (bash/grep/glob/…) | ✅ 已有 | agent 的手 | 复用 |
| ctx.sandbox / approval / sandbox-policy | ✅ 已有 | 执行契约 | 复用 |
| ui-slots / ui-layout (3 列 AppFrame) | ✅ 已有 | UI 骨架 | 复用 + 扩展布局 |
| **ctx.documents** | ❌ 无 | **工作副本权威** | **新增(命门)** |
| ui-editor (Monaco 封装) | ❌ 无 | 代码编辑面 | **新增** |
| ui-explorer / ui-problems / ui-diff / ui-terminal-panel | ❌ 无 | IDE 表面 | **新增** |
| dsh-ide-app bundle + ide profile | ❌ 无 | 组合打包 | **新增** |

**结论:内核与能力 seam 全部现成,真正要写的是 1 个服务 + 6 个 UI 插件 + 1 个 bundle。** 不是重写 VS Code 级别的工程。

---

## 3. 命门设计:`ctx.documents` 工作副本权威

这是整个架构最难、也最决定 native 成败的部分。问题陈述:

> 一个文件有两个写者——agent(经工具)和人(经 Monaco 键盘);两个"当前内容"——磁盘(ctx.fs)和编辑器未保存缓冲。如何让它们不打架,且彼此实时可见?

VS Code 的脏缓冲模型解决了一半(人 vs 磁盘),但 agent 是外部 API 调用者,经常和人的未保存编辑冲突("file modified on disk, overwrite?")。**我们的设计让 agent 成为文档的一等共同作者,从根上消灭这个冲突。**

### 3.1 Document 模型

```
ctx.documents.open(path) → Document
  ├─ path            稳定路径(来自 ctx.fs.resolve)
  ├─ version         单调递增(每次变更 +1)
  ├─ model           活内容(Monaco TextModel,或抽象 ITextBuffer)
  ├─ dirty           是否相对磁盘有未保存改动
  ├─ diskVersion     最后落盘时的版本快照
  └─ observers       document/changed 订阅者(编辑器视图、session log…)
```

Document 是**打开文件的唯一权威**:活内容以 model 为准,ctx.fs 是它下面的持久层。

### 3.2 双写者归一:所有变更都过 Document

**agent 的 fs 工具,当目标路径有打开的 Document 时,改走路由:**

| 工具 | 原行为 | 经 Document 的新行为 |
|---|---|---|
| `read` | ctx.fs.readText | **返回 Document 活内容**——agent 看得到人未保存的编辑 ✅ |
| `edit` | ctx.fs.editText | **作用到 Document model**,version++,发 `document/changed`,Monaco 实时刷新 |
| `write` | ctx.fs.writeText | 替换 Document model,发 `document/changed` |

**人的 Monaco 编辑:**
- 键盘输入 → 更新 Document model → version++ → dirty=true → 发 `document/changed`
- **不立即落盘**(人的编辑不走 approval;人就是权威)
- agent 的下一次 `read` 立刻看到这些未保存改动

**保存(human 或 agent 触发):**
- `Document.flush()` → `ctx.fs.writeText(path, model.content, intent)` → 落盘 → dirty=false → diskVersion=version
- 仍走 `fs/write-intent` waterfall 与 sandbox policy——持久化受契约约束

### 3.3 为什么这是 native 的关键

- **无冲突**:agent 和人写同一个缓冲,不存在"磁盘被改了,要不要覆盖"。agent 的改动直接 merge 进人正在看的视图,实时可见。
- **agent 看得见人的思路**:人打了一半的代码,agent `read` 就能看到,不会基于过时磁盘内容瞎改。
- **审批仍生效**:agent 的持久化(flush)受 approval/sandbox 约束;人的编辑免审批(人是权威)。**责任归属清晰:谁触发落盘,谁过契约。**
- **session log 完整**:`document/changed` 与 `fs/*` 事件都进日志,agent 的每一次编辑可重放、可 diff、可回滚。

### 3.4 与 fs 观测策略(read-before-write)的协作

现有 `fs-observation-policy` 要求 edit/write 前先 read 且文件未变。经 Document 路由后:
- "已读"判定基于 Document 的 version(而非磁盘 version)
- "未变"判定 = Document 自上次 read 后 version 未涨
- 关闭的文件仍走原 ctx.fs 直通路径,行为不变

> 即:观测策略从"磁盘级"升级为"文档级",语义更准,且只对打开的文件生效,不影响 headless/agent-only 场景。

---

## 4. 事件流:agent 改动如何到编辑器,人的改动如何到 agent

```
 agent edit 工具                 人 Monaco 键盘
      │                              │
      ▼                              ▼
 ctx.documents.edit(doc, delta)   doc.model.applyEdit(delta)
      │                              │
      └──────────┬───────────────────┘
                 ▼
         doc.version++; dirty=true
                 │
      ┌──────────┴──────────────┐
      ▼                         ▼
 document/changed(doc, range)  document/changed(doc, range)
      │                         │
      ▼                         ▼
 Monaco model 增量更新         agent 下次 read 看到新内容
 (diff 高亮可选)              (session log 记录变更)

      │ flush(保存)
      ▼
 ctx.fs.writeText ──► fs/write-intent(waterfall) ──► 落盘 ──► fs/observed
```

两条关键性质:
1. **agent→编辑器**:agent edit 经 Document,Document 持有 Monaco model 引用,增量更新——人看到的是 live diff,不是"文件改了请重载"。
2. **人→agent**:人键入只动 Document model,不发磁盘事件;agent `read` 命中 Document 活内容即同步。**不需要人保存 agent 才能看到。**

> 注意:现有 `fs/observed` 是观测记录(含 read),语义偏"读后追踪"。建议新增一个专门的 `fs/changed`(target, outcome, actor)事件给编辑器订阅,与 `fs/observed` 解耦——后者归策略,前者归 UI 同步。这是对 fs seam 的小幅扩展,符合其"capability seam"设计。

---

## 5. UI 插件分解与 slot 接线

DSH 的 `ui-layout` 已声明三列:`sidebar` / `conversation` / `details`,根槽 `root`。IDE 形态需扩展布局,但不重写——新增插件挂进现有 slot,或声明子 slot。

| 插件 | 挂入 slot | 声明子 slot | 消费 |
|---|---|---|---|
| `ui-editor` | `conversation`(IDE 模式下编辑器占主区)或新增 `editor` 列 | `editor.tab.*` | ctx.documents · ctx.lsp |
| `ui-explorer` | `sidebar` | `explorer.tree` | ctx.fs(list/stat) |
| `ui-problems` | `sidebar` 或 `details` | `problems.list` | ctx.lsp(diagnostics) |
| `ui-diff` | `details` | `diff.view` | tool-fs diff-card metadata · document/changed |
| `ui-terminal-panel` | `details` 底部或独立 panel | `terminal.tab.*` | ctx.terminals(spawn) |
| `ui-activity-bar` | `sidebar` 左缘 rail | `activity.item.*` | ctx.commands |
| `ui-command-palette` | `root` 浮层 | — | ctx.commands · ctx.tools |

**关键:每个 UI 插件都是 slot 的消费者 + 子 slot 的声明者**,遵循 DSH 的 "register = 声明 = 渲染授权" 单表模型。布局形态由 `ide` profile 的 `cordis.patch.yml` 决定(把 `conversation` 主区在 IDE 模式下让给 `editor`),不改 `ui-layout` 代码。

### 布局形态(IDE 模式)

```
┌──┬────────────────────┬─────────┐
│活 │ explorer / problems│  editor │ ← 主区(Monaco),多 tab
│动 │  (可切换)          │  ────── │
│栏 │                    │ terminal│ ← 可下拉
└──┴────────────────────┴─────────┘
       sidebar            conversation(IDE 下=editor+terminal)
                           details(IDE 下=diff/inspect)
```

对话(chat)在 IDE 模式可收进 sidebar 的一个 tab,或作为活动栏的一项——**chat 不再是默认主区,编辑器是**。这是"编辑器为主、agent 为伴"的 native 形态,与"chat 占主区"的插件式 IDE 区分。

---

## 6. Monaco 集成:嵌入,不重写

- npm 引入 `monaco-editor`(或 `@monaco-editor/react`),作为 `ui-editor` 插件的依赖。
- **Monaco 的 TextModel 即 Document.model 的实现**——不维护两份内容。`ctx.documents.open` 时创建 Monaco `TextModel`,Document 持有它。
- 语言服务:Monaco 自带的基本语法高亮即可用;**补全/诊断/定义/引用全部接 ctx.lsp**(见 §7),不依赖 Monaco 内置 TS worker。
- Web worker:Monaco 的 worker 走 Vite 的 `?worker` 导入,在 `apps/web` 构建配置里声明。这是已知的打包工程量,可解。
- 主题:复用 DSH 的 `ctx.theme`(ui-layout 已把主题投影到 document),Monaco 用 `defineTheme` 同步。

> 一个 Document = 一个 Monaco TextModel。agent 经 Document 改内容 = 调 `model.applyEdits()`,Monaco 视图自动增量刷新。这就是"agent 改动实时显示"的落点。

---

## 7. LSP / Terminal / 工具的接线

### LSP(ctx.lsp)
- 现状:`LspService` 有 provider/extension→route/query。当前偏 agent 面向。
- IDE 接线:`ui-editor` 与 `ui-problems` 成为 ctx.lsp 的**新消费者**。
  - 诊断:订阅 LSP diagnostics → `ui-problems` 列表 + Monaco markers
  - 补全/定义/引用/hover:Monaco 的 `registerCompletionItemProvider` 等适配器调 `ctx.lsp.query(...)`
- 设计约束(遵 DSH "为所有消费者设计 seam"):LSP 的 document 同步要基于 Document model 而非磁盘——`ctx.documents` 在内容变更时向 LSP provider 发 `textDocument/didChange`(用 Document version)。**Document 成为 LSP 的内容权威源。**

### Terminal(ctx.terminals)
- `ui-terminal-panel` 调 `ctx.terminals.spawn(owner, request)` 拿到 PTY session,渲染 xterm.js(或复用 DSH web 现有终端渲染)。
- **同一个 terminal 后端** agent 也能 `tool-terminal` 驱动——人在面板里看到的,就是 agent 跑命令的那个 session。一个执行世界。

### 工具(ctx.tools)
- agent 的 bash/grep/glob/edit 等 tool 调用,其结果经 session log → `ui-diff` / problems / terminal 面板呈现。
- command palette(`ui-command-palette`)消费 `ctx.commands`(人命令)+ 可选地把高频 `ctx.tools` 暴露成人可触发的命令。

---

## 8. Profile 与 Bundle 组合

```
ide profile (cordis.patch.yml)
  bundles:
    - dsh-base          # 第一层:模型/工具/持久/沙箱/审批/设置(agent+IDE 共享)
    - dsh-web-app       # 浏览器应用 shell
    - dsh-ide-app       # 新增:IDE UI 插件 + ctx.documents
  + profile cordis.patch.yml  # IDE 布局覆盖(conversation→editor 主区)
```

`dsh-ide-app/cordis.patch.yml` 插入的行(示意):

```yaml
- id: documents
  name: '@deepseek-ai/dsh-documents'        # ctx.documents 工作副本权威
- id: ui-editor
  name: '@deepseek-ai/dsh-ui-editor'         # Monaco
- id: ui-explorer
  name: '@deepseek-ai/dsh-ui-explorer'
- id: ui-problems
  name: '@deepseek-ai/dsh-ui-problems'
- id: ui-diff
  name: '@deepseek-ai/dsh-ui-diff'
- id: ui-terminal-panel
  name: '@deepseek-ai/dsh-ui-terminal-panel'
- id: ui-activity-bar
  name: '@deepseek-ai/dsh-ui-activity-bar'
- id: ui-command-palette
  name: '@deepseek-ai/dsh-ui-command-palette'
```

启动:`dsh --profile ide web`。`dsh --profile web` 仍是纯 chat 形态。**同一内核,两种形态,profile 切换。**

---

## 9. VS Code 扩展兼容性(诚实评估)

从 DSH 长出的 IDE **不兼容 VS Code 扩展**(它们 target `vscode` 命名空间 ExtHost/MainThread RPC,不认 Cordis 契约)。但这代价对 agent-native IDE 比对传统 IDE 小:

| 扩展类别 | 是否需要 VS Code 兼容 | IDE 里的替代 |
|---|---|---|
| 语言服务(Python/TS/Go…) | 否 | **直接消费 LSP**,不经 VS Code 扩展壳 |
| linter/formatter | 否 | 走 LSP 或独立工具,agent/命令可调 |
| GitLens/blame/片段补全 | 否 | **agent 替代**(能解释 blame、能写代码) |
| 调试器 UI | 部分 | DAP 协议直连(未来工作) |
| notebook / DB 客户端等垂类 | 是(损失) | 需专门适配,或未来 vscode-compat shim |

> 结论:**丢的是 VS Code 的"壳生态",留住它背后的"语言工具链生态"(LSP/DAP)**——而后者才是 agent 真正需要的弹药。v1 不做兼容;若日后必须,`vscode-compat` API shim 是独立的大工程,不阻塞主线。

---

## 10. 分阶段建设

| 阶段 | 目标 | 验证点 |
|---|---|---|
| **P0 命门验证** | Monaco 作 `ui-editor` 单插件嵌入 apps/web,仅消费 ctx.fs;agent `write/edit` 后编辑器经 `fs/changed` 实时刷新 | "一个执行世界"是否成立——这是整条路成败的命门 |
| **P1 工作副本权威** | `ctx.documents`;agent edit/human edit 归一;`document/changed`;ui-explorer + ui-problems | 人打字 agent 即可见;agent 改人即可见;无冲突 |
| **P2 语言与终端** | ctx.lsp 接 Monaco(诊断/补全/定义);ui-terminal-panel 接 ctx.terminals | 编辑器有完整语言能力;agent 跑的命令人在同一终端看见 |
| **P3 IDE 形态** | ui-diff(变更审查)、ui-activity-bar、ui-command-palette;`ide` profile;布局切主区为编辑器 | 形态从"chat 为主"切到"编辑器为主,chat 为伴" |
| **P4(可选,重)** | vscode-compat shim / DAP 调试 / notebook | 扩展生态与垂类工具 |

**P0 是必须先跑通的最小验证**——它直接证伪或证实"agent 与编辑器共享执行世界"这个立论。建议两周内出 PoC。

---

## 11. 风险与开放问题

1. **工作副本语义最复杂**:Document 的 version 冲突、并发编辑(多 agent + 人)、关闭未保存时的处理,需要严谨的状态机。P1 要有 REAL-composition 测试(遵 DSH 测试策略)。
2. **fs seam 扩展**:`fs/changed` 与 `fs/observed` 的职责切分需与现有策略插件对齐,不能破坏 read-before-write。
3. **LSP 多消费者**:ctx.lsp 从 agent-facing 变成 agent+editor 共用,文档同步权威要从"磁盘"改"Document",需确认不破坏现有 agent 的 LSP 用法。
4. **Monaco 打包**:worker 模式、bundle 体积、与 DSH client HMR 的协作——工程量但可解。
5. **调试器**:DAP 集成是独立模块,本设计未覆盖,列为 P4。
6. **多窗口/远程**:DSH 的 fs/lsp 可指向远程 sandbox(provider 可换),IDE 形态天然支持远程——这是免费红利,但需验证延迟。

---

## 12. 一句话总结

> 不装心脏进别人的身体,从心脏长身体:以 DSH 的 agent-loop / fs / lsp / terminal / sandbox 为内核,**新增一个 `ctx.documents` 工作副本权威让 agent 与人成为同一文档的共同作者**,再长出 6 个消费同一套能力 seam 的 UI 插件(Monaco 嵌入不重写),组合成 `ide` profile。编辑器与 agent 构造性地共享一个执行世界——这是 VS Code 从结构上做不到的 native,代价是放弃 VS Code 的壳生态、留住 LSP/DAP 工具链生态。
