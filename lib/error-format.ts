// How a failed source is told to the user: the same line from `build`, `check` and `show` (ADR 0013).
// `✗ <source>[:line:column]: <message>`. Multi-line messages (such as verification failures) are kept as they are.
// SVG_DIAGRAM_DEBUG=1 adds the stack, for the tool's own bugs.
import type {SourceLoc} from './source-location.ts';

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function formatBuildError(source: string | SourceLoc, err: unknown, env: NodeJS.ProcessEnv = process.env): string {
  const at = typeof source === 'string' ? source : `${source.file}:${source.line}:${source.column}`;
  const head = `✗ ${at}: ${errorMessage(err)}`;
  return env['SVG_DIAGRAM_DEBUG'] === '1' && err instanceof Error && err.stack ? `${head}\n${err.stack}` : head;
}
