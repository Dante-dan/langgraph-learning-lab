"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Language = "python" | "typescript";
type SectionKey =
  | "roadmap"
  | "requestflow"
  | "controlflow"
  | "quickstart"
  | "concepts"
  | "dataflow"
  | "api"
  | "toyagent"
  | "playground"
  | "patterns"
  | "project";

const SECTIONS: Array<{
  key: SectionKey;
  num: string;
  label: string;
  group: string;
  duration: string;
}> = [
  { key: "roadmap", num: "01", label: "天气 Agent 完整旅程", group: "先把故事讲完整", duration: "18 MIN" },
  { key: "requestflow", num: "02", label: "请求如何进入图", group: "再拆执行过程", duration: "18 MIN" },
  { key: "controlflow", num: "03", label: "分支、循环与验证", group: "再拆执行过程", duration: "24 MIN" },
  { key: "concepts", num: "04", label: "图的骨架与边界", group: "再认识核心构件", duration: "24 MIN" },
  { key: "quickstart", num: "05", label: "把天气 Agent 写出来", group: "再认识核心构件", duration: "18 MIN" },
  { key: "dataflow", num: "06", label: "数据流与序列化", group: "拆开每个零件", duration: "20 MIN" },
  { key: "api", num: "07", label: "API 的调用时机", group: "组合成运行时", duration: "20 MIN" },
  { key: "toyagent", num: "08", label: "Toy Agent 运行时", group: "组合成运行时", duration: "28 MIN" },
  { key: "playground", num: "09", label: "逐步执行 Playground", group: "动手验证", duration: "20 MIN" },
  { key: "patterns", num: "10", label: "架构模式与取舍", group: "放进真实系统", duration: "25 MIN" },
  { key: "project", num: "11", label: "GitHub 实战项目", group: "放进真实系统", duration: "25 MIN" },
];

const snippets: Record<string, Record<Language, string>> = {
  hello: {
    python: `from typing_extensions import TypedDict
from langgraph.graph import StateGraph, START, END

class State(TypedDict):
    topic: str
    answer: str

def draft(state: State):
    return {"answer": f"Learning: {state['topic']}"}

builder = StateGraph(State)
builder.add_node("draft", draft)
builder.add_edge(START, "draft")
builder.add_edge("draft", END)
graph = builder.compile()

print(graph.invoke({"topic": "LangGraph"}))`,
    typescript: `import { StateGraph, StateSchema, START, END } from "@langchain/langgraph";
import * as z from "zod";

const State = new StateSchema({
  topic: z.string(),
  answer: z.string().default(""),
});

const draft: typeof State.Node = (state) => ({
  answer: \`Learning: \${state.topic}\`,
});

const graph = new StateGraph(State)
  .addNode("draft", draft)
  .addEdge(START, "draft")
  .addEdge("draft", END)
  .compile();

console.log(await graph.invoke({ topic: "LangGraph" }));`,
  },
  weather: {
    python: `from typing_extensions import TypedDict
from langgraph.graph import StateGraph, START, END

class TripState(TypedDict, total=False):
    origin: str
    destination: str
    latitude: float
    longitude: float
    temperature: float
    weather_code: int
    route_plan: str

async def check_weather(state: TripState):
    params = {"latitude": state["latitude"], "longitude": state["longitude"],
              "current": "temperature_2m,weather_code"}
    async with httpx.AsyncClient() as client:
        data = (await client.get("https://api.open-meteo.com/v1/forecast",
                                 params=params)).json()
    return {"temperature": data["current"]["temperature_2m"],
            "weather_code": data["current"]["weather_code"]}

def plan_route(state: TripState):
    mode = "地铁优先" if state["weather_code"] >= 51 else "步行 + 公交"
    return {"route_plan": f"{state['origin']} → {state['destination']}：{mode}"}

graph = (StateGraph(TripState)
    .add_node("check_weather", check_weather)
    .add_node("plan_route", plan_route)
    .add_edge(START, "check_weather")
    .add_edge("check_weather", "plan_route")
    .add_edge("plan_route", END)
    .compile())

result = await graph.ainvoke({"origin": "公司", "destination": "机场",
                              "latitude": 31.23, "longitude": 121.47})`,
    typescript: `import { StateGraph, StateSchema, START, END } from "@langchain/langgraph";
import * as z from "zod";

const TripState = new StateSchema({
  origin: z.string(), destination: z.string(),
  latitude: z.number(), longitude: z.number(),
  temperature: z.number().default(0),
  weatherCode: z.number().default(0),
  routePlan: z.string().default(""),
});

const checkWeather: typeof TripState.Node = async (state) => {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: String(state.latitude), longitude: String(state.longitude),
    current: "temperature_2m,weather_code",
  }).toString();
  const data = await fetch(url).then((r) => r.json());
  return { temperature: data.current.temperature_2m,
           weatherCode: data.current.weather_code };
};

const planRoute: typeof TripState.Node = (state) => ({
  routePlan: state.weatherCode >= 51 ? "地铁优先" : "步行 + 公交",
});

export const graph = new StateGraph(TripState)
  .addNode("check_weather", checkWeather).addNode("plan_route", planRoute)
  .addEdge(START, "check_weather").addEdge("check_weather", "plan_route")
  .addEdge("plan_route", END).compile();

const result = await graph.invoke({
  origin: "公司", destination: "机场", latitude: 31.23, longitude: 121.47,
});`,
  },
  http: {
    python: `class TripRequest(BaseModel):
    origin: str
    destination: str
    latitude: float
    longitude: float

@app.post("/api/trips/plan")
async def plan_trip(body: TripRequest, x_request_id: str | None = Header(None)):
    request_id = x_request_id or str(uuid4())
    result = await graph.ainvoke(
        body.model_dump(),
        {"configurable": {"thread_id": request_id}},
    )
    return {"request_id": request_id, "data": result}

# 流式接口：async for update in graph.astream(input, stream_mode="updates")
# 将每个 update 编码成 JSON，写入 SSE / NDJSON / WebSocket。`,
    typescript: `const TripRequest = z.object({
  origin: z.string().min(1), destination: z.string().min(1),
  latitude: z.number(), longitude: z.number(),
});

export async function POST(request: Request) {
  const input = TripRequest.parse(await request.json());
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const result = await graph.invoke(input, {
    configurable: { thread_id: requestId },
  });
  return Response.json({ requestId, data: result });
}

// 流式接口：for await (const update of await graph.stream(input,
//   { streamMode: "updates" })) socket.send(JSON.stringify(update));`,
  },
  branch: {
    python: `def choose(state) -> Literal["reject", "human_review", "execute"]:
    if not state["approved"]:       # 第一层：No
        return "reject"
    if state["risk"] == "high":    # 第二层：嵌套判断
        return "human_review"
    return "execute"

builder.add_conditional_edges("validate", choose)
builder.add_edge("reject", END)
builder.add_edge("human_review", END)
builder.add_edge("execute", END)`,
    typescript: `const choose = (state: typeof RouteState.State) => {
  if (!state.approved) return "reject";
  if (state.risk === "high") return "human_review";
  return "execute";
};

builder.addConditionalEdges("validate", choose);
builder.addEdge("reject", END);
builder.addEdge("human_review", END);
builder.addEdge("execute", END);`,
  },
  llmRouter: {
    python: `class Decision(BaseModel):
    next: Literal["walk", "transit", "clarify"]
    reason: str

router = model.with_structured_output(Decision)

async def decide(state):
    decision = await router.ainvoke(
        f"天气={state['weather']}; 距离={state['distance_km']}km"
    )
    return {"decision": decision.next, "reason": decision.reason}

builder.add_node("decide", decide)
builder.add_conditional_edges("decide", lambda state: state["decision"])

# 权限、额度、危险操作仍由确定性代码复核。`,
    typescript: `const Decision = z.object({
  next: z.enum(["walk", "transit", "clarify"]),
  reason: z.string(),
});
const router = model.withStructuredOutput(Decision);

const decide = async (state: RouteState) => {
  const decision = await router.invoke(
    "天气=" + state.weather + "; 距离=" + state.distanceKm + "km"
  );
  return { decision: decision.next, reason: decision.reason };
};

builder.addNode("decide", decide);
builder.addConditionalEdges("decide", (state) => state.decision);

// 权限、额度、危险操作仍由确定性代码复核。`,
  },
  loop: {
    python: `def continue_or_stop(state):
    if state["accepted"] or state["attempts"] >= 3:
        return END
    return "generate"

graph = (StateGraph(DraftState)
    .add_node("generate", generate)
    .add_node("evaluate", evaluate)
    .add_edge(START, "generate")
    .add_edge("generate", "evaluate")
    .add_conditional_edges("evaluate", continue_or_stop)
    .compile())

result = graph.invoke(input, {"recursion_limit": 10})`,
    typescript: `const continueOrStop = (state: typeof DraftState.State) =>
  state.accepted || state.attempts >= 3 ? END : "generate";

const graph = new StateGraph(DraftState)
  .addNode("generate", generate)
  .addNode("evaluate", evaluate)
  .addEdge(START, "generate")
  .addEdge("generate", "evaluate")
  .addConditionalEdges("evaluate", continueOrStop)
  .compile();

const result = await graph.invoke(input, { recursionLimit: 10 });`,
  },
  toyAgent: {
    python: `tools = [get_weather, search_route]
model_with_tools = model.bind_tools(tools)

async def call_model(state: MessagesState):
    reply = await model_with_tools.ainvoke(state["messages"])
    return {"messages": [reply]}

def route_after_model(state: MessagesState):
    return "tools" if state["messages"][-1].tool_calls else END

graph = (StateGraph(MessagesState)
    .add_node("model", call_model)
    .add_node("tools", ToolNode(tools))
    .add_edge(START, "model")
    .add_conditional_edges("model", route_after_model)
    .add_edge("tools", "model")
    .compile(checkpointer=checkpointer))`,
    typescript: `const tools = [getWeather, searchRoute];
const modelWithTools = model.bindTools(tools);

const callModel = async (state: AgentState) => ({
  messages: [await modelWithTools.invoke(state.messages)],
});

const routeAfterModel = (state: AgentState) =>
  state.messages.at(-1)?.tool_calls?.length ? "tools" : END;

const graph = new StateGraph(AgentState)
  .addNode("model", callModel)
  .addNode("tools", new ToolNode(tools))
  .addEdge(START, "model")
  .addConditionalEdges("model", routeAfterModel)
  .addEdge("tools", "model")
  .compile({ checkpointer });`,
  },
  reducer: {
    python: `import operator
from typing import Annotated
from typing_extensions import TypedDict

class ResearchState(TypedDict):
    query: str
    # 并行节点的结果会追加，而不是互相覆盖
    findings: Annotated[list[str], operator.add]

def search_web(state: ResearchState):
    return {"findings": ["web result"]}

def search_docs(state: ResearchState):
    return {"findings": ["docs result"]}`,
    typescript: `import { ReducedValue, StateSchema } from "@langchain/langgraph";
import * as z from "zod";

const ResearchState = new StateSchema({
  query: z.string(),
  findings: new ReducedValue(
    z.array(z.string()).default(() => []),
    { reducer: (left, right) => left.concat(right) }
  ),
});

const searchWeb: typeof ResearchState.Node = () => ({ findings: ["web result"] });
const searchDocs: typeof ResearchState.Node = () => ({ findings: ["docs result"] });`,
  },
  openai: {
    python: `import os
from langchain_openai import ChatOpenAI

# 只在服务端读取。ChatGPT 订阅不会自动提供 API 用量。
model = ChatOpenAI(
    model=os.environ["OPENAI_MODEL"],
    api_key=os.environ["OPENAI_API_KEY"],
)

def call_model(state):
    reply = model.invoke(state["messages"])
    return {"messages": [reply]}`,
    typescript: `import { ChatOpenAI } from "@langchain/openai";

// 只在服务端读取。ChatGPT 订阅不会自动提供 API 用量。
const model = new ChatOpenAI({
  model: process.env.OPENAI_MODEL!,
  apiKey: process.env.OPENAI_API_KEY!,
});

const callModel = async (state: AgentState) => ({
  messages: [await model.invoke(state.messages)],
});`,
  },
  serialize: {
    python: `import json
from langgraph.checkpoint.memory import MemorySaver

checkpointer = MemorySaver()
graph = builder.compile(checkpointer=checkpointer)

config = {"configurable": {"thread_id": "lesson-001"}}
result = graph.invoke({"query": "reducers"}, config)

# 跨服务边界时，使用 JSON 安全的普通数据
wire_payload = json.dumps(result, ensure_ascii=False, default=str)`,
    typescript: `import { MemorySaver } from "@langchain/langgraph";

const checkpointer = new MemorySaver();
const graph = builder.compile({ checkpointer });

const config = { configurable: { thread_id: "lesson-001" } };
const result = await graph.invoke({ query: "reducers" }, config);

// 跨服务边界时，使用 JSON 安全的普通数据
const wirePayload = JSON.stringify(result);`,
  },
  conditional: {
    python: `from typing import Literal
from langgraph.graph import END

def route(state) -> Literal["tools", "answer", "__end__"]:
    if state.get("approved") is False:
        return END
    return "tools" if state["messages"][-1].tool_calls else "answer"

builder.add_conditional_edges("decide", route)`,
    typescript: `import { END } from "@langchain/langgraph";

const route = (state: AgentState) => {
  if (state.approved === false) return END;
  return state.messages.at(-1)?.tool_calls?.length ? "tools" : "answer";
};

builder.addConditionalEdges("decide", route);`,
  },
  command: {
    python: `from typing import Literal
from langgraph.types import Command

def review(state) -> Command[Literal["publish", "revise"]]:
    if state["score"] >= 0.8:
        return Command(update={"status": "ready"}, goto="publish")
    return Command(update={"status": "needs_work"}, goto="revise")`,
    typescript: `import { Command } from "@langchain/langgraph";

const review = (state: State) => {
  if (state.score >= 0.8) {
    return new Command({ update: { status: "ready" }, goto: "publish" });
  }
  return new Command({ update: { status: "needs_work" }, goto: "revise" });
};`,
  },
  pattern: {
    python: `# Orchestrator → workers → reducer → synthesizer
def orchestrate(state):
    return {"tasks": plan_subtasks(state["query"])}

def synthesize(state):
    return {"answer": merge_findings(state["findings"])}

builder.add_node("orchestrate", orchestrate)
builder.add_node("worker", research_one)
builder.add_node("synthesize", synthesize)`,
    typescript: `// Orchestrator → workers → reducer → synthesizer
const orchestrate = (state: State) => ({
  tasks: planSubtasks(state.query),
});

const synthesize = (state: State) => ({
  answer: mergeFindings(state.findings),
});

builder.addNode("orchestrate", orchestrate);
builder.addNode("worker", researchOne);
builder.addNode("synthesize", synthesize);`,
  },
};

const API_ROWS = [
  ["StateGraph", "声明共享状态与图结构", "几乎所有自定义工作流", "把它误当成执行结果；必须 compile"],
  ["add_node / addNode", "注册计算单元", "模型、工具、转换、人工步骤、子图", "节点通常返回局部更新，不是完整 State"],
  ["add_edge / addEdge", "固定流转", "无条件顺序与并行扇出", "多个出边会在下一 super-step 并行执行"],
  ["add_conditional_edges", "动态路由", "分支、循环、结束判断", "路由函数决定去哪，不负责业务副作用"],
  ["Command", "更新状态并改变流向", "handoff、审核、工具内跳转", "静态边仍会执行，别意外产生双路由"],
  ["Send", "动态创建并行任务", "map-reduce、未知数量 workers", "每个 Send 可以携带不同子状态"],
  ["interrupt", "暂停并等待外部输入", "审批、补充信息、人机协同", "恢复依赖 thread_id 与 checkpointer"],
  ["stream / astream", "逐步返回执行事件", "聊天 UI、进度、可观测性", "先选对 stream mode，再处理事件形状"],
  ["Checkpointer", "保存线程内状态快照", "恢复、时间旅行、容错", "它不是跨线程的长期知识库"],
  ["Store", "保存跨线程长期记忆", "用户偏好、共享记忆", "与 checkpoint 的生命周期不同"],
  ["ToolNode", "执行模型提出的工具调用", "标准 ReAct 工具循环", "工具声明、路由和错误策略仍需设计"],
  ["Subgraph", "封装可复用工作流", "团队边界、多 Agent、复杂模块", "父子状态共享时要对齐 schema/reducer"],
];

const PATTERNS = [
  ["Prompt chain", "固定步骤、强可预测性", "把一步输出清洗后交给下一步", "步骤过多却没有质量门"],
  ["Router", "请求类型差异明显", "分类后进入不同专家路径", "让 LLM 在每个节点都重复分类"],
  ["Orchestrator–worker", "任务可动态拆分", "规划 → Send 并行 → Reducer 汇总", "worker 写同一字段却没 reducer"],
  ["Evaluator–optimizer", "质量可明确打分", "生成 → 评估 → 修订循环", "没有递归上限或退出条件"],
  ["Agent + tools", "步骤无法预先确定", "模型决定工具调用并循环", "简单流程也交给 Agent 自由探索"],
  ["Human-in-the-loop", "高风险或需要授权", "interrupt → 审核 → Command(resume)", "没有 checkpoint 就指望恢复"],
  ["Multi-agent supervisor", "领域边界清晰", "主管将任务交给专用子图", "角色过多导致上下文和成本膨胀"],
  ["Durable workflow", "分钟到数天的任务", "checkpoint、幂等副作用、可恢复节点", "重放时重复发送邮件或扣款"],
  ["RAG + LangGraph", "检索需要路由与纠错", "检索 → 评估 → 重写 → 回答", "把向量库结果直接当最终事实"],
];

function LanguageSwitch({ language, setLanguage, compact = false }: {
  language: Language;
  setLanguage: (language: Language) => void;
  compact?: boolean;
}) {
  return (
    <div className={`lang-switch ${compact ? "compact" : ""}`} aria-label="全局代码语言">
      {(["python", "typescript"] as Language[]).map((item) => (
        <button
          key={item}
          type="button"
          className={language === item ? "active" : ""}
          aria-pressed={language === item}
          onClick={() => setLanguage(item)}
        >
          {item === "python" ? "Python" : "TypeScript"}
        </button>
      ))}
    </div>
  );
}

function CodeBlock({ name, language, setLanguage, label }: {
  name: keyof typeof snippets;
  language: Language;
  setLanguage: (language: Language) => void;
  label: string;
}) {
  return (
    <div className="code-block">
      <div className="code-head">
        <span>{label}</span>
        <span className="file-name">{language === "python" ? "main.py" : "main.ts"}</span>
      </div>
      <pre><code>{snippets[name][language]}</code></pre>
      <div className="code-foot">
        <span>GLOBAL LANGUAGE</span>
        <LanguageSwitch language={language} setLanguage={setLanguage} compact />
      </div>
    </div>
  );
}

function BlueprintGraph({ active = -1 }: { active?: number }) {
  const nodes = ["START", "分析", "工具", "回答", "END"];
  return (
    <div className="blueprint" role="img" aria-label="START 经过分析、工具和回答节点到 END 的执行图">
      <div className="blueprint-head"><span>EXECUTION BLUEPRINT</span><span>STATEGRAPH · 01</span></div>
      <div className="graph-row">
        {nodes.map((node, index) => (
          <div className="graph-piece" key={node}>
            <div className={`graph-node ${index === active ? "active" : ""} ${index === 0 || index === nodes.length - 1 ? "round" : ""}`}>{node}</div>
            {index < nodes.length - 1 && <div className="graph-edge"><span>→</span></div>}
          </div>
        ))}
      </div>
      <div className="graph-notes">
        <span>read: messages</span><span>write: tool_calls</span><span>write: messages</span>
      </div>
    </div>
  );
}

function SectionHeader({ section }: { section: typeof SECTIONS[number] }) {
  const titles: Record<SectionKey, string> = {
    roadmap: "从一个天气出行 Agent 开始",
    requestflow: "一次请求，如何真正进入 LangGraph",
    controlflow: "分支、验证与循环：程序如何改变顺序",
    concepts: "图的骨架：State、Node、Edge 与边界",
    quickstart: "把刚才的天气 Agent 写成程序",
    dataflow: "数据怎样流转、序列化与恢复",
    api: "API 不只是列表，而是调用时机",
    toyagent: "Toy Agent：模型、工具、验证与循环",
    playground: "逐节点观察一次天气请求",
    patterns: "架构模式：为什么这样选",
    project: "把理解固化进公开 GitHub 项目",
  };
  const subtitles: Record<SectionKey, string> = {
    roadmap: "先不背 API。我们让一条“公司到机场怎么走”的真实请求完整跑完，再从执行过程反推 LangGraph 的核心构件。",
    requestflow: "拆开 POST、反序列化、invoke、START、节点更新与 HTTP 响应，明确每一层拿到的真实数据。",
    controlflow: "固定边表达顺序，条件边表达选择和回路；验证失败是否重试，由当前 State 与明确退出条件共同决定。",
    concepts: "官方最小核心是 State、Node、Edge；在工程里还要补上执行边界、Reducer、compile、checkpoint 与 runtime context。",
    quickstart: "先实现可验证的最小主路径，再加入天气分支、失败回路和最终 fallback。",
    dataflow: "从局部状态更新、Reducer 合并到 JSON 线格式与 checkpoint 恢复，追踪同一份数据的不同形态。",
    api: "把每个 API 放回调用现场：什么时候 invoke、什么时候 stream、什么时候需要 Command、Send 或 interrupt。",
    toyagent: "模型提出工具调用，运行时执行并观察，验证器决定继续还是结束；停止和业务完成是两件事。",
    playground: "用可控场景逐步观察节点、条件边、State diff 和最终响应，不把预设动画伪装成真实代码执行。",
    patterns: "从确定性工作流到动态 Agent，比较每种架构的适用条件、代价与失败方式。",
    project: "把双语言示例、练习、答案和生产检查表都放进可运行、可验证的公开仓库。",
  };
  return (
    <header className="lesson-head">
      <div>
        <div className="lesson-index">LESSON {section.num}</div>
        <h1>{titles[section.key]}</h1>
        <p className="subtitle">{subtitles[section.key]}</p>
      </div>
      <div className="duration">预计 {section.duration} · 入门</div>
    </header>
  );
}

function Roadmap() {
  const journey = [
    ["01", "用户提交", "在天气出行页面输入公司、机场、时间与位置，然后点击“生成计划”。", "这时还没有进入 LangGraph"],
    ["02", "服务端接住 POST", "路由层把 JSON bytes 反序列化成 TripInput，完成鉴权、字段校验并生成 request_id。", "应用层职责"],
    ["03", "启动图", "应用层调用 graph.ainvoke(input, config)。输入成为初始 State，虚拟 START 激活第一个节点。", "LangGraph 开始调度"],
    ["04", "查询天气", "check_weather 读取经纬度，调用天气 API，只返回 temperature、weather_code 与 observed_at 的局部更新。", "Node 做工作"],
    ["05", "选择路线", "条件边读取当前 State：缺少信息就询问用户；下雨进入公共交通方案；天气好进入步行 / 公交比较。", "Edge 决定下一步"],
    ["06", "生成候选计划", "被选中的规划节点写入 mode、route_plan 与 reason。它不直接结束请求，后面还有质量门。", "State 继续演化"],
    ["07", "验证并决定是否循环", "validate_plan 检查天气是否过期、路线是否可用、解释是否完整。通过就响应；失败且未超上限就回到查询 / 规划；连续失败则进入 fallback。", "条件边形成有界回路"],
    ["08", "返回结果", "respond 只挑选允许公开的字段；到达 END 后，路由层把 final State 序列化成 HTTP JSON。", "END 不是业务函数"],
  ];
  const concepts = [
    ["01", "State", "一次运行的共享事实快照；schema 规定节点能读写哪些 channel。"],
    ["02", "Node", "读取当前 State、执行一个可命名工作、返回局部更新的函数。"],
    ["03", "Edge", "从当前节点激活哪个下一节点；固定、条件、并行或回边都属于控制流。"],
    ["04", "START / END", "虚拟执行边界：START 投递初始输入，END 表示这条路径不再激活节点。"],
    ["05", "Reducer", "定义 old value 与 node update 怎样合并；并行写同一 channel 时尤其关键。"],
    ["06", "Compiled graph", "builder.compile() 校验结构并生成可 invoke / stream 的可执行 Runnable。"],
    ["07", "Checkpointer", "按 thread 保存每个 super-step 的快照，让暂停、恢复与重放成为可能。"],
    ["08", "Runtime context", "向节点注入模型客户端、配置与连接等运行依赖，而不污染可持久化 State。"],
  ];
  const nodeRoles = [
    ["确定性转换节点", "校验、格式转换、计算", "无外部副作用，容易单测"],
    ["I/O / 工具节点", "天气、地图、数据库、搜索", "负责一个外部能力，显式处理超时与幂等"],
    ["模型节点", "理解、生成、结构化决策", "只处理语义不确定性，输出要有 schema"],
    ["验证节点", "检查候选结果是否满足验收条件", "写 accepted / errors，不把“感觉完成”当完成"],
    ["人工 / 子图节点", "暂停审批或封装另一张图", "生命周期、输入输出和恢复边界必须清楚"],
  ];

  return (
    <>
      <section className="opening-prologue">
        <span className="section-kicker">贯穿案例 · WEATHER TRIP AGENT</span>
        <h2>让我们先看懂一件事：它怎样把“天气”变成“出行决定”</h2>
        <p className="opening-lede">假设明早 08:00，你要从上海公司赶到浦东机场。你打开一个天气出行 Agent，输入下面这句话。我们暂时不解释 StateGraph，也不先看图；先跟着这次请求，看系统怎样得到一个可以被验证的结果。</p>
        <blockquote>“明早从公司去浦东机场。如果下雨就不要走太多路；请给我路线、理由和备用方案。”</blockquote>
      </section>

      <section className="scenario-contract">
        <div className="scenario-input">
          <span>用户在页面填写</span>
          <div><strong>起点</strong><b>上海公司</b></div>
          <div><strong>终点</strong><b>浦东机场</b></div>
          <div><strong>偏好</strong><b>下雨少步行</b></div>
          <div><strong>出发时间</strong><b>明早 08:00</b></div>
        </div>
        <div className="scenario-goal">
          <span>完成标准 · ACCEPTANCE CONTRACT</span>
          <h3>Agent 只有在下面四件事都成立时才算完成</h3>
          <ol>
            <li>天气数据带观测时间，而且没有过期</li>
            <li>路线与天气、距离和用户偏好一致</li>
            <li>结果包含交通方式、理由与备用方案</li>
            <li>天气或地图服务失败时给出明确 fallback</li>
          </ol>
        </div>
      </section>

      <div className="opening-post">
        <div><span>第一步不是画 Graph，而是发送业务请求</span><strong>POST /api/trips/plan</strong><p>浏览器把表单序列化成 JSON；服务端拿到的是字节流。只有路由层完成解析和校验后，应用代码才会调用编译后的 graph。</p></div>
        <pre>{`{
  "origin": "上海公司",
  "destination": "浦东机场",
  "departureAt": "2026-07-21T08:00:00+08:00",
  "preference": "下雨少步行"
}`}</pre>
      </div>

      <section className="opening-section">
        <span className="section-kicker">PART 01 · 先把业务流程完整跑一遍</span>
        <h2>从点击“生成计划”到收到结果，依次发生什么？</h2>
        <p>下面每一步都先说业务事实，再标出它属于应用代码还是 LangGraph 调度。读完这一段，你应该先能复述完整程序；后面的概念只是给这些步骤起名字。</p>
        <div className="journey-list">
          {journey.map((step) => (
            <article key={step[0]}>
              <span>{step[0]}</span>
              <h3>{step[1]}</h3>
              <p>{step[2]}</p>
              <small>{step[3]}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="branch-story" aria-label="天气出行 Agent 的分支与验证循环">
        <div className="branch-story-head">
          <span className="section-kicker">同一条请求的三个可能分支</span>
          <h2>执行顺序不是预先写死的一条线</h2>
          <p>天气节点结束后，条件边读取刚刚更新的 State，再选择一个或多个目标。规划完成后，验证节点还可能把执行送回前面的节点。</p>
        </div>
        <div className="branch-lanes">
          <div><span>IF 信息不完整</span><strong>ask_user</strong><p>暂停并向用户追问位置或时间，恢复后重新路由。</p></div>
          <div><span>IF weather_code ≥ 51</span><strong>plan_transit</strong><p>减少暴露在雨中的步行距离，优先地铁或网约车接驳。</p></div>
          <div><span>ELSE 天气良好</span><strong>plan_outdoor</strong><p>比较步行与公交，用时间、成本和偏好做确定性选择。</p></div>
        </div>
        <div className="validation-loop">
          <div><strong>validate_plan</strong><span>检查 freshness、route、reason、fallback</span></div>
          <b>→</b>
          <div><strong>通过</strong><span>respond → END</span></div>
          <b>／</b>
          <div><strong>失败且 attempts &lt; 2</strong><span>↺ check_weather / replan</span></div>
          <b>／</b>
          <div><strong>仍失败</strong><span>fallback → respond → END</span></div>
        </div>
      </section>

      <section className="result-reveal">
        <div>
          <span className="section-kicker">这次请求的最终结果</span>
          <h2>先看到产品输出，再去看 Graph</h2>
          <p>天气 API 返回 29.4°C、weather code 61，验证器确认数据新鲜且路线可用。因此执行走“下雨”分支，不触发重试，最后由服务端只公开响应字段。</p>
        </div>
        <pre>{`{
  "mode": "地铁优先",
  "route": "公司 → 2号线 → 浦东机场",
  "reason": "当前有雨，减少室外步行",
  "fallback": "天气服务异常时使用地铁保守方案"
}`}</pre>
      </section>

      <section className="opening-section">
        <span className="section-kicker">PART 02 · 框架、Graph 与业务应用的关系</span>
        <h2>更准确的说法：LangGraph 是运行时；你编译出的 Graph 是可执行应用组件</h2>
        <p><code>langgraph</code> 这个软件包本身仍是低层编排框架 / 运行时。你用它声明 State、Node 和 Edge，再 <code>compile()</code> 得到的 graph，则像一段可执行程序：可以接收输入、调度步骤、暂停、恢复、流式输出。它不是 HTTP 服务、页面或天气 API；这些仍属于完整业务应用。</p>
        <div className="ownership-grid">
          <article><span>你的业务应用负责</span><h3>“做什么才算对”</h3><p>接收请求、鉴权、选择 graph、定义天气规则、节点业务代码、验收标准、fallback、响应字段。</p></article>
          <article><span>LangGraph 核心负责</span><h3>“下一步怎样被调度”</h3><p>投递初始 State、激活 Node、应用局部更新与 Reducer、沿 Edge 进入下一 super-step、checkpoint、暂停与恢复。</p></article>
          <article><span>外部基础设施负责</span><h3>“能力从哪里来”</h3><p>天气 / 地图 API、LLM Provider、数据库、队列、追踪与告警。LangGraph 调用它们，但不会替你实现它们。</p></article>
        </div>
      </section>

      <section className="opening-section">
        <span className="section-kicker">PART 03 · 从刚才的流程衍生核心概念</span>
        <h2>官方最小核心是 3 个；工程上用 8 个构件建立完整心智模型</h2>
        <p>官方 Graph API 把 <strong>State、Node、Edge</strong> 称为三个关键组件。为了能解释“怎样启动、怎样合并、怎样执行和怎样恢复”，本课程再补上五个相邻构件。这里的“8 个”是教学模型，不冒充官方唯一计数。</p>
        <div className="concept-chain">
          {concepts.map((item) => <article key={item[0]}><span>{item[0]}</span><h3>{item[1]}</h3><p>{item[2]}</p></article>)}
        </div>
        <div className="state-node-answer">
          <div>
            <span className="section-kicker">为什么 State 不藏在 Node 里？</span>
            <h3>因为它是跨节点、跨步骤、可合并和可恢复的公共契约</h3>
            <p>如果天气只存在 <code>check_weather</code> 的局部变量里，条件边读不到它，规划节点拿不到它，checkpointer 也无法恢复它，并行节点更无法按 reducer 合并它。节点内部当然可以有临时变量；需要跨边界继续存在的事实才进入 State。</p>
          </div>
          <div className="correction-card">
            <strong>“State 不可逆，所以只能单向流动”只对了一半</strong>
            <p>已经保存的 checkpoint 快照不会被过去的节点原地改写；但当前 State 的同一个 key 可以被后续 update 覆盖或经 reducer 累积，控制流也可以沿回边再次进入旧节点。真正单向的是执行时间与 update 的提交顺序，不是画面上的“只能从左到右”。</p>
          </div>
        </div>
        <h2 className="section-title">Node 没有官方类继承树；工程上按职责划边界</h2>
        <div className="node-role-grid">
          {nodeRoles.map((role) => <article key={role[0]}><h3>{role[0]}</h3><p>{role[1]}</p><small>{role[2]}</small></article>)}
        </div>
        <div className="decision-callout"><strong>节点边界的判断标准</strong><span>一个节点应该只有一个清楚的重试、观测和失败理由。它通常读取 State / Runtime，返回 <code>Partial&lt;State&gt;</code>；路由函数只决定去哪，不顺手调用天气 API。需要更新状态并跳转时再使用 Command。</span></div>
      </section>

      <section className="opening-section topology-section">
        <span className="section-kicker">PART 04 · 图到底是哪一种图？</span>
        <h2>它是有向图，但不要求是 DAG；允许分叉、汇合和有界循环</h2>
        <div className="topology-grid">
          <article><span>ONE → ONE</span><h3>顺序</h3><p><code>A → B</code>。B 在后一个 super-step 被激活。</p></article>
          <article><span>ONE → MANY</span><h3>扇出 / 并行</h3><p>A 有多个固定出边，或条件边返回多个目标；目标节点在下一 super-step 并行运行。</p></article>
          <article><span>MANY → ONE</span><h3>汇合</h3><p>B、C 汇入 D。并行写同一 State channel 时必须定义能正确合并的 reducer。</p></article>
          <article><span>A → B → A</span><h3>有环</h3><p>条件边可以回到旧节点。业务终止条件负责正常退出，recursion limit 只是失控保险丝。</p></article>
        </div>
        <div className="direction-note">
          <strong>“方向”指 Edge 与 super-step，不指屏幕方位</strong>
          <p>图画成左到右只是排版。数据更新随激活消息进入下一 super-step；回边可以让控制流再次执行左侧节点，但不会穿越时间去修改旧 checkpoint。到所有节点 inactive、且没有消息在途时，本次 graph run 才停止。</p>
        </div>
        <div className="source-row">
          <a href="https://docs.langchain.com/oss/python/langgraph/graph-api" target="_blank" rel="noreferrer">官方 Graph API：State / Nodes / Edges / super-steps ↗</a>
          <a href="https://docs.langchain.com/oss/python/langgraph/use-graph-api" target="_blank" rel="noreferrer">官方示例：sequence / branch / loop ↗</a>
          <a href="https://docs.langchain.com/oss/python/langgraph/persistence" target="_blank" rel="noreferrer">官方 Persistence：checkpoint 与 replay ↗</a>
        </div>
      </section>

      <section className="route-map">
        <div className="section-kicker">接下来的教材路线 · 从这条请求逐层下钻</div>
        <h2>现在有了全貌，再去拆请求、控制流、概念与代码</h2>
        <div className="route-steps">
          {SECTIONS.slice(1).map((item, index) => (
            <div className="route-step" key={item.key}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.label}</strong><small>{item.duration}</small></div>
          ))}
        </div>
      </section>
    </>
  );
}

function RequestFlow({ language, setLanguage }: { language: Language; setLanguage: (l: Language) => void }) {
  const steps = [
    ["01", "Client", "点击生成计划，POST /api/trips/plan", "JSON bytes"],
    ["02", "Router", "反序列化、鉴权、schema 校验", "TripInput"],
    ["03", "Application", "选择 graph、thread_id，调用 ainvoke", "RunnableConfig"],
    ["04", "START", "初始 input 成为 State，激活 check_weather", "checkpoint #0"],
    ["05", "check_weather", "读取坐标，调用 Open-Meteo，返回局部更新", "+ weather"],
    ["06", "conditional edge", "按信息完整度、天气与距离选择下一节点", "branch"],
    ["07", "plan_*", "生成候选路线、理由与 fallback", "+ route_plan"],
    ["08", "validate_plan", "通过 → respond；失败 → 重试 / fallback", "accepted?"],
    ["09", "END", "没有待执行节点，形成 final State", "checkpoint #N"],
    ["10", "Router", "挑选公开字段，序列化响应", "HTTP JSON"],
  ];
  return <>
    <div className="story-bridge"><span>CASE · STEP 01</span><strong>前端准备发送“公司到机场”的请求</strong><p>现在场景已经明确，我们再看技术链路。前端不是把数据直接塞进 START，而是先向服务端发送 <code>POST /api/trips/plan</code>；路由层解析、鉴权和校验后，才调用 graph。</p></div>
    <div className="sequence-board">
      <div className="sequence-head"><span>REQUEST LIFECYCLE</span><span>一次请求像“地址栏输入网址”一样逐层展开</span></div>
      {steps.map((step) => <div className="sequence-row" key={step[0]}><span>{step[0]}</span><strong>{step[1]}</strong><b>{step[2]}</b><code>{step[3]}</code></div>)}
    </div>
    <div className="wire-grid">
      <div><span>REQUEST JSON</span><pre>{`{
  "origin": "公司",
  "destination": "机场",
  "latitude": 31.23,
  "longitude": 121.47
}`}</pre></div>
      <div><span>RESPONSE JSON</span><pre>{`{
  "requestId": "trip-42",
  "data": {
    "temperature": 29.4,
    "weatherCode": 61,
    "routePlan": "地铁优先"
  }
}`}</pre></div>
    </div>
    <CodeBlock name="http" language={language} setLanguage={setLanguage} label="接入层：请求校验 → graph.invoke → JSON 响应" />
    <div className="compare-grid">
      <div><span className="section-kicker">HTTP</span><h3>等待最终结果</h3><p><code>invoke</code> 到 END 后一次返回，最适合短任务 REST。</p></div>
      <div><span className="section-kicker">SSE / NDJSON</span><h3>单向推送进度</h3><p>消费 <code>stream</code>，把每个 update 编码成 JSON event。</p></div>
      <div><span className="section-kicker">WebSocket</span><h3>双向会话</h3><p>连接层管理消息；socket 不进 State，同一会话靠 <code>thread_id</code>。</p></div>
    </div>
  </>;
}

function ControlFlow({ language, setLanguage }: { language: Language; setLanguage: (l: Language) => void }) {
  return <>
    <div className="story-bridge"><span>CASE · STEP 02</span><strong>天气数据回来了：29.4°C，weatherCode = 61</strong><p>下一步不再固定：下雨走地铁，天气好才考虑步行；距离过远或风险较高还可能进入人工/补充信息分支。这就是控制结构出现的原因。</p></div>
    <div className="control-overview">
      <article><span>SEQUENCE</span><h3>顺序</h3><code>A → B → C</code><p>下一步在编译时已知，用固定 edge。</p></article>
      <article><span>BRANCH</span><h3>条件</h3><code>A → if(state) → B/C</code><p>下一步由当前 State 决定，用 conditional edge。</p></article>
      <article><span>LOOP</span><h3>循环</h3><code>A → evaluate → A/END</code><p>条件边可以指回旧节点，但必须有退出条件。</p></article>
    </div>
    <h2 className="section-title">确定性分支：Yes / No 与嵌套判断</h2>
    <p>权限、距离、额度和枚举状态能被代码精确判断。嵌套 if 不需要嵌套图：路由函数只读 State，返回目标节点名；节点做业务，边做路由。</p>
    <CodeBlock name="branch" language={language} setLanguage={setLanguage} label="确定性条件边" />
    <h2 className="section-title">LLM 分支：只处理语义模糊，不处理硬权限</h2>
    <p>“用户更想步行还是公共交通”可由模型判断，但输出必须限制为枚举。LLM 先写 <code>decision</code>，纯路由函数再读取它；预算、权限和危险动作仍由代码复核。</p>
    <CodeBlock name="llmRouter" language={language} setLanguage={setLanguage} label="Structured output → 条件边" />
    <h2 className="section-title">Loop：回边很简单，可靠退出才是核心</h2>
    <div className="loop-line"><span>generate</span><b>→</b><span>evaluate</span><b>→ accepted / attempts ≥ 3 ?</b><span>END</span><em>NO ↺ generate</em></div>
    <CodeBlock name="loop" language={language} setLanguage={setLanguage} label="Evaluator–optimizer 有界循环" />
    <div className="warning-callout"><strong>官方语义与工程替代</strong><span><code>recursionLimit</code> 是失控保险丝，不是业务出口。数组遍历、固定重试、分页读取通常留在普通函数或重试库里；只有每轮需要 checkpoint、动态路由、流式可见或人工介入时，才把循环画进图。</span></div>
  </>;
}

function Quickstart({ language, setLanguage }: { language: Language; setLanguage: (l: Language) => void }) {
  return (
    <>
      <div className="story-bridge"><span>CASE · STEP 03</span><strong>把刚才的故事写成第一个可运行程序</strong><p>先只保留最容易验证的主路径：接收出行输入 → 调 Open-Meteo → 生成路线 → 返回结果。运行通以后，再逐步加入分支、错误处理和 Agent 决策。</p></div>
      <div className="install-grid">
        <div><span className="step-no">01</span><h3>初始化</h3><code>{language === "python" ? "uv add langgraph langchain-openai" : "npm i @langchain/langgraph @langchain/openai zod"}</code></div>
        <div><span className="step-no">02</span><h3>定义状态</h3><p>先写数据契约，再写节点。把变化频率不同的数据拆成独立字段。</p></div>
        <div><span className="step-no">03</span><h3>编译并调用</h3><p><code>compile()</code> 会检查图结构，并注入 checkpointer 等运行能力。</p></div>
      </div>
      <BlueprintGraph active={2} />
      <CodeBlock name="weather" language={language} setLanguage={setLanguage} label="贯穿案例：Open-Meteo 天气 → 出行路线" />
      <div className="state-timeline">
        <div><span>START</span><code>{`{ origin, destination, latitude, longitude }`}</code></div>
        <div><span>check_weather</span><code>{`+ temperature, weatherCode`}</code></div>
        <div><span>plan_route</span><code>{`+ routePlan`}</code></div>
        <div><span>END</span><code>final State → response</code></div>
      </div>
      <div className="source-row">
        <a href="https://docs.langchain.com/oss/python/langgraph/overview" target="_blank" rel="noreferrer">Python 官方入门 ↗</a>
        <a href="https://docs.langchain.com/oss/javascript/langgraph/overview" target="_blank" rel="noreferrer">TypeScript 官方入门 ↗</a>
        <a href="https://github.com/langchain-ai/langgraph-101-ts/blob/main/workshops/101/agents/00-lg101_agent.ts" target="_blank" rel="noreferrer">官方 TS 天气 Agent ↗</a>
        <a href="https://github.com/langchain-ai/langgraph-101/blob/main/agents/101/agent.py" target="_blank" rel="noreferrer">官方 Python 天气 Agent ↗</a>
      </div>
    </>
  );
}

function Concepts({ language, setLanguage }: { language: Language; setLanguage: (l: Language) => void }) {
  const nodeTypes = [
    ["模型节点", "调用 LLM，产出消息或结构化数据", "需要理解、生成、决策"],
    ["工具节点", "执行确定性外部能力", "搜索、数据库、业务 API"],
    ["转换节点", "纯函数清洗与映射 State", "格式转换、验证、聚合"],
    ["人工节点", "interrupt 暂停执行", "审批、补充信息、高风险操作"],
    ["子图节点", "把一张已编译图当节点", "可复用模块、团队边界、多 Agent"],
  ];
  return (
    <>
      <section className="intro-grid">
        <div className="prose">
          <h2>先给出严格定义，再讨论写法</h2>
          <p><strong>State</strong> 在数据上是 schema 约束的 key-value 集合；在业务上是一次执行可恢复的最小事实集。边界：不放 socket、模型客户端、数据库连接或无法可靠序列化的资源。</p>
          <p><strong>Node</strong> 在数据上是 <code>State → Partial&lt;State&gt;</code> 的同步/异步函数；在业务上是一个可命名、可测试、可重试的工作单元。边界：不要同时承担接入层、路由、展示层的全部职责。</p>
        </div>
        <BlueprintGraph active={1} />
      </section>
      <div className="definition-grid">
        <div><strong>Edge</strong><span>数据定义：不保存数据，只引用源/目标节点。</span><span>业务定义：表达控制流；固定边是顺序，条件边是选择和循环出口。</span></div>
        <div><strong>Reducer</strong><span>数据定义：(old, update) → merged。</span><span>业务定义：多个节点并行写同一个 key 时的冲突策略。</span></div>
        <div><strong>Checkpoint</strong><span>数据定义：values + next + metadata 的状态快照。</span><span>业务定义：恢复、审计、时间旅行；不是跨线程长期知识库。</span></div>
      </div>
      <h2 className="section-title">节点类型：同一种函数签名，不同的系统职责</h2>
      <div className="type-table">
        {nodeTypes.map((row) => <div key={row[0]}><strong>{row[0]}</strong><span>{row[1]}</span><small>{row[2]}</small></div>)}
      </div>
      <div className="compare-grid">
        <div><span className="section-kicker">共同点</span><h3>都读取 State，只返回更新</h3><p>节点不需要返回完整状态；返回越小，数据所有权越清晰，重放和测试越容易。</p></div>
        <div><span className="section-kicker">关键差异</span><h3>Node 做工作，Edge 做路由</h3><p>不要把副作用塞进条件边。需要“更新 + 跳转”时使用 Command。</p></div>
        <div><span className="section-kicker">选择原则</span><h3>可预测就写代码，不确定才交给模型</h3><p>解析、验证、权限和计费都应尽量保持确定性。</p></div>
      </div>
      <CodeBlock name="reducer" language={language} setLanguage={setLanguage} label="并行更新与 Reducer" />
      <div className="subscription-note">
        <div><span className="section-kicker">OPENAI CONNECTION</span><h2>ChatGPT 订阅 ≠ OpenAI API 用量</h2></div>
        <p>LangGraph 通常通过服务端的 OpenAI API Key 调用模型。ChatGPT Plus/Pro 与 API 平台分开计费；不要把 Key 放进浏览器，也不要让学习网站代管用户密钥。</p>
      </div>
      <CodeBlock name="openai" language={language} setLanguage={setLanguage} label="在节点中接入 OpenAI" />
      <div className="source-row"><a href="https://help.openai.com/en/articles/8156019-how-can-i-move-my-chatgpt-subscription-to-the-api" target="_blank" rel="noreferrer">OpenAI 官方计费说明 ↗</a></div>
    </>
  );
}

function DataFlow({ language, setLanguage }: { language: Language; setLanguage: (l: Language) => void }) {
  return (
    <>
      <div className="flow-strip" role="img" aria-label="输入经过 schema 验证、节点局部更新、reducer 合并、checkpoint 保存，最终输出">
        {["INPUT", "SCHEMA", "NODE UPDATE", "REDUCER", "CHECKPOINT", "OUTPUT"].map((item, i) => <div key={item}><span>{String(i + 1).padStart(2, "0")}</span><strong>{item}</strong></div>)}
      </div>
      <div className="compare-grid data-cards">
        <div><span className="section-kicker">进程内部</span><h3>类型化对象</h3><p>Python 可用 TypedDict/Pydantic；TypeScript 使用 Zod/StateSchema。消息通常会被反序列化为 LangChain Message 对象。</p></div>
        <div><span className="section-kicker">跨服务边界</span><h3>JSON 是默认线格式</h3><p>HTTP、队列和日志优先使用 JSON。日期、Decimal、二进制和自定义类必须显式编码。</p></div>
        <div><span className="section-kicker">持久化</span><h3>交给 Checkpointer</h3><p>开发环境用内存；生产使用数据库 checkpointer。它按 thread 保存状态快照，支持恢复与时间旅行。</p></div>
      </div>
      <div className="rules-list">
        <h2>序列化的 5 条工程规则</h2>
        <ol>
          <li><strong>State 只放事实。</strong><span>数据库连接、文件句柄、模型客户端放 Runtime/Context，不进 State。</span></li>
          <li><strong>节点返回局部更新。</strong><span>避免复制整个 State，也避免无意覆盖并行节点结果。</span></li>
          <li><strong>并行写同一 key 必须有 reducer。</strong><span>否则会发生更新冲突或最后写入覆盖。</span></li>
          <li><strong>副作用要幂等。</strong><span>节点重试或 checkpoint 重放时，邮件、扣款、写库不能重复发生。</span></li>
          <li><strong>版本化外部 payload。</strong><span>跨服务 JSON 加 schema_version，迁移比猜测旧结构可靠。</span></li>
        </ol>
      </div>
      <CodeBlock name="serialize" language={language} setLanguage={setLanguage} label="Checkpoint 与 JSON 边界" />
    </>
  );
}

function ApiAtlas({ language, setLanguage }: { language: Language; setLanguage: (l: Language) => void }) {
  return (
    <>
      <div className="api-scenarios">
        <article><span>REST 请求</span><h3>我要最终结果</h3><code>await graph.invoke(input, config)</code><p>路由等待图走到 END，再返回 JSON。</p></article>
        <article><span>聊天 / 进度 UI</span><h3>我要逐步事件</h3><code>for await (event of graph.stream(...))</code><p><code>updates</code> 看 State diff；<code>messages</code> 看模型流。</p></article>
        <article><span>人工审批</span><h3>我要暂停后恢复</h3><code>interrupt + thread_id + Command(resume)</code><p>编译时必须配置 checkpointer。</p></article>
      </div>
      <div className="table-wrap">
        <table className="api-table"><thead><tr><th>API</th><th>它负责什么</th><th>何时使用</th><th>最容易混淆</th></tr></thead>
          <tbody>{API_ROWS.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={cell}>{index === 0 ? <code>{cell}</code> : cell}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <div className="api-choice">
        <div><strong>Conditional Edge</strong><span>只决定“下一步去哪”</span></div>
        <div className="versus">VS</div>
        <div><strong>Command</strong><span>同时更新状态并改变流向</span></div>
        <div className="versus">VS</div>
        <div><strong>Send</strong><span>按运行时数据创建并行任务</span></div>
      </div>
      <CodeBlock name="conditional" language={language} setLanguage={setLanguage} label="条件边：让路由函数保持纯净" />
      <CodeBlock name="command" language={language} setLanguage={setLanguage} label="Command：更新 + 跳转" />
    </>
  );
}

function ToyAgent({ language, setLanguage }: { language: Language; setLanguage: (l: Language) => void }) {
  const checks = [
    ["输入", "消息 schema、大小、注入边界"],
    ["模型输出", "只接受声明过的 tool_calls"],
    ["工具执行前", "参数、权限、额度、幂等 key"],
    ["工具执行后", "状态码、结果 schema、可重试错误"],
    ["循环", "完成条件、最大步骤、超时"],
    ["恢复", "thread_id、checkpoint、副作用记录"],
  ];
  return <>
    <div className="fact-boundary">
      <strong>事实边界：按键事件不等于 Agent turn</strong>
      <p>Claude Code 的公开资料说明它有交互式 REPL、<code>UserPromptSubmit</code>、工具前后与停止等生命周期事件，但没有公开说明“每输入一个普通字符就调用 LLM 预测整句话”。因此这里把两种机制分开：输入中的补全属于终端/UI 层；按下回车提交 prompt，才进入可观察的 Agent loop。</p>
    </div>
    <div className="keystroke-grid">
      <article><span>KEYSTROKE 1</span><h3>输入第一个字符</h3><p>本地输入缓冲区更新；若是 <code>/</code>、<code>@</code> 等特殊前缀，UI 可查询命令、文件或 MCP resource 的本地索引并显示候选。</p><code>buffer = &quot;@&quot;</code></article>
      <article><span>KEYSTROKE 2…N</span><h3>继续输入</h3><p>候选列表根据新 buffer 重新过滤，旧候选被推翻。这可以完全由确定性 fuzzy search 完成，不必触发 LLM 或图节点。</p><code>candidates = filter(index, buffer)</code></article>
      <article><span>ENTER</span><h3>提交整行</h3><p>输入冻结为一条 UserMessage；触发提交生命周期、装配上下文并发起模型 turn。这里才进入模型—工具—观察循环。</p><code>agent.invoke({`{ messages: [prompt] }`})</code></article>
    </div>
    <section className="intro-grid">
      <div className="prose">
        <h2>可变顺序来自“观察后再决定”</h2>
        <p>模型节点不直接执行天气或路线 API。它只产生结构化 <code>tool_calls</code>。条件边检查最后一条消息：有调用就进入 ToolNode，没有就 END。</p>
        <p>ToolNode 校验并执行工具，把 ToolMessage 写回 State，再回到模型。于是运行顺序由当前 State、模型提议和确定性验证共同形成。</p>
      </div>
      <div className="agent-loop">
        <div>START</div><div>MODEL<small>提议工具或回答</small></div><div>TOOLS<small>验证并执行</small></div><div>END</div>
        <span>有 tool_calls：MODEL → TOOLS → MODEL ↺</span><b>无 tool_calls：MODEL → END</b>
      </div>
    </section>
    <CodeBlock name="toyAgent" language={language} setLanguage={setLanguage} label="Toy Agent：天气 / 路线工具循环" />
    <h2 className="section-title">按下回车后：Claude Code 类编程 Agent 的通用循环</h2>
    <div className="runtime-strip">{["理解目标", "选择工具", "读取/修改", "运行验证", "观察结果", "继续或结束"].map((item, index) => <div key={item}><span>{index + 1}</span><strong>{item}</strong></div>)}</div>
    <div className="agent-sequence">
      <div><span>01</span><strong>Prompt submit</strong><p>整行文本成为 UserMessage；提交 hook 可以补充或拒绝输入。</p></div>
      <div><span>02</span><strong>Context assembly</strong><p>组合会话历史、项目指令、当前目录、允许的工具与必要文件。</p></div>
      <div><span>03</span><strong>Model turn</strong><p>LLM 返回文本或结构化 tool_use。我们只依赖结果，不需要展开模型内部推理。</p></div>
      <div><span>04</span><strong>Route + permission</strong><p>没有 tool call 就流式返回；有工具则匹配权限、参数 schema 与 PreToolUse 策略。</p></div>
      <div><span>05</span><strong>Execute + observe</strong><p>执行 Read/Edit/Bash/MCP，把 tool_result 和错误写回消息历史。</p></div>
      <div><span>06</span><strong>Verify + loop</strong><p>测试/类型检查/目标判定未通过则再次调用模型；完成或达到上限则停止。</p></div>
      <div><span>07</span><strong>Return</strong><p>文本与进度事件流向终端；本轮 transcript 与 session 状态可供恢复。</p></div>
      <div><span>08</span><strong>Memory</strong><p>会话上下文、checkpoint 与项目级持久指令分层保存，生命周期不同。</p></div>
    </div>
    <p>这是一类工具 Agent 的可实现参考架构，不声称复刻 Claude Code 的未公开内部代码。官方可观察接口提供了 <code>stream-json</code>、<code>--max-turns</code>、权限配置、会话 resume，以及提交/工具/停止 hooks，正好对应输入、循环保险丝、验证与恢复这些系统边界。</p>
    <h2 className="section-title">每轮验证什么</h2>
    <div className="validation-grid">{checks.map((item) => <div key={item[0]}><strong>{item[0]}</strong><span>{item[1]}</span></div>)}</div>
    <h2 className="section-title">服务端参考架构：本地控制面 + 模型服务</h2>
    <div className="server-architecture">
      <div><strong>Terminal UI</strong><span>key buffer、补全、渲染、取消</span></div><b>→</b>
      <div><strong>Session runtime</strong><span>上下文、权限、tool registry、Agent loop</span></div><b>→</b>
      <div><strong>Model API / Gateway</strong><span>认证、预算、路由、审计、流式响应</span></div><b>→</b>
      <div><strong>Tool execution</strong><span>文件系统、shell、MCP、测试与业务 API</span></div>
    </div>
    <div className="memory-model">
      <div><strong>Working context</strong><span>当前模型请求看到的消息与工具结果；受上下文窗口约束。</span></div>
      <div><strong>Session transcript</strong><span>支持 continue/resume 的会话记录；类似 LangGraph thread + checkpoint。</span></div>
      <div><strong>Project memory</strong><span>CLAUDE.md 一类持久项目指令；类似跨运行加载的配置/长期记忆，不等同 checkpoint。</span></div>
    </div>
    <div className="warning-callout"><strong>停止不是模型的一句话</strong><span>业务成功、最大步数、工具超时、预算和用户取消都可以终止循环。生产系统同时需要业务退出条件与 recursionLimit 保险丝。</span></div>
    <div className="source-row">
      <a href="https://docs.anthropic.com/en/docs/claude-code/cli-usage" target="_blank" rel="noreferrer">Claude Code CLI：stream-json / max-turns / resume ↗</a>
      <a href="https://docs.anthropic.com/zh-CN/docs/claude-code/memory" target="_blank" rel="noreferrer">Claude Code memory / CLAUDE.md ↗</a>
      <a href="https://docs.claude.com/it/api/agent-sdk/python" target="_blank" rel="noreferrer">Agent SDK hooks 与 session ↗</a>
      <a href="https://docs.anthropic.com/en/docs/claude-code/security" target="_blank" rel="noreferrer">Claude Code 权限与安全 ↗</a>
    </div>
  </>;
}

function Playground({ language, setLanguage }: { language: Language; setLanguage: (l: Language) => void }) {
  const defaults = snippets.weather;
  const [codes, setCodes] = useState<Record<Language, string>>(defaults);
  const [activeStep, setActiveStep] = useState(-1);
  const [status, setStatus] = useState<"idle" | "running" | "done">("idle");
  const timers = useRef<number[]>([]);

  const reset = () => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    setCodes(defaults);
    setActiveStep(-1);
    setStatus("idle");
  };

  const run = () => {
    timers.current.forEach(window.clearTimeout);
    setStatus("running");
    setActiveStep(0);
    [1, 2, 3, 4].forEach((step, index) => {
      const timer = window.setTimeout(() => {
        setActiveStep(step);
        if (step === 4) setStatus("done");
      }, (index + 1) * 520);
      timers.current.push(timer);
    });
  };

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  const traces = [
    ["__start__", "接收起点、终点和经纬度"],
    ["check_weather", "调用 Open-Meteo，写入 29.4°C / code 61"],
    ["route", "读取天气，确定地铁优先"],
    ["answer", "写入面向用户的路线说明"],
    ["__end__", "final State 交给路由层序列化"],
  ];

  return (
    <>
      <div className="playground-note"><strong>安全教学模式</strong><span>代码可编辑，运行按钮播放预设执行轨迹；不会上传、执行代码或读取 API Key。</span></div>
      <BlueprintGraph active={activeStep} />
      <div className="playground-shell">
        <div className="editor-pane">
          <div className="editor-toolbar"><span>{language === "python" ? "main.py" : "main.ts"}</span><LanguageSwitch language={language} setLanguage={setLanguage} compact /></div>
          <textarea aria-label={`${language} 示例代码`} value={codes[language]} onChange={(event) => setCodes({ ...codes, [language]: event.target.value })} spellCheck={false} />
          <div className="editor-actions"><button type="button" className="secondary" onClick={reset}>Reset</button><button type="button" className="run" onClick={run} disabled={status === "running"}>{status === "running" ? "Running…" : "Run graph"}</button></div>
        </div>
        <div className="trace-pane">
          <div className="trace-title"><span>EXECUTION TRACE</span><span className={`status ${status}`}>{status.toUpperCase()}</span></div>
          <div className="trace-list">
            {traces.map((trace, index) => <div className={`${index < activeStep ? "done" : ""} ${index === activeStep ? "active" : ""}`} key={trace[0]}><span>{String(index + 1).padStart(2, "0")}</span><strong>{trace[0]}</strong><small>{trace[1]}</small></div>)}
          </div>
          <div className="state-diff"><span>STATE DIFF</span><pre>{activeStep < 0 ? "等待运行…" : activeStep < 2 ? '+ temperature: 29.4\n+ weatherCode: 61' : activeStep < 4 ? '+ routePlan: "地铁优先"' : 'final State → HTTP JSON'}</pre></div>
        </div>
      </div>
    </>
  );
}

function Patterns({ language, setLanguage }: { language: Language; setLanguage: (l: Language) => void }) {
  return (
    <>
      <div className="pattern-grid">
        {PATTERNS.map((row, index) => <article key={row[0]}><span>{String(index + 1).padStart(2, "0")}</span><h3>{row[0]}</h3><p>{row[1]}</p><strong>{row[2]}</strong><small>反模式：{row[3]}</small></article>)}
      </div>
      <div className="decision-callout"><strong>架构选择总则</strong><span>固定流程优先普通节点与边；动态并行用 Send；需要更新并跳转用 Command；高风险动作前 interrupt；长任务必须 checkpoint + 幂等副作用。</span></div>
      <CodeBlock name="pattern" language={language} setLanguage={setLanguage} label="Orchestrator–worker 骨架" />
      <div className="system-layers">
        <div><strong>Transport</strong><span>鉴权、限流、JSON、SSE / WebSocket</span></div>
        <div><strong>Application</strong><span>选择 graph、thread、超时、错误映射</span></div>
        <div><strong>Graph</strong><span>State、Node、Edge、loop、interrupt</span></div>
        <div><strong>Infrastructure</strong><span>模型、工具、checkpoint、store、观测</span></div>
      </div>
    </>
  );
}

function Project() {
  const exercises = [
    ["01", "Request lifecycle", "HTTP → schema → invoke → JSON"],
    ["02", "Weather sequence", "真实天气 API 与逐步 State diff"],
    ["03", "Deterministic routing", "Yes/No、嵌套与 fallback"],
    ["04", "LLM router", "structured output 与硬规则复核"],
    ["05", "Bounded loop", "业务出口、attempts、recursionLimit"],
    ["06", "Tool Agent", "tool_calls → ToolNode → model"],
    ["07", "Streaming", "updates 适配 SSE / WebSocket"],
    ["08", "Durable thread", "checkpoint、恢复与幂等"],
    ["09", "Parallel workers", "Send、Reducer 与汇总"],
    ["10", "Production review", "安全、监控与架构取舍"],
  ];
  return (
    <>
      <div className="repo-hero">
        <div><span className="section-kicker">PUBLIC LEARNING REPOSITORY</span><h2>langgraph-learning-lab</h2><p>网站源码、双语言示例、练习、答案与架构笔记放在同一个公开仓库里。先做 exercises，再对照 solutions。</p></div>
        <a className="repo-button" href="https://github.com/Dante-dan/langgraph-learning-lab" target="_blank" rel="noreferrer">打开 GitHub ↗</a>
      </div>
      <div className="repo-tree"><pre>{`langgraph-learning-lab/
├── python/          # Python 可运行示例
├── typescript/      # TypeScript 可运行示例
├── docs/            # 核心概念与 API 笔记
├── exercises/       # 渐进式练习
├── solutions/       # 对照答案
└── architecture/    # 架构模式与生产清单`}</pre></div>
      <div className="exercise-list">{exercises.map((item) => <div key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong><small>{item[2]}</small></div>)}</div>
      <div className="next-actions"><h2>推荐练习节奏</h2><ol><li>先预测每次 State diff。</li><li>再运行示例并比较轨迹。</li><li>故意删掉 reducer 或 thread_id，观察失败模式。</li><li>最后用自己的业务问题替换示例。</li></ol></div>
    </>
  );
}

function LessonContent({ active, language, setLanguage }: { active: SectionKey; language: Language; setLanguage: (l: Language) => void }) {
  switch (active) {
    case "roadmap": return <Roadmap />;
    case "requestflow": return <RequestFlow language={language} setLanguage={setLanguage} />;
    case "controlflow": return <ControlFlow language={language} setLanguage={setLanguage} />;
    case "quickstart": return <Quickstart language={language} setLanguage={setLanguage} />;
    case "concepts": return <Concepts language={language} setLanguage={setLanguage} />;
    case "dataflow": return <DataFlow language={language} setLanguage={setLanguage} />;
    case "api": return <ApiAtlas language={language} setLanguage={setLanguage} />;
    case "toyagent": return <ToyAgent language={language} setLanguage={setLanguage} />;
    case "playground": return <Playground language={language} setLanguage={setLanguage} />;
    case "patterns": return <Patterns language={language} setLanguage={setLanguage} />;
    case "project": return <Project />;
  }
}

export default function Home() {
  const [language, setLanguageState] = useState<Language>("python");
  const [active, setActive] = useState<SectionKey>("roadmap");
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = window.localStorage.getItem("langgraph-language");
      if (stored === "python" || stored === "typescript") setLanguageState(stored);
      const hash = window.location.hash.slice(1) as SectionKey;
      if (SECTIONS.some((section) => section.key === hash)) setActive(hash);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const setLanguage = (next: Language) => {
    setLanguageState(next);
    window.localStorage.setItem("langgraph-language", next);
  };

  const chooseSection = (next: SectionKey) => {
    setActive(next);
    setMobileNav(false);
    window.history.replaceState(null, "", `#${next}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const section = useMemo(() => SECTIONS.find((item) => item.key === active)!, [active]);
  const progress = Math.round(((SECTIONS.findIndex((item) => item.key === active) + 1) / SECTIONS.length) * 100);
  const grouped = useMemo(() => Array.from(new Set(SECTIONS.map((item) => item.group))), []);

  return (
    <div className="site-shell">
      <header className="topbar">
        <button className="mobile-menu" type="button" onClick={() => setMobileNav(!mobileNav)} aria-expanded={mobileNav} aria-label="打开课程导航">☰</button>
        <button className="brand" type="button" onClick={() => chooseSection("roadmap")}><span className="brand-mark" aria-hidden="true" /><span>LangGraph 学习实验室</span></button>
        <div className="crumbs">COURSE / <strong>{section.label}</strong></div>
        <LanguageSwitch language={language} setLanguage={setLanguage} />
      </header>
      <div className="shell">
        <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
          <div className="side-label section-kicker">LEARNING MAP · V1.0</div>
          {grouped.map((group) => <div className="module" key={group}>
            <div className="module-title">{group}</div>
            {SECTIONS.filter((item) => item.group === group).map((item) => (
              <button key={item.key} type="button" className={`nav-item ${active === item.key ? "active" : ""}`} onClick={() => chooseSection(item.key)}>
                <span className="nav-num">{item.num}</span><span>{item.label}</span><span className={`nav-state ${SECTIONS.findIndex((s) => s.key === item.key) < SECTIONS.findIndex((s) => s.key === active) ? "done" : ""}`} />
              </button>
            ))}
          </div>)}
        </aside>
        <main className="main">
          <SectionHeader section={section} />
          <div className="lesson-body"><LessonContent active={active} language={language} setLanguage={setLanguage} /></div>
          <footer className="lesson-footer">
            <span>资料按官方文档整理 · 最后校对 2026-07</span>
            <a href="https://docs.langchain.com/oss/python/langgraph/overview" target="_blank" rel="noreferrer">官方文档 ↗</a>
          </footer>
        </main>
        <aside className="context">
          <div className="context-head"><span className="section-kicker">COURSE PROGRESS</span><strong>{progress}%</strong></div>
          <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
          <div className="context-title">本节要点</div>
          <ul>
            {active === "roadmap" && <><li>天气 Agent 完整旅程</li><li>应用与 LangGraph 边界</li><li>有向图、分支与回路</li></>}
            {active === "requestflow" && <><li>接入层先解析</li><li>invoke 才启动图</li><li>HTTP / SSE / WebSocket</li></>}
            {active === "controlflow" && <><li>顺序 / 条件 / 循环</li><li>LLM 结构化路由</li><li>业务出口 + 保险丝</li></>}
            {active === "quickstart" && <><li>安装依赖</li><li>定义状态与节点</li><li>compile + invoke</li></>}
            {active === "concepts" && <><li>super-step</li><li>节点职责类型</li><li>Reducer 与并发</li></>}
            {active === "dataflow" && <><li>局部状态更新</li><li>JSON 边界</li><li>Checkpoint 恢复</li></>}
            {active === "api" && <><li>Command / Send</li><li>Store / Checkpointer</li><li>Interrupt / Stream</li></>}
            {active === "toyagent" && <><li>tool_calls 路由</li><li>工具结果回灌</li><li>逐轮验证与退出</li></>}
            {active === "playground" && <><li>编辑双语言代码</li><li>逐节点执行</li><li>观察 State diff</li></>}
            {active === "patterns" && <><li>从确定性到 Agent</li><li>并行与循环</li><li>生产反模式</li></>}
            {active === "project" && <><li>10 个渐进练习</li><li>双语言对照</li><li>生产架构清单</li></>}
          </ul>
          <div className="context-title">学习原则</div>
          <blockquote>先看全貌，再追一次请求；先定义边界，再比较相邻概念。</blockquote>
          <button className="continue" type="button" onClick={() => {
            const index = SECTIONS.findIndex((item) => item.key === active);
            if (index < SECTIONS.length - 1) chooseSection(SECTIONS[index + 1].key);
          }} disabled={active === "project"}>下一节 →</button>
        </aside>
      </div>
    </div>
  );
}
