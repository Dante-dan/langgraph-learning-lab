"""顺序结构：输入 → 天气 API → 路线策略 → 最终 State。"""

import asyncio
from typing_extensions import TypedDict

import httpx
from langgraph.graph import END, START, StateGraph


class TripState(TypedDict, total=False):
    origin: str
    destination: str
    latitude: float
    longitude: float
    temperature: float
    weather_code: int
    route_plan: str


async def check_weather(state: TripState) -> dict:
    params = {
        "latitude": state["latitude"],
        "longitude": state["longitude"],
        "current": "temperature_2m,weather_code",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            "https://api.open-meteo.com/v1/forecast", params=params
        )
        response.raise_for_status()
        current = response.json()["current"]
    return {
        "temperature": current["temperature_2m"],
        "weather_code": current["weather_code"],
    }


def plan_route(state: TripState) -> dict:
    mode = "地铁优先" if state["weather_code"] >= 51 else "步行 + 公交"
    return {
        "route_plan": f"{state['origin']} → {state['destination']}：{mode}"
    }


graph = (
    StateGraph(TripState)
    .add_node("check_weather", check_weather)
    .add_node("plan_route", plan_route)
    .add_edge(START, "check_weather")
    .add_edge("check_weather", "plan_route")
    .add_edge("plan_route", END)
    .compile()
)


async def main() -> None:
    result = await graph.ainvoke(
        {
            "origin": "公司",
            "destination": "机场",
            "latitude": 31.23,
            "longitude": 121.47,
        }
    )
    print(result)


if __name__ == "__main__":
    asyncio.run(main())
