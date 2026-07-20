import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v314.0.2/full/pyodide.mjs";

const ready = loadPyodide();

self.onmessage = async (event) => {
  const { id, code, input } = event.data;
  const logs = [];

  try {
    const pyodide = await ready;
    pyodide.setStdout({ batched: (text) => logs.push(text) });
    pyodide.setStderr({ batched: (text) => logs.push(`[error] ${text}`) });
    pyodide.globals.set("SITE_INPUT_JSON", JSON.stringify(input));

    const serialized = await pyodide.runPythonAsync(`${code}

import inspect as __site_inspect
import json as __site_json
if "run_graph" not in globals() or not callable(run_graph):
    raise TypeError("请定义可调用的 run_graph(input) 函数")
__site_result = run_graph(__site_json.loads(SITE_INPUT_JSON))
if __site_inspect.isawaitable(__site_result):
    __site_result = await __site_result
__site_json.dumps(__site_result, ensure_ascii=False)
`);
    self.postMessage({ id, ok: true, result: JSON.parse(serialized), logs });
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      logs,
    });
  }
};
