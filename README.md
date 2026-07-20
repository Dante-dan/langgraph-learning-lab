# LangGraph 学习实验室

一个面向 Python / TypeScript 开发者的 LangGraph 学习项目：从最小 `StateGraph` 开始，逐步学习状态更新、Reducer、条件路由、并行任务、持久化、人工介入与生产架构。

## 学习路线

1. 运行 `python/01_hello_graph.py` 或 `typescript/01-hello-graph.ts`
2. 阅读 `docs/core-concepts.md`，先画清 State / Node / Edge
3. 完成 `exercises/README.md` 中的练习
4. 对照 `solutions/README.md` 检查设计选择
5. 用 `architecture/patterns.md` 评审自己的生产架构

## 仓库结构

```text
python/          Python 可运行示例
typescript/      TypeScript 可运行示例
docs/            核心概念、数据流与 API 笔记
exercises/       渐进式练习
solutions/       解题思路与检查点
architecture/    常见架构模式与生产清单
app/             互动学习网站
```

## 本地启动学习网站

```bash
npm install
npm run dev
```

> ChatGPT 订阅与 OpenAI API 分开计费。真实项目中的 `OPENAI_API_KEY` 只应保存在服务端环境变量中，不要写入前端代码或提交到仓库。

## 官方资料

- [LangGraph Python overview](https://docs.langchain.com/oss/python/langgraph/overview)
- [LangGraph TypeScript overview](https://docs.langchain.com/oss/javascript/langgraph/overview)
- [Graph API](https://docs.langchain.com/oss/python/langgraph/use-graph-api)
- [OpenAI：ChatGPT 与 API 分开计费](https://help.openai.com/en/articles/8156019-how-can-i-move-my-chatgpt-subscription-to-the-api)

