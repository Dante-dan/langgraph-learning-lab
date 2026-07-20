import { StateGraph, StateSchema, START, END } from "@langchain/langgraph";
import * as z from "zod";

const State = new StateSchema({
  topic: z.string(),
  answer: z.string().default(""),
});

const draft: typeof State.Node = (state) => ({
  answer: `Learning: ${state.topic}`,
});

const graph = new StateGraph(State)
  .addNode("draft", draft)
  .addEdge(START, "draft")
  .addEdge("draft", END)
  .compile();

console.log(await graph.invoke({ topic: "LangGraph" }));

