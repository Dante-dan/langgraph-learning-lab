# LangGraph 学习实验室

一个面向资深 Python / TypeScript 开发者的 LangGraph 学习项目。课程先展示完整系统和一次请求的旅程，再拆解控制流、核心构件、序列化、Agent 循环与生产架构。

## 学习路线

1. 阅读 `docs/request-lifecycle.md`，先看用户输入如何进入图并返回。
2. 阅读 `docs/control-flow.md`，理解顺序、条件、循环和工具 Agent。
3. 运行 `python/02_weather_route.py` 或 `npm run weather --prefix typescript`。
4. 阅读 `docs/core-concepts.md`，严格区分 State / Node / Edge / Reducer。
5. 用 `docs/langgraph-official-model.md` 核对 StateGraph、compile、super-step、HITL 与循环边界。
6. 用 `docs/claude-code-agent-loop.md` 对照完整工具 Agent 的输入、循环、验证与 memory。
7. 完成 `exercises/README.md`，最后用 `architecture/patterns.md` 做生产评审。

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
