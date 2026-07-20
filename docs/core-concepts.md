# 核心概念

## 最小心智模型

- **State**：当前运行的共享事实和数据契约。
- **Node**：读取 State，执行计算或副作用，返回局部状态更新。
- **Edge**：决定下一个节点；可以固定、条件分支或动态并行。
- **Reducer**：定义同一个 State key 收到多个更新时如何合并。
- **Compile**：检查图结构，并绑定 checkpointer、interrupt 等运行能力。

LangGraph 以离散的 super-step 推进。一个 super-step 中被激活的节点可以并行执行；当没有活跃节点、也没有消息在途时，运行结束。

## 节点的职责类型

| 类型 | 负责什么 | 适用场景 |
| --- | --- | --- |
| 模型节点 | 理解、生成或决策 | 只有模型才能解决的不确定任务 |
| 工具节点 | 调用确定性外部能力 | 搜索、数据库、业务 API |
| 转换节点 | 验证、清洗、聚合 | 适合纯函数的确定性逻辑 |
| 人工节点 | 暂停并等待外部输入 | 审批、补充信息、高风险动作 |
| 子图节点 | 封装完整工作流 | 模块复用、多 Agent、团队边界 |

共同点是都围绕 State 工作；差异在于副作用、可重复性、延迟和失败策略。可预测的逻辑优先写普通代码，不确定性才交给模型。

## Node、Conditional Edge、Command、Send

- Node 做工作；Conditional Edge 只决定下一步。
- 如果需要同时更新状态并跳转，使用 `Command`。
- 如果下游任务数量只有运行时才知道，并需要为每个任务传入不同状态，使用 `Send`。

## LangGraph 在系统中的位置

```text
Web / App UI
    ↓ HTTP / streaming
Application API
    ↓ invoke / stream
LangGraph runtime
    ├─ OpenAI / other models
    ├─ tools and business services
    ├─ checkpointer
    └─ long-term store
```

LangGraph 负责流程、状态与恢复；模型提供推理；工具连接真实世界；数据库保存运行状态。它不会把 ChatGPT 订阅转换成 API 权益。

