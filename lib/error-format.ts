// How a failed source is told to the user: the same line from `build`, `check` and `show` (ADR 0013).
// `✗ <source>: <message>` and nothing else — no stack. A multi-line message (a verification failure lists its problems) is kept as it is.
// SVG_DIAGRAM_DEBUG=1 adds the stack, for the tool's own bugs.

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function formatBuildError(src: string, err: unknown, env: NodeJS.ProcessEnv = process.env): string {
  const head = `✗ ${src}: ${errorMessage(err)}`;
  return env.SVG_DIAGRAM_DEBUG === '1' && err instanceof Error && err.stack ? `${head}\n${err.stack}` : head;
}
