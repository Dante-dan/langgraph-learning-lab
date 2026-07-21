import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the scenario-led weather-agent opening", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>LangGraph 学习实验室<\/title>/i);
  assert.match(html, /从一个天气出行 Agent 开始/);
  assert.match(html, /明早从公司去浦东机场/);
  assert.match(html, /POST \/api\/trips\/plan/);
  assert.match(html, /Agent 只有在下面四件事都成立时才算完成/);
  assert.match(html, /验证并决定是否循环/);
  assert.match(html, /条件变化时，节点与路径怎样一起变化/);
  assert.match(html, /HUMAN-IN-THE-LOOP/);
  assert.match(html, /Ask User|ask_user/);
  assert.match(html, /菱形只是条件边的可视化标记，不是 Node/);
  assert.match(html, /31\.2304/);
  assert.match(html, /拓扑图缩放控制/);
  assert.match(html, /适应宽度/);
  assert.match(html, /无停止条件的环/);
  assert.match(html, /INVALID RUN DESIGN/);
  assert.match(html, /低层编排框架，也是长时、具状态 Agent 的运行时/);
  assert.match(html, /先只记三个角色/);
  assert.match(html, /有向图，但不要求是 DAG/);
  assert.match(html, /href="#\/lesson\/requestflow"/);
  assert.match(html, /href="#\/playground\/weather"/);
  assert.match(html, /打开章节 →/);

  const scenario = html.indexOf("让我们先看懂一件事");
  const request = html.indexOf("POST /api/trips/plan");
  const topology = html.indexOf("条件变化时，节点与路径怎样一起变化");
  const officialPosition = html.indexOf("低层编排框架，也是长时、具状态 Agent 的运行时");
  const concepts = html.indexOf("先只记三个角色");
  assert.ok(scenario >= 0 && request > scenario && topology > request && officialPosition > topology && concepts > officialPosition);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site/);
});

test("keeps the core technical boundaries explicit in source and styles", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /WeatherTopology/);
  assert.match(page, /fitTopologyZoom/);
  assert.match(page, /new ResizeObserver\(applyFit\)/);
  assert.match(page, /Command\(resume=answer\)/);
  assert.match(page, /包含 interrupt 的.*节点会从函数开头重新执行/);
  assert.match(page, /State 不是“不可逆对象”/);
  assert.match(page, /ONE → MANY/);
  assert.match(page, /可以编译，但运行会在达到 recursion limit 时抛错/);
  assert.match(page, /业务出口与 recursion limit 保险丝/);
  assert.match(page, /官方 Graph API：compile 与执行模型/);
  assert.match(page, /window\.addEventListener\("hashchange", syncRoute\)/);
  assert.match(page, /new Worker\(new URL\("\.\/workers\/py-runner\.ts", import\.meta\.url\), \{ type: "module" \}\)/);
  assert.match(page, /Compile & Run/);
  assert.doesNotMatch(page, /播放预设执行轨迹/);

  assert.match(css, /\.opening-prologue/);
  assert.match(css, /\.journey-list/);
  assert.match(css, /\.weather-topology/);
  assert.match(css, /\.topology-view-toolbar/);
  assert.match(css, /\.topology-stage/);
  assert.match(css, /\.hitl-boundary/);
  assert.match(css, /\.loop-boundary/);
  assert.match(css, /\.topology-point\.decision/);
  assert.match(css, /\.topology-edge\.active/);
  assert.match(css, /\.orchestration-cards/);
  assert.match(css, /\.ownership-grid/);
  assert.match(css, /\.trip-form/);
  assert.match(css, /\.runtime-inspector/);
  assert.match(css, /\.lesson-pagination/);
  assert.match(css, /@media \(max-width: 620px\)/);
});
