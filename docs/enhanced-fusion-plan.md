# 增强融合方案 — DSH Web UI 嵌入 VS Code + 完全体能力

> 目标:让 DSH 发挥完全体能力,Web UI 不丢失,深度融合到 VS Code。

---

## 问题诊断

当前设计有四个结构性缺陷导致 DSH 无法发挥完全体:

1. **Web UI 丢失** — DSH 自带的完整 React UI(对话流/审批/时间线/技能管理/模型选择/子代理目录/工作流视图)在 VS Code fork 里完全没有
2. **profile 缺包** — LSP/code-runtime/MCP/e2b/ACP 不在 agent-host profile 里
3. **文档模型分裂** — agent edit 走 ctx.fs 直改磁盘,VS Code 的 ITextModel 未保存编辑会冲突
4. **事件流未通** — Agent Host 进程拉起了但事件没流通到 VS Code

---

## 方案一:DSH Web UI 嵌入 VS Code Webview Panel(推荐)

### 核心思路

**不重写 UI,直接把 DSH 的 Web UI 嵌进 VS Code 的 Webview Panel。**

DSH 的 Web UI 是一个 React 18 + Vite 构建的 SPA,通过 `new AppWebEntry(el).run()` 挂载。它通过 HTTP + WebSocket 连接到 DSH host webserver。

VS Code 的 Webview Panel 是一个 iframe-like 的隔离环境,可以加载任意 HTML/JS/CSS。

### 架构

```
VS Code Workbench
  ├─ 编辑器区(Monaco,人编辑代码)
  └─ Webview Panel(DSH Web UI)
      ├─ 加载 DSH Web UI dist/(index.html + JS + CSS)
      ├─ 通过 HTTP/WebSocket 连接到 Agent Host 的 webserver
      └─ DSH Web UI 完整渲染:
          ├─ 对话流(thinking/tool 进度/diff 联动)
          ├<arg_value> 审批 UI(plan 待审/danger 操作阻塞)
          ├─ 会话管理(fork/resume/replay)
          ├─ 技能/插件管理面板
          ├─ 模型选择/设置
          ├─ 子代理目录
          └─ 工作流运行视图

Agent Host(独立进程)
  ├─ DSH Cordis 全树(dsh-base + web-app bundle)
  ├─ host-webserver(HTTP + WebSocket,serve Web UI dist + /api)
  ├─ ctx.agents/tools/fs/llm/sandbox/session/...
  └─ 全部 DSH 能力完整保留
```

### 实现步骤

#### 步骤 1:Agent Host profile 改为 web-app bundle

```yaml
# .dsh-home/profiles/agent-host/package.json
{
  "dsh": {
    "profile": {
      "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app"]
    }
  }
}
```

这让 Agent Host 加载 web-app bundle,包含:
- `host-webserver` — HTTP/WebSocket 服务
- `frontend-static` — serve Web UI dist
- `connection` — browser↔host 连接层
- `storage`/`workspace` — 持久化
- 全部 `client-ui-*` 的 host 侧

#### 步骤 2:Agent Host 启动 webserver

Agent Host 启动时,`host-webserver` 插件会自动在 `127.0.0.1:PORT` 上启动 HTTP 服务:
- `/` — serve Web UI dist/index.html
- `/api` — RPC bridge(HTTP POST + WebSocket)
- `/assets/*` — JS/CSS 静态资源

#### 步骤 3:VS Code Webview Panel 加载 DSH Web UI

在 VS Code fork 中创建一个 Webview Panel:

```ts
// vendor/vscode/src/vs/workbench/contrib/ultimateNative/dshWebviewPanel.ts
import { WebviewViewProvider, Webview } from 'vs/workbench/contrib/webview/browser/webview.js';

class DshWebviewProvider implements WebviewViewProvider {
  resolveWebviewView(view: WebviewView) {
    // Agent Host webserver 的地址
    const dshUrl = 'http://127.0.0.1:3080';

    // 设置 CSP 允许连接到 localhost
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [],
    };

    // 加载 DSH Web UI
    view.webview.html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta http-equiv="Content-Security-Policy"
          content="default-src 'none';
          script-src 'unsafe-eval' 'unsafe-inline' http://127.0.0.1:3080;
          style-src 'unsafe-inline' http://127.0.0.1:3080;
          connect-src http://127.0.0.1:3080 ws://127.0.0.1:3080;
          img-src http://127.0.0.1:3080 data: blob:;
          font-src http://127.0.0.1:3080;">
      </head>
      <body>
        <div id="root"></div>
        <script src="${dshUrl}/assets/index.js"></script>
      </body>
      </html>
    `;
  }
}
```

#### 步骤 4:注册为 VS Code View

```ts
// 在 agentHostIntegration.ts 中注册
Registry.as<IViewsRegistry>(ViewExtensions.Views)
  .registerViewContainers([{
    id: 'dsh-agent',
    title: 'Agent',
    icon: 'comment-discussion',
  }], ViewContainerLocation.Sidebar);

Registry.as<IViewsRegistry>(ViewExtensions.Views)
  .registerViews([{
    id: 'dsh-webview',
    name: 'Agent',
    ctorDescriptor: DshWebviewProvider,
  }], 'dsh-agent');
```

### 优势

- **DSH Web UI 完整保留** — 对话流/审批/时间线/技能/模型/子代理/工作流全可用
- **零 UI 重写** — 不需要写 React 组件,直接用 DSH 的
- **DSH 能力完全发挥** — web-app bundle 加载全部 host 侧 + client 侧
- **独立演进** — DSH Web UI 升级,VS Code 自动获得新功能
- **CSP 安全** — Webview 的 CSP 限制只连接 localhost

### 劣势

- **Webview 是 iframe 隔离** — DSH UI 和 VS Code UI 是两个世界(不能共享 Monaco/主题)
- **没有编辑器联动** — agent 的 editor.open/reveal 事件不能驱动 VS Code 的编辑器(需要额外桥接)
- **Webview 性能** — 比 native React 慢(iframe 开销)

---

## 方案二:增强融合 — 编辑器联动桥

在方案一基础上,增加 DSH Web UI ↔ VS Code 编辑器的双向联动:

### DSH → VS Code(agent 驱动编辑器)

DSH 的 `editor-as-tool` 工具发出 `editor-open`/`editor-show-diff` 事件。
在 Agent Host 侧拦截这些事件,通过 `postMessage` 转发到 VS Code Webview 的宿主:

```ts
// Agent Host 侧:拦截 editor-as-tool 事件,转发到 VS Code
ctx.onEvent((event) => {
  if (event.kind === 'editor-open' || event.kind === 'editor-show-diff') {
    // 通过 MessagePort 转发到 VS Code renderer
    vsCodeMessagePort.postMessage(event);
  }
});

// VS Code renderer 侧:接收事件,驱动编辑器
vsCodeMessagePort.on('message', (event) => {
  if (event.kind === 'editor-open') {
    editorService.openEditor({ resource: URI.file(event.path) });
  }
});
```

### VS Code → DSH(人选代码,发给 agent)

用户在 VS Code 中选中代码,右键"Send to Agent":
```ts
// VS Code 命令:发送选中的代码到 DSH agent
registerCommand('dsh.sendSelection', () => {
  const selection = activeTextEditor.selection;
  const text = activeTextEditor.document.getText(selection);
  const file = activeTextEditor.document.uri.fsPath;
  // 通过 HTTP POST 发给 Agent Host
  fetch('http://127.0.0.1:3080/api', {
    method: 'POST',
    body: JSON.stringify({ method: 'sendPrompt', args: [{ text: `File: ${file}\n${text}` }] }),
  });
});
```

---

## 方案三:profile 补全 — DSH 完全体能力

### agent-host profile 补全

```yaml
# .dsh-home/profiles/agent-host/cordis.patch.yml
- insert:
    # 终端(已有)
    - id: terminal
      name: '@deepseek-ai/dsh-terminal'
    - id: terminal-bash
      name: '@deepseek-ai/dsh-terminal-bash'
    - id: tool-terminal
      name: '@deepseek-ai/dsh-tool-terminal'

    # LSP(语言智能)
    - id: lsp
      name: '@deepseek-ai/dsh-lsp'
    - id: lsp-stdio
      name: '@deepseek-ai/dsh-lsp-stdio'
    - id: tool-lsp
      name: '@deepseek-ai/dsh-tool-lsp'

    # Code Mode(沙箱内运行代码)
    - id: code-runtime
      name: '@deepseek-ai/dsh-code-runtime-worker-thread'

    # MCP client(消费 MCP server)
    - id: mcp-client
      name: '@deepseek-ai/dsh-mcp-client'

    # E2B 云端执行(可迁移执行世界)
    - id: e2b
      name: '@deepseek-ai/dsh-e2b'
    - id: fs-e2b
      name: '@deepseek-ai/dsh-fs-e2b'
    - id: subprocess-e2b
      name: '@deepseek-ai/dsh-subprocess-e2b'

    # ACP server(互操作协议)
    - id: acp
      name: '@deepseek-ai/dsh-acp'
```

### 补全后的工具列表(预计 35+)

现有 31 个 + LSP(diagnostics/completion/definition/references) + code-runtime(run_code) + MCP(tools) = **35+ 工具**

---

## 方案四:文档模型融合 — 双写者归一

### 核心问题

DSH 的 `edit`/`write` 工具走 `ctx.fs` 直改磁盘。VS Code 的 ITextModel 有未保存的 dirty buffer。

### 解决方案:Agent Host 侧的 edit 工具路由

当 agent 调用 `edit`/`write` 时,不直走 ctx.fs,而是:
1. 检查目标文件是否在 VS Code 中打开(ITextModelService)
2. 如果打开:走 VS Code 的 BulkEditService(进 dirty buffer,不直改磁盘)
3. 如果没打开:走 ctx.fs(直改磁盘)

```ts
// Agent Host 侧:dsh-boot.ts 的 invokeTool 路由
async invokeTool(sessionId, tool, args) {
  if (tool === 'edit' || tool === 'write') {
    const path = args.file_path;
    // 通过 RPC 询问 VS Code:这个文件是否打开?
    const isOpen = await this.bridge.api.isFileOpen(path);
    if (isOpen) {
      // 走 VS Code BulkEditService(进 dirty buffer)
      await this.bridge.api.applyEdit({
        path,
        oldString: args.old_string,
        newString: args.new_string,
        provenance: { initiator: 'agent', sessionId, turn, step },
      });
      return { content: [{ type: 'text', text: `Edited ${path} (in editor buffer)` }], isError: false };
    }
  }
  // 默认:走 ctx.fs(直改磁盘)
  return this.kernel.invokeTool(sessionId, tool, args);
}
```

### VS Code 侧:applyEdit 实现

```ts
// workbench-bridge 侧
async applyEdit(req: { path, oldString, newString, provenance }) {
  const uri = URI.file(req.path);
  const resourceEdit = new ResourceTextEdit(uri, {
    range: await this.findRange(uri, req.oldString),
    text: req.newString,
  });
  // 走 ProvenanceBulkEditService(已经覆盖了 singleton)
  await bulkEditService.apply([resourceEdit], {
    metadata: { __provenance: req.provenance },
  });
}
```

### agent read 命中活内容

```ts
async isFileOpen(path: string): Promise<boolean> {
  return this.editorService.editors.some(e => e.resource?.fsPath === path);
}

async readFileLive(path: string): Promise<string | null> {
  const model = this.modelService.getModel(URI.file(path));
  return model?.getValue() ?? null;
}
```

---

## 实现优先级

| 优先级 | 方案 | 工作量 | 效果 |
|---|---|---|---|
| **P0** | profile 补全(LSP/code-runtime/MCP/e2b) | 1 小时 | DSH 35+ 工具完全体 |
| **P0** | profile 改为 web-app bundle | 1 小时 | Agent Host 启动 webserver |
| **P1** | Webview Panel 嵌入 DSH Web UI | 4 小时 | DSH 完整 UI 可见可用 |
| **P1** | Agent Host 实际 fork + webserver 启动 | 4 小时 | 事件流通通 |
| **P2** | 编辑器联动桥(DSH→VS Code open/reveal) | 4 小时 | agent 驱动编辑器 |
| **P2** | 编辑器联动桥(VS Code→DSH send selection) | 2 小时 | 人选代码发给 agent |
| **P3** | 文档模型融合(双写者归一) | 8 小时 | agent edit 进 dirty buffer |
| **P3** | agent read 命中活内容 | 4 小时 | agent 看到人未保存编辑 |

**P0+P1 完成 = DSH 完全体在 VS Code 里可见可用(约 10 小时)。**
P2+P3 完成 = 深度融合(编辑器联动 + 双写者归一,约 18 小时)。
