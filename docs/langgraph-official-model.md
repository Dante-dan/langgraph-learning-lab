# LangGraph 官方概念与编排语义核对

> 核对日期：2026-07-21  
> 来源范围：LangChain / LangGraph 当前官方文档与官方 API Reference。本文把“官方事实”和“本站教学解释”分开，避免把类比当成框架定义。

## 结论先行

1. **LangGraph 不是官方所称的“一个应用程序”**。官方把它定义为用于构建、管理和部署长时运行、有状态 Agent 的低层编排框架与运行时；它专注于 durable execution、streaming、human-in-the-loop、persistence 等编排能力。[官方 Overview](https://docs.langchain.com/oss/python/langgraph/overview)
2. **`StateGraph` 是 builder，不是可直接执行的运行实例**。调用 `compile()` 后得到 `CompiledStateGraph`；后者实现 Runnable 接口，可以 `invoke`、`stream`、batch 和异步执行。[StateGraph Reference](https://reference.langchain.com/python/langgraph/graph/state/StateGraph) · [compile Reference](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/compile)
3. **LangGraph 的 Graph 不是只能表示 DAG**。边有方向，但官方明确支持循环工作流；因此更准确的说法是“可能含环的有向执行图”，DAG 只是它能表达的一种拓扑。[Graph API](https://docs.langchain.com/oss/python/langgraph/graph-api) · [Graph API 使用指南：Loops](https://docs.langchain.com/oss/python/langgraph/use-graph-api#create-and-control-loops)
4. **无限循环不是一种被编译器静态禁止的拓扑**。循环本身受支持；缺少停止条件的执行会持续推进，最终触发 recursion limit 并抛出 `GraphRecursionError`。所以网站不应写“LangGraph 不支持环/无限循环”，而应写“无停止条件的循环不是可正常完成的运行设计，会被运行时保险丝中止”。[GRAPH_RECURSION_LIMIT](https://docs.langchain.com/oss/python/langgraph/errors/GRAPH_RECURSION_LIMIT)
5. **State 不是不可逆、只能追加的流水账**。默认 reducer 会覆盖旧值，自定义 reducer 可以合并或累积；checkpoint 还支持 replay、fork 和 `update_state`。官方建议节点返回局部更新，不直接修改传入的 state。[Reducers](https://docs.langchain.com/oss/python/langgraph/graph-api#reducers) · [Time travel](https://docs.langchain.com/oss/python/langgraph/use-time-travel)
6. **一个名叫 `ask_user` 的节点不自动等于 Human-in-the-Loop**。只有当执行通过 `interrupt()` 暂停、用 checkpointer 保存状态，并以相同 `thread_id` 和 `Command(resume=...)` 恢复时，才是在使用 LangGraph 官方的 HITL interrupt 机制。[Interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts)

---

## 1. LangGraph 到底是什么

### 官方事实

官方 Overview 将 LangGraph定位为低层的 orchestration framework and runtime，用来构建长时运行、有状态的 Agent；同时明确说明它不负责抽象 prompt 或规定 Agent 架构，也可以脱离 LangChain 使用。[官方 Overview](https://docs.langchain.com/oss/python/langgraph/overview)

官方产品分层是：

- LangChain：更高层的 Agent 框架与常见 Agent / tool loop 抽象；
- LangGraph：编排运行时，提供 durable execution、streaming、HITL 与 persistence；
- LangSmith：追踪、评测、调试与部署平台。

相同定义见官方的 [Frameworks, runtimes, and harnesses](https://docs.langchain.com/oss/python/concepts/products)。

### 本站可采用的教学解释

可以说：

> 在一个 Web 系统里，LangGraph 通常位于路由/API 层之后、模型与工具之前，负责推进工作流、合并状态、暂停与恢复。`builder.compile()` 得到的是应用可以调用的执行单元。

不要说：

> LangGraph 本身更像一个应用程序，而不是框架。

这会混淆产品与实例。更准确的三层关系是：

```text
LangGraph package             框架 + 运行时能力
StateGraph builder            图定义 / 构建器
CompiledStateGraph instance   当前应用可 invoke / stream 的执行单元
```

官方 Runtime 文档进一步说明：编译 `StateGraph` 会产生一个可用输入调用的 Pregel 运行实例；`StateGraph` 是创建 Pregel application 的高层 API。[LangGraph runtime](https://docs.langchain.com/oss/python/langgraph/pregel)

---

## 2. 五个最先出现的概念

| 概念 | 官方语义 | 不应误解为 | 建议图形语义 |
| --- | --- | --- | --- |
| `State` | 应用当前快照的共享数据结构；包含 schema，以及各字段应用更新时使用的 reducer | 某个节点私有的局部变量；永远只追加的日志 | 放在图旁边的“当前快照/数据面板”，不要混成业务节点 |
| `Node` | 同步或异步函数；读取当前 State，执行计算或副作用，返回 State 的局部更新 | 固定只能是 LLM；一个只能运行一次的步骤 | 实心圆角矩形；不同业务角色可在同一 Node 色系内用图标区分 |
| `Edge` | 有向连接；固定边直接决定下一节点，条件边通过 routing function 选择一个或多个目标 | 搬运一份独立 JSON 对象的管道；只能从屏幕左侧走到右侧 | 带箭头线；固定边用实线，条件边用带条件标签的线 |
| `START` | 虚拟起点，用来确定输入到达后首先激活哪些节点 | HTTP 路由本身；真正执行代码的业务节点 | 胶囊/小圆终端形状，与 Node 颜色区分 |
| `END` | 虚拟终点，用来表示某条路径之后没有动作 | 一定会执行的“输出函数”；唯一的停止方式 | 双圈或终端形状；说明“没有后续节点时运行也会 halt” |

以上核心定义来自 [Graph API overview](https://docs.langchain.com/oss/python/langgraph/graph-api)。官方 Reference 对 `StateGraph` 的更精确描述是：节点通过读写共享状态通信，节点签名可以抽象成 `State -> Partial<State>`，每个 state key 可以配置 reducer。[StateGraph Reference](https://reference.langchain.com/python/langgraph/graph/state/StateGraph)

### `compile()` 做什么

官方文档给出的职责包括：

- 对图结构做基本校验，例如识别孤立节点；
- 绑定 checkpointer、store、interrupt before/after、cache 等运行参数；
- 生成可执行的 `CompiledStateGraph`。

编译前的 builder 不能直接执行；编译结果才提供 `invoke`、`stream` 等运行接口。[Graph API：Compiling](https://docs.langchain.com/oss/python/langgraph/graph-api#compiling-your-graph) · [compile Reference](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/compile)

---

## 3. 图如何真正运行：不是“箭头动画”，而是 super-step

### 官方事实

LangGraph 的底层执行模型来自 Pregel/Bulk Synchronous Parallel。一次运行按离散步骤推进，每个 step 有三个阶段：[LangGraph runtime](https://docs.langchain.com/oss/python/langgraph/pregel)

1. **Plan**：根据前一步更新过的 channel，确定本步要激活哪些节点；
2. **Execution**：本步选中的节点可以并行执行；执行期间，本步写入对其他节点不可见；
3. **Update**：所有写入在 step 边界统一应用到 channel / State。

随后重复，直到没有节点可执行，或达到最大步数。Graph API 将一次这样的离散迭代称为 **super-step**；同一 super-step 的节点属于并行执行，顺序节点位于不同 super-step。当所有节点 inactive 且没有消息在途时，图运行结束。[Graph API：Graphs](https://docs.langchain.com/oss/python/langgraph/graph-api#graphs)

### 本站应如何画

图上应同时表达两件事，不能只画几个相邻卡片：

- **拓扑层**：哪些 Node 通过哪些有向 Edge 相连；
- **运行层**：当前执行位于哪个 super-step、哪些节点 active、当前 State 是什么。

建议：

- 当前路径：高饱和实线；
- 已走路径：中等亮度；
- 未走分支：低饱和虚线或灰线；
- 当前 active Node：外圈脉冲或高亮描边；
- 已完成 Node：显示勾与 step 编号；
- State：独立的 snapshot panel，显示本 step 前后 diff，不把 State 画成 Edge 中间的另一个 Node。

这会让读者看到“拓扑没有变化，但一次具体请求只激活其中一条或几条路径”。

---

## 4. 有向图、DAG 与循环

### 官方事实

`add_edge` 的官方 Reference 明确称其为添加 **directed edge**。[add_edge Reference](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_edge)

同时，Graph API 明确支持把条件边指回已执行节点来创建 loop。因此：

- LangGraph 图的边有方向；
- 图允许有环；
- DAG 是无环场景的子集，不是 `StateGraph` 的普遍限制；
- 节点能否再次运行取决于后续 edge / channel 是否再次激活它，而不是它在画布上的左右位置。

### 应纠正的教学表达

“State 只能从左往右、不可逆地流动”并不准确：

- 屏幕从左到右只是布局选择；回边可以从右侧指回左侧节点；
- Node 返回的是 State update，运行时在 super-step 边界应用它；
- 默认 reducer 能覆盖字段，自定义 reducer 能追加或合并；
- 启用 checkpoint 后，还可以 replay 历史步骤或从旧 checkpoint fork 新路径。[Reducers](https://docs.langchain.com/oss/python/langgraph/graph-api#reducers) · [Use time travel](https://docs.langchain.com/oss/python/langgraph/use-time-travel)

更稳妥的说法是：

> 单条 Edge 的触发方向是确定的；一次运行按 super-step 演进 State 快照。图可以含回边，所以控制流可以再次进入先前节点。

---

## 5. 官方支持哪些编排

### 5.1 顺序

固定边可以表达 `START -> A -> B -> END`。`add_sequence` 是添加顺序节点的快捷方式。[Create a sequence](https://docs.langchain.com/oss/python/langgraph/use-graph-api#create-a-sequence-of-steps)

### 5.2 条件分支

`add_conditional_edges` 的 routing function 读取当前 State，可以返回某个目标 Node、多个目标 Node 或 `END`。需要在同一个节点函数里同时更新 State 和路由时，官方建议使用 `Command(update=..., goto=...)`。[Graph API：Conditional edges 与 Command](https://docs.langchain.com/oss/python/langgraph/graph-api#edges)

LLM 可以在 Node 内产生结构化分类结果，再由条件边路由；但“Edge 自己调用 LLM”不是必要的心智模型。官方把 Node 和 Edge 都描述为函数，但在可维护的业务示例中，副作用/模型调用放 Node，routing function 只读 State 并选择目标会更清晰。

### 5.3 分叉 / 并行 fan-out

同一 Node 有多个普通出边时，所有目标会在下一 super-step 并行执行；条件边也可以一次返回多个目标。运行时目标数量只有执行时才知道时，可以用 `Send` 做动态 map-reduce fan-out。[Graph API：Edges](https://docs.langchain.com/oss/python/langgraph/graph-api#edges) · [Map-reduce and Send](https://docs.langchain.com/oss/python/langgraph/use-graph-api#map-reduce-and-the-send-api)

### 5.4 汇合 / fan-in

官方示例支持 `A` 分到 `B`、`C`，然后汇入 `D`；当 `B` 与 `C` 属于同一并行 super-step 时，`D` 在两者完成后运行。[Run graph nodes in parallel](https://docs.langchain.com/oss/python/langgraph/use-graph-api#run-graph-nodes-in-parallel)

若要明确表达 all-of barrier，Python API 的 `add_edge(["b", "c"], "d")` 会等待列表中的所有 start nodes 完成，再执行 `d`。[add_edge Reference](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_edge)

要注意两个边界：

- 多个并行 Node 同时更新一个 State key 时，必须给该 key 定义能合并这些更新的 reducer，否则会产生并发更新错误。[INVALID_CONCURRENT_GRAPH_UPDATE](https://docs.langchain.com/oss/python/langgraph/errors/INVALID_CONCURRENT_GRAPH_UPDATE)
- 长短不一的分支不能只凭“线条最终画到同一个点”就推断为全局 barrier。官方示例对需要等所有 pending tasks 的节点使用 `defer=True`。[Defer node execution](https://docs.langchain.com/oss/python/langgraph/use-graph-api#defer-node-execution)

### 5.5 有界循环

官方建议循环必须有业务停止机制，通常由条件边在满足条件时路由到 `END`；调用时还可以配置 recursion limit 作为运行时上限。[Create and control loops](https://docs.langchain.com/oss/python/langgraph/use-graph-api#create-and-control-loops)

适合画成循环的例子：

```text
generate -> validate -> accepted? -> END
   ^              |
   |------ no ----|
```

其中：

- `validate` 是工作 Node；
- `accepted?` 是条件路由语义，可以画成菱形，但实现上往往是 conditional edge 的 routing function，而不一定是单独 Node；
- 回边是受支持的有向 Edge；
- State 中应显示 `attempt`、`feedback`、`status` 等使停止条件可验证的数据。

---

## 6. “无限循环不支持”应该怎样表述

### 不准确的说法

> LangGraph 不允许无限循环，编译时会在图上打叉。

### 官方行为

循环拓扑可以成功 compile。若运行一直没有 stop condition，图会持续产生 super-step，直到超过 `recursion_limit`，随后抛出 `GraphRecursionError`。复杂但正常的图也可能自然触达该限制，因此命中限制并不自动证明代码一定是死循环。[GRAPH_RECURSION_LIMIT](https://docs.langchain.com/oss/python/langgraph/errors/GRAPH_RECURSION_LIMIT)

当前 Python Graph API 文档说明：从 LangGraph 1.0.6 起，默认 recursion limit 为 1000 个 super-step；它可以在 `invoke` / `stream` 的 config 中覆盖。因为默认值属于版本相关细节，网站示例应强调“显式配置自己的业务上限”，不要只依赖默认值。[Graph API：Recursion limit](https://docs.langchain.com/oss/python/langgraph/graph-api#recursion-limit)

### 建议图形文案

可在无终止条件的红色回边旁画叉，但标签应写：

> **错误的运行设计：没有业务停止条件**  
> 环本身允许；运行最终由 recursion limit 中止并报错。

更可靠的 Agent loop 至少应有：

1. 成功条件；
2. 业务尝试上限或 deadline / budget；
3. fallback / partial-result 路径；
4. recursion limit 作为最后保险丝。

官方还提供 `RemainingSteps`，允许在达到限制前主动走向 fallback；相比只在外层捕获 `GraphRecursionError`，这种做法能让图正常完成。[Graph API：Proactive recursion handling](https://docs.langchain.com/oss/python/langgraph/graph-api#proactive-recursion-handling)

---

## 7. Ask User 与 Human-in-the-Loop 的准确边界

### 官方 HITL interrupt 流程

`interrupt()` 用来在 Node 内动态暂停执行并等待外部输入。官方要求的关键部件是：[Interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts)

1. 编译图时配置 checkpointer；
2. 调用图时提供稳定 `thread_id`；
3. Node 调用 `interrupt(payload)`，payload 必须可 JSON 序列化；
4. 运行时保存 State 并向调用方暴露 interrupt；
5. 外部系统收集人类输入；
6. 用同一 `thread_id` 再次调用 `Command(resume=value)`；
7. 该 resume value 成为 Node 内 `interrupt()` 的返回值。

恢复时，包含 interrupt 的 Node 会从函数开头重新运行，而不是从源码中的下一行物理续跑。因此 interrupt 前的副作用必须幂等。[Interrupt rules](https://docs.langchain.com/oss/python/langgraph/interrupts#rules-of-interrupts)

### 什么时候可以把图框成 HITL

天气 Agent 的缺失信息分支若采用上面的 pause/checkpoint/resume 机制，可以：

- 高亮 `validate_input -> ask_user` 路径；
- 用虚线边框圈住 `ask_user`；
- 标注 `Human-in-the-Loop / interrupt`；
- 暂停时将 Node 状态显示为 `waiting for input`，而不是 `completed`；
- 恢复后高亮 `ask_user -> route` 或后继路径。

如果实现只是返回 `{"question": "请补充目的地"}` 后到 `END`，下一条 HTTP 请求重新启动一轮 graph invocation，那么这仍是正常的多轮用户交互，但不是 LangGraph interrupt。可以标为“应用层 ask-and-return”，不要借用 HITL checkpoint/resume 的官方语义。

Persistence 文档将 checkpointer 定义为 thread 范围的 State checkpoint，并明确列出 HITL、对话连续性、time travel 与故障恢复等用途。[Persistence](https://docs.langchain.com/oss/python/langgraph/persistence)

---

## 8. State 更新、Reducer 与并行数据流

### 官方事实

State 是当前快照；Node 应返回局部更新，不需要返回整个 State。每个 State key 有独立 reducer：[Reducers](https://docs.langchain.com/oss/python/langgraph/graph-api#reducers)

```text
new_value = reducer(current_state[key], node_update[key])
```

- 没有显式 reducer：默认用新值覆盖旧值；
- 自定义 reducer：可以 append、merge、去重或按业务规则聚合；
- 并行分支写同一个 key：reducer 必须能定义合并行为；
- 同一并行 super-step 的更新顺序不应被假定为稳定，如需确定顺序，应在结果里保存可排序字段。[Parallel execution](https://docs.langchain.com/oss/python/langgraph/use-graph-api#run-graph-nodes-in-parallel)

### 本站建议采用的可视化

不要画成“完整 JSON 从一个 Node 被搬到下一个 Node”。更接近运行语义的展示是：

```text
State snapshot S0
   -> active nodes read S0
   -> nodes emit partial updates U1, U2
   -> reducers apply U1/U2 at super-step boundary
State snapshot S1
```

图旁 State panel 可以显示：

```diff
  destination: "Marina Bay"
- weather: null
+ weather: "rain"
- attempt: 0
+ attempt: 1
+ route_kind: "transit"
```

这样既能解释共享 State，也能让读者理解并行节点为什么需要 reducer。

---

## 9. 天气 Agent 主图应表达的路径

建议用一张固定拓扑、三种可切换运行路径的交互图；切换条件只改变高亮，不替换整张图。

```text
START
  |
parse_request
  |
validate_input
  |-- missing ------> ask_user [interrupt] ---- resume ----|
  |                                                     |
  `-- complete -----------------------------------------|
                                                        v
check_weather -> choose_route -> build_plan -> validate_plan
                                      ^              |
                                      |-- retry ------|
                                      |
                                      `---- accepted ------> format_response -> END
```

图中应明确：

- 圆角矩形：Node；
- 菱形或 Edge label：条件判断；
- 带箭头线：Edge；
- 图外/侧边卡片：当前 State 与 diff；
- `ask_user` 的虚线 group：只有 interrupt 版本才标 HITL；
- `build_plan -> validate_plan -> build_plan`：标 `bounded loop`，并展示 `attempt/max_attempts`；
- 未选择分支保持可见但降亮度，让读者理解这是同一张图的不同执行轨迹；
- 每个运行 step 高亮一个或一组 active Node，展示 super-step，而非只播放一串文本列表。

### 可从主图自然引出的章节顺序

1. 先跟随一条成功请求看完整运行；
2. 再切换输入不完整，解释 conditional edge 和 HITL；
3. 再切换校验失败，解释 cycle、业务停止条件和 recursion limit；
4. 然后从图中抽取 State、Node、Edge、START/END 的正式定义；
5. 最后扩展 fan-out/fan-in、reducers、Send、checkpoint 等能力。

这比开篇一次性罗列所有术语更符合“先看到一次请求如何跑起来，再抽象出框架概念”的阅读路径。

---

## 10. 官网语义与教学类比对照表

| 说法 | 判断 | 建议替换 |
| --- | --- | --- |
| “LangGraph 是应用程序” | 不准确 | LangGraph 是低层编排框架与运行时；compiled graph 是应用可调用的执行实例 |
| “State 是不可逆的，所以必须单向流动” | 不符合官方模型 | Node 返回 State update；reducer 决定覆盖或合并；checkpoint 支持 replay/fork |
| “Graph 是 DAG” | 只对部分图成立 | StateGraph 是支持 cycles 的有向执行图；DAG 是其中一种拓扑 |
| “Edge 搬运 JSON” | 过度简化 | Edge 决定激活谁；底层以 channel/message passing 和 super-step 应用更新 |
| “一个点到多个点就是条件分支” | 不完整 | 多个普通出边会全部并行；条件边才根据 State 选择一个或多个目标 |
| “多条线汇到一点就一定等全部分支” | 容易误导 | 说明同一 super-step fan-in、显式 all-of edge，以及 `defer=True` 的边界 |
| “Ask User 就是 HITL” | 取决于实现 | 只有 interrupt + checkpointer + thread_id + resume 才是 LangGraph HITL |
| “LangGraph 不支持无限循环” | 不准确 | cycles 受支持；无停止条件的运行会触发 recursion limit 并失败 |
| “END 是输出节点” | 不准确 | END 是虚拟终点；输出由最终 State / output schema 和调用 API 返回 |

---

## 11. Python 与 TypeScript 的概念一致性

Python 与 TypeScript 的命名风格不同，例如：

- Python：`add_node`、`add_edge`、`add_conditional_edges`、`recursion_limit`；
- TypeScript：`addNode`、`addEdge`、`addConditionalEdges`、`recursionLimit`。

但官方两套文档使用相同的 State / Node / Edge、Pregel super-step、branch、loop、interrupt 与 persistence 心智模型。网站的全局语言切换可以复用一张概念图，只替换代码与 API 拼写。[Python Graph API](https://docs.langchain.com/oss/python/langgraph/graph-api) · [TypeScript Graph API](https://docs.langchain.com/oss/javascript/langgraph/graph-api)

---

## 官方来源索引

- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview)
- [Frameworks, runtimes, and harnesses](https://docs.langchain.com/oss/python/concepts/products)
- [Graph API overview — Python](https://docs.langchain.com/oss/python/langgraph/graph-api)
- [Graph API overview — TypeScript](https://docs.langchain.com/oss/javascript/langgraph/graph-api)
- [Use the Graph API](https://docs.langchain.com/oss/python/langgraph/use-graph-api)
- [LangGraph runtime / Pregel](https://docs.langchain.com/oss/python/langgraph/pregel)
- [StateGraph API Reference](https://reference.langchain.com/python/langgraph/graph/state/StateGraph)
- [`StateGraph.compile` API Reference](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/compile)
- [`StateGraph.add_edge` API Reference](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_edge)
- [Interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts)
- [Persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
- [Use time travel](https://docs.langchain.com/oss/python/langgraph/use-time-travel)
- [GRAPH_RECURSION_LIMIT](https://docs.langchain.com/oss/python/langgraph/errors/GRAPH_RECURSION_LIMIT)
- [INVALID_CONCURRENT_GRAPH_UPDATE](https://docs.langchain.com/oss/python/langgraph/errors/INVALID_CONCURRENT_GRAPH_UPDATE)
- [Workflows and agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents)

