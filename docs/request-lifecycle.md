# 一次请求如何穿过 LangGraph

先把 LangGraph 放回完整 Web 系统中。`START` 不是 HTTP 服务器，也不会自己读取用户输入。

```text
Client
  → HTTP / WebSocket 路由
  → 鉴权、反序列化、schema 校验
  → graph.invoke(input, config) 或 graph.stream(input, config)
  → START 激活首节点
  → 节点读取 State、返回局部更新
  → Edge 选择下一节点
  → END 形成最终 State
  → 路由层选择公开字段、序列化成 JSON
  → Client
```

## 边界定义

| 层 | 输入 | 输出 | 不应该负责 |
|---|---|---|---|
| Transport | HTTP bytes / WebSocket frame | 已解析对象 | Agent 决策 |
| Application | 通过校验的请求 | graph result / event stream | 具体节点逻辑 |
| Graph | 初始 State | 最终 State 或更新事件 | HTTP response 拼装 |
| Node | 当前 State | Partial State update | 随意决定未声明的外部权限 |

普通 REST 使用 `invoke` 等待最终结果。SSE、NDJSON 或 WebSocket 使用 `stream`，再由接入层把每个事件编码为线上格式。socket、模型客户端和数据库连接都不进入 State。

## State 时间线

```text
#0 input          { origin, destination, latitude, longitude }
#1 check_weather  + { temperature, weather_code }
#2 plan_route     + { route_plan }
#3 END            final State → response DTO → JSON
```

checkpoint 保存的是图运行时快照；业务响应 DTO 是公开 API 合约。两者不能等同，否则很容易把内部消息或敏感工具结果泄露给前端。
