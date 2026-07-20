/** 顺序结构：输入 → 天气 API → 路线策略 → 最终 State。 */
import { END, START, StateGraph, StateSchema } from "@langchain/langgraph";
import * as z from "zod";

const TripState = new StateSchema({
  origin: z.string(),
  destination: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  temperature: z.number().default(0),
  weatherCode: z.number().default(0),
  routePlan: z.string().default(""),
});

const checkWeather: typeof TripState.Node = async (state) => {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: String(state.latitude),
    longitude: String(state.longitude),
    current: "temperature_2m,weather_code",
  }).toString();
  const response = await fetch(url);
  if (!response.ok) throw new Error(`weather API failed: ${response.status}`);
  const data = await response.json() as {
    current: { temperature_2m: number; weather_code: number };
  };
  return {
    temperature: data.current.temperature_2m,
    weatherCode: data.current.weather_code,
  };
};

const planRoute: typeof TripState.Node = (state) => ({
  routePlan: `${state.origin} → ${state.destination}：${
    state.weatherCode >= 51 ? "地铁优先" : "步行 + 公交"
  }`,
});

const graph = new StateGraph(TripState)
  .addNode("check_weather", checkWeather)
  .addNode("plan_route", planRoute)
  .addEdge(START, "check_weather")
  .addEdge("check_weather", "plan_route")
  .addEdge("plan_route", END)
  .compile();

const result = await graph.invoke({
  origin: "公司",
  destination: "机场",
  latitude: 31.23,
  longitude: 121.47,
});
console.log(result);
