export type WeatherScenario = "clear" | "rain" | "storm" | "unavailable";
export type TripPreference = "fastest" | "less_walking" | "low_cost";

export type TripSimulationInput = {
  origin: string;
  destination: string;
  hasLocation: boolean;
  weather: WeatherScenario;
  distanceKm: number;
  preference: TripPreference;
  validationFailures: number;
  maxAttempts: number;
};

export type TripState = {
  origin: string;
  destination: string;
  attempts: number;
  temperature?: number;
  weatherCode?: number;
  condition?: string;
  mode?: string;
  routePlan?: string;
  reason?: string;
  fallback?: string;
  accepted: boolean;
  errors: string[];
  status: "running" | "needs_input" | "accepted" | "fallback";
};

export type SimulationEvent = {
  id: string;
  node: string;
  title: string;
  description: string;
  edge: string;
  diff: Record<string, unknown>;
  state: TripState;
};

export type TripSimulationResult = {
  status: TripState["status"];
  path: string[];
  events: SimulationEvent[];
  finalState: TripState;
  response: Record<string, unknown>;
};

const WEATHER: Record<Exclude<WeatherScenario, "unavailable">, {
  temperature: number;
  weatherCode: number;
  condition: string;
}> = {
  clear: { temperature: 27.2, weatherCode: 0, condition: "晴" },
  rain: { temperature: 22.8, weatherCode: 61, condition: "中雨" },
  storm: { temperature: 20.1, weatherCode: 95, condition: "雷暴" },
};

function snapshot(state: TripState): TripState {
  return { ...state, errors: [...state.errors] };
}

export function simulateTrip(input: TripSimulationInput): TripSimulationResult {
  const state: TripState = {
    origin: input.origin.trim(),
    destination: input.destination.trim(),
    attempts: 0,
    accepted: false,
    errors: [],
    status: "running",
  };
  const events: SimulationEvent[] = [];
  const path: string[] = [];

  const emit = (
    node: string,
    title: string,
    description: string,
    edge: string,
    diff: Record<string, unknown> = {},
  ) => {
    Object.assign(state, diff);
    path.push(node);
    events.push({
      id: `${events.length + 1}-${node}`,
      node,
      title,
      description,
      edge,
      diff,
      state: snapshot(state),
    });
  };

  emit("__start__", "START 接收初始输入", "应用调用 graph.invoke 后，虚拟 START 把初始 State 投递给首节点。", "START → validate_input");

  const missing = [
    !state.origin && "origin",
    !state.destination && "destination",
    !input.hasLocation && "location",
  ].filter(Boolean) as string[];

  emit(
    "validate_input",
    "校验业务输入",
    missing.length ? `缺少 ${missing.join(", ")}` : "起点、终点与位置均可用。",
    missing.length ? "missing → ask_user" : "valid → check_weather",
    missing.length ? { errors: missing.map((field) => `missing:${field}`) } : {},
  );

  if (missing.length) {
    emit("ask_user", "请求补充信息", "interrupt 暂停当前 thread；checkpointer 保存状态，等待应用用同一个 thread_id 恢复。", "interrupt → caller（paused）", { status: "needs_input" });
    return {
      status: state.status,
      path,
      events,
      finalState: snapshot(state),
      response: {
        runtimeStatus: "paused",
        status: "needs_input",
        missing,
        resumeWith: "Command(resume=answer)",
      },
    };
  }

  const attemptsLimit = Math.max(1, Math.min(5, input.maxAttempts));
  const plannedFailures = Math.max(0, Math.min(input.validationFailures, attemptsLimit));

  while (state.attempts < attemptsLimit) {
    const attempt = state.attempts + 1;
    emit("check_weather", `查询天气 · 第 ${attempt} 次`, "天气节点读取位置并调用天气服务。", "API result → route_weather", { attempts: attempt, errors: [] });

    if (input.weather === "unavailable") {
      const canRetry = attempt < attemptsLimit;
      emit(
        "weather_error",
        "天气服务不可用",
        canRetry ? "错误被写入 State，条件边决定重试。" : "已达到最大尝试次数，进入保守 fallback。",
        canRetry ? "retry ↺ check_weather" : "exhausted → fallback",
        { errors: ["weather_api_unavailable"] },
      );
      if (canRetry) continue;

      emit("fallback", "生成保守方案", "外部数据不可用时不伪造天气，返回事先定义的地铁优先方案。", "fallback → respond", {
        mode: "地铁优先",
        routePlan: `${state.origin} → 地铁 → ${state.destination}`,
        reason: "天气服务不可用，选择受天气影响较小的路线",
        fallback: "恢复后重新查询实时天气",
        status: "fallback",
      });
      break;
    }

    const weather = WEATHER[input.weather];
    emit("weather_result", "写入天气结果", `${weather.condition}，${weather.temperature}°C，weatherCode=${weather.weatherCode}。`, "State update → route_weather", weather);

    const outdoor = input.weather === "clear" && input.distanceKm <= 2.5 && input.preference !== "less_walking";
    emit(
      "route_weather",
      "条件边选择规划节点",
      outdoor ? "天气良好、距离较短，进入户外路线比较。" : "天气、距离或偏好要求减少步行，进入公共交通规划。",
      outdoor ? "clear + short → plan_outdoor" : "rain / long / less_walking → plan_transit",
      {},
    );

    if (outdoor) {
      emit("plan_outdoor", "生成步行 / 公交方案", "规划节点生成候选路线，但不自行宣布任务完成。", "plan_outdoor → validate_plan", {
        mode: input.preference === "low_cost" ? "步行优先" : "步行 + 公交",
        routePlan: `${state.origin} → 步行 / 公交 → ${state.destination}`,
        reason: "天气良好且距离较短",
        fallback: "体力不足时切换公交",
      });
    } else {
      const storm = input.weather === "storm";
      emit("plan_transit", "生成公共交通方案", "规划节点根据天气与偏好写入候选路线。", "plan_transit → validate_plan", {
        mode: storm && input.preference === "fastest" ? "网约车接驳 + 地铁" : "地铁优先",
        routePlan: `${state.origin} → ${storm ? "网约车接驳 → " : ""}地铁 → ${state.destination}`,
        reason: storm ? "雷暴天气，减少室外暴露" : input.weather === "rain" ? "当前有雨，减少室外步行" : "距离较远或用户偏好少步行",
        fallback: "地铁中断时改用网约车",
      });
    }

    const shouldFail = attempt <= plannedFailures;
    emit(
      "validate_plan",
      shouldFail ? "验收失败" : "验收通过",
      shouldFail ? "模拟路线数据暂不可用；验证节点拒绝当前候选。" : "天气新鲜度、路线、理由与 fallback 均满足验收条件。",
      shouldFail && attempt < attemptsLimit ? "failed ↺ check_weather" : shouldFail ? "exhausted → fallback" : "accepted → respond",
      shouldFail ? { accepted: false, errors: ["route_temporarily_unavailable"] } : { accepted: true, errors: [], status: "accepted" },
    );

    if (!shouldFail) break;
    if (attempt < attemptsLimit) continue;

    emit("fallback", "验证耗尽后的 fallback", "候选路线连续未通过验收，系统返回保守且可解释的方案。", "fallback → respond", {
      mode: "人工确认",
      routePlan: `${state.origin} → 请在地图应用中确认实时路线 → ${state.destination}`,
      reason: "自动路线连续未通过可用性检查",
      fallback: "转人工或稍后重试",
      status: "fallback",
    });
    break;
  }

  emit("respond", "构造公开响应", "响应节点只挑选允许返回客户端的字段。", "respond → END");
  emit("__end__", "END", "所有节点 inactive，且没有消息在途；本次图执行结束。", "halt");

  const response = {
    status: state.status,
    attempts: state.attempts,
    weather: state.condition ? {
      condition: state.condition,
      temperature: state.temperature,
      weatherCode: state.weatherCode,
    } : null,
    plan: {
      mode: state.mode,
      route: state.routePlan,
      reason: state.reason,
      fallback: state.fallback,
    },
  };

  return { status: state.status, path, events, finalState: snapshot(state), response };
}
