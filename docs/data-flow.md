# 数据流与序列化

## 数据如何流转

1. 输入先符合 graph 的 input schema。
2. 节点收到当前 State，以及可选的 config / runtime context。
3. 节点返回局部更新，而不是整个 State。
4. 每个字段的 reducer 合并更新；没有 reducer 时通常采用覆盖语义。
5. Checkpointer 在 super-step 边界保存快照。
6. output schema 控制最终对调用方可见的字段。

## JSON 还是其他格式

- 进程内优先使用类型化对象：TypedDict、Pydantic、Zod、LangChain Message。
- HTTP、队列、日志等跨服务边界通常使用 JSON。
- Message 对象在边界处可表示为 `{ role, content }` 等 JSON 结构，再由消息 reducer 反序列化。
- 二进制、大文件和 embedding 不应直接塞进 State；保存引用或对象存储地址。

## 序列化规则

- State 只保存可重放的事实，不保存客户端连接、文件句柄或模型实例。
- 日期、Decimal、枚举、自定义类应有明确的编码/解码策略。
- 外部 payload 添加 `schema_version`。
- 副作用节点必须幂等，因为失败重试和 checkpoint 恢复都可能重放节点。
- Checkpoint 是线程内运行状态；Store 是跨线程长期记忆，不要混用。

