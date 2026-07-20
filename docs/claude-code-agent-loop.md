# 从 Claude Code 理解一个完整 Agent

> 这是一份基于公开接口建立的参考模型，不是对 Claude Code 未公开内部源码的断言。

## 先分清：按键事件与 Agent turn

用户输入第一个字符时，终端 UI 先更新本地 buffer。`/`、`@` 等特殊前缀可以触发命令、文件或 MCP resource 的 autocomplete；继续输入只需对本地索引重新做过滤。公开资料没有说明 Claude Code 会为每个普通字符调用 LLM 猜测整句话。

按下回车后，整行才成为一条提交的 prompt。Claude Agent SDK 暴露的 `UserPromptSubmit` hook 也把“提交”定义为清晰生命周期边界。

## 按下回车后的链式反应

```text
Prompt submit
  → 装配 session history、项目指令、cwd、tools、permissions
  → 调用 LLM
  → 返回文本或 tool_use
  → [文本] 流式返回用户
  → [tool_use] 参数/权限/策略验证
  → 执行 Read / Edit / Bash / MCP
  → tool_result 写回消息历史
  → 再次调用 LLM
  → 完成 / 用户取消 / 最大 turns / 超时 / 预算耗尽
  → 保存 transcript；必要时更新项目 memory
```

这对应 LangGraph 的：

```text
START → model → has_tool_calls? → tools → model ↺
                    └──────── no ─────────→ END
```

## 怎样判断完成

完成判断不应只依赖模型说“完成了”。系统可以组合以下证据：

- 模型没有继续发出 tool call，并给出最终答复。
- 编译、测试、lint 或业务验收节点通过。
- 必需的输出文件或结构化结果存在且符合 schema。
- 用户取消、超时、预算或 max turns 触发强制停止。
- 高风险任务到达人工审批节点。

## 三种容易混淆的 memory

| 概念 | 生命周期 | LangGraph 类比 |
|---|---|---|
| Working context | 一次模型请求可见的消息与工具结果 | 当前 State 的 messages |
| Session transcript | 支持 continue / resume 的会话记录 | thread + checkpoint |
| Project memory | CLAUDE.md 中跨会话加载的项目指令 | 长期配置 / store，不是 checkpoint |

## 服务端参考分层

```text
Terminal UI
  → Local session runtime（context、permissions、tool registry、agent loop）
  → Model API / LLM gateway（认证、预算、审计、模型路由、streaming）
  → Tool execution（filesystem、shell、MCP、tests、business APIs）
```

公开 CLI 支持 text、JSON 与 stream-JSON 输入输出、session continue/resume、允许/禁止工具和 max turns。权限系统位于工具执行前；hooks 可在 prompt 提交、工具前后、停止与压缩等边界插入确定性逻辑。

## 公开资料

- [Claude Code CLI reference](https://docs.anthropic.com/en/docs/claude-code/cli-usage)
- [Claude Code memory](https://docs.anthropic.com/zh-CN/docs/claude-code/memory)
- [Claude Agent SDK hooks](https://docs.claude.com/it/api/agent-sdk/python)
- [Claude Code security](https://docs.anthropic.com/en/docs/claude-code/security)
- [Claude tool use](https://docs.claude.com/es/docs/agents-and-tools/tool-use/overview)
