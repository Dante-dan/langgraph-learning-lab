# 常用 API 图鉴

| API | 场景 | 注意 |
| --- | --- | --- |
| `StateGraph` | 自定义状态化工作流 | 编译后才可调用 |
| `add_node` / `addNode` | 注册模型、工具、转换、人工或子图节点 | 返回局部更新 |
| `add_edge` / `addEdge` | 固定流向或并行扇出 | 多个出边会并行 |
| `add_conditional_edges` | 分支、循环、结束判断 | 路由函数保持纯净 |
| `Command` | 更新状态并跳转、恢复 interrupt | 静态边仍会执行 |
| `Send` | map-reduce、动态 worker | 每个任务可带不同子状态 |
| `interrupt` | 审批和补充信息 | 需要 thread_id + checkpointer |
| `stream` / `astream` | UI 增量展示与可观测性 | 明确 stream mode |
| `Checkpointer` | 恢复、时间旅行、线程状态 | 不等于长期记忆 |
| `Store` | 跨线程用户偏好与知识 | 生命周期不同于 checkpoint |
| `ToolNode` | 标准工具调用循环 | 仍需错误和权限策略 |
| `Subgraph` | 可复用模块、多 Agent | 对齐父子 schema/reducer |

