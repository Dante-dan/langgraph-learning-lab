# 渐进练习

每个练习都用 Python 和 TypeScript 各实现一次。

1. **Request lifecycle**：定义 HTTP request/response schema，完成 JSON → `invoke` → JSON。
2. **Weather sequence**：运行真实天气 API，预测每个节点的 State diff。
3. **Deterministic routing**：实现 Yes/No、嵌套条件与明确 fallback。
4. **LLM router**：用 structured output 选择受限分支，再用代码复核硬规则。
5. **Bounded loop**：实现成功条件、最多三次尝试与 recursion limit。
6. **Tool Agent**：实现 model → tools → model / END 的动态循环。
7. **Streaming**：把 `updates` 事件适配为 SSE 或 WebSocket JSON frame。
8. **Durable thread**：加入 checkpointer，用相同 `thread_id` 恢复一次运行。
9. **Parallel research**：用 `Send` 创建动态 worker，并用 reducer 合并结果。
10. **Production review**：补齐超时、权限、幂等、观测、预算和敏感字段策略。

每题先写下你预测的 State diff，再运行代码验证。
