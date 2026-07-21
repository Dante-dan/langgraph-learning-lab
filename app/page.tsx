"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  simulateTrip,
  type TripPreference,
  type TripSimulationInput,
  type WeatherScenario,
} from "../lib/weather-simulator";
import { PLAYGROUND_PROGRAMS } from "../lib/playground-programs";

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
  const [copied, setCopied] = useState(false);
  const code = snippets[name][language];
  const filename = language === "python" ? `${String(name)}.py` : `${String(name)}.ts`;

  const copyCode = async () => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(code);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = code;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const downloadCode = () => {
    const url = URL.createObjectURL(new Blob([code], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="code-block">
      <div className="code-head">
        <span>{label}</span>
        <span className="file-name">{filename}</span>
      </div>
      <pre><code>{code}</code></pre>
      <div className="code-foot">
        <div className="code-actions">
          <button type="button" onClick={copyCode}>{copied ? "已复制" : "复制代码"}</button>
          <button type="button" onClick={downloadCode}>下载文件</button>
          <button type="button" onClick={() => { window.location.hash = "#/playground/weather"; }}>打开可执行 Playground</button>
          <span className="sr-only" aria-live="polite">{copied ? "代码已复制" : ""}</span>
        </div>
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
        <h1 tabIndex={-1}>{titles[section.key]}</h1>
        <p className="subtitle">{subtitles[section.key]}</p>
      </div>
      <div className="duration">预计 {section.duration} · 入门</div>
    </header>
  );
}

type WeatherBranch = "missing" | "rain" | "clear";
type ValidationOutcome = "pass" | "retry" | "fallback";
type WeatherTopologyPointId =
  | "start"
  | "validate_input"
  | "ask_user"
  | "check_weather"
  | "route_weather"
  | "plan_transit"
  | "plan_outdoor"
  | "validate_plan"
  | "quality_gate"
  | "fallback"
  | "respond"
  | "end";

type TopologySegment = {
  left: number;
  top: number;
  length: number;
  axis: "horizontal" | "vertical";
  arrow?: "right" | "left" | "up" | "down";
};

const WEATHER_TOPOLOGY_WIDTH = 1180;
const WEATHER_TOPOLOGY_HEIGHT = 600;
const MIN_TOPOLOGY_ZOOM = 0.2;
const MAX_TOPOLOGY_ZOOM = 1.5;

function clampTopologyZoom(value: number) {
  return Math.min(MAX_TOPOLOGY_ZOOM, Math.max(MIN_TOPOLOGY_ZOOM, value));
}

function fitTopologyZoom(viewportWidth: number) {
  return clampTopologyZoom((viewportWidth - 2) / WEATHER_TOPOLOGY_WIDTH);
}

const WEATHER_TOPOLOGY_POINTS: Array<{
  id: WeatherTopologyPointId;
  label: string;
  role: string;
  shape: "terminal" | "work" | "decision" | "human" | "fallback";
  left: number;
  top: number;
}> = [
  { id: "start", label: "START", role: "virtual", shape: "terminal", left: 48, top: 300 },
  { id: "validate_input", label: "validate_input", role: "Node", shape: "work", left: 155, top: 300 },
  { id: "ask_user", label: "ask_user", role: "Node · interrupt", shape: "human", left: 315, top: 105 },
  { id: "check_weather", label: "check_weather", role: "Node · I/O", shape: "work", left: 315, top: 300 },
  { id: "route_weather", label: "route", role: "Edge marker · not Node", shape: "decision", left: 465, top: 300 },
  { id: "plan_transit", label: "plan_transit", role: "Node", shape: "work", left: 615, top: 210 },
  { id: "plan_outdoor", label: "plan_outdoor", role: "Node", shape: "work", left: 615, top: 390 },
  { id: "validate_plan", label: "validate_plan", role: "Node · evaluator", shape: "work", left: 755, top: 300 },
  { id: "quality_gate", label: "accepted?", role: "Edge marker · not Node", shape: "decision", left: 875, top: 300 },
  { id: "fallback", label: "fallback", role: "Node", shape: "fallback", left: 1010, top: 485 },
  { id: "respond", label: "respond", role: "Node", shape: "work", left: 1010, top: 300 },
  { id: "end", label: "END", role: "virtual", shape: "terminal", left: 1130, top: 300 },
];

const WEATHER_TOPOLOGY_DETAILS: Record<WeatherTopologyPointId, {
  kind: string;
  reads: string;
  writes: string;
  why: string;
}> = {
  start: { kind: "虚拟入口", reads: "graph.invoke(input)", writes: "激活 validate_input", why: "START 不执行业务函数，只定义初始输入从哪里进入图。" },
  validate_input: { kind: "确定性 Node", reads: "origin、destination、latitude、longitude", writes: "normalized input、errors", why: "先把可精确判断的完整性规则留在代码里。" },
  ask_user: { kind: "Human-in-the-Loop Node", reads: "errors / missing fields", writes: "interrupt payload；恢复后写入用户补充值", why: "interrupt 暂停当前 thread，checkpointer 保存状态；外部用 Command(resume=...) 恢复。" },
  check_weather: { kind: "I/O Node", reads: "latitude、longitude", writes: "temperature、weather_code、observed_at", why: "天气调用有独立的超时、重试和可观测边界。" },
  route_weather: { kind: "Conditional Edge 的可视化标记（不是 Node）", reads: "weather_code、distance、preference", writes: "目标节点名", why: "路由函数在上游 Node 完成后被求值，不占一个独立 Node 或 super-step；它只决定下一步。" },
  plan_transit: { kind: "规划 Node", reads: "weather、preference", writes: "mode、route_plan、reason", why: "雨天或少步行条件下生成公共交通候选方案。" },
  plan_outdoor: { kind: "规划 Node", reads: "weather、distance、preference", writes: "mode、route_plan、reason", why: "天气良好且距离合适时比较步行和公交。" },
  validate_plan: { kind: "Evaluator Node", reads: "candidate plan、acceptance contract", writes: "accepted、errors、attempts", why: "业务完成由可检查的验收条件决定，不由生成节点自行宣布。" },
  quality_gate: { kind: "Conditional Edge 的可视化标记（不是 Node）", reads: "accepted、errors、attempts", writes: "respond / retry / fallback", why: "菱形只是把路由判断画出来：通过就响应；可恢复失败走回边；耗尽上限进入 fallback。" },
  fallback: { kind: "Fallback Node", reads: "errors、attempts", writes: "保守方案、人工确认提示", why: "外部数据或自动规划持续失败时，给出诚实而可执行的降级结果。" },
  respond: { kind: "映射 Node", reads: "final internal State", writes: "public response fields", why: "只把允许公开的字段交回应用层序列化。" },
  end: { kind: "虚拟终点", reads: "无", writes: "无", why: "END 表示该路径之后没有动作；当所有节点 inactive 且没有消息在途时，本次执行终止。" },
};

const WEATHER_TOPOLOGY_EDGES: Array<{
  id: string;
  label?: string;
  labelLeft?: number;
  labelTop?: number;
  dashed?: boolean;
  pending?: boolean;
  segments: TopologySegment[];
}> = [
  { id: "start-validate", segments: [{ left: 76, top: 300, length: 19, axis: "horizontal", arrow: "right" }] },
  { id: "validate-check", label: "valid", labelLeft: 246, labelTop: 282, segments: [{ left: 215, top: 300, length: 40, axis: "horizontal", arrow: "right" }] },
  { id: "validate-ask", label: "missing", labelLeft: 222, labelTop: 176, segments: [{ left: 215, top: 300, length: 20, axis: "horizontal" }, { left: 235, top: 105, length: 195, axis: "vertical" }, { left: 235, top: 105, length: 20, axis: "horizontal", arrow: "right" }] },
  { id: "ask-interrupt", label: "interrupt payload", labelLeft: 382, labelTop: 69, dashed: true, pending: true, segments: [{ left: 375, top: 90, length: 42, axis: "horizontal", arrow: "right" }] },
  { id: "resume-ask", label: "Command(resume)", labelLeft: 380, labelTop: 129, dashed: true, pending: true, segments: [{ left: 375, top: 125, length: 42, axis: "horizontal", arrow: "left" }] },
  { id: "ask-revalidate", label: "node returns update → revalidate", labelLeft: 126, labelTop: 215, pending: true, segments: [{ left: 315, top: 140, length: 90, axis: "vertical" }, { left: 155, top: 230, length: 160, axis: "horizontal" }, { left: 155, top: 230, length: 35, axis: "vertical", arrow: "down" }] },
  { id: "check-route", segments: [{ left: 375, top: 300, length: 48, axis: "horizontal", arrow: "right" }] },
  { id: "route-transit", label: "rain / long", labelLeft: 516, labelTop: 205, segments: [{ left: 507, top: 300, length: 30, axis: "horizontal" }, { left: 537, top: 210, length: 90, axis: "vertical" }, { left: 537, top: 210, length: 18, axis: "horizontal", arrow: "right" }] },
  { id: "route-outdoor", label: "clear / short", labelLeft: 512, labelTop: 400, segments: [{ left: 507, top: 300, length: 30, axis: "horizontal" }, { left: 537, top: 300, length: 90, axis: "vertical" }, { left: 537, top: 390, length: 18, axis: "horizontal", arrow: "right" }] },
  { id: "transit-validate", segments: [{ left: 675, top: 210, length: 24, axis: "horizontal" }, { left: 699, top: 210, length: 90, axis: "vertical" }, { left: 699, top: 300, length: 16, axis: "horizontal", arrow: "right" }] },
  { id: "outdoor-validate", segments: [{ left: 675, top: 390, length: 24, axis: "horizontal" }, { left: 699, top: 300, length: 90, axis: "vertical" }, { left: 699, top: 300, length: 16, axis: "horizontal", arrow: "right" }] },
  { id: "validate-gate", segments: [{ left: 815, top: 300, length: 18, axis: "horizontal", arrow: "right" }] },
  { id: "gate-respond", label: "accepted", labelLeft: 924, labelTop: 282, segments: [{ left: 917, top: 300, length: 33, axis: "horizontal", arrow: "right" }] },
  { id: "gate-fallback", label: "attempts ≥ 3", labelLeft: 922, labelTop: 395, segments: [{ left: 917, top: 300, length: 24, axis: "horizontal" }, { left: 941, top: 300, length: 185, axis: "vertical" }, { left: 941, top: 485, length: 9, axis: "horizontal", arrow: "right" }] },
  { id: "fallback-respond", label: "degraded", labelLeft: 1019, labelTop: 392, segments: [{ left: 1010, top: 335, length: 115, axis: "vertical", arrow: "up" }] },
  { id: "respond-end", segments: [{ left: 1070, top: 300, length: 31, axis: "horizontal", arrow: "right" }] },
  { id: "retry-loop", label: "failed && attempts < 3 · LOOP", labelLeft: 555, labelTop: 548, segments: [{ left: 875, top: 342, length: 213, axis: "vertical" }, { left: 315, top: 555, length: 560, axis: "horizontal" }, { left: 315, top: 340, length: 215, axis: "vertical", arrow: "up" }] },
];

function WeatherTopology({
  branch,
  setBranch,
  validation,
  setValidation,
}: {
  branch: WeatherBranch;
  setBranch: (branch: WeatherBranch) => void;
  validation: ValidationOutcome;
  setValidation: (outcome: ValidationOutcome) => void;
}) {
  const [inspectedPoint, setInspectedPoint] = useState<WeatherTopologyPointId>("route_weather");
  const [topologyZoom, setTopologyZoom] = useState(0.75);
  const [fitMode, setFitMode] = useState(true);
  const topologyScrollRef = useRef<HTMLDivElement>(null);
  const activePoints = new Set<WeatherTopologyPointId>(["start", "validate_input"]);
  const activeEdges = new Set<string>(["start-validate"]);

  if (branch === "missing") {
    activePoints.add("ask_user");
    activeEdges.add("validate-ask");
  } else {
    ["check_weather", "route_weather", branch === "rain" ? "plan_transit" : "plan_outdoor", "validate_plan", "quality_gate", "respond", "end"].forEach((id) => activePoints.add(id as WeatherTopologyPointId));
    ["validate-check", "check-route", branch === "rain" ? "route-transit" : "route-outdoor", branch === "rain" ? "transit-validate" : "outdoor-validate", "validate-gate", "respond-end"].forEach((id) => activeEdges.add(id));
    if (validation === "fallback") {
      activePoints.add("fallback");
      activeEdges.add("retry-loop");
      activeEdges.add("gate-fallback");
      activeEdges.add("fallback-respond");
    } else {
      activeEdges.add("gate-respond");
      if (validation === "retry") activeEdges.add("retry-loop");
    }
  }

  const chooseBranch = (next: WeatherBranch) => {
    setBranch(next);
    setInspectedPoint(next === "missing" ? "ask_user" : next === "rain" ? "plan_transit" : "plan_outdoor");
  };
  const chooseValidation = (next: ValidationOutcome) => {
    setValidation(next);
    setInspectedPoint(next === "fallback" ? "fallback" : "quality_gate");
  };
  const setManualZoom = (next: number) => {
    setFitMode(false);
    setTopologyZoom(clampTopologyZoom(next));
  };
  const fitTopology = () => {
    const scroller = topologyScrollRef.current;
    setFitMode(true);
    if (!scroller) return;
    setTopologyZoom(fitTopologyZoom(scroller.clientWidth));
    scroller.scrollTo({ left: 0, top: 0, behavior: "smooth" });
  };
  useEffect(() => {
    const scroller = topologyScrollRef.current;
    if (!scroller || !fitMode) return;
    const applyFit = () => {
      setTopologyZoom(fitTopologyZoom(scroller.clientWidth));
      scroller.scrollTo({ left: 0, top: 0 });
    };
    applyFit();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(applyFit);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [fitMode]);
  useEffect(() => {
    const scroller = topologyScrollRef.current;
    const point = WEATHER_TOPOLOGY_POINTS.find((item) => item.id === inspectedPoint);
    if (!scroller || !point) return;
    const scaledWidth = WEATHER_TOPOLOGY_WIDTH * topologyZoom;
    const scaledHeight = WEATHER_TOPOLOGY_HEIGHT * topologyZoom;
    if (scaledWidth <= scroller.clientWidth && scaledHeight <= scroller.clientHeight) return;
    scroller.scrollTo({
      left: Math.max(0, point.left * topologyZoom - scroller.clientWidth / 2),
      top: Math.max(0, point.top * topologyZoom - scroller.clientHeight / 2),
      behavior: "smooth",
    });
  }, [inspectedPoint, topologyZoom]);
  const inspected = WEATHER_TOPOLOGY_DETAILS[inspectedPoint];
  const executionPath = branch === "missing"
    ? "START → validate_input → ask_user → INTERRUPT（thread 暂停，等待 resume）"
    : `START → validate_input → check_weather ─[${branch === "rain" ? "rain / long" : "clear / short"}]→ ${branch === "rain" ? "plan_transit" : "plan_outdoor"} → validate_plan ─[${validation === "pass" ? "accepted" : validation === "retry" ? "failed → retry → accepted" : "attempts exhausted"}]→ ${validation === "fallback" ? "fallback → " : ""}respond → END`;

  return (
    <section className="topology-lab" aria-labelledby="topology-title">
      <div className="topology-lab-head">
        <div><span className="section-kicker">PART 02 · 把可变顺序画成一张真实拓扑</span><h2 id="topology-title">条件变化时，节点与路径怎样一起变化？</h2><p>先选择输入条件，再选择验证结果。图不会换成另一张：同一张图里只有本次真正经过的节点和边会点亮；点击任意节点还能检查它读什么、返回什么。</p></div>
        <div className="topology-legend" aria-label="图例">
          <span><i className="legend-node" />Node：执行函数</span>
          <span><i className="legend-state" />State：共享快照 / 局部更新</span>
          <span><i className="legend-edge" />Edge：调度方向</span>
          <span><i className="legend-decision" />Conditional Edge：选择目标</span>
          <p className="edge-marker-note"><strong>菱形只是条件边的可视化标记，不是 Node。</strong>路由函数在上游节点完成后被求值，不单独占一个 super-step。</p>
        </div>
      </div>

      <div className="topology-controls">
        <fieldset><legend>① 输入条件</legend>
          <button type="button" className={branch === "missing" ? "active" : ""} onClick={() => chooseBranch("missing")} aria-pressed={branch === "missing"}><strong>信息不完整</strong><small>进入 ask_user</small></button>
          <button type="button" className={branch === "rain" ? "active" : ""} onClick={() => chooseBranch("rain")} aria-pressed={branch === "rain"}><strong>下雨 / 少步行</strong><small>进入 plan_transit</small></button>
          <button type="button" className={branch === "clear" ? "active" : ""} onClick={() => chooseBranch("clear")} aria-pressed={branch === "clear"}><strong>晴天 / 短距离</strong><small>进入 plan_outdoor</small></button>
        </fieldset>
        <fieldset disabled={branch === "missing"}><legend>② 规划后的验证结果</legend>
          <button type="button" className={validation === "pass" ? "active" : ""} onClick={() => chooseValidation("pass")} aria-pressed={validation === "pass"}><strong>首次通过</strong><small>直接 respond</small></button>
          <button type="button" className={validation === "retry" ? "active" : ""} onClick={() => chooseValidation("retry")} aria-pressed={validation === "retry"}><strong>失败一次</strong><small>走回边后通过</small></button>
          <button type="button" className={validation === "fallback" ? "active" : ""} onClick={() => chooseValidation("fallback")} aria-pressed={validation === "fallback"}><strong>耗尽上限</strong><small>进入 fallback</small></button>
        </fieldset>
      </div>

      <div className="topology-view-toolbar">
        <div><span>CANVAS VIEW</span><strong>{Math.round(topologyZoom * 100)}%</strong><small>{fitMode ? "FIT WIDTH" : "MANUAL"}</small></div>
        <div className="topology-zoom-controls" role="group" aria-label="拓扑图缩放控制">
          <button type="button" onClick={() => setManualZoom(topologyZoom - 0.1)} disabled={topologyZoom <= MIN_TOPOLOGY_ZOOM} aria-label="缩小拓扑图">−</button>
          <input type="range" min="20" max="150" step="1" value={Math.round(topologyZoom * 100)} onChange={(event) => setManualZoom(event.currentTarget.valueAsNumber / 100)} aria-label="拓扑图缩放比例" />
          <button type="button" onClick={() => setManualZoom(topologyZoom + 0.1)} disabled={topologyZoom >= MAX_TOPOLOGY_ZOOM} aria-label="放大拓扑图">＋</button>
          <button type="button" className={fitMode ? "active" : ""} onClick={fitTopology} aria-pressed={fitMode}>适应宽度</button>
          <button type="button" onClick={() => setManualZoom(1)}>100%</button>
        </div>
        <p>缩放只改变画布视图，不改变 Graph 的节点、路径或执行状态。</p>
      </div>

      <div className="topology-scroll" ref={topologyScrollRef} tabIndex={0} aria-label="天气 Agent 可缩放并滚动的拓扑图">
        <div className="topology-stage" style={{ width: WEATHER_TOPOLOGY_WIDTH * topologyZoom, height: WEATHER_TOPOLOGY_HEIGHT * topologyZoom }}>
          <div className="weather-topology" style={{ transform: `scale(${topologyZoom})` }}>
          <div aria-hidden="true" className={`hitl-boundary ${branch === "missing" ? "active" : ""}`}><span>HUMAN-IN-THE-LOOP</span><small>interrupt · checkpoint · resume</small></div>
          <div aria-hidden="true" className={`loop-boundary ${branch !== "missing" && validation !== "pass" ? "active" : ""}`}><span>BOUNDED CONDITIONAL LOOP</span><small>failed &amp;&amp; attempts &lt; 3 → retry</small></div>
          {WEATHER_TOPOLOGY_EDGES.map((edge) => (
            <div key={edge.id} className={`topology-edge ${activeEdges.has(edge.id) ? "active" : ""} ${edge.dashed ? "dashed" : ""} ${edge.pending && branch === "missing" ? "pending" : ""}`} aria-hidden="true">
              {edge.segments.map((segment, index) => (
                <i key={index} className={`edge-segment ${segment.axis} ${segment.arrow ? `arrow-${segment.arrow}` : ""}`} style={segment.axis === "horizontal" ? { left: segment.left, top: segment.top, width: segment.length } : { left: segment.left, top: segment.top, height: segment.length }} />
              ))}
              {edge.label && <span className="edge-label" style={{ left: edge.labelLeft, top: edge.labelTop }}>{edge.label}</span>}
            </div>
          ))}
          {WEATHER_TOPOLOGY_POINTS.map((point) => (
            <button key={point.id} type="button" className={`topology-point ${point.shape} ${activePoints.has(point.id) ? "active" : ""} ${inspectedPoint === point.id ? "selected" : ""}`} style={{ left: point.left, top: point.top }} onClick={() => setInspectedPoint(point.id)} aria-pressed={inspectedPoint === point.id}>
              <span className="point-content"><small>{point.role}</small><strong>{point.label}</strong></span>
            </button>
          ))}
          <div aria-hidden="true" className={`topology-state state-input ${activePoints.has("validate_input") ? "active" : ""}`}><small>STATE Δ</small><code>normalized input / errors</code></div>
          <div aria-hidden="true" className={`topology-state state-weather ${activePoints.has("check_weather") ? "active" : ""}`}><small>STATE Δ</small><code>weather_code / observed_at</code></div>
          <div aria-hidden="true" className={`topology-state state-plan-transit ${activePoints.has("plan_transit") ? "active" : ""}`}><small>STATE Δ</small><code>route_plan / reason</code></div>
          <div aria-hidden="true" className={`topology-state state-plan-outdoor ${activePoints.has("plan_outdoor") ? "active" : ""}`}><small>STATE Δ</small><code>route_plan / reason</code></div>
          <div aria-hidden="true" className={`topology-state state-validation ${activePoints.has("validate_plan") ? "active" : ""}`}><small>STATE Δ</small><code>accepted / errors / attempts</code></div>
          <div aria-hidden="true" className={`resume-state ${branch === "missing" ? "active" : ""}`}><small>EXTERNAL INPUT</small><code>Command(resume=answer)</code></div>
          </div>
        </div>
      </div>

      <div className="topology-path" aria-live="polite"><span>本次高亮路径</span><code>{executionPath}</code></div>
      <div className="topology-inspector" aria-live="polite">
        <div><span>SELECTED</span><strong>{inspectedPoint}</strong><small>{inspected.kind}</small></div>
        <div><span>READS</span><code>{inspected.reads}</code><span>RETURNS / ROUTES</span><code>{inspected.writes}</code></div>
        <p>{inspected.why}</p>
      </div>
      {branch === "missing" && <div className="hitl-explanation"><strong>为什么这里不是 END？</strong><span><code>interrupt()</code> 会通过 checkpointer 保存当前图状态并暂停 thread。页面拿到的是“需要外部输入”的中断结果；用户回答后，应用带着同一个 <code>thread_id</code> 调用 <code>Command(resume=...)</code>。恢复时，包含 interrupt 的 <code>ask_user</code> 节点会从函数开头重新执行，所以 interrupt 之前的副作用必须幂等。</span></div>}
      <div className="source-row"><a href="https://docs.langchain.com/oss/python/langgraph/graph-api" target="_blank" rel="noreferrer">官方 Graph API：State、Nodes、Edges 与执行模型 ↗</a><a href="https://docs.langchain.com/oss/python/langgraph/interrupts" target="_blank" rel="noreferrer">官方 Interrupts：pause、thread_id 与 resume ↗</a></div>
    </section>
  );
}

function OrchestrationBoundary({ onNavigate }: { onNavigate: (section: SectionKey) => void }) {
  return (
    <section className="opening-section orchestration-boundary">
      <span className="section-kicker">PART 03 · 从完整图反推它能表达什么</span>
      <h2>能画出来，不等于能可靠结束：拓扑能力和运行约束要分开</h2>
      <p>LangGraph 官方示例明确覆盖 sequence、branch 和 loop。它使用有向图，但不要求是 DAG；真正需要防止的不是“出现环”，而是环没有业务停止条件。</p>
      <div className="orchestration-cards">
        <button type="button" onClick={() => onNavigate("controlflow")}>
          <span className="support-badge">SUPPORTED</span>
          <div className="mini-topology mini-sequence" aria-hidden="true"><i className="mini-node a" /><i className="mini-line one" /><i className="mini-node b" /><i className="mini-line two" /><i className="mini-node c" /></div>
          <h3>顺序 · ONE → ONE</h3><p>固定 Edge 让节点在不同 super-step 依次激活。</p><b>查看顺序结构 →</b>
        </button>
        <button type="button" onClick={() => onNavigate("dataflow")}>
          <span className="support-badge">SUPPORTED</span>
          <div className="mini-topology mini-fan" aria-hidden="true"><i className="mini-node a" /><i className="mini-line trunk" /><i className="mini-line split" /><i className="mini-line upper" /><i className="mini-line lower" /><i className="mini-node b" /><i className="mini-node c" /><i className="mini-line upper-out" /><i className="mini-line lower-out" /><i className="mini-line merge" /><i className="mini-line tail" /><i className="mini-node d" /></div>
          <h3>分叉与汇合 · ONE → MANY → ONE</h3><p>多个目标可在下一 super-step 并行；共享 key 需要 reducer，明确 barrier 才汇合。</p><b>查看并行数据合并 →</b>
        </button>
        <button type="button" onClick={() => onNavigate("controlflow")}>
          <span className="support-badge">SUPPORTED</span>
          <div className="mini-topology mini-loop" aria-hidden="true"><i className="mini-node a" /><i className="mini-line forward" /><i className="mini-node b" /><i className="mini-line exit" /><i className="mini-node c" /><i className="mini-line down" /><i className="mini-line back" /><i className="mini-line up" /></div>
          <h3>有界循环 · LOOP WITH EXIT</h3><p>条件 Edge 可以回到旧节点；验收通过、次数、超时或人工决定负责退出。</p><b>查看 Loop 代码 →</b>
        </button>
        <button type="button" className="invalid" onClick={() => onNavigate("controlflow")}>
          <span className="support-badge danger">INVALID RUN DESIGN</span>
          <div className="mini-topology mini-infinite" aria-hidden="true"><i className="mini-node a" /><i className="mini-node b" /><i className="mini-line top" /><i className="mini-line bottom" /><i className="mini-cross">×</i></div>
          <h3>无停止条件的环</h3><p>它不是“无法定义的拓扑”：可以编译，但运行会在达到 recursion limit 时抛错，不能作为可完成流程交付。</p><b>查看保险丝与业务出口 →</b>
        </button>
      </div>
      <div className="direction-note"><strong>图上的左、右只是排版</strong><p>真正的“方向”是消息沿 Edge 激活下一 super-step。回边会再次执行旧节点，但不会穿越时间改写已经保存的 checkpoint。</p></div>
      <div className="source-row"><a href="https://docs.langchain.com/oss/python/langgraph/use-graph-api" target="_blank" rel="noreferrer">官方示例：sequence、branch 与 loop ↗</a><a href="https://docs.langchain.com/oss/python/langgraph/errors/GRAPH_RECURSION_LIMIT" target="_blank" rel="noreferrer">官方错误说明：GRAPH_RECURSION_LIMIT ↗</a></div>
    </section>
  );
}

function Roadmap({ onNavigate }: { onNavigate: (section: SectionKey) => void }) {
  const journey = [
    ["01", "用户提交", "在天气出行页面输入公司、机场、时间与位置，然后点击“生成计划”。", "这时还没有进入 LangGraph"],
    ["02", "服务端接住 POST", "路由层把 JSON bytes 反序列化成 TripInput，完成鉴权、字段校验并生成 request_id。", "应用层职责"],
    ["03", "启动图", "应用层调用 graph.ainvoke(input, config)。输入成为初始 State，虚拟 START 激活 validate_input。", "LangGraph 开始调度"],
    ["04", "检查业务输入", "validate_input 读取起点、终点与位置：完整才继续；缺失就路由到 ask_user 并 interrupt。", "第一次条件分支"],
    ["05", "查询天气", "check_weather 读取经纬度，调用天气 API，只返回 temperature、weather_code 与 observed_at 的局部更新。", "Node 做工作"],
    ["06", "选择路线", "条件边读取当前 State：下雨进入公共交通方案；天气好进入步行 / 公交比较。", "Edge 决定下一步"],
    ["07", "生成候选计划", "被选中的规划节点写入 mode、route_plan 与 reason。它不直接结束请求，后面还有质量门。", "State 继续演化"],
    ["08", "验证并决定是否循环", "validate_plan 检查天气是否过期、路线是否可用、解释是否完整。通过就响应；失败且未超上限就回到查询 / 规划；连续失败则进入 fallback。", "条件边形成有界回路"],
    ["09", "返回结果", "respond 只挑选允许公开的字段；到达 END 后，路由层把 final State 序列化成 HTTP JSON。", "END 不是业务函数"],
  ];
  const journeySnapshots = [
    { layer: "Browser", input: "form fields", output: "HTTP request intent", state: { origin: "上海公司", destination: "浦东机场", preference: "下雨少步行" } },
    { layer: "Router", input: "JSON bytes", output: "TripInput", state: { requestId: "trip-42", authenticated: true, schemaValid: true } },
    { layer: "Application", input: "TripInput + RunnableConfig", output: "initial State", state: { threadId: "trip-42", next: ["validate_input"] } },
    { layer: "Graph node", input: "origin / destination / location", output: "Partial<State>", state: { normalized: true, errors: [], next: ["check_weather"] } },
    { layer: "Graph node", input: "latitude / longitude", output: "Partial<State>", state: { temperature: 22.8, weatherCode: 61, observedAt: "07:55" } },
    { layer: "Conditional edge", input: "current State", output: "target node", state: { decision: "plan_transit", reason: "weatherCode >= 51" } },
    { layer: "Planning node", input: "weather + preference", output: "candidate plan", state: { mode: "地铁优先", routePlan: "公司 → 2号线 → 机场" } },
    { layer: "Validator", input: "candidate + acceptance contract", output: "accepted / retry / fallback", state: { accepted: true, errors: [], attempts: 1 } },
    { layer: "Response mapper", input: "final State", output: "public JSON", state: { status: "accepted", mode: "地铁优先" } },
  ];
  const [selectedJourney, setSelectedJourney] = useState(0);
  const [branch, setBranch] = useState<WeatherBranch>("rain");
  const [validation, setValidation] = useState<ValidationOutcome>("pass");
  const selectedSnapshot = journeySnapshots[selectedJourney];
  const branchResponse = branch === "missing"
    ? { runtimeStatus: "paused", at: "ask_user", missing: ["location"], resumeWith: "Command(resume=answer)" }
    : validation === "fallback"
      ? { status: "fallback", attempts: 3, mode: "人工确认", reason: "候选路线连续未通过验证" }
      : {
          status: "accepted",
          attempts: validation === "retry" ? 2 : 1,
          mode: branch === "rain" ? "地铁优先" : "步行 + 公交",
          route: branch === "rain" ? "公司 → 2号线 → 浦东机场" : "公司 → 步行 / 公交 → 浦东机场",
          reason: branch === "rain" ? "当前有雨，减少室外步行" : "天气良好且距离较短",
        };

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
          <div><strong>当前位置</strong><b>31.2304, 121.4737</b></div>
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
  "preference": "下雨少步行",
  "latitude": 31.2304,
  "longitude": 121.4737
}`}</pre>
      </div>

      <section className="opening-section">
        <span className="section-kicker">PART 01 · 先把业务流程完整跑一遍</span>
        <h2>从点击“生成计划”到收到结果，依次发生什么？</h2>
        <p>下面每一步都先说业务事实，再标出它属于应用代码还是 LangGraph 调度。读完这一段，你应该先能复述完整程序；后面的概念只是给这些步骤起名字。</p>
        <div className="journey-list">
          {journey.map((step) => (
            <button type="button" className={journey[selectedJourney][0] === step[0] ? "active" : ""} key={step[0]} onClick={() => setSelectedJourney(journey.indexOf(step))} aria-pressed={journey[selectedJourney][0] === step[0]}>
              <span>{step[0]}</span>
              <h3>{step[1]}</h3>
              <p>{step[2]}</p>
              <small>{step[3]}</small>
            </button>
          ))}
        </div>
        <div className="journey-inspector" aria-live="polite">
          <div><span>当前步骤</span><strong>{journey[selectedJourney][0]} · {journey[selectedJourney][1]}</strong><small>{selectedSnapshot.layer}</small></div>
          <div><span>INPUT → OUTPUT</span><code>{selectedSnapshot.input} → {selectedSnapshot.output}</code></div>
          <div><span>此刻可观察状态</span><pre>{JSON.stringify(selectedSnapshot.state, null, 2)}</pre></div>
        </div>
      </section>

      <WeatherTopology branch={branch} setBranch={setBranch} validation={validation} setValidation={setValidation} />

      <section className="result-reveal">
        <div>
          <span className="section-kicker">图的路径与外部可见结果同步变化</span>
          <h2>{branch === "missing" ? "这次运行暂停了，还没有到 END" : "高亮路径最终收敛为一个可返回结果"}</h2>
          <p>{branch === "missing" ? "应用层把 interrupt 信息呈现给用户；收到回答后，用同一个 thread_id 恢复，而不是重新伪造一次无关请求。" : "切换验证结果会让回边或 fallback 同步点亮。继续进入 Playground，还可以修改输入和双语言代码并实际执行。"}</p>
        </div>
        <pre>{JSON.stringify(branchResponse, null, 2)}</pre>
      </section>

      <OrchestrationBoundary onNavigate={onNavigate} />

      <section className="opening-section official-position">
        <span className="section-kicker">PART 04 · 到这里再问：LangGraph 在系统里究竟是什么？</span>
        <h2>以官方定义为准：它是低层编排框架，也是长时、具状态 Agent 的运行时</h2>
        <p>这不是把个人类比包装成定义。官方把 LangGraph 描述为用于构建、管理与部署长时、具状态 Agent 的 <strong>low-level orchestration framework and runtime</strong>，并强调它专注于 agent orchestration。</p>
        <div className="official-definition-grid">
          <article><span>01 · StateGraph</span><h3>图定义的 Builder</h3><p>先声明 State schema，再添加 Nodes 与 Edges。它描述控制流，还不是 HTTP 服务。</p></article>
          <article><span>02 · compile()</span><h3>结构检查 + 运行能力装配</h3><p>官方说明 compile 会做基本结构检查，并在这里配置 checkpointer、interrupt 等运行参数。</p></article>
          <article><span>03 · Compiled graph</span><h3>可 invoke / stream 的编排对象</h3><p>编译后才能使用。更准确的叫法是可执行的 compiled graph / Runnable，而不是“整个应用程序”。</p></article>
        </div>
        <div className="ownership-grid">
          <article><span>业务应用</span><h3>接请求，定义“什么算完成”</h3><p>HTTP、鉴权、天气规则、节点业务代码、验收标准、fallback 和响应字段都由你负责。</p></article>
          <article><span>LangGraph</span><h3>管理状态怎样沿图演化</h3><p>按 Edge 激活 Node、合并局部更新、执行 super-step，并提供 durable execution、streaming、HITL 与 persistence。</p></article>
          <article><span>外部基础设施</span><h3>提供真实能力</h3><p>天气 / 地图 API、LLM Provider、数据库、队列和观测系统不由 LangGraph 自动实现。</p></article>
        </div>
        <div className="source-row"><a href="https://docs.langchain.com/oss/python/langgraph/overview" target="_blank" rel="noreferrer">官方 Overview：framework 与 runtime 定位 ↗</a><a href="https://docs.langchain.com/oss/python/langgraph/graph-api" target="_blank" rel="noreferrer">官方 Graph API：compile 与执行模型 ↗</a></div>
      </section>

      <section className="opening-section concept-bridge">
        <span className="section-kicker">PART 05 · 现在才给刚才看到的东西命名</span>
        <h2>先只记三个角色：Node 做工作，Edge 决定下一步，State 保存当前共享快照</h2>
        <p>这三个名称不是孤立词汇，它们分别对应刚才图里的实体。Reducer、checkpointer、runtime context 等相邻概念，等遇到“并行怎样合并”“暂停怎样恢复”时再展开。</p>
        <div className="concept-triad">
          <button type="button" onClick={() => onNavigate("concepts")}><i className="concept-node-shape" /><span>NODE</span><h3>可被调度的函数</h3><p>读取当前 State，执行计算或副作用，返回局部更新。</p><b>深入 Node 边界 →</b></button>
          <button type="button" onClick={() => onNavigate("concepts")}><i className="concept-edge-shape" /><span>EDGE</span><h3>控制流与停止路径</h3><p>固定 Edge 表达顺序；Conditional Edge 根据 State 返回一个或多个目标。</p><b>深入 Edge 类型 →</b></button>
          <button type="button" onClick={() => onNavigate("dataflow")}><i className="concept-state-shape" /><span>STATE</span><h3>当前应用快照</h3><p>节点提交的是按 key 的更新；默认覆盖，也可以由 reducer 定义合并方式。</p><b>深入 State 与 Reducer →</b></button>
        </div>
        <div className="concept-handoff"><strong>为什么概念页放在这里之后？</strong><span>因为你已经亲眼看到 State 被谁读取、Node 为什么分开、Edge 为什么需要条件和回边。下一章再讨论严格定义，就不再是背术语。</span><button type="button" onClick={() => onNavigate("concepts")}>进入“图的骨架与边界” →</button></div>
      </section>

      <section className="route-map">
        <div className="section-kicker">接下来的教材路线 · 从这条请求逐层下钻</div>
        <h2>现在有了全貌，再去拆请求、控制流、概念与代码</h2>
        <div className="route-steps">
          {SECTIONS.slice(1).map((item, index) => (
            <button type="button" className="route-step" onClick={() => onNavigate(item.key)} key={item.key}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.label}</strong><small>{item.duration}</small><b>打开章节 →</b></button>
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
    ["04", "START", "初始 input 成为 State，激活 validate_input", "checkpoint #0"],
    ["05", "validate_input", "读取业务字段；完整则继续，缺失则进入 ask_user", "+ normalized input / errors"],
    ["06", "check_weather", "读取坐标，调用 Open-Meteo，返回局部更新", "+ weather"],
    ["07", "conditional edge", "按天气、距离与偏好选择下一节点", "branch"],
    ["08", "plan_*", "生成候选路线、理由与 fallback", "+ route_plan"],
    ["09", "validate_plan", "通过 → respond；失败 → 重试 / fallback", "accepted?"],
    ["10", "END", "没有待执行节点，形成 final State", "checkpoint #N"],
    ["11", "Router", "挑选公开字段，序列化响应", "HTTP JSON"],
  ];
  const payloads = [
    { owner: "Browser", input: "form state", output: "POST body bytes", data: { origin: "上海公司", destination: "浦东机场", preference: "less_walking" } },
    { owner: "HTTP router", input: "Request", output: "TripInput", data: { authenticated: true, schemaValid: true, requestId: "trip-42" } },
    { owner: "Application service", input: "TripInput", output: "graph.ainvoke(input, config)", data: { threadId: "trip-42", streamMode: "updates" } },
    { owner: "LangGraph runtime", input: "initial State", output: "active: validate_input", data: { next: ["validate_input"], checkpoint: 0 } },
    { owner: "validate_input node", input: "origin / destination / location", output: "Partial<State>", data: { errors: [], normalized: true, next: "check_weather" } },
    { owner: "check_weather node", input: "latitude / longitude", output: "Partial<State>", data: { temperature: 22.8, weatherCode: 61 } },
    { owner: "routing function", input: "current State", output: "node name", data: { target: "plan_transit", reason: "weatherCode >= 51" } },
    { owner: "plan_transit node", input: "weather + preference", output: "Partial<State>", data: { mode: "地铁优先", routePlan: "公司 → 2号线 → 机场" } },
    { owner: "validate_plan node", input: "candidate + contract", output: "accepted / retry", data: { accepted: true, errors: [], attempts: 1 } },
    { owner: "LangGraph runtime", input: "no messages in transit", output: "final State", data: { next: [], status: "accepted", checkpoint: 6 } },
    { owner: "Response mapper", input: "final State", output: "HTTP JSON", data: { requestId: "trip-42", status: 200 } },
  ];
  const [selectedStep, setSelectedStep] = useState(0);
  const selected = payloads[selectedStep];
  return <>
    <div className="story-bridge"><span>CASE · STEP 01</span><strong>前端准备发送“公司到机场”的请求</strong><p>现在场景已经明确，我们再看技术链路。前端不是把数据直接塞进 START，而是先向服务端发送 <code>POST /api/trips/plan</code>；路由层解析、鉴权和校验后，才调用 graph。</p></div>
    <div className="sequence-board">
      <div className="sequence-head"><span>REQUEST LIFECYCLE</span><span>一次请求像“地址栏输入网址”一样逐层展开</span></div>
      {steps.map((step, index) => <button type="button" className={`sequence-row ${selectedStep === index ? "active" : ""}`} onClick={() => setSelectedStep(index)} aria-pressed={selectedStep === index} key={step[0]}><span>{step[0]}</span><strong>{step[1]}</strong><b>{step[2]}</b><code>{step[3]}</code></button>)}
    </div>
    <div className="request-inspector" aria-live="polite"><div><span>OWNER</span><strong>{selected.owner}</strong></div><div><span>INPUT → OUTPUT</span><code>{selected.input} → {selected.output}</code></div><div><span>PAYLOAD / STATE</span><pre>{JSON.stringify(selected.data, null, 2)}</pre></div></div>
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
  const [structure, setStructure] = useState<"sequence" | "branch" | "loop">("sequence");
  const structureDetail = {
    sequence: { title: "顺序结构", path: "START → check_weather → plan_route → END", rule: "每个节点只有一个固定后继；适合步骤始终不变的工作流。" },
    branch: { title: "条件结构", path: "route_weather → plan_transit / plan_outdoor / ask_user", rule: "路由函数读取当前 State 并返回目标节点；硬规则优先确定性代码。" },
    loop: { title: "循环结构", path: "validate_plan → failed ↺ check_weather / accepted → END", rule: "回边是普通有向边；必须同时设计业务出口与 recursion limit 保险丝。" },
  }[structure];
  return <>
    <div className="story-bridge"><span>CASE · STEP 02</span><strong>天气数据回来了：29.4°C，weatherCode = 61</strong><p>下一步不再固定：下雨走地铁，天气好才考虑步行；距离过远或风险较高还可能进入人工/补充信息分支。这就是控制结构出现的原因。</p></div>
    <div className="control-overview">
      <button type="button" className={structure === "sequence" ? "active" : ""} onClick={() => setStructure("sequence")}><span>SEQUENCE</span><h3>顺序</h3><code>A → B → C</code><p>下一步在编译时已知，用固定 edge。</p><b>选择 →</b></button>
      <button type="button" className={structure === "branch" ? "active" : ""} onClick={() => setStructure("branch")}><span>BRANCH</span><h3>条件</h3><code>A → if(state) → B/C</code><p>下一步由当前 State 决定，用 conditional edge。</p><b>选择 →</b></button>
      <button type="button" className={structure === "loop" ? "active" : ""} onClick={() => setStructure("loop")}><span>LOOP</span><h3>循环</h3><code>A → evaluate → A/END</code><p>条件边可以指回旧节点，但必须有退出条件。</p><b>选择 →</b></button>
    </div>
    <div className="control-detail" aria-live="polite"><div><span>ACTIVE STRUCTURE</span><h2>{structureDetail.title}</h2><p>{structureDetail.rule}</p></div><code>{structureDetail.path}</code><button type="button" onClick={() => { window.location.hash = "#/playground/weather"; }}>在 Playground 运行 →</button></div>
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
      <div className="state-node-answer">
        <div>
          <span className="section-kicker">为什么 State 不放进某一个 Node 里？</span>
          <h3>因为跨节点继续存在的事实，需要成为整张图可见的契约</h3>
          <p>Node 内部可以有局部变量；但天气结果如果只藏在 <code>check_weather</code> 的闭包里，条件边、规划节点和 checkpointer 都读不到它。进入 State 的应该是后续步骤、恢复或审计仍需要的事实。</p>
        </div>
        <div className="correction-card">
          <strong>State 不是“不可逆对象”</strong>
          <p>后续 Node 可以覆盖某个 key，Reducer 也可以合并多个更新；有环时旧 Node 还会再次运行。不会被原地篡改的是已经保存的历史 checkpoint。把这三件事区分开，才能理解 update、replay 与 loop。</p>
        </div>
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
  type ApiScenario = "rest" | "stream" | "approval";
  const [scenario, setScenario] = useState<ApiScenario>("rest");
  const [selectedApi, setSelectedApi] = useState("StateGraph");
  const scenarioApis: Record<ApiScenario, string[]> = {
    rest: ["StateGraph", "add_node / addNode", "add_edge / addEdge", "add_conditional_edges", "Command", "Checkpointer"],
    stream: ["StateGraph", "stream / astream", "Send", "ToolNode", "Checkpointer", "Store"],
    approval: ["interrupt", "Command", "Checkpointer", "Store", "Subgraph"],
  };
  const visibleRows = API_ROWS.filter((row) => scenarioApis[scenario].includes(row[0]));
  const selectedRow = API_ROWS.find((row) => row[0] === selectedApi) ?? API_ROWS[0];
  return (
    <>
      <div className="api-scenarios">
        <button type="button" className={scenario === "rest" ? "active" : ""} onClick={() => { setScenario("rest"); setSelectedApi("StateGraph"); }}><span>REST 请求</span><h3>我要最终结果</h3><code>await graph.invoke(input, config)</code><p>路由等待图走到 END，再返回 JSON。</p><b>筛选 API →</b></button>
        <button type="button" className={scenario === "stream" ? "active" : ""} onClick={() => { setScenario("stream"); setSelectedApi("stream / astream"); }}><span>聊天 / 进度 UI</span><h3>我要逐步事件</h3><code>for await (event of graph.stream(...))</code><p><code>updates</code> 看 State diff；<code>messages</code> 看模型流。</p><b>筛选 API →</b></button>
        <button type="button" className={scenario === "approval" ? "active" : ""} onClick={() => { setScenario("approval"); setSelectedApi("interrupt"); }}><span>人工审批</span><h3>我要暂停后恢复</h3><code>interrupt + thread_id + Command(resume)</code><p>编译时必须配置 checkpointer。</p><b>筛选 API →</b></button>
      </div>
      <div className="table-wrap">
        <table className="api-table"><thead><tr><th>API</th><th>它负责什么</th><th>何时使用</th><th>最容易混淆</th></tr></thead>
          <tbody>{visibleRows.map((row) => <tr className={selectedApi === row[0] ? "active" : ""} key={row[0]}>{row.map((cell, index) => <td key={cell}>{index === 0 ? <button type="button" onClick={() => setSelectedApi(row[0])}><code>{cell}</code></button> : cell}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <div className="api-detail" aria-live="polite"><span>SELECTED API</span><h2>{selectedRow[0]}</h2><div><p><strong>职责：</strong>{selectedRow[1]}</p><p><strong>场景：</strong>{selectedRow[2]}</p><p><strong>易错点：</strong>{selectedRow[3]}</p></div></div>
      <div className="api-choice">
        <button type="button" className={selectedApi === "add_conditional_edges" ? "active" : ""} onClick={() => { setScenario("rest"); setSelectedApi("add_conditional_edges"); }}><strong>Conditional Edge</strong><span>只决定“下一步去哪”</span></button>
        <div className="versus">VS</div>
        <button type="button" className={selectedApi === "Command" ? "active" : ""} onClick={() => { setScenario("approval"); setSelectedApi("Command"); }}><strong>Command</strong><span>同时更新状态并改变流向</span></button>
        <div className="versus">VS</div>
        <button type="button" className={selectedApi === "Send" ? "active" : ""} onClick={() => { setScenario("stream"); setSelectedApi("Send"); }}><strong>Send</strong><span>按运行时数据创建并行任务</span></button>
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
  type RuntimeEvent = {
    node: string;
    edge?: string;
    title?: string;
    description?: string;
    diff?: Record<string, unknown>;
    state?: Record<string, unknown>;
  };
  type RuntimeResult = {
    events: RuntimeEvent[];
    finalState: Record<string, unknown>;
    response: Record<string, unknown>;
  };
  type RunnerMessage = {
    id: number;
    ok: boolean;
    result?: unknown;
    error?: string;
    logs?: string[];
  };

  const defaults: TripSimulationInput = {
    origin: "上海公司",
    destination: "浦东机场",
    hasLocation: true,
    weather: "rain",
    distanceKm: 36,
    preference: "less_walking",
    validationFailures: 0,
    maxAttempts: 3,
  };
  const initial = simulateTrip(defaults);
  const [input, setInput] = useState<TripSimulationInput>(defaults);
  const [codes, setCodes] = useState<Record<Language, string>>({ ...PLAYGROUND_PROGRAMS });
  const [result, setResult] = useState<RuntimeResult>({
    events: initial.events,
    finalState: initial.finalState as unknown as Record<string, unknown>,
    response: initial.response,
  });
  const [activeStep, setActiveStep] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "running" | "done" | "error" | "stopped">("idle");
  const [error, setError] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const workerRef = useRef<Worker | null>(null);
  const timers = useRef<number[]>([]);
  const timeoutRef = useRef<number | null>(null);

  const clearAnimation = () => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  };

  const stop = (nextStatus: "stopped" | "idle" = "stopped") => {
    clearAnimation();
    workerRef.current?.terminate();
    workerRef.current = null;
    setStatus(nextStatus);
  };

  const normalizeResult = (value: unknown): RuntimeResult => {
    if (!value || typeof value !== "object") throw new Error("runGraph / run_graph 必须返回对象。");
    const candidate = value as { events?: unknown; finalState?: unknown; response?: unknown };
    if (!Array.isArray(candidate.events)) throw new Error("返回值必须包含 events 数组。");
    const events = candidate.events.map((item, index) => {
      if (!item || typeof item !== "object" || typeof (item as { node?: unknown }).node !== "string") {
        throw new Error(`events[${index}] 缺少字符串 node。`);
      }
      return item as RuntimeEvent;
    });
    if (!events.length) throw new Error("events 不能为空。");
    return {
      events,
      finalState: candidate.finalState && typeof candidate.finalState === "object" ? candidate.finalState as Record<string, unknown> : {},
      response: candidate.response && typeof candidate.response === "object" ? candidate.response as Record<string, unknown> : {},
    };
  };

  const animate = (next: RuntimeResult) => {
    setActiveStep(0);
    setStatus(next.events.length === 1 ? "done" : "running");
    next.events.slice(1).forEach((_, index) => {
      timers.current.push(window.setTimeout(() => {
        const step = index + 1;
        setActiveStep(step);
        if (step === next.events.length - 1) setStatus("done");
      }, (index + 1) * 360));
    });
  };

  const run = () => {
    stop("idle");
    setError("");
    setLogs([]);
    setStatus("loading");

    const worker = language === "python"
      ? new Worker(new URL("./workers/py-runner.ts", import.meta.url), { type: "module" })
      : new Worker(new URL("./workers/ts-runner.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    const id = Date.now();

    worker.onmessage = (event: MessageEvent<RunnerMessage>) => {
      if (event.data.id !== id) return;
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      worker.terminate();
      workerRef.current = null;
      setLogs(event.data.logs ?? []);
      if (!event.data.ok) {
        setError(event.data.error ?? "未知运行错误");
        setStatus("error");
        return;
      }
      try {
        const next = normalizeResult(event.data.result);
        setResult(next);
        animate(next);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
        setStatus("error");
      }
    };
    worker.onerror = (event) => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      worker.terminate();
      workerRef.current = null;
      setError(event.message || "运行时无法启动");
      setStatus("error");
    };
    worker.postMessage({ id, code: codes[language], input });
    timeoutRef.current = window.setTimeout(() => {
      worker.terminate();
      workerRef.current = null;
      setError(language === "python" ? "Python Runtime 加载或执行超过 45 秒。" : "TypeScript 执行超过 8 秒，可能存在无限循环。");
      setStatus("error");
    }, language === "python" ? 45_000 : 8_000);
  };

  const reset = () => {
    stop("idle");
    const resetResult = simulateTrip(defaults);
    setInput(defaults);
    setCodes({ ...PLAYGROUND_PROGRAMS });
    setResult({
      events: resetResult.events,
      finalState: resetResult.finalState as unknown as Record<string, unknown>,
      response: resetResult.response,
    });
    setActiveStep(0);
    setError("");
    setLogs([]);
  };

  useEffect(() => () => {
    timers.current.forEach(window.clearTimeout);
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    workerRef.current?.terminate();
  }, []);

  const event = result.events[Math.min(activeStep, result.events.length - 1)];
  const running = status === "loading" || status === "running";
  const updateInput = <K extends keyof TripSimulationInput>(key: K, value: TripSimulationInput[K]) => {
    setInput((current) => ({ ...current, [key]: value }));
  };

  return (
    <>
      <div className="playground-note"><strong>这里会真实编译和执行</strong><span>TypeScript 在隔离 Worker 中编译；Python 使用官方 Pyodide WebAssembly Runtime。修改代码或场景输入会改变轨迹、State 和输出。浏览器版使用自包含 ToyGraph，正式 LangGraph 包示例仍在 GitHub 项目中本地运行。</span></div>
      <form className="trip-form" onSubmit={(submitEvent) => { submitEvent.preventDefault(); run(); }} aria-busy={running}>
        <label><span>起点</span><input value={input.origin} onChange={(change) => updateInput("origin", change.target.value)} /></label>
        <label><span>终点</span><input value={input.destination} onChange={(change) => updateInput("destination", change.target.value)} /></label>
        <label><span>天气 fixture</span><select value={input.weather} onChange={(change) => updateInput("weather", change.target.value as WeatherScenario)}><option value="clear">晴天</option><option value="rain">下雨</option><option value="storm">雷暴</option><option value="unavailable">天气服务不可用</option></select></label>
        <label><span>距离（km）</span><input type="number" min="0.1" max="200" step="0.1" value={input.distanceKm} onChange={(change) => updateInput("distanceKm", Number(change.target.value))} /></label>
        <label><span>出行偏好</span><select value={input.preference} onChange={(change) => updateInput("preference", change.target.value as TripPreference)}><option value="fastest">最快</option><option value="less_walking">少步行</option><option value="low_cost">低成本</option></select></label>
        <label><span>先失败几次</span><select value={input.validationFailures} onChange={(change) => updateInput("validationFailures", Number(change.target.value))}><option value="0">首次通过</option><option value="1">失败 1 次后通过</option><option value="2">失败 2 次后通过</option><option value="3">直到 fallback</option></select></label>
        <label className="checkbox-field"><input type="checkbox" checked={input.hasLocation} onChange={(change) => updateInput("hasLocation", change.target.checked)} /><span>已提供位置</span></label>
        <button className="form-run" type="submit" disabled={running}>{status === "loading" ? language === "python" ? "加载 Python Runtime…" : "编译中…" : status === "running" ? "执行中…" : "编译并运行"}</button>
      </form>

      <div className="playground-shell functional">
        <div className="editor-pane">
          <div className="editor-toolbar"><span>{language === "python" ? "weather_graph.py" : "weather_graph.ts"}</span><LanguageSwitch language={language} setLanguage={setLanguage} compact /></div>
          <textarea aria-label={`${language} 可执行 ToyGraph 代码`} value={codes[language]} onChange={(change) => setCodes((current) => ({ ...current, [language]: change.target.value }))} spellCheck={false} />
          <div className="editor-actions"><button type="button" className="secondary" onClick={reset}>Reset</button><button type="button" className="secondary" onClick={() => stop()} disabled={!running}>Stop</button><button type="button" className="run" onClick={run} disabled={running}>{running ? "Running…" : "Compile & Run"}</button></div>
        </div>
        <div className="trace-pane">
          <div className="trace-title"><span>REAL EXECUTION TRACE</span><span className={`status ${status}`} aria-live="polite">{status.toUpperCase()}</span></div>
          <div className="trace-list">
            {result.events.map((trace, index) => <button type="button" className={`${index < activeStep ? "done" : ""} ${index === activeStep ? "active" : ""}`} key={`${trace.node}-${index}`} onClick={() => { clearAnimation(); setActiveStep(index); setStatus("stopped"); }}><span>{String(index + 1).padStart(2, "0")}</span><strong>{trace.node}</strong><small>{trace.edge ?? trace.description ?? "state update"}</small></button>)}
          </div>
          <div className="step-controls"><button type="button" onClick={() => { clearAnimation(); setActiveStep((current) => Math.max(0, current - 1)); setStatus("stopped"); }} disabled={activeStep === 0}>← 上一步</button><span>{activeStep + 1} / {result.events.length}</span><button type="button" onClick={() => { clearAnimation(); setActiveStep((current) => Math.min(result.events.length - 1, current + 1)); setStatus("stopped"); }} disabled={activeStep >= result.events.length - 1}>下一步 →</button></div>
        </div>
      </div>

      {error && <div className="runtime-error" role="alert"><strong>编译 / 运行失败</strong><pre>{error}</pre></div>}
      <div className="runtime-inspector">
        <div><span>ACTIVE NODE</span><strong>{event?.node ?? "—"}</strong><p>{event?.title ?? event?.description ?? event?.edge ?? "选择一个执行步骤查看详情"}</p></div>
        <div><span>STATE DIFF</span><pre>{JSON.stringify(event?.diff ?? {}, null, 2)}</pre></div>
        <div><span>STATE AFTER STEP</span><pre>{JSON.stringify(event?.state ?? result.finalState, null, 2)}</pre></div>
        <div><span>FINAL RESPONSE</span><pre>{JSON.stringify(result.response, null, 2)}</pre></div>
      </div>
      <div className="runtime-console"><span>STDOUT / STDERR</span><pre>{logs.length ? logs.join("\n") : "程序没有写入 console / stdout。"}</pre></div>
    </>
  );
}

function Patterns({ language, setLanguage }: { language: Language; setLanguage: (l: Language) => void }) {
  const [selectedPattern, setSelectedPattern] = useState(0);
  const selected = PATTERNS[selectedPattern];
  return (
    <>
      <div className="pattern-grid">
        {PATTERNS.map((row, index) => <button type="button" className={selectedPattern === index ? "active" : ""} onClick={() => setSelectedPattern(index)} aria-pressed={selectedPattern === index} key={row[0]}><span>{String(index + 1).padStart(2, "0")}</span><h3>{row[0]}</h3><p>{row[1]}</p><strong>{row[2]}</strong><small>反模式：{row[3]}</small><b>展开模式 →</b></button>)}
      </div>
      <div className="pattern-detail" aria-live="polite"><div><span>SELECTED PATTERN</span><h2>{selected[0]}</h2><p><strong>适用条件：</strong>{selected[1]}</p><p><strong>运行结构：</strong>{selected[2]}</p><p><strong>必须防止：</strong>{selected[3]}</p></div><button type="button" onClick={() => { window.location.hash = "#/playground/weather"; }}>在 Playground 验证控制流 →</button></div>
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
  const [selectedExercise, setSelectedExercise] = useState(0);
  const [completed, setCompleted] = useState<string[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const parsed = JSON.parse(window.localStorage.getItem("langgraph-completed-exercises") ?? "[]");
        if (Array.isArray(parsed)) setCompleted(parsed.filter((item): item is string => typeof item === "string"));
      } catch {
        setCompleted([]);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const toggleExercise = (id: string) => {
    setCompleted((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      window.localStorage.setItem("langgraph-completed-exercises", JSON.stringify(next));
      return next;
    });
  };
  const selected = exercises[selectedExercise];
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
      <div className="exercise-list">{exercises.map((item, index) => <button type="button" className={selectedExercise === index ? "active" : ""} key={item[0]} onClick={() => setSelectedExercise(index)}><span>{completed.includes(item[0]) ? "✓" : item[0]}</span><strong>{item[1]}</strong><small>{item[2]}</small><b>打开练习 →</b></button>)}</div>
      <div className="exercise-workbench" aria-live="polite"><div><span>EXERCISE {selected[0]}</span><h2>{selected[1]}</h2><p>{selected[2]}。先在 Playground 改变输入并预测路径，再运行、逐步检查 State diff，最后到仓库中完成双语言实现。</p></div><div className="exercise-actions"><button type="button" onClick={() => { window.location.hash = "#/playground/weather"; }}>打开 Playground</button><a href={`https://github.com/Dante-dan/langgraph-learning-lab/tree/main/exercises`} target="_blank" rel="noreferrer">打开仓库练习 ↗</a><button type="button" className={completed.includes(selected[0]) ? "complete" : ""} onClick={() => toggleExercise(selected[0])}>{completed.includes(selected[0]) ? "已完成 · 点击撤销" : "标记为完成"}</button></div></div>
      <div className="next-actions"><h2>推荐练习节奏</h2><ol><li>先预测每次 State diff。</li><li>再运行示例并比较轨迹。</li><li>故意删掉 reducer 或 thread_id，观察失败模式。</li><li>最后用自己的业务问题替换示例。</li></ol></div>
    </>
  );
}

function LessonContent({ active, language, setLanguage, onNavigate }: { active: SectionKey; language: Language; setLanguage: (l: Language) => void; onNavigate: (section: SectionKey) => void }) {
  switch (active) {
    case "roadmap": return <Roadmap onNavigate={onNavigate} />;
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

function sectionHref(section: SectionKey): string {
  if (section === "playground") return "#/playground/weather";
  if (section === "project") return "#/project/exercises";
  return `#/lesson/${section}`;
}

function parseSectionHash(hash: string): SectionKey | null {
  const raw = hash.replace(/^#/, "").split("?")[0].replace(/^\//, "");
  if (!raw) return "roadmap";
  const parts = raw.split("/").filter(Boolean);
  let candidate = parts[0];
  if (candidate === "lesson") candidate = parts[1] ?? "";
  if (candidate === "playground") candidate = "playground";
  if (candidate === "project") candidate = "project";
  return SECTIONS.some((section) => section.key === candidate) ? candidate as SectionKey : null;
}

export default function Home() {
  const [language, setLanguageState] = useState<Language>("python");
  const [active, setActive] = useState<SectionKey>("roadmap");
  const [mobileNav, setMobileNav] = useState(false);
  const [routeMissing, setRouteMissing] = useState(false);
  const [visited, setVisited] = useState<SectionKey[]>([]);

  useEffect(() => {
    const syncRoute = () => {
      const next = parseSectionHash(window.location.hash);
      if (!next) {
        setRouteMissing(true);
        setMobileNav(false);
        window.requestAnimationFrame(() => document.querySelector<HTMLElement>(".not-found h1")?.focus());
        return;
      }
      setRouteMissing(false);
      setActive(next);
      setMobileNav(false);
      const storedVisited = (() => {
        try {
          const parsed = JSON.parse(window.localStorage.getItem("langgraph-visited") ?? "[]");
          return Array.isArray(parsed) ? parsed.filter((item): item is SectionKey => SECTIONS.some((section) => section.key === item)) : [];
        } catch {
          return [];
        }
      })();
      const nextVisited = Array.from(new Set([...storedVisited, next]));
      setVisited(nextVisited);
      window.localStorage.setItem("langgraph-visited", JSON.stringify(nextVisited));
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "auto" });
        document.querySelector<HTMLElement>(".lesson-head h1")?.focus();
      });
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNav(false);
    };
    const timer = window.setTimeout(() => {
      const stored = window.localStorage.getItem("langgraph-language");
      if (stored === "python" || stored === "typescript") setLanguageState(stored);
      if (!window.location.hash) window.history.replaceState(null, "", sectionHref("roadmap"));
      syncRoute();
    }, 0);
    window.addEventListener("hashchange", syncRoute);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("hashchange", syncRoute);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  useEffect(() => {
    document.title = routeMissing ? "页面未找到 · LangGraph 学习实验室" : `${SECTIONS.find((item) => item.key === active)?.label ?? "课程"} · LangGraph 学习实验室`;
  }, [active, routeMissing]);

  const setLanguage = (next: Language) => {
    setLanguageState(next);
    window.localStorage.setItem("langgraph-language", next);
  };

  const chooseSection = (next: SectionKey) => {
    const href = sectionHref(next);
    if (window.location.hash === href.slice(1) || window.location.hash === href) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      document.querySelector<HTMLElement>(".lesson-head h1")?.focus();
      return;
    }
    window.location.hash = href.slice(1);
  };

  const section = useMemo(() => SECTIONS.find((item) => item.key === active)!, [active]);
  const progress = Math.round((visited.length / SECTIONS.length) * 100);
  const grouped = useMemo(() => Array.from(new Set(SECTIONS.map((item) => item.group))), []);
  const currentIndex = SECTIONS.findIndex((item) => item.key === active);
  const previous = currentIndex > 0 ? SECTIONS[currentIndex - 1] : null;
  const next = currentIndex < SECTIONS.length - 1 ? SECTIONS[currentIndex + 1] : null;

  return (
    <div className="site-shell">
      <header className="topbar">
        <button className="mobile-menu" type="button" onClick={() => setMobileNav(!mobileNav)} aria-expanded={mobileNav} aria-controls="course-navigation" aria-label="打开课程导航">☰</button>
        <a className="brand" href={sectionHref("roadmap")}><span className="brand-mark" aria-hidden="true" /><span>LangGraph 学习实验室</span></a>
        <div className="crumbs"><a href={sectionHref("roadmap")}>COURSE</a> / <strong>{routeMissing ? "404" : section.label}</strong></div>
        <LanguageSwitch language={language} setLanguage={setLanguage} />
      </header>
      <div className="shell">
        {mobileNav && <button className="nav-backdrop" type="button" onClick={() => setMobileNav(false)} aria-label="关闭课程导航" />}
        <aside id="course-navigation" className={`sidebar ${mobileNav ? "open" : ""}`} aria-label="课程章节">
          <div className="side-label section-kicker">LEARNING MAP · V1.0</div>
          {grouped.map((group) => <div className="module" key={group}>
            <div className="module-title">{group}</div>
            {SECTIONS.filter((item) => item.group === group).map((item) => (
              <a key={item.key} href={sectionHref(item.key)} className={`nav-item ${!routeMissing && active === item.key ? "active" : ""}`} aria-current={!routeMissing && active === item.key ? "page" : undefined} onClick={() => setMobileNav(false)}>
                <span className="nav-num">{item.num}</span><span>{item.label}</span><span className={`nav-state ${visited.includes(item.key) ? "done" : ""}`} />
              </a>
            ))}
          </div>)}
        </aside>
        <main id="main-content" className="main">
          {routeMissing ? (
            <section className="not-found"><span className="lesson-index">404 · UNKNOWN ROUTE</span><h1 tabIndex={-1}>这个 Hash 没有对应的课程页面</h1><p>地址可能拼错了，或者章节已经移动。返回学习地图后，所有章节都会通过可复制、可前进后退的 Hash 地址打开。</p><a href={sectionHref("roadmap")}>返回课程首页 →</a></section>
          ) : (
            <>
              <SectionHeader section={section} />
              <div className="lesson-body"><LessonContent active={active} language={language} setLanguage={setLanguage} onNavigate={chooseSection} /></div>
              <nav className="lesson-pagination" aria-label="章节翻页">
                {previous ? <a href={sectionHref(previous.key)}><span>← 上一节</span><strong>{previous.label}</strong></a> : <span />}
                {next ? <a href={sectionHref(next.key)}><span>下一节 →</span><strong>{next.label}</strong></a> : <a href={sectionHref("roadmap")}><span>回到开头 ↺</span><strong>天气 Agent 完整旅程</strong></a>}
              </nav>
              <footer className="lesson-footer">
                <span>资料按官方文档整理 · 最后校对 2026-07</span>
                <a href="https://docs.langchain.com/oss/python/langgraph/overview" target="_blank" rel="noreferrer">官方文档 ↗</a>
              </footer>
            </>
          )}
        </main>
        <aside className="context" aria-label="学习进度">
          <div className="context-head"><span className="section-kicker">VISITED PROGRESS</span><strong>{progress}%</strong></div>
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
          {next ? <a className="continue" href={sectionHref(next.key)}>下一节 →</a> : <a className="continue" href={sectionHref("roadmap")}>回到课程首页 ↺</a>}
        </aside>
      </div>
    </div>
  );
}
