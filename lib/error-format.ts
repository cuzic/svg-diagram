// How a failed source is told to the user: the same line from `build`, `check` and `show` (ADR 0013).
// Multi-line messages (such as verification failures) are kept as they are.
// SVG_DIAGRAM_DEBUG=1 adds the stack, for the tool's own bugs.
import type {SourceLoc} from './source-location.ts';

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function buildErrorSite(source: string, loc?: SourceLoc): string {
  if (!loc) return source;
  const at = `${loc.file}:${loc.line}:${loc.column}`;
  return loc.file === source ? at : `${source}: ${at}`;
}

export function formatBuildError(source: string, err: unknown, env: NodeJS.ProcessEnv = process.env): string {
  const head = `✗ ${source}: ${errorMessage(err)}`;
  if (env['SVG_DIAGRAM_DEBUG'] === '1' && err instanceof Error) {
    try {
      const stack = err.stack;
      if (stack) return `${head}\n${stack}`;
    } catch { /* a user-defined stack getter can throw */ }
  }
  return head;
}
