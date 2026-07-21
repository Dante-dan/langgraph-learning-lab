import assert from "node:assert/strict";
import test from "node:test";

import { simulateTrip } from "../lib/weather-simulator.ts";

const baseInput = {
  origin: "上海公司",
  destination: "浦东机场",
  hasLocation: true,
  weather: "rain",
  distanceKm: 35,
  preference: "less_walking",
  validationFailures: 0,
  maxAttempts: 3,
};

test("rain routes through transit and returns an accepted plan", () => {
  const result = simulateTrip(baseInput);

  assert.equal(result.status, "accepted");
  assert.ok(result.path.includes("plan_transit"));
  assert.equal(result.finalState.mode, "地铁优先");
  assert.equal(result.response.status, "accepted");
});

test("clear short trip lights the outdoor planning branch", () => {
  const result = simulateTrip({
    ...baseInput,
    weather: "clear",
    distanceKm: 1.2,
    preference: "low_cost",
  });

  assert.equal(result.status, "accepted");
  assert.ok(result.path.includes("plan_outdoor"));
  assert.ok(!result.path.includes("plan_transit"));
  assert.equal(result.finalState.mode, "步行优先");
});

test("missing location pauses at ask_user without pretending to reach END", () => {
  const result = simulateTrip({ ...baseInput, hasLocation: false });

  assert.equal(result.status, "needs_input");
  assert.equal(result.path.at(-1), "ask_user");
  assert.ok(!result.path.includes("__end__"));
  assert.deepEqual(result.response, {
    runtimeStatus: "paused",
    status: "needs_input",
    missing: ["location"],
    resumeWith: "Command(resume=answer)",
  });
});

test("a rejected candidate takes the bounded retry edge before succeeding", () => {
  const result = simulateTrip({ ...baseInput, validationFailures: 1 });
  const weatherChecks = result.events.filter((event) => event.node === "check_weather");

  assert.equal(result.status, "accepted");
  assert.equal(weatherChecks.length, 2);
  assert.equal(result.finalState.attempts, 2);
  assert.ok(result.events.some((event) => event.edge.includes("failed ↺ check_weather")));
});

test("weather API exhaustion reaches fallback instead of inventing data", () => {
  const result = simulateTrip({ ...baseInput, weather: "unavailable", maxAttempts: 2 });
  const weatherChecks = result.events.filter((event) => event.node === "check_weather");

  assert.equal(result.status, "fallback");
  assert.equal(weatherChecks.length, 2);
  assert.ok(result.path.includes("fallback"));
  assert.equal(result.response.weather, null);
});
