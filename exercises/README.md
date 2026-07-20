# 渐进练习

每个练习都用 Python 和 TypeScript 各实现一次。

1. **Hello Graph**：定义 `topic` 与 `answer`，完成 START → draft → END。
2. **Routing**：根据输入类型进入 docs 或 web 节点，并设置明确结束路径。
3. **Parallel Research**：用 `Send` 创建未知数量的 worker，并用 reducer 合并 findings。
4. **Durable Agent**：加入 checkpointer；用相同 `thread_id` 恢复一次运行。
5. **Human Review**：在 publish 前 interrupt；批准后 resume，拒绝则进入 revise。
6. **Production Blueprint**：增加 streaming、超时、重试、幂等写入和 trace 字段。

每题先写下你预测的 State diff，再运行代码验证。

