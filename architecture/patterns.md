# 业界常见架构模式

## 选择顺序

1. 能否用固定函数完成？能则不要引入 Agent。
2. 路径是否固定？固定则用 prompt chain。
3. 是否只有入口分类不同？使用 router。
4. 子任务数量是否动态？使用 orchestrator–worker + Send。
5. 是否有明确质量标准？使用 evaluator–optimizer。
6. 是否需要外部授权？在副作用前 interrupt。
7. 是否跨分钟、小时或天？使用 checkpoint、幂等副作用和可恢复部署。

## 生产清单

- State 字段有清晰所有者、类型与 reducer。
- 每个循环都有退出条件和 recursion limit。
- 模型输出经过 schema 验证。
- 工具参数、权限与超时在服务端验证。
- 写操作有 idempotency key。
- thread_id 与用户/会话的映射稳定。
- stream 事件不会泄露密钥或内部思维过程。
- 长期记忆与 checkpoint 分开建模。
- 对关键路径保存 trace、延迟、token 与失败原因。
- 子图按领域或生命周期切分，而不是按“Agent 人设”堆叠。

