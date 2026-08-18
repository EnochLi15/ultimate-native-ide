# 终极 AI Native IDE —— 设计方案

> 定义「好用的、终极版」的产品形态、交互范式、体验原则与差异化。
> 架构机制见《架构文档》;落地步骤见《实现方案》。

---

## 1. 产品定位

一个开放的 AI native IDE:用着 VS Code 的全部生态与熟悉界面,背后是 DSH 的原生 agent 内核;agent loop 是调度内核,模型/执行/工具/能力全部可换,native 体验一分不让。

填三元空白:既 native、又开放、又保 VS Code 生态——三者同时成立。Cursor(封闭native)/Continue(开放非native)/Zed(开放但丢生态)都给不了的组合。

---

## 2. native 的定义(设计宪法)

四条判据,产品每个特性都据此审视:

1. **agent loop 是调度内核**——agent 能主动发起动作,非被动补全。
2. **session log 是事实之源**——会话是项目工作记忆,非聊天记录。
3. **单一执行世界**——人/agent 同一个终端、文件、诊断。
4. **编辑器是 agent 的工具也是人的审查面**——双身份同写一个副本。

凡不满足者,是「带 chat 的 IDE」,非 native,不纳入终极版。

---

## 3. 核心交互范式

### 范式一:意图→执行→审查(反转编辑主语)
传统:人逐字符编辑。终极:人表达意图,agent 探索实现验证,人审查。
- 人输入「重构 bar 函数提取公共逻辑」
- agent 自主:grep 定位→读上下文→生成 plan→(审批)→多文件 edit→跑测试→自我修正
- 人审查:diff 视图、终端输出、时间线;可批准/回退/接管

### 范式二:agent 编排工作区(主动权)
agent 不只在侧栏说话,能主动操作工作台:
- editor.open/reveal:agent 关心哪段,编辑器自动跳过去
- editor.showDiff:改前先给 diff 等审批
- workbench.setLayout:为任务重塑布局(对话模式/编辑模式/审查模式)
- terminal.focus:把 agent 正在跑的命令终端推到前台

### 范式三:多视图投影(会话即工作记忆)
session log 不只渲染成对话,而是多平级视图:
- 对话流(传统)
- 时间线(编辑/命令/对话交织,可回放)
- 任务树(goal/plan/todo/subagent 层级)
- 分支视图(从任意 turn fork 新分支)
人按当前任务选视图,它们是同一事实之源的不同切面。

### 范式四:审批是一等交互
plan 待审、危险操作待批,以阻塞式 UI 呈现,不让 agent 偷跑。
- sandbox 模式:workspace-write(默认)/danger-full-access/read-only
- 审批策略:ask/never(高危默认 ask)
- 责任归属:谁触发持久化/执行,谁过契约

---

## 4. 形态设计

### 主形态:编辑器为主,agent 为主动编排者
分水岭:不是「chat 占主屏、编辑器附属」(Cursor 式),而是「编辑器为主区、agent 编排整个工作区」。

布局:
```
┌──┬─────────────────────┬────────┐
│活 │ explorer/problems   │ editor │ ← 主区(Monaco,多 tab)
│动 │ (可切)              │────────│
│栏 │                     │terminal│ ← 可下拉
└──┴─────────────────────┴────────┘
   sidebar    conversation(IDE=editor+terminal)  details(diff/inspect)
```
agent 面:可全屏(任务模式)/可内联(选代码就地对话)/可收成命令栏。非固定侧栏。

### 视图模式(可由 agent 或人切换)
- **编辑模式**:编辑器为主,agent 收为命令栏
- **任务模式**:agent 面全屏,编辑器为预览(agent 主导多步执行时)
- **审查模式**:diff + 时间线并排(plan 审批或回放时)

---

## 5. 能力矩阵(技术→用户价值)

| 技术 | 用户功能 | native 性 |
|---|---|---|
| AgentHost→ctx.agents | agent 自主多步执行(找/改/测/修正) | loop 是内核 |
| ctx.llm | 模型可换,一处配置全局 | 不绑死 |
| ctx.terminals | agent 命令就在你的终端面板 | 一个执行世界 |
| BulkEdit+provenance | agent 改动实时进编辑器,可查谁改的 | 同写一个副本 |
| sandbox+approval | 危险操作要你点头 | 责任显式 |
| session log | 对话可重放/分支/恢复 | 会话=工作记忆 |
| ctx.lsp | 诊断/补全/引用人机共用 | 语言智能不分裂 |
| e2b 迁移 | agent 手伸到云端,脸在编辑器 | 独有护城河 |
| ctx.skills+mcp | 技能/工具市场 | 开放生态 |
| subagent/workflow | agent 派生子任务/并行编排 | 超越单线 |

---

## 6. 独有卖点:可迁移执行世界(护城河)

DSH 执行世界是可替换 provider seam。挂 fs-local→本地执行;挂 fs-e2b→整个执行世界零代码迁云,bash/terminal/lsp 自动跟随(只 delegate 给 ctx.fs/ctx.subprocess)。

产品含义:agent 的手伸到云端,脸还在 VS Code。Cursor/Windsurf agent 绑死本地 fork;Continue 无完整执行世界。企业版核心:隔离/审计/弹性。

---

## 7. 开放产品属性(四可换)

| 可换 | 体现 | 谁贡献 |
|---|---|---|
| 模型 | 设置选,不绑死 | 厂商/用户自带 key |
| 执行环境 | 本地/云/远程切换 | 沙箱厂商/企业自建 |
| 工具 | 裁剪/扩展,dsh-plugin | 社区 |
| 能力 | 技能市场/MCP 接入 | 社区/企业内知识 |

产品不是「DeepSeek 的 IDE」,是「内核开放、任何模型/沙箱/能力都能插的 native IDE」。DeepSeek 可作默认,不锁死——对 Cursor 封闭模式的根本分野。

---

## 8. 默认体验(开箱即用)

- 首启:填模型 key(DeepSeek 优先+试用额度)
- 默认模型:DeepSeek,thinking 可见,effort 可调
- 默认沙箱:workspace-write+审批;可切 danger-full-access
- 默认布局:编辑器为主,agent 为伴
- 默认 skill 集:代码导航/测试/git/重构预装
- Onboarding:5 分钟引导任务「让 AI 读懂这个项目」,体验自主多步执行

---

## 9. 差异化对照

| 维度 | 本产品 | Cursor | Continue | Windsurf | Zed |
|---|---|---|---|---|---|
| native loop | ✅DSH | ✅自有 | ❌ | ✅ | ✅ |
| VS Code 扩展 | ✅ | ✅fork | ✅ | ✅fork | ❌ |
| 模型可换 | ✅ | ❌ | ✅ | ❌ | ✅ |
| 执行可迁云 | ✅架构级 | ❌ | ❌ | ❌ | △ |
| 沙箱+审批一等 | ✅ | △ | ❌ | △ | ❌ |
| 会话重放/分支 | ✅ | △ | ❌ | △ | ❌ |
| 开源 | ✅MIT | ❌ | ✅ | ❌ | ✅ |

护城河 = native + 开放 + 执行可迁移,三者互锁,组合壁垒。

---

## 10. 商业模式

- **开源核心**:DSH(MIT)+ fork 工作台+深合约,全开源
- **托管云**:模型路由(免key)、e2b 弹性沙箱、会话同步——按用量订阅
- **企业版**:SSO/审计/合规/私有网关/策略管控

不靠锁定变现,价值在省心托管+企业治理+云执行。

---

## 11. 一句话

> 编辑器为主、agent 为主动编排者;会话是项目工作记忆可重放可分支;执行世界单一且可迁云;模型/工具/能力四可换。这是「native 不让步、生态不丢失、开放是脊柱」的终极形态——把 DSH 的脑装进 VS Code 的身体,深度融合为一个 body。
