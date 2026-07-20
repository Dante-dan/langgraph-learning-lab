import assert from "node:assert/strict";
import test from "node:test";

import ts from "typescript";
import { PLAYGROUND_PROGRAMS } from "../lib/playground-programs.ts";

async function loadTypeScriptProgram() {
  const compiled = ts.transpileModule(PLAYGROUND_PROGRAMS.typescript, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      strict: true,
    },
    reportDiagnostics: true,
  });
  const errors = (compiled.diagnostics ?? [])
    .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0);

  const source = `${compiled.outputText}\nexport { runGraph };`;
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

test("the executable TypeScript playground responds to preference input", async () => {
  const { runGraph } = await loadTypeScriptProgram();
  const base = {
    origin: "公司",
    destination: "地铁站",
    hasLocation: true,
    weather: "clear",
    distanceKm: 1.2,
    validationFailures: 0,
    maxAttempts: 3,
  };

  const fastest = await runGraph({ ...base, preference: "fastest" });
  const lessWalking = await runGraph({ ...base, preference: "less_walking" });

  assert.equal(fastest.response.mode, "步行 + 公交");
  assert.equal(lessWalking.response.mode, "地铁少步行路线");
  assert.notEqual(fastest.response.mode, lessWalking.response.mode);
});
