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
  assert.match(html, /LangGraph 是运行时；你编译出的 Graph 是可执行应用组件/);
  assert.match(html, /官方最小核心是 3 个；工程上用 8 个构件/);
  assert.match(html, /有向图，但不要求是 DAG/);

  const scenario = html.indexOf("让我们先看懂一件事");
  const request = html.indexOf("POST /api/trips/plan");
  const concepts = html.indexOf("官方最小核心是 3 个");
  assert.ok(scenario >= 0 && request > scenario && concepts > request);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site/);
});

test("keeps the core technical boundaries explicit in source and styles", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /State 不藏在 Node 里/);
  assert.match(page, /State 不可逆，所以只能单向流动/);
  assert.match(page, /过去的节点原地改写/);
  assert.match(page, /ONE → MANY/);
  assert.match(page, /业务终止条件负责正常退出/);
  assert.match(page, /Graph API：State \/ Nodes \/ Edges \/ super-steps/);

  assert.match(css, /\.opening-prologue/);
  assert.match(css, /\.journey-list/);
  assert.match(css, /\.validation-loop/);
  assert.match(css, /\.ownership-grid/);
  assert.match(css, /\.topology-grid/);
  assert.match(css, /@media \(max-width: 620px\)/);
});
