# 寄生式 Native IDE —— 架构精确化

> 立论:VS Code 的 ExtHost↔MainThread RPC 边界是一条**可重定向的神经**。
> 寄生 = 留着 VS Code 的全部器官(扩展 + ExtHost + 工作台外壳),只把这条神经的
> **MainThread 服务实现**换成 DSH 的 `ctx.*`。用户用着 VS Code 的脸和全部扩展,
> 所有执行能力流过 DSH agent 内核。

---

## 1. 接入点(已用代码确认,非推测)

VS Code 把 MainThread 实现注册进 RPC 的机制是一个**装饰器自注册表**:

```ts
// src/vs/workbench/services/extensions/common/extHostCustomers.ts
@extHostNamedCustomer(MainThreadLanguageModels.ID, MainThreadLanguageModels)  // 装饰器
class MainThreadLanguageModels implements MainThreadLanguageModelsShape { … }
```

- `@extHostNamedCustomer(id, ctor)` 把一个 `(ProxyIdentifier, 构造器)` 推入全局单例
  `ExtHostCustomersRegistryImpl.INSTANCE._namedCustomers[]`。
- 启动时 `ExtensionService` 遍历 `getNamedCustomers()`,对每条 `[id, ctor]` 做
  `instantiationService.createInstance(ctor, extHostContext)` 得到实例,再
  `rpcProtocol.set(id, instance)` 把它塞进 `RPCProtocol._locals[rpcId]`。
- ExtHost 侧 `extHost.api.impl.ts` 通过 `rpcProtocol.getProxy(id)` 拿到远端代理,
  扩展调用 `vscode.lm.xxx()` 最终 `proxy.xxx()` → 跨 RPC → 命中我们塞的实例。

**结论:寄生点唯一且干净——替换 `namedCustomers` 里某些条目的 `ctor`。** 不 fork 工作台、不 fork ExtHost、不动 5 万扩展。改的是"注册表里某行指向谁",不是 VS Code 的主体逻辑。

---

## 2. 进程拓扑(三种形态,递进)

```
┌─────────────────────────────────────────────────────────────────┐
│  VS Code Main(workbench,渲染 Monaco/文件树/problems/chat UI)    │
│   ├─ RPCProtocol._locals[] ← 被寄生:Shape 实现指向 DSH 适配器   │
│   └─ 其余 MainThread:* 仍用 VS Code 原生实现(扩展存储/窗口…)   │
│         │  MessagePort / MessageChannel(进程内或跨进程)        │
│         ▼                                                        │
│  Extension Host(node 子进程 或 web worker)                       │
│   └─ 跑全部 VS Code 扩展,只认 vscode 命名空间 API               │
│         │  ExtHost 侧 getProxy(Shape) → RPC → 我们的寄生实现    │
└─────────┼─────────────────────────────────────────────────────────┘
          │ 我们的寄生实现(一组 DSH 插件)调
          ▼
┌─────────────────────────────────────────────────────────────────┐
│  DSH agent 内核(独立进程,或 main 进程内的 host 插件)          │
│   ctx.agents · ctx.tools · ctx.fs · ctx.lsp · ctx.terminals      │
│   ctx.llm · ctx.sandbox · ctx.approval · ctx.sessions            │
└─────────────────────────────────────────────────────────────────┘
```

| 形态 | DSH 位置 | 寄生实现位置 | 适用 | 工程量 |
|---|---|---|---|---|
| **F1 寄生器扩展** | 独立进程(dsh web / dsh acp) | 一个 VS Code 扩展,内嵌一个桥,把 Shape 调用转发给 DSH | 先验证、最小改动 | 低 |
| **F2 内嵌宿主** | main 进程内挂一个 DSH host 插件 | Shape 适配类直接实例化,同进程调 `ctx.*` | 体验最顺、延迟最低 | 中 |
| **F3 薄 fork** | 同 F2 | 同 F2,但在启动期用一个补丁重写注册表少数行 | 当装饰器替换不够时 | 中(但远小于 Cursor fork) |

> F1 最先做(零 fork),F2 是稳定目标。F3 是当某些 Shape 无法靠扩展替换时的兜底,刻意保持补丁最小(只改注册表几行),好跟 upstream。

---

## 3. 适配层结构

寄生实现是一组**DSH 插件 + VS Code 侧的 Shape 适配类**,统一接口:

```ts
// DSH 侧:把 ctx.* 适配成一组“能力方法”,不依赖任何 VS Code 类型
// packages/ide/host/src/index.ts  (新插件 @deepseek-ai/dsh-ide-host)
apply(ctx) {
  ctx.ide = {
    lm:     { sendRequest(req): AsyncStream },  // → ctx.llm
    agents: { create(prompt, cwd): AgentHandle }, // → ctx.agents
    tools:  { call(name, args): Result },        // → ctx.tools
    fs:     { read/write/edit/list/stat },       // → ctx.fs
    lsp:    { diagnostics/completion/def/refs }, // → ctx.lsp
    terminals: { spawn(owner, req), onData },    // → ctx.terminals
    approval: { ask(req) },                      // → ctx.approval
  }
}
```

```ts
// VS Code 侧:Shape 适配类,实现 VS Code 的 MainThread*Shape,内部转调 ctx.ide.*
@extHostNamedCustomer(MainThreadLanguageModels.ID, DshLanguageModels)
class DshLanguageModels implements MainThreadLanguageModelsShape {
  constructor(ctx: IExtHostContext, @IIdeBridge private bridge: IIdeBridge) {}
  async $registerLanguageModelProvider(handle, vendor, label) {
    this.bridge.dsh.lm.registerProvider(vendor)  // 注册到 DSH ctx.llm
  }
  async $sendLanguageModelRequest(providerId, modelId, messages, options) {
    return this.bridge.dsh.lm.sendRequest({ providerId, modelId, messages })  // 流回 VS Code chat
  }
}
```

`IIdeBridge` 是 F1 的桥(MessagePort/JSON-RPC 到独立 DSH 进程)或 F2 的直调句柄。**Shape 适配类是纯转换层,不含业务逻辑**——业务全在 DSH。

---

## 4. 一个端到端数据流:VS Code Chat → DSH agent loop → 编辑器

这是寄生法 native 性的落点,逐步:

```
① 用户在 VS Code Chat 面板输入“重构这个函数”
   │ (VS Code 原生 Chat UI,扩展 @deepseek 已注册为 chatParticipant)
   ▼
② 扩展调 vscode.chat.requestChatResponse(participant, …)
   │ ExtHost 经 RPC getProxy(MainThreadChatAgents2).$invokeParticipant()
   ▼
③ 命中寄生实现 DshChatAgents.$invokeParticipant()
   │ 转调 ctx.ide.agents.create({ prompt, cwd: workspace, model })
   ▼
④ DSH ctx.agents 起一个 agent,进 agent-loop(turn/step)
   │ step 里模型要调 bash → ctx.tools['bash'] → ctx.sandbox 审批
   ▼
⑤ agent 调 fs/edit 改文件
   │ 走 MainThreadBulkEdits 寄生实现?否——见 §6 工作副本决策
   ▼
⑥ agent 的 text chunk 经 stream 回 DshChatAgents
   │ 转成 VS Code ChatResponseStream(markdown/进度)
   ▼
⑦ VS Code Chat 面板实时渲染;diff 经 vscode.diff 命令贴进编辑器
   │ 用户在 Monaco 看到 agent 的改动 + 可批准/回退
```

**关键:从用户视角,这就是 VS Code Copilot Chat 的样子,但每一次执行都过了 DSH 的 agent loop、沙箱、审批、session log。** 扩展、UI、文档模型全是 VS Code 的——只有"脑"是 DSH 的。这就是借尸还魂。

---

## 5. 替换优先级(78 个 Shape,分批)

按 native 体验贡献度排序,先通这批覆盖 80%:

| 优先级 | Shape | → DSH | 验证点 |
|---|---|---|---|
| **P0** | `MainThreadLanguageModels` | ctx.llm | VS Code chat 用的模型来自 DSH 适配器 |
| **P0** | `MainThreadChatAgents2` | ctx.agents | **chat 的对话循环 = DSH agent loop** |
| **P0** | `MainThreadTerminal` | ctx.terminals | 终端 = agent PTY,人命令与 agent 命令同处 |
| **P0** | `MainThreadBulkEdits` | ctx.tools(fs) | agent 的编辑落进 VS Code 文档模型 |
| P1 | `MainThreadLanguageFeatures`(诊断/补全) | ctx.lsp | problems/补全走 DSH LSP |
| P1 | `MainThreadCommands` / `MainThreadConfiguration` | ctx.commands / ctx.settings | 命令与配置归 DSH |
| P2 | `MainThreadFileSystem`(虚拟 fs provider) | ctx.fs | explorer/搜索走 DSH fs |
| P2 | `MainThreadWebviews` / `CustomEditors` | DSH slots | 扩展自定义 UI |
| no-op | 其余(认证/调试/notebook…) | 原生或优雅降级 | 渐进 |

**P0 四个通了,寄生法就立住**:chat 的脑、执行的手、文件改动、终端——全换成 DSH,其余维持 VS Code 原生。

---

## 6. 工作副本:借用,不重建(寄生法的隐藏红利)

我上一版“从 DSH 长”设计的命门是自建 `ctx.documents` 工作副本权威。寄生法**白拿 VS Code 的**:

- VS Code 工作台自带 `vs/editor` text model(editor group / text file model / dirty 跟踪)。
- agent 的 `edit`/`write` 工具,执行结果转成 `WorkspaceEdit` 经 `MainThreadBulkEdits` 应用——**直接写进 VS Code 文档模型**,与人未保存的编辑同处一个缓冲。
- 人的键盘编辑走 VS Code 原生;agent 的编辑经 BulkEdits 进同一模型。
- 持久化由 VS Code 的 `ITextFileService.save()` 触发 → 落盘走寄生后的 fs / sandbox。

**双写者归一,但权威模型是 VS Code 现成的,不新写。** agent 和人天然共用一个工作副本——这是寄生法比“从 DSH 长”省掉的最大一块硬骨头。

> 沙箱边界:落盘(save)经寄生 fs 时受 `ctx.sandbox`/`ctx.approval` 约束;VS Code 工作台自用的 settings/扩展存储走 host-internal 旁路,不进 workspace 沙箱。这条边界要在 §8 讲清。

---

## 7. DSH 侧改动(小)

寄生主要是 VS Code 侧写适配类 + 桥。DSH 侧改动很轻:

| DSH 包 | 改动 |
|---|---|
| **新增 `packages/ide/host`** | `ctx.ide` 适配层,暴露 lm/agents/tools/fs/lsp/terminals 的扁平方法(F2 直调) |
| **新增 `packages/ide/bridge-rpc`**(F1) | 把 `ctx.ide` 方法序列化成 JSON-RPC,经 MessagePort/stdio 给 VS Code 侧 |
| 复用 `packages/acp` | 若 F1 走 ACP 传输,ACP server 已有 session/prompt/cancel/permission,正好给 chat 数据流 |
| 复用全部现有 `ctx.*` | 不改内核 |
| 可选:新增 `ide` profile | 组合 host + bridge,`dsh --profile ide web` |

**DSH 内核零改动**——这是寄生的核心好处:心脏不动,只长出一条给宿主用的神经。

---

## 8. 边界与契约(必须画清)

1. **双执行世界归一**:Workspace 内的文件/终端/进程必须只经 DSH `ctx.*`。VS Code 工作台内部 IO(settings、扩展缓存、全局 storage)走 `host-internal` 旁路,标记为非 workspace,绕过沙箱——否则沙箱会锁死工作台自身。
2. **审批归属**:agent 触发的持久化(save/bash 落盘)过 `ctx.approval`;人的键盘编辑免审批(人是权威)。与“从 DSH 长”版一致,责任归属清晰。
3. **session log 完整**:chat 的 turn/step/tool/fs 事件都进 DSH session log;VS Code 的 chat 历史是它的 UI 状态,两者不混。**事实之源仍是 DSH session log**,VS Code chat 是它的一个呈现面。
4. **生命周期**:agent 的创建/销毁绑定 chat 会话;关 chat = dispose agent(走 DSH 清理),不留孤儿(ACP server 已有连接级 teardown,可复用)。

---

## 9. 风险与开放问题

1. **装饰器替换的可行性**:F1 能否在扩展里覆盖已被 VS Code 原生 `@extHostNamedCustomer` 注册的同一 `id`?需验证注册表是否允许后注册覆盖,或需 F3 在启动期改注册数组。这是 P0 第一件要试的事。
2. **流式语义对齐**:DSH 的 `assistant/chunk` 事件 vs VS Code `ChatResponseStream` 的 markdown/progress/anchor——映射非平凡,尤其工具进度与 reasoning。P0 要定映射表。
3. **RPC 序列化**:DSH 的 typed events(session/agent/tool)跨 RPC 要序列化,体积与延迟需测;F2 同进程直调可规避。
4. **多 host 一致性**:多个 chat 会话 ↔ 多个 DSH agent,session id 路由要严谨(ACP 已有 per-session keying)。
5. **扩展用了未实现 Shape**:优雅降级——返回 unsupported,不崩;P2/P3 渐进补齐。
6. **跟 upstream**:F3 补丁只动注册表少数行;F1/F2 零 fork。保持补丁面最小是寄生法相对 Cursor 全量 fork 的根本优势。

---

## 10. P0 验证(两周 PoC,直接证伪/证实寄生立论)

**目标:跑通 §4 数据流的前半段——VS Code Chat 面板 → DSH agent loop → agent 用 bash/fs 改代码 → VS Code 编辑器实时显示。**

最小切片(只 4 个 Shape):
- `MainThreadLanguageModels` → ctx.llm(模型来自 DSH)
- `MainThreadChatAgents2` → ctx.agents(chat 循环 = DSH loop)
- `MainThreadTerminal` → ctx.terminals(agent 的 bash 在 VS Code 终端可见)
- `MainThreadBulkEdits` → ctx.tools(fs)(agent edit 进 VS Code 文档模型)

用 F1(零 fork):一个 VS Code 扩展 + 一个 `dsh` 子进程(走 ACP 或 bridge-rpc)。
验收:
1. 在 VS Code Chat 输入“给 foo.ts 加一个 hello 函数”;
2. DSH agent 起 loop,调 bash/grep 找文件、调 edit 改文件;
3. VS Code 编辑器里 foo.ts 实时出现改动(dirty);
4. VS Code 终端面板里能看到 agent 跑的 bash;
5. session log 里完整可重放。

**这一步成立,寄生法就成立**——native 内核 + 全生态,同时拿到。

---

## 11. 寄生法 vs 前几路(终局对照)

| | ACP 桥 | 分叉 | 从 DSH 长 | **寄生** |
|---|---|---|---|---|
| 内核 | VS Code | fork | DSH | **DSH** |
| 生态 | ✅ | ✅ | ❌ 丢壳 | **✅ 全保** |
| 工作副本 | VS Code | VS Code | 新建(命门) | **VS Code 现成(白拿)** |
| UI 重写 | 无 | 无 | 6 插件 | **无** |
| 执行世界 | 两个(桥) | 硬掰一个 | 构造一个 | **寄生归一(改神经)** |
| native | ❌ | △ | ✅ 纯 | **✅(loop 为事实内核)** |
| 成本 | 低 | 高 | 高 | **中(适配层)** |

寄生是唯一同时拿 native + 生态 + 不全量重写 + 不新建工作副本的路。

---

## 12. 一句话

> 寄生法 = 在 VS Code 的 ExtHost↔MainThread 这条 RPC 神经上,用 DSH 的 `ctx.*`
> 替换 MainThread 服务实现(接入点是 `@extHostNamedCustomer` 注册表,已确认干净)。
> VS Code 的脸、扩展、文档模型全留着;模型、agent loop、工具、终端、沙箱、审批
> 全换成 DSH。**借尸还魂:尸是 VS Code 全生态,魂是 DSH native agent 内核。**
> P0 四个 Shape(语言模型/聊天/终端/批量编辑)通了即立住。
