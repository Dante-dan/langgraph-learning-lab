from typing_extensions import TypedDict
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


if __name__ == "__main__":
    print(graph.invoke({"topic": "LangGraph", "answer": ""}))

