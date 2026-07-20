/// <reference lib="webworker" />

type RunRequest = {
  id: number;
  code: string;
  input: unknown;
};

type PyodideRuntime = {
  setStdout(options: { batched: (text: string) => void }): void;
  setStderr(options: { batched: (text: string) => void }): void;
  globals: { set(name: string, value: string): void };
  runPythonAsync(code: string): Promise<string>;
};

type PyodideModule = {
  loadPyodide(): Promise<PyodideRuntime>;
};

const worker = self as unknown as DedicatedWorkerGlobalScope;
const PYODIDE_MODULE_URL = "https://cdn.jsdelivr.net/pyodide/v314.0.2/full/pyodide.mjs";
const ready = import(/* @vite-ignore */ PYODIDE_MODULE_URL)
  .then((module) => (module as PyodideModule).loadPyodide());

worker.onmessage = async (event: MessageEvent<RunRequest>) => {
  const { id, code, input } = event.data;
  const logs: string[] = [];

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
    worker.postMessage({ id, ok: true, result: JSON.parse(serialized), logs });
  } catch (error) {
    worker.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      logs,
    });
  }
};

export {};
