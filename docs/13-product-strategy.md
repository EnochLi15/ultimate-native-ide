# 开放 Native IDE —— 产品方案

> 基于「寄生式架构」(VS Code 全生态 + DSH native agent 内核),
> 如何交付一个完整的 AI native IDE 产品。

---

## 0. 产品定位:填一个三元空白

当前 AI IDE 市场只有两类,且互斥:

| | Native | 开放 | VS Code 生态 |
|---|---|---|---|
| Cursor | ✅(fork 改内核) | ❌(封闭 agent/模型/路由) | ✅(fork 继承) |
| Windsurf | ✅ | ❌ | ✅(fork 继承) |
| Continue.dev | ❌(无 native agent loop) | ✅ | ✅(扩展) |
| Zed | ✅ | ✅ | ❌(生态从零) |
| Claude Code/Codex CLI | ✅ | ✅ | ❌(终端,非 IDE) |

**空缺:既 native、又开放、又保 VS Code 生态——三者同时成立。** 寄生架构是技术上唯一能填这个空的路径(MainThread 神经替换,已确认接入点干净)。

**一句话定位:**
> 一个开放的 AI native IDE——你用着 VS Code 的全部生态与熟悉界面,背后是 DeepSeek Harness 的原生 agent 内核;模型、执行环境、工具、能力全部可换,但 native 体验一分不让。

---

## 1. 双轨交付形态(寄生法的天然分发红利)

寄生法的 F1(扩展)/F2(内嵌)/F3(薄 fork)恰好对应两个互补的分发渠道:

### 轨道 A:扩展形态(F1)——「装上就 native」
- 一个 VS Code 扩展 + 一个 DSH 后端进程(本地或云端)。
- 用户**不换 IDE**:在已有的 VS Code / VS Code Insiders / VSCodium / Cursor 上装这个扩展,立即获得 DSH native agent。
- 分发:VS Code Marketplace / Open VSX。
- 价值:**零切换成本触达海量 VS Code 用户**,是增长漏斗的入口。
- 上限:个别 MainThread Shape 若扩展层无法覆盖,降级到 F3 薄 fork。

### 轨道 B:独立发行(F2/F3)——「开箱即用的完整产品」
- 预装好的发行版:VS Code + DSH + 寄生层 + 预设 `ide` profile,一个品牌、一个下载。
- 默认值可控:默认模型、默认沙箱策略、默认 skill 集、默认布局(编辑器为主、chat 为伴)。
- 价值:**完整品牌体验、可控默认、可绑定云服务**;对不愿折腾的用户和企业友好。
- 维护成本:刻意保持 F3 补丁面最小(只动 `@extHostNamedCustomer` 注册表少数行),远小于 Cursor 全量 fork。

**两轨同一内核、同一寄生层、同一 profile**——A 是 B 的「轻量入口」,B 是 A 的「完整交付」。用户从 A 平滑升到 B,数据/配置/会话互通(都落在 DSH session log 与 home)。

---

## 2. 功能矩阵:技术能力 → 用户价值

寄生架构的每个技术接缝,翻译成用户可感知的产品功能:

| 技术能力(寄生接入点) | 用户看到的产品功能 | 为什么 native |
|---|---|---|
| `MainThreadChatAgents2` → `ctx.agents` | Chat 面板的 AI **能自主多步执行**(找文件、改代码、跑测试、自我修正),不是只回文字 | agent loop 是对话的内核,不是补全 |
| `MainThreadLanguageModels` → `ctx.llm` | 模型可换:DeepSeek / OpenAI / Anthropic / 本地,一处配置全局生效 | 不被绑死在某家模型 |
| `MainThreadTerminal` → `ctx.terminals` | agent 跑的命令**就在你的终端面板里**,可见、可复用、可接管 | 一个执行世界,人机共用终端 |
| `MainThreadBulkEdits` → `ctx.tools`(fs) | agent 的改动**实时进编辑器**(dirty),你 review diff、批准/回退 | agent 与人同写一个工作副本 |
| `ctx.sandbox` + `ctx.approval` | 危险操作**要你点头**;可设 workspace-write / danger-full-access / read-only | 执行主体变了,责任归属显式 |
| `ctx.sessions`(session log) | 对话可**重放、分支、恢复**;工程决策留档 | 会话是事实之源,非聊天记录 |
| `ctx.lsp` → `MainThreadLanguageFeatures` | 诊断/补全/定义/引用走 DSH LSP,与 agent 共享同一语言后端 | 语言智能不分裂 |
| **e2b 可迁移执行世界** | 一键把 agent 的执行放进**云端安全沙箱**(本地代码不落地执行) | 见 §3,独有 |
| `ctx.skills` + `ctx.mcp` | 第三方**技能包/工具市场**,agent 能力可扩 | 开放生态 |
| `ctx.subagent` / `ctx.workflow` | agent 能**派生子任务、并行编排** | 超越单线对话 |

---

## 3. 独有卖点:可迁移的执行世界(架构级护城河)

这是寄生法 + DSH 组合带来的、竞品架构上做不到的能力:

> DSH 的执行世界(fs + subprocess + terminal + lsp)是一组**可替换的 provider seam**。
> 挂 `fs-local`/`subprocess-local` → agent 在你本地执行;
> 挂 `fs-e2b`/`subprocess-e2b` → 整个执行世界**零代码切换到 E2B 云端 Linux 沙箱**,
> 而 bash/terminal/lsp 自动跟随(它们只 delegate 给 ctx.fs/ctx.subprocess,不认具体后端)。

产品形态:

- **本地模式**:agent 在你机器上跑,landlock/ACL 沙箱 + 审批(开发者日常)。
- **云端模式**:agent 在云端沙箱跑——跑危险实验、跨平台验证、CI 类批量任务、不污染本机。你的编辑器仍是 VS Code,只是"手"伸到了云上。
- **一键切换**:profile 切换或会话级选择,同一个会话的 agent 可在本地/云端间迁移。

> Cursor/Windsurf 的 agent 绑死在本地 fork 进程;Continue 没有完整执行世界。**「agent 的手可以伸到云端,而脸还在你的 VS Code 里」**——这是只有开放 native 内核能提供的产品体验,也是企业版的核心卖点(隔离、审计、弹性)。

---

## 4. 开放生态策略(四个可换)

「开放」要落到可交付的产品属性,不是口号。DSH 已具备四个可换 seam:

| 可换 | DSH seam | 产品面 | 谁来贡献 |
|---|---|---|---|
| **模型** | `ctx.llm`(`llm-deepseek`/`llm-pi-ai`/可选 codex/claude-code) | 设置里选模型/路由 | 模型厂商、用户自带 key |
| **执行环境** | `ctx.fs`/`ctx.subprocess`(local / e2b / 未来更多) | 本地/云端/远程切换 | 沙箱厂商、企业自建 |
| **工具** | `ctx.tools`(bash/fs/grep/glob/terminal/lsp…) | 工具集可裁剪/扩展 | 社区 `dsh-plugin` |
| **能力(skill)** | `ctx.skills` + `ctx.mcp` | 技能市场、MCP server 接入 | 社区、企业内知识 |

配套机制(均已存在):`credentials` 分离 reference/provider(用户填 key 不泄露)、`profile`/`bundle` 预设组合、`dsh-plugin` GitHub topic 可发现。

> 这意味着产品不是「DeepSeek 的 IDE」,而是「**一个内核开放、任何模型/沙箱/能力都能插的 native IDE**」——DeepSeek 可以是默认 provider,但不锁死。这是对 Cursor 封闭模式的根本差异化。

---

## 5. 与竞品的产品级差异

| 维度 | 本产品(寄生+DSH) | Cursor | Continue | Windsurf | Zed |
|---|---|---|---|---|---|
| native agent loop | ✅ DSH | ✅ 自有 | ❌ | ✅ | ✅ |
| VS Code 扩展全兼容 | ✅ | ✅(fork) | ✅ | ✅(fork) | ❌ |
| 模型可换(不绑死) | ✅ | ❌ | ✅ | ❌ | ✅ |
| 执行世界可迁移(云端) | ✅ 架构级 | ❌ | ❌ | ❌ | △ |
| 沙箱+审批一等公民 | ✅ | △ | ❌ | △ | ❌ |
| 会话可重放/分支 | ✅ session log | △ | ❌ | △ | ❌ |
| 不 fork / 好跟 upstream | ✅(F1 零 fork,F3 薄补丁) | ❌ | ✅ | ❌ | n/a |
| 开源 | ✅ MIT | ❌ | ✅ | ❌ | ✅ |

**护城河 = native + 开放 + 执行可迁移,三者互锁。** 单抄一项难,三者同构地成立需要 DSH 这套插件化内核 + 寄生接入,是组合壁垒。

---

## 6. 默认体验设计(产品化的关键)

「装上即好用」的默认值(由 `ide` profile 预设):

1. **首启**:检测已有 VS Code → 引导装扩展(F1);或下载独立发行(F2)。填一个模型 key(DeepSeek 优先,带试用额度)。
2. **默认模型**:DeepSeek,thinking 可见、reasoning effort 可调。
3. **默认沙箱**:`workspace-write` + 审批(危险操作问)。开发者可切 `danger-full-access`。
4. **默认布局**:编辑器为主区,Chat 为侧伴;终端/问题面板可下拉。**不是「chat 占主屏」**——这是 native 形态与插件式 IDE 的视觉分水岭。
5. **默认 skill 集**:代码导航、测试、git、重构等内置技能预装。
6. **Onboarding 任务**:一个引导式 agent 任务(「让 AI 帮你读懂这个项目」),让用户在 5 分钟内体验到 agent 自主多步执行。

---

## 7. 路线图(对齐寄生架构 P0–P2)

| 阶段 | 架构(寄生) | 产品里程碑 | 交付 |
|---|---|---|---|
| **M0 命门验证** | P0:4 个 Shape(lm/chat/terminal/bulkEdits)接 DSH | PoC:VS Code Chat → DSH agent → 改代码进编辑器 | 内部 Demo |
| **M1 扩展 alpha** | P0 稳定 + P1 部分(commands/config/lsp) | 轨道 A 扩展,邀请制;本地模式;DeepSeek 模型 | Marketplace 限内部 |
| **M2 扩展公测** | P1 完整 + P2(fs/webview/customEditor) | 公测;多模型;skill 加载;基本审批 UX | Open VSX + Marketplace |
| **M3 独立发行** | F2 内嵌 + F3 薄补丁 | 轨道 B:品牌发行版;可控默认;完整布局 | 官网下载 |
| **M4 云端执行** | e2b 适配进 ide profile | 云端沙箱模式;会话级本地/云切换;企业隔离 | 企业版 |
| **M5 生态** | skill/mcp 市场基础设施 | 第三方技能/工具市场;`dsh-plugin` 发现 | 社区运营 |

每个 M 都有清晰的「寄生 Shape 接入」对应——**产品里程碑与技术架构同节奏**,不脱节。

---

## 8. 商业模式(开源核心 + 云/企业)

- **开源核心**:DSH(MIT)+ 寄生层 + `ide` profile,全开源。社区可自建、自托管、换模型。这是「开放」承诺的可信基础。
- **托管云服务**:模型路由(免 key 即用)、云端执行(e2b 弹性沙箱)、会话同步/团队共享——按用量订阅。开发者免费额度。
- **企业版**:SSO/审计/合规/私有模型网关/私有沙箱/策略管控(审批与沙箱策略的企业级预设)。
- **不靠锁定变现**:核心开源,价值在「省心托管 + 企业治理 + 云端执行」,而非把 agent/模型锁死。这是与 Cursor 封闭模式的产品哲学分野。

---

## 9. 风险与边界

1. **寄生 Shape 覆盖度**:78 个 Shape,扩展层能否覆盖关键的几个(F1)需 M0 先验证;不行则 F3 薄 fork 兜底,保持补丁最小。
2. **流式语义映射**:DSH `assistant/chunk`/tool 进度 → VS Code `ChatResponseStream` 的映射非平凡,影响体验细腻度;M1 要定映射表并做 REAL 测试。
3. **执行世界边界**:VS Code 工作台自用 IO(settings/扩展存储)必须走 host-internal 旁路,不进 workspace 沙箱,否则沙箱锁死工作台——M0 要画清这条线。
4. **「开放」的反噬**:模型/沙箱可换 = 默认体验难统一。对策:强势默认(DeepSeek + 本地沙箱 + 预设 skill),开放是「可改」而非「必须配」。
5. **Cursor 的先发与品牌**:差异化必须靠「开放 + 执行可迁移」讲清,不要在「又一个 Cursor」的框架里竞争。
6. **VS Code upstream 漂移**:F3 补丁面小是关键纪律;F1/F2 零 fork 是常态。建立 upstream 跟踪与补丁回归测试。

---

## 10. 一句话总结

> 用寄生架构把 DSH 装成 VS Code 的神经:双轨交付(扩展入口 + 独立发行),
> 四个可换(模型/执行/工具/技能),独有「执行世界可迁移到云端」的架构级护城河,
> 开源核心 + 云/企业变现。填的是「native 且开放 且 保生态」的三元空白——
> 这是 Cursor(封闭 native)、Continue(开放非native)、Zed(开放但丢生态)都给不了的组合。
