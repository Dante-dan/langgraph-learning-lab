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
  { key: "roadmap", num: "01", label: "先看系统全貌", group: "从全貌开始", duration: "8 MIN" },
  { key: "requestflow", num: "02", label: "一次请求的旅程", group: "从全貌开始", duration: "18 MIN" },
  { key: "controlflow", num: "03", label: "顺序、分支与循环", group: "从全貌开始", duration: "24 MIN" },
  { key: "quickstart", num: "04", label: "天气出行项目", group: "第一个完整程序", duration: "18 MIN" },
  { key: "concepts", num: "05", label: "逐个定义核心构件", group: "拆开每个零件", duration: "22 MIN" },
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

function Principle({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="principle"><strong>{title}</strong><span>{children}</span></div>;
}

function SectionHeader({ section }: { section: typeof SECTIONS[number] }) {
  const titles: Record<SectionKey, string> = {
    roadmap: "先看全貌，再看每个零件",
    requestflow: "一次请求，如何真正穿过 LangGraph",
    controlflow: "顺序、分支、循环：程序如何动起来",
    quickstart: "第一个完整程序：天气出行助手",
    concepts: "逐个定义 State、Node、Edge 与 Reducer",
    dataflow: "数据怎样流转、序列化与恢复",
    api: "API 不只是列表，而是调用时机",
    toyagent: "Toy Agent：模型、工具、验证与循环",
    playground: "逐节点观察一次天气请求",
    patterns: "架构模式：为什么这样选",
    project: "把理解固化进公开 GitHub 项目",
  };
  return (
    <header className="lesson-head">
      <div>
        <div className="lesson-index">LESSON {section.num}</div>
        <h1>{titles[section.key]}</h1>
        <p className="subtitle">
          从请求边界、控制流和 State diff 出发；每一节都回答输入是什么、节点做了什么、为何这样流转、如何结束。
        </p>
      </div>
      <div className="duration">预计 {section.duration} · 入门</div>
    </header>
  );
}

function Roadmap() {
  return (
    <>
      <section className="intro-grid">
        <div className="prose">
          <h2>先把 LangGraph 当成一个程序</h2>
          <p>一个程序由数据、计算和控制流组成。LangGraph 只是把它们显式化：<code>State</code> 是带类型的数据，<code>Node</code> 是计算函数，<code>Edge</code> 是顺序/条件/循环，<code>Reducer</code> 是并发数据的合并规则。</p>
          <p>真正的系统还要再包两层：外层是 HTTP、WebSocket、鉴权和序列化；内层是模型、工具、数据库与 checkpoint。只看一张图，当然不知道用户输入从哪里来。</p>
          <div className="formula">
            <Principle title="DATA">State / schema</Principle>
            <Principle title="COMPUTE">Node / tool / model</Principle>
            <Principle title="CONTROL">Edge / branch / loop</Principle>
          </div>
        </div>
        <BlueprintGraph active={1} />
      </section>
      <div className="system-layers">
        <div><strong>01 · 接入层</strong><span>HTTP / SSE / WebSocket → 鉴权 → schema 校验</span></div>
        <div><strong>02 · 应用层</strong><span>选择 graph、thread_id、invoke / stream、错误映射</span></div>
        <div><strong>03 · 图运行时</strong><span>START → Node → State update → Edge → END</span></div>
        <div><strong>04 · 基础设施</strong><span>LLM、工具、业务 API、checkpointer、store、观测</span></div>
      </div>
      <section className="route-map">
        <div className="section-kicker">TEXTBOOK ROUTE · 全貌 → 过程 → 定义 → 组合</div>
        <h2>让每一个相邻概念都自然衍生出下一节</h2>
        <div className="route-steps">
          {SECTIONS.slice(1).map((item, index) => (
            <div className="route-step" key={item.key}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.label}</strong><small>{item.duration}</small></div>
          ))}
        </div>
      </section>
      <div className="decision-callout"><strong>贯穿全站的问题</strong><span>一次“公司到机场怎么走”的请求如何进入系统、如何查天气、如何分支、如何循环验证、怎样流式返回，以及何时根本不该使用 LangGraph。</span></div>
    </>
  );
}

function RequestFlow({ language, setLanguage }: { language: Language; setLanguage: (l: Language) => void }) {
  const steps = [
    ["01", "Client", "POST /api/trips/plan", "JSON bytes"],
    ["02", "Router", "反序列化、鉴权、schema 校验", "TripInput"],
    ["03", "invoke", "input 成为初始 State；START 激活首节点", "checkpoint #0"],
    ["04", "check_weather", "读取坐标，调用 Open-Meteo", "+ weather"],
    ["05", "route", "按天气/距离选择下一节点", "branch"],
    ["06", "END", "没有待执行节点，形成 final State", "checkpoint #N"],
    ["07", "Router", "挑选公开字段，序列化响应", "HTTP JSON"],
  ];
  return <>
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
      <article><span>KEYSTROKE 1</span><h3>输入第一个字符</h3><p>本地输入缓冲区更新；若是 <code>/</code>、<code>@</code> 等特殊前缀，UI 可查询命令、文件或 MCP resource 的本地索引并显示候选。</p><code>buffer = "@"</code></article>
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
    const stored = window.localStorage.getItem("langgraph-language");
    if (stored === "python" || stored === "typescript") setLanguageState(stored);
    const hash = window.location.hash.slice(1) as SectionKey;
    if (SECTIONS.some((section) => section.key === hash)) setActive(hash);
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
            {active === "roadmap" && <><li>低层 Agent 编排</li><li>State + Node + Edge</li><li>什么时候不该用图</li></>}
            {active === "requestflow" && <><li>接入层先解析</li><li>invoke 才启动图</li><li>HTTP / SSE / WebSocket</li></>}
            {active === "controlflow" && <><li>顺序 / 条件 / 循环</li><li>LLM 结构化路由</li><li>业务出口 + 保险丝</li></>}
            {active === "quickstart" && <><li>安装依赖</li><li>定义状态与节点</li><li>compile + invoke</li></>}
            {active === "concepts" && <><li>super-step</li><li>节点职责类型</li><li>Reducer 与并发</li></>}
            {active === "dataflow" && <><li>局部状态更新</li><li>JSON 边界</li><li>Checkpoint 恢复</li></>}
            {active === "api" && <><li>Command / Send</li><li>Store / Checkpointer</li><li>Interrupt / Stream</li></>}
            {active === "toyagent" && <><li>tool_calls 路由</li><li>工具结果回灌</li><li>逐轮验证与退出</li></>}
            {active === "playground" && <><li>编辑双语言代码</li><li>逐节点执行</li><li>观察 State diff</li></>}
            {active === "patterns" && <><li>从确定性到 Agent</li><li>并行与循环</li><li>生产反模式</li></>}
            {active === "project" && <><li>6 个渐进练习</li><li>双语言对照</li><li>生产架构清单</li></>}
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
