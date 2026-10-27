// The date a gantt({today: 'auto'}) draws. The library never reads the clock: the caller says which day it is, in this order:
// `--today` (build / check), the SVG_DIAGRAM_TODAY environment variable, `"today"` in .svg-diagram.json (ADR 0022 D1).

/** 'YYYY-MM-DD' of a real date, else a message that names where the value came from. */
export function checkToday(v: unknown, what: string): string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) !== v) throw new Error(`${what} must be a real date 'YYYY-MM-DD' (got ${JSON.stringify(v)}); the clock is never read, so pass the date yourself, e.g. SVG_DIAGRAM_TODAY=$(date +%F)`);
  return v;
}

/** The day for `today: 'auto'`: the CLI's, else the environment's, else the project's (an empty variable counts as unset). */
export function resolveToday(cli: string | undefined, cfgToday: string | undefined, env: NodeJS.ProcessEnv = process.env): string | undefined {
  if (cli !== undefined) return checkToday(cli, '--today');
  if (env['SVG_DIAGRAM_TODAY']) return checkToday(env['SVG_DIAGRAM_TODAY'], 'SVG_DIAGRAM_TODAY');
  return cfgToday;
}
