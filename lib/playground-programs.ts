export const PLAYGROUND_PROGRAMS = {
  python: `def run_graph(input):
    print("run_graph", input["weather"])
    state = {
        "origin": input["origin"],
        "destination": input["destination"],
        "attempts": 0,
        "accepted": False,
    }
    events = []

    def step(node, edge, **update):
        state.update(update)
        events.append({
            "node": node,
            "edge": edge,
            "diff": update,
            "state": dict(state),
        })

    step("__start__", "START → validate_input")
    missing = []
    if not input["origin"].strip(): missing.append("origin")
    if not input["destination"].strip(): missing.append("destination")
    if not input["hasLocation"]: missing.append("location")
    step("validate_input", "missing → ask_user" if missing else "valid → check_weather",
         errors=[f"missing:{field}" for field in missing])
    if missing:
        step("ask_user", "interrupt → caller (paused)", status="needs_input")
        return {"events": events, "finalState": state,
                "response": {"runtimeStatus": "paused", "status": "needs_input",
                             "missing": missing,
                             "resumeWith": "Command(resume=answer)"}}

    while state["attempts"] < input["maxAttempts"]:
        attempt = state["attempts"] + 1
        step("check_weather", "API → route_weather", attempts=attempt)

        if input["weather"] == "unavailable":
            if attempt < input["maxAttempts"]:
                step("weather_error", "retry ↺ check_weather",
                     errors=["weather_api_unavailable"])
                continue
            step("fallback", "fallback → respond",
                 status="fallback", mode="地铁优先",
                 routePlan=f"{state['origin']} → 地铁 → {state['destination']}")
            break

        weather_code = {"clear": 0, "rain": 61, "storm": 95}[input["weather"]]
        step("route_weather", "condition → plan node", weatherCode=weather_code)
        outdoor = (weather_code < 51 and input["distanceKm"] <= 2.5
                   and input["preference"] != "less_walking")
        if outdoor:
            mode = "步行优先" if input["preference"] == "low_cost" else "步行 + 公交"
        elif input["weather"] == "storm" and input["preference"] == "fastest":
            mode = "网约车接驳 + 地铁"
        elif input["preference"] == "low_cost":
            mode = "地铁低成本路线"
        else:
            mode = "地铁少步行路线"
        step("plan_route", "plan → validate_plan", mode=mode,
             routePlan=f"{state['origin']} → {mode} → {state['destination']}")

        should_fail = attempt <= input["validationFailures"]
        if should_fail:
            step("validate_plan", "failed ↺ check_weather", accepted=False,
                 errors=["route_temporarily_unavailable"])
            if attempt < input["maxAttempts"]:
                continue
            step("fallback", "fallback → respond", status="fallback",
                 mode="人工确认", routePlan="请在地图应用中确认实时路线")
            break

        step("validate_plan", "accepted → respond", accepted=True,
             status="accepted", errors=[])
        break

    step("respond", "respond → END")
    step("__end__", "halt")
    return {
        "events": events,
        "finalState": state,
        "response": {
            "status": state.get("status"),
            "attempts": state["attempts"],
            "mode": state.get("mode"),
            "route": state.get("routePlan"),
        },
    }
`,
  typescript: `type Input = {
  origin: string;
  destination: string;
  hasLocation: boolean;
  weather: "clear" | "rain" | "storm" | "unavailable";
  distanceKm: number;
  preference: "fastest" | "less_walking" | "low_cost";
  validationFailures: number;
  maxAttempts: number;
};

async function runGraph(input: Input) {
  console.log("runGraph", input.weather);
  const state: Record<string, unknown> = {
    origin: input.origin,
    destination: input.destination,
    attempts: 0,
    accepted: false,
  };
  const events: Array<Record<string, unknown>> = [];
  const step = (node: string, edge: string, diff: Record<string, unknown> = {}) => {
    Object.assign(state, diff);
    events.push({ node, edge, diff, state: { ...state } });
  };

  step("__start__", "START → validate_input");
  const missing = [
    !input.origin.trim() && "origin",
    !input.destination.trim() && "destination",
    !input.hasLocation && "location",
  ].filter(Boolean) as string[];
  step("validate_input", missing.length ? "missing → ask_user" : "valid → check_weather", {
    errors: missing.map((field) => "missing:" + field),
  });
  if (missing.length) {
    step("ask_user", "interrupt → caller (paused)", { status: "needs_input" });
    return {
      events,
      finalState: state,
      response: {
        runtimeStatus: "paused",
        status: "needs_input",
        missing,
        resumeWith: "Command(resume=answer)",
      },
    };
  }

  while ((state.attempts as number) < input.maxAttempts) {
    const attempt = (state.attempts as number) + 1;
    step("check_weather", "API → route_weather", { attempts: attempt });

    if (input.weather === "unavailable") {
      if (attempt < input.maxAttempts) {
        step("weather_error", "retry ↺ check_weather", {
          errors: ["weather_api_unavailable"],
        });
        continue;
      }
      step("fallback", "fallback → respond", {
        status: "fallback",
        mode: "地铁优先",
        routePlan: String(state.origin) + " → 地铁 → " + String(state.destination),
      });
      break;
    }

    const weatherCode = { clear: 0, rain: 61, storm: 95 }[input.weather];
    step("route_weather", "condition → plan node", { weatherCode });
    const outdoor = weatherCode < 51 && input.distanceKm <= 2.5
      && input.preference !== "less_walking";
    const mode = outdoor
      ? input.preference === "low_cost" ? "步行优先" : "步行 + 公交"
      : input.weather === "storm" && input.preference === "fastest"
        ? "网约车接驳 + 地铁"
        : input.preference === "low_cost" ? "地铁低成本路线" : "地铁少步行路线";
    step("plan_route", "plan → validate_plan", {
      mode,
      routePlan: String(state.origin) + " → " + mode + " → " + String(state.destination),
    });

    const shouldFail = attempt <= input.validationFailures;
    if (shouldFail) {
      step("validate_plan", "failed ↺ check_weather", {
        accepted: false,
        errors: ["route_temporarily_unavailable"],
      });
      if (attempt < input.maxAttempts) continue;
      step("fallback", "fallback → respond", {
        status: "fallback",
        mode: "人工确认",
        routePlan: "请在地图应用中确认实时路线",
      });
      break;
    }

    step("validate_plan", "accepted → respond", {
      accepted: true,
      status: "accepted",
      errors: [],
    });
    break;
  }

  step("respond", "respond → END");
  step("__end__", "halt");
  return {
    events,
    finalState: state,
    response: {
      status: state.status,
      attempts: state.attempts,
      mode: state.mode,
      route: state.routePlan,
    },
  };
}
`,
} as const;
