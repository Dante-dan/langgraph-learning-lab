"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Language = "python" | "typescript";
type SectionKey =
  | "roadmap"
  | "quickstart"
  | "concepts"
  | "dataflow"
  | "api"
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
  { key: "roadmap", num: "01", label: "学习路线", group: "怎么开始", duration: "5 MIN" },
  { key: "quickstart", num: "02", label: "创建第一个项目", group: "怎么开始", duration: "12 MIN" },
  { key: "concepts", num: "03", label: "StateGraph 与状态", group: "核心概念", duration: "18 MIN" },
  { key: "dataflow", num: "04", label: "数据流与序列化", group: "深入工作流", duration: "16 MIN" },
  { key: "api", num: "05", label: "常用 API 图鉴", group: "深入工作流", duration: "14 MIN" },
  { key: "playground", num: "06", label: "执行 Playground", group: "动手练习", duration: "20 MIN" },
  { key: "patterns", num: "07", label: "业界架构模式", group: "系统设计", duration: "22 MIN" },
  { key: "project", num: "08", label: "GitHub 实战项目", group: "系统设计", duration: "25 MIN" },
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
  return (
    <header className="lesson-head">
      <div>
        <div className="lesson-index">LESSON {section.num}</div>
        <h1>{section.key === "roadmap" ? "先看地图，再写第一个节点" : section.label}</h1>
        <p className="subtitle">
          {section.key === "roadmap"
            ? "用一张可执行的知识地图，理解 LangGraph 如何把状态、节点与边组合成可追踪、可恢复、可持续演进的 Agent 系统。"
            : "先抓住工作机制，再用双语言代码、执行轨迹和练习把概念真正跑通。"}
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
          <h2>LangGraph 的一句话心智模型</h2>
          <p><code>State</code> 是共享事实，<code>Node</code> 读取并产生局部更新，<code>Edge</code> 决定下一步，<code>Reducer</code> 解决并发更新如何合并。</p>
          <p>它不是“另一个聊天 SDK”，而是低层 Agent 编排运行时：当任务需要循环、持久化、流式输出、人工介入或长时间运行时，图结构才真正开始产生价值。</p>
          <div className="formula">
            <Principle title="STATE">共享的数据契约</Principle>
            <Principle title="NODES">可测试的计算单元</Principle>
            <Principle title="EDGES">明确的流转规则</Principle>
          </div>
        </div>
        <BlueprintGraph active={2} />
      </section>
      <section className="route-map">
        <div className="section-kicker">90 MIN · LEARNING ROUTE</div>
        <h2>从可运行的最小图，走到可靠的系统</h2>
        <div className="route-steps">
          {SECTIONS.slice(1).map((item, index) => (
            <div className="route-step" key={item.key}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.label}</strong><small>{item.duration}</small></div>
          ))}
        </div>
      </section>
      <div className="decision-callout"><strong>什么时候不要用 LangGraph？</strong><span>一次模型调用、固定两三步且没有恢复/循环需求时，普通函数或 LangChain Runnable 更简单。</span></div>
    </>
  );
}

function Quickstart({ language, setLanguage }: { language: Language; setLanguage: (l: Language) => void }) {
  return (
    <>
      <div className="install-grid">
        <div><span className="step-no">01</span><h3>初始化</h3><code>{language === "python" ? "uv add langgraph langchain-openai" : "npm i @langchain/langgraph @langchain/openai zod"}</code></div>
        <div><span className="step-no">02</span><h3>定义状态</h3><p>先写数据契约，再写节点。把变化频率不同的数据拆成独立字段。</p></div>
        <div><span className="step-no">03</span><h3>编译并调用</h3><p><code>compile()</code> 会检查图结构，并注入 checkpointer 等运行能力。</p></div>
      </div>
      <CodeBlock name="hello" language={language} setLanguage={setLanguage} label="最小可运行 StateGraph" />
      <div className="source-row">
        <a href="https://docs.langchain.com/oss/python/langgraph/overview" target="_blank" rel="noreferrer">Python 官方入门 ↗</a>
        <a href="https://docs.langchain.com/oss/javascript/langgraph/overview" target="_blank" rel="noreferrer">TypeScript 官方入门 ↗</a>
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
          <h2>Graph 是怎么形成的？</h2>
          <p>先定义 State schema，再把普通同步/异步函数注册为节点，最后用固定边或条件边表达流向。编译后得到一个可 <code>invoke</code>、<code>stream</code>、检查点恢复的 Runnable。</p>
          <p>底层以消息传递和离散 <em>super-step</em> 推进：同一轮被激活的节点可并行运行；当没有活跃节点且没有消息在途时，图停止。</p>
        </div>
        <BlueprintGraph active={1} />
      </section>
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

function Playground({ language, setLanguage }: { language: Language; setLanguage: (l: Language) => void }) {
  const defaults = snippets.hello;
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
    ["__start__", "接收输入 { topic: 'LangGraph' }"],
    ["analyze", "读取 topic，创建节点计划"],
    ["tool", "写入 result: 'official docs found'"],
    ["answer", "追加 AIMessage，生成最终回答"],
    ["__end__", "状态已提交，运行完成"],
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
          <div className="state-diff"><span>STATE DIFF</span><pre>{activeStep < 0 ? "等待运行…" : activeStep < 2 ? '+ topic: "LangGraph"' : activeStep < 4 ? '+ result: "official docs found"' : '+ answer: "Graph complete"'}</pre></div>
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
    </>
  );
}

function Project() {
  const exercises = [
    ["01", "Hello Graph", "状态、节点、边与 compile"],
    ["02", "Routing", "条件边、循环与递归上限"],
    ["03", "Parallel Research", "Send、Reducer 与并行 worker"],
    ["04", "Durable Agent", "Checkpoint、thread 与恢复"],
    ["05", "Human Review", "interrupt、Command 与审批"],
    ["06", "Production Blueprint", "流式输出、幂等性、可观测性"],
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
    case "quickstart": return <Quickstart language={language} setLanguage={setLanguage} />;
    case "concepts": return <Concepts language={language} setLanguage={setLanguage} />;
    case "dataflow": return <DataFlow language={language} setLanguage={setLanguage} />;
    case "api": return <ApiAtlas language={language} setLanguage={setLanguage} />;
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
            {active === "quickstart" && <><li>安装依赖</li><li>定义状态与节点</li><li>compile + invoke</li></>}
            {active === "concepts" && <><li>super-step</li><li>节点职责类型</li><li>Reducer 与并发</li></>}
            {active === "dataflow" && <><li>局部状态更新</li><li>JSON 边界</li><li>Checkpoint 恢复</li></>}
            {active === "api" && <><li>Command / Send</li><li>Store / Checkpointer</li><li>Interrupt / Stream</li></>}
            {active === "playground" && <><li>编辑双语言代码</li><li>逐节点执行</li><li>观察 State diff</li></>}
            {active === "patterns" && <><li>从确定性到 Agent</li><li>并行与循环</li><li>生产反模式</li></>}
            {active === "project" && <><li>6 个渐进练习</li><li>双语言对照</li><li>生产架构清单</li></>}
          </ul>
          <div className="context-title">学习原则</div>
          <blockquote>先预测状态变化，再运行；先画控制流，再选 API。</blockquote>
          <button className="continue" type="button" onClick={() => {
            const index = SECTIONS.findIndex((item) => item.key === active);
            if (index < SECTIONS.length - 1) chooseSection(SECTIONS[index + 1].key);
          }} disabled={active === "project"}>下一节 →</button>
        </aside>
      </div>
    </div>
  );
}
