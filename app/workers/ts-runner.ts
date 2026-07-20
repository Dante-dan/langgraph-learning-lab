/// <reference lib="webworker" />

import * as ts from "typescript";

type RunRequest = {
  id: number;
  code: string;
  input: unknown;
};

const worker = self as unknown as DedicatedWorkerGlobalScope;

worker.onmessage = async (event: MessageEvent<RunRequest>) => {
  const { id, code, input } = event.data;
  const logs: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;

  try {
    const compiled = ts.transpileModule(code, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        strict: true,
      },
      reportDiagnostics: true,
      fileName: "playground.ts",
    });
    const errors = (compiled.diagnostics ?? [])
      .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
      .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
    if (errors.length) throw new Error(errors.join("\n"));

    console.log = (...args: unknown[]) => logs.push(args.map(formatLogValue).join(" "));
    console.error = (...args: unknown[]) => logs.push(`[error] ${args.map(formatLogValue).join(" ")}`);

    const exports = inspectExports(code);
    const source = exports.namedRunGraph || exports.defaultExport
      ? compiled.outputText
      : `${compiled.outputText}\nexport { runGraph };\n`;
    const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    try {
      const userProgram = await import(/* @vite-ignore */ url) as {
        runGraph?: (value: unknown) => unknown | Promise<unknown>;
        default?: (value: unknown) => unknown | Promise<unknown>;
      };
      const entrypoint = userProgram.runGraph ?? userProgram.default;
      if (typeof entrypoint !== "function") {
        throw new Error("请定义 runGraph(input)，或 default export 一个可调用函数。");
      }
      const result = await entrypoint(input);
      worker.postMessage({ id, ok: true, result, logs });
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    worker.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      logs,
    });
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
};

function formatLogValue(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function inspectExports(code: string): { namedRunGraph: boolean; defaultExport: boolean } {
  const sourceFile = ts.createSourceFile("playground.ts", code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let namedRunGraph = false;
  let defaultExport = false;

  const hasModifier = (node: ts.Node, kind: ts.SyntaxKind) => (
    ts.canHaveModifiers(node) && Boolean(ts.getModifiers(node)?.some((modifier) => modifier.kind === kind))
  );

  for (const statement of sourceFile.statements) {
    if (ts.isExportAssignment(statement)) defaultExport = true;
    if (hasModifier(statement, ts.SyntaxKind.DefaultKeyword)) defaultExport = true;

    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      if (statement.exportClause.elements.some((element) => element.name.text === "runGraph")) namedRunGraph = true;
    }

    if (!hasModifier(statement, ts.SyntaxKind.ExportKeyword) || hasModifier(statement, ts.SyntaxKind.DefaultKeyword)) continue;
    if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name?.text === "runGraph") {
      namedRunGraph = true;
    }
    if (ts.isVariableStatement(statement) && statement.declarationList.declarations.some((declaration) => (
      ts.isIdentifier(declaration.name) && declaration.name.text === "runGraph"
    ))) {
      namedRunGraph = true;
    }
  }

  return { namedRunGraph, defaultExport };
}

export {};
